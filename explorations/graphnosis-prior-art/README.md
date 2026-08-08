# Graphnosis Prior Art — Mining a Dual-Graph Agent Memory Engine

## Status

Stage: `graduate`
Status: `graduated`

Source: [`ops/manifest.json`](./ops/manifest.json)

Graduated 2026-08-06 into
[`goals/epistemic-contradiction-detection`](../../goals/epistemic-contradiction-detection/README.md)
and [`goals/agentic-governance-laws`](../../goals/agentic-governance-laws/README.md); the packet
remains as provenance for the 26 amendments and the mining corpus.

## Spark

Benjamin found [Graphnosis](https://github.com/nehloo/Graphnosis) — an Apache-2.0 TypeScript
library for dual-graph agent memory with a specified binary format and a determinism doctrine — and
asked whether it holds anything of value to beep-effect: information, patterns, strategies, ideas,
code, design. It does, but not in the shape you would expect: **beep-effect is at partial-or-better
on 78% of everything four independent artifacts do.** The yield is corrections to systems we already
own, plus a handful of rules that cost one SPEC sentence today and a migration later.

## Next Open Question

None — the packet is graduated. The remaining exploration-owned work is the
**amendment-application pass** over [`research/AMENDMENTS.json`](./research/AMENDMENTS.json),
which travels as its own PR ladder (spec-delta docs-PR carrying the Q10 standards paragraph,
then the three code-change PRs: WinkCorpus tie-break, DocText bracket, LawScan non-vacuity fix)
— Q2/Q7 settle the fusion-core wording, Q4 the retirement-reason wording, Q9 the modality
placement. Implementation questions now belong to the two graduated goal packets.

## What came out of it

Two decision-ready outputs, per Benjamin's ask for graduation candidates *and* amendments to what
is already built or planned:

- **26 concrete amendments** ([`research/AMENDMENTS.json`](./research/AMENDMENTS.json)) — 14
  `spec-delta`/`plan-delta` against open packets, 10 `code-change`/`schema-change` against shipped
  `packages/**`, 2 `doc-change`, each with the target file quoted at `path:line` before the change
  was proposed.
  Reasoning and the 14 rejected candidates:
  [`research/amendments-open-goals.md`](./research/amendments-open-goals.md),
  [`research/amendments-shipped-code.md`](./research/amendments-shipped-code.md).
- **A ranked value inventory** ([`research/SYNTHESIS.md`](./research/SYNTHESIS.md)) — 15 Tier-1
  items, a Tier-2 table routed to 20+ existing packets, an *already covered* section that protects
  against rebuilding, and a *do not copy* section.

Three live defects in shipped code fell out of the mining: an insertion-order tie-break in
`WinkCorpus`, a pdfjs `WorkerTransport` leak on the **success** path in `DocText`, and law
scanners that never assert their own scan matched a file (four independent scan paths — the
mining's "seven through one choke point" was an error; see the RESEARCH.md addendum).

## Read This First

1. [`ops/manifest.json`](./ops/manifest.json) - machine state: stage, status, open questions.
2. [`research/SYNTHESIS.md`](./research/SYNTHESIS.md) - the ranked inventory; §7 routing table, §8 open questions, §9 where it is thin.
3. [`RESEARCH.md`](./RESEARCH.md) - external landscape, in-repo inventory, constraints, and the amendments NOT to make.
4. [`research/SOURCES.md`](./research/SOURCES.md) - provenance ledger; licenses and port disciplines.
5. [`CAPTURE.md`](./CAPTURE.md) - raw dump (stage 0).
6. [`DECISIONS.md`](./DECISIONS.md) - grilling log (stage 2, once align starts).
7. [`research/mining/`](./research/mining/) - the 1.8MB raw corpus, only if you are auditing a specific claim.

## Caveats that travel with this packet

- **The adversarial challenge phase is unusable as a vote.** Seven of eight surveyors used the same
  `gai-NN` id prefix, so challengers received mismatched (title, finding) pairs. Only two rows are
  safely attributable. Details and the fix in [`RESEARCH.md`](./RESEARCH.md).
- **Both Graphnosis papers are vendor-authored** and the repo's own benchmark badge reads
  `re-measuring`. No number from them belongs in a SPEC. Chronocept's quantitative results stay
  quarantined — its license resolved to CC BY 4.0 on the arXiv abs page, but the quarantine is
  about evidence quality, not license.
- **`SPEC.md` §8 is an unimplemented proposal.** `maxAutonomy`, `(id, rev)` identity, and the
  conformance levels are design, not shipped behavior.

## Trail

- 2026-08-06: packet opened; capture taken; four PDFs folded into `assets/`; repo + papers mined
  across three workflows (8 surveys, 8 mappings, 4 paper reads, 4 paper mappings, challenge,
  synthesis, 2 amendment lanes); a session-limit outage killed the first synthesis layer and it was
  recovered from the on-disk notes; RESEARCH/SOURCES written, 26 amendments and 10 align questions
  produced. Stopped at align Q1.
- 2026-08-06 (later): the four PDFs (7.9 MB) replaced with [`assets/README.md`](./assets/README.md)
  — canonical URLs (two Zenodo DOIs found via the Graphnosis repo README, two arXiv ids supplied by
  Benjamin), all four CC BY 4.0, SHA-256 of the mined copies pinned. Chronocept's license upgraded
  from "none printed" to CC BY 4.0 in the sources ledger; its numbers quarantine unchanged.
- 2026-08-06 (align): Q1–Q10 grilled in one sitting, all resolved as recommended — dissolve + two
  graduations; provenance-keyed field-at-a-time comparator; min-composed authority ceilings;
  belief-view-owned readmission; egress sensitivity gate; determinism tiers only with golden
  vectors; typed fusion intent now with the floor off; caps before adherence; MATRES modality on
  belief-view revision; envelope doctrine as one standards paragraph. Stage → shape.
- 2026-08-06 (shape): BRIEF drafted for the two Q1 graduations; contention with a parallel
  crispening branch moved the packet to a sibling git worktree (directory name
  beep-effect15-graphnosis) on branch `explore/graphnosis-prior-art` (based on main @
  `4aa421d9d3`). An adversarial verification
  pass then corrected the BRIEF: LawScan blast-radius mining error disclosed (2 of 7 scanners
  route through `runLawScan`, not 7 — RESEARCH.md addendum), packet A rewritten to produce
  against the shipped sealed `ContradictionCandidate` contract (required `confidence` ⇒
  per-class constants), per-edge cap specificity restored, belief-view-revision capture-stage
  dependency turned into a stated v1 default, Q6 routed to packet B's standards edit, Q2 schema
  naming corrected in DECISIONS.md. All six mined code/spec citations verified intact on
  current main.
- 2026-08-06 (graduate): Benjamin confirmed the BRIEF (finish-up instruction); MAP.md decomposed
  the two Q1 graduations; `goals/epistemic-contradiction-detection` and
  `goals/agentic-governance-laws` scaffolded from `goals/_template` with provenance back-links;
  manifest → `graduate`/`graduated`; ATLAS entry moved Active → Graduated. The
  amendment-application pass stays exploration-owned and ships as its own PR ladder.
