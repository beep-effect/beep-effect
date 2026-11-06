/**
 * Frozen pre-W7 probe bodies for `ops/worktree-differential-w7.ts`, from
 * `packages/tooling/tool/cli/src/commands/Worktree/Reap.service.ts` at the lane base 8602b24203 (the W7 kit head).
 *
 * `successfulOutput`, `ghPrList` and `readIdleHours` are verbatim except for import paths; `classifyPr`'s live HEAD
 * probe and `probeEvidence`'s status read are lifted into `headProbe` and `dirtyProbe` with the same argv. Every probe
 * runs through the `ReapCommandRunner` seam, defaulting to `runRepoCommandCapture` (which survives the retirement).
 */

import { $RepoCliId } from "@beep/identity/packages";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as Str from "@beep/utils/Str";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as N from "effect/Number";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/RepoRun.executor.ts";

const $I = $RepoCliId.create("goals/repo-cli-gh-git-consolidation/ops/frozen-w7c/Reap.old");

class GhPr extends S.Opaque<GhPr, { readonly brand: unique symbol }>()(
  S.Struct({ number: S.Int, headRefOid: GitObjectId }).pipe(
    $I.annoteSchema("GhPr", { description: "Minimal pull-request row decoded from gh pr list JSON output." })
  )
) {}

const decodeGhPrList = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhPr)));

const successfulOutput = Effect.fn("Frozen.successfulOutput")(function* (
  command: string,
  args: ReadonlyArray<string>,
  cwd: string
) {
  const result = yield* runRepoCommandCapture(command, args, cwd).pipe(Effect.option);
  return O.flatMap(result, (capture) =>
    capture.exitCode === 0 && !capture.truncated ? O.some(capture.output) : O.none()
  );
});

export const ghPrList = Effect.fn("Frozen.ghPrList")(function* (cwd: string, branch: string, state: "merged" | "open") {
  const output = yield* successfulOutput(
    "gh",
    ["pr", "list", "--head", branch, "--state", state, "--json", "number,headRefOid", "--limit", "1"],
    cwd
  );
  if (O.isNone(output)) {
    return O.none<ReadonlyArray<GhPr>>();
  }
  return yield* decodeGhPrList(output.value).pipe(Effect.option);
});

/** `classifyPr`'s live HEAD probe: the trimmed sha, or `None`. */
export const headProbe = (cwd: string) =>
  successfulOutput("git", ["rev-parse", "HEAD"], cwd).pipe(Effect.map(O.map(Str.trim)));

/** `probeEvidence`'s status read: dirty, clean, or `None` when the probe failed. */
export const dirtyProbe = (cwd: string) =>
  successfulOutput("git", ["status", "--porcelain", "--untracked-files=all", "--ignore-submodules=none"], cwd).pipe(
    Effect.map(O.map((output) => Str.isNonEmpty(Str.trim(output))))
  );

export const readIdleHours = Effect.fn("Frozen.readIdleHours")(function* (entryPath: string, nowMillis: number) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const commitOutput = yield* successfulOutput("git", ["log", "-1", "--format=%ct", "HEAD"], entryPath);
  const headPathOutput = yield* successfulOutput(
    "git",
    ["rev-parse", "--path-format=absolute", "--git-path", "HEAD"],
    entryPath
  );
  if (O.isNone(commitOutput) || O.isNone(headPathOutput)) {
    return { hours: O.none<number>(), failed: true };
  }
  const commitSeconds = N.parse(Str.trim(commitOutput.value));
  const headPath = Str.trim(headPathOutput.value);
  if (O.isNone(commitSeconds) || Str.isEmpty(headPath)) {
    return { hours: O.none<number>(), failed: true };
  }
  const headInfo = yield* fs.stat(path.resolve(headPath)).pipe(Effect.option);
  const headMtime = pipe(
    headInfo,
    O.flatMap((info) => info.mtime),
    O.map(DateTime.fromDateUnsafe),
    O.map(DateTime.toEpochMillis)
  );
  if (O.isNone(headMtime)) {
    return { hours: O.none<number>(), failed: true };
  }
  const newestMillis = N.max(commitSeconds.value * 1_000, headMtime.value);
  const age = Duration.millis(N.max(0, nowMillis - newestMillis));
  return { hours: O.some(age.pipe(Duration.toHours)), failed: false };
});

/** The rows `ghPrList` answered, as plain `{ number, headRefOid }` records. */
export const plainRows = (rows: O.Option<ReadonlyArray<GhPr>>) =>
  O.map(
    rows,
    A.map((row) => ({ number: row.number, headRefOid: row.headRefOid }))
  );
