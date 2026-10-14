# Naming and identity survey (2026-10-14)

Prompted by the operator's challenge to the naming decision: does one
convention fit drivers, labs, web apps, and hosts that differ? Counts are
`rg` over non-test `*.ts`/`*.tsx` source on `explore/observability-palantiri`
(base `main` @ `8a03502995`).

## 1. Where the spans are

| Family (path) | Packages | Span sites |
| --- | --- | --- |
| `packages/tooling` (repo CLI, libraries) | 4 | **3,493** |
| `packages/drivers` | 52 | 538 |
| `packages/foundation` | 7 kinds | 251 |
| `packages/law-practice` | 4 | 173 |
| `packages/ontology`, `epistemic`, `documents`, `architecture-lab`, `agents`, `workspace` (slices) | 4–7 each | 24–63 each |
| `packages/shared`, `ecosystem`, `_internal` | — | 0–1 |
| `apps/labs/*` | — | 205 |
| `apps/professional-desktop` (Tauri + sidecar + webview) | — | 58 |
| `apps/practice-*`, `docket-intake` (incl. `practice-kg-mcp` 17) | — | 6–20 each |
| `apps/oip-web` / `apps/todox` (Next.js on Vercel) | — | 8 / 0 |

About 80% of all span sites are in the repo CLI. Its emissions come from
whatever host runs it: dankstation, CI runners, vendor cloud VMs, lanes.

## 2. Name forms per family

| Family | `Pascal.camel` | `Pascal.x.y` | `lower.dotted` | no namespace | other |
| --- | --- | --- | --- | --- | --- |
| tooling | 3,115 | 286 | 9 | 83 | — |
| drivers | 381 | 81 | 7 | 3 | 66 |
| foundation | 200 | 13 | 4 | 34 | — |
| law-practice | 149 | 4 | 7 | — | 13 |
| ontology | 3 | 39 | 2 | 17 | 2 |
| epistemic | 10 | 26 | 15 | — | — |
| labs | 185 | 1 | 11 | 4 | 4 |
| professional-desktop | 12 | 5 | 36 | 2 | 3 |
| practice-kg-mcp, oip-web | all | — | — | — | — |

- **Interpolated names: 19 sites.** Examples: `` `box.${methodName}` ``
  (`packages/drivers/box/src/Box.streaming.ts:884`),
  `` `firecrawl.${method}` ``
  (`packages/drivers/firecrawl/src/Firecrawl.service.ts:341`),
  `` `documents.sync.${operation}` ``
  (`apps/professional-desktop/src/sync/VaultSyncOrchestrator.ts:43`).
- **Names shared by more than one package: only 4.** They are
  `DockSnapshotStore.save`, `LocalDateFromString.decode`,
  `SparqlQueryService.execute`, and `db.query`. `db.query` appears in duckdb,
  epistemic and a lab, and is the doctrine's adapter span. So names are
  nearly unique repo-wide already; uniqueness can be enforced rather than
  carried on every span.
- The `<slice>.<concept>.<action>` doctrine fits the slices (ontology and
  epistemic are mostly `Pascal.x.y` / `lower.dotted`). It does not fit
  drivers, tooling, labs, or apps, which have no slice. That is why practice
  went to `Concept.action`.

## 3. Metric names today

- 63 `Metric.*` sites, all counters. The names are Prometheus-style
  snake_case with a hand-written `_total`, e.g.
  `desktop_intake_operations_started_total`, `…_completed_total`,
  `…_failed_total`, `…_interrupted_total`.
- **Outcome is encoded in the name**, not in an attribute. This makes a
  single counter with an `outcome` attribute (`started | completed | failed
  | interrupted`) into four series families. It also hand-writes the suffix
  that the Prometheus exporter adds itself.
- 223 `Effect.log*` call sites. None carries an event name; message text is
  the only identity.

## 4. Emitter contexts (hosts differ)

| Context | Examples | Runtime | Stable host identity? | Can reach the hub? | Who can vouch for identity |
| --- | --- | --- | --- | --- | --- |
| Operator workstation | dankstation | bun CLI, dev servers, Storybook, Tauri desktop, harnesses, stdio MCP servers | yes (MagicDNS) | tailnet | gateway `whois` |
| Worker / server | beep-worker, dankserver, grok-bot-box-1 | bun/node services, timers, containers | yes | tailnet | gateway `whois` + tag |
| Strict desktop | tom-pc-1 | compiled bun binary under Claude Desktop (stdio) | yes, but must not self-describe | tailnet, intermittently | gateway `whois` only; nothing self-claimed |
| CI runner | GitHub Actions | bun CLI, Turbo, Vitest | no (ephemeral) | only if it joins the tailnet (OIDC) | `cicd.*` + GitHub OIDC |
| Vendor cloud VM | Claude/Codex/Cursor cloud sessions | bun CLI, harness | no | no tailnet today | none (self-claimed only) |
| Serverless | Vercel functions for oip-web, todox | Node (and possibly Edge) | no | public HTTPS only (D9: not now) | Vercel project + deployment id |
| Browser | oip.law, todox.ai, desktop webview, agents client | browser JS | no | CORS-pinned gateway, public | none (any token is public) |
| Gated host | tbk-ubuntu | — | — | excluded | — |

Consequences:

- `host.name` exists only for tailnet hosts. CI, serverless, browser and
  cloud-VM records need different identity fields, from OTel semconv:
  `cicd.pipeline.run.id`, `vcs.ref.head.revision`, `cloud.provider`,
  `faas.name`, `deployment.environment.name`, `browser.*`.
- Only the gateway can **vouch** for identity, and only for tailnet senders.
  Everything else is self-claimed. A trust field belongs in the record, not
  just a value.
- The four stdio MCP drivers (`gov-legal-mcp`, `m365-mcp`, `nlp-mcp`,
  `uspto-mcp`) and `practice-kg-mcp` run as Claude children. `OTEL_*` is
  stripped there, so their resource identity must come from their own
  config.
