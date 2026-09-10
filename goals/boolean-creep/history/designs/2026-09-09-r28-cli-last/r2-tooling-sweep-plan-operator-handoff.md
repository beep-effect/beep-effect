# Instance

- id: `r2-tooling-sweep-plan-operator-handoff`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.schemas.ts:150`
- symbol: `SweepPlanStep`
- members: `preconditions[].satisfied`, `requiresOperator`
- evidence classes:
  - E3 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:350-365` — the only true writer derives handoff from an empty unsatisfied-precondition set.
  - E4 at `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.ts:428-433` — only a safe remote-ref deletion is handed to the operator; blocked steps are skipped.

# Current shape

`SweepPlanStep` stores observed preconditions and `requiresOperator`. `SweepPlan` nests the step codec and `SweepPlanJson` persists `yeet-sweep-plan/v1`. Production writes the flag at `Sweep.ts:296-418`; only safe `delete-remote-branch` writes true. The executor at `:1231-1251` decides execute/skip from blockers. `Porcelain.ts:98-100` reads the flag only to append ` (needs operator)`.

# Cardinality gap

Four aggregate combinations exist between “all preconditions satisfied” and handoff presence. Three are legal: blocked/no handoff, ready/automatic, and ready/operator handoff. The step-id contract further permits handoff only for `delete-remote-branch`.

# Target schema

Define `SweepOperatorHandoff = LiteralKit(["required"])`. Keep a private encoded step schema with exact `requiresOperator: S.Boolean`. Decode with a fallible `S.decodeTo` transform into named `SweepPlanStepValue`, replacing the boolean with `operatorHandoff: S.Option(SweepOperatorHandoff)`. Keep `SweepPlanStep` as the public codec and export its decoded type via `typeof SweepPlanStep.Type`.

Decode false to `None`; decode true to `Some("required")` only when every precondition passes and the id is `delete-remote-branch`; reject other true shapes. Encode the option to the required old boolean. Production uses file-local decoded constructors. Do not attach `.make` or unrelated statics to the transformed codec.

# Migration inventory

- `Sweep.schemas.ts:99-160` — retain preconditions; add the handoff kit, exact encoded schema, decoded class, and fallible codec.
- `Sweep.schemas.ts:162-192,383` — keep `SweepPlan`, `SweepPlanJson`, version, and nested wire shape.
- `Sweep.ts:217-230,296-418` — update the example and all writers; automatic/blocked steps use `None`, and only ready remote deletion uses `Some("required")`.
- `Sweep.ts:428-433` — update invariant prose.
- `Porcelain.ts:92-104` — keep encoding through `SweepPlanJson` and preserve the exact suffix through option presence.
- `test/yeet-sweep-plan.test.ts:165,183,195,244,252,286` — migrate planner assertions and retain branch, lease, worktree, dirty-tree, and remote-safety cases.
- `test/yeet-sweep-schemas.test.ts:18-45,91-110` — cover coherent blocked, automatic, and handoff old shapes plus exact v1 JSON.
- `src/test/Yeet.test-kit.ts:66` — existing wildcard export already covers this module.

# Guard-deletion accounting

Delete eight `requiresOperator: false` writes in `Sweep.ts:296-418`, the derived true/false write at `:364`, and the decoded boolean branch at `Porcelain.ts:99`. A construction helper owns the invariant and the renderer reads option presence. Only the compatibility decoder keeps a coherence guard.

# Encoded-side impact

`yeet-sweep-plan/v1` stays exact: `requiresOperator` remains required; all keys, values, defaults, canonical order, and version remain. All production-valid aggregates round-trip exactly. The schema test’s local-delete step with a failed precondition and `requiresOperator:true` contradicts the source contract and every production writer; retain it only as an invalid encoded fixture and prove rejection.

# Test impact

Add exact decode/encode coverage for all three legal aggregates; reject true with a failed precondition and true on a non-remote step. Preserve report round trips, porcelain text/order, and live-tip revalidation.

# Risk & sequencing

Tier 2 singleton. A malformed handoff can authorize remote deletion, so land schema, constructors/readers, artifact proofs, and focused Yeet suites atomically. No new stored state or generic helper is introduced.
