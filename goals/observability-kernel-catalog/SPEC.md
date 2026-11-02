# Observability Kernel and Instrumentation Catalog Spec

## Objective

Fix @beep/observability defects, split kernel from server wiring, and ship the instrumentation catalog (names, metrics, events, beep.* v2 registry, EmitterContext, TelemetryTier).

## Non-Goals

- Any spend: SaaS backends, Vercel drains, Grafana Cloud above free, Tailscale paid tiers (exploration D9).
- Choosing the logs/traces store; that waits for the hub gate (D1).
- Mutating dankserver, the tailnet policy, `tom-pc-1` or any host directly; ship exact commands as proposals the operator applies.
- `tbk-ubuntu` and its security-sensitive VM (gated host; never instrumented).
- Developer-AI analytics (`@beep/repo-ai-metrics`), cache policy (`goals/turborepo-cache-trust-observability`) and CI step forensics (`goals/ci-step-watchdog`) — consume, never absorb.
- Dashboards hand-built in the Grafana UI or copied from the existing generated ones.

## Source Hierarchy

1. The graduating exploration: [`explorations/observability-palantiri`](../../explorations/observability-palantiri/) — `BRIEF.md`, `MAP.md`, `DECISIONS.md` (back-links, not copies).
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/foundation/capability/observability` (kernel/`server` split)
- catalog + attribute registry home (kernel subpath; decide placement per `07-non-slice-families.md`)
- `standards/architecture/12-observability.md` (regenerated from the catalog)
- `apps/professional-desktop` sidecar wiring and the 63 existing `Metric.*` sites
- root `package.json`/catalog for the `effect` bump

## Constraints

- Fix all five defects from `explorations/observability-palantiri/research/in-repo-inventory.md` §1 and `RESEARCH.md`: DevTools/OTLP sibling merge, DevTools start-only spans, `Logger.layer` dropping `tracerLogger`, `layerConsoleLogger` dual-signature type, exporter pinning its own serializer.
- The catalog is a schema: every span/metric/event/attribute declared once with kind, owning package, allowed attributes, unit, lowest tier; doctrine page, lint and allowlists are generated from it.
- Six naming axes and the families-and-hosts amendment in `explorations/observability-palantiri/DECISIONS.md` are normative: context-free `Concept.action`, globally unique; semconv for protocol spans; `beep.<area>.<noun>` metrics with units and exporter-added suffixes; closed event names; Weaver-style attribute registry; static names.
- `beep.*` v2 lives in the registry with metric-safe vs span-only sets; `beep.model_role` and `beep.privacy_tier` (no bare `beep.tier`).
- `EmitterContext` tagged union (`Workstation | Server | StrictDesktop | CiRunner | CloudVm | Serverless | Browser`) with per-variant semconv fields, tier ceiling and `beep.identity_source`.
- `TelemetryTier` LiteralKit `shape-only | standard | dev-verbose`; untagged or unresolvable resolves to `shape-only`.
- Effect bump to ≥ 4.0.3 via the repo's update policy (pkg.pr.new snapshot, never the rc).
- Schema → `Context.Service` contract → implementation; Effect v4 only, validated against `.repos/effect`; `effect/<Module>` imports; `HashMap`/`HashSet`; `Effect.fn`/`fnUntraced`.
- Names, metrics, events and attribute keys come from the instrumentation catalog (`goals/observability-kernel-catalog`); names are static literals, never interpolated.
- Public repo: no client data, tokens, `op://` resolutions, LAN IPs, tailnet suffixes or account identifiers in packet or code.
- Totals use `increase()` over the panel range; per-process identity never becomes a metric label; promoted labels come only from the registry's metric-safe set.

## Acceptance Criteria

- [x] The five defects are fixed with regression tests (OTLP traces reach a capture sink with DevTools on; DevTools spans end; `tracerLogger` retained where intended; `layerConsoleLogger` returns a Layer).
- [x] Kernel and `/server` wiring are separate entry points; existing consumers compile unchanged or are migrated in the same PR.
- [x] The catalog schema, attribute registry (`beep.*` v2) , `EmitterContext` and `TelemetryTier` exist with decode tests; a lint fails on duplicate or interpolated span names (the 4 collisions and 19 interpolated sites are fixed).
- [x] `beep.package`/`beep.family` enrichment derives from the catalog's name→package map.
- [x] `12-observability.md` is regenerated from the catalog.
- [x] The outcome-in-name counters (e.g. `desktop_*_{started,completed,failed,interrupted}_total`) become single instruments with an `outcome` attribute.
- [x] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/observability-kernel-catalog/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/observability-kernel-catalog/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/observability-kernel-catalog` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | Inherit exploration decisions D1–D9 and the align/agent-decided entries in `explorations/observability-palantiri/DECISIONS.md`. | Graduated from `explorations/observability-palantiri`. | Reopen the exploration at `decompose`. |
| 2026-10-14 | P0: the catalog mechanism (instrument declaration schema, `AttributeKey` with type, allowed signals, cardinality class and lowest tier; `TelemetryTier`; `EmitterContext`; generic keys `beep.package`, `beep.family`, `beep.privacy_tier`, `beep.identity_source`) lives in the `@beep/observability` kernel as a new subpath. The agent-attribution key set (`beep.harness`, `beep.provider`, `beep.provider_account`, `beep.route`, `beep.model_role`, `beep.emitter`, `beep.lane`, `beep.session`) is a registry instance owned by `@beep/repo-ai-metrics`, the home `goals/harness-otel-adoption` planned for the contract. | `07-non-slice-families.md` routes runtime substrate to capability; `goals/ai-metrics-stack` forbids developer-AI semantics in `@beep/observability`. One mechanism, two owners of key sets. | Move the agent key set into the kernel and drop the ai-metrics instance. |
| 2026-10-14 | P0: the effect bump targets the published stable `4.0.4` (npm lists 4.0.3 and 4.0.4; the repo pins stable `4.0.2` since the 4.0 release, not a pkg.pr.new snapshot) in P3, all `effect`/`@effect/*` catalog entries together; coordinate with the orchestrator first in case a deps lane is already moving them. | 4.0.3 histogram fixes matter once histograms land; #9066 only affects HTTP server spans. | Revert the catalog bump. |
| 2026-10-14 | P0: ship as three PRs. PR 1 = P1 defects + the `OtlpSerialization` seam. PR 2 = P2 catalog, registry, lint, metric/name migrations. PR 3 = the effect bump alone (orchestrator conditions, 2026-10-14): catalog-only, never folded into a feature PR; stable releases only (no rc; pkg.pr.new snapshot only if a needed fix is unreleased); merge `main` immediately before its single push; report `final <sha40> #<pr>` with the bump in the PR title so the rsc B and tsgo-brand lanes merge `main` once after it lands. No other lane owns an Effect bump (last was #1482 to 4.0.1). | The defect fixes are independently valuable and unblock the strict-tier seam; the catalog is a larger review; a dependency bump moves every manifest and must not ride a feature PR. | Fold PRs together. |
| 2026-10-14 | P2 operator rulings: span names are harvested and checked (a generator writes the catalog, per-package shards under `standards/instrumentation-catalog/` since the 2026-10-15 row below; hand declarations only for extra attributes or tier overrides), and declarations live in per-package `*.instruments.ts` files merged by `beep observability catalog`. Design: `research/catalog-design.md`. | Declaring ~5,000 existing spans by hand is churn without signal; ownership stays with the code. | Switch to hand-declared spans and a central registry. |
| 2026-10-14 | P2 implementation calls: `SpanInstrument` carries `family`; a declared span replaces the harvested span with the same owner and name, a same-name span from another owner is a duplicate; the tier ordering stays internal; unit/`_total` suffixes are rejected from a fixed list (`_total`, `_seconds`, `_milliseconds`, `_ms`, `_bytes`, `_ratio`, `_percent`). | Needed by `packageOf` and the override rule; the effect lint rejects exporting the ordering. | Edit the catalog models. |
| 2026-10-14 | P2: harvested names that miss the `SpanName` pattern are recorded `conforming: false` (517 today) and the 146 non-literal span-name sites are reported, not failed; the check fails only on drift, conflicts and cross-package duplicates. The interpolated driver/desktop sites the survey listed were made static. | Making the check fail on every non-literal site would need a codemod the operator ruled out; reporting keeps the inventory visible. | Flip non-literal names to a failure in `Observability.service.ts`. |
| 2026-10-14 | P2b: `layerCatalogEnrichment` wraps the current tracer and stamps `beep.package`/`beep.family` (span-name index built once per layer, first owner wins like `packageOf`), `beep.privacy_tier` (= `effectiveTier`) and `beep.identity_source`. The wrapper owns those four keys at every tier; under `shape-only` it drops non-allowlisted attributes and all span events. Each refusal increments `beep.telemetry.refused` with `beep.schema_failure_tag` = `attribute-not-allowed`, `stamped-key-override` or `span-event-dropped`. Design: `research/p2b-design.md`. | Without the ownership rule a call site could relabel a shape-only span; shape-only spans carry no events per the exploration. The strict-tier serializer gate stays the authoritative fence. | Remove the layer; the stamps are additive. |
| 2026-10-14 | P2b: `@beep/repo-ai-metrics` takes a workspace dependency on `@beep/observability` for its `AiMetrics.instruments.ts` declarations, and the reviewed cache baseline is re-recorded for that subject only (`research/cache-baseline-review-ai-metrics-catalog.md`). | The catalog schemas live in the kernel; the dependency points from the AI owner to the kernel, never back. | Drop the dependency and the declaration file, then re-record the baseline. |
| 2026-10-14 | Close: P3 is satisfied by PR 2 (#1762: outcome-attribute counter migration, span-name fixes) and PR 3 (#1796: effect 4.0.4); the remaining 518 non-conforming harvested names and 147 non-literal sites stay reported inventory, not goal debt (P2 decision above). The `name`→`instrumentName` catalog-error rename ships separately from TS7 (#1807). | Each acceptance criterion maps to merged evidence; the inventory is visible through `beep observability catalog`. | Reopen the packet with a migration phase. |
| 2026-10-15 | Shard the committed catalog by owning package: `beep observability catalog --write` writes `standards/instrumentation-catalog/<package>.generated.jsonc` (schema `InstrumentationCatalogShard`, `instrumentation-catalog-shard/v1`) and deletes orphaned shards and the retired monolith; `--check` reports them as `orphaned`. The standard's generated section drops the per-family count table and the declared totals; the command prints those counts instead. The shard directory is the index; the whole document is only assembled in memory. Chose shards (a) over a `.gitattributes` regenerate driver (b), because GitHub computes `mergeable` server-side and ignores local merge drivers, so PRs would stay DIRTY; and over not committing the aggregate (c), because the committed per-package diff is how a reviewer sees which spans a PR introduces and (c) needs a writer on `PR-only` main. | Orchestrator measurement 2026-10-15: nearly every PR regenerated the monolith and the count table, so each merge made other open PRs DIRTY (6 events after 04:00Z; #1590 re-finalled four times). Totals change with every span; per-package shards change only in the packages a PR touches, so two PRs adding spans in different packages edit disjoint files. Two PRs adding spans to the same package still merge line by line unless their sorted entries touch. | Restore `INSTRUMENTATION_CATALOG_PATH`, `renderCatalogText(document)` and `renderStandardSection(document)` in `Observability.render.ts`/`Observability.service.ts` from the commit before this change, delete `standards/instrumentation-catalog/`, put `!standards/instrumentation-catalog.generated.jsonc` back in `biome.jsonc` (then `bun run beep cache profile --write`), and run `bun run beep observability catalog --write`. |
| 2026-11-02 | Regenerate the sharded catalogs before the push. `lefthook.yml` gains `schema-catalog` and `instrumentation-catalog` pre-commit hooks that run `bun run beep lint schema-catalog --write --stage <staged paths>` and `bun run beep observability catalog --write --stage <staged paths>`: both writers accept source paths, resolve their owning packages (`internal/cli/ShardScope`), scan only those packages' sources, rewrite or remove only their shards, and `git add` them (retrying while another hook holds `index.lock`). A scoped run skips orphan retirement and the standard's generated section (`standard: "skipped"`), which only the full scan covers; `lint:schema-catalog` and `observability:catalog-check` stay in the cheap-gates tier (`githubCheckCheapGateLanes`) and hosted Repo Sanity remains the proof. | Three `main` reds on 2026-11-02 came from merged PRs that never regenerated a shard: `standards/schema-catalog/@beep/git.generated.jsonc` (#2522, fixed by #2530) and `standards/instrumentation-catalog/@beep/repo-cli.generated.jsonc` twice (#2526 → #2545, #2540 → #2547). Both checks run hosted-only in Repo Sanity and in the local cheap gates, but those PRs pushed with package-scoped checks (constrained-compute rule), so the drift surfaced after the S11 merge had carried it to `main` and cost an unblocker PR each time. A commit-time, path-scoped regeneration (seconds, not the 36 s full schema scan) closes the gap for every publish path, and shard text never mixes packages, so independent regenerations on two branches stay byte-identical. | Delete the two hook entries from `lefthook.yml`; the `paths`/`--stage` surfaces of both writers are additive and may stay. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
