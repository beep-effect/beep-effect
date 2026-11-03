/**
 * Receipts for a successful clean-HEAD install preflight, so an exact
 * verified-proof reuse can skip a repeat install of the same commit.
 *
 * **Details**
 *
 * A receipt names the commit and tree that installed and every input the
 * frozen install reads from them: `bun.lock`, each `package.json`, the
 * `patches/` directory, `bunfig.toml` and `.npmrc` (as blob ids at that
 * commit), plus the Bun version, platform and architecture that ran it. Any
 * difference refuses reuse, and so does age: a frozen lockfile does not pin
 * what lifecycle scripts fetch from the network, so a receipt expires after
 * {@link HEAD_INSTALL_RECEIPT_TTL}.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { LiteralKit } from "@beep/schema";
import { HostProcessArchitecture, HostProcessPlatform } from "@beep/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { YeetCommandError } from "../Yeet.errors.ts";
import { runArtifactPathForContext } from "./ArtifactPaths.ts";
import { runGitFoldedStdout, runGitOutput } from "./GitExec.ts";
import type { RunFoldedStdoutOptions } from "@beep/repo-cli-kit/process/StepExec";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/HeadInstallReceipt");

/**
 * How long a clean-HEAD install receipt stays reusable after the install.
 *
 * @category configuration
 * @since 0.0.0
 */
export const HEAD_INSTALL_RECEIPT_TTL = Duration.hours(4);

const HEAD_INSTALL_RECEIPT_FILE_NAME = "head-install-receipt.json";
const ABSENT_LOCKFILE = "absent";
const LOCKFILE_PATH = "bun.lock";
const ROOT_INSTALL_CONFIG_PATHS = ["bunfig.toml", ".npmrc"] as const;

/**
 * The install inputs a commit carries, as the frozen install would read them.
 *
 * **Example** (Describe one commit's install inputs)
 *
 * ```ts
 * import { HeadInstallInputs } from "@beep/repo-cli/test/Yeet"
 *
 * const inputs = HeadInstallInputs.make({
 *   commitSha: "c".repeat(40),
 *   treeSha: "t".repeat(40),
 *   lockfileDigest: "l".repeat(40),
 *   manifestsDigest: "m".repeat(64),
 *   bunVersion: "1.4.4",
 *   platform: "linux",
 *   architecture: "x64",
 * })
 * console.log(inputs.bunVersion) // "1.4.4"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HeadInstallInputs extends S.Opaque<HeadInstallInputs, { readonly brand: unique symbol }>()(
  S.Struct({
    commitSha: S.String,
    treeSha: S.String,
    lockfileDigest: S.String,
    manifestsDigest: S.String,
    bunVersion: S.String,
    platform: S.String,
    architecture: S.String,
  }).pipe(
    $I.annoteSchema("HeadInstallInputs", {
      description:
        "Commit, tree, lockfile and manifest blob digests, and the Bun version and host that a frozen clean-HEAD install depends on.",
    })
  )
) {}

/**
 * Proof that a frozen install of one commit succeeded, with its validity window.
 *
 * @category models
 * @since 0.0.0
 */
export class HeadInstallReceipt extends S.Opaque<HeadInstallReceipt, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("head-install-receipt/v1"),
    inputs: HeadInstallInputs,
    installedAt: S.String,
    expiresAt: S.String,
  }).pipe(
    $I.annoteSchema("HeadInstallReceipt", {
      description: "A successful clean-HEAD frozen install: the inputs it installed and when the receipt expires.",
    })
  )
) {}

/**
 * Why an install receipt cannot stand in for a fresh clean-HEAD install.
 *
 * **Example** (Name a refusal reason)
 *
 * ```ts
 * import { HeadInstallReceiptRefusal } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(HeadInstallReceiptRefusal.is["lockfile-changed"]("lockfile-changed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HeadInstallReceiptRefusal = LiteralKit([
  "no-receipt",
  "expired",
  "commit-changed",
  "tree-changed",
  "lockfile-changed",
  "manifests-changed",
  "bun-changed",
  "host-changed",
]).pipe(
  $I.annoteSchema("HeadInstallReceiptRefusal", {
    description: "One reason a clean-HEAD install receipt was not reused.",
  })
);

/**
 * Type of {@link HeadInstallReceiptRefusal}.
 *
 * @category models
 * @since 0.0.0
 */
export type HeadInstallReceiptRefusal = typeof HeadInstallReceiptRefusal.Type;

const HeadInstallReceiptJson = JsonStringCodec(HeadInstallReceipt);
const textEncoder = new TextEncoder();

const isRootInstallConfigPath = (path: string): boolean => A.contains(ROOT_INSTALL_CONFIG_PATHS, path);

const isManifestPath = (path: string): boolean => path === "package.json" || Str.endsWith("/package.json")(path);

const isInstallInputPath = (path: string): boolean =>
  path === LOCKFILE_PATH || isRootInstallConfigPath(path) || isManifestPath(path) || Str.startsWith("patches/")(path);

// `git ls-tree -r` prints `<mode> <type> <blob>\t<path>`; the folded output
// keeps `<path>\0<blob>` for install inputs only, already in path order.
const installInputLine = (line: string): Result.Result<string, string> => {
  const [meta, path] = Str.split("\t")(line);
  return pipe(
    O.all({ meta: O.fromUndefinedOr(meta), inputPath: O.filter(O.fromUndefinedOr(path), isInstallInputPath) }),
    O.flatMap(({ meta, inputPath }) => O.map(A.get(Str.split(" ")(meta), 2), (blob) => `${inputPath}\0${blob}`)),
    Result.fromOption(() => line)
  );
};

const foldInstallInputs: RunFoldedStdoutOptions["fold"] = (stdout) =>
  stdout.pipe(
    Stream.decodeText,
    Stream.splitLines,
    Stream.filterMap(installInputLine),
    Stream.map((entry) => `${entry}\n`),
    Stream.mkString
  );

/**
 * Read the install inputs one commit carries and the host that would install it.
 *
 * @param repoRoot - Checkout whose object store holds the commit.
 * @param commitSha - Commit whose tree is installed.
 * @returns The commit's install inputs.
 * @category execution
 * @since 0.0.0
 */
export const collectHeadInstallInputs = Effect.fn("Yeet.collectHeadInstallInputs")(function* (
  repoRoot: string,
  commitSha: string
): Effect.fn.Return<
  HeadInstallInputs,
  YeetCommandError,
  SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner | Digest.Digest
> {
  const treeSha = yield* runGitOutput(repoRoot, ["rev-parse", `${commitSha}^{tree}`]);
  const resultGitFoldedStdout = yield* runGitFoldedStdout(
    repoRoot,
    ["ls-tree", "-r", "--full-tree", commitSha],
    foldInstallInputs
  );
  const entries = pipe(resultGitFoldedStdout, Str.split("\n"), A.filter(Str.isNonEmpty));
  const lockfileDigest = pipe(
    A.findFirst(entries, Str.startsWith(`${LOCKFILE_PATH}\0`)),
    O.map(Str.slice(LOCKFILE_PATH.length + 1)),
    O.getOrElse(() => ABSENT_LOCKFILE)
  );
  return HeadInstallInputs.make({
    commitSha,
    treeSha,
    lockfileDigest,
    manifestsDigest: yield* (yield* Digest.Digest).digestHex(
      Digest.sha256,
      textEncoder.encode(
        A.join(
          A.filter(entries, (entry) => !Str.startsWith(`${LOCKFILE_PATH}\0`)(entry)),
          "\n"
        )
      )
    ),
    // `process.versions.bun` is absent when the CLI runs under Node.
    bunVersion: process.versions.bun ?? "none",
    platform: yield* HostProcessPlatform,
    architecture: yield* HostProcessArchitecture,
  });
});

/**
 * Decide whether a receipt still proves a clean install of the current inputs.
 *
 * **Details**
 *
 * Every differing input is reported, not only the first, so the log line that
 * explains a fresh install names all of them.
 *
 * **Example** (Refuse a missing receipt)
 *
 * ```ts
 * import { HeadInstallInputs, headInstallReceiptRefusals } from "@beep/repo-cli/test/Yeet"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const inputs = HeadInstallInputs.make({
 *   commitSha: "c",
 *   treeSha: "t",
 *   lockfileDigest: "l",
 *   manifestsDigest: "m",
 *   bunVersion: "1.4.4",
 *   platform: "linux",
 *   architecture: "x64",
 * })
 * console.log(headInstallReceiptRefusals(O.none(), inputs, DateTime.makeUnsafe(0))) // ["no-receipt"]
 * ```
 *
 * @param receipt - Receipt carried by the verified proof state, if any.
 * @param current - Install inputs of the commit about to be pushed.
 * @param now - Decision instant.
 * @returns The refusal reasons; empty when the receipt is reusable.
 * @category predicates
 * @since 0.0.0
 */
export const headInstallReceiptRefusals: {
  (
    current: HeadInstallInputs,
    now: DateTime.DateTime
  ): (receipt: O.Option<HeadInstallReceipt>) => ReadonlyArray<HeadInstallReceiptRefusal>;
  (
    receipt: O.Option<HeadInstallReceipt>,
    current: HeadInstallInputs,
    now: DateTime.DateTime
  ): ReadonlyArray<HeadInstallReceiptRefusal>;
} = dual(
  3,
  (
    receipt: O.Option<HeadInstallReceipt>,
    current: HeadInstallInputs,
    now: DateTime.DateTime
  ): ReadonlyArray<HeadInstallReceiptRefusal> =>
    O.match(receipt, {
      onNone: () => [HeadInstallReceiptRefusal.Enum["no-receipt"]],
      onSome: ({ inputs, expiresAt }) =>
        A.getSomes([
          O.liftPredicate(HeadInstallReceiptRefusal.Enum.expired, () =>
            O.match(DateTime.make(expiresAt), {
              onNone: () => true,
              onSome: (expiry) => !DateTime.isLessThan(now, expiry),
            })
          ),
          O.liftPredicate(
            HeadInstallReceiptRefusal.Enum["commit-changed"],
            () => inputs.commitSha !== current.commitSha
          ),
          O.liftPredicate(HeadInstallReceiptRefusal.Enum["tree-changed"], () => inputs.treeSha !== current.treeSha),
          O.liftPredicate(
            HeadInstallReceiptRefusal.Enum["lockfile-changed"],
            () => inputs.lockfileDigest !== current.lockfileDigest
          ),
          O.liftPredicate(
            HeadInstallReceiptRefusal.Enum["manifests-changed"],
            () => inputs.manifestsDigest !== current.manifestsDigest
          ),
          O.liftPredicate(
            HeadInstallReceiptRefusal.Enum["bun-changed"],
            () => inputs.bunVersion !== current.bunVersion
          ),
          O.liftPredicate(
            HeadInstallReceiptRefusal.Enum["host-changed"],
            () => inputs.platform !== current.platform || inputs.architecture !== current.architecture
          ),
        ]),
    })
);

const receiptPathForContext = (
  context: RepoRunContext
): Effect.Effect<string, YeetCommandError, Path.Path | Digest.Digest> =>
  runArtifactPathForContext(context, HEAD_INSTALL_RECEIPT_FILE_NAME);

/**
 * Record a successful clean-HEAD install of one commit for this run.
 *
 * **Details**
 *
 * The receipt is written beside the run state; {@link loadHeadInstallReceipt}
 * hands it to the verified state that the same run writes.
 *
 * @param context - Run whose artifact directory holds the receipt.
 * @param commitSha - Commit the preflight installed.
 * @returns The written receipt.
 * @category persistence
 * @since 0.0.0
 */
export const recordHeadInstallReceipt = Effect.fn("Yeet.recordHeadInstallReceipt")(function* (
  context: RepoRunContext,
  commitSha: string
): Effect.fn.Return<
  HeadInstallReceipt,
  YeetCommandError,
  | FileSystem.FileSystem
  | Path.Path
  | SecureRandom.SecureRandom
  | ChildProcessSpawner.ChildProcessSpawner
  | Digest.Digest
> {
  const inputs = yield* collectHeadInstallInputs(context.repoRoot, commitSha);
  const installedAt = yield* DateTime.now;
  const receipt = HeadInstallReceipt.make({
    schemaVersion: "head-install-receipt/v1",
    inputs,
    installedAt: DateTime.formatIso(installedAt),
    expiresAt: DateTime.formatIso(DateTime.addDuration(installedAt, HEAD_INSTALL_RECEIPT_TTL)),
  });
  const encoded = yield* HeadInstallReceiptJson.encode(receipt).pipe(
    Effect.mapError(YeetCommandError.new("Failed to encode the head-install receipt."))
  );
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const receiptPath = yield* receiptPathForContext(context);
  yield* fs
    .makeDirectory(path.dirname(receiptPath), { recursive: true })
    .pipe(
      Effect.andThen(fs.writeFileString(receiptPath, `${encoded}\n`)),
      Effect.mapError(YeetCommandError.new(`Failed to write the head-install receipt at ${receiptPath}.`))
    );
  return receipt;
});

/**
 * Drop this run's install receipt, after a failed preflight.
 *
 * @param context - Run whose receipt is removed.
 * @returns Nothing; a missing receipt is not an error.
 * @category persistence
 * @since 0.0.0
 */
export const clearHeadInstallReceipt = Effect.fn("Yeet.clearHeadInstallReceipt")(function* (context: RepoRunContext) {
  const fs = yield* FileSystem.FileSystem;
  const receiptPathForContext1 = yield* receiptPathForContext(context);
  yield* fs.remove(receiptPathForContext1, { force: true }).pipe(Effect.ignore);
});

/**
 * Load this run's install receipt for one commit.
 *
 * @param context - Run whose receipt is read.
 * @param commitSha - Commit the receipt must name.
 * @returns The receipt, or none when it is absent, undecodable or for another commit.
 * @category persistence
 * @since 0.0.0
 */
export const loadHeadInstallReceipt = Effect.fn("Yeet.loadHeadInstallReceipt")(function* (
  context: RepoRunContext,
  commitSha: string
): Effect.fn.Return<O.Option<HeadInstallReceipt>, YeetCommandError, FileSystem.FileSystem | Path.Path | Digest.Digest> {
  const fs = yield* FileSystem.FileSystem;
  const receiptPathForContext2 = yield* receiptPathForContext(context);
  const text = yield* fs.readFileString(receiptPathForContext2).pipe(Effect.option);
  return pipe(
    text,
    O.flatMap(HeadInstallReceiptJson.decodeOption),
    O.filter((receipt) => receipt.inputs.commitSha === commitSha)
  );
});

/**
 * Render the refusal reasons for the log line that explains a fresh install.
 *
 * @param reasons - Refusal reasons from {@link headInstallReceiptRefusals}.
 * @returns A comma-separated, human-readable list.
 * @category formatting
 * @since 0.0.0
 */
export const renderHeadInstallReceiptRefusals = (reasons: ReadonlyArray<HeadInstallReceiptRefusal>): string =>
  A.join(A.map(reasons, Str.replaceAll("-", " ")), ", ");
