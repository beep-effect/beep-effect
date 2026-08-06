# Fleet Coordination For Parallel Agent Checkouts

## Status

Stage: `shape`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

~13 clones of this monorepo run on one workstation, each hosting an independent
agent session. Two failure modes recur:

- **Mode A** — several agents independently fix the same broken `main`, burning
  duplicate tokens and colliding at merge time.
- **Mode B** — one agent lands a repo-wide policy change (lint rule, gate,
  schema requiredness) and every other agent's in-flight PR rots.

The operator's framing was a "message board" agents could post to. The research
says build a **mirror**, not a board: derive early, deliver ambiently, enforce
late.

Cross-machine coordination is **out of scope** by operator ruling — all
checkouts share one filesystem, one kernel, one user.

## Next Open Question

What is the appetite for `beep worktree fleet`, and does the mirror earn a
`BRIEF.md` on its own or ride into PR-I as an extension of `beep worktree
doctor`? All nine align questions are closed ([`DECISIONS.md`](./DECISIONS.md));
the shape stage decides scope bound, fat-marker sketch, rabbit holes, and no-gos.

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) — machine state, the nine open questions.
2. [`RESEARCH.md`](./RESEARCH.md) — the distilled landscape and what died.
3. [`research/SYNTHESIS.md`](./research/SYNTHESIS.md) — full cross-track synthesis, five options, recommended sequence.
4. Track deliverables only as needed: [`T1`](./research/T1-prior-art.md) prior art · [`T2`](./research/T2-theory.md) blackboard/lease theory · [`T3`](./research/T3-delivery-vector.md) delivery vectors · [`T4`](./research/T4-merge-queue.md) merge queue · [`T5`](./research/T5-derivation.md) derivation surface.

## Cross-Session Coordination

This packet was produced in `beep-effect5` while the speed-loop campaign ran in
`beep-effect3-pra`. Ownership transfers and schema reservations were negotiated
across the two sessions and ratified as speed-loop grill decisions 34–38:

- [`research/HANDOFF-to-beep-effect3.md`](./research/HANDOFF-to-beep-effect3.md) — what this packet took off the speed-loop plate (#22 design half, #16) and the shapes it reserved (#49, #52, #45).
- [`research/AMENDMENTS-from-beep-effect3.md`](./research/AMENDMENTS-from-beep-effect3.md) — their rulings back, including the decision-37 principle governing this design: *the claim record describes what is claimed; provenance, liveness, and expiry are knowledge about the claim and belong on the wrapper.*

The negotiation had to be relayed by hand through the operator, because the
capability this packet is about does not exist yet.

## Trail

- 2026-08-04: grill #1 closed all nine questions → `shape`. Five locked (D1–D5),
  four disposed. The load-bearing move was a **correction to the synthesis**:
  only one of five live collisions is intra-wave, not four, so `WaveManifest`'s
  shared bucket covers 1 of 4 generated-file collisions and the mirror is doing
  real work rather than duplicating #49. Mandate: repo-wide regeneration rule +
  read-only mirror; **no claim registry, no enforcement**. Q0/Q7 handed to
  speed-loop PR-G rather than fixed here — the fix edits `Yeet/internal/Handler.ts`,
  which PR-E is actively editing and where a sibling worktree already predicts
  conflicts. Applying the packet's own thesis to itself.
- 2026-08-04: opened at `align`. Five research tracks plus adversarial
  verification completed (11 agents, ~1.39M tokens); synthesis landed with nine
  open questions. Two P0 findings verified independently and one fixed in the
  same PR (`law-pulse.sh` had never reached the model — `PostToolUse` plain
  stdout is debug-log-only; a silent no-op since 2026-07-05). The second P0
  (`lefthook.yml` has no `pre-push` stage, so `beep yeet` is a convention rather
  than an engineering control) turned out to be three-quarters built already and
  became Q0 rather than a fix.
