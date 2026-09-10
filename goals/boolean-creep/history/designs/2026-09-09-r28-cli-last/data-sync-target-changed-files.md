# Instance

- id: `data-sync-target-changed-files`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.schemas.ts:380`
- symbol: `SyncDataTargetResult`
- members: `changed`, `changedFiles`
- evidence: E3 at `SyncDataToTs.command.ts:282-288` — changed is computed from the same filtered file-result paths' nonemptiness.

# Current shape

The per-target result stores a changed flag beside the ordered changed-file paths. The result is encoded in optional `data-sync-report.json` and rendered in Markdown/console output. `canonicalPatch` is independent: canonical-only drift can produce a nonempty patch while generated output files remain unchanged.

# Cardinality gap

Boolean times file-list emptiness represents four tuples; two are legal: unchanged/empty and changed/nonempty.

# Target schema

Define `SyncDataTargetDisposition` with `unchanged` and `changed` via LiteralKit and make `SyncDataTargetResult` a tagged union. Only changed owns `changedFiles: S.NonEmptyArray(S.String)`. Keep every other field shared, including ordered `fileResults`, output paths, sources, and independent `canonicalPatch`. Use a transformation at the real report codec boundary to preserve the legacy `changed` and `changedFiles` JSON keys exactly.

# Migration inventory

- `SyncDataToTs.schemas.ts:349-393` — introduce the cases and legacy encoded projection; preserve the exported schema name and example.
- `SyncDataToTs.command.ts:264-296` — select disposition from filtered file results while preserving file concurrency one, result order, and paths.
- `SyncDataToTs.command.ts:317-366` — match disposition for exact unchanged/changed console messages.
- `SyncDataToTs.command.ts:369-429` — retain aggregate counts, Markdown status labels, changed-file order, and independent canonical-patch rows.
- `SyncDataToTs.command.ts:431-476` — emit exactly the old report JSON object and filenames when report-dir is present.
- `SyncDataToTs.command.ts:479-510` — match disposition for check-mode drift failure without changing target ordering.
- `test/sync-data-to-ts.test.ts:329-362` and report/command fixtures — migrate decoded assertions and retain schema/report round trips.

# Guard-deletion accounting

Delete decoded `changed`, its constructor derivation, renderer ternaries, aggregate filters, failure filter, and tests coordinating it with list length. Replace them with disposition matches. Keep the `fileResults` filter that calculates changed paths, canonical-patch emptiness checks, and mode checks because they represent independent work.

# Encoded-side impact

Tier 2 persisted compatibility is exact. Unchanged encodes `{ changed:false, changedFiles:[] }`; changed encodes `{ changed:true, changedFiles:[...] }` with order and strings unchanged. Preserve `data-sync-report/v1`, mode, target order, canonical paths/patches, record metadata, formatting, trailing newline behavior, and Markdown bytes.

# Test impact

Add encode/decode coverage for both legal projections and rejection of crossed tuples. Retain canonical-only patch/no-file-change coverage, preview/write/check modes, output-file ordering, report JSON/Markdown snapshots, source metadata, error messages, and check drift failure.

# Risk and sequencing

Land as a singleton Tier 2 migration after the serial Tier 1 batch. The main risk is coupling `canonicalPatch` to generated file changes or changing persisted report bytes; keep it shared and compare exact reports.
