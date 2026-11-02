# Orchestrator hand-off — <repo> — written <YYYY-MM-DDTHH:MMZ>

Holder: <session title> (<session id>) since <instant>. Predecessor: <session id or none>.
Successor: <session id, or "unassigned">. Ack: <pending | took over at instant>.

Rule: this file is rewritten at every stopping point, never only at hand-off. A successor reads
this file, `tail -40 STATE.md`, and `bun run beep session register list`; nothing else is assumed.

## Rulings in force

Dated, verbatim operator wording, newest first. Paraphrases are not rulings.

| Date | Ruling (verbatim) | Source |
| --- | --- | --- |
| 2026-10-24 | "I agree & we should make this the default rule for now when compute is constrained" (push straight to hosted CI) | AGENTS.md Quality Operator constrained-compute bullet |
| 2026-10-24 | "I prefer that issues ... [are fixed] at their root cause as soon as they are identified instead of kicking the bucket down the road" (supersedes the round-2 review-loop stop) | AGENTS.md Autonomy "Fix findings where they are found" |
| 2026-10-06 | "flip your PR from draft to READY as soon as the content is final and cheap gates pass ... I do not merge until 20 minutes after the later of 'marked ready' and your last push" | memory feedback-review-window-before-merge |
| 2026-10-06 | "only money escalates" (its "review loops stop after round 2" clause was superseded 2026-10-24) | AGENTS.md Autonomy (#1448) |

## Gate snapshot

Paste `bash .claude/skills/orchestrate/gate.sh` output here with its time. A PR whose row changed
since this snapshot is where the predecessor stopped.

```text
<time>
#NNNN ready main abcdef1234 clean ok=16/16 threads=0/3 GATE-MET
```

## Outstanding "final" promises

A row per PR whose owner said "final <sha>". Cleared when merged or withdrawn.

| PR | final sha | ready at | gate job / waiter | order constraint | owner thread link |
| --- | --- | --- | --- | --- | --- |
| #NNNN | abcdef1234 | 2026-10-06T11:10Z | yeet job xyz | after #MMMM | <t3 thread link> |

## Pending operator decisions

Money only. Everything else was decided and is in the Decision Log of the owning packet.

| Asked | Question | Asked by | Fleet desk doc | Status |
| --- | --- | --- | --- | --- |

## Operator-hands items

Non-money steps only the operator can perform: answering a session's pending question, GUI steps,
a YubiKey-gated `sudo`, a sign-in. Agents decide everything else.

| Item | Where | Unblocks |
| --- | --- | --- |

## Next actions (ordered)

1. <the single most important thing; usually a merge or a routed hold>
2. ...

## Recipes

Exact commands a successor needs to re-create what dies with this session or must be re-armed:
merge-gate arming (argv-file recipe), wait-then-arm units, every `Monitor` and background poller
command with its timeout, every T3 scheduled task (`schedule_task` arguments and task id), and
worker/lane launch calls (`delegate_task` / `t3_thread_launch` arguments with their pins and
`clientRequestId`). Paths and ids here are private; never commit.

```bash
<command>   # what it re-arms, when to re-run it
```

## Register

Output of `bun run beep session register list --markdown`, pasted at write time.

| kind | address | owns | state | waiting on orchestrator | last contact | orphan plan |
| --- | --- | --- | --- | --- | --- | --- |

## Communication routes

T3 Code is the only cross-session route. One row per unit: its thread `link`, the `environmentId`
when it runs on a linked host, the provider/model/effort pin it was launched with, the last
`clientRequestId` sent and the `runId` it returned, and any reply still unread.

| Unit thread link | environmentId | Provider / model / effort | Last clientRequestId → runId | Unread reply / ambiguity hold | Orphan plan |
| --- | --- | --- | --- | --- | --- |

A unit T3 did not launch has no route: mark it `unreachable`, keep its brief on disk.
Preserve the originating orchestrator's fallback policy and approved model pins.
A `t3_thread_send` receipt proves delivery, not consumption, role takeover or turn completion;
`t3_thread_wait` on the returned `runId` plus `t3_thread_read` proves the reply.

## Broadcast

Sent by the successor with `t3_thread_send` to every unit in the routes table, one stable
`clientRequestId` per unit. A register row alone never authorizes an app continuation, a new
task, a PR comment or a message to an external person. Record unreachable units and retain
their briefs on disk:

> orchestrator: the role moved to <successor title> (<successor thread link>) at <instant>. Report
> blockers, "final <sha>", and review-thread fixes there. Rulings in force are unchanged:
> ready at content-final, 20-minute review window, only money escalates. Your register row:
> <kind> <address>, owns <...>; reply if anything in it is wrong.

## Journal pointer

`STATE.md` last line at write time: `<copy>`.
