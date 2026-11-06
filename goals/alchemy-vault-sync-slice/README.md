# Alchemy Vault-Sync Slice

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Migrate the `documents` vault-sync bounded context onto `@alchemy.run/domain` end to end: a Postgres Platform driver with the Effect Cluster workflow engine, aggregates/sagas/policies/views for destinations, sync operations and conflicts with Box as External System, one Api (HTTP + OpenAPI, CLI, MCP limited to Views) behind Session middleware, an optimistic + offline-intents client, legacy tables rebuilt as Projections after a single-writer cutover, and the doctrine amendments that let every later slice follow.

Graduated 2026-11-05 from [`explorations/alchemy-domain-adoption`](../../explorations/alchemy-domain-adoption/README.md); decisions D0–D17 there are binding.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/alchemy-vault-sync-slice/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - active execution plan.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/`](./research/) - supporting research, if present.
6. [`history/`](./history/) - evidence and closeouts, if present.

## Current Phase

P1 Implement — in progress (first PR: lockstep pin + driver scaffold + P0 spikes + doctrine + entity-kit freeze, per D16). P0 Research complete 2026-11-06.

## Latest Evidence

- 2026-11-06: P0 spikes recorded in [`research/01-p0-spikes.md`](./research/01-p0-spikes.md) with executable tests under `packages/drivers/alchemy-postgres/test/spikes/`; seven decision files under `decisions/`; `@alchemy.run/domain` 2.0.0-beta.85 pinned (plus `foldkit`); `@beep/alchemy-postgres` scaffolded; `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`, `standards/architecture/GLOSSARY.md` amended; `beep laws entity-kit-freeze` lint lane added.

## Notes

- P0 starts with the four spikes named in `SPEC.md` Constraints (annotation propagation, envelope survival, event version slot, Postgres replay path) and fixes the driver package location.
- The `/teach` lesson behind D8 lives outside the repo at `$HOME/YeeBois/teach/local-first-sync/` (artifact https://claude.ai/artifact/GG7dSXrmLj6zWTpH8rfVLg).
- Research lane reports: `explorations/alchemy-domain-adoption/research/01-03-*.md`.
