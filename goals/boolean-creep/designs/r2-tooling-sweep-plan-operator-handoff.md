# Instance

- id: `r2-tooling-sweep-plan-operator-handoff`
- file:line: `packages/tooling/tool/cli/src/commands/Yeet/internal/Sweep.schemas.ts:150`
- symbol: `SweepPlanStep`
- members: `preconditions[].satisfied`, `requiresOperator`
- evidence classes:
  - E3 at `Sweep.ts:350-365` — the only true writer derives operator handoff from an empty unsatisfied-precondition set.
  - E4 at `Sweep.ts:428-433` — the documented invariant permits handoff only for safe remote deletion; blockers remain skips.

# Current shape

The versioned `yeet-sweep-plan/v1` schema stores observed boolean preconditions and a second `requiresOperator` boolean. All plan-step constructors write it, plan tests inspect it, and `SweepPlanJson` persists/emits it as JSON.

# Cardinality gap

At the aggregate level, four combinations exist between “all preconditions satisfied” and `requiresOperator`. Production permits three: blocked/non-handoff, ready/automatic, and ready/operator-handoff. Handoff with an unsatisfied precondition is forbidden.

# Target schema

Keep the exact legacy encoded step with `requiresOperator: boolean`. Decode through a fallible compatibility codec to `operatorHandoff: Option<"required">` (from one named `LiteralKit`) plus the existing id, action, and preconditions. Production construction goes through helpers that derive the option from step id and preconditions; decoded code never carries `requiresOperator`.

The decoder accepts coherent v1 steps and rejects handoff with any failed precondition. Encoding preserves the old key and boolean. The public `SweepPlanStep` symbol remains the codec and reattaches an ergonomic constructor or statics for decoded callers.

# Migration inventory

- `Sweep.schemas.ts:99-160` — define the encoded step, decoded option-literal shape, transform, and invariant failure.
- `Sweep.schemas.ts:162-192` — keep `SweepPlan` and `SweepPlanJson` schema version and wire shape unchanged.
- `Sweep.ts:217-230,298-418` — replace all raw boolean writes with automatic/operator helper construction; remote deletion derives handoff only after all preconditions pass.
- `Sweep.ts:420-450` and plan execution/render paths found by `rg requiresOperator` — match the decoded option rather than a boolean.
- `packages/tooling/tool/cli/src/commands/Yeet/internal/Porcelain.ts:76` — migrate the sole production decoded reader used by `--plan` text: append ` (needs operator)` only for `operatorHandoff: Some("required")`, preserving the exact rendered suffix while the encoded plan key remains `requiresOperator`.
- `test/yeet-sweep-plan.test.ts` — migrate production planner assertions and retain every blocker/safe-handoff case.
- `test/yeet-sweep-schemas.test.ts:38-43,91-96` — the current successful fixture is internally contradictory because it combines an unsatisfied precondition with `requiresOperator: true`. Change the successful round-trip fixture to a coherent blocked step (`operatorHandoff: None`, encoded as `requiresOperator: false`) while preserving every other v1 key. Retain the old contradictory object as a separate encoded-invalid fixture and assert that decoding rejects it.

# Guard-deletion accounting

Delete every `requiresOperator: false` boilerplate write, the remote-step derived boolean write, and decoded boolean guards. A single constructor derives the option; a single match selects handoff behavior. The encoded transform remains required compatibility code.

# Encoded-side impact

`yeet-sweep-plan/v1` is byte-shape compatible: `requiresOperator`, `preconditions[].satisfied`, all other keys, values, defaults, and version remain unchanged. Supported coherent historical plans round-trip exactly. The existing incoherent test object is not a supported round-trip fixture: encoded handoff with an unsatisfied precondition is rejected as internally contradictory rather than normalized into authority to delete.

# Test impact

Prove exact JSON for blocked, automatic, and operator-handoff steps; decode/encode all three legal aggregates. In `yeet-sweep-schemas.test.ts`, make the successful blocked fixture encode `requiresOperator: false` and separately assert that the old unsatisfied-plus-true object is rejected. Retain branch identity, tip lease, worktree, dirty-tree, and remote deletion tests.

# Risk & sequencing

Tier 2 singleton. This changes a deletion-safety plan, so codec, planner helpers, execution reader, exact snapshots, and focused Yeet suites land together. Run full `@beep/repo-cli` package verification before Yeet publication.
