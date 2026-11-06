/**
 * Frozen pre-W7 bodies for `ops/yeet-differential-w7.ts`: the pull request title resolver (`resolvePullRequestTitle`) of
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequestTitle.ts`, verbatim from the lane base 8602b24203 except for import paths, the
 * `old` name prefix, and the retiring Yeet `runGitOutput`/`runGitPathList` wrappers, which resolve to the inlined
 * copies in `GitRunners.old.ts`.
 */

import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  titleFromMessage,
  YeetPullRequestTitleResolution,
} from "../../../../packages/tooling/tool/cli/src/commands/Yeet/internal/PullRequestTitle.ts";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { oldRunGitOutput } from "./GitRunners.old.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

export const firstNonEmptyLine = (text: string): O.Option<string> =>
  pipe(Str.split(text, "\n"), A.map(Str.trim), A.findFirst(Str.isNonEmpty));

export const oldResolvePullRequestTitle = Effect.fn("Yeet.oldResolvePullRequestTitle")(function* (
  context: RepoRunContext,
  message: O.Option<string>,
  range: string
): Effect.fn.Return<
  YeetPullRequestTitleResolution,
  YeetCommandError,
  ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom
> {
  const fromMessage = O.flatMap(message, titleFromMessage);
  if (O.isSome(fromMessage)) {
    return YeetPullRequestTitleResolution.make({ title: fromMessage.value, source: "message" });
  }
  const args = ["log", "--no-merges", "--reverse", "--pretty=%s", range];
  const subjects = yield* oldRunGitOutput(context.repoRoot, args);
  return yield* O.match(firstNonEmptyLine(subjects), {
    onNone: () =>
      YeetCommandError.make({
        message: `yeet publish found no non-merge commit in ${range} to title the pull request; pass --message "<conventional subject>".`,
        command: `git ${A.join(args, " ")}`,
        exitCode: 1,
      }),
    onSome: (title) => Effect.succeed(YeetPullRequestTitleResolution.make({ title, source: "first-non-merge-commit" })),
  });
});
