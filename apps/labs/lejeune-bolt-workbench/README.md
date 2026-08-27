# LeJeune bolt workbench

This private lab builds the fixed LeJeune lunch-demo bundle. It does not send quotes,
approve substitutions, place orders, or claim current supplier inventory.

## Fixed story

The corpus contains two generated RFQ layouts and no customer files:

- RFQ A combines an Outlook-style body table with an attached XLSX takeoff.
- RFQ B combines a prose email with an attached PDF schedule.

Facts are split across each pair. RFQ A leaves the certificate requirement unknown.
RFQ B leaves domestic origin unknown. Normalization records both gaps as RFIs instead
of inventing values.

The ontology has exactly 12 top-level classes. The rule slice has exactly three rules:
matched assemblies, ASTM F959 DTI strength matching, and refusal of A490 hot-dip
galvanizing. Every non-pass result stops for an RFI or qualified human decision.

## Projections and replay

The build uses the repository's existing capabilities:

- `@beep/langextract` locates exact UTF-16 source spans.
- PGlite stores normalized quote and review rows.
- DuckDB stores the four-document corpus and runs the bounded text query.
- Oxigraph queries a 12-class in-memory RDF dataset.

The golden replay reads a sanitized successful provider recording. It makes no provider
or network request. Two clean rebuilds must return the same query results and bundle
identity.

## Commands

Run the commands in this section from the repository root.

```bash
bun run --cwd apps/labs/lejeune-bolt-workbench check
bun run --cwd apps/labs/lejeune-bolt-workbench test
bun run --cwd apps/labs/lejeune-bolt-workbench lint
```

The checked-in provider recording is frozen and write-once. By default, the smoke command
targets that file and refuses to run when it already exists; it never silently refreshes or
overwrites the lunch input. A first authorized freeze, when the file is intentionally absent,
uses Anthropic through secret injection:

```bash
op run --env-file=.env -- bun run --cwd apps/labs/lejeune-bolt-workbench provider:smoke
```

To propose a reviewed refresh, write a separate machine-local candidate. The command refuses
an existing candidate path as well. Review the candidate and its diff before deliberately
promoting it through an approved goal:

```bash
LEJEUNE_RECORDING_MODE=reviewed-refresh \
LEJEUNE_REVIEW_RECORDING_OUT=.beep/lejeune-provider-recording-review.json \
op run --env-file=.env -- bun run --cwd apps/labs/lejeune-bolt-workbench provider:smoke
```

Anthropic is the required first attempt. If that call fails, add
`LEJEUNE_PROVIDER=venice-ai` to the reviewed-refresh command for the authorized same-day
Venice fallback.

The sanitized recording contains only versioned source and extraction-contract revisions,
its success status, synthetic document id, provider, model, timestamp, response SHA-256, and
exactly three candidate label/text pairs. Before any recording is written or replayed, the app verifies the canonical candidate digest, exact
`project`/`delivery_date`/`finish` label set, and verbatim grounding in the synthetic
source. It retains no request envelope, authorization header, credential, usage record, or
real data.

Build into two named child directories under one new machine-local publication root. The
immutable and mutable roots must have the same parent and different names. The builder refuses
an existing publication root without changing its contents. It validates both children in one
adjacent staging container, then publishes the complete container with one directory rename.
After failure, it removes only the staging container it created.

```bash
LEJEUNE_BUNDLE_ROOT=.beep/lejeune-demo-publication/bundle \
LEJEUNE_MUTABLE_ROOT=.beep/lejeune-demo-publication/review \
bun run --cwd apps/labs/lejeune-bolt-workbench bundle:build
```

Generated XLSX and PDF files stay under the selected machine-local bundle root. The Git
repository stores their deterministic generators, source hashes, expected spans, and the
sanitized provider recording. It does not store raw public pages, customer payloads,
credentials, or copied standards.

Mutable review data must be deleted or promoted under a new approved goal by 2026-09-30,
unless an explicitly consented pilot grants and records a new retention term. On and after
that date, the builder fails at the retention boundary before publishing the publication root.

The demo operator owns the disposition. Delete the exact machine-local mutable root after
reviewing its configured path, or promote it through an approved goal. A consented extension
must be a schema-valid `lejeune-retention-authorization/v1` JSON record with an owner, decision
reference, authorization timestamp, and future disposition date. Supply that reviewed record
explicitly; the builder never infers or silently extends retention:

```bash
LEJEUNE_RETENTION_AUTHORIZATION=.beep/lejeune-retention-authorization.json \
LEJEUNE_BUNDLE_ROOT=.beep/lejeune-demo-publication-extended/bundle \
LEJEUNE_MUTABLE_ROOT=.beep/lejeune-demo-publication-extended/review \
bun run --cwd apps/labs/lejeune-bolt-workbench bundle:build
```

The mutable root contains `review-ledger.json` and `retention-metadata.json`. The retention
metadata records the decoded authority, when supplied, and the resulting disposition date. The
builder reads the metadata back through its schema before publication. The authority and date do
not participate in immutable bundle identity. A reviewed extension stops authorizing builds at
00:00 UTC on its disposition date.

The immutable receipt and the projection metadata sidecar carry their schema revision, bundle
version, and bundle identity so future rebuild tooling can reject incompatible persisted data.

## Development server

```bash
bun run --cwd apps/labs/lejeune-bolt-workbench dev
```

The app uses the required portless URL printed by the command. This workspace is a
private runtime app, not a public TypeScript package.

## License

MIT
