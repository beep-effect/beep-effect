# Orchestrator hand-off — <repo> — written <YYYY-MM-DDTHH:MMZ>

Holder: <session title> (<session id>) since <instant>. Predecessor: <session id or none>.
Successor: <session id, or "unassigned">. Ack: <pending | took over at instant>.

Rule: this file is rewritten at every stopping point, never only at hand-off. A successor reads
this file, `tail -40 STATE.md`, and `bun run beep session register list`; nothing else is assumed.

## Rulings in force

Dated, verbatim operator wording, newest first. Paraphrases are not rulings.

| Date | Ruling (verbatim) | Source |
| --- | --- | --- |
| 2026-10-06 | "flip your PR from draft to READY as soon as the content is final and cheap gates pass ... I do not merge until 20 minutes after the later of 'marked ready' and your last push" | memory feedback-review-window-before-merge |
| 2026-10-06 | "only money escalates ... review loops stop after round 2" | AGENTS.md Autonomy (#1448) |

## Gate snapshot

Paste `bash .claude/skills/orchestrate/gate.sh` output here with its time. A PR whose row changed
since this snapshot is where the predecessor stopped.

```text
<time>
#NNNN ready main abcdef1234 clean ok=16/16 threads=0/3 GATE-MET
```

## Outstanding "final" promises

A row per PR whose owner said "final <sha>". Cleared when merged or withdrawn.

| PR | final sha | ready at | gate job / waiter | order constraint | owner address |
| --- | --- | --- | --- | --- | --- |
| #NNNN | abcdef1234 | 2026-10-06T11:10Z | yeet job xyz | after #MMMM | local_... |

## Pending operator decisions

Money only. Everything else was decided and is in the Decision Log of the owning packet.

| Asked | Question | Asked by | Fleet desk doc | Status |
| --- | --- | --- | --- | --- |

## Next actions (ordered)

1. <the single most important thing; usually a merge or a routed hold>
2. ...

## Register

Output of `bun run beep session register list --markdown`, pasted at write time.

| kind | address | owns | state | waiting on orchestrator | last contact | orphan plan |
| --- | --- | --- | --- | --- | --- | --- |

## Broadcast

Sent by the successor at take-over to every register row (SendMessage for desktop sessions, a PR
comment starting `orchestrator:` for Codex lanes, the fleet desk for people):

> orchestrator: the role moved to <successor title> (<successor id>) at <instant>. Report
> blockers, "final <sha>", and review-thread fixes there. Rulings in force are unchanged:
> ready at content-final, 20-minute review window, only money escalates. Your register row:
> <kind> <address>, owns <...>; reply if anything in it is wrong.

## Journal pointer

`STATE.md` last line at write time: `<copy>`.
