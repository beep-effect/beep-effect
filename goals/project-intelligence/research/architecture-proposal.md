# Landscape Research Loop Architecture Proposal

**Date:** 2026-07-11

**Scope:** P0 gates G1, G4, G5, G6, and G7

**Proposed owning slice:** `landscape`

## Purpose and scope

This proposal defines the smallest durable architecture for one deterministic
vertical proof:

```text
GitHub watchlist
  -> immutable source snapshots
  -> normalized observations
  -> grounded, lifecycle-bearing candidate claims
  -> assessed daily Markdown brief
  -> typed Effect API
```

The proof is local-first and fixture-driven. It makes no live network or LLM
calls in tests, uses a fixed test clock, and treats the Markdown brief as a
delete-and-rebuild projection. Claims, evidence, provenance, lifecycle records,
and snapshot records are the epistemic authority, as required by
[`SPEC.md`](../SPEC.md).

This artifact decides ownership and boundaries. It does not select a database
or knowledge vendor; that remains G2's technology ADR. It also does not decide
the fate of the existing `beep research` command or its timer installer; that
remains G3's `research/prototype-disposition.md` work.

## Proposed package topology

### Owning name

Use `landscape`, not the packet slug and not a generic `intelligence`,
`knowledge`, or `common` package. The bounded context is the repository and
technology landscape being observed over time. The name describes the product
language exposed by the first proof while leaving future legal, workspace, and
other knowledge verticals in their existing slices.

The live tree has no `landscape` or knowledge-graph slice, and product
watchlists and daily briefs remain absent. This agrees with the negative
inventory in [`recon-findings.md`](./recon-findings.md) and the live source
search performed for this proposal.

### Packages

Create only the roles required by the first proof:

```text
packages/landscape/
  domain/       @beep/landscape-domain
  use-cases/    @beep/landscape-use-cases
  tables/       @beep/landscape-tables
  server/       @beep/landscape-server

packages/drivers/github/          @beep/github
packages/drivers/markdown-files/  @beep/markdown-files
```

- `domain` owns schema-first landscape language and pure lifecycle laws.
- `use-cases` owns commands, queries, application services, product ports,
  orchestration, and action-level errors.
- `tables` projects landscape entities into storage metadata. It does not own
  database execution or repositories.
- `server` implements product ports, composes live Layers, decodes the
  watchlist-file boundary, and writes projections.
- `@beep/github` is a product-neutral GitHub API wrapper with the canonical
  `Github.config.ts`, `Github.errors.ts`, and `Github.service.ts` roles.
- `@beep/markdown-files` is a product-neutral atomic Markdown file writer. It
  knows paths, UTF-8 documents, and technical write failures, but never
  `DailyBrief`, claims, watchlists, vaults, or landscape policy.

No `config`, `client`, or `ui` package is justified for the proof. The
watchlist is an explicit command input, not ambient runtime configuration.
Tables are justified because the proof must establish immutable authority,
idempotent reruns, tombstones, and projection rebuilds. This follows the
incremental spine and role rules in
[`standards/ARCHITECTURE.md`](../../../standards/ARCHITECTURE.md) and the
smallest-legal-slice rule in
[`13-onboarding-the-minimum-viable-slice.md`](../../../standards/architecture/13-onboarding-the-minimum-viable-slice.md).

### Factory command sketch

The first command establishes the legal domain + use-cases + server spine. The
subsequent persistence-stage concepts justify `tables`; the operation plan must
be inspected with `--dry-run` before it is applied.

```sh
bun run beep architecture create slice landscape ResearchRun \
  --domain-kind aggregates --stage core --dry-run

bun run beep architecture add concept landscape TrackedSource \
  --domain-kind entities --stage persistence --dry-run
bun run beep architecture add concept landscape SourceSnapshot \
  --domain-kind entities --stage persistence --dry-run
bun run beep architecture add concept landscape ResearchClaim \
  --domain-kind entities --stage persistence --dry-run
```

Add the remaining concept-qualified files through the same factory rather than
hand-authoring package boilerplate. Driver packages remain non-slice artifacts
and follow the driver role anchors in the architecture standard.

### Epistemic mechanism decision: decline for the first proof

The first proof will **not** import the epistemic slice's `CandidateClaim`,
`Evidence`, `ClaimGate`, `ClaimTransition`, `ClaimProjection`, or
`EpistemicServerLive`. It will build its product-specific claim admission and
projection behavior locally in `landscape`, using the unconditional reusable
substrate and vocabulary:

- `@beep/provenance/TextAnchor` for source offsets and quotes;
- `@beep/schema/UnitInterval` for confidence;
- `@beep/schema/Sha256` for canonical content digests; and
- `@beep/shared-domain/values/ClaimLifecycle` for admission states.

This is a decision, not a temporary ambiguity. The current epistemic entities
are keyed by `EpistemicFixtureKey`; `CandidateClaim.snapshot` is an
`UnknownRecord`; `Evidence` points through artifact and span fixture keys; the
gate proves the presence of an internally consistent quote; and the transition
advances only `candidate -> shape_valid`. Its projection counts states and
sorts admitted fixture keys. Those are useful precedents, but they do not own
stable external-source identity, immutable snapshot retention, source terms,
support withdrawal, or the landscape persistence contract. See the live
[`CandidateClaim`](../../../packages/epistemic/domain/src/entities/CandidateClaim/CandidateClaim.model.ts),
[`Evidence`](../../../packages/epistemic/domain/src/entities/Evidence/Evidence.model.ts),
[`ClaimGate`](../../../packages/epistemic/use-cases/src/ClaimGate/ClaimGate.service.ts),
[`ClaimTransition`](../../../packages/epistemic/use-cases/src/ClaimLifecycle/ClaimLifecycle.service.ts),
and [`ClaimProjection`](../../../packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts)
surfaces.

Persistence is also not reusable today: `@beep/epistemic-tables` exposes only
the `UsageRecord` table. The landscape proof would therefore have to build its
own authority repository even if it consumed the mechanism. Declining the
mechanism avoids a cross-slice exception without forking the unconditional
substrate or shared vocabulary. The package-local implementation must stay
small: a pure admission policy, a pure support-lifecycle transition, and a pure
brief projection, not a general epistemic framework.

Because no landscape tier imports an epistemic package, the packet's Exception
Ledger remains `None`. Any later proposal to consume the epistemic mechanism
must reopen G1 and confront the third-consumer removal trigger in the
2026-06-18 decision rather than silently adding the dependency.

## G1 concept-ownership matrix

Product meaning stays in the `landscape` slice or in already-promoted
`shared/domain` vocabulary. No row routes product semantics to `drivers/*` or
tooling.

| Product concept | Canonical owner | Role and notes | Authority class |
| --- | --- | --- | --- |
| `WatchlistEntry` | `@beep/landscape-domain` | Authored request to observe one provider locator, including enabled artifact kinds and optional labels. | Control input; the resolved registration is authoritative. |
| `TrackedSource` / `SourceIdentity` | `@beep/landscape-domain` | Stable provider identity, current aliases, source status, and first/last observation metadata. | Authoritative. |
| `SourceAlias` | `@beep/landscape-domain` | Time-bounded owner/name or URL locator history; never identity. | Authoritative provenance. |
| `SourceTermsRevision` | `@beep/landscape-domain` | Versioned attribution, license, and permitted-retention facts captured at acquisition. | Authoritative provenance. |
| `SourceTombstone` | `@beep/landscape-domain` | Stable identity retained after removal, with reason and effective time. | Authoritative lifecycle record. |
| `SourceSnapshot` | `@beep/landscape-domain` | Immutable envelope for source, artifact kind, upstream revision, content hash, terms revision, and acquisition provenance. | Authoritative. |
| `AcceptedSnapshotPayload` | `@beep/landscape-domain` contract; `@beep/landscape-server` storage adapter | Quote-bearing accepted (post-content-safety) bytes referenced by a snapshot while retention permits them; pre-redaction acquisition bytes are never persisted. | Authoritative while retained; replaced by an authoritative purge record when deleted. |
| `SnapshotPurgeRecord` | `@beep/landscape-domain` | Append-only record preserving snapshot identity, hash, offsets, reason, and purge state without prohibited content. | Authoritative lifecycle record. |
| `Observation` | `@beep/landscape-domain` | Normalized change detected from one or more snapshots, with direct snapshot references. | Rebuildable intermediate; never brief authority. |
| `SourceEvidence` | `@beep/landscape-domain` | Claim-to-snapshot grounding via `TextAnchor`, confidence, source terms, and provenance references. | Authoritative. |
| `ResearchClaim` | `@beep/landscape-domain` | Landscape-specific claim text, stable identity, evidence references, admission state, and support state. | Authoritative. |
| `ClaimLifecycle` | `@beep/shared-domain/values/ClaimLifecycle` | Already-promoted cross-slice admission vocabulary. `landscape` owns no replacement spelling. | Authoritative vocabulary; state is stored on `ResearchClaim`. |
| `ClaimSupportLifecycle` | `@beep/landscape-domain` | Local tagged state: `supported`, `source_removed`, `license_revoked`, or `evidence_purged`, with transition cause. | Authoritative lifecycle record. |
| `Assessment` | `@beep/landscape-domain` schema; `@beep/landscape-use-cases` projection | Deterministic freshness, confidence, novelty, and relevance evaluation over claims and evidence, including policy version. | Rebuildable intermediate. |
| `DailyBrief` / `BriefEntry` | `@beep/landscape-domain` projection schema; `@beep/landscape-use-cases` projector | Grounded output contract. Every assertion or recommendation references claim and evidence IDs and displays admission plus support state. | Rebuildable projection. |
| `ResearchRun` / per-source outcome | `@beep/landscape-domain` result schema; `@beep/landscape-use-cases` orchestration | One manually invoked run, canonical ordering, completion status, and partial/cancelled outcomes. | Run provenance is authoritative; convenience summaries are projections. |

The local `ClaimSupportLifecycle` is deliberately orthogonal to the shared
admission lifecycle. A previously admitted claim can remain historically
admitted while becoming unsupported and therefore ineligible to render as a
current fact. This avoids changing promoted vocabulary merely to model
landscape-specific source withdrawal.

## G1 adapter matrix

Product ports point inward from `@beep/landscape-use-cases`; server adapters
point outward to product-neutral drivers. Driver and platform failures are
translated at the adapter boundary.

| External boundary | Product port and owner | Product-neutral wrapper | Server adapter | First-proof stance |
| --- | --- | --- | --- | --- |
| GitHub repository resolution and artifact acquisition | `SourceResolver` and `SourceSnapshotReader` in `@beep/landscape-use-cases/server` | New `@beep/github` in `packages/drivers/github`; config/errors/service triad plus test Layer | `GithubSource.*` in `@beep/landscape-server` | Fixture Layer only in automated tests; no live API call. |
| Relational authority store | `LandscapeAuthorityStore` in `@beep/landscape-use-cases/server` | Existing `@beep/drizzle` plus the G2-selected SQL driver; `@beep/pglite` is the repo-native baseline, not a G1 commitment | Concept-qualified repositories in `@beep/landscape-server` over `@beep/landscape-tables` | In-memory and isolated PGlite contract suites may prove the same port. |
| Snapshot payload object storage (accepted bytes) | `SnapshotPayloadStore` in `@beep/landscape-use-cases/server` | The G2-selected storage driver; a relational byte store is sufficient for the first proof | `SourceSnapshot.payload-store.ts` in `@beep/landscape-server` | No object-store package before a demonstrated need. |
| Markdown filesystem output | `DailyBriefPublisher` in `@beep/landscape-use-cases/server` | New `@beep/markdown-files` in `packages/drivers/markdown-files`, using Effect `FileSystem`/`Path` and atomic writes | `DailyBrief.publisher.ts` in `@beep/landscape-server` | Writes only the requested projection root; in-memory test Layer in tests. |
| Markdown rendering | `DailyBriefProjector` in `@beep/landscape-use-cases/public` | Existing pure `@beep/md` `renderMarkdownBlocks`; not a transport and not a driver | Projector maps product schema to Markdown AST before publication | Deterministic, canonical ordering. |
| Hashing, clock, and cancellation | Driver-neutral port/value contracts where product actionability requires them | Effect `Crypto`, `Clock`, interruption, and test services; `@beep/schema/Sha256` for shape | Resolved in `@beep/landscape-server` Layer | Fixed clock and deterministic fixture controls. |

The GitHub driver follows the mature shape visible in
[`packages/drivers/govinfo`](../../../packages/drivers/govinfo), not the
metadata-only CourtListener package. It exposes provider concepts such as a
repository database ID, repository coordinates, response revision, and
artifact bytes; it does not expose watchlist entries, observations, claims,
assessments, or briefs.

## Authority versus projection map

| Record or output | Classification | Deletion and rebuild rule |
| --- | --- | --- |
| Resolved watchlist registration and run provenance | Authoritative control/provenance | Preserve the schema-decoded input hash and resolution result for each run. |
| Stable source identity, alias history, terms revisions, tombstones | Authoritative | Never infer identity from projection filenames or URLs. Tombstones survive payload deletion. |
| Snapshot envelope and retained accepted payload | Authoritative | Envelope is immutable. The accepted payload may be purged only through an authoritative purge transition; pre-redaction acquisition bytes are never persisted. |
| Evidence, provenance, admission lifecycle, support lifecycle | Authoritative | A purge may replace prohibited quote-bearing evidence with an evidence tombstone; IDs and hashes remain reserved. |
| Research claims | Authoritative | Claims are not recreated from briefs. Stable claim IDs deduplicate reruns. |
| Observations | Rebuildable intermediate | Recompute from surviving snapshot authority and the recorded normalizer version. Never cite an observation as brief authority. |
| Assessments | Rebuildable intermediate | Recompute from claims, evidence, fixed clock, and the recorded assessment-policy version. |
| Daily Markdown brief | Rebuildable projection | Delete and regenerate to byte-equivalent output from authority under the same projection version and clock. |
| Search indexes, graph views, embeddings, cached query views | Rebuildable projection | Delete without authority loss; absent from the first proof. |
| Obsidian vault layout and MCP responses | Projection only | Deferred; future adapters rebuild from the canonical SDK and never become write authority. |

### Scheduled-execution placement

The first proof has no scheduler, worker, cron contract, or unattended Layer.
`LandscapeResearch.runOnce` is invoked explicitly. Scheduled operation is a
roadmap stage after the deterministic contract is proven; the disposition of
the existing tooling-level systemd timer mechanism belongs to G3 in
`research/prototype-disposition.md` and creates no dependency for this design.

## G4 source identity and lifecycle

### Stable identity and aliases

For GitHub repositories, the canonical identity is the provider's immutable
repository database identity, encoded with a versioned namespace:

```text
github:repository:<database-id>
```

The human-authored `owner/name` coordinate and every repository URL are
locators. They are normalized for lookup, recorded as time-bounded
`SourceAlias` values, and may change after a rename or transfer without
changing `SourceIdentity`. The initial watchlist can therefore name a
repository before its stable identity is known; `SourceResolver` resolves the
locator before any authoritative snapshot is admitted.

If lookup reports a rename or transfer alongside the same database identity,
the run closes the previous alias interval and appends the new alias. If lookup
cannot recover an identity, no snapshot or claim is created. Tests use fixture
database IDs, not URLs, as expected authoritative identity.

### Snapshot immutability, versioning, and deduplication

Each `SourceSnapshot` records:

- `sourceId` and artifact selector;
- provider-neutral `sourceRevision` plus any provider revision metadata;
- the exact lowercase SHA-256 `acquisitionDigest` of the raw captured bytes,
  computed at the adapter boundary before any content-safety processing;
- the exact lowercase SHA-256 `contentHash` of the accepted payload bytes —
  the deterministic output of the versioned content-safety policy
  (redaction/normalization) applied to the raw bytes;
- the versioned content-safety/canonicalization policy identifier
  (`safetyPolicyVersion`) that produced the accepted bytes;
- the exact `captureGrantId` under which the bytes were acquired (the
  versioned initial grant or a recorded reacquisition grant), persisted in
  the immutable envelope so clean-store rebuilds hash the stored grant value
  rather than re-deriving it;
- acquisition time from `Clock`, terms revision, attribution, and provenance;
- accepted payload reference and payload-availability state.

The two digests partition responsibilities. `acquisitionDigest` drives
upstream change detection and idempotent reacquisition: unchanged raw bytes
are recognized before any safety processing runs. `contentHash` addresses the
payload store and anchors evidence: `TextAnchor` offsets and quotes are
defined against the accepted bytes — the only bytes that are retained,
extracted from, and rendered — so a length-changing redaction can never leave
an anchor pointing into bytes that no longer exist. Because the safety policy
is deterministic and versioned, identical raw bytes under the same policy
version always yield identical accepted bytes, keeping both digests stable
under rerun. This is the resolution of the redaction/hash interaction raised
by [`threat-model.md`](./threat-model.md).

`SnapshotId` is derived from a domain-separated canonical tuple:

```text
sha256(
  "landscape-snapshot-v1" + NUL +
  sourceId + NUL + artifactKind + NUL + artifactSelector + NUL +
  sourceRevision + NUL + acquisitionDigest + NUL +
  safetyPolicyVersion + NUL + captureGrantId
)
```

The tuple is encoded canonically before hashing. A snapshot row is append-only;
different raw content, revision, or safety-policy version produces a different
ID. The same tuple is an idempotent no-op. `captureGrantId` is itself
deterministic: registering a source establishes its implicit initial grant (a
versioned constant, `grant-0`), and later grants exist only as explicit,
recorded reacquisition authorizations numbered in sequence per source
(`grant-1`, `grant-2`, ...) in the authority store — never derived from clocks
or randomness — so identical fixtures produce identical snapshot IDs on cold
runs and clean-store rebuilds. A content-addressed payload store deduplicates
identical accepted bytes globally by `contentHash`, while separate snapshot
envelopes preserve source, revision, terms, and attribution provenance. Claims deduplicate by a
separate versioned hash of normalized claim meaning plus the evidence IDs in
their canonical total order — a byte-wise lexicographic sort of the IDs
applied immediately before hashing, never insertion, extraction, or query
order — so the same evidence set always yields the same claim ID; wording
normalization is never borrowed from URL normalization.

### Retention and purge

The first proof has no time-based background retention job. Its default is to
retain snapshot envelopes and accepted post-safety payloads while the recorded
terms permit retention. Pre-redaction acquisition bytes are never persisted:
the content-safety policy runs at the adapter boundary, only accepted bytes
reach any store, and the raw input survives only as its `acquisitionDigest`
fingerprint. Purge is an explicit typed action with one of these reasons:

- source-owner removal request;
- license revocation or retroactive terms restriction;
- security quarantine requiring content deletion; or
- explicit proof-fixture lifecycle action.

Purge is a state machine, not an unrecorded file deletion:

1. append `purge_pending` and make the payload ineligible for reads or
   projections;
2. sever the purged snapshot's payload reference and remove any prohibited
   quote-bearing evidence; the physical bytes are deleted once no other
   authorized snapshot references that `contentHash`, and otherwise remain
   solely for the surviving authorized references while the purged snapshot's
   reads fail closed;
3. append `purged`, retaining IDs, content/quote hashes, offsets, terms revision,
   reason, actor provenance, and time;
4. rebuild every affected projection from the surviving authority.

Content-addressed deduplication therefore never weakens erasure: payload
authorization is per snapshot reference, physical deletion follows the last
severed reference, and a terms revocation cascades to every snapshot whose
authorization derives from the revoked source, so revoked content cannot
survive behind another of that source's snapshots.

Failure between steps leaves `purge_pending`, which is already fail-closed and
retryable. Reacquisition is forbidden until a new terms revision explicitly
authorizes it. A new `captureGrantId` then produces a new snapshot identity even
if the upstream bytes match previously purged content, so a deleted grant is
never silently resurrected.

### Removed sources and license changes

A confirmed removed source appends a `SourceTombstone`; its stable identity and
alias history remain reserved. Claims whose usable evidence set becomes empty
transition to `ClaimSupportLifecycle.source_removed`. Claims with other usable
evidence remain `supported`, but their assessment freshness is recalculated.
The admission lifecycle is historical and does not move backward.

A license or attribution observation always appends a `SourceTermsRevision`.
Non-retroactive changes apply to future snapshots; prior snapshots retain the
terms revision captured with them. A retroactive revocation immediately marks
affected payloads unavailable, initiates purge, and transitions dependent
claims to `license_revoked` or `evidence_purged`. A brief may display such a
claim only as visibly withdrawn historical material, never as a current fact
or recommendation premise.

Missing attribution is not normalized to an empty string. It is an explicit
`unknown` terms state and follows the threat model's quarantine/render-safe
outcome. Every retained quotation rendered in a brief carries the attribution
derived from its snapshot's terms revision.

### Deterministic rebuild after deletion

Rebuild reads only surviving authoritative records and authoritative
tombstones/purge records; it does not contact GitHub or invoke a model. Stable
IDs are never reused. The fold orders by stable IDs, uses the recorded
normalizer/assessment/projection versions and fixed clock, excludes unavailable
payloads, recalculates claim support, and emits a canonical brief.

The P1 scenario matrix must prove that clean rebuild after deletion produces
the same authority-visible counts, support transitions, ordering, and Markdown
bytes as an incremental run that observed the same deletion. A purged payload
cannot be reconstructed; the deterministic result is its tombstone and the
withdrawn or unsupported dependent material.

## G5 fixture ownership and catalog

### Decision: new package-local catalog

Adopt the useful `seed` / `input` / `expected` envelope pattern from
[`runtime-data-loop`](../../agentic-professional-runtime/fixtures/runtime-data-loop/README.md),
but do **not** extend or import that goals-owned directory. Create a new
canonical catalog owned by the landscape server test surface:

```text
packages/landscape/server/test/fixtures/github-landscape-loop/
  catalog.json
  <scenario>/
    seed.authority.json
    input.watchlist.json
    input.github.json
    expected.authority.json
    expected.observations.json
    expected.brief.md
    expected.run.json
```

`catalog.json` contains scenario IDs, schema versions, fixed clock values,
fixture hashes, expected outcome class, and canonical file ordering. A
package-local schema-backed validator loads every scenario. Scenario names,
IDs, provider database IDs, commit revisions, times, and bytes are synthetic
and stable.

Raw provider-response contract fixtures that test decoding belong to
`packages/drivers/github/test/fixtures/` and are exposed only through the
driver's test Layer. Landscape scenario fixtures contain driver-neutral source
responses and product expectations. This separates technical wire fidelity
from product semantics without making tests depend on a foreign slice.

Executable fixtures, stubs, golden files, and validators live only under the
owning package's `/test` surface and are exported, when reuse is justified,
through canonical package `/test` subpaths. `goals/project-intelligence/research/`
and `history/` may contain deterministic evidence copies such as a sample brief
or proof transcript, but package tests must never read them. This follows the
fixture doctrine in
[`08-testing.md`](../../../standards/architecture/08-testing.md).

### Isolation and composition proof

Landscape domain and use-case tests run only with landscape fixtures and port
stubs. Server tests may add driver test Layers. No test performs a live network
or LLM call, and time comes from a fixed `TestClock`.

Because G1 declines the epistemic mechanism, the first proof has no epistemic
Layer to compose or stub. If G1 is later reopened to consume that boundary,
landscape slice tests must stub its promoted/bounded contract and must not boot
`EpistemicServerLive`. Any test of real multi-slice composition belongs under
an app or integration boundary with app-owned wiring and package-local
fixtures; no such multi-slice proof is required here.

The determinism catalog must cover at least cold run, same-store rerun,
clean-store rebuild, modified source, rename, removal, license revocation,
partial source failure, cancellation, and projection deletion/rebuild. It must
assert IDs, hashes, record counts, canonical order, lifecycle states, and exact
brief bytes rather than only asserting test success.

## G6 watchlist entry

### First-proof mechanism

The command accepts one explicit repo-relative watchlist file path. The server
boundary reads it with Effect `FileSystem`, decodes unknown JSON through a
versioned `WatchlistFile` schema, and passes the decoded `WatchlistSpec` value
to `LandscapeResearch.runOnce`. The use-case never opens a path or parses JSON.

Minimum schema:

```json
{
  "schemaVersion": "landscape-watchlist-v1",
  "sources": [
    {
      "provider": "github",
      "repository": "example-org/example-repo",
      "artifacts": ["repository-metadata", "readme"],
      "enabled": true
    }
  ]
}
```

Decode rejects unknown provider tags, malformed coordinates, duplicate
provider/coordinate entries, an empty enabled set, unsupported artifact kinds,
and unknown schema versions. Entries are sorted by provider and normalized
coordinate before resolution. Duplicate detection runs twice: literal
provider/coordinate duplicates fail schema decode, and after resolution the
run rejects (as `WatchlistRejected`) any two entries that resolve to the same
`SourceIdentity` — for example an old and a new name for the same repository
after a rename — so aliases cannot smuggle conflicting settings for one
source. The file hash and decoded schema version are
recorded in `ResearchRun` provenance, but the local path is not a source
identity.

For the first proof, entry is manual and explicit: no discovery crawler,
star-list import, UI, database mutation endpoint, or scheduled reconciliation.
The roadmap may add typed SDK commands for `registerSource`, `disableSource`,
and `importWatchlist`, followed by approval-gated discovery candidates. All
growth paths must resolve provider locators to stable `SourceIdentity` and use
the same authority contract; none may turn a URL or projection file into
identity.

## G7 projection candidates

### Obsidian-compatible vault: deferred-nonblocking

The first proof emits one deterministic CommonMark daily brief through
`DailyBriefPublisher`. That file may be opened by Obsidian, but the proof does
not promise a vault directory contract, wikilinks, backlinks, frontmatter
taxonomy, note-per-claim files, or vault indexes. A future Obsidian vault is a
projection adapter over `DailyBrief` and canonical query results; deleting the
vault must lose no authority.

Deferral keeps the proof focused on grounding and rebuildability and avoids
making the existing CLI vault format an accidental domain contract before G3
disposes of it. No P1-P3 acceptance criterion depends on a vault.

### MCP over the SDK: deferred-nonblocking

MCP is not a core domain interface. After the typed SDK is proven, a later
`Research.tool-handlers.ts` adapter in `@beep/landscape-server` may expose
read-only SDK queries and explicitly authorized actions using
[`@beep/mcp-kit`](../../../packages/foundation/capability/mcp-kit). Product MCP
handlers belong in the slice server tier; a repo-level driver must not import a
product slice merely to expose it.

MCP responses, field-tier views, and handles are projections. They may cite
authority IDs but never become an alternate store, lifecycle owner, or claim
admission path. No P1-P3 acceptance criterion depends on MCP.

## Canonical typed Effect SDK

### Public surfaces

`@beep/landscape-use-cases/public` exports schema-first command/query/result
contracts, public action errors, and pure projection contracts. Server-only
ports and services export from `@beep/landscape-use-cases/server`. Live Layers
export from `@beep/landscape-server/layer`; applications and the proof command
compose only public subpaths.

| Service or contract | Key operations | Contract summary |
| --- | --- | --- |
| `LandscapeResearch` | `runOnce`, `rebuildDailyBrief`, `removeSource`, `recordTermsRevision`, `purgeSnapshot` | Action service. Executes one explicit run or lifecycle action and returns stable IDs plus per-source outcomes. |
| `LandscapeQueries` | `getSource`, `getClaim`, `listClaimsForDate`, `getRun` | Read service over authority; results visibly include admission and support state. |
| `DailyBriefProjector` | `project` | Pure deterministic fold over supplied authority and projection context. Publication and replacement remain action orchestration. |
| `SourceResolver` | `resolve` | Server-only product port translating a provider locator into stable identity and aliases. |
| `SourceSnapshotReader` | `readSnapshots` | Server-only product port returning driver-neutral immutable snapshot inputs and typed source outcomes. |
| `LandscapeAuthorityStore` | `transact`, `readAuthority` | Server-only repository port enforcing idempotent writes and atomic lifecycle changes. |
| `SnapshotPayloadStore` | `putIfAbsent`, `read`, `quarantine`, `purge` | Server-only content-addressed payload port with fail-closed purge states. |
| `DailyBriefPublisher` | `publish`, `remove` | Server-only projection output port; never reads or mutates authority. |

`runOnce` orders work deterministically, resolves all enabled sources, acquires
fixture snapshots, commits each source's coherent authority unit, derives
observations and candidate claims, evaluates admission/support, and builds the
brief from claims and evidence. Observations cannot flow directly to the brief.

### Error taxonomy and failure-semantics partition

The boundary doctrine in the 2026-05-01
[`DECISIONS.md`](../../../standards/architecture/DECISIONS.md) entry applies
literally:

| Boundary | Example failures | Where they end |
| --- | --- | --- |
| Driver/internal | `GithubError`, SQL client failure, filesystem platform failure, response decode defect | Translated inside `@beep/landscape-server` adapters; never exported by landscape use-cases. |
| Server-only product port | `SourceRemoved`, `SourceRenamed`, `SourceUnavailable`, `SnapshotStoreUnavailable`, `PublicationUnavailable`, `AcquisitionCancelled` | Consumed by `LandscapeResearch` orchestration and translated into a per-source outcome or action-level error. Never exported from `/public`. |
| Public action | `WatchlistRejected`, `ResearchRunUnavailable`, `ResearchRunCancelled`, `SourceLifecycleRejected`, `ProjectionPublishFailed` | Ends at CLI/protocol handler, where it becomes an exit code or protocol response. |

The driver-neutral source outcome is a discriminated union, not a bag of
optional fields:

- `completed` and `unchanged`;
- `renamed` and `removed`;
- `unavailable` with `retryable` or `terminal` classification;
- `cancelled`; and
- `quarantined` with a safe reason code.

A coherent run with some failed sources returns a successful
`ResearchRunResult` whose completeness is `partial` and whose per-source
outcomes preserve those failures. It does not discard successful source
authority, and it does not misclassify a temporary unavailable source as
removed. A failure to commit a coherent authority unit, decode the watchlist,
or produce the required projection becomes an action-level error.

Cancellation is explicit and fixture-tested at source and whole-run
boundaries. Orchestration stops starting new work, lets the current atomic
authority transaction finish or roll back, records a cancelled outcome, and
returns `ResearchRunCancelled` only when the command as a whole cannot produce
a coherent result. Tests cover cancellation before acquisition, between
sources, and during a port call.

This proof defines the typed taxonomy, translation, cancellation, atomicity,
and partial-result behavior. It deliberately does **not** implement live GitHub
rate-limit policy, pagination strategy, retry schedules or jitter, conditional
request timing, or force-push detection. Those are production-transport policy
for a later GitHub adapter stage.

## Risks and alternatives considered

### Risk: local claim logic diverges from the epistemic slice

The local policy could drift from future epistemic work. Mitigation is to reuse
the promoted `ClaimLifecycle` spelling, foundation provenance primitives, and
the same projections-are-rebuildable invariant, while keeping the local policy
small and product-specific. Reconsider extraction only when the public
contract covers source-backed persistence and support withdrawal and the
cross-slice promotion trigger is deliberately handled.

### Alternative: consume `ClaimGate` and `EpistemicServerLive` now

Rejected for the first proof. It would require the bounded exception while
still leaving source identity, tables, payload retention, terms, support
withdrawal, and most lifecycle behavior to the new slice. It would also add a
new mechanism consumer at the point where the 2026-06-18 decision says a third
consumer must trigger a shared contract or emitted-event review.

### Alternative: move all claim/evidence models to `shared/domain`

Rejected. Only the lifecycle vocabulary has cleared the shared-kernel
promotion gate. Landscape source evidence and support withdrawal are
slice-specific product semantics, while generic `TextAnchor`, `UnitInterval`,
and SHA-256 shapes already have foundation homes. The promotion-record
convention is documented in
[`packages/shared/domain/README.md`](../../../packages/shared/domain/README.md).

### Alternative: keep the proof in tooling

Rejected. The existing CLI demonstrates useful mechanisms, but tooling cannot
own product watchlists, claims, source lifecycle, or brief semantics. Tooling
may invoke the typed SDK after G3, but it cannot be the canonical owner.

### Alternative: make an Obsidian vault or MCP the primary store

Rejected. Both collapse a projection/transport choice into authority and make
deterministic replacement harder. The canonical SDK and relational/product
ports remain independent of both.

### Risk: two new drivers are too much topology

`@beep/github` is unavoidable for a typed live roadmap boundary and has a
fixture Layer in the proof. `@beep/markdown-files` is accepted as the narrow
product-neutral wrapper required by the adapter matrix: atomic root-confined
Markdown writes, technical errors, and a test Layer only. It must be removed
or G1 reopened if implementation would require product nouns or behavior.

## Recon corrections

Two live-source discrepancies refine
[`recon-findings.md`](./recon-findings.md):

1. `packages/drivers/courtlistener` is currently metadata-only and exports
   `VERSION`; it is not an implemented config/errors/service triad. The
   implemented comparison and template for this proposal is
   `packages/drivers/govinfo`.
2. The recon's unresolved question about an end-to-end consumer of the
   epistemic mechanism is now resolved. The law-practice use-case imports
   `projectClaims` plus the `ClaimGateShape` and `ClaimTransitionShape`, and
   its server Layer provides `EpistemicServerLive`; see
   [`OfficeActionReview.service.ts`](../../../packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts)
   and [`Layer.ts`](../../../packages/law-practice/server/src/Layer.ts).

These corrections strengthen, rather than weaken, the decision to avoid a new
bounded exception: this proof would introduce the next distinct vertical at
the exact threshold where shared-contract/event extraction must be reviewed.

## Gate decisions

### G1 — accepted

**2026-07-11 — Accepted.** The concept and adapter matrices in
[`architecture-proposal.md`](./architecture-proposal.md) assign all product
semantics to the new `landscape` slice or existing promoted vocabulary and all
technical transports to product-neutral boundaries. The proof declines the
epistemic mechanism and instead reuses `TextAnchor`, `UnitInterval`, SHA-256,
and shared `ClaimLifecycle`, so no cross-slice Exception Ledger entry is
authorized and the ledger remains `None`. Authoritative records are snapshots,
claims, evidence, provenance, and lifecycles; briefs, observations,
assessments, indexes, views, vault files, and MCP responses are rebuildable.

### G4 — accepted

**2026-07-11 — Accepted.**
[`architecture-proposal.md`](./architecture-proposal.md) fixes GitHub source
identity to the provider repository database ID rather than a URL, defines
content-addressed immutable snapshots and idempotent deduplication, and records
aliases and terms revisions. Explicit tombstone, support-transition,
quarantine, purge, attribution, and deterministic post-deletion rebuild rules
preserve identity without resurrecting deleted content.

### G5 — accepted

**2026-07-11 — Accepted.**
[`architecture-proposal.md`](./architecture-proposal.md) selects a new
package-local `github-landscape-loop` fixture catalog under the landscape
server `/test` surface, borrowing only the seed/input/expected pattern from the
goals-owned precedent. Slice tests use local port stubs, driver contracts own
wire fixtures, packet copies are generated evidence only, and any future real
multi-slice composition proof must live at an app/integration boundary.

### G6 — accepted

**2026-07-11 — Accepted.** The first proof accepts an explicit repo-relative,
schema-versioned JSON watchlist decoded at the server/API boundary, as specified
in [`architecture-proposal.md`](./architecture-proposal.md). Manual entries are
resolved from provider coordinates to stable identities before acquisition;
discovery, UI mutation, imports, and scheduled reconciliation remain roadmap
work over the same typed registration contract.

### G7 — deferred-nonblocking

**2026-07-11 — Deferred-nonblocking.**
[`architecture-proposal.md`](./architecture-proposal.md) keeps the required
daily CommonMark brief in the first proof but defers an Obsidian vault contract
and an MCP adapter until the canonical SDK is proven. Both future surfaces are
projection-only, no P1-P3 acceptance criterion depends on either, and a later
MCP adapter must use `@beep/mcp-kit` from the landscape server tier rather than
becoming authority.
