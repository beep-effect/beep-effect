/**
 * Fleet enrollment of existing Beep clones into the host R2 cache.
 *
 * **Details**
 * Ported from the retired `infra/r2-cache/fleet.py` (enroll existing Beep
 * clones and registered worktrees without changing source).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { runCapturedStreams } from "@beep/repo-cli-kit/process/index";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CacheCommandError } from "./Cache.errors.ts";
import { CacheR2FleetReceipt, CacheR2FleetRow } from "./Cache.r2.schemas.ts";
import type { CacheR2FleetRequest } from "./Cache.r2.schemas.ts";

const CanonicalOrigin = /^(?:https:\/\/github\.com\/|git@github\.com:)beep-effect\/beep-effect(?:\.git)?$/;
const POLICY_FILES = [
  "packages/tooling/library/repo-cli-kit/src/cli/TurboCache.ts",
  // The policy moved to @beep/repo-cli-kit in beep-cli-composition W3; older checkouts keep it in repo-cli.
  "packages/tooling/tool/cli/src/internal/cli/TurboCache.ts",
];
const PathOrder = Order.mapInput(A.makeOrder(Str.Order), (path: string) => Str.split(path, "/"));
const encodeReceipt = S.encodeEffect(S.fromJsonString(CacheR2FleetReceipt, { space: 2 }));
const failedCapture = (exitCode: number) => () => ({ exitCode, stdout: "", stderr: "", truncated: false });

// Any git failure reads as an empty answer, as the retired script's captured calls did.
const gitText = <E>(read: Effect.Effect<string, E>) => read.pipe(Effect.orElseSucceed(() => ""));

const originUrl = (git: Git["Service"], clone: string) =>
  git.remoteUrl(clone).pipe(Effect.map(O.getOrElse(() => "")), gitText);

const listedWorktrees = (git: Git["Service"], clone: string) =>
  git.worktreeList(clone).pipe(Effect.map(A.map((entry) => entry.path)), Effect.orElseSucceed(A.empty<string>));

const isType = (fs: FileSystem.FileSystem, type: "File" | "Directory") => (candidate: string) =>
  fs.stat(candidate).pipe(
    Effect.map((info) => info.type === type),
    Effect.orElseSucceed(() => false)
  );

const clonesUnder = Effect.fnUntraced(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const isGitCheckout = (candidate: string) => fs.exists(path.join(candidate, ".git"));
  if (yield* isGitCheckout(root)) return [yield* fs.realPath(root)];
  if (!(yield* isType(fs, "Directory")(root))) return A.empty<string>();
  const children = yield* fs.readDirectory(root);
  const candidates = A.map(A.filter(children, Str.startsWith("beep-effect")), (entry) => path.join(root, entry));
  const checkouts = yield* Effect.filter(candidates, isGitCheckout);
  return yield* Effect.forEach(checkouts, fs.realPath, { concurrency: 1 });
});

const worktreesOf = Effect.fnUntraced(function* (clone: string) {
  const fs = yield* FileSystem.FileSystem;
  const git = yield* Git;
  const origin = yield* originUrl(git, clone);
  if (!CanonicalOrigin.test(origin)) return A.empty<string>();
  const listed = yield* listedWorktrees(git, clone);
  const existing = yield* Effect.filter(listed, (checkout) => isType(fs, "Directory")(checkout));
  return yield* Effect.forEach(existing, fs.realPath, { concurrency: 1 });
});

const planCheckout = Effect.fnUntraced(function* (checkout: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const policies = yield* Effect.filter(
    A.map(POLICY_FILES, (file) => path.join(checkout, file)),
    (file) => isType(fs, "File")(file)
  );
  const text = yield* O.match(A.head(policies), { onNone: () => Effect.succeed(""), onSome: fs.readFileString });
  const mode = pipe(text, Str.includes("BEEP_TURBO_TRUSTED_WRITER"))
    ? ("local:rw,remote:rw" as const)
    : ("local:rw,remote:r" as const);
  const supported = pipe(text, Str.includes("local:rw,remote:r"));
  const git = yield* Git;
  const head = yield* git.revParse(checkout, "HEAD").pipe(gitText);
  return CacheR2FleetRow.make({ checkout, head, mode, status: supported ? "planned" : "legacy-use-beep-turbo" });
});

const enroll = Effect.fnUntraced(function* (row: CacheR2FleetRow, workstation: string) {
  // Enrollment errors describe field names only. Do not retain arbitrary command output.
  const result = yield* runCapturedStreams({ command: workstation, args: ["enable", row.checkout, row.mode] }).pipe(
    Effect.orElseSucceed(failedCapture(127))
  );
  return CacheR2FleetRow.make({
    ...row,
    status: result.exitCode === 0 ? "enrolled" : "blocked",
    exit_code: result.exitCode,
  });
});

const writePrivateReceipt = Effect.fnUntraced(function* (output: string, receipt: CacheR2FleetReceipt) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.dirname(output), { recursive: true, mode: 0o700 });
  const text = yield* encodeReceipt(receipt);
  yield* fs.writeFileString(output, text, { mode: 0o600 });
  yield* fs.chmod(output, 0o600);
});

const summaryLines = (rows: ReadonlyArray<CacheR2FleetRow>) => {
  const statuses = A.sort(A.dedupe(A.map(rows, (row) => row.status)), Str.Order);
  return A.appendAll(
    A.map(statuses, (status) => `${status}: ${A.length(A.filter(rows, (row) => row.status === status))}`),
    [`Read-write capable: ${A.length(A.filter(rows, (row) => Str.endsWith(":rw")(row.mode)))}`]
  );
};

/**
 * Inventory or enroll existing Beep clones and registered worktrees.
 *
 * **Details**
 * Each root is a clone or a parent of `beep-effect*` clones. Only clones whose
 * origin is the canonical public repository count; their registered worktrees
 * are listed. A checkout whose cache resolver supports trusted writes is
 * planned read/write, an older one read-only, and one without the resolver is
 * reported as `legacy-use-beep-turbo`. With `apply`, supported checkouts are
 * enrolled through `workstation.sh enable`; enrollment output is not retained.
 * The default is a read-only plan. Origin, worktree and HEAD reads go through
 * the `Git` service; a failed read counts as an empty answer.
 *
 * **Example** (Plan enrollment for a projects directory)
 * ```ts
 * import { CacheR2FleetRequest, runCacheR2Fleet } from "@beep/repo-cli/test/Cache"
 * import * as O from "effect/Option"
 * const plan = runCacheR2Fleet(
 *   CacheR2FleetRequest.make({
 *     roots: ["/home/me/projects"],
 *     apply: false,
 *     output: O.none(),
 *     workstation: "/repo/infra/r2-cache/workstation.sh"
 *   })
 * )
 * console.assert(typeof plan === "object")
 * ```
 *
 * @internal
 * @param request - Roots, apply flag, optional receipt path and the enrollment script.
 * @returns The receipt and the printed summary lines.
 * @category workflows
 * @since 0.0.0
 */
export const runCacheR2Fleet = Effect.fn("CacheR2.fleet")(function* (request: CacheR2FleetRequest) {
  const clones = yield* Effect.forEach(request.roots, clonesUnder, { concurrency: 1 }).pipe(
    Effect.map(A.flatten),
    Effect.map(A.dedupe)
  );
  const checkouts = yield* Effect.forEach(clones, worktreesOf, { concurrency: 1 }).pipe(
    Effect.map(A.flatten),
    Effect.map(A.dedupe),
    Effect.map(A.sort(PathOrder))
  );
  const planned = yield* Effect.forEach(checkouts, planCheckout, { concurrency: 1 });
  const rows = yield* Effect.forEach(
    planned,
    (row) => (request.apply && row.status === "planned" ? enroll(row, request.workstation) : Effect.succeed(row)),
    { concurrency: 1 }
  );
  const now = yield* DateTime.now;
  const receipt = CacheR2FleetReceipt.make({
    recorded_utc: DateTime.formatIso(now),
    applied: request.apply,
    checkouts: rows,
  });
  yield* Effect.forEach(O.toArray(request.output), (output) => writePrivateReceipt(output, receipt), { discard: true });
  return { receipt, lines: summaryLines(rows), blocked: A.some(rows, (row) => row.status === "blocked") };
}, CacheCommandError.mapError("Fleet enrollment failed."));
