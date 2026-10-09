# Research reference library

`beep research library` preserves research inputs, citation occurrences, acquired
source evidence, and generated navigation outside the repository. Its default
root is `$HOME/YeeBois/research/beep-effect/`; it does not change the knowledge-vault
root used by the other research commands. Use `--library <absolute-path>` on any
operation to select another collection.

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
target source, returned content, and completeness must also pass. Firecrawl uses
the existing `@beep/firecrawl` service and its configured credential route. Keep
secret values out of commands, logs, import manifests, and packet documents.

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
for query URLs. Explicit publisher PDF metadata and OpenReview PDF routes may
locate the original. An arXiv version comes from the retained paper header or
from official metadata plus identical bytes from an explicitly versioned PDF;
never infer a version number.

## Session-owned provider results

Use `import-result <manifest-file>` for evidence obtained through a session tool,
including alphaXiv full text and Grok Build. Artifact entries identify local
original files by path, byte count, media type, role, and full SHA-256. The importer
checks identity and hashes before admitting them. Keep interpretations separate
from raw source text. The maintained import schemas are in
`Library/Library.import.ts`; the acquisition tests provide validated envelopes.

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
`youtube-transcript-api` can live under `~/.cache/beep/youtube-transcript-api`.
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

## Exploration boundary

Finish intake reconciliation and the Phase 1 gate before substantive synthesis.
Keep original reports, full papers, transcripts, and cloned repositories in the
external library. Public exploration and goal packets hold derived findings,
stable source identifiers, citations, and sanitized receipts. Existing nightly
research packets and their ledger remain unchanged.

The first collection's acceptance and graduation contract is recorded in
[`research-corpus-synthesis`](../../explorations/research-corpus-synthesis/README.md).
