# Recon Findings (2026-07-11)

Distilled, sanitized output of the read-only reconnaissance workflow
wf_24cbd840-0ff (four sweep agents + a completeness critic) plus the grilled
design session that produced SPEC decisions D1–D7. Evidence is cited as
repo-relative paths; spot-check before relying on volatile details.

## Provenance & freshness

- Inspected tree: `main` @ `53f5bb53a2` (2026-07-11). All positive and
  negative claims below are relative to that commit.
- The negative inventory (section C) is reproducible. **Freshness re-check
  commands** — run these at P0 start and record the result in
  `recon-report.md`; a full resurvey is needed only if they show material
  drift:

```sh
ls packages/drivers
rg -il "octokit|api[.]github[.]com" packages/drivers
rg -il "watchlist" packages apps
rg -il "daily.?brief" packages apps
rg -il "\b(cron|scheduler|systemd)\b" packages --glob '**/src/**'
rg -il "mem0|pgvector" packages
ls goals explorations
```

  Expected (verified by executing these exact commands at `53f5bb53a2`) —
  treat DEVIATIONS from these recorded baselines as drift, not the
  baselines themselves:
  - drivers listing has no github entry; the drivers-scoped octokit/API
    probe is empty (exit 1); watchlist and daily-brief probes are empty
    (exit 1);
  - scheduler probe: 11 hits, ALL under `packages/tooling/**` (Research
    command + `internal/Timers.ts`; Graphiti proxy `schemas`/`config`/
    `StackRestore`/`ProxyServiceInstall`; AIMetrics command + `Programs`;
    ai-metrics library `install`/`forwarder`/`source-discovery`). Any hit
    OUTSIDE `packages/tooling/**` is drift — that would mean slice/runtime
    scheduling infrastructure appeared. Note: bare "timer" is deliberately
    NOT probed (UI debounce timers and metric timers are expected noise);
  - `mem0|pgvector`: exactly one known baseline hit,
    `packages/tooling/tool/cli/src/commands/VersionSync/internal/resolvers/DockerResolver.ts`
    (a Docker image resolver, not a vector-store integration); no mem0
    integration anywhere;
  - no goals/explorations packet covering research-intelligence besides
    this one.

  Scope note: these commands mechanically cover the load-bearing negatives
  (GitHub driver, watchlist/daily-brief naming, scheduling, mem0/vector
  store). The remaining Section C negatives (license-policy surface,
  security implementations, packaged Cognee/Graphiti drivers) were verified
  by the recon agents at the inspected commit but are NOT mechanically
  re-checked here — spot-check them during P0 before relying on them.

## A. Packet mechanics (why this packet is shaped the way it is)

- Packet standard, file roles, launcher rule (≤4000 chars, target 3500),
  lifecycle vocabulary, completion gate, and New Packet Checklist:
  `goals/README.md`. Template: `goals/_template/` (10 files).
- `bun run beep goals` (doctor / index / set-status): at the inspected
  commit this did not exist (goals-doctor's unbuilt deliverable).
  **Superseded 2026-07-11**: goals-doctor shipped (PR #373) — `beep goals
  doctor` and `beep goals index --check` now gate the repo lint lane, and
  `goals/INDEX.md` must be regenerated (`index --write`) in the same PR as
  any manifest change. The reflection lint
  (`packages/tooling/tool/cli/src/commands/Lint/ReflectionArtifact.ts`)
  still enforces only packets whose status is in
  `["completed-retained","complete","completed","v1-closed"]` — a no-op for
  a new `active` packet.
- Direct authoring (no exploration packet) has precedent:
  `goals/goals-doctor` (`provenance.authoredDirectly: true`) and
  `goals/legal-document-intake` (grilled design session, 2026-07-08). ~40
  packets carry no exploration provenance.
- Per-phase `exit` oracle strings: `goals/goals-doctor/ops/manifest.json`.
  `dependencies[]` array and multi-PR completion-gate sentence:
  `goals/legal-document-intake/ops/manifest.json`.
- No surface outside `goals/` references packet slugs (verified against the
  `ontology-agent-surface` landing) — creating a packet requires no index,
  docgen, or lint updates elsewhere.

## B. Prior art and reuse map

- **`beep research` CLI prototype** —
  `packages/tooling/tool/cli/src/commands/Research/` (nine executable CLI
  tokens: `capture`, `cognify`, `daily`, `digest`, `history-sift`,
  `install-timers`, `notion-pull`, `repo-card`, `status` — handler/service
  identifiers like captureUrl/historySift differ from the CLI tokens). A
  working discover→ingest→snapshot→dedup→brief loop:
  - `internal/Capture.ts`: Firecrawl scrape → immutable Markdown knowledge
    card with YAML frontmatter (id, url, sourceType, capturedAt, status,
    tags, contentHash).
  - `internal/Vault.ts`: git-committed, env-configurable local vault;
    `sha256HexOf` + `normalizeUrl` (strips tracking params, sorts query) +
    `slugFor` dedup helpers.
  - `internal/Catalog.ts`: DuckDB catalog (`research_seen_urls`,
    `research_cards`, `research_capture_log`) via `@beep/duckdb`.
  - `internal/Digest.ts`: daily Markdown digest from the catalog;
    `internal/Daily.ts`: chained pipeline with per-step failure isolation.
  - `internal/RepoCards.ts`: GitHub starred-repo cards via `gh` CLI
    shell-out (no typed driver).
  - `internal/CogneeClient.ts`, `internal/GraphitiEpisodes.ts`: HTTP clients
    for graph-memory engines (CLI-internal, not `@beep/*` drivers).
  - `internal/Timers.ts` (`install-timers`): **systemd user-timer
    installation** — renders and enables service+timer unit pairs so the
    daily pipeline runs daily and repo cards refresh weekly, with secrets
    from an optional EnvironmentFile. The prototype therefore already has
    scheduled unattended operation at the tooling level. A second
    tooling-level timer mechanism exists in AI-metrics
    (`packages/tooling/library/ai-metrics/src/install.ts`,
    `packages/tooling/tool/cli/src/commands/AIMetrics/`) following the same
    systemd user-timer install pattern — inventory both in G3/G1 before
    designing any scheduling.
  - `internal/BrowserHistory.ts` (historySift's engine), `CatalogOps.ts`,
    `Status.ts`, and the NotionPull/RepoCard run modules round out the
    internal mechanism inventory.
  Limitations: tooling-family internals, no schema-first domain, no slice
  boundaries, shell-outs, vault outside the repo. Gate G3 decides
  promote/reuse/retire/defer per mechanism (defer only under the SPEC D8
  controlled-defer rules).
- **Epistemic slice** — `packages/epistemic/{domain,use-cases,tables,server}`:
  CandidateClaim (lifecycle + snapshot keyed by stable EpistemicFixtureKey),
  Evidence (char-offset EvidenceSpan: startChar/endChar/quote/confidence),
  ClaimLifecycle (vocabulary promoted to `@beep/shared-domain` 2026-06-18),
  ClaimGate (SHACL over `@beep/semantic-web`), ClaimProjection (pure
  read-only fold — the projections-are-rebuildable invariant in code).
  Gaps: no Snapshot/Observation/Contradiction/Assessment concepts;
  `epistemic/tables` persists only UsageRecord (claims/evidence are
  fixture-driven, not DB-backed).
- **Substrate bricks**: `@beep/provenance` TextAnchor
  (`packages/foundation/modeling/provenance`), `@beep/schema` UnitInterval,
  `@beep/md` `renderMarkdownBlocks` (`packages/foundation/modeling/md`) —
  the daily brief need not hand-roll Markdown.
- **Patterns**: deterministic fixture catalog
  (`goals/agentic-professional-runtime/fixtures/runtime-data-loop/*`:
  seed.json / input.*.json / expected.*.json — gate G5); snapshot + drift +
  report-backed PR (`goals/official-data-sync-foundation`,
  `packages/tooling/tool/cli/src/commands/SyncDataToTs/`); change-monitor
  shape (`@beep/firecrawl` Monitor/Watcher,
  `packages/drivers/firecrawl/src/Firecrawl.service.ts`); HTTP driver triad
  template (`packages/drivers/{courtlistener,govinfo,federal-register,ecfr,dol,uspto,pacer}`).
- **Slice inventory** (families under `packages/`): agents,
  architecture-lab, documents, drivers (~40), epistemic, foundation,
  _internal, law-practice, ontology, shared, tooling, workspace. No
  knowledge/knowledge-graph slice exists.

## C. Net-new (verified absent)

- No GitHub API Effect driver (none of the drivers integrate the GitHub API;
  only `gh` CLI shell-outs in the Research command).
- No watchlist or daily-brief code anywhere (grep: zero code hits; concepts
  are net-new naming).
- No general-purpose in-repo scheduler/job infrastructure and no unattended
  worker app (apps/ = oip-web, professional-desktop, storybook,
  architecture-lab-proof). **Correction (adversarial review round 2):** the
  `beep research` prototype DOES ship scheduled operation as tooling —
  `install-timers` installs systemd user timers for the daily pipeline and
  weekly repo-card refresh (`internal/Timers.ts`). Its disposition is part of
  gate G3; the roadmap's scheduled-unattended-operation stage remains net-new
  at the slice/runtime level.
- No vector/embedding store; no mem0 integration; no packaged Cognee/Graphiti
  drivers (HTTP clients are CLI-internal).
- No dependency/third-party license-compliance policy surface (repo is
  Apache-2.0; osv-scanner covers vulnerabilities only) — relevant to the
  brief's license/attribution requirements.
- Untrusted-ingestion security is split by capability (corrected in
  adversarial round 5): the prompt-injection detector, secret/PII scrub,
  and GuardedHttpClient exist only as active-unshipped exploration doctrine
  (`explorations/ingestion-security-secret-governance`, 8 open questions) —
  D7: cite as baseline, scope to the proof. However, **SSRF-safe host
  validation is SHIPPED prior art**: `@beep/schema` `SafeRemoteHost`
  (`packages/foundation/modeling/schema/src/SafeRemoteHost.ts`) with live
  driver consumers (`packages/drivers/box/src/Box.streaming.ts`,
  `packages/drivers/nlp-mcp/src/Streaming/DatasetLoader.ts`). The P0 threat
  model must assess reusing it (including known limitations such as
  DNS-rebinding residual risk) rather than rebuilding SSRF machinery.

## D. Doctrine constraints (binding on P0+ design)

- `standards/architecture/DECISIONS.md` 2026-06-18 **Cross-Slice Consumption
  Of The Epistemic Boundary** — the governing decision for reusing
  claim/evidence/provenance from a second vertical: substrate →
  `foundation/modeling`; product vocabulary → `shared/domain` with a README
  promotion record; mechanism + live Layers stay in the epistemic slice,
  composed at the consumer's use-cases/server tier under a documented bounded
  exception (packet Exception Ledger) until a third consumer justifies a
  `shared/use-cases` contract or an emitted event.
- Smallest legal slice = domain + use-cases + server (~15 files):
  `standards/architecture/13-onboarding-the-minimum-viable-slice.md`. Slice
  domain imports only shared-kernel + foundation primitive/modeling.
  Slice-to-slice direct imports are forbidden.
- New slices default through the `bun run beep architecture` operation-plan
  factory (`create slice`, `--domain-kind aggregates|entities|values`,
  `--stage core|persistence|protocol|client|full`, plan/apply/check) —
  Generated Default lane, not a hard check. Canonical executable proof:
  `packages/architecture-lab` + `apps/architecture-lab-proof`
  (`packages/fixture-lab/specimen` is retired, 2026-05-12).
- `shared/use-cases` does not exist yet (reserved, contract-only when it
  lands); `shared/domain` and `shared/tables` are the only real shared
  packages. Promotion is a Review Gate via package README promotion records
  (lint enforcement not implemented).
- Boundary error doctrine: driver/internal failures die in adapters, port
  failures in use-case orchestration, action failures in protocol handlers;
  public use-case errors are action-level only (2026-05-01).
- Deterministic-proof template: `apps/architecture-lab-proof/test/` — scoped
  live Layer, exact `S.encodeSync` assertions, `S.toArbitrary` round-trip.

## Unresolved (carried into P0)

- Whether any `@beep/*` runtime beyond the CLI consumes
  ClaimGate/ClaimProjection end to end; location of the fixture corpus that
  EpistemicFixtureKey implies.
- Firecrawl Monitor/Watcher runtime wiring (surface confirmed; no in-repo
  consumer traced).
- Exact Cognee/Graphiti client API surfaces (confirmed HTTP-client shape
  only) — needed for the G2 ADR.
- How sources enter the watchlist (gate G6 — no discovery precedent).
- law-practice and ontology slices were not deep-read; they may overlap
  claim/evidence extraction for later stages.
