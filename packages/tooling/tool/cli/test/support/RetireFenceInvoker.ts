/**
 * Runs one `yeet sweep --retire` retirement step in its own process.
 *
 * A test spawns this script so that it can play the agent session above the
 * invoker: whatever `CLAUDE_PID` the test exports lands in this process's real
 * initial environment (the `/proc` view the archive fence proves against), and
 * the lane holders the test spawns are this process's siblings under that
 * session, which is exactly where a desktop session's MCP servers sit.
 *
 * Arguments: `<worktreePath> <owningClone> <name> <branch>`. Prints one JSON
 * line `{ ok, message }` and exits 0 when the lane was retired.
 */

import { retireInvokingWorktree, SweepGitState, YeetRetirePlan } from "@beep/repo-cli/test/Yeet";
import * as A from "effect/Array";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import { FenceInvokerLayer, reportFenceOutcome } from "./FenceInvoker.ts";

const argument = (index: number): string => O.getOrThrow(A.get(process.argv, index + 2));

const worktreePath = argument(0);
const owningClone = argument(1);
const name = argument(2);
const branch = argument(3);

const plan = YeetRetirePlan.make({ worktreePath, owningClone, name, branch });

// The facts the retirement gate reads: the pull request for the lane's branch
// is MERGED and heads that branch. Everything else is what a merged lane looks like.
const state = SweepGitState.make({
  branch,
  mainBranch: "main",
  headBranch: branch,
  worktreeDirty: false,
  mainCheckedOutElsewhere: false,
  branchCheckedOutElsewhere: false,
  branchMergedIntoBase: true,
  lockfileMovedOnMainUpdate: false,
  statusProbeUnreliable: false,
  worktreeProbeUnreliable: false,
  mainWorktreePath: O.some(owningClone),
  mainTip: O.none(),
  localTip: O.none(),
  remoteTip: O.none(),
  pullRequestState: O.some("MERGED"),
  pullRequestHeadBranch: O.some(branch),
  pullRequestHeadOid: O.none(),
});

await using runtime = ManagedRuntime.make(FenceInvokerLayer);
const ok = await runtime.runPromise(
  retireInvokingWorktree(plan, state).pipe(
    reportFenceOutcome({ onFailure: (error) => error.message, onSuccess: (receipt) => receipt.reason })
  )
);
process.exitCode = ok ? 0 : 1;
