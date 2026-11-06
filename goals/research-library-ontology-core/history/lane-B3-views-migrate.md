# Lane B3: SPARQL views and catalog migration

Implemented on `feat/research-library-ontology-core`, starting at `8918288579`.
Nothing was staged, committed, pushed or published. The real library was used
only for read-only dry-run, status, verification and hash checks. It was never
rendered or migrated with writes enabled.

## Changes

- `Library.views.ts` defines documented SELECT queries, `S.Class` row decoders,
  `runView`, schema-encoded formatting payloads and the invocation-local dataset.
  Queries select the projected Report, Source, Qualification, Occurrence, Capture
  and Artifact nodes, use their schema predicates for joins, and order by
  `catalogIndex`. Effective required-version assessments also cover v1 sources
  with no explicit versions array. Their categories are assessed once per source
  through `libraryEffectiveCaptures` and supplied to `catalogDataset`.
- `Library.render.ts` obtains report/source/qualification lists, occurrences,
  backlinks, related repositories, capture history, current-readable ordering and
  artifacts through the queries. Formatting preserves Markdown escaping, HTML,
  append order and the separate historical/effective status semantics.
  `libraryIndexMarkdown` uses the same formatter in memory for migration.
- `Library.status.ts` counts query rows and grouped query results. Both commands
  accept `--include-private`. Default visibility excludes private documents,
  sources and artifacts; occurrences inherit privacy from either endpoint and
  findings from their source. Source aliases participate in privacy, and a
  private marker wins over a conflicting public marker. Status always prints
  the four-field private-partition line.
- `ResearchLibraryLive` supplies `OxigraphSparqlQueryServiceLive`. The service
  exposes `migrate`, and the CLI registers `library migrate --dry-run`.
- `Library.migrate.ts` validates the generated SHACL shapes before comparing the
  memory-rendered and stored index hashes. A successful write preserves the exact
  old bytes in history, uses the existing locked atomic catalog save, and writes
  the schema-encoded `LibraryMigrationReceipt`. The store has a bounded switch
  disabling its older identity/object reconciliation for this contract migration.
  A repeated v2 migration bypasses writes, including a concurrent v2 observation
  inside the writer transaction. Migration never rewrites the index.
- `Library.schemas.ts` adds the receipt with the validator contract, schema tags,
  catalog/index hashes, sorted unique intake dates, violation count and timestamp.
  The Library facade names that model explicitly.
- `Library.verify.ts` runs SHACL even when its integrity assessment accumulated
  failures. It still fails when either gate fails. Its module documentation now
  precedes imports so docgen recognizes the existing file-level tags.
- `Library.projection.ts` includes the canonical locator in SourceVersion node
  identity. The real catalog has 14 cases where one source/revision has distinct
  canonical locators. Collapsing them onto one node violated maxCount 1 for
  canonicalUrl. Evidence lookup remains keyed by source/revision. This changes
  only the disposable projection, not catalog data or SHACL constraints.
- `Library.evidence.ts` compares Git patches in a scoped OS temporary directory.
  Previously, read-only verification attempted to create temporary files inside
  the library's `.staging` directory. The sandbox correctly denied those writes,
  producing 36 extra evidence failures. The comparison still checks the same
  full hash, byte count and 100 MB limit. No integrity requirement was weakened.
- The inventory test uses the Fetch HTTP client layer for its captured service
  dependency. This avoids a shared-suite Undici mock whose dispatcher had no
  destroy method; these tests perform no HTTP acquisition.
- The runbook covers root resolution, ontology rendering, SHACL, SPARQL privacy,
  dry-run migration, the hash gate, receipts, backups and reversal.

## Golden capture provenance

Before editing either legacy render or status, created
`test/research-library-replay.test.ts` with two v1 fixture catalogs dated
2026-10-06 and 2026-10-14. Each has three reports and different source kinds,
Markdown-special titles/identities, occurrences, several capture statuses, a
reviewed-disposition artifact, verified/failed qualifications and an intake.
The reviewed-disposition artifact deliberately does not establish a valid reading
claim; the legacy effective category remains missing. Existing evidence tests
also exercise valid reviewed and readable claims.

The initial test temporarily wrote fixture files by invoking the unchanged
legacy `renderLibrary` and `libraryStatus` on real scoped temporary directories.
It captured all index Markdown, status console lines, and a path-to-SHA-256
manifest covering index.html, every REPORT.md/SOURCE.md, report/source HTML and
all artifact HTML. Removed the generation statements, then ran the frozen
assertions against legacy code: 1 file, 2 tests passed. Only after that pass were
render/status replaced. The manifest JSON files were subsequently formatted;
their recorded path/hash values were not regenerated.

Fixtures are retained under
`packages/tooling/tool/cli/test/fixtures/research-library-replay/` as
`index-<date>.md`, `status-<date>.txt` and `files-<date>.json`.

The new renderer matches every recorded file hash and index byte. Status matches
all legacy console bytes followed by the newly required always-present private
partition line. Keeping the frozen legacy status files unchanged makes that
single intentional output addition explicit in the assertion.

## Replay and regression coverage

- Both fixture dates reproduce the complete legacy file manifest and index.
- Both migrate after a dry run, preserve exact backup/index bytes, decode as v2,
  bind receipt hashes to actual bytes, and repeat as a no-op without new receipts.
- A tampered index reports both hashes and leaves catalog/history/receipts untouched.
- A SHACL-invalid reference fails before creating backup or receipt state.
- Distinct canonical locators at the same revision remain SHACL-conformant.
- Private document/source pages are absent from default output, private document
  occurrences disappear from source backlinks, private artifacts have no generated
  evidence links, status totals exclude the partition, and include-private renders
  the complete index.
- A legacy capture round-trips byte-for-byte through encodeLibraryCaptureJson,
  while private artifact keys survive schema encoding.

## Verification

| Command | Result |
| --- | --- |
| `bun run beep quality package-verify @beep/repo-cli` | FAIL: audit has six out-of-scope packet-state failures; docgen PASS (49.9 s) |
| `bun run beep quality package-verify @beep/repo-cli --quick` | PASS: lint and check; final check includes the new store no-op guard |
| `(cd packages/tooling/tool/cli && bunx vitest run test/research-library test/research-command.test.ts)` | PASS: 8 files, 169 tests |
| `bun run beep lint effect-vitest` | PASS: 496 baseline findings, introduced=0, resolved=0; no baseline refresh |
| Requested whole-Research path scan | FAIL: inherited matches in sibling Research files outside the allowed Library directory |
| Same scan of `docs/runbooks/research-library.md` and `src/commands/Research/Library` | PASS: no matches |
| `git diff --check` | PASS |

The final full audit ran 8,769 tests: 8,753 passed, 10 skipped, six failed in five
files. All remaining failures are caused by concurrent packet edits outside B3:

- goals-completion-observation, goals-graph and goals-manifest-capabilities reject
  this packet's live P0 phase-status value `completed`; the schema requires `complete`.
- knowledge-doctor-evaluators and knowledge-doctor-grouping compare live packet
  findings against HEAD and see the concurrent manifest/research-report drift.

The preceding full audit also exposed the HTTP teardown failure and misplaced
verify module comment. Both were fixed; neither remains in the final full run.
The scoped lint/check and all library tests are green. The full audit is still
red and is not waived by those focused results.

The exact requested scan covers sibling Research.command.ts, Research.render.ts,
Research.schemas.ts, Research.service.ts and internal ResearchEnv/Timers/Vault
files. They already contain matching path examples or existing defaults. B3's
explicit constraint permits changes only within Library, tests and the runbook,
plus this report. Those siblings and the concurrent packet changes were preserved.

## Real-library read-only evidence

Used the explicit library flag supplied by the orchestrator; no operator path is
recorded in this report. The final migration dry run returned success and:

```text
shacl: conforms=true violations=0
beforeCatalogSha256=e88cf95833389975bedc1143c9b8e20bd1fd3775ead6589cd931baa9b1054f52
afterCatalogSha256=5cda99e54c7c4da20a6f7b04382c2f6f4fedff26d866a8d719396f14c1e2ac47
indexMdSha256=1048b6e6a06cf5adab6743511f2430428adf9321e8b6f29e53253c688e57d47c
diskIndexSha256=1048b6e6a06cf5adab6743511f2430428adf9321e8b6f29e53253c688e57d47c
```

The catalog and index hashes were independently re-read from disk and remain the
before-catalog and supplied index hashes above. There was no index mismatch to
diagnose and no document content was copied into the repository.

Status counts:

```text
reports=144 sources=1203 occurrences=5418
source claims: readable=1005 unavailable=7 ambiguous=2 incomplete=32 tool-blocked=16 internal=56 operational=12 non-reference=68 missing=5
source/version claims: readable=1018 unavailable=7 ambiguous=2 incomplete=32 tool-blocked=16 internal=56 operational=12 non-reference=68 missing=5
attempts: running=0 interrupted=1 readable=1029 blocked=368 failed=28 unsupported=8 unavailable=75 non-reference=68
route probes: verified=10 failed=4
private partition: documents=0 sources=0 artifacts=0 occurrences=0
```

Read-only verify still exits nonzero with exactly the inherited ten integrity
gaps: five source-evidence/provenance gaps and five missing current claims.
It now also prints `shacl: conforms=true violations=0`. No data was repaired and
no gate was relaxed.

## Handoff

B3 implementation and focused proof are complete. Full acceptance remains blocked
by the packet owner's concurrent state edits and the requested broad scan's
out-of-scope inherited matches. The orchestrator should correct its packet state
through the canonical goal commands, reconcile the research-report projection,
and decide the separate sibling Research path-cleanup scope, then rerun the full
package command and broad scan. No commit or publication is authorized by this
lane assignment.
