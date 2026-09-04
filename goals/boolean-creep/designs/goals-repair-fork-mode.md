# Instance

- id: `goals-repair-fork-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/Migration/Migration.command.ts:103`
- symbol: `RepairForkCommandInput`
- members: `preview`, `apply`
- evidence: E2 at `Migration.command.ts:52-59,126-130` — the adapter
  requires exactly one flag and immediately resolves `preview | apply`.

# Current shape

The command input stores two flags and passes them to `requireExclusiveMode`.

# Cardinality gap

Four combinations are representable; exactly `preview` and `apply` are legal.

# Target schema

Name and reuse the existing `preview | apply` LiteralKit currently embedded in
`Migration.schemas.ts`. The CLI handler retains both spellings and its exact
`GoalStatusInputError`, collapses them once, and passes a single mode to
`printForkPlan`. Remove `RepairForkCommandInput` if it has no consumer after
the adapter becomes immediate; do not add a compatibility alias.

# Migration inventory

- `Migration.schemas.ts` — promote the existing inline kit to the one named
  Goals migration-mode schema and export its derived guards/match helpers only
  where live consumers require them.
- `Migration.command.ts:52-59` — make the boundary resolver return the named
  mode while preserving its exact-one error.
- `Migration.command.ts:103-130` — keep raw booleans only in Effect CLI output,
  construct one mode immediately, and delete the boolean-shaped input type.
- `Migration.command.ts:64-91` — match the schema-owned mode without an ad-hoc
  literal union.

# Guard-deletion accounting

Delete the application-carried pair and `preview === apply` coherence burden;
the raw exact-one check survives only at the CLI compatibility boundary.

# Encoded-side impact

none (internal); CLI flags, required exact-one semantics, messages, and
preview/apply behavior remain stable.

# Test impact

Cover all four raw pairs at the adapter, both resolved modes, no-write preview,
and apply behavior. Import source through `@beep/repo-cli` aliases. Run the
Goals suites and full repo-CLI package verification.

# Risk and sequencing

Land in Tier 1E with `goals-migrate-conventions-mode`, sharing one named mode.
Do not broaden into packet mutation behavior.
