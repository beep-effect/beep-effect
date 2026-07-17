# Decisions Locked — goal-portfolio-driver grill (2026-07-14)

Grill-with-docs session over `SPEC.md` with the operator. Each decision is binding for this
packet; the SPEC carries the normative phrasing. These are packet-local execution decisions —
none change architecture-wide doctrine, so no `standards/architecture/DECISIONS.md` entry is
warranted.

## D1 — Locked queue + wave handoff

The queue locks at P1 with exactly the 25 slugs active in `goals/INDEX.md` on 2026-07-14.
Packets that graduate mid-run are NOT admitted. This run terminates when the locked queue is
drained; the P3 final audit emits a wave-2 queue proposal derived from whatever is active at that
time, which the operator approves with one message. Rationale: guarantees termination and bounded
scope; "non-stop" is preserved through cheap wave restarts rather than an unbounded rolling queue.

## D2 — NOW-first ordering

Within dependency constraints, ROADMAP NOW-lane packets take strict priority over the 2026-07-14
graduation wave; ties break by unblocking-power (number of queued packets a slug unblocks). The
first queue item is deliberately small (`harness-otel-adoption`) to validate the pipeline
end-to-end before product-critical lanes. ROADMAP's "at most three concurrent lanes" refers to
thematic programs, not worktree slots — the loop's 2 edit lanes + 2 monitor slots do not conflict.

## D3 — Coexistence: probe + defer + notify

Before acquiring the verify mutex, the driver probes machine-wide for running turbo/vitest/yeet
processes and defers its proof until they finish (the operator works in the same tree
mid-session). Operator-authored PRs are foreign: never touched, but counted in merge
serialization. The driver push-notifies the operator on every park and every circuit breaker.

## D4 — Fable capacity: sleep-and-resume

On rate-limit signals the driver schedules a long wakeup (30–60 min) and retries; codex
background stages continue meanwhile. Fable exhaustion is a pacing signal, not a breaker; the
committed loop state makes the pause lossless across 5h-window resets and account flips.

## D5 — IMPLEMENT dispatch: packet GOAL.md + loop preamble

Codex workers are launched with the target packet's own `GOAL.md` as the primary instruction,
prefixed by the loop preamble (safety rails + verdict-file contract) and scoped by the Fable
packet brief to one phase/PR unit per dispatch. The generic `ops/prompts/codex-implement.md`
template is the preamble carrier, not a replacement for packet-authored launchers.

## D6 — P2 bootstrap: fresh driver session

The drain loop runs in a fresh Claude session opened in
`beep-effect-worktrees/portfolio-driver` after the P1 scaffold PR merges, launched with
`/goal follow the instructions in goals/goal-portfolio-driver/GOAL.md` plus `/loop` self-pacing.
The P0/P1 bootstrap session hands off exclusively through committed state files.

## Grill notes

- QA lane verified empirically during P0: codex exec + Chrome extension bridge works unattended
  (2/2 smoke passes; `ops/qa-smoke/`). Deep-research's "desktop-app-only" claim did not hold on
  this machine. claude-in-chrome remains the documented fallback.
- Docketing circular dependency (`law-docketing-patent-spine` ↔ `law-docketing-reliability`,
  both citing each other in sweep evidence): resolved spine-first; the reverse edge is advisory
  and must be re-examined by that lane's PACKET_REVIEW brief.
- External, non-queue dependencies (`m365-driver` for legal-document-intake P6 and
  law-docketing-patent-spine; `mcp-kit` for gov-legal-mcp): not blocking queue admission; the
  affected PR units park with an incident if the dependency turns out to be unbuilt at dispatch.
