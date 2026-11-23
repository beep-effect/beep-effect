---
title: "A hosted ci lane step records its lane through a recorded child process"
date: 2026-11-23
lane: "goals/ci-gate-reports-lane-records"
reversal: "Delete CiLaneRecording.ts and the ciLaneSelfCommand branch at the top of the ci lane handler; lanes run in place again and record-less jobs print 'no gate records'"
---

On a GitHub runner, `beep ci lane <id>` records its lane through a child: the CLI entry (`GITHUB_ACTIONS=true`, `process.argv[1]` is `packages/tooling/tool/cli/src/bin.ts`, no `BEEP_CI_LANE_RECORDED`) runs itself again with the same argv and `BEEP_CI_LANE_RECORDED=1`, streams the child's merged output through to the job log and into a scratch log, and exits with the child's exit code (`GateToolExit`). The child runs the lane exactly as before. Code: `packages/tooling/tool/cli/src/commands/Ci/CiLaneRecording.ts`.

**Record.** After the child exits, the recorder compares the modification times of the checkout's gate records (`findJobGateRecordTargets`, now in `CiGateRecordSearch.ts`) with a reading taken before the child started. A new or rewritten record, a package `gate run` or a Turbo cache restore, means the step wrote its own record, and the recorder writes nothing. Otherwise it writes a root run of the `lane` gate, `.beep/gates/lane/<run-id>.{json,log}`, through `runGate` with `withGateServices` (`GateRecorder` over `GateRecordStore`, no history) and prints that console. The subject is the lane id and the item kind is `step`. A zero exit is one passed step. Any other exit states no item, so the reducer records an `errored` run whose fault message is the excerpt of the lane's log. `append-gate-reports` then shows a verdict for Docs Policy, Fallow Advisory, JSDoc Ratchet, Nix Shell, SAST, Professional Desktop IPC Stdio, Test Plan, Coverage Regression's compare step and Verify's repo-sanity step.

**Why a child process.** Lane steps spawn their tools with inherited stdio from more than a dozen call sites (`runLaneProcess`, `Quality/Tasks.ts` step runners, Turbo, partition runners). Re-running the CLI as a child is the one place that sees the whole stream without changing any of them. It costs one extra CLI start per lane step.

**Measurement never decides the step.** Only a failure to start the child fails the step. Searching the checkout, counting annotations and writing the record print one `[ci] lane recording:` line and keep the child's exit code.

**Output that outlives the lane.** The child is detached, so it leads its own process group. Once it exits, the recorder waits at most 5 s (`CI_LANE_DRAIN_GRACE_MS`) for its output to close, then stops reading and stops the group. This bounds the descendant-holding-the-pipe case that `run_lane`'s `setsid` group kill already handles.

**Off a runner** (developer shells, `beep ci local`, tests calling the command), the lane runs in place as before.
