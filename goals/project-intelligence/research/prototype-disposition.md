# Prototype disposition for project intelligence

This artifact resolves SPEC gate G3 under decisions D5 and D8: it treats the
existing `beep research` command as governing prior art without presuming that
tooling code belongs in the product architecture. It classifies every executable
token and every enumerated internal mechanism as promote, reuse, retire, or
controlled defer, with replacement ownership for the deterministic first proof
(`goals/project-intelligence/SPEC.md`, Deferred Decision Gates G3; decisions D5
and D8).

**Freshness.** The tree was inspected on 2026-07-11 on the P0 branch. Every file
under `packages/tooling/tool/cli/src/commands/Research/`, including `internal/`,
was read. The second user-timer mechanism was traced through
`packages/tooling/library/ai-metrics/src/install.ts`, the AIMetrics command
facade and programs, and the timer renderer it invokes.

## Executable-token matrix

The disposition applies to the capability behind each token, not to copying its
current implementation. A promoted capability is rewritten schema-first behind
the target slice's typed Effect API.

| Mechanism | Evidence (repo-relative paths) | Disposition | Rationale | Replacement ownership |
| --- | --- | --- | --- | --- |
| `capture` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Capture.ts` | promote | The ingest shape—canonicalize identity, detect a prior source, acquire content, hash it, and persist a result—is useful. Firecrawl and mutable Markdown cards are not the first proof: fixture GitHub inputs must become immutable snapshots, observations, and candidate claims. | Target product slice domain owns source identity, snapshots, observations, and claims; its use-cases tier owns capture orchestration; a product-neutral GitHub adapter belongs in `drivers/*`. |
| `cognify` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Cognify.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/CogneeClient.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/GraphitiEpisodes.ts` | defer | It projects pending cards into graph-memory systems and records a best-effort event. Vendor adoption is explicitly outside the first proof, and the card-shaped input lacks the new claim/evidence authority boundary. See defer DFR-1 and DFR-2. | No P1–P3 owner. A later graph/search projection adapter may consume the canonical SDK after the domain contract is proven. |
| `daily` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts` | promote | Ordered orchestration and per-step failure isolation are valuable, but the promoted workflow is the deterministic fixture path from watchlist through grounded brief. Optional live-corpus pulls, vendor calls, and Git commits are excluded. | Target product slice use-cases tier, exposed through the typed Effect API; command wiring remains a thin tooling adapter. |
| `digest` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Digest.ts` | promote | A daily Markdown output is required, but the current digest is a catalog-count and wikilink report. It has no evidence IDs, claim lifecycle, confidence, or grounded recommendations, so only the projection role graduates. | Target product slice projection/use-case boundary renders the daily brief from authoritative claims and evidence. Markdown is rebuildable output. |
| `history-sift` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/HistorySift.ts` | retire | It discovers browser profiles, copies history stores, filters visit records, and emits link stubs. That personal-corpus acquisition path is outside the GitHub-watchlist proof and outside P1–P3. | n/a; a future explicitly authorized personal-source packet must design its own consent, privacy, and source-boundary contract. |
| `install-timers` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts` | retire | It directly writes and enables daily and weekly systemd user units. Scheduled and unattended operation is a first-proof non-goal, and host mutation does not belong in the domain proof. | n/a for P1–P3; any later scheduler is a runtime/operations adapter over the canonical use case, never product semantics. |
| `notion-pull` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/NotionPull.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/NotionPullRun.ts` | retire | It functionally imports saved-link records from an external workspace, pages either block children or database rows, and writes link cards. That personal-corpus source is not needed by the public GitHub fixture vertical. | n/a; any later workspace-source adapter requires a separately authorized source packet and a product-neutral transport driver. |
| `repo-card` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/RepoCardRun.ts` | promote | Repository metadata acquisition is the closest prior art to the GitHub watchlist proof. The capability graduates, but scanning the operator's cloned-repository collection, shelling out to `gh`, and rendering cards do not. | Watchlist and repository source identity live in the target domain; fixture and later live GitHub acquisition sit behind a use-case port with a product-neutral `drivers/*` adapter. |
| `status` | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Status.ts` | promote | Observable counts and pending-work state are useful. Current card/inbox/cognify counts must be replaced by authoritative snapshot, observation, claim-lifecycle, failure, and brief-projection status. | Target use-cases tier owns typed status queries; CLI output is an adapter and structured telemetry uses the runtime observability boundary. |

## Internal-mechanism matrix

The internal module census is exhaustive: `BrowserHistory`, `Capture`,
`Catalog`, `CatalogOps`, `CogneeClient`, `Cognify`, `Daily`, `Digest`,
`GraphitiEpisodes`, `HistorySift`, `NotionPull`, `NotionPullRun`, `RepoCards`,
`RepoCardRun`, `Status`, `Timers`, `UnknownRecord`, and `Vault`. The table also
covers the five suite-level modules (`Research.command`, `Research.errors`,
`Research.render`, `Research.schemas`, `Research.service`) and the public
`index` barrel. Thus every Research module enumerated during inspection is
covered below, including mechanisms not named in the minimum G3 list.

| Mechanism | Evidence (repo-relative paths) | Disposition | Rationale | Replacement ownership |
| --- | --- | --- | --- | --- |
| CLI routing, flags, and public barrel | `packages/tooling/tool/cli/src/commands/Research/Research.command.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.render.ts`; `packages/tooling/tool/cli/src/commands/Research/index.ts` | retire | The nine-token knowledge-vault surface is not the first proof's invocation contract; P1 fixes that contract after P0 gates resolve. The command index also embeds operator-machine defaults. | P1 proof specification owns the invocation contract; later CLI wiring is a thin adapter over the canonical SDK. |
| Typed Effect service facade and live Layer | `packages/tooling/tool/cli/src/commands/Research/Research.service.ts` | promote | A typed Effect API, explicit requirements, and Layer composition match the proof, but product operations cannot remain a CLI-internal service. | Target slice use-cases package owns ports, service contract, and live composition; tooling may only call it. |
| Card vocabularies, option schemas, and summary schemas | `packages/tooling/tool/cli/src/commands/Research/Research.schemas.ts` | retire | The code is schema-based, but its core model is card source/type/status plus command summaries. The proof requires source identity, immutable snapshots, observations, evidence, lifecycle-bearing claims, assessments, and grounded briefs. | Target domain owns new schema-first product models; use-cases owns operation inputs/results. |
| Single `ResearchCommandError` | `packages/tooling/tool/cli/src/commands/Research/Research.errors.ts` | retire | One catch-all message/cause error erases the driver-neutral failure taxonomy, retryability, partial failure, cancellation, and source-unavailable states required by the proof. | Typed domain/use-case errors at their owning boundaries; driver failures terminate in adapters. |
| Vault-root resolution and directory layout | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.command.ts` | retire | An external knowledge-vault root and fixed card directories are operator tooling concerns, not authority or required first-proof topology. | Canonical package-local fixture and store locations are selected by P0/P1 ownership decisions; Markdown brief output is a rebuildable projection. |
| Vault card format: YAML frontmatter and Markdown body | `packages/tooling/tool/cli/src/commands/Research/Research.schemas.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts` | retire | The format carries card id, title, URL, source type, capture time, ingress path, triage status, tags, relations, cognify time, and optional content hash. It cannot express immutable snapshot versions, evidence spans, provenance, claim lifecycle, or projection authority, so it must not become the canonical model. | New authoritative schemas live in the target domain; any later vault output is a projection owned by a projection adapter after G7. |
| URL normalization | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/HistorySift.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/NotionPullRun.ts` | promote | Fragment removal, tracking-parameter removal, query sorting, host case normalization, and trailing-slash handling are useful source-identity evidence. The exact rules must be specified and property-tested rather than copied as an incidental helper. | Target domain source-identity schema and constructor. |
| SHA-256 content hashing | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Capture.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/CatalogOps.ts` | promote | Deterministic hashing supports snapshot identity, unchanged-input detection, and rebuild proof. Current call sites inconsistently hash a body versus a rendered card, so the new contract must define exact canonical bytes. | Target domain snapshot identity/content-digest value; persistence adapter stores the digest. |
| Slug generation | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/HistorySift.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/NotionPullRun.ts` | retire | A title-derived file slug with a short URL-hash suffix is convenient for mutable cards but is not an authoritative identity and is unnecessary for deterministic record IDs. | n/a for authority; a future Markdown projection may derive filenames from authoritative IDs. |
| Card rendering, lenient parsing, and overwrite write helper | `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.render.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Digest.ts` | retire | Hand-edit tolerance and overwrite writes are incompatible with immutable authoritative snapshots. Wikilink rendering is duplicated between the public render module and Digest. | Target persistence port enforces append/immutability; the brief renderer uses canonical Markdown facilities as a rebuildable projection. |
| Capture flow and scrape-response extraction | `packages/tooling/tool/cli/src/commands/Research/internal/Capture.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/UnknownRecord.ts` | promote | The staged flow is useful, but live Firecrawl, ad hoc unknown-record narrowing, current wall-clock time, and a card write are replaced by fixture decoding, a fixed test clock, immutable snapshot persistence, observation extraction, and candidate-claim creation. | Target use-case orchestration plus schema-decoded GitHub source port; live transport remains a later driver. |
| DuckDB catalog schema (`research_seen_urls`, `research_cards`, `research_capture_log`) | `packages/tooling/tool/cli/src/commands/Research/internal/Catalog.ts` | retire | The catalog is explicitly a rebuildable index under Markdown authority. Its URL/card/log tables cannot hold the proof's authoritative snapshots, evidence, claims, lifecycle, provenance, or tombstones, and card upserts are not snapshot immutability. | Store schema chosen by P0 ownership/technology gates, behind target persistence ports; projections remain rebuildable. |
| Catalog runtime, batched persistence, and seen-URL set (`CatalogOps`) | `packages/tooling/tool/cli/src/commands/Research/internal/Catalog.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/CatalogOps.ts` | promote | Scoped DuckDB layers, decoded query rows, batch persistence, and idempotency intent are useful patterns. Files are written before catalog updates with no shared transaction, and URL presence alone is too weak for source-version identity, so the implementation is rewritten. | Target use-cases transaction boundary and product-neutral persistence adapter. |
| Browser profile discovery and copied-history SQL scan | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts` | retire | Functionally, this locates browser history stores, copies locked data into scoped temporary storage, converts timestamps, and queries recent visits. It is a personal-corpus reader outside the authorized vertical. | n/a. |
| Browser-history interest heuristics and repository-root canonicalization | `packages/tooling/tool/cli/src/commands/Research/internal/BrowserHistory.ts` | retire | Regex allow/deny filtering is operator-curation policy without a schema-first product home. It is neither the explicit GitHub watchlist nor evidence-backed discovery. | n/a; source admission for the proof is the explicit watchlist owned by the target domain. |
| History-sift collection, deduplication, and stub construction | `packages/tooling/tool/cli/src/commands/Research/internal/HistorySift.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/CatalogOps.ts` | retire | It collapses visit records by normalized URL and emits inbox stubs, but no P1–P3 scenario consumes browser history or link stubs. | n/a. |
| Cloned-repository discovery and local inspection | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/RepoCardRun.ts` | retire | It walks the operator's cloned-repository collection and shells out to Git for remotes and commit metadata. The first proof admits only its explicit public GitHub watchlist fixtures. | n/a for the proof; later local-corpus work requires separate authorization and design. |
| GitHub starred-repository acquisition through `gh` | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCards.ts` | retire | The shell-out supplies useful prior-art fields but is tied to ambient authentication and a personal star collection. Tests require no live network, and the production path needs a typed GitHub port/driver rather than `gh`. | Fixture GitHub adapter in P2; a product-neutral live GitHub driver in a later production-adapter stage. |
| Repository card construction and persistence | `packages/tooling/tool/cli/src/commands/Research/internal/RepoCardRun.ts` | promote | Repository identity, metadata, description, topics, language, license presence, and change time inform snapshot/observation design. Card paths, cloned/starred tags, and mutable persistence do not graduate. | Target domain repository snapshot and observation schemas; target use case maps driver data into authority. |
| Minimal Notion transport, pagination, and local JSON seam (`NotionPull`) | `packages/tooling/tool/cli/src/commands/Research/internal/NotionPull.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/UnknownRecord.ts` | retire | Functionally, it finds or reads saved-link collections, paginates records, extracts title/URL/tags/time, or decodes a local JSON backfill. That source is outside the first proof, and ad hoc payload traversal is not a reusable product driver. | n/a for P1–P3. |
| Notion link normalization and x-post card run | `packages/tooling/tool/cli/src/commands/Research/internal/NotionPullRun.ts` | retire | The run deduplicates imported links and writes x-post cards, neither of which participates in the GitHub watchlist vertical. | n/a. |
| `CogneeClient`: login, multipart add, dataset routing, cognify | `packages/tooling/tool/cli/src/commands/Research/internal/CogneeClient.ts` | defer | This is a CLI-internal vendor client with credential defaults, live HTTP, source-type-derived datasets, and no evidence/lifecycle contract. Its fate depends on the technology ADR and a proven canonical domain API. See DFR-1. | No P1–P3 owner; potential later graph/search projection driver. |
| Cognify batching, pending-card stamping, and dataset orchestration | `packages/tooling/tool/cli/src/commands/Research/internal/Cognify.ts`; `packages/tooling/tool/cli/src/commands/Research/internal/Catalog.ts` | defer | It batches pending cards, launches background processing, then stamps all uploaded cards as cognified. That projection workflow cannot be evaluated until vendor choice and projection consistency semantics are decided. See DFR-1. | No P1–P3 owner; potential later projection use case over authoritative records. |
| `GraphitiEpisodes`: best-effort MCP event posting | `packages/tooling/tool/cli/src/commands/Research/internal/GraphitiEpisodes.ts` | defer | It opens an MCP session and posts an unverified textual pipeline event while suppressing all failures. It is neither authoritative provenance nor required observability, and graph-memory adoption is deferred. See DFR-2. | No P1–P3 owner; potential later telemetry or graph-projection adapter, never the authority store. |
| Digest queries and Markdown generation | `packages/tooling/tool/cli/src/commands/Research/internal/Digest.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.render.ts` | promote | Grouping new material and surfacing backlog are useful presentation ideas. The rewrite must render stable claim/evidence IDs, visible lifecycle, fixed-clock ordering, confidence/freshness/novelty, and grounded recommendations instead of card counts. | Target brief projection use case; Markdown output remains rebuildable. |
| Daily chained orchestration with per-step failure isolation | `packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.schemas.ts` | promote | Continuing independent steps and returning ran/skipped/failed outcomes is useful prior art for the required partial-failure contract. String-only failures and configuration-driven live steps are replaced by typed driver-neutral outcomes and deterministic fixtures. | Target use-cases workflow and typed operation result. |
| Optional vault Git staging and commit | `packages/tooling/tool/cli/src/commands/Research/internal/Daily.ts` | retire | Product execution must not stage or commit an external vault, and the first proof only writes deterministic evidence/projections through its declared command. | n/a. |
| Catalog status reporting | `packages/tooling/tool/cli/src/commands/Research/internal/Status.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.schemas.ts` | promote | Its decoded aggregate-query pattern and empty-store behavior are useful. Card/inbox/cognify metrics are replaced with proof-domain states and structured workflow telemetry. | Target typed status query at the use-cases tier; storage-specific aggregation stays in the adapter. |
| Research systemd installer (`Timers`) | `packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts`; `packages/tooling/tool/cli/src/commands/Research/Research.command.ts` | retire | It mutates the user unit directory, enables two timers immediately, captures repository and runtime paths, and optionally injects an environment file. This is unsafe as a foundation for a proof that expressly excludes scheduling. | n/a for P1–P3. A later operations adapter must be independently specified and tested. |
| AI-metrics typed install-plan timer step and render-only user-timer plan | `packages/tooling/library/ai-metrics/src/install.ts`; `packages/tooling/library/ai-metrics/src/forwarder.ts`; `packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts`; `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts`; `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Forwarder.ts`; `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Install.ts` | defer | This stronger pattern separates typed plan/doctor/dry-run contracts from a render-only timer plan and includes locking, retry, status, persistence, secret-reference resolution, and journal commands. It still emits host-mutation commands and scheduled collection is out of scope. See DFR-3. | No P1–P3 owner; candidate reference for a later project-intelligence scheduled-operation packet and runtime adapter. |

No row is marked **reuse**: every useful Research mechanism currently lives in
the tooling family with knowledge-card semantics, while the binding constraint
forbids product semantics in tooling or `drivers/*`. The AI-metrics mechanism
remains reusable in its own subsystem, but project intelligence does not consume
it as-is during P1–P3.

## Defer register

### DFR-1 — Cognee client and cognify projection

- **Rationale:** The technology ADR must first decide whether Cognee, another
  vendor, or the repo-native baseline is appropriate. The present input is a
  mutable card, not an authoritative claim/evidence stream
  (`packages/tooling/tool/cli/src/commands/Research/internal/CogneeClient.ts`;
  `packages/tooling/tool/cli/src/commands/Research/internal/Cognify.ts`).
- **Owner:** The project-intelligence packet owner until a graph/search
  projection follow-up packet is created.
- **Resolution trigger:** G2 selects a graph/search technology, P3 proves the
  canonical domain contract and rebuildability, and a concrete projection job
  is authorized.
- **Target phase or packet:** Post-P3 graph/search projection packet, named by
  the P5 roadmap.
- **Proof of non-dependence:** The first proof forbids graph/memory vendor
  adoption before the domain contract and forbids live network or LLM calls in
  tests; P1–P3 acceptance ends at authoritative records and the grounded daily
  Markdown brief (`goals/project-intelligence/SPEC.md`, Non-Goals, Constraints,
  and P1–P3 Acceptance Criteria).

### DFR-2 — Graphiti event episodes

- **Rationale:** Best-effort text episodes suppress failures and do not provide
  evidence-backed provenance or reliable telemetry
  (`packages/tooling/tool/cli/src/commands/Research/internal/GraphitiEpisodes.ts`).
- **Owner:** The project-intelligence packet owner until a telemetry or graph
  projection follow-up packet is created.
- **Resolution trigger:** P3 establishes authoritative provenance and
  observability contracts, and G2 or a later ADR selects a graph-memory
  projection with a typed failure policy.
- **Target phase or packet:** Post-P3 telemetry or graph-projection packet,
  named by the P5 roadmap.
- **Proof of non-dependence:** P1–P3 require structured Effect observability and
  deterministic authority/projection proof, not graph-memory event posting;
  vendor adoption is a first-proof non-goal
  (`goals/project-intelligence/SPEC.md`, Non-Goals, Constraints, and P1–P3
  Acceptance Criteria).

### DFR-3 — AI-metrics render-only timer pattern

- **Rationale:** Typed plans, doctor checks, dry-run-only apply, lock exclusion,
  retry, status evidence, secret references, and journal commands are stronger
  than the Research installer. Adopting any scheduler now would nevertheless
  violate the first-proof boundary
  (`packages/tooling/library/ai-metrics/src/install.ts`;
  `packages/tooling/library/ai-metrics/src/forwarder.ts`;
  `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts`).
- **Owner:** The project-intelligence packet owner until a scheduled-operation
  follow-up packet is created.
- **Resolution trigger:** P3 is green, the roadmap explicitly reopens scheduled
  operation, and deployment ownership and supported hosts are decided.
- **Target phase or packet:** Post-P3 scheduled-operation packet, named by the
  P5 roadmap.
- **Proof of non-dependence:** Scheduled and unattended operation is explicitly
  excluded from the first proof, and P1–P3 acceptance contains no timer or
  scheduler deliverable (`goals/project-intelligence/SPEC.md`, Non-Goals and
  P1–P3 Acceptance Criteria).

## Recon corrections

1. Recon describes Capture as producing an “immutable Markdown knowledge
   card.” Capture skips a URL already present in `research_seen_urls`, but the
   shared writer overwrites paths, `persistCards` writes before catalog updates,
   `UPSERT_CARD` updates existing rows, and repo cards may be force-rewritten.
   The prototype therefore demonstrates deduplication intent, not general
   snapshot immutability or atomic file/catalog persistence
   (`packages/tooling/tool/cli/src/commands/Research/internal/Capture.ts`;
   `packages/tooling/tool/cli/src/commands/Research/internal/Vault.ts`;
   `packages/tooling/tool/cli/src/commands/Research/internal/Catalog.ts`;
   `packages/tooling/tool/cli/src/commands/Research/internal/CatalogOps.ts`;
   `packages/tooling/tool/cli/src/commands/Research/internal/RepoCardRun.ts`).
2. Recon groups the AI-metrics path with the same user-timer “install pattern.”
   Research actually writes units and invokes `systemctl`; AI-metrics
   `forwarder timer` renders typed unit text and operator install commands, and
   its CLI `install apply` is dry-run-only. The latter is a planning/rendering
   reference, not a second in-process installer
   (`packages/tooling/tool/cli/src/commands/Research/internal/Timers.ts`;
   `packages/tooling/library/ai-metrics/src/forwarder.ts`;
   `packages/tooling/tool/cli/src/commands/AIMetrics/internal/Programs.ts`).
3. Digest defines its own wikilink helper even though the suite exports the same
   behavior from `Research.render`; this is duplicate formatting prior art, not
   a shared mechanism to promote
   (`packages/tooling/tool/cli/src/commands/Research/internal/Digest.ts`;
   `packages/tooling/tool/cli/src/commands/Research/Research.render.ts`).

## Gate decision

**Proposed G3 state: accepted.** On 2026-07-11, the nine executable tokens and
every enumerated Research internal mechanism were dispositioned with verified
repo evidence and replacement ownership; the second AI-metrics user-timer
mechanism was also inventoried. The three deferred mechanisms satisfy D8 with a
rationale, owner, trigger, target packet, and proof of no P1–P3 dependency, so
G3 is accepted on the evidence in
`goals/project-intelligence/research/prototype-disposition.md`.
