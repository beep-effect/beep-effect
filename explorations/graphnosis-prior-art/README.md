# Graphnosis Prior Art — Mining a Dual-Graph Agent Memory Engine

## Status

Stage: `shape`
Status: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Spark

Benjamin found [Graphnosis](https://github.com/nehloo/Graphnosis) — an Apache-2.0 TypeScript
library for dual-graph agent memory with a specified binary format and a determinism doctrine — and
asked whether it holds anything of value to beep-effect: information, patterns, strategies, ideas,
code, design. It does, but not in the shape you would expect: **beep-effect is at partial-or-better
on 78% of everything four independent artifacts do.** The yield is corrections to systems we already
own, plus a handful of rules that cost one SPEC sentence today and a migration later.

## Next Open Question

None — align closed 2026-08-06 with **Q1–Q10 all resolved, each as recommended**
([`DECISIONS.md`](./DECISIONS.md) is the log). Next work at shape:

1. `BRIEF.md` for the two graduations decided in Q1 — `epistemic-contradiction-detection` and
   the repo-law bundle (Rule 5, declared loop caps, law-scanner non-vacuity).
2. The amendment-application pass over [`research/AMENDMENTS.json`](./research/AMENDMENTS.json),
   now unblocked: Q2/Q7 settle the fusion-core wording, Q4 the retirement-reason wording, Q9 the
   modality placement, Q10 the standards paragraph.

## What came out of it

Two decision-ready outputs, per Benjamin's ask for graduation candidates *and* amendments to what
is already built or planned:

- **26 concrete amendments** ([`research/AMENDMENTS.json`](./research/AMENDMENTS.json)) — 12
  `spec-delta`/`plan-delta` against open packets, 8 `code-change`/`schema-change` against shipped
  `packages/**`, each with the target file quoted at `path:line` before the change was proposed.
  Reasoning and the 14 rejected candidates:
  [`research/amendments-open-goals.md`](./research/amendments-open-goals.md),
  [`research/amendments-shipped-code.md`](./research/amendments-shipped-code.md).
- **A ranked value inventory** ([`research/SYNTHESIS.md`](./research/SYNTHESIS.md)) — 15 Tier-1
  items, a Tier-2 table routed to 20+ existing packets, an *already covered* section that protects
  against rebuilding, and a *do not copy* section.

Three live defects in shipped code fell out of the mining: an insertion-order tie-break in
`WinkCorpus`, a pdfjs `WorkerTransport` leak on the **success** path in `DocText`, and seven law
scanners that never assert their own scan matched a file.

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
