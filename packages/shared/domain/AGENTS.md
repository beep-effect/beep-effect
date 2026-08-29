# @beep/shared-domain Agent Guide

Shared-kernel domain language for cross-slice product concepts, values,
schemas, and pure behavior. New exports must meet the shared-kernel promotion
bar (see `packages/shared/AGENTS.md`).

## Surface Map

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Aggregates`, `Entities`, `ProductEntity`, `EntityId`, `EntityRef`, `Principal`, `SourceKind`, `Identity`, `Values` | package root |
| `src/entities/` | `Organization` | shared identity-bearing concepts |
| `src/entity/` | `BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`, `EntityKit`, `EntityId`, `EntityRef`, `Principal`, `primitives`, `SourceKind` | shared entity tier family and primitive schemas |
| `src/identity/` | `Shared` | shared entity-id modules and identity vocabulary |
| `src/values/` | `LocalDate` | shared value-object barrel |

## Add Here

- Schema-first shared value objects and rich domain models.
- Pure behavior, policies, invariants, guards, and domain events.
- Driver-neutral vocabulary that multiple slices intentionally share.

## Keep Out

- Slice-private models, config access, persistence, UI, server/client adapters,
  drivers, workflow orchestration, and generic foundation helpers.

## Laws

- Domain stays pure and driver-neutral.
- Domain may depend only on allowed shared-kernel language and foundation
  primitive/modeling packages.
- Persisted entity models extend a tier factory —
  `class X extends ProductEntity.Entity<X>()(XId)({ ...own fields })` — and
  declare SQL metadata through effect-drizzle fields; identity, audit, org
  defaults and their indexes arrive from the tier. Pick the smallest tier
  (`BaseEntity`, `AuditEntity`, `OrgEntity`, `ProductEntity`) or compose
  capabilities with `kit.extend(EntityKit.withAudit)`. Identity definitions
  stay in `src/identity/`; concrete tables are projected with `toPgTable` in
  tables packages.
