# @beep/shared-domain Agent Guide

Shared-kernel domain language for cross-slice product concepts, values,
schemas, and pure behavior. New exports must meet the shared-kernel promotion
bar (see `packages/shared/AGENTS.md`).

## Surface Map

| Surface | Key exports | Notes |
| --- | --- | --- |
| entry module | `Aggregates`, `Entities`, `BaseEntity`, `EntityId`, `EntityRef`, `Principal`, `SourceKind`, `Identity`, `Values` | package root |
| `src/entities/` | `Organization` | shared identity-bearing concepts |
| `src/entity/` | `BaseEntity`, `EntityId`, `EntityRef`, `Principal`, `primitives`, `SourceKind` | shared entity constructor barrel + driver-neutral primitive schemas |
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
- Persisted entity models use `BaseEntity.Class` from
  `@beep/shared-domain/entity/BaseEntity` for shared product
  invariants and `@beep/schema/EntitySchema` persisted descriptors for
  storage-neutral persistence metadata.
