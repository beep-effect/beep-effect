# P2 lane report — W5 live differential replay on the `run4-fleet` pin (2026-10-06)

Brief: `p2-w5-brief.md`; common rules in `p2-common-brief.md`. Rulings: graduation Ruling 9; P2 Rulings 1,
8, 9 and 10, calls aa–ee in `goals/ciops-ontology-pipeline/research/decisions.md`. Deliverables: the
admission-journal decoder widening in `Schemas.ts` (optional `pid`/`procStart`/`checkoutRoot` beside
`ownerRef`/`ownerRefVariant`/`checkoutRef`, exactly-one-of and at-most-one-of owner invariants on each
class, a derived custody reading), the replay window and skip rule in `Replay.ts` (`ReplayWindow`,
`ReplayOptions.window`, `LiveReplayReport`), `scripts/generate-live-replay-evidence.ts`
(`evidence:s7-live` check-by-default), two new fixtures (a surrogate-row journal and a released-only /
trimmed-lease-eviction journal), `test/live-replay.test.ts`, and the rendered evidence
`goals/ciops-ontology-pipeline/research/s7-live-replay-evidence.md`.

## Build protocol

The implementer was killed twice with the desktop app (05:33Z, 06:36Z); its edits survived on disk and a
resume lane verified every brief item against the tree before completing the two gaps (a fallow red of
twelve unused exports and a duplicated script preamble; a tsgo pipeable-form error in a test). Two
lenses (rulings and replay semantics; Effect-v4 mechanics and gates) produced 17 findings; one fix round
fixed 13 with regression tests and deferred 4 to the orchestrator; the skeptic confirmed 0 major left.

| Stage | Lab tests | Outcome |
| --- | --- | --- |
| resume implementer | 61 | every brief item present; fallow and tsgo reds cleared |
| fix 1 / skeptic 1 | 73 | 13 fixed, 4 deferred (orchestrator), 0 major remaining |

## Numbers (the lab's own run, `bun run evidence:s7-live`)

- Live first-choice agreement on the pinned canonical journal: **197 of 200** (one admitted row is the
  unit, as in the golden); the frozen golden recomputed in the same run: **41 of 41**.
- Disagreements: 3, all attributed `same-checkout-active-lease` (the deployed #929 skip that admission
  v1 does not model; engine unchanged): events 69, 259 and 284.
- Skipped: 1 terminal row (event 10, an `admission-released` whose admission fell outside the retained
  window; the only grant active before the window). Ledger-censored verdicts: 4 (events 0, 2, 5, 8).
  Pre-v3 chains: 3 = 2 enqueue-less admitted→released pairs replayed + 1 trimmed chain whose terminal
  row was skipped; the guard agrees with the manifest's count.
- Events: 689 = 200 admitted + 200 released or lease-evicted + 1 skipped + 288 ledger-neutral; the
  pending-set censorship statement covers 44 withdrawn and 1 ticket-evicted request.
- Custody census: live 0, surrogate 689, redacted 0 (every pinned row carries `ownerRef`).
- CQ-009: "temporally out of scope: 0 of 689 pinned rows precede #929 (graduation Ruling 9)".
- Pinned digests asserted by the script: journal `b691253cee4b…`, manifest `7d22f37b879c…`, A-Box
  `ef82ac4f168d…`, golden journal `cf30b993a38d…`; the frozen golden render stays `624bab058087…`.
- Evidence file sha256 `94327d95446d…` (5,321 bytes); `live-replay.test.ts` 27 tests.

## Follow-ups (tracked, minor)

- `replayAdmissionJournal` was already over the 60-line unit law at the seam commit and still is after
  the skip rule moved to module-level helpers; a pure reducer split is the proposed follow-up.
- No cached or hosted step re-proves the committed live evidence (the Labs context is not required);
  the PR body carries the check-mode line and the orchestrator re-runs `evidence:s7-live` at each phase.
- The P1 follow-up on the `released_only_chains` member name stays open; the evidence file says the
  member counts the pre-v3 class.
