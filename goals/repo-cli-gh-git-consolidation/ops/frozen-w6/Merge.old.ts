/**
 * Frozen pre-W6 body for `ops/yeet-gh-seams-differential-w6.ts`: the merge phase of `mergePr` in
 * `packages/tooling/tool/cli/src/commands/Yeet/internal/Merge.ts` (the `gh pr merge --squash --match-head-commit`
 * call and the bounded `MERGED` confirmation over `gh pr view <number>`), verbatim from the lane base 641180ade6 (W5
 * head) except for import paths. The lines sat inline in `mergePr`, after its reviewer gate
 * and before its sweep; here they are lifted into `mergeAtHead`, over a `view` holding only the number, the cut the
 * live module now exports as `mergeYeetPullRequestAtHead`.
 */

import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YeetCommandError } from "../../../../packages/tooling/tool/cli/src/commands/Yeet/Yeet.errors.ts";
import { GhPrView, ghOutput } from "../../../../packages/tooling/tool/cli/src/internal/github/index.ts";
import { runRepoCommandCapture } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";
import type * as SecureRandom from "effect/crypto/SecureRandom";
import type * as Duration from "effect/Duration";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { RepoRunContext } from "../../../../packages/tooling/tool/cli/src/internal/repo-run/index.ts";

const mergedState = "MERGED";
const pullRequestViewFields = "number,headRefName,state,headRefOid";

/**
 * Bounded-poll settings for the post-merge `MERGED` confirmation.
 */
export interface MergePrOptions {
  /** Extra confirmation reads after the first one. */
  readonly pollAttempts: number;
  /** Delay between confirmation reads. */
  readonly pollInterval: Duration.Input;
}

const decodePullRequestView = S.decodeUnknownEffect(S.fromJsonString(GhPrView));

const readPullRequest = Effect.fn("Yeet.readMergePullRequest")(function* (
  context: RepoRunContext,
  selector: string
): Effect.fn.Return<GhPrView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> {
  const output = yield* ghOutput({
    args: ["pr", "view", selector, "--json", pullRequestViewFields],
    cwd: context.repoRoot,
    label: `gh pr view ${selector}`,
    onFailure: (failure) =>
      YeetCommandError.make({
        message: `Failed to read pull request "${selector}" (${failure._tag}).`,
        command: failure.command,
        exitCode: 1,
      }),
  });
  return yield* decodePullRequestView(output).pipe(
    Effect.mapError(YeetCommandError.new(`Failed to decode gh pr view JSON for "${selector}".`))
  );
});

const confirmMerged = Effect.fn("Yeet.confirmPullRequestMerged")(function* (
  context: RepoRunContext,
  pullRequestNumber: number
): Effect.fn.Return<GhPrView, YeetCommandError, ChildProcessSpawner.ChildProcessSpawner | SecureRandom.SecureRandom> {
  const view = yield* readPullRequest(context, `${pullRequestNumber}`);
  if (view.state !== mergedState) {
    return yield* YeetCommandError.make({
      message: `pull request #${pullRequestNumber} reports state ${view.state}, not ${mergedState}.`,
      command: `gh pr view ${pullRequestNumber} --json ${pullRequestViewFields}`,
      exitCode: 1,
    });
  }
  return view;
});

/** The merge phase of the pre-W6 `mergePr`, verbatim: merge, then confirm. */
export const mergeAtHead = Effect.fn("Yeet.mergeAtHead.old")(function* (
  context: RepoRunContext,
  view: { readonly number: number },
  pinnedHead: { readonly value: string },
  options: MergePrOptions
) {
  const mergeCommand = `gh pr merge ${view.number} --squash --match-head-commit ${pinnedHead.value}`;
  const merge = yield* runRepoCommandCapture(
    "gh",
    ["pr", "merge", `${view.number}`, "--squash", "--match-head-commit", pinnedHead.value],
    context.repoRoot
  ).pipe(Effect.mapError(YeetCommandError.new(`Failed to run ${mergeCommand}.`)));
  if (merge.exitCode !== 0) {
    return yield* YeetCommandError.make({
      message: `${mergeCommand} failed:\n${Str.trim(merge.output)}`,
      command: mergeCommand,
      exitCode: merge.exitCode,
    });
  }

  const confirmed = yield* confirmMerged(context, view.number).pipe(
    Effect.retry({ times: options.pollAttempts, schedule: Schedule.spaced(options.pollInterval) })
  );
  return confirmed;
});
