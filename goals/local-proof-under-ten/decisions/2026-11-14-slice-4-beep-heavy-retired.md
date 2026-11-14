---
title: "Slice 4: beep-heavy rule retired from the orchestrate skill and runbook"
date: 2026-11-14
kind: checkpoint
lane: "docs/local-proof-retire-beep-heavy"
reversal: "Restore the removed beep-heavy lines in the three edited files from this commit's parent; the wrapper itself was never changed."
---

Slice 4 lands PERIL-10's documentation half. `beep-heavy` is a slot wrapper installed outside the repo on 2026-10-06: it ran a command in `agent-runs.slice` after taking one of a few machine-wide `flock` slots. The exploration inventory found no `beep-heavy` unit since 2026-10-25, and no repo code calls it. The quality scheduler is the one admission authority (ruling D3), so live instructions now state what it does instead of the wrapper rule:

- `.claude/skills/orchestrate/SKILL.md`: the gate-table poller runs as a plain user unit (`systemd-run --user --unit=orchestrator-gate --collect --same-dir -E PATH ...`) or a T3 scheduled task. Hand-off re-creates a background poller as a `yeet ... --detach` job, a `systemd-run --user` unit or a scheduled task. "Where to launch" now says heavy commands need no wrapper: Yeet's full, merged-preview and review-fix proofs wait for weighted scheduler admission and run in `agent-run-<ticket>.scope`; other commands, such as `quality package-verify`, are not admitted yet (SCHE-02) and run directly; `beep-heavy` stays out of briefs.
- `docs/runbooks/practice-m365-contacts-seeding.md`: the two single-file live-test commands run without the `beep-heavy` prefix.
- `goals/design-figure-review-loop/PLAN.md`: its execution note no longer routes heavy commands through `beep-heavy`.

Left unchanged: `goals/oppold-corpus-salvage-restoration` (paused; its mentions are dated decision records and the frozen launch protocol of its paused extraction wave, which that goal revisits when it resumes); `goals/declaration-only-builds/ops/measure-build-baseline.ts` (a completed goal's script, where the mention is a usage comment); and every history, decisions and research file. The wrapper script itself and the personal memory notes that still describe it live outside the repo and are the operator's to retire.

PERIL-10 is now fully landed (slice 2 for the status summary and archive, slice 4 for the documentation).
