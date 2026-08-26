# Research friction receipts

## 2026-08-25: Firecrawl CLI shim had no configured runtime

- Work: enumerating and scraping the LeJeune Bolt public website with the
  preferred Firecrawl CLI path.
- Evidence: `firecrawl --version` stopped with `No version is set for shim:
  firecrawl`.
- Cause: the local Firecrawl shim did not have a configured executable version.
- Prevention: include a working Firecrawl runtime in the repository's agent
  preflight, or document the sitemap plus HTTP fallback as an expected lane.

## 2026-08-25: custom crawler user agent triggered site-wide 403 responses

- Work: bulk-fetching the LeJeune Bolt sitemap corpus for the site-mining lane.
- Evidence: the first parallel `curl` pass returned HTTP `403` for all 198 requested URLs. Earlier
  plain `curl` requests to the same pages returned HTTP `200`.
- Cause: the bulk pass identified itself as a research crawler in the `User-Agent` header. The
  site's request filtering rejected that profile.
- Prevention: use the honest `beep-explorations-site-miner` identity and preflight two
  representative pages. Stop the run on any `401`, `403`, or `429`. A browser or plain-request
  success is diagnostic evidence, not permission to change identities or continue around a
  refusal.

## 2026-08-25: zsh reserved parameter interrupted raw-index generation

- Work: generating Markdown ledgers for the page, PDF, and attachment corpus.
- Evidence: the first indexing loop stopped with `zsh: read-only variable: status`.
- Cause: `status` is a reserved read-only parameter in zsh.
- Prevention: use task-specific names such as `http_status` in portable shell loops.
