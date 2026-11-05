# Alchemy Vault-Sync Slice — Sources & Provenance

- **Source exploration:** `explorations/alchemy-domain-adoption` — primary ledger: `explorations/alchemy-domain-adoption/research/SOURCES.md` (this file is the carried copy at graduation, 2026-11-05).

- **Cluster / origin:** operator capture 2026-11-03 (`explorations/alchemy-domain-adoption/CAPTURE.md`) plus three research lanes run 2026-11-03 from the headless proxy: `gpt-6-astra` medium (source analysis of the alchemy checkout and the beep domain packages), `muse-wonder-1.0` xhigh deep-research, `grok-4.7` xhigh deep-research with native x_search. Prompts, briefs and logs: `~/.cache/beep/alchemy-domain-research/`.
- **Provenance:** `explorations/alchemy-domain-adoption/research/01-astra-source-analysis.md`, `explorations/alchemy-domain-adoption/research/02-muse-deep-research.md`, `explorations/alchemy-domain-adoption/research/03-grok-deep-research.md`; `/teach` lesson workspace `~/YeeBois/teach/local-first-sync/` (R1–R9 in its `RESOURCES.md`).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| `alchemy-domain` | `@alchemy.run/domain` 2.0.0-beta.85 source | alchemy-run/alchemy | `~/YeeBois/references/effect/alchemy/packages/domain/src/` (also `.repos/alchemy`) | kernel: decide/evolve, envelopes, CatchUp, Backfill, Platform contract, InMemory + Cloudflare DO platforms, Saga on `effect/workflow` | port-with-attribution (Platform contract shape); reference for everything else, consumed as a dependency |
| `alchemy-docs` | alchemy.run/domain docs (model, event, view-security, testing-models, testing-apis, local-first, optimistic-updates, mcp, sessions, deadlines, unique, http, cli, observability) | alchemy-run/alchemy (docs) | https://alchemy.run/domain/* | public contract and intended usage | reference |
| `beep-entity-kit` | hand-rolled entity kit being retired | this repo | `packages/shared/domain/src/entity/*` (AuditEntity, BaseEntity, EntityId, EntityKit, EntityRef, OrgEntity, PublicEntityId, Principal, SourceKind, primitives) | semantics to preserve as explicit schemas (D3) | extract semantics, delete kit |
| `beep-domain-slices` | the nine `@beep/<slice>-domain` packages | this repo | `packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,party,shared,workspace}/domain` | migration targets; 115 files import `@beep/shared-domain` | migrate (vault-sync first, D5) |
| `effect-cluster` | `ClusterWorkflowEngine`, `SqlMessageStorage` | Effect-TS/effect (v4) | `.repos/effect/packages/effect/src/cluster/` | durable Saga backing (D6) | reuse as dependency |

**How these inform this packet:** the Platform contract (`alchemy-domain`) fixes what the Postgres driver must implement (Astra §1); the kit (`beep-entity-kit`) fixes which semantics must survive as value/event schemas (Astra §2); Cluster is the Saga runtime (D6).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| alchemy-run/alchemy | Apache-2.0 (`LICENSE` in checkout) | port-with-attribution | Platform contract shape and InMemory driver structure as the model for the Postgres driver; the package itself is a dependency |
| Effect-TS/effect | MIT | dependency | `effect/cluster` workflow engine + SQL message storage |
| rocicorp/zero, Replicache | docs only | reference-only | topology 3 (local replica + rebase) shape, for the deferred comparison in D8 |

## 3. External research sources

Alchemy project state (Grok lane, `03-grok-deep-research.md`):
- https://alchemy.run/blog/2026-11-01-beta-85/ — beta.85 release notes (breaking migration from beta.84)
- https://alchemy.run/what-is-alchemy
- https://registry.npmjs.org/@alchemy.run%2Fdomain , https://registry.npmjs.org/alchemy , https://registry.npmjs.org/@alchemy.run%2fcloudflare — release cadence (84 betas in 203 days)
- https://github.com/alchemy-run/alchemy/pull/2392 , /pull/2601 , /pull/2721 , /pull/2794 , /pull/2795 — Postgres / storage contributor PRs (unreviewed as of 2026-11-03)
- https://github.com/alchemy-run/alchemy/issues/2552 , /issues/2727 , /issues/2755 , /issues/2804 , /issues/2877 , /issues/2904 , /issues/2905 , /issues/2906 , /issues/2907 , /issues/2937 , /issues/2939 — source-level bugs filed by power users
- https://github.com/michielryvers/retro (incl. `patches/domain-internal-export.patch`), https://github.com/MapleTechLabs/maple , https://github.com/MapleTechLabs/hazel — the identified adopters
- https://charpeni.com/blog/domain-driven-design-with-alchemy-domain-and-effect — third-party walkthrough
- https://x.com/samgoodwin89/status/2114757394140106862 , /2115564814835794085 , /2115658608138707022 ; https://x.com/rough__sea/status/2117203120345600338 ; operator posts https://x.com/elpresidank/status/2114778183642108096 , /2117371413490921563
- X post 2117367781444444417 (Sam Goodwin, event replay as a fan-out workflow over Durable Objects) — screenshot captured in `CAPTURE.md` 2026-11-03; shows Backfill is Cloudflare-shaped upstream

Event sourcing on Postgres and migration (Muse and Astra lanes):
- https://kurrentdb.kurrent.io/blog/a-recipe-for-gradually-migrating-from-crud-to-event-sourcing/ — single-writer cutover (D7)
- https://martendb.io/events/storage.html , https://martendb.io/events/projections/ — Marten's Postgres event store and projection design (prior art for the Postgres Platform, D1)
- https://sandgraal.github.io/letstalkcdc/transactional-outbox/ , https://reliableuptime.com/blog/postgres-skip-locked-job-scheduling , https://www.citusdata.com/blog/2023/10/26/making-postgres-tick-new-features-in-pg-cron — outbox, `SKIP LOCKED`, pg_cron
- https://mdjnewman.me/2018/01/vetted-importing-data/ — genesis import of legacy rows
- https://martinfowler.com/bliki/StranglerFigApplication.html — strangler (D3)
- https://learn.microsoft.com/azure/architecture/patterns/event-sourcing
- https://registry.npmjs.org/@effect%2fcluster , https://registry.npmjs.org/effect , https://github.com/Effect-TS/effect/pull/8354 — Cluster/workflow in Effect v4 and the module path move
- Alternatives surveyed and rejected: https://registry.npmjs.org/@gjermundgaraba%2feffect-domain , https://registry.npmjs.org/effect-es , https://registry.npmjs.org/@event-driven-io%2femmett-sqlite/0.43.0-rc.1

Local-first and MCP:
- https://alchemy.run/domain/view-security , https://alchemy.run/domain/testing-models , https://alchemy.run/domain/testing-apis , https://alchemy.run/domain/model , https://alchemy.run/domain/event
- https://zero.rocicorp.dev/docs/queries , https://zero.rocicorp.dev/docs/auth , https://livestore.dev/ — topology 3 references (D8)
- https://modelcontextprotocol.io/specification/2025-11-25/server/tools , https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization
- Teaching workspace `~/YeeBois/teach/local-first-sync/RESOURCES.md` R1–R9 (Replicache, Figma multiplayer, Ink & Switch local-first essay, Kleppmann, Bailis et al. invariant confluence [verify before quoting], Automerge)

## 4. In-repo capability references

| Brick | Path | Disposition |
|-------|------|-------------|
| `@beep/documents-domain` vault-sync model | `packages/documents/domain/src/` | migrate (goal 1) |
| `@beep/shared-domain` entity kit | `packages/shared/domain/src/entity/` | freeze, then delete with last consumer (D3) |
| `@beep/effect-drizzle` | `packages/**/effect-drizzle` | retire per slice; Projections replace its write path |
| `@beep/schema` `LiteralKit`, `$I.annote` | `packages/shared/schema` | reuse inside alchemy schemas |
| Postgres Platform driver | NET-NEW (location decided in shape stage) | build (D1) |
| Alchemy hosting Layers | NET-NEW in `server` / app runtime (D4) | build |

## 5. Cross-links & provenance

- Packet: `explorations/alchemy-domain-adoption/CAPTURE.md`, `explorations/alchemy-domain-adoption/DECISIONS.md` (D0–D17), the three lane reports under `explorations/alchemy-domain-adoption/research/`.
- Related: `goals/beep-effect-web-alchemy` (closed 2026-11-02; first alchemy core usage in the repo), standards `ARCHITECTURE.md` / `DECISIONS.md` / `GLOSSARY.md` (amendments pending, open question).
- Teaching: `~/YeeBois/teach/local-first-sync/` and artifact https://claude.ai/artifact/GG7dSXrmLj6zWTpH8rfVLg.
