# Oppold Corpus Pipeline Spec

## Objective

Produce a single salvage-safe, deduplicated, name-restored, extracted,
organized, and USPTO-enriched corpus of the Oppold IP practice records at
the out-of-repo Oppold corpus home (machine-local), with a DuckDB catalog and
`@beep/file-processing` manifests as the machine-readable surface that
downstream packets (`agentic-professional-runtime` ingestion,
`ip-law-knowledge-graph`) consume.

## Non-Goals

- Epistemic ingestion (claims, evidence, provenance records) — owned by
  `goals/agentic-professional-runtime`.
- Knowledge-graph construction or ontology schema work — owned by
  `goals/ip-law-knowledge-graph`.
- Box upload or any cloud sync of corpus content (a later runtime phase).
- LLM-based analysis, summarization, or entity extraction over corpus content.
- Replacing systems of record (USPTO, Box, email); enrichment fetches public
  data only.
- Deleting or modifying any original source file (USB, machine-local `Documents`,
  `data-home` sources). Source retirement is a manual user decision after
  verified salvage.

## Source Hierarchy

1. User objective that created this packet (2026-06-11 grilling session).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. `standards/ARCHITECTURE.md` and `standards/architecture/*` (driver
   boundaries, non-slice families, config boundaries).
4. `goals/agentic-professional-runtime/SPEC.md` (data-outside-repo rule;
   systems-of-record posture).
5. This `SPEC.md`.
6. `PLAN.md`.
7. `GOAL.md`.
8. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The out-of-repo Oppold corpus home (new, machine-local, outside the repo):
  `raw/`, `staging/`, `organized/`, `catalog/` tiers.
- `packages/drivers/libpff` — harden from scaffold to real PST extraction
  (pffexport subprocess engine emitting per-message artifacts + attachments).
- `packages/drivers/tika` — harden from scaffold to real Tika invocation
  (text + metadata for doc/docx/pdf/html/rtf).
- `packages/drivers/uspto` — new driver wrapping the USPTO Open Data Portal
  (official patent/application metadata + published PDFs).
- `packages/tooling/tool/cli` — new `beep corpus` command family modeled on
  the existing Files command.
- `goals/oppold-corpus-pipeline/*` — packet evidence and status.

## Constraints

- `raw/` is immutable: byte-exact copies verified by SHA-256; nothing writes
  into `raw/` after salvage completes.
- No corpus content or PII enters this repository. Repo-side tests use
  synthetic fixtures only.
- Manifests use `@beep/file-processing` schemas (`ArtifactId`,
  `ContentDigest`, `ProcessRunManifest`, `SourceProcessingRecord`,
  `ChildArtifactRecord`); do not invent parallel manifest shapes.
- Extraction is local-only (libpff, Tika, DuckDB). No corpus content is sent
  to LLMs or cloud services within this packet.
- Enrichment sends USPTO public APIs patent/application identifiers only —
  never document content.
- Drivers stay product-neutral: no Oppold/legal product language in
  `drivers/*` per `standards/ARCHITECTURE.md`.
- The pipeline never deletes source files anywhere.
- Repo code changes pass the normal quality gates (`bun run beep yeet
  verify` or TURBO_FORCE-backed lint/check/test for touched packages).

## Acceptance Criteria

- [ ] `raw/` holds verified copies of all five source locations with a
      provenance manifest (origin path, size, mtime, sha256 per file).
- [ ] DuckDB catalog identifies every artifact by content digest; exact
      duplicates across sources are linked with a duplicate-set report.
- [ ] `$I`/`$R` recycle-bin pairs are matched and original names/paths are
      restored in a restoration manifest.
- [ ] PST archives expand into per-message artifacts with attachments via
      `drivers/libpff` real extraction (not synthetic export).
- [ ] doc/docx/pdf/html/rtf artifacts have extracted text + metadata via
      `drivers/tika`.
- [ ] `organized/` presents a client/matter/patent-family taxonomy derived
      from restored names, extracted metadata, and USPTO anchors.
- [ ] Multi-version patent drafts are grouped under their patent family with
      version ordering.
- [ ] `drivers/uspto` resolves patent/application numbers found in the corpus
      to official metadata + published PDFs.
- [ ] `bun run beep corpus --help` documents the command family.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/oppold-corpus-pipeline/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/oppold-corpus-pipeline/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/oppold-corpus-pipeline` | Passes |
| Salvage integrity | re-hash spot check of `raw/` against provenance manifest | 100% digest match |
| No data in repo | review `git status` for any oppold-corpus content | Clean |
| Repo quality gates | `bun run beep yeet verify` for touched packages | Green |
| Reflection gate | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- USB read errors or hash mismatches during salvage — stop and report before
  any retry that could stress failing media.
- `pffexport` or a Tika runtime is unavailable and installing it needs a
  decision not named here.
- The implementation would exceed named scope.
- Verification requires credentials, cost, destructive side effects, or
  policy approval not named in this spec.
- The same blocker repeats after reasonable investigation.

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
