# Instance

- id: `research-capture-outcome`
- exact source SHA: `7440cb8c4302ce64b87860069a464bafbf65f576`
- corpus source SHA: `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`
- file:line: `packages/tooling/tool/cli/src/commands/Research/Research.schemas.ts:642`
- symbol: `ResearchCaptureSummary`
- members: `skipped`, `cardPath`, `id`, `title`
- evidence: E1/E3 at `packages/tooling/tool/cli/src/commands/Research/internal/Capture.ts:103-105,115-159` — already-seen returns true with three empty sentinels; capture returns false with all three nonempty payloads.

# Current shape

The internal summary combines a skip flag with three sentinel strings, admitting mixed-empty states that the capture workflow never emits. `documentTitle` trims and filters empty metadata at lines 56-64, then falls back to normalized URL at line 115, so a captured title is nonempty. The service returns the value to tests; the CLI command logs inside capture and discards the summary with `Effect.asVoid`.

# Cardinality gap

One boolean and three string-emptiness axes represent 16 tuples. Two are legal: skipped with every sentinel empty, and captured with card path, ID, and title all nonempty.

# Target schema

Define a private `ResearchCaptureDisposition` LiteralKit with `skipped` and `captured`. The skipped case has no payload. The captured case owns `cardPath`, `id`, and `title` as nonempty strings. Keep `ResearchCaptureSummary` as the service result name. Reuse existing path/frontmatter/hash/title helpers and add no generic outcome abstraction.

# Migration inventory

- `Research.schemas.ts:620-648` — replace the boolean/string cluster with the two cases and update JSDoc.
- `Research/internal/Capture.ts:49-64` — preserve markdown/title filtering and trimmed-title semantics.
- `Research/internal/Capture.ts:85-159` — construct skipped before scraping or captured only after exact card/database/log writes; preserve normalized URL fallback, ID formula, slug/path, body/frontmatter bytes, database values, messages, and operation order.
- `Research.service.ts:87,170,265` — retain the same typed service result, with no new persistence or rendering layer.
- `Research.command.ts:76` — retain `Effect.asVoid`; the command does not expose summary fields.
- `test/research-command.test.ts:57-145` — match captured/skipped cases while retaining file, database, title, normalization, and duplicate behavior.

# Guard-deletion accounting

Delete `skipped`, the three empty-string constructor writes, the false write, and tests/guards coordinating sentinel emptiness. The early already-seen branch remains and selects the skip case. Keep title/markdown nonempty filters, URL normalization, duplicate query, and write error guards because they establish payload validity and side-effect safety.

# Encoded-side impact

None. This Tier 1 result is neither serialized nor printed as JSON; the CLI discards it after the existing logs. Knowledge-card Markdown, frontmatter, DuckDB rows, capture log, IDs, paths, messages, and write ordering remain byte-for-value unchanged.

# Test impact

Add schema-derived coverage for both cases. Retain duplicate skip/no-rescrape, whitespace-only title fallback to normalized URL, missing markdown error, exact card contents, stable ID/path, database rows, tags, and repeated-capture behavior.

# Risk and sequencing

Land with the serial Tier 1 internal batch. Preserve side-effect order: card write precedes database/log recording, and duplicate detection precedes scrape. The title nonempty guarantee depends on the existing trim/filter/fallback chain.
