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

```bash
bun run check
bun run test
bun run lint
```

Record the one live Anthropic smoke result through secret injection. The script writes
only candidate labels and source text, the model name, a timestamp, and a response hash.

```bash
op run --env-file=.env -- bun run --cwd apps/labs/lejeune-bolt-workbench provider:smoke
```

Anthropic is the required first attempt. If that provider call fails, use the authorized
same-day Venice fallback:

```bash
op run --env-file=.env -- env LEJEUNE_PROVIDER=venice-ai \
  bun run --cwd apps/labs/lejeune-bolt-workbench provider:smoke
```

Build into new machine-local directories. The command refuses to overwrite an existing
bundle root and keeps mutable review state in a separate directory.

```bash
LEJEUNE_BUNDLE_ROOT=.beep/lejeune-demo-bundle \
LEJEUNE_MUTABLE_ROOT=.beep/lejeune-demo-review \
bun run --cwd apps/labs/lejeune-bolt-workbench bundle:build
```

Generated XLSX and PDF files stay under the selected machine-local bundle root. The Git
repository stores their deterministic generators, source hashes, expected spans, and the
sanitized provider recording. It does not store raw public pages, customer payloads,
credentials, or copied standards.

Mutable review data must be deleted or promoted under a new approved goal by 2026-09-30.

## Development server

```bash
bun run dev
```

The app uses the required portless URL printed by the command. This workspace is a
private runtime app, not a public TypeScript package.

## License

MIT
