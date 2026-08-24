# Workload Contract — v1.2

v1.0 ratified 2026-08-24; v1.1 corrected the corpus count; v1.2 applied G4/G6/G7. Hard gates
are Tier-L only. Hosted models are in scope for M1. Offline means the loop replays from a
content-addressed cache with the network off. Changes to this file are dated DECISIONS entries.

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

- **G-structure:** 10 W1 papers — section structure (title, abstract, section tree, references)
  with character spans, LLM-proposed and Benjamin-spot-checked.
- **G-entity:** 5 W1 papers — persons, orgs, works, methods with spans.
- **G-relation:** 3 W1 papers — typed relations among G-entity entities.
- **G-entailment:** a fixed suite over F1 + the seeded ontology: RDFS closure cases, SKOS
  hierarchy queries, and ~20 Datalog/production-rule cases with expected derivations AND
  expected proofs (checkable derivation, not just conclusion).
- Labels are ours (committable), versioned as `gold/v1`; every eval report cites the gold
  version and corpus hash.

## Machine targets

- **Primary: DankStation** (verified: Threadripper 9970X, 128GB ECC RAM, 2× R9700 = 64GB VRAM).
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
| W1 end-to-end wall clock | < 10 min | recorded |
| Disk growth per W1 run (excl. models) | < 1 GB | recorded |
| Peak bundle RSS | alarm at 16 GB (not a park) | < 2 GB watchpoint |
| Model/artifact bytes | measured | < 600 MB watchpoint |
| Lab dependency footprint | measured | < 250 MB watchpoint |

## Models (G6)

Embeddings and LLM extraction run hosted via the agents slice for M1. Local-model machinery
(ONNX runtimes, GPU lanes, model downloads) stays a parked candidate, not an M1 workstream.
Every hosted result records full provider/model identity (provider, model, version, and
response hash) in the schema.

## The falsifiable loop (M1 acceptance; window-optional per A5; staged C0-C2 per G1)

Headless, in the Bun sidecar process: ingest → parse → split → normalize → extract → KG build →
RDFS-closure reasoning → eval over W1 + F1, emitting a schema-validated eval report (corpus
hash, gold version, per-metric results, Tier-L results, Tier-D telemetry).

**Offline (G7):** after the first hosted fetch, every provider result is cached
content-addressed with its model identity. A second run with the network disabled must
reproduce the EvalReport bytes. API-unavailable is a typed degraded state, never a silent
fallback. Fully-offline live inference is not an M1 criterion.

**Determinism:** content-addressed ids, pinned model identities, stable ordering. Re-running W1
reproduces the report stably; the IR pipeline's SHA-256 discipline is the model.

**Falsifier:** if a candidate bundle cannot pass the hard gates plus the Tier-L bar plus a
quality floor (beat the G-structure/G-entity baselines set by the first passing run) inside a
two-week build appetite, the bundle or the shape is wrong. Drop back to decompose rather than
relaxing this contract silently.
