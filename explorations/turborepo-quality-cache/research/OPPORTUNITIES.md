# Friction Receipts

## 2026-09-04 — the research retriever rejected Turborepo's AI markdown route

- **Work:** refresh the official AI guide from its documented `.md` endpoint
  while assembling the pinned source corpus.
- **Evidence:** the browser-oriented retriever rejected the response as an
  unsupported `text/markdown` content type; a direct body-discard-safe HTTP
  fetch of the same official `.md` route succeeded.
- **Impact:** the authoritative AI-optimized surface required a second retrieval
  path and manual provenance reconciliation.
- **Prevention:** teach the research retriever to accept `text/markdown`, or
  route known documentation `.md` URLs through a markdown-aware fetcher by
  default.

## 2026-09-08 - markdown retrieval failure repeated during shaping

- **Work:** check the official AI guide, OpenAPI page, and artifact-signature
  documentation before writing the continuation prompt.
- **Evidence:** all three official routes returned `Unsupported content-type:
  text/markdown` through the browser-oriented retriever.
- **Impact:** the same documented retrieval problem required the direct public
  HTTP fallback again.
- **Prevention:** route these documented Markdown responses to a compatible
  fetcher and reuse the earlier receipt when choosing the retrieval path.

## 2026-09-08 - a single-skill check also checks repository-wide projections

- **Work:** verify the upstream Turborepo reference correction with
  `bun run beep skills update --skill turborepo --check`.
- **Evidence:** the command reported `drift (2)` for `skills-lock.json` and
  `.codex/config.toml`, with no remote Turborepo skill drift.
- **Impact:** the selected skill can match upstream while the command fails
  for the broader installed-skill inventory. The failure needs attribution
  before changing unrelated configuration.
- **Prevention:** report which skill entries differ in the lock and distinguish
  selected-skill parity from repository-wide projection parity.
- **Attribution:** 13 other skill hashes and 11 absent lock entries predate this
  change; the Codex skill list is missing `impeccable`. Turborepo's 26 files and
  its updated lock entry pass exact upstream parity. Broader repair is separate.

## 2026-09-08 - packet assembly runtime and patch context

- **Work:** generate four goal packets with rebased source links and update
  exploration lifecycle prose.
- **Evidence:** the orchestration runtime reported `URL is not defined`; a
  later patch rejected a partial-line context match. Neither failed operation
  wrote files.
- **Impact:** assembly needed a portable path resolver and full-file patches
  generated from observed content before validation could run.
- **Prevention:** use the documented orchestration globals and exact observed
  patch context; retain assembled content before applying the packet batch.
