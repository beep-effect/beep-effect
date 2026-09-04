# docgen-local-json-requires-plan

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `docgen-local-json-requires-plan`
- file: `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:141`
- symbol: `DocgenLocalOptions`
- members: `json`, `plan`
- evidence: E4 at `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:1368` — `runDocgenLocal` rejects `json && !plan`, proving the phase implication `json => plan`; `executeDocgenLocalPlan` also reads `options.plan` at line 1313 before execution.

### 2. Current shape

```ts
type DocgenLocalOptions = {
  readonly allowFull: boolean;
  readonly base: string;
  readonly full: boolean;
  readonly head: string;
  readonly json: boolean;
  readonly packageSelector: O.Option<string>;
  readonly parallel: number;
  readonly plan: boolean;
};
```

### 3. Cardinality gap

Four boolean pairs are representable. Legal states are execute with human plan output (`false/false`), plan-only human output (`false/true`), and plan-only JSON output (`true/true`). JSON execution (`true/false`) is illegal.

### 4. Target schema

Name the new payload-free domain `DocgenLocalPlanOutputKit` / `DocgenLocalPlanOutput`. `O.none()` means execute after rendering the human plan; `O.some("text")` means human plan-only; `O.some("json")` means JSON plan-only.

```ts
const DocgenLocalPlanOutputKit = LiteralKit(["text", "json"])
const DocgenLocalPlanOutput = DocgenLocalPlanOutputKit.pipe(
  $I.annoteSchema("DocgenLocalPlanOutput", {
    description: "Requested plan-only output format for bounded local docgen.",
  })
)
type DocgenLocalPlanOutput = typeof DocgenLocalPlanOutput.Type

class DocgenLocalOptions extends S.Class<DocgenLocalOptions>($I`DocgenLocalOptions`)(
  {
    allowFull: S.Boolean,
    base: S.String,
    full: S.Boolean,
    head: S.String,
    packageSelector: S.Option(S.String),
    parallel: S.Int,
    planOutput: S.Option(DocgenLocalPlanOutput),
  },
  $I.annote("DocgenLocalOptions", { description: "Runtime options for bounded local docgen." })
) {}
```

The command adapter maps `(plan,json)` to the Option and retains the current error for `json && !plan`. Application code derives `isPlanOnly = O.isSome(planOutput)` and `isJson = O.isSome(planOutput) && DocgenLocalPlanOutputKit.is.json(planOutput.value)`.

### 5. Migration inventory

- `Local.ts:141-150` — replace the two fields with `planOutput` and promote the type to `S.Class`.
- `Local.ts:1313` — migrate the execution-time `options.plan` reader to `O.isSome(options.planOutput)` so plan-only mode cannot fall through into execution.
- `Local.ts:1350-1380` — remove the implication guard; render from the Option and let execution continue only for `None`.
- `Docgen.command.ts:531-541` — keep `planFlag` and `jsonFlag`, resolve the Option in the command adapter, and write `planOutput` once.
- `docgen.test.ts:899-908`, `:921-930`, and `:943` onward — migrate every direct `buildDocgenLocalPlan` options object from correlated `json`/`plan` fields to `planOutput`; retain the same execute, text-plan, and JSON-plan meanings.
- `docgen.test.ts:1068` — migrate the direct `runDocgenLocal({ plan: false, ... })` execution fixture to `planOutput: O.none()`; it is not a `buildDocgenLocalPlan` plan-output fixture.
- `docgen.test.ts:1104-1110` — bare `local --json` remains a boundary rejection and continues asserting the same message.

### 6. Guard-deletion accounting

- `Local.ts:1368-1372` — delete the application-layer implication guard.
- `Local.ts:1313` and `:1377-1380` — delete both execution-time and output-time JSON/plan boolean decisions; match the Option once.
- `Local.ts:1281-1290` and `:1350-1361` — update both live JSDoc examples that construct the correlated `json`/`plan` bits.

The CLI adapter still validates the legacy implication; that is input validation, not stored application state.

### 7. Encoded-side impact

none (internal). JSON here selects console encoding of a plan; the option object itself is not persisted or emitted.

### 8. Test impact

Update every direct options fixture in
`packages/tooling/tool/cli/test/docgen.test.ts`; retain valid `--plan`, valid
`--plan --json`, and invalid bare `--json` command cases. Add an
execution-spy assertion proving both plan-output variants stop before the
executor while `None` executes.

### 9. Risk & sequencing

`Local.ts`, `Docgen.command.ts`, and `docgen.test.ts` are shared with the
quality-scope instance. Apply these two Docgen designs serially against the
then-current files and preserve any concurrent work.
