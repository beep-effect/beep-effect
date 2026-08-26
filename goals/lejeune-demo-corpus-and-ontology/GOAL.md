# GOAL: LeJeune Demo Corpus and Ontology

Repo root: the current working directory. All paths are repo-relative.

Outcome: build the deterministic machine-local public-and-synthetic bundle that supplies the
LeJeune lunch story with exact source spans, the frozen fastener ontology, three cited rule
checks, recorded provider output, and reproducible local projections.

Read these as the contract:

- `goals/lejeune-demo-corpus-and-ontology/{README,SPEC,PLAN}.md`
- `goals/lejeune-demo-corpus-and-ontology/ops/manifest.json`
- `goals/lejeune-demo-corpus-and-ontology/research/SOURCES.md`
- `explorations/lejeune-bolt-agentic-demo/{BRIEF,MAP,DECISIONS}.md`

Then read `AGENTS.md`, `CLAUDE.md`, the lab-app doctrine, and the
schema-first-development and effect-first-development skills before touching schemas or
services.

Scope:

- In: lab-local fixture, ontology, extraction, rule, replay, and projection modules in the
  proposed `lejeune-bolt-workbench` lab (under `apps/labs/`); machine-local bundle operations;
  this packet's evidence.
- Out: a second package, shared/foundation promotion, real Office data, arbitrary OCR, supplier
  integrations, copied standards or third-party corpus payloads, and any external write.

Execution:

1. P0 freezes two RFQ layouts, the 12 classes, the three cited rules, source hashes, expected
   spans, missing fields, and synthetic dated offers and certificates. Prove one live
   `@beep/anthropic` extraction on day 1; try `openai-compat`, `venice-ai`, or `xai` that day if
   it fails.
2. P1 builds parse → exact-span extraction through `@beep/langextract` → normalized records →
   deterministic PGlite, DuckDB, and bounded in-memory Oxigraph projections, following the
   practice-KG pattern.
3. P2 runs all rule and citation fixtures, records successful provider output into the bundle,
   and proves the golden run replay with provider and network unavailable.
4. P3 records proof, uses `/reflect`, drives the implementation PR to merge-ready through
   `/yeet`, and flips packet state only when the completion gate is met.

Non-negotiable:

- RFQ A is an Outlook body table plus XLSX takeoff; RFQ B is prose email plus PDF schedule.
  Facts are split across each pair and each leaves at least one field missing.
- The ontology is exactly `ProductVariant`, `Component`, `Standard`, `Finish`, `Tool`,
  `SupplierOffer`, `Project`, `RFQ`, `QuoteLine`, `LotCertificate`, `Approval`, and
  `ExpertClaim`.
- The rules cover matched assemblies, DTI strength matching, and refusal of A490 hot-dip
  galvanizing. Every result opens its governing source and revision.
- Offers and certificates are timestamped and visibly labeled `SYNTHETIC`.
- Raw corpus payloads and secrets never enter the repo. The mutable corpus is deleted or
  explicitly promoted on 2026-09-30.

Acceptance: every `SPEC.md` criterion and manifest verification command passes with no unrelated
churn. Stop on a data-boundary breach, a missing cited rule source, nondeterministic replay, a
second-package proposal, or any scope requiring new authority.
