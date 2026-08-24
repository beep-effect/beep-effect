# Workload Contract — v1.4

v1.0 ratified 2026-08-24; v1.1 corrected the corpus count; v1.2 applied G4/G6/G7; v1.3 applied
S1/S2/S3/S5 (probe-denominated stop rule, gold-proposer separation, OpenAI embeddings Layer,
G-entailment split); v1.4 applied R1–R3 (PR #802 review: report/telemetry split, full-W1 gate
per stage, G-projection before rebuild identity). Hard gates are Tier-L only. Hosted models are in scope for M1. Offline
means the loop replays from a content-addressed cache with the network off. Changes to this
file are dated DECISIONS entries.

## Corpus

- **Primary (W1):** 25 born-digital papers from the academia-2026-07 corpus
  (`~/YeeBois/research/academia-2026-07/pdf/`; out-of-repo; referenced by content hash + path,
  never committed). Corpus reality, verified on disk: the 443-paper figure is the metadata
  census (`meta/`); only **76 PDFs** are downloaded. Selection is deterministic over what
  exists: the first 25 of the 76 on-disk PDFs by corpus id sort, recorded in a committed
  **corpus manifest** (id + sha256 + byte length per paper). The manifest defines W1, not the
  directory. The lab commits only the manifest, spans, and our own labels.
- **Fixtures (F1):** ~10 small synthetic documents committed in the lab (MD, HTML, born-digital
  PDF, one malformed specimen per format) for deterministic unit and property tests.
- Formats in scope: born-digital academic PDF, HTML, Markdown. OCR, DOCX, email, archives are
  out of scope for the sheets; gaps are recorded, not chased.
- Oppold corpus: local-only secondary proving ground (D14); never cited in committed artifacts.

## Gold labels (small by design; grow only when a decision hinges on it)

- **Gold provenance (S2):** gold sets are LLM-proposed and Benjamin-spot-checked. The proposer's
  provider family MUST differ from the extraction run's provider family, enforced as a schema
  refinement on `EvalRun` (`gold.proposer.provider !== extractor.provider`); the spot-checked
  fraction is committed as a number in `gold/v1`.
- **G-structure:** 10 W1 papers — section structure (title, abstract, section tree, references)
  with character spans.
- **G-entity:** 5 W1 papers — persons, orgs, works, methods with spans.
- **G-relation:** 3 W1 papers — typed relations among G-entity entities.
- **G-projection (gates C1, R3):** over F1 + one G-relation W1 paper, committed expected
  projections for the frozen embedding model and dimension: at least one known kNN neighbour pair
  (chunk ids + rank) and SPARQL result sets with expected non-empty bindings and counts. C1 checks
  these BEFORE rebuild identity; an empty or mismatched projection fails C1.
- **G-entailment/rdfs (gates C2, S5):** a fixed suite over F1 + the seeded ontology: ρdf closure
  cases (rdfs2, 3, 5, 7, 9, 11) and SKOS hierarchy cases via one explicit broader-transitivity
  rule, each with expected derivations AND expected proofs (checkable derivation, not just
  conclusion), gold proofs produced by EYE.
- **G-entailment/rules (gates the reasoning spike, not C2):** ~20 Datalog/production-rule cases
  with expected derivations and proofs; the fixture against which the v3 Rete salvage and the
  NET-NEW kernel are ablated against EYE.
- Labels are ours (committable), versioned as `gold/v1`; every eval report cites the gold
  version and corpus hash.

## Machine targets

- **Primary: the reference development machine** (verified: Threadripper 9970X, 128GB ECC RAM,
  2× R9700 = 64GB VRAM).
  There is no laptop gate machine.
- Lab CI: Linux x64 (Labs lane; no Cargo — Rust checks stay local per A5).
- Packaging matrix (macOS/Windows, arm64) deferred to a later milestone. **Mobile: no-go.**

## Budgets (G4 two-tier; accounting is bundle-level per B5)

Tier-L is the lab's hard bar on the primary machine. Tier-D is the distribution watchpoint:
laptop-class numbers every EvalReport records as telemetry so a future graduation to
professional-desktop knows the portability bill. Tier-D numbers never park a candidate.

| Metric | Tier-L (hard bar) | Tier-D (telemetry only) |
| --- | --- | --- |
| Sidecar cold start to ready | < 5 s | recorded |
| Eval/interactive query p95 | < 100 ms | recorded |
| W1 end-to-end wall clock | alarm at 10 min (not a park) | recorded |
| Disk growth per W1 run (excl. models) | alarm at 1 GB (not a park) | recorded |
| Peak bundle RSS | alarm at 16 GB (not a park) | < 2 GB watchpoint |
| Model/artifact bytes | measured | < 600 MB watchpoint |
| Lab dependency footprint | measured | < 250 MB watchpoint |

## Models (G6)

LLM extraction runs hosted through the existing `LanguageModel` driver Layers. Embeddings run
hosted through an `effect/unstable/ai` `EmbeddingModel` Layer: `@effect/ai-openai`'s shipped
`OpenAiEmbeddingModel.layer`, composed through a new `@beep/openai` driver that mirrors
`@beep/anthropic` (S3-rev). Local-model machinery (ONNX runtimes, GPU
lanes, model downloads) stays a parked candidate, not an M1 workstream.
Every hosted result records full provider/model identity (provider, model, version, and
response hash) in the schema.

## The falsifiable loop (M1 acceptance; window-optional per A5; staged C0-C2 per G1; probe-bounded per S1)

Headless, in the Bun sidecar process: ingest → parse → split → normalize → extract → KG build →
RDFS-closure reasoning → eval over W1 + F1, emitting a schema-validated eval report (corpus
hash, gold version, per-call `ModelIdentity`, per-metric results) plus a per-run `EvalRunTelemetry`
sidecar (Tier-L measurements, Tier-D telemetry) that is never part of the report digest (R1).

**Offline (G7):** after the first hosted fetch, every provider result is cached
content-addressed with its model identity. A second run with the network disabled must
reproduce the `EvalReport` digest (`reportDigest`); the telemetry sidecar is expected to differ (R1). API-unavailable is a typed degraded state, never a silent
fallback. Fully-offline live inference is not an M1 criterion.

**Determinism:** content-addressed ids, pinned model identities, stable ordering. Re-running W1
reproduces the report stably; the IR pipeline's SHA-256 discipline is the model.

**Falsifier (S1, probe-denominated; no calendar):** each family enters a canary stage with its
first-probe candidate. If the stage fails on that family, the family gets exactly one more
candidate from its sheet's slate. If that fails too, the family parks and the packet drops back
to decompose rather than relaxing this contract silently. Passing means the rubric's hard gates
plus the two Tier-L gates (cold start <5s, p95 <100ms) plus a quality floor (beat the
G-structure/G-entity baselines set by the first passing run). Wall-clock per stage and per run
is recorded as Tier-D telemetry and never gates. Every stage pass additionally requires the full W1
manifest (25 papers) + F1 to run end-to-end live and replay with equal report digests and zero
typed-degraded document failures (R2); gold-scored criteria on the gold subsets never substitute
for the full run.
