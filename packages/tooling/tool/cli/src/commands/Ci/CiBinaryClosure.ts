/**
 * `beep ci binary-closure`: the content digest of everything that shapes the
 * compiled pre-toolchain CI binary.
 *
 * **Details**
 *
 * The closure is the static runtime import graph of `src/bin-ci.ts` (every
 * workspace module `bun build --compile` bundles, walked from source text by
 * the policy-fingerprint graph reader), the manifest of each workspace it
 * reaches, and the build inputs outside the graph: `bun.lock`, `.bun-version`,
 * `bunfig.toml`, the compile recipe and the release workflow. External
 * packages end the walk; `bun.lock` pins them.
 *
 * `CiOperational.patterns.json` is deliberately outside the closure: the
 * binary reads the checkout's copy at run time, and the file is a projection
 * of the compiled-in `ciOperationalPatterns`, whose TypeScript source the
 * walk already covers.
 *
 * The digest is the sha256 of a canonical listing (a version line, then one
 * `<sha256>  <path>` line per file in path order), so it moves only when a
 * closure file's bytes change or a file enters or leaves the closure.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { A, O } from "@beep/utils";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { sha256Hex } from "../Goals/PacketCore/PacketDigest.ts";
import { makePolicyGraph } from "../Lint/internal/PolicyFingerprintGraph.ts";
import { livePolicySourceTree, readPolicyWorkspaces } from "../Lint/PolicyFingerprint.ts";
import { CiCommandError, reportCiCommandError } from "./Ci.errors.ts";
import type * as Digest from "effect/crypto/Digest";
import type { PolicySourceTree } from "../Lint/internal/PolicyFingerprintGraph.ts";
import type { PolicyWorkspace } from "../Lint/PolicyFingerprint.schemas.ts";

const $I = $RepoCliId.create("commands/Ci/CiBinaryClosure");

/** The schema version, also the first line of the digested listing. */
const CLOSURE_VERSION = "beep-ci-binary-closure/v1";

/** The entry `beep ci compile-binary` bundles. */
const CI_BINARY_ENTRY = "packages/tooling/tool/cli/src/bin-ci.ts";

/**
 * Build inputs outside the import graph: the lockfile and runtime pin that
 * fix every external package and the compiler, the install configuration,
 * the compile recipe and the workflow that publishes the binary.
 */
const CI_BINARY_BUILD_INPUTS = [
  ".bun-version",
  ".github/workflows/beep-ci-binary.yml",
  "bun.lock",
  "bunfig.toml",
  "packages/tooling/tool/cli/src/commands/Ci/CiCompileBinary.ts",
] as const;

const isCiCommandError = S.is(CiCommandError);

/**
 * One file of the CI binary closure and the sha256 of its content.
 *
 * **Example** (A closure file)
 *
 * ```ts
 * import { CiBinaryClosureFile } from "@beep/repo-cli/commands/Ci/CiBinaryClosure"
 *
 * const file = CiBinaryClosureFile.make({ path: "bun.lock", sha256: "00" })
 * console.log(file.path) // "bun.lock"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiBinaryClosureFile extends S.Opaque<CiBinaryClosureFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString.pipe($I.annoteKey("CiBinaryClosureFile.path", { description: "Repo-relative POSIX path." })),
    sha256: S.NonEmptyString.pipe(
      $I.annoteKey("CiBinaryClosureFile.sha256", { description: "Lowercase hex sha256 of the file content." })
    ),
  }).pipe($I.annoteSchema("CiBinaryClosureFile", { description: "One file of the CI binary closure." }))
) {}

/**
 * The CI binary closure: its entry, every file in path order, and the digest
 * a release records and the next main push compares against.
 *
 * **Example** (An empty closure)
 *
 * ```ts
 * import { CiBinaryClosure } from "@beep/repo-cli/commands/Ci/CiBinaryClosure"
 *
 * const closure = CiBinaryClosure.make({
 *   schemaVersion: "beep-ci-binary-closure/v1",
 *   entry: "packages/tooling/tool/cli/src/bin-ci.ts",
 *   files: [],
 *   digest: "00",
 * })
 * console.log(closure.files.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CiBinaryClosure extends S.Opaque<CiBinaryClosure, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag(CLOSURE_VERSION),
    entry: S.NonEmptyString.pipe(
      $I.annoteKey("CiBinaryClosure.entry", { description: "The module `bun build --compile` bundles." })
    ),
    files: S.Array(CiBinaryClosureFile).pipe(
      $I.annoteKey("CiBinaryClosure.files", { description: "Every closure file, sorted by path." })
    ),
    digest: S.NonEmptyString.pipe(
      $I.annoteKey("CiBinaryClosure.digest", { description: "sha256 of the canonical closure listing." })
    ),
  }).pipe(
    $I.annoteSchema("CiBinaryClosure", {
      description: "Content digest of every input that shapes the compiled CI binary.",
    })
  )
) {}

const encodeClosureJson = S.encodeEffect(S.fromJsonString(CiBinaryClosure, { space: 2 }));

const readRequired = Effect.fnUntraced(function* (tree: PolicySourceTree, file: string) {
  const text = yield* tree.read(file);
  if (O.isSome(text)) return text.value;
  return yield* CiCommandError.make({ message: `CI binary closure file ${file} does not exist.` });
});

// The closure's file list: reached modules, their workspace manifests, every
// source file of a workspace holding a non-literal dynamic import, and the
// build inputs.
const closurePaths = Effect.fnUntraced(function* (tree: PolicySourceTree, workspaces: ReadonlyArray<PolicyWorkspace>) {
  const graph = makePolicyGraph({ tree, workspaces });
  const reached = yield* graph.moduleClosure([CI_BINARY_ENTRY]);
  const modules = A.fromIterable(reached.modules);
  const manifests = A.map(
    A.getSomes(A.map(modules, graph.workspaceOf)),
    (workspace) => `${workspace.directory}/package.json`
  );
  const opaque = yield* Effect.forEach(A.fromIterable(reached.opaqueWorkspaces), (directory) =>
    tree.files(`${directory}/src`)
  );
  return A.sort(A.dedupe([...modules, ...manifests, ...A.flatten(opaque), ...CI_BINARY_BUILD_INPUTS]), Order.String);
});

/**
 * Compute the CI binary closure over a source tree.
 *
 * **Details**
 *
 * The tree is read, never executed, so tests compute the closure of the live
 * checkout with individual files overlaid and compare digests.
 *
 * **Example** (Prepare a closure computation)
 *
 * ```ts
 * import { ciBinaryClosureOf } from "@beep/repo-cli/commands/Ci/CiBinaryClosure"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const tree = { read: () => Effect.succeed(O.none()), files: () => Effect.succeed([]) }
 * console.log(Effect.isEffect(ciBinaryClosureOf({ tree, workspaces: [] }))) // true
 * ```
 *
 * @param source - The source tree and its workspaces.
 * @returns The closure with its digest.
 * @category use-cases
 * @since 0.0.0
 */
export const ciBinaryClosureOf: (source: {
  readonly tree: PolicySourceTree;
  readonly workspaces: ReadonlyArray<PolicyWorkspace>;
}) => Effect.Effect<CiBinaryClosure, CiCommandError, Digest.Digest> = Effect.fn("Ci.ciBinaryClosureOf")(
  function* ({
    tree,
    workspaces,
  }: {
    readonly tree: PolicySourceTree;
    readonly workspaces: ReadonlyArray<PolicyWorkspace>;
  }) {
    const paths = yield* closurePaths(tree, workspaces);
    const files = yield* Effect.forEach(paths, (path) =>
      Effect.flatMap(readRequired(tree, path), (text) =>
        Effect.map(sha256Hex(text), (sha256) => CiBinaryClosureFile.make({ path, sha256 }))
      )
    );
    const listing = A.join([CLOSURE_VERSION, ...A.map(files, (file) => `${file.sha256}  ${file.path}`), ""], "\n");
    const digest = yield* sha256Hex(listing);
    return CiBinaryClosure.make({ schemaVersion: CLOSURE_VERSION, entry: CI_BINARY_ENTRY, files, digest });
  },
  Effect.mapError((error) =>
    isCiCommandError(error) ? error : CiCommandError.new(error, "Failed to compute the CI binary closure.")
  )
);

/**
 * Compute the CI binary closure of the live checkout under `root`.
 *
 * **Example** (Prepare the live computation)
 *
 * ```ts
 * import { computeCiBinaryClosure } from "@beep/repo-cli/commands/Ci/CiBinaryClosure"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(computeCiBinaryClosure("/repo"))) // true
 * ```
 *
 * @param root - The repository root.
 * @returns The closure with its digest.
 * @category use-cases
 * @since 0.0.0
 */
export const computeCiBinaryClosure = Effect.fn("Ci.computeCiBinaryClosure")(
  function* (root: string) {
    const tree = yield* livePolicySourceTree(root);
    const workspaces = yield* readPolicyWorkspaces(root);
    return yield* ciBinaryClosureOf({ tree, workspaces });
  },
  Effect.mapError((error) =>
    isCiCommandError(error) ? error : CiCommandError.new(error, "Failed to compute the CI binary closure.")
  )
);

const writeClosure = Effect.fnUntraced(function* (closure: CiBinaryClosure, out: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.resolve(out);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFileString(target, `${yield* encodeClosureJson(closure)}\n`);
});

/**
 * `beep ci binary-closure [--out <path>] [--list]`.
 *
 * **Details**
 *
 * Prints the closure digest. `--out` also writes the closure as JSON (the
 * `.closure.json` release asset); `--list` prints each file's line of the
 * digested listing after the digest.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciBinaryClosureCommand } from "@beep/repo-cli/commands/Ci/CiBinaryClosure"
 *
 * console.log(ciBinaryClosureCommand.name) // "binary-closure"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciBinaryClosureCommand = Command.make(
  "binary-closure",
  {
    out: Flag.String("out").pipe(
      Flag.optional,
      Flag.withDescription("Also write the closure as JSON to this path (the release's .closure.json asset)")
    ),
    list: Flag.Boolean("list").pipe(Flag.withDescription("Print every closure file after the digest")),
  },
  ({ out, list }) =>
    Effect.gen(function* () {
      const root = yield* findRepoRoot();
      const closure = yield* computeCiBinaryClosure(root);
      if (O.isSome(out)) yield* writeClosure(closure, out.value);
      yield* Console.log(closure.digest);
      if (list) yield* Effect.forEach(closure.files, (file) => Console.log(`${file.sha256}  ${file.path}`));
    }).pipe(
      Effect.mapError((error) =>
        isCiCommandError(error) ? error : CiCommandError.new(error, "Failed to write the CI binary closure.")
      ),
      Effect.catchTag("CiCommandError", reportCiCommandError)
    )
).pipe(Command.withDescription("Print the content digest of the compiled CI binary's closure"));
