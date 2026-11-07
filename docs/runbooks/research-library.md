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

### Private inputs

Pass `--private-input <dir>` (repeatable) for a root whose documents belong to the
private partition:

```sh
bun run beep research library inventory \
  --input /absolute/path/to/aggregation \
  --private-input /absolute/path/to/aggregation/Research-11-5-26
```

- Files under a private root are inventoried exactly like `--input` files, but their
  documents, intake census entries and roots carry `accessClass: "private"`. A private
  root may sit inside an `--input` root: the private class wins for that subtree and
  each file is inventoried once.
- The class belongs to the document's location, not its bytes. A byte-identical copy
  under a public root shares the snapshot object but stays a public document.
- Every inventory run reclassifies cited sources from all catalogued occurrences. A
  source cited only by private documents is private, and so is the GitHub repository
  identity such a citation implies. One public citation makes it public. Box sources
  keep the class `acquire --route box` gave them.
- The intake manifest of a run with private files is a private artifact. Private roots
  enter the intake identity, so changing a root's class records a new intake snapshot.
- `--private-input` alone does not add the default public roots; pass `--input` too
  when both are wanted.
- `status` reports the result on its `private partition:` line; views and `render`
  leave it out unless `--include-private` is given.

Qualification performs actual source acquisition. An installed executable, a
configured MCP server, and a successful provider request are insufficient: the
target source, returned content, and completeness must also pass. Keep secret
values out of commands, logs, import manifests, and packet documents.

Web, docs, and registry sources take the native `firecrawl` route through the
`@beep/firecrawl` driver. The key is the reference
`op://BEEP_SECRETS/BEEP_SECRETS/AI_FIRECRAWL_API_KEY`, read through the PATH `op`
shim on the first scrape; `FIRECRAWL_API_KEY` may instead hold a resolved key (for
example under `op run`) or another `op://` reference. The key never appears in
argv, logs, receipts, or packet files. A capture retains the exact bounded response
body as `raw-response`, its `rawHtml` as `raw-full-text`, and its `markdown` as
`extracted-full-text`, which is the envelope `Library.web.ts` validates, so native
captures and October's imported scrapes verify under one contract. The response
stream is cut at 20 MB before bytes are kept, whatever `Content-Length` declares,
and a PDF target is refused as `unsupported` even when it is labelled HTML: cite the
PDF as a paper source instead. Qualify the route with
`qualify --adapter firecrawl --max-probes 1`.

Acquisition retains a start receipt before each attempt and records its terminal
result. Qualified routes can progress independently. Inspect failed receipts
before using `--retry-failed`; do not repeatedly retry an unavailable source or
mistake a provider outage for source unavailability. `--source <source-id>` selects
a source for a bounded retry. A valid reviewed disposition survives a blanket
`--retry-failed` run. An explicit source selection can force a reviewed network
route; X imports and unresolved disposition routes remain explicit imports.
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

## Box route

`acquire --route box --box-folder <id>` (repeatable; subfolders included, at most
200 folders) or `--box-file <id>` lists the selection through `@beep/box`, keeps the
listing as a `box-listing` receipt, and registers each file as a `docs` source at
`https://app.box.com/file/<id>`. Box sources and their artifacts are private unless
`--box-public` is passed. The Box file version id is the source revision and the
captured revision is `<fileId>:<versionId>`; a capture is readable only when the
downloaded bytes match the SHA-1 Box reports. Each file gets one start and one
terminal receipt and the catalog is written after every file, because Box quota is
not observable. A rerun downloads nothing that is already captured readable for its
version; byte-identical files share one object under `objects/sha256`. A new Box
version is registered and acquired once more; earlier versions keep their captures.
If the route has no valid qualification, the first selected file is downloaded as
the qualification probe before the rest.

Credentials: `CLOUD_BOX_TOKEN` selects a developer token. Otherwise the client
credentials grant reads `DMS_BOX_CLIENT_ID`, `DMS_BOX_CLIENT_SECRET`, and
`DMS_BOX_ENTERPRISE_ID` from `BEEP_SECRETS` through the `op` shim. The enterprise
service account sees only folders shared with it; set `DMS_BOX_USER_ID=<box user id>`
to take a user as the token subject for user-owned files.

## Hops and the hop-2 gate

`inventory` records a hop-1 `Derivation` (with `hopDepth = 1`) for every citation in
a hop-0 document of each intake. It then reads the readable text of every hop-1
capture (Markdown, plain text, and transcripts up to 5 MB) and records each URL in it
as a hop-2 `Source` with a `hopDepth = 2` derivation from its hop-1 parent. Depth is
on the edge; nothing is dropped, and re-running inventory adds no duplicate edges. Run
`inventory`, `acquire`, then `inventory` again to catalogue hop 2.

`acquire` fetches a hop-2-only source only when the gate admits it:

- a hop-1 parent has a `Finding` whose topics name a live packet concept: a goal
  whose status is `active` or `paused`, or an exploration that is not `parked`,
  `killed`, or `graduated`;
- GitHub is never transitive: a GitHub child, or any child of a GitHub parent, is
  refused;
- arXiv hop 2 is catalogued only; name it with `--source <id>` to acquire it on
  demand;
- every other domain admits at most 25 acquired hop-2 sources per intake
  (`--hop2-domain-cap <n>`), counting sources already captured; candidates are taken
  in canonical-URL order.

Catalogued-only hop-2 identities are counted as `cataloguedHop2` by `verify` instead
of being reported missing. `status` ends with per-hop totals:

```text
hop 0: documents=<n> citations=<n>
hop 1: identities=<n> readable=<n>
hop 2: identities=<n> readable=<n> cataloguedOnly=<n> gateAdmitted=<n> gateRefused=<n> (<reason>=<n> ...)
```

`hops --limit <n>` prints the same totals and the first `n` gate decisions
(`admit|refuse <reason> <domain> <sourceId> <url>`) without acquiring.

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

A VidBee bundle imports with a `kind: "vidbee"` manifest naming `sourceId`,
`canonicalUrl`, and three originals (`path` relative to the manifest, `sha256`,
`bytes`, `mediaType`): `media`, `transcript` (the `.vtt`), and `faq` (the FAQ `.md`).
The transcript is kept as `raw-full-text` and the FAQ as `ai-interpretation`; the
media file is hashed in place and never copied. The FAQ frontmatter must name the same
media file (`media:`) and, if it records one, the same `source_url`. Its `model` (a
`model(effort)` pin or a separate `effort:` key) becomes the `ModelRun` agent; a
missing effort is recorded as `unrecorded`. The yt-dlp caption route stays primary
for cited YouTube URLs; VidBee is the fallback import.

An alphaXiv paper imports with a `kind: "alphaxiv"` manifest naming `sourceId`,
`canonicalUrl`, `arxivId`, `version` (`vN`), a `fullText` original of at least 1,000
characters, and an optional `references` list of `{ "arxivId" }` or `{ "url" }`
entries. The source must be the inventoried `arxiv:<arxivId>` paper and the version
must match any cited version, or the import fails with an identity error. Full text is
kept as `extracted-full-text` bound to the id and version; references become hop-2
sources with a derivation edge and no capture.

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

## Mining (T1/T2/T3)

`mine` turns an intake's readable sources and its own hop-0 documents into
CiTO-typed findings. There are two kinds of mining unit:

- A source job is one bound text artifact (extracted full text, then transcript,
  then raw plain text) of an effective readable, complete capture of a source
  cited by the intake's documents or derived from the intake. Incomplete or unread
  sources yield no job and no finding.
- A document job is one parseable intake document (nightlies, link lists, the
  private DM archive's markdown), bound to its snapshot under
  `intakes/<date>/raw/`. A document whose sha256 equals a planned capture text
  artifact (for example a Box nightly the Box route already captured) is skipped,
  because the source job reads the same bytes. A document job inherits the
  document's access class, so private documents are refused by `junie` and
  `cursor` like private sources.

A source finding binds `sourceId` and `captureId`. A document finding binds
`documentId` with an empty `sourceId`. The generated SHACL shapes require
exactly one of the two (`sh:xone`), and the projection writes no edge for the
empty one. Document findings carry no `sourceId`, so the hop-2 routed-parent
gate ignores them.

```sh
bun run beep research library mine triage --intake <id-or-date> --dry-run
bun run beep research library mine triage --intake <id-or-date> --concurrency 4
bun run beep research library mine read --intake <id-or-date> --profile junie --exclude-private
bun run beep research library mine read --intake <id-or-date> --profile claude
bun run beep research library mine synthesize <t3.json>
```

- `triage` (T1) gives every unit without a record a `select`, `skip` or `defer`
  decision. Default profile `codex-luna`: `codex exec -m gpt-6-luna -c
  model_reasoning_effort="medium" --output-schema <schema> -s read-only`.
- `read` (T2) deep-reads every T1-selected unit. Profiles: `junie`
  (`claude-opus-5-5` medium, the default while JetBrains credits remain), `claude`
  (`claude -p --model claude-opus-5-5 --effort medium --tools ""`) and `cursor`
  (`claude-opus-5-5-medium`, fallback only). `junie` and `cursor` refuse any
  private-partition unit with `LibraryMinePrivateRouteError` before launching; mine
  the private partition with `--profile claude`.
- `synthesize` (T3) imports a session-authored `LibrarySynthesisImport` file: an
  `id`, the orchestrator `author` (`model`, `effort`, `route`, `argv`) and findings
  that each name a `sourceId`, a readable `captureId`, a CiTO relation and a span.

Every answer decodes against its tier schema. A finding whose span is not a
verbatim substring of the bound text (capture text or document snapshot) rejects the whole job
(`LibraryMineSpanError`). Affirmative relations (`citesAsEvidence`, `supports`,
`extends`, `usesMethodIn`, `usesDataFrom`) are dropped from `partial` or `unread`
readings, and a prompt truncated at 200,000 characters is never `complete`. Topic
ids outside the live goal and exploration packets are dropped and listed on the
receipt. `--repo` names the repository whose packets supply topic ids.

Runs write under the library's `ops/mine/<tier>/`: `records/` (one immutable
record per unit; its presence marks the job done), `receipts/` (outcome, error tag,
prompt and output hashes, and the `ModelRun` with model, effort, route and exact
launch argv), `prompts/` and `outputs/`. One catalog write per run imports every
record not yet in the catalog, so rerunning resumes and skips completed jobs. A
quota or rate-limit exit pauses the batch; `--limit` caps pending jobs.

## Exploration boundary

Finish intake reconciliation and the Phase 1 gate before substantive synthesis.
Keep original reports, full papers, transcripts, and cloned repositories in the
external library. Public exploration and goal packets hold derived findings,
stable source identifiers, citations, and sanitized receipts. Existing nightly
research packets and their ledger remain unchanged.

The first collection's acceptance and graduation contract is recorded in
[`research-corpus-synthesis`](../../explorations/research-corpus-synthesis/README.md).
