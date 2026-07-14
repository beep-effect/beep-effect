# Effect-Native Migration

## Status

Lifecycle: `completed-retained`

Historical migration complete. `ops/progress.json` records all 5 phases, all 7
symbol inventories, and all 75 package entries as done. The packet bookkeeping
was reconciled on 2026-07-14 without re-auditing current source.

## Mission

Migrate native JavaScript `Map`, `Set`, `String`, `Object`, `Date`, `JSON`, and
`Array` usage in first-party `packages/**` and `apps/**` to their Effect-native
counterparts, in accordance with `.claude/skills/effect-first-development/`
(Law #7: "No native `Object/Map/Set/Date/String` helpers in domain logic").

Where a package can depend on `@beep/utils` without creating a cycle, the
migration prefers the `@beep/utils/*` re-export wrappers (`Str`, `Struct`,
`Array`, `DateTime`) over raw `effect/*` imports.

## Approach

This goal's historical run completed the design resolved in
`research/grilling-notes.md`:

1. **Phase 1** built all 7 per-category symbol inventories.
2. **Phase 1.5** stress-tested `PLAN.md` with the `grill-with-docs` skill.
3. **Phase 2** completed discovery for all 75 recorded packages.
4. **Phase 3** completed remediation for all 75 recorded packages.

The run used **one agent per package per phase** (all categories) in bounded
parallel waves — not one agent per category per package.

## Reading Order

- [SPEC.md](./SPEC.md) — normative source of truth: scope, category→target
  mapping, import-precedence/cycle rule, decision rules, inventory schemas, and
  acceptance gates.
- [PLAN.md](./PLAN.md) — the phased execution plan.
- [ops/manifest.json](./ops/manifest.json) — machine-readable routing metadata.
- [ops/progress.json](./ops/progress.json) — resumable per-package × per-phase
  status manifest.
- [ops/prompts/discovery.agent.md](./ops/prompts/discovery.agent.md) — Phase 2
  per-package discovery template.
- [ops/prompts/remediation.agent.md](./ops/prompts/remediation.agent.md) —
  Phase 3 per-package remediation template.
- [research/grilling-notes.md](./research/grilling-notes.md) — the decisions and
  findings this goal was built from.

## Outputs

- `ops/inventory/symbols/effect-native-<Category>.json` — Phase 1 symbol maps.
- `ops/inventory/usages/<sanitized-package>/<Category>.json` — Phase 2 findings.
- Source edits + per-package commits — Phase 3.

See [history/2026-07-14-tree-reconciliation.md](./history/2026-07-14-tree-reconciliation.md)
for the existence-only mapping of the historical 75-package inventory to the
current tree.
