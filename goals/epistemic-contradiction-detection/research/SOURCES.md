# Epistemic Contradiction Detection — Sources & Provenance

Provenance ledger, seeded at graduate (2026-08-06). **Links, not copies:** the
source exploration's ledger stays primary and is not reproduced here. Consult it
directly before citing any external source; reproduce a row into this file only
when a phase actually consumes it, and never invent a URL, DOI, or repo link.

- **Source exploration:** `explorations/graphnosis-prior-art` — primary ledger:
  [`research/SOURCES.md`](../../../explorations/graphnosis-prior-art/research/SOURCES.md).
- **Consumer packet (contract owner):**
  [`goals/epistemic-contradiction-triage`](../../epistemic-contradiction-triage/README.md)
  and its ledger
  [`research/SOURCES.md`](../../epistemic-contradiction-triage/research/SOURCES.md).
  This packet produces against that packet's shipped schema and adds no donor
  dependency of its own.

## 1. Contract sources

| Source | What it fixes for this packet | Location |
| --- | --- | --- |
| BRIEF §Problem A + §Solution Sketch A | The shaped pitch: detection as the missing detective, pure over a snapshot, typed direct-conflict classes only, per-class constant confidence, upstream-only boundary | [`explorations/graphnosis-prior-art/BRIEF.md`](../../../explorations/graphnosis-prior-art/BRIEF.md) |
| BRIEF §Rabbit Holes + §No-Gos | This packet's Non-Goals and Stop Conditions, verbatim in intent: no ML/tuned scoring, no contract extension, no auto-resolution, no modality-taxonomy extension, no verbatim ports, no donor/Chronocept numbers | ibid. |
| Q1 — packet shape | Why this packet exists at all: detection is both a Non-Goal and a stop-and-re-scope condition of the triage packet, so it could not be amended in | [`DECISIONS.md`](../../../explorations/graphnosis-prior-art/DECISIONS.md) |
| Q6 — DeterminismTier timing | Any determinism-tier declaration ships in the same PR as the golden vectors that can falsify it | ibid. |
| Q9 — MATRES modality placement | Modality vocabulary is owned by belief-view revision; detection consumes it as an optional input with a `comparable` v1 default | ibid. |
| SYNTHESIS T1-13, wp-09, cc-04/cc-05 | Why the donor's thresholds do not travel; conflict *character* at detection time vs *disposition* at review time; modality as a soft prior, never a hard gate | [`research/SYNTHESIS.md`](../../../explorations/graphnosis-prior-art/research/SYNTHESIS.md) |

## 2. Upstream repositories & licenses

**None taken.** See the exploration ledger's §2 for the full disposition. Two
duties travel with this packet and are restated here because they bind code
this packet may write:

- **Clean-room only.** The Graphnosis donor is Apache-2.0, so
  port-with-attribution is legally available — but the disposition on record is
  clean-room, since every mechanism lands on an Effect v4 schema-first surface
  with no shared code. If any port becomes verbatim, the Apache-2.0 attribution
  attaches and must be registered in the exploration's ledger **before** the
  code lands.
- **No donor thresholds.** The donor's detection constants are tuned on
  conversational-memory pairs, not legal text. They are not a starting point,
  and copying one would violate this packet's own Non-Goals independently of
  license.

## 3. External research sources

Cited, not reproduced — the exploration ledger's §3 carries the verified
license and provenance for each.

- **Ning et al. 2018 (MATRES)** — the eight-axis modality taxonomy this packet
  consumes as an optional input. Adopt the axes as-published. Not on disk; the
  exploration ledger records how it was reached and where to cite it from until
  fetched. **Cite Ning et al., never Chronocept**, for this taxonomy.
- **Quarantine (inherited, binding):** the exploration ledger quarantines the
  donor's LongMemEval figures and all Chronocept quantitative results. No such
  number appears in this packet's SPEC, PLAN, README, or code comments.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `ContradictionCandidate` entity — the output contract | `packages/epistemic/domain/src/entities/Contradiction/Contradiction.model.ts:58-86` | **reuse, read-only** — produced against, never edited |
| `ContradictionAssessment` (requires `confidence`, a `Confidence` unit interval) | `packages/epistemic/domain/src/values/Contradiction/Contradiction.model.ts:913-925` | reuse, read-only — satisfied with per-class constants |
| `ContradictionMatchBasis` (`detector`, `detectorVersion`, `kind`, evidence sets) | `ibid.:560-584`, exposed at `:648` | reuse, read-only — the conflict-class seat question in `SPEC.md` turns on this |
| `ContradictionMatchBasisKind` = `["same-source-overlap", "independent-evidence"]` | `ibid.:435` | read-only — an evidence-provenance vocabulary; widening it is triage's change, not ours |
| `BeliefVersionRef` — immutable belief-version reference | `ibid.:294` | reuse — the snapshot input references beliefs by this shape |
| `LiteralKit`, `SchemaUtils` | `@beep/schema` | reuse — every literal union in this packet |
| Conflict-class vocabulary, snapshot input schema, per-class confidence constants, detection `Context.Service` | `packages/epistemic/{domain,use-cases}` | **NET-NEW** |
| NLP similarity primitives (`TverskySimilarity`, `BowCosineSimilarity`, `TextSimilarity`, `ExtractKeywords`) | `packages/foundation/capability/nlp-processing/src/Tools/` | **explicitly not used in v1** — recorded so a later packet with calibration data knows they exist; reaching for them here is a stop condition |

## 5. Cross-links & provenance

- Source exploration:
  [`explorations/graphnosis-prior-art`](../../../explorations/graphnosis-prior-art/README.md)
  — this packet is **packet A** of its two graduations, carved out by Q1.
- Sibling graduation: the repo-law bundle (working slug
  `agentic-governance-laws`) carries Q6's determinism-tier standards edit. This
  packet is bound by Q6 but does not own the standards prose.
- Downstream consumer and contract owner:
  [`goals/epistemic-contradiction-triage`](../../epistemic-contradiction-triage/SPEC.md)
  — its Non-Goals (`SPEC.md:23-26`) and stop-and-re-scope clause
  (`SPEC.md:138-139`) are inputs to this packet's spec, not text to be edited.
- Modality vocabulary owner:
  [`explorations/epistemic-belief-view-revision`](../../../explorations/epistemic-belief-view-revision/README.md)
  — capture stage; this packet does not block on it.
- Decision log with dated Q1/Q6/Q9 entries: [`../SPEC.md`](../SPEC.md).
