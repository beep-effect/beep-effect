# runners-bake-cli-mode

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `runners-bake-cli-mode`
- file: `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:93`
- symbol: `BakeCliOptions`
- members: `plan`, `check`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:44` — after rejecting `plan && check`, `plan ? plan : check ? check : bake` dispatches exactly three modes and never treats combined-true as a fourth mode. The preceding conflict guard is supporting evidence, not E3.

### 2. Current shape

```ts
type BakeCliOptions = {
  readonly plan: boolean;
  readonly check: boolean;
  readonly json: boolean;
  readonly region: string;
  readonly subnet: O.Option<string>;
  readonly securityGroup: O.Option<string>;
  readonly instanceProfile: O.Option<string>;
  readonly baseAmiParameter: string;
  readonly instanceType: string;
  readonly tags: O.Option<Record<string, string>>;
  readonly report: O.Option<string>;
};
```

### 3. Cardinality gap

The two booleans represent four states. Legal states are `bake` (neither flag), `plan`, and `check`; `plan + check` is illegal.

### 4. Target schema

Reuse the existing `BakeMode` LiteralKit schema at `Runners.schemas.ts:63-82`; do not create another mode domain. Define the schema-backed options beside it in `Runners.schemas.ts` and import it into the command:

```ts
export class BakeCliOptions extends S.Class<BakeCliOptions>($I`BakeCliOptions`)(
  {
    mode: BakeMode,
    json: S.Boolean,
    region: S.String,
    subnet: S.Option(S.String),
    securityGroup: S.Option(S.String),
    instanceProfile: S.Option(S.String),
    baseAmiParameter: S.String,
    instanceType: S.String,
    tags: S.Option(S.Record(S.String, S.String)),
    report: S.Option(S.String),
  },
  $I.annote("BakeCliOptions", { description: "Validated runtime options for the runners bake command." })
) {}
```

At `bakeCommand`, resolve `[[plan, "plan"], [check, "check"]]` with fallback `"bake"` through `resolveExclusiveRunModeFromFlags`, then construct `BakeCliOptions.make({ ...rest, mode })`. `runBakeCommand` matches `options.mode` directly.

### 5. Migration inventory

- `Runners.command.ts:38-45` — delete `resolveBakeMode`; the shared exclusive resolver owns legacy-flag collapse and preserves `RunnersCommandError`.
- `Runners.schemas.ts:63-82` — retain `BakeMode` as owner and add `BakeCliOptions` in this schema module.
- `Runners.command.ts:15-19` — import runtime `BakeMode`/`BakeCliOptions` and the shared exclusive resolver; remove the old type-only mode import.
- `Runners.command.ts:93-105` — replace `plan`/`check` with `mode: BakeMode` and make the options schema a class.
- `Runners.command.ts:107-110` — read `options.mode`; remove the local resolution effect.
- `Runners.command.ts:172-175` — test seam accepts the schema-backed options with `mode`.
- `Runners.command.ts:177-211` — keep both Flag declarations, resolve them in the adapter, and pass only `mode` onward.
- `commands/Runners/index.ts:14` — remove the zero-consumer, never-shipped `resolveBakeMode` export in this atomic migration; add no deprecation shim or alias.
- `runners-bake.test.ts:106-118,279-281,292` — fixtures write `mode` rather than the two booleans.
- `runners-bake.test.ts:269-273` — replace direct resolver tests with shared adapter/command parsing coverage for all three modes and the conflict.

### 6. Guard-deletion accounting

- `Runners.command.ts:42-44` — delete the `plan && check` coherence check and nested ternary mode chain.
- `Runners.command.ts:23-45` — delete the comment/API that describes domain resolution in terms of booleans.
- `runners-bake.test.ts:272-273` — remove the test of the deleted local guard; retain equivalent CLI-boundary conflict coverage.

### 7. Encoded-side impact

none (internal). CLI spellings and messages remain stable; no JSON report schema contains these flags.

### 8. Test impact

`packages/tooling/tool/cli/test/runners-bake.test.ts` updates fixtures, mode cases, and conflict coverage. No other test imports the members.

### 9. Risk & sequencing

Requires the shared exclusive resolver with both data-first and data-last forms
preserved. `Runners.command.ts` and its test seam change together;
`BakeMode` remains the sole domain owner and `resolveBakeMode` disappears
without a compatibility alias.
