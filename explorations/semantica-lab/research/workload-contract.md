# Workload Contract — v1.2 (G4/G6/G7 amendments 2026-08-24; corpus correction v1.1; v1.0
RATIFIED 2026-08-24) (A8)

**v1.2 amendments (DECISIONS G4/G6/G7):** the Budgets table below is re-anchored to the
**two-tier model** — Tier-L (lab hard bar, on the verified 128GB/64GB-VRAM dev machine): cold
start <5s and eval/interactive p95 <100ms are the only hard resource gates; RSS/deps/model
bytes are measured-and-recorded with a 16GB bundle-RSS alarm. Tier-D (distribution watchpoint):
the original laptop-class ceilings are telemetry every EvalReport records, not gates. Models
are **hosted-first** via the agents slice (G6); the offline criterion is rescoped to
**replay-offline, hosted-live** (G7): API results cached content-addressed with full
provider/model identity, the loop re-runs byte-stably from cache with network disabled, typed
degraded states cover API-unavailable. The "network disabled" language in the loop section
below reads through this scoping.

The named workload every bake-off scores against and the falsifiable loop that defines "proven."
Budgets are initial and revisable only by dated DECISIONS entries.

## Corpus

- **Primary (W1):** 25 born-digital papers from the academia-2026-07 corpus
  (`~/YeeBois/research/academia-2026-07/pdf/`; out-of-repo; referenced by content hash + path,
  never committed). **Corpus reality (corrected 2026-08-24, verified on disk):** the 443-paper
  figure is the metadata census (`meta/`, 443 records); only **76 PDFs** are downloaded.
  Selection is deterministic over what exists: the first 25 of the 76 on-disk PDFs by corpus id
  sort, recorded in a committed **corpus manifest** (id + sha256 + byte length per selected
  paper) — the manifest is the W1 definition, not the directory. PDFs stay external; the lab
  commits only the manifest, spans, and our own labels.
- **Fixtures (F1):** ~10 small synthetic documents committed in the lab (MD, HTML, born-digital
  PDF, one malformed specimen per format) for deterministic unit/property tests.
- Formats in scope: born-digital academic PDF, HTML, Markdown. OCR, DOCX, email, archives:
  OUT of scope for the bake-offs (input sheet §3 is bounded here; gaps recorded, not chased).
- Oppold corpus: local-only secondary proving ground (D14); never cited in committed artifacts.

## Gold labels (small by design; grow only when a decision hinges on it)

- **G-structure:** 10 W1 papers — section structure (title, abstract, section tree, references)
  with character spans, LLM-proposed + Benjamin-spot-checked.
- **G-entity:** 5 W1 papers — persons, orgs, works, methods with spans.
- **G-relation:** 3 W1 papers — typed relations among G-entity entities.
- **G-entailment:** a fixed suite over F1 + the seeded ontology: RDFS closure cases, SKOS
  hierarchy queries, and ~20 Datalog/production-rule cases with expected derivations AND
  expected proofs (checkable derivation, not just conclusion).
- Labels are ours (committable); versioned as `gold/v1`; every eval report cites the gold
  version and corpus hash.

## Machine targets

- **Primary:** DankStation (Linux x64). **Budget reference machine:** mid-tier 16GB-RAM laptop,
  CPU-only — budgets below are for it, measured on DankStation with headroom factor noted.
- Lab CI: Linux x64 (Labs lane; no Cargo — Rust checks stay local per A5).
- Packaging matrix (macOS/Windows, arm64) deferred to a later milestone; **mobile: no-go.**

## Budgets (gate 5 inputs)

| Budget | Ceiling |
| --- | --- |
| Sidecar cold start to ready | < 5 s |
| Peak sidecar RSS during W1 run | < 2 GB |
| Model/artifact download total | < 600 MB (hash-pinned, offline-reinstallable) |
| Lab dependency footprint | < 250 MB beyond the app shell |
| W1 end-to-end (ingest→KG→eval), CPU-only | < 10 min |
| Eval/interactive query p95 | < 100 ms |
| Disk growth per W1 run (excl. models) | < 1 GB |

## The falsifiable loop (M1 acceptance; window-optional per A5)

Headless, in the Bun sidecar process: ingest → parse → split → normalize → extract → KG build →
RDFS-closure reasoning → eval over W1 + F1, emitting a schema-validated eval report (corpus
hash, gold version, per-metric results, budgets observed). **Offline is a named criterion:**
after artifact acquisition, the loop runs with network disabled. LLM-method extraction is the
scored exception lane (network allowed, evaluated separately); without it the pipeline degrades
to a TYPED degraded state, never silently. **Determinism:** re-running W1 reproduces the report
stably (content-addressed ids, pinned models, stable ordering) — the IR pipeline's SHA-256
discipline is the model.

**Falsifier:** if a candidate bundle cannot pass gates + budgets + a quality floor (beat the
G-structure/G-entity baselines set by the first passing run) inside a two-week build appetite,
the bundle — or the shape — is wrong; drop back to decompose rather than relaxing this contract
silently.
