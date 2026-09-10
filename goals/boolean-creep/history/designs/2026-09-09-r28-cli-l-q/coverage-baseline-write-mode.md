# Instance

- id: `coverage-baseline-write-mode`
- file:line: `packages/tooling/tool/cli/src/commands/Quality/Tasks.ts:252`
- symbol: `CoverageTaskOptions`
- members: `replaceAll`, `writeBaseline`
- evidence: E4 at `Quality/Tasks.ts:654-668` — resolved options reject
  replace-all without baseline writing.

Audited at checkout `3330f9881a50c96d3f2ec0fcad76f0f7a09027e4`
against main corpus `52fcc8d1353db9481ef9edb6cc9619500f95568d`.
Replacement P3 review remains pending.

# Current shape and cardinality

`parseCoverageTaskOptions` records raw `--write-baseline` and `--replace-all`
presence. `resolveCoverageTaskOptions` first rejects scoped replace-all at
lines 659-662, then rejects replace-all without writing at lines 664-667.
After validation the pair has three legal states: ratchet, baseline write, and
replace-all baseline write. The raw parser and direct planning test helpers may
still observe all four pairs.

`scoped`, `skip`, arguments, and expected package names remain independent of
this mode. In particular, the resolved carrier must continue to represent a
scoped replace-all state if an affected planner or direct internal constructor
produces one later; CLI validation policy must not become a type-level payload
restriction on unrelated planning facts.

# Cardinality gap

The raw write/replace pair has cardinality four. After the current ordered
validation, three baseline behaviors remain: ratchet, write selected rows, and
replace the full baseline.

# Target schema

Add the repo-cli identity composer and `LiteralKit` to `Tasks.ts` and define:

```ts
const CoverageBaselineMode = LiteralKit(["ratchet", "write", "replace-all"]).pipe(
  $I.annoteSchema("CoverageBaselineMode", {
    description: "Coverage comparison, baseline update, or full baseline replacement mode.",
  })
);
type CoverageBaselineMode = typeof CoverageBaselineMode.Type;
```

Rename the parse-time shape to `ParsedCoverageTaskOptions` and retain both raw
booleans there. The resolved `CoverageTaskOptions` replaces them with
`baselineMode`. Perform the existing two validations in their current order,
derive the mode from the validated raw pair, and carry that value through
affected planning. Selected/noop/full outcomes copy the mode without deriving
two booleans. This keeps the mode orthogonal to the planner's `scoped` result;
the selected and noop carriers can still hold `replace-all` if a validated
internal planning path supplies it in the future.

Raw-only adapters such as `rootQualityStepsForTesting` continue mapping their
unvalidated flags exactly as today: `writeBaseline=false` selects ratchet even
if raw replace-all is also present. Do not tighten or remove those testing
paths.

# Migration inventory

- `Quality/Tasks.ts:8-105` — add `$RepoCliId`, `LiteralKit`, and a local `$I`.
- `Quality/Tasks.ts:249-256` — split raw parsed options from resolved options;
  retain `args`, `expectedPackageNames`, `scoped`, and `skip` unchanged.
- `Quality/Tasks.ts:579-607` — preserve control-argument stripping and all raw
  flag observations.
- `Quality/Tasks.ts:654-746` — preserve scoped-plus-replace error before the
  missing-write error, affected option validation, configuration reads,
  logging, and scope planning; return one resolved baseline mode.
- `Quality/Tasks.ts:2060-2105,2702-2767,2908-2953` — derive labels, report-only
  args/env, shard behavior, compare/write selection, and writer `replaceAll`
  from the kit. Preserve the sharded executor and argument order.
- `Quality/Tasks.ts:2650-2652,2796-2863` — preserve direct testing-helper raw
  behavior and the standalone `writeBaseline` helper parameter; it is outside
  this campaign's object-member scope.
- `quality-tasks.test.ts:2910-2967,3849-3917,4470-4554,4947-5081` — retain
  validation, report-only, shard-topology, and baseline byte assertions.

# Guard-deletion accounting

Delete downstream paired `writeBaseline`/`replaceAll` reads from resolved
options, including label, args, env, final compare/write selection, and writer
option construction. One mode match owns those decisions. Raw validation
guards remain at the parser boundary to preserve exact errors.

# Encoded-side impact

None. Resolved options are internal. Preserve CLI flags, passthrough stripping,
environment variables, report args, sharding, baseline JSONC schema, row
selection, encoded bytes, atomic writer behavior, and console text.

# Test impact

Cover the four raw pairs and three resolved modes. Assert scoped-plus-replace
wins over missing-write when both apply. Pin raw helper behavior, affected
selected/noop/full plans, local/hosted shard identity, report-only env/args,
ratchet comparison, partial write, replace-all write, and byte-identical
baseline output for equivalent inputs.

# Risk and sequencing

Tier 1 but broad inside `Tasks.ts`. Only resolved mode state changes. Do not
refactor standalone boolean parameters or the baseline writer's public option
shape as part of this instance.
