# Epistemic Contradiction Detection Plan

## Status

Status: `pending`

Appetite: **small** — one short PR ladder (schema → service contract → first
slice). If the work sprawls past that, cut to the first slice rather than
extending the appetite. The mining, alignment, and evidence are already paid
for by `explorations/graphnosis-prior-art`; this packet spends that capital, it
does not re-earn it.

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | pending | Confirm the shipped contract surface and settle the conflict-class seat. | The `SPEC.md` Open Contract Question is answered on the record; every `file:line` in `SPEC.md` re-verified against the live tree. |
| P1 Implement | pending | Schema → `Context.Service` contract → implementation, in that order. | Conflict-class `LiteralKit` + snapshot input schema, then the detection service contract, then the pure implementation; the shipped `Contradiction` surfaces are unmodified. |
| P2 Verify | pending | Golden vectors and fixtures prove purity and contract conformance. | Golden-vector lane green, run twice with an advanced clock producing identical output; every emitted candidate decodes against `ContradictionCandidate`; `bun run beep yeet verify` SUCCESS. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P0 Research — mostly already paid

The exploration did the research. P0 is a **verification and one-decision**
phase, not a mining phase. Read, do not redo:

- [`explorations/graphnosis-prior-art/BRIEF.md`](../../explorations/graphnosis-prior-art/BRIEF.md)
  §Problem A, §Solution Sketch A, §Rabbit Holes, §No-Gos — the shaped pitch.
- [`research/SYNTHESIS.md`](../../explorations/graphnosis-prior-art/research/SYNTHESIS.md)
  T1-13 (deterministic model-free detection, and why the donor's thresholds do
  not travel), wp-09 (conflict *character* at detection time vs *disposition*
  at review time), cc-04/cc-05 (modality as a soft prior, never a hard gate).
- [`DECISIONS.md`](../../explorations/graphnosis-prior-art/DECISIONS.md) Q1, Q6,
  Q9 — mirrored as dated entries in this packet's `SPEC.md` decision log.

P0's own work, all of it small:

1. Re-verify every `file:line` citation in `SPEC.md` against the live tree; the
   triage packet is mid-flight, so its surfaces can move under this packet.
2. Answer the Open Contract Question (conflict-class seat). If the answer is
   "negotiate with triage," open that conversation in P0 and record its state —
   but v1 proceeds on the no-change option regardless.
3. Name the belief-view snapshot input shape well enough to write the schema:
   what a belief carries (subject, predicate, value, optional modality,
   evidence refs) and what the detector is allowed to see.

No fixture spike gate here — unlike triage, this packet writes nothing durable,
so there is no database behavior to prove before design.

## P1 Implement — the design order is law

Schema → `Context.Service` contract → implementation. Never helpers-first.

1. **Schema.** Conflict-class `LiteralKit`, modality-comparability guard input,
   belief-view snapshot input, and the per-class confidence constants as named
   schema building blocks.
2. **Contract.** One `Context.Service` whose method takes a snapshot and
   returns candidates. Generator-returning functions use `Effect.fn` /
   `Effect.fnUntraced`.
3. **Implementation.** Pure comparison over the snapshot: pairs sharing subject
   and predicate, filtered by the modality guard, classified into exact
   negation or value-conflict, emitted with the per-class constant confidence
   and a total content-derived ordering.

Cut line if the slice grows: ship exact negation alone, with value-conflict as
the follow-up PR. Both classes in one PR is the target, not the requirement.

## P2 Verify — golden vectors are the phase

- Golden vectors for exact negation and value-conflict, plus negatives: a pair
  sharing subject but not predicate; a pair separated only by modality; a pair
  whose modality is absent (must be flagged, per the stated default).
- The purity proof: same snapshot twice, clock advanced between runs, identical
  output.
- Contract conformance: every emitted candidate decodes against the shipped
  `ContradictionCandidate`, and
  `git diff --stat -- packages/epistemic/domain/src/{values,entities}/Contradiction`
  is empty.
- Any determinism-tier declaration lands in this same PR (Q6) or not at all.

## P3 Yeet — PR to mergeable

`bun run beep yeet repair` → `... verify` → `... publish --pr` →
`... monitor` until `merge-ready: yes`. Unresolved review threads are a hard
merge gate; answer and resolve every one via `bun run beep yeet reply`.

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed),
   the **implementation** (improvement opportunities), and the **goal/prompt**
   (would you revise it to be clearer/easier/more efficient?). Capture TODOs
   worth codifying. Its YAML frontmatter must validate against
   `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Current Blockers

None. This packet does not block on belief-view revision (capture stage) and
does not block on the triage packet closing — it produces against triage's
already-shipped schema.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Triage is mid-flight at P2 verify. Coordinate before assuming any
  `Contradiction` surface is stable, and never edit it from this packet.

## Verification Commands

```sh
test "$(wc -m < goals/epistemic-contradiction-detection/GOAL.md)" -le 4000
jq . goals/epistemic-contradiction-detection/ops/manifest.json
rg -n "epistemic-contradiction-detection|GOAL.md|agentLaunchers|packetAnchorDocument" goals/epistemic-contradiction-detection
git diff --check -- goals/epistemic-contradiction-detection
```
