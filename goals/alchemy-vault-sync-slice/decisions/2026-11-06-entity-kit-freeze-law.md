---
title: "Entity-kit freeze is a beep law with a shrinking baseline"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Delete the law, its baseline and the lint lane when the kit's last consumer migrates and the kit is removed"
---

`bun run beep laws entity-kit-freeze --check` fails any git-tracked `.ts`/`.tsx` file under `packages/` or `apps/` that imports the frozen specifiers (`@beep/shared-domain/entity` barrel, `entity/EntityKit`, `BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`, `primitives`, or those names from the `@beep/shared-domain` barrel) unless it is in `standards/entity-kit-freeze.baseline.jsonc`; a baseline entry that stopped importing is a stale finding fixed by `--write`, so the baseline only shrinks. `Principal`, `SourceKind`, `PublicEntityId`, `EntityId`, `EntityRef` are not frozen (D3). Registered as cheap-gate lane `lint:entity-kit-freeze`.
