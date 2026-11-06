/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the merge-only publish guard (`assertMergeOnlyPublish`) of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/Handler.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const oldAssertMergeOnlyPublish = Effect.fn("Yeet.oldAssertMergeOnlyPublish")(function* (
  context: RepoRunContext
): Effect.fn.Return<void, YeetCommandError, SecureRandom.SecureRandom | ChildProcessSpawner.ChildProcessSpawner> {
  const refuse = () =>
    Effect.fail(
      YeetCommandError.make({
        message:
          "yeet publish --push-only requires --reuse-verified unless HEAD is a reproducible merge of the base into the published branch.",
      })
    );
  const parents = Str.split(
    Str.trim(yield* oldRunGitOutput(context.repoRoot, ["show", "-s", "--format=%P", "HEAD"])),
    " "
  );
  if (parents.length !== 2) return yield* refuse();
  const first = A.get(parents, 0);
  const second = A.get(parents, 1);
  if (O.isNone(first) || O.isNone(second)) return yield* refuse();
  // FETCH_HEAD avoids trusting a stale tracking ref or updating any other checkout.
  yield* oldRunGitOutput(context.repoRoot, ["fetch", "--quiet", "--no-tags", "origin", `refs/heads/${context.branch}`]);
  const published = Str.trim(yield* oldRunGitOutput(context.repoRoot, ["rev-parse", "FETCH_HEAD"]));
  const baseAncestor = Str.trim(yield* oldRunGitOutput(context.repoRoot, ["merge-base", second.value, context.base]));
  if (first.value !== published || baseAncestor !== second.value) return yield* refuse();
  const merged = yield* oldRunGitOutput(context.repoRoot, [
    "merge-tree",
    "--write-tree",
    first.value,
    second.value,
  ]).pipe(Effect.catchTag("YeetCommandError", () => refuse()));
  const tree = Str.trim(yield* oldRunGitOutput(context.repoRoot, ["rev-parse", "HEAD^{tree}"]));
  if (Str.trim(merged) !== tree) return yield* refuse();
});
