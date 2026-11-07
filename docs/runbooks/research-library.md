# Research reference library

`beep research library` preserves research inputs, citation occurrences, acquired
source evidence, and generated navigation outside the repository. Root resolution
uses `--library`, then `BEEP_RESEARCH_LIBRARY`, then
`XDG_DATA_HOME/beep/research-library`, then `HOME/.local/share/beep/research-library`.
The library root is independent of the knowledge-vault root used by other research
commands. Pass `--library <library-root>` to select a collection explicitly.

## Intake and acquisition

Freeze the desired input roots before drawing conclusions from the collection:

```sh
bun run beep research library inventory \
  --input /absolute/path/to/repo/research \
  --input /absolute/path/to/downloaded-reports
bun run beep research library qualify
bun run beep research library status
bun run beep research library acquire --concurrency 2
bun run beep research library verify
bun run beep research library render
```

Inventory preserves original bytes and records their full hashes, original
locations, intake time, and repository commits where available. Repeating it
reconciles derived citations against the same originals; changed inputs create
new document versions and intake snapshots. Earlier evidence remains available.
Do not edit snapshots or acquired artifacts to repair extraction: change the
extractor or import a new derivation with its own provenance.

Qualification performs actual source acquisition. An installed executable, a
configured MCP server, and a successful provider request are insufficient: the
target source, returned content, and completeness must also pass. Keep secret
values out of commands, logs, import manifests, and packet documents.

Web, docs, and registry sources have no acquisition route, because the repository
has no web scraper. `acquire` gives them an unsupported `disposition` receipt that
points to `import-result`, and `qualify` never probes a web route. To read one of
these sources, scrape it with a session tool and import the result (see
[Session-owned provider results](#session-owned-provider-results)), or record a
reviewed disposition. Captures and the qualification receipt from the removed
`firecrawl` route remain valid. `verify`, `status`, and `render` still check them
against their retained response, HTML, and Markdown.

Acquisition retains a start receipt before each attempt and records its terminal
result. Qualified routes can progress independently. Inspect failed receipts
before using `--retry-failed`; do not repeatedly retry an unavailable source or
mistake a provider outage for source unavailability. `--source <source-id>` selects
a source for a bounded retry. A valid reviewed disposition survives a blanket
`--retry-failed` run. An explicit source selection can force a reviewed network
route; X imports, web sources, and unresolved disposition routes remain explicit
imports.
Concurrency is bounded from 1 through 8. GitHub operations are sequential within
one repository and concurrent across repository groups; catalog writes share one
writer. `qualify --adapter <adapter> --source <source-id> --max-probes <1..3>`
selects bounded actual probes. `--source` and `--adapter` may be repeated.

A stable source ID hashes canonical identity independently of cited revision.
`versions` records cited revisions and their locators; each capture binds its
requested revision separately from the actual captured revision. Git tags and
branches resolve to retained commits. A new cited revision acquires separately;
the same identity and revision reuse strict-valid evidence. Alias IDs preserve
reviewed shorthand and historical identity corrections without rewriting citation
positions. Invalid prior readable claims are demoted with immutable before/after
correction receipts, including their hashes; retained history remains inspectable.

Repository acquisition never builds the checkout or runs its scripts. Hooks,
recursive submodules, and automatic LFS content retrieval remain disabled. A
repository pin does not satisfy a citation to a discussion, PR, release, or
specific file: each needs its corresponding evidence. Clones live under
`repos/github/<owner>/<repository>` with pinned commits and separate license,
file/tree, issue, PR, release, and discussion evidence. Large local commit/PR
patches use file output with a 100 MB limit; external diff and text conversion
remain disabled. Bounded pagination retains returned pages and an incomplete
receipt when exhausted limits prevent closure.

Paper landing pages and abstracts are incomplete evidence until the PDF or other
actual full text is retained. PDF signature and target status are checked even
for query URLs. Publisher landing pages are retained without following HTML
PDF locators, and direct requests do not follow redirects. Provide a vetted
direct PDF URL as a separate source to acquire its full text. An arXiv version
comes from the retained paper header or
from official metadata plus identical bytes from an explicitly versioned PDF;
never infer a version number.

## Session-owned provider results

Use `import-result <manifest-file>` for evidence obtained through a session tool,
including alphaXiv full text, Grok Build, and web scrapes. Artifact entries identify
local original files by path, byte count, media type, role, and full SHA-256. The
importer checks identity and hashes before admitting them. Keep interpretations
separate from raw source text. The maintained import schemas are in
`Library/Library.import.ts`; the acquisition tests provide validated envelopes.

A web, docs, registry, or endpoint scrape imports with method and provider
`firecrawl` and three originals: the scrape response as `raw-response`, the page
HTML as `raw-full-text`, and its Markdown as `extracted-full-text`. The response
must have the shape
`{"data": {"markdown", "rawHtml", "metadata": {"sourceURL", "statusCode"}}}`. The
capture becomes readable only when the status is 2xx, `sourceURL` matches the cited
URL, and both full-text files equal the response's `rawHtml` and `markdown`. A
`target-metadata` redirect proof can bind a resolved URL that differs from the
cited one.

Grok research must dispatch the literal `/deep-research` workflow and retain both
launch and completion evidence. An ordinary model answer is insufficient. Grok
Build's one-shot prompt can return after launching the workflow in the background;
use a persistent ACP session or interactive session until its four phases finish.
For X references, retain observed X Search calls and each requested post identity.

On Grok Build 1.0.49, the read-only sandbox can fail when inspecting inaccessible
container-runtime socket parents. An outer read-only bubblewrap namespace can
hide the complete Podman, containerd, and Docker runtime directories while leaving
Grok's own read-only sandbox enabled. This does not require changing host directory
permissions or weakening the socket-denial rules. The exploration packet records
the operational qualification and its limitations.

ACP transport announcements may contain configured MCP environment values. Export
only the relevant prompt, workflow, and tool events; exclude configuration and
credential-bearing transport messages. Some backend X completion events contain
invocation metadata without a returned post body. Those events prove execution,
but cannot be relabeled as raw post content. Preserve the limitation explicitly.

## Caption fallback

The native route uses yt-dlp metadata and creator/automatic captions, without
video files. It preserves caption language and origin, original VTT, and readable
timestamp text. Empty cues, unrelated metadata, or captions lacking target-bound
provenance cannot establish reading.

Use a caption API fallback only for completed native failures or missing readable
captions; do not duplicate running jobs. An isolated free installation of
`youtube-transcript-api` can live under `XDG_CACHE_HOME/beep/youtube-transcript-api`.
Record the actual Python, package, and request-runtime versions. Installation is
not qualification: a successful source-bound probe must preserve watch/player
metadata, caption-track identity and origin, raw timedtext XML, parsed API return,
and exact timestamp text. The maintained validator checks their target and hash
bindings, cue text, language, origin, starts, and durations. XML originals remain
labeled XML; converted text never becomes a claimed native VTT original.

Import each successful fallback through `import-result` with method/provider
`youtube-transcript-api`, its real video ID as captured revision, and hash-bound
artifacts. Qualification admission accepts that method for the YouTube route only
after strict source evidence validation. Existing valid native qualification can
remain in place. If caption acquisition fails, record the exact route failure and
check existing transcription tooling before installing or downloading audio.

## Reviewed resolution and accounting

A `reference-resolution` import resolves a reviewed GitHub shorthand using an
original GitHub API response and hash-bound citation context. Its fields include
sourceId, original locator, canonicalUrl, reason, reviewer, reviewedAt, evidence,
and context. The importer checks the original document/position and API-returned
identity; it preserves the original occurrence and legacy ID as aliases. Do not
hand-edit the catalog or guess a repository from an issue number. Reinventory
uses the maintained alias mapping.

A `disposition` import records sourceId, locator, review reason, reviewer/time,
and preserved evidence. Available categories are:

- `unavailable`: original evidence establishes source absence.
- `ambiguous`: the cited identity cannot yet be resolved.
- `incomplete`: retained evidence does not establish complete reading.
- `tool-blocked`: the acquisition route failed or cannot retrieve the source.
- `internal`: a reviewed internal reference.
- `operational`: a reviewed service endpoint, without an invented health claim.
- `non-reference`: a reviewed local code/protocol token mistaken for a citation;
  permitted only for the maintained unresolved/internal cases and bound contexts.

Current evidence follows validated catalog append order for each requested
revision. A later reviewed incomplete disposition supersedes an earlier readable
capture; a later valid acquisition can restore readability. Provider timestamps
do not determine this order. Invalid or wrong-revision reviews cannot override
valid evidence, and historical artifact integrity remains checked.

These categories remain distinct in status and coverage. Unavailable and valid
reviewed exclusions can account for a source; ambiguity, incomplete evidence,
and tool blocks remain evidence gaps. None becomes readable source text. Keep
original artifact roles such as raw provider events, provider-transcribed source,
and AI interpretation when importing a review. A `/mcp` URL that returns a
product landing page can have readable HTML evidence while retaining its
heuristic endpoint classification; record the observed difference and do not
claim service health.

## Subsequent intake and reuse demonstration

Intake identity includes the real UTC date, exact input census, and input-root
provenance. A subsequent distinct input snapshot can therefore create another
immutable manifest on the same day. There is no `--date` override. Raw document
paths are content hashes beneath `intakes/<date>/raw`; each intake manifest
retains its own file set. Identical intake identities deduplicate.

To demonstrate this without touching a real collection, create a disposable
cache library and two explicit input directories. Copy one small strictly valid
source capture plus its qualification dependency closure, checking every copied
hash and byte count. Inventory a baseline report, then a distinct second report
that cites the same identity/revision. Pass `--library` and every `--input`
explicitly; omitted inputs select the normal research/Downloads roots.

```sh
bun run beep research library inventory --library <cache-library> --input <baseline-input>
bun run beep research library inventory --library <cache-library> --input <baseline-input> --input <later-input>
bun run beep research library acquire --library <cache-library> --concurrency 2 --retry-failed
bun run beep research library acquire --library <cache-library> --concurrency 2 --retry-failed
bun run beep research library verify --library <cache-library>
bun run beep research library render --library <cache-library>
```

The 2026-10-06 disposable demonstration grew one document/occurrence/intake into
two documents/occurrences/distinct intake identities while retaining one stable
source and the exact capture ID across both acquisition runs. Strict verification
passed before and after; the earlier intake manifest and raw document hashes
remained identical. No provider request or live library write was needed.
Receipts are retained in the owning lane's ignored
`.beep/research-library/intake-demo-receipt.json` and `intake-demo.log`.

Acquisition idempotence means valid capture IDs and original artifact/object
hashes stay unchanged. It does not require whole-catalog-byte equality: writer
transactions can record catalog history, and a new intake adds documents and
navigation. Invalid captures, new cited revisions, interrupted attempts, and an
explicit forced retry are separate work.

## Verification and navigation

The durable catalog separates source identity, cited version, acquisition capture,
artifact bytes, and citation occurrence. Human pages are generated projections.
`verify` checks relationships, hashes, capture completeness, and operational
qualification. Explicit reviewed dispositions account for unresolved identities,
operational endpoints, unavailable sources, incomplete captures, and blocked
tools. A disposition never makes unread evidence support an affirmative finding.

Open `index.html` directly from disk. Search and filters use embedded metadata;
source cards, report pages, and escaped evidence views use relative links. Raw
HTML is retained as evidence and displayed through escaped views. The collection
requires no server. `index.md` and the per-source/per-report Markdown files provide
the same navigation to agents and text editors. `render` can rebuild them from the
catalog and verified artifacts.

Copy or move the whole library root together. A moved library must retain its
catalog, objects, intake snapshots, source evidence, and repository clones. Input
locations remain historical provenance; navigation uses preserved local evidence.

## Ontology render

```sh
bun run beep research library ontology render --library <library-root>
```

This command folds the maintained schema annotations into the T-Box and generates
SHACL constraints from the same models. It writes
`ontology/research-library.ttl` and `ontology/research-library.shacl.ttl`, then
parses both files to check their syntax. Regenerate them after model or annotation
changes. Catalog JSON and immutable evidence remain the source of truth.

## SHACL verify

```sh
bun run beep research library verify --library <library-root>
```

Verification retains the byte-integrity, source provenance, citation census,
repository and qualification gates. It also rebuilds the RDF catalog projection
and validates it against generated SHACL shapes, including cardinality, datatypes,
references and controlled vocabularies. It always prints
`shacl: conforms=<bool> violations=<n>` after the integrity assessment, including
when that assessment has found data gaps. Either failing gate produces a nonzero
exit. Stored ontology files are unnecessary for verification.

## SPARQL views

`render` and `status` build one disposable RDF dataset per invocation. Filesystem
evidence determines effective source/version categories once; SPARQL selects and
counts those assessments. Named SELECT views cover report, source and qualification
indexes, report occurrences, direct and indirect source backlinks, capture history,
readable capture ordering, artifacts, status counts and the private partition.
Catalog order controls the indexes and retained history.

```sh
bun run beep research library render --library <library-root>
bun run beep research library status --library <library-root>
bun run beep research library status --include-private --library <library-root>
```

Reports, sources and artifacts marked `private` are omitted by default. An
occurrence is private when either its report or source is private; a finding
inherits its source's privacy. Private source evidence is excluded from public
pages. `status` always prints a separate
`private partition: documents=<n> sources=<n> artifacts=<n> occurrences=<n>` line.
`--include-private` on either command includes the private partition in its views.
Choose the intended audience before rendering a collection for sharing.

## Catalog v2 migration

Start with the read-only preflight:

```sh
bun run beep research library migrate --dry-run --library <library-root>
bun run beep research library migrate --library <library-root>
```

Migration decodes v1, supplies the new collection defaults and projects v2 in
memory. It requires zero SHACL violations and an exact SHA-256 match between the
SPARQL Markdown index and the existing `index.md`. A mismatch reports both hashes
and writes nothing. Regenerate an outdated index only after investigating why it
differs; the migration gate deliberately preserves the existing navigation bytes.

After a passing gate, migration preserves the exact catalog bytes at
`catalog/history/<sha>.json`, saves v2 atomically at `catalog/library.json`, and
writes `ops/migrations/<timestamp>-catalog-v2.json`. The schema-encoded receipt
records the validator contract, old and new schema versions, both catalog hashes,
the index hash, sorted unique intake dates, zero violations and its timestamp.
The index and all immutable evidence remain unchanged. Repeating migration on v2
succeeds as a no-op and writes nothing.

To reverse, copy the receipt's `catalog/history/<beforeCatalogSha256>.json` over
`catalog/library.json`. The reader continues to accept v1. Preserve the receipt
and backup for audit and do not edit historical artifacts.

## Exploration boundary

Finish intake reconciliation and the Phase 1 gate before substantive synthesis.
Keep original reports, full papers, transcripts, and cloned repositories in the
external library. Public exploration and goal packets hold derived findings,
stable source identifiers, citations, and sanitized receipts. Existing nightly
research packets and their ledger remain unchanged.

The first collection's acceptance and graduation contract is recorded in
[`research-corpus-synthesis`](../../explorations/research-corpus-synthesis/README.md).
