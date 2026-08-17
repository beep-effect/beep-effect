# Oppold Corpus Pipeline Plan

## Status

Status: `completed`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Salvage & Inventory | completed (2026-06-11) | Copy all five source locations into `raw/` (USB first), verify SHA-256, write the provenance manifest. | `raw/` complete; provenance manifest validates; spot-check digests match origin files. Evidence: [`history/outputs/2026-06-11-p0-salvage-report.md`](./history/outputs/2026-06-11-p0-salvage-report.md). |
| P1 Catalog & Exact Dedupe | completed (2026-06-11) | Stand up the DuckDB catalog; ingest the provenance manifest; link exact duplicates by digest; pair `$I`/`$R` recycle-bin files and emit the name-restoration manifest. | Duplicate-set report exists; restoration manifest covers the Oppold_IP_Law `$I` metadata files. Evidence: [`history/outputs/2026-06-11-p1-catalog-report.md`](./history/outputs/2026-06-11-p1-catalog-report.md). |
| P2 Extraction | completed (2026-06-11) | Harden `drivers/libpff` (pffexport subprocess engine) and `drivers/tika` (real invocation); add the `beep corpus` command family; run extraction over `raw/` into `staging/`. | Per-message artifacts with attachments + text/metadata manifests emitted; coverage summary recorded; drivers pass repo quality gates. Evidence: [`history/outputs/2026-06-11-p2-extraction-report.md`](./history/outputs/2026-06-11-p2-extraction-report.md). |
| P3 Organization | completed (2026-06-11) | Build the `organized/` client/matter/patent-family taxonomy from restored names + extracted metadata; group multi-version drafts. | `organized/` tree + catalog views exist; user sampling review recorded. Evidence: [`history/outputs/2026-06-11-p3-organize-report.md`](./history/outputs/2026-06-11-p3-organize-report.md). |
| P4 Enrichment | completed (2026-06-11) | New `drivers/uspto` (Open Data Portal); resolve patent/application numbers from the corpus; fetch official metadata + published PDFs; anchor version groups to patent families. | Enrichment manifest exists; family anchors present in catalog. Evidence: [`history/outputs/2026-06-11-p4-enrichment-report.md`](./history/outputs/2026-06-11-p4-enrichment-report.md). |
| P5 Close | completed (2026-06-11) | Update packet status + evidence, write the closeout reflection. | Reflection passes `bun run beep lint reflection-artifacts`; manifest/README statuses updated. Evidence: [`history/reflections/2026-06-11-claude.md`](./history/reflections/2026-06-11-claude.md). |

## Phase Notes

### P0 Salvage & Inventory

- Source order: ESD-USB `LH_Emails/` (26 PSTs, removable media — highest
  risk) → machine-local `Documents/$RE5ARTA/` → `Documents/LH_Emails/` →
  `Oppold_IP_Law/` → `Precision Planting Seed Firmer
  Adam CAD Package/` (catalog-only copy; the directory stays an active
  project workspace).
- Provenance manifest records per file: origin absolute path, size, mtime,
  sha256, salvage timestamp, source label.
- Copy then verify: hash origin, copy, hash copy, compare. On any USB read
  error, stop per SPEC stop conditions.
- `raw/` layout mirrors source labels, e.g. `raw/esd-usb-lh-emails/…`,
  `raw/documents-re5arta/…`, `raw/data-home-oppold-ip-law/…`.

### P1 Catalog & Exact Dedupe

- Known expected duplicate sets to confirm: `LH_Inbox_2011.pst` (Documents vs
  USB), `Sent_Emails.pst` (×3: $RE5ARTA, Oppold_IP_Law/source, and the
  $R0SFKGS.pst pair candidate).
- `$I` files are Windows Recycle-Bin metadata (original full path, size,
  deletion time); `$R` files are content. Parse `$I`, join on suffix token,
  emit restoration manifest (recovered name/path per `$R` artifact). Do not
  rename files in `raw/`; restoration applies at `organized/` time.
- Test fixtures for the `$I` parser are synthetic (fabricated `$I` bytes),
  never real corpus files.

### P2 Extraction

- libpff: wrap the `pffexport` tool as a subprocess engine behind the
  existing `@beep/file-processing` engine contract; emit `ChildArtifactRecord`
  entries per message/attachment. Detect binary availability; stop per SPEC
  if absent.
- tika: invoke Tika (server or jar — decide at implementation from what is
  installable) for text + metadata on doc/docx/pdf/html/rtf; image formats
  remain metadata-only.
- CLI: `beep corpus salvage|catalog|extract|organize|enrich` following the
  Files command structure (`packages/tooling/tool/cli/src/commands/Files/`).

### P3 Organization

- Inputs: restoration manifest (P1), message/document metadata (P2).
- Taxonomy: `organized/<client>/<matter-or-family>/<artifact>`; unknowns land
  in `organized/_unsorted/` rather than guessing.
- Near-dup version grouping starts from same-restored-name + similar-size
  clusters; content similarity heuristics stay local.

### P4 Enrichment

- `drivers/uspto` wraps USPTO Open Data Portal endpoints; product-neutral
  (no legal product language); config via typed config contract, no direct
  env reads.
- Patent/application number candidates come from restored filenames and
  extracted text; only the identifiers are sent to USPTO.

## P5 Closeout Checklist

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`; frontmatter must validate
   against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json`
   phase statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative; update it only when the contract changes.
- Archive run outputs (coverage summaries, duplicate-set reports) under
  `history/outputs/`; corpus data itself stays outside the repo.

## Verification Commands

```sh
test "$(wc -m < goals/oppold-corpus-pipeline/GOAL.md)" -le 4000
jq . goals/oppold-corpus-pipeline/ops/manifest.json
rg -n "oppold-corpus-pipeline|GOAL.md|agentLaunchers|packetAnchorDocument" goals/oppold-corpus-pipeline
git diff --check -- goals/oppold-corpus-pipeline
bun run beep lint reflection-artifacts
```
