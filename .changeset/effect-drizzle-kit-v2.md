---
"@beep/effect-drizzle": minor
"@beep/shared-domain": minor
"@beep/agents-domain": patch
"@beep/architecture-lab-domain": patch
"@beep/documents-domain": patch
"@beep/epistemic-domain": patch
"@beep/law-practice-domain": patch
"@beep/workspace-domain": patch
---

Reshape the effect-drizzle kit API and rebuild the shared entity layer on it.

`make("pg" | "sqlite", (toolkit) => config)` replaces the object-config form:
the dialect toolkit (column combinators plus the `Table` extras namespace) is
injected once around the whole configuration. Kits compose with `extend`,
single-column indexes colocate on their fields via `index()`/`uniqueIndex()`
combinators harvested into derived `{table}_{column}_(btree|unique)_idx`
nodes (with a `name` pin for legacy spellings), and `makeRepository` becomes
dual. SQLite table extras gain the `uniqueIndex` node.

`@beep/shared-domain` replaces the per-entity `ProductEntity.make` kits with
an entity tier family — `BaseEntity`, `AuditEntity`, `OrgEntity`,
`ProductEntity` plus `EntityKit.withAudit`/`withOrg` capability mixins — whose
`Entity<Self>()(XId)({ own fields })` factory derives the table name, branded
serial id, entityType literal, and public id (with its unique index) from the
EntityId statics. Every slice model migrates to the tier factory; emitted DDL
is unchanged, proven by the db-admin migrations drift gate.
