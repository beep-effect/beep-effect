# Family design — CLI mode flags

## Shared family design

All ten records are Tier 1 internal command-adapter shapes. The public CLI spellings remain stable: callers may continue to use `--plan`, `--check`, `--write`, `--dry-run`, `--json`, `--all`, `--changed-files`, `--refresh`, and `--force` exactly as today. Boolean values may exist only as the immediate output of Effect's CLI parser. Each command adapter must collapse them once into a schema-owned literal before calling application code; no application options type may carry sibling mode booleans.

The live shared implementation is `packages/tooling/tool/cli/src/internal/cli/RunMode.ts:26-203`. Its current exported resolver is named `resolveRunMode`, although the campaign brief calls it `resolveRunModeFromFlags`. P4 should add the explicit name and retain `resolveRunMode` as a compatibility alias while `VersionSync.command.ts:11-31` and tests migrate. The family extension is:

```ts
import { $RepoCliId } from "@beep/identity/packages"
import { LiteralKit } from "@beep/schema"
import { A, O, P, pipe } from "@beep/utils"
import { Effect } from "effect"

const $I = $RepoCliId.create("internal/cli/RunMode")

const RunModeKit = LiteralKit(["check", "write", "dry-run"])
const WriteCheckRunModeKit = LiteralKit(RunModeKit.pickOptions(["check", "write"]))
const PrintWriteCheckModeKit = LiteralKit(["print", "write", "check"])

export const WriteCheckRunMode = WriteCheckRunModeKit.pipe(
  $I.annoteSchema("WriteCheckRunMode", {
    description: "Generated-file execution mode that either verifies or writes the projection.",
  })
)
export type WriteCheckRunMode = typeof WriteCheckRunMode.Type
export const WriteCheckRunModeIs = WriteCheckRunModeKit.is

export const PrintWriteCheckMode = PrintWriteCheckModeKit.pipe(
  $I.annoteSchema("PrintWriteCheckMode", {
    description: "Command mode that prints, writes, or verifies a generated projection.",
  })
)
export type PrintWriteCheckMode = typeof PrintWriteCheckMode.Type
export const PrintWriteCheckModeMatch = PrintWriteCheckModeKit.$match

export const resolveRunModeFromFlags = <Mode>(
  candidates: ReadonlyArray<readonly [enabled: boolean, mode: Mode]>,
  fallback: Mode
): Mode =>
  pipe(
    candidates,
    A.map(([enabled, mode]) => pipe(enabled, O.liftPredicate(P.isTruthy), O.as(mode))),
    O.firstSomeOf,
    O.getOrElse(() => fallback)
  )

export const resolveExclusiveRunModeFromFlags = <Mode, E, R>(
  first: readonly [enabled: boolean, mode: Mode],
  second: readonly [enabled: boolean, mode: Mode],
  fallback: Mode,
  onConflict: Effect.Effect<never, E, R>
): Effect.Effect<Mode, E, R> =>
  runModeFlagsConflict(first[0], second[0])
    ? onConflict
    : Effect.succeed(resolveRunModeFromFlags([first, second], fallback))

export const resolveRunMode = resolveRunModeFromFlags
```

`runModeFlagsConflict` remains the single compatibility-boundary check for two legacy boolean switches. The new honest literal type deletes each command's duplicate coherence guard; the shared adapter check is not domain state and must not escape the CLI layer. `resolveRunModeFromFlags` remains precedence-based for `tsconfig-sync`, whose current behavior deliberately accepts combined flags and selects `check`, then `dry-run`, then `sync`.

Effect v4 validation: the required `.repos/effect` checkout is absent in this worktree. The installed Effect v4 source (`node_modules/effect/src/unstable/cli/Flag.ts:155-181,774,991-1040,1789-1842` and `Param.ts:411-419,2902-2903`) confirms that `Flag.choice(name, options)` parses one valued flag directly to a literal, while absent boolean flags parse successfully as `false`. Consequently, `Flag.orElse` cannot combine legacy boolean spellings into one exclusive literal. Replacing them with `--mode <literal>` would be a breaking CLI change and is not part of this campaign.

Landing order: extend `RunMode.ts` and `cli-kits.test.ts` first in the same batch, then migrate command adapters. Keep the compatibility alias until `VersionSync.command.ts` is migrated or explicitly proven unaffected.

---

## runners-bake-cli-mode

### 1. Instance

- id: `runners-bake-cli-mode`
- file: `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:96`
- symbol: `BakeCliOptions`
- members: `plan`, `check`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Runners/Runners.command.ts:42` — `resolveBakeMode` fails when `plan && check`, a runtime coherence check standing in for a mode literal; E2 at `Runners.command.ts:44` — `plan ? plan : check ? check : bake` never treats combined-true as a fourth mode.

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
- `Runners.command.ts:96-108` — replace `plan`/`check` with `mode: BakeMode` and make the options schema a class.
- `Runners.command.ts:110-113` — read `options.mode`; remove the local resolution effect.
- `Runners.command.ts:175-177` — test seam accepts the schema-backed options with `mode`.
- `Runners.command.ts:180-211` — keep both Flag declarations, resolve them in the adapter, and pass only `mode` onward.
- `commands/Runners/index.ts:14` — stop exporting `resolveBakeMode` (or temporarily deprecate it for one landing if external compilation requires it).
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

Requires the shared exclusive resolver first. `Runners.command.ts` and its test seam change together; `BakeMode` must remain the sole domain owner.

---

## docgen-local-json-requires-plan

### 1. Instance

- id: `docgen-local-json-requires-plan`
- file: `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:98`
- symbol: `DocgenLocalOptions`
- members: `json`, `plan`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Docgen/internal/Local.ts:1055` — `runDocgenLocal` rejects `json && !plan` so stdout stays machine-readable; JSON implies plan.

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

- `Local.ts:98-107` — replace the two fields with `planOutput` and promote the type to `S.Class`.
- `Local.ts:412-448,980-986,1015-1023,1051-1054` — all internal option propagation receives the class; planning helpers otherwise ignore these two old fields.
- `Local.ts:1055-1075` — remove the implication guard; render from the Option and return early on `Some`.
- `Docgen.command.ts:109,475-498` — keep `planFlag` and `jsonFlag`, resolve the Option in the command adapter, and write `planOutput` once.
- `docgen.test.ts:367-376` — direct `buildDocgenLocalPlan` fixture writes `planOutput: O.some("text")`.
- `docgen.test.ts:414` — `local --plan` CLI case remains unchanged.
- `docgen.test.ts:426-445` — `local --json` remains a boundary rejection and continues asserting the same message.

### 6. Guard-deletion accounting

- `Local.ts:1055-1059` — delete the application-layer implication guard.
- `Local.ts:1064-1070` — delete the separate `if (json)` / `if (plan)` coherence chain; match the Option once.
- `Local.ts:1029-1044` — update the comment/example that constructs two correlated bits.

The CLI adapter still validates the legacy implication; that is input validation, not stored application state.

### 7. Encoded-side impact

none (internal). JSON here selects console encoding of a plan; the option object itself is not persisted or emitted.

### 8. Test impact

Only `packages/tooling/tool/cli/test/docgen.test.ts` touches this pair. Update the direct fixture and retain both valid `--plan` and invalid bare `--json` command cases.

### 9. Risk & sequencing

`Local.ts`, `Docgen.command.ts`, and `docgen.test.ts` are shared with the quality-scope instance and are already dirty in this checkout. Apply these two Docgen designs serially and rebase on the live file; do not overwrite concurrent Docgen work.

---

## tsconfig-sync-mode-flags

### 1. Instance

- id: `tsconfig-sync-mode-flags`
- file: `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.schemas.ts:425`
- symbol: `TsconfigSyncModeFlags`
- members: `check`, `dryRun`, `write`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/TsconfigSync/TsconfigSync.command.ts:21` — `resolveMode` first-Somes `isCheckModeFlags`, `isDryRunModeFlags`, and `isWriteModeFlags`; combined-true is never a distinct mode and collapses to check, then dry-run, then sync.

### 2. Current shape

```ts
export type TsconfigSyncModeFlags = readonly [check: boolean, dryRun: boolean, write: boolean];
```

### 3. Cardinality gap

Eight tuples are representable but the legal semantic states are `check`, `dry-run`, and `sync`. Explicit `--write` and no mode flag both mean `sync`; combined inputs collapse by current precedence.

### 4. Target schema

Reuse `TsconfigSyncMode` and its existing `TsconfigSyncModeKit` at `TsconfigSync.schemas.ts:334-391`. Delete the tuple type and all tuple predicates. The command adapter becomes:

```ts
const mode: TsconfigSyncMode = resolveRunModeFromFlags(
  [
    [check, "check"],
    [dryRun, "dry-run"],
    [write, "sync"],
  ],
  "sync"
)
```

It then constructs the already schema-backed `TsconfigSyncRunOptions` union at `TsconfigSync.schemas.ts:479-540`; no new domain is introduced.

### 5. Migration inventory

- `TsconfigSync.schemas.ts:412-425` — delete `TsconfigSyncModeFlags` and its JSDoc.
- `TsconfigSync.schemas.ts:427-477` — delete `isCheckModeFlags`, `isDryRunModeFlags`, `isWriteModeFlags` and their examples.
- `TsconfigSync.command.ts:9-16` — remove Option/predicate imports and import the shared resolver.
- `TsconfigSync.command.ts:18-30` — replace the tuple/predicate resolver with the shared literal resolver.
- `TsconfigSync.command.ts:52-68` — keep all three CLI flags; collapse them at the handler boundary and pass only `mode` into `syncOptions`.
- `tsconfig-sync.test.ts:191-210` — explicit `--write` case remains unchanged and still proves the sync alias.

### 6. Guard-deletion accounting

- `TsconfigSync.schemas.ts:443,460,477` — delete the three runtime tuple predicates that encode precedence as boolean shapes.
- `TsconfigSync.command.ts:21-29` — delete the `O.firstSomeOf` boolean coherence chain.
- `TsconfigSync.schemas.ts:412-477` — delete comments/examples teaching the tuple invariant.

### 7. Encoded-side impact

none (internal). `TsconfigSyncRunOptions` already carries the literal `mode`; generated tsconfig files are unchanged.

### 8. Test impact

`packages/tooling/tool/cli/test/tsconfig-sync.test.ts` retains the explicit write CLI case. `cli-kits.test.ts:85-99` should own precedence regression coverage after the local predicates disappear.

### 9. Risk & sequencing

Land after the generic `resolveRunModeFromFlags` extension. Preserve current combined-flag precedence; changing it to rejection is outside this ratified design.

---

## codex-findings-ingest-modes

### 1. Instance

- id: `codex-findings-ingest-modes`
- file: `packages/tooling/tool/cli/src/commands/Codex/Findings.refresh.ts:242`
- symbol: `validateCodexFindingsIngestModes`
- members: `force`, `refresh`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Codex/Findings.refresh.ts:246` — `validateCodexFindingsIngestModes` fails when both flags are true; force replaces an existing packet while refresh preserves triage.

### 2. Current shape

```ts
export const validateCodexFindingsIngestModes = Effect.fnUntraced(function* (options: {
  readonly force: boolean;
  readonly refresh: boolean;
}) {
  if (options.force && options.refresh) {
    return yield* ingestFailure(
      "mode-conflict",
      "--refresh preserves an existing packet while --force replaces it; choose exactly one existing-packet mode."
    );
  }
});
```

### 3. Cardinality gap

Four pairs are representable. Legal states are `none`, `refresh`, and `force`; `refresh + force` is illegal.

### 4. Target schema

Define the domain once in `Findings.schemas.ts` and reuse it in command and refresh modules:

```ts
const CodexFindingsExistingPacketModeKit = LiteralKit(["none", "refresh", "force"])
export const CodexFindingsExistingPacketMode = CodexFindingsExistingPacketModeKit.pipe(
  $I.annoteSchema("CodexFindingsExistingPacketMode", {
    description: "How ingest handles an existing Codex findings packet.",
  })
)
export type CodexFindingsExistingPacketMode = typeof CodexFindingsExistingPacketMode.Type

export class CodexFindingsIngestOptions extends S.Class<CodexFindingsIngestOptions>(
  $I`CodexFindingsIngestOptions`
)(
  {
    from: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    slug: S.OptionFromOptionalKey(CodexPacketSlug).pipe(SchemaUtils.withNoneDefault),
    date: S.OptionFromOptionalKey(CaptureDate).pipe(SchemaUtils.withNoneDefault),
    branch: S.OptionFromOptionalKey(CodexPacketBranch).pipe(SchemaUtils.withNoneDefault),
    expectedCount: S.OptionFromOptionalKey(S.Int).pipe(SchemaUtils.withNoneDefault),
    existingPacketMode: CodexFindingsExistingPacketMode.pipe(SchemaUtils.withKeyDefaults("none")),
    dryRun: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
    json: S.Boolean.pipe(SchemaUtils.withKeyDefaults(false)),
  },
  $I.annote("CodexFindingsIngestOptions", {
    description: "Validated options accepted by `beep codex findings ingest`.",
  })
) {}

class CodexFindingsIngestCommandOptions extends S.Class<CodexFindingsIngestCommandOptions>(
  $I`CodexFindingsIngestCommandOptions`
)(
  {
    from: S.String,
    slug: S.Option(S.String),
    date: S.Option(S.String),
    branch: S.Option(S.String),
    expectedCount: S.Option(S.Int),
    existingPacketMode: CodexFindingsExistingPacketMode,
    dryRun: S.Boolean,
    json: S.Boolean,
  },
  $I.annote("CodexFindingsIngestCommandOptions", {
    description: "Resolved command-adapter options for Codex findings ingest.",
  })
) {}
```

The CLI adapter uses the shared exclusive resolver. Reads use derived guards, for example `CodexFindingsExistingPacketMode.is.refresh(mode)`.

### 5. Migration inventory

- `Findings.schemas.ts:350-389` — examples and `CodexFindingsIngestOptions` replace two defaulted booleans with one defaulted literal.
- `Findings.schemas.ts:15-18` — add `LiteralKit` to the existing `@beep/schema` import.
- `Findings.schemas.ts:411-414` — decoder now returns the literal field.
- `Findings.command.ts:102-112` — replace the local plain command-options pair with `existingPacketMode` (prefer an `S.Class` using the shared schema).
- `Findings.command.ts:195-213` — refresh provenance branches on the derived `refresh` guard.
- `Findings.command.ts:255-279` — pass `force: is.force(existingPacketMode)` only at the existing `writePacket` boundary; its separate function flag is out of this cluster.
- `Findings.command.ts:406-412` — delete validation call; options already contain a legal mode.
- `Findings.command.ts:431-459` — retain both flags, resolve once, and write the literal into command options.
- `Findings.refresh.ts:219-252` — delete `validateCodexFindingsIngestModes` and its boolean-shaped docs.
- `codex-findings-refresh.test.ts:373-390` — refresh fixture writes `existingPacketMode: "refresh"`.
- `codex-findings-refresh.test.ts:440-445` — move conflict coverage to CLI/shared adapter parsing; stop importing the deleted validator.
- `codex-findings-normalize.test.ts:304-310` — assert the decoder default is `existingPacketMode === "none"`.
- `codex-findings-write.test.ts:25-39,148-212` — unchanged: these tests exercise the lower `writePacket.force` function flag, not the ratified command-options cluster.

### 6. Guard-deletion accounting

- `Findings.refresh.ts:246-251` — delete the mutual-exclusion runtime guard.
- `Findings.command.ts:409` — delete the application-level validation call.
- `Findings.refresh.ts:219-241` — delete the comment/API describing coherence between two booleans.

### 7. Encoded-side impact

none (internal). `CodexFindingsIngestOptions` decodes command input but is not a persisted packet/wire document; packet JSON schemas remain unchanged.

### 8. Test impact

Update `packages/tooling/tool/cli/test/codex-findings-refresh.test.ts` and `packages/tooling/tool/cli/test/codex-findings-normalize.test.ts`. `packages/tooling/tool/cli/test/codex-findings-write.test.ts` remains unchanged for the distinct low-level force boundary.

### 9. Risk & sequencing

Land the schema/export before command and refresh consumers. Preserve the existing typed `mode-conflict` CLI error. This area is destructive, so do not broaden the refactor into `writePacket` promotion semantics.

---

## docgen-quality-scope-flags

### 1. Instance

- id: `docgen-quality-scope-flags`
- file: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:107`
- symbol: `resolveDocgenQualityTargets`
- members: `all`, `changedFiles`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:118` — `countSelectedScopes > 1` rejects combining `--package`, `--all`, and `--changed-files`; E2 at `Quality.scope.ts:140` — after the conflict check, readers take package, then all, then changedFiles versus default affected; combined-true is never a scope.

### 2. Current shape

```ts
export const resolveDocgenQualityTargets = Effect.fn("DocgenQuality.resolveDocgenQualityTargets")(function* ({
  all,
  changedFiles,
  packageSelector,
}: {
  readonly all: boolean;
  readonly changedFiles: boolean;
  readonly packageSelector: O.Option<string>;
}) {
  yield* assertNoOrphanDocgenConfigPaths();

  if (countSelectedScopes(packageSelector, all, changedFiles) > 1) {
    return yield* DomainError.make({
      message: "Choose only one docgen quality scope: --package, --all, or --changed-files.",
    });
  }

  if (O.isSome(packageSelector)) {
    return {
      scope: "package" as const,
      targets: [yield* resolveDocgenWorkspacePackage(packageSelector.value)] as const,
    };
  }

  const configuredPackages = yield* discoverDocgenWorkspacePackages().pipe(
    Effect.map(
      flow(
        A.filter((pkg: DocgenWorkspacePackage) => pkg.hasDocgenConfig),
        A.sort(byPackagePathAscending)
      )
    )
  );

  if (all) {
    return {
      scope: "all" as const,
      targets: configuredPackages,
    };
  }

  const repoRoot = yield* findRepoRoot();
  const scope: DocgenQualityScopeMode = changedFiles ? "changed-files" : "affected";
  const changed = yield* collectChangedFiles(repoRoot, scope);

  return {
    scope,
    targets: selectPackagesForFiles(configuredPackages, changed),
  };
});
```

### 3. Cardinality gap

The two ratified booleans represent four combinations but have three legal semantic states: `affected`, `all`, and `changed-files`. `all + changed-files` is illegal. The sibling package selector is a separate payload axis; when present it selects the existing `package` scope and may not combine with either explicit boolean scope.

### 4. Target schema

Reuse `DocgenQualityScopeMode` at `Quality.schemas.ts:49-70`; it already owns `affected | package | changed-files | all`. Do not mint a duplicate. Because only the `package` variant carries a selector payload, derive the complete resolver input as a tagged union from that existing LiteralKit:

```ts
const DocgenQualityScopeModeKit = LiteralKit(["affected", "package", "changed-files", "all"])

class AffectedScope extends S.Class<AffectedScope>($I`AffectedScope`)({ scope: S.tag("affected") }) {}
class PackageScope extends S.Class<PackageScope>($I`PackageScope`)(
  { scope: S.tag("package"), packageSelector: S.String },
  $I.annote("PackageScope", { description: "One explicitly selected docgen package." })
) {}
class ChangedFilesScope extends S.Class<ChangedFilesScope>($I`ChangedFilesScope`)({
  scope: S.tag("changed-files"),
}) {}
class AllScope extends S.Class<AllScope>($I`AllScope`)({ scope: S.tag("all") }) {}

export const ResolveDocgenQualityTargetsOptions = DocgenQualityScopeModeKit.mapMembers(
  Tuple.evolve([() => AffectedScope, () => PackageScope, () => ChangedFilesScope, () => AllScope])
).pipe(
  $I.annoteSchema("ResolveDocgenQualityTargetsOptions", {
    description: "Resolved docgen quality scope with payload only for package selection.",
  }),
  S.toTaggedUnion("scope")
)
export type ResolveDocgenQualityTargetsOptions = typeof ResolveDocgenQualityTargetsOptions.Type
```

Keep `DocgenQualityScopeMode` built from `DocgenQualityScopeModeKit`; this is one literal domain, not a duplicate. The command adapter resolves `all`/`changedFiles` with fallback `affected`; if `packageSelector` is Some, it rejects any explicit non-affected flag and constructs the `package` case. Internal callers construct one schema-derived case, so a package scope without its selector is unrepresentable.

### 5. Migration inventory

- `Quality.scope.ts:74-75` — delete `countSelectedScopes`.
- `Quality.schemas.ts:8-17,49-70` — name the existing LiteralKit base, import `Tuple`, and derive/export the resolver-options tagged union from it.
- `Quality.scope.ts:19-21` — import the schema-derived resolver options/cases and the existing mode type.
- `Quality.scope.ts:92-96` — update example to `scope: "changed-files"`.
- `Quality.scope.ts:107-154` — accept the schema-derived union; delete boolean reads and match on `scope`, reading `packageSelector` only from the package case.
- `Docgen.command.ts:114,119,677-697` — keep CLI flags, resolve one scope at the adapter, and call with `{ scope, packageSelector }`.
- `internal/Targets.ts:257-280,292-296` — its worker-eval input still has its own `all` flag, but it writes `scope: all ? "all" : package ? "package" : "affected"` once instead of passing booleans onward.
- `docgen.test.ts:2540-2601` — `quality --changed-files --json` remains unchanged and continues asserting encoded scope `changed-files`.

### 6. Guard-deletion accounting

- `Quality.scope.ts:74-75` — delete boolean selector counting.
- `Quality.scope.ts:118-122` — delete the broad three-input coherence guard; only the adapter validates package payload versus explicit scope.
- `Quality.scope.ts:140-149` — delete the `if (all)` plus `changedFiles ? ...` chain.
- `Quality.scope.ts:33-39` — retain the changed-files probe comment; it describes git behavior, not boolean coherence.

### 7. Encoded-side impact

none (internal). Quality reports already encode `DocgenQualityScopeMode`; their JSON stays stable.

### 8. Test impact

`packages/tooling/tool/cli/test/docgen.test.ts` is the only test file exercising the ratified members. Retain changed-files coverage and add adapter conflict coverage for `--all --changed-files` and package-plus-explicit-scope.

### 9. Risk & sequencing

Shares `Docgen.command.ts` and `docgen.test.ts` with the local-plan instance; apply serially. The literal domain remains `DocgenQualityScopeMode`; the derived tagged union exists only because `package` alone carries a selector payload.

---

## goals-portfolio-index-mode

### 1. Instance

- id: `goals-portfolio-index-mode`
- file: `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:259`
- symbol: `runGoalsIndex`
- members: `write`, `check`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts:263` — `--write` and `--check` are rejected as mutually exclusive; E2 at `PortfolioIndex.ts:268` — if write / if check / else print, with combined-true never reaching a handler.

### 2. Current shape

```ts
const runGoalsIndex = Effect.fn("Goals.runGoalsIndex")(function* (options: {
  readonly write: boolean;
  readonly check: boolean;
}) {
  if (options.write && options.check) {
    yield* Console.error("[goals:index] --write and --check are mutually exclusive.");
    return yield* failWithReportedExit("goals index: --write and --check are mutually exclusive.");
  }

  if (options.write) {
    yield* writePortfolioIndex();
    yield* Console.log(`[goals:index] wrote ${PORTFOLIO_INDEX_PATH}.`);
    return;
  }

  const content = yield* buildPortfolioIndexContent();
  if (options.check) {
    const fs = yield* FileSystem.FileSystem;
    const existing = yield* fs
      .readFileString(PORTFOLIO_INDEX_PATH)
      .pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>));
    if (O.isNone(existing) || existing.value !== content) {
      yield* Console.error(
        `[goals:index] ${PORTFOLIO_INDEX_PATH} drifts from goals/*/ops/manifest.json; run \`bun run beep goals index --write\`.`
      );
      return yield* failWithReportedExit("goals index: INDEX.md drift detected.");
    }
    yield* Console.log(`[goals:index] OK: ${PORTFOLIO_INDEX_PATH} matches the manifests.`);
    return;
  }

  yield* Console.log(content);
});
```

### 3. Cardinality gap

Four pairs are representable. Legal states are `print`, `write`, and `check`; `write + check` is illegal.

### 4. Target schema

Reuse the family `PrintWriteCheckMode` LiteralKit schema; do not create a goals-local duplicate.

```ts
const runGoalsIndex = Effect.fn("Goals.runGoalsIndex")(function* (mode: PrintWriteCheckMode) {
  return yield* PrintWriteCheckModeMatch(mode, {
    print: () => buildPortfolioIndexContent().pipe(Effect.flatMap(Console.log)),
    write: Effect.fnUntraced(function* () {
      yield* writePortfolioIndex()
      yield* Console.log(`[goals:index] wrote ${PORTFOLIO_INDEX_PATH}.`)
    }),
    check: Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem
      const content = yield* buildPortfolioIndexContent()
      const existing = yield* fs
        .readFileString(PORTFOLIO_INDEX_PATH)
        .pipe(Effect.map(O.some), Effect.orElseSucceed(O.none<string>))
      if (O.isNone(existing) || existing.value !== content) {
        yield* Console.error(
          `[goals:index] ${PORTFOLIO_INDEX_PATH} drifts from goals/*/ops/manifest.json; run \`bun run beep goals index --write\`.`
        )
        return yield* failWithReportedExit("goals index: INDEX.md drift detected.")
      }
      yield* Console.log(`[goals:index] OK: ${PORTFOLIO_INDEX_PATH} matches the manifests.`)
    }),
  })
})
```

### 5. Migration inventory

- `PortfolioIndex.ts:254-257` — retain legacy `writeFlag` and `checkFlag` only at the CLI boundary.
- `PortfolioIndex.ts:259-291` — replace options with `PrintWriteCheckMode`; delete boolean reads and match exhaustively.
- `PortfolioIndex.ts:312-317` — resolve flags through the shared exclusive resolver with fallback `print`, then call `runGoalsIndex(mode)`.
- `Goals.command.ts:35-36` — help text remains valid and unchanged.
- `Quality/Tasks.ts:1777` — `goals index --check` invocation remains unchanged.
- `quality-tasks.test.ts:1227,1261` — expected `goals:index-check` lane remains unchanged.

### 6. Guard-deletion accounting

- `PortfolioIndex.ts:263-266` — delete the local mutual-exclusion guard and duplicate error branch.
- `PortfolioIndex.ts:268-290` — delete the write/check/else conditional chain.
- `PortfolioIndex.ts:298-299` — update prose that describes behavior through absence of `--write` rather than the three legal modes.

### 7. Encoded-side impact

none (internal). Generated `goals/INDEX.md` bytes and CLI flags stay identical.

### 8. Test impact

No dedicated test directly constructs the current pair. `packages/tooling/tool/cli/test/quality-tasks.test.ts` only asserts the stable `--check` argv. Add focused command-adapter tests for print/write/check/conflict when applying.

### 9. Risk & sequencing

Requires shared `PrintWriteCheckMode` and exclusive resolution. Keep index rendering/writing byte-identical; this refactor must not touch generated output.

---

## generated-file-drift-mode-flags

### 1. Instance

- id: `generated-file-drift-mode-flags`
- file: `packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:49`
- symbol: `assertExclusiveModeFlags`
- members: `write`, `check`
- evidence: E3 at `packages/tooling/tool/cli/src/internal/artifacts/GeneratedFileDrift.ts:53` — `assertExclusiveModeFlags` fails `onConflict` when write and check are both true.

### 2. Current shape

```ts
export const assertExclusiveModeFlags = <E, R>(input: {
  readonly write: boolean;
  readonly check: boolean;
  readonly onConflict: Effect.Effect<never, E, R>;
}): Effect.Effect<void, E, R> => (input.write && input.check ? input.onConflict : Effect.void);
```

### 3. Cardinality gap

Four pairs are representable. Three flag selections are legal: no explicit mode, `write`, and `check`; both is illegal. The no-flag and explicit-check selections have the same generated-file behavior, so the honest application domain has two modes: `write` and `check`.

### 4. Target schema

Delete `assertExclusiveModeFlags`. Reuse the family `WriteCheckRunMode`, derived by `LiteralKit(RunModeKit.pickOptions(["check", "write"]))`. Change the downstream helper to:

```ts
export const syncGeneratedFile = <E, R>(input: {
  readonly mode: WriteCheckRunMode
  readonly path: string
  readonly content: string
  readonly onWrote: Effect.Effect<void, E, R>
  readonly onMissing: Effect.Effect<never, E, R>
  readonly onStale: Effect.Effect<never, E, R>
  readonly onCurrent: Effect.Effect<void, E, R>
  readonly onError: (cause: unknown) => E
}): Effect.Effect<void, E, FileSystem.FileSystem | Path.Path | R> =>
  WriteCheckRunModeIs.write(input.mode)
    ? writeGeneratedFile({
        path: input.path,
        content: input.content,
        onWrote: input.onWrote,
        onError: input.onError,
      })
    : checkGeneratedFile({
        path: input.path,
        content: input.content,
        onMissing: input.onMissing,
        onStale: input.onStale,
        onCurrent: input.onCurrent,
        onError: input.onError,
      })
```

CLI adapters resolve no flags to `check`, preserving current generated-file semantics.

### 5. Migration inventory

- `GeneratedFileDrift.ts:27-53` — delete the assertion API, docs, input writes, and boolean read.
- `GeneratedFileDrift.ts:144-191` — rename `syncGeneratedFile.write` to `mode`, update its example, and dispatch with the derived literal guard.
- `internal/artifacts/index.ts:10` — wildcard export naturally drops the deleted assertion and exports the revised sync API.
- `artifacts-io.test.ts:1-9,96-115` — stop importing/testing `assertExclusiveModeFlags`; test shared adapter conflict behavior elsewhere.
- `artifacts-io.test.ts:181-199` — write `mode: "write"` in the sync dispatch fixture.
- Whole-repo search found no production call to either `assertExclusiveModeFlags` or `syncGeneratedFile`; the only current consumers are this test and documentation examples.

### 6. Guard-deletion accounting

- `GeneratedFileDrift.ts:49-53` — delete the entire runtime coherence guard.
- `GeneratedFileDrift.ts:1-13,27-47` — delete comments that advertise boolean validation as application infrastructure.
- `artifacts-io.test.ts:96-115` — delete the guard-specific test.

### 7. Encoded-side impact

none (internal). The helper does not encode its options.

### 8. Test impact

Only `packages/tooling/tool/cli/test/artifacts-io.test.ts` touches these members. Update the dispatch test and rely on `cli-kits.test.ts` for shared conflict resolution.

### 9. Risk & sequencing

Because the helper currently has no production caller, P4 must not claim a behavior migration that does not exist. Land the shared literal first, delete the orphan guard, and keep filesystem branch behavior unchanged.

---

## fallow-boundaries-mode

### 1. Instance

- id: `fallow-boundaries-mode`
- file: `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:460`
- symbol: `fallow boundaries flags`
- members: `write`, `check`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Fallow/Fallow.command.ts:472` — runtime guard `fallow boundaries: --write and --check are mutually exclusive.` rejects the illegal combination the type permits.

### 2. Current shape

```ts
const boundariesCommand = Command.make(
  "boundaries",
  {
    output: Flag.string("output").pipe(
      Flag.withAlias("o"),
      Flag.withDefault(DEFAULT_BOUNDARY_CONFIG_PATH),
      Flag.withDescription("Generated Fallow boundary config path")
    ),
    write: Flag.boolean("write").pipe(Flag.withDescription("Write the generated boundary config")),
    check: Flag.boolean("check").pipe(Flag.withDescription("Fail when the generated boundary config is stale")),
  },
  Effect.fn(function* ({ output, write, check }) {
    if (write && check) {
      yield* Console.error("fallow boundaries: --write and --check are mutually exclusive.");
      return yield* failWithReportedExit("fallow boundaries: choose either --write or --check.");
    }

    const repoRoot = yield* findRepoRoot();
    const outputPath = yield* resolveOutputPath(repoRoot, output);
    const expectedText = yield* renderBoundaryConfig(repoRoot, outputPath);

    if (write) {
      yield* writeBoundaryConfig(outputPath, expectedText);
      yield* Console.log(`fallow boundaries: wrote ${outputPath}.`);
      return;
    }

    if (check) {
      yield* checkBoundaryConfig(outputPath, expectedText);
      yield* checkDoctrineBoundaries(repoRoot, outputPath);
      return;
    }

    yield* Console.log(expectedText);
  })
).pipe(Command.withDescription("Generate the advisory Fallow boundary config from workspace dependency metadata"));
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `print`, `write`, and `check`; the combined mode is illegal.

### 4. Target schema

Reuse the family `PrintWriteCheckMode`. Keep both Flag declarations, resolve them at the adapter with fallback `print`, and move the existing branch bodies behind an exhaustive literal match.

```ts
const runFallowBoundaries = Effect.fn("Fallow.runBoundaries")(function* (
  output: string,
  mode: PrintWriteCheckMode
) {
  const repoRoot = yield* findRepoRoot()
  const outputPath = yield* resolveOutputPath(repoRoot, output)
  const expectedText = yield* renderBoundaryConfig(repoRoot, outputPath)

  return yield* PrintWriteCheckModeMatch(mode, {
    print: () => Console.log(expectedText),
    write: Effect.fnUntraced(function* () {
      yield* writeBoundaryConfig(outputPath, expectedText)
      yield* Console.log(`fallow boundaries: wrote ${outputPath}.`)
    }),
    check: Effect.fnUntraced(function* () {
      yield* checkBoundaryConfig(outputPath, expectedText)
      yield* checkDoctrineBoundaries(repoRoot, outputPath)
    }),
  })
})
```

### 5. Migration inventory

- `Fallow.command.ts:460-470` — CLI parser remains source of the two legacy booleans.
- `Fallow.command.ts:471-494` — resolve `PrintWriteCheckMode`, delete boolean carry, and exhaustively dispatch print/write/check.
- `package.json:310,332-334` — preflight and three Fallow scripts retain their current argv unchanged.
- `DeletePackage.command.ts:403` — generated baseline writer continues invoking `fallow boundaries --write` unchanged.
- `Quality/FallowQuality.command.ts:2052` — wrapper script choice remains unchanged.
- `quality-tasks.test.ts:619,627,853,856` and `ci-lane.test.ts:316` — related lane/script assertions do not construct the pair and remain unchanged.

### 6. Guard-deletion accounting

- `Fallow.command.ts:472-475` — delete the local mutual-exclusion guard and duplicate error reporting.
- `Fallow.command.ts:481-493` — delete the `if (write)`, `if (check)`, else-print chain.
- `GeneratedFileDrift.ts:6-13` — when the shared docs are updated, stop citing Fallow as a consumer of boolean assertion infrastructure.

### 7. Encoded-side impact

none (internal). The generated Fallow JSONC bytes and public CLI spellings are unchanged.

### 8. Test impact

No test directly drives the raw `fallow boundaries` flag pair. `packages/tooling/tool/cli/test/quality-tasks.test.ts` and `packages/tooling/tool/cli/test/ci-lane.test.ts` only assert stable related argv/lane state. Add focused command tests for all modes and the conflict during P4.

### 9. Risk & sequencing

Land after `PrintWriteCheckMode` and the exclusive resolver. Generated-file output is repository governance state, so prove byte identity without changing render/check functions.

---

## sync-data-to-ts-run-mode

### 1. Instance

- id: `sync-data-to-ts-run-mode`
- file: `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.command.ts:39`
- symbol: `sync-data-to-ts mode flags`
- members: `check`, `dryRun`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/SyncDataToTs/SyncDataToTs.command.ts:63` — `runModeFlagConflictError` says `The --check and --dry-run flags are mutually exclusive.`; `resolveRunMode` at line 66 already collapses to the `SyncDataRunMode` literal via shared RunMode helpers.

### 2. Current shape

```ts
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDescription("Report drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(Flag.withDescription("Preview file updates without writing them"));
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `write` (neither flag), `check`, and `dry-run`; combined flags are illegal.

### 4. Target schema

Reuse `SyncDataRunMode`, already an alias of the shared `RunMode` LiteralKit schema at `SyncDataToTs.schemas.ts:82-99`. Keep the two parser flags, but resolve them with:

```ts
const mode: SyncDataRunMode = yield* resolveExclusiveRunModeFromFlags(
  [check, "check"],
  [dryRun, "dry-run"],
  "write",
  Effect.fail(runModeFlagConflictError())
)
```

Pass `mode` directly to the already literal-typed workflow; no new domain or stored state is needed.

### 5. Migration inventory

- `SyncDataToTs.command.ts:16` — replace local shared-helper aliases with `resolveExclusiveRunModeFromFlags`.
- `SyncDataToTs.command.ts:39-42` — retain CLI flags only at the parser boundary.
- `SyncDataToTs.command.ts:61-77` — delete local `resolveRunMode`; keep the error factory for adapter failure.
- `SyncDataToTs.command.ts:539-565` — collapse flags immediately, then all reads continue using the existing `mode` at lines 555-564.
- `SyncDataToTs.schemas.ts:82-99` — unchanged target schema owner.
- `sync-data-to-ts.test.ts:603,621` — valid `--dry-run` and `--check` command cases remain unchanged; add the combined conflict if absent.
- `cli-kits.test.ts:85-99,110-115` — update shared resolver/conflict coverage for the new exclusive helper.

### 6. Guard-deletion accounting

- `SyncDataToTs.command.ts:66-77` — delete the local conflict conditional and two-step resolution wrapper.
- `SyncDataToTs.command.ts:61-64` — retain only the typed error constructor; it is no longer paired with a local boolean guard.
- `RunMode.ts:176-199` — update comments that instruct every command to duplicate a gate before resolution.

### 7. Encoded-side impact

none (internal). Report JSON already receives the literal `mode`; its representation is unchanged.

### 8. Test impact

Update `packages/tooling/tool/cli/test/sync-data-to-ts.test.ts` only to add/retain conflict coverage and `packages/tooling/tool/cli/test/cli-kits.test.ts` for the shared adapter. Existing valid argv stays unchanged.

### 9. Risk & sequencing

This is the lowest-risk exemplar because application code already consumes `SyncDataRunMode`. Land after the shared helper and use it to validate the family pattern before broader migrations.

---

## skills-run-mode

### 1. Instance

- id: `skills-run-mode`
- file: `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:300`
- symbol: `skills mode flags`
- members: `check`, `dryRun`
- evidence: E3 at `packages/tooling/tool/cli/src/commands/Skills/Skills.command.ts:876` — `resolveMode` fails on `check && dryRun` (`mutually exclusive`) then if-chains to the `SkillsRunMode` literal declared at line 40.

### 2. Current shape

```ts
const checkFlag = Flag.boolean("check").pipe(
  Flag.withDescription("Report skill drift without writing files and exit non-zero when changes are needed")
);
const dryRunFlag = Flag.boolean("dry-run").pipe(
  Flag.withDescription("Preview skill updates without writing files or failing on drift")
);
```

### 3. Cardinality gap

Four pairs are representable. Legal modes are `write` (neither flag), `check`, and `dry-run`; combined flags are illegal.

### 4. Target schema

Preserve the existing symbol name but replace the hand-written union at `Skills.command.ts:40` with the shared LiteralKit schema:

```ts
const SkillsRunMode = RunMode
type SkillsRunMode = RunModeValue

class SkillsUpdateOptions extends S.Class<SkillsUpdateOptions>($I`SkillsUpdateOptions`)(
  {
    mode: SkillsRunMode,
    skill: S.Option(S.String),
  },
  $I.annote("SkillsUpdateOptions", { description: "Resolved options for the skills update workflow." })
) {}
```

Import runtime `RunMode` and its type from `internal/cli/RunMode.ts`. Resolve the parser flags through the shared exclusive resolver before constructing `SkillsUpdateOptions`.

### 5. Migration inventory

- `Skills.command.ts:40` — replace the hand-rolled literal union with runtime/type aliases to shared `RunMode`; do not mint another literal set.
- `Skills.command.ts:300-305` — retain flags only at the CLI boundary.
- `Skills.command.ts:859-885` — `printDriftReport` keeps literal mode; delete local `resolveMode`.
- `Skills.command.ts:904-975` — replace the plain options literal with `SkillsUpdateOptions`; all reads already use `options.mode` and need no semantic change.
- `Skills.command.ts:977-998` — resolve flags once, construct schema-backed options, and call the workflow.
- `skills-command.test.ts:1,262` — existing direct `runSkillsUpdate({ mode: "write", ... })` remains semantically valid; construct `SkillsUpdateOptions.make(...)` if the function requires class instances.
- `cli-kits.test.ts:85-115` — shared resolver owns mode/conflict unit coverage.

### 6. Guard-deletion accounting

- `Skills.command.ts:875-885` — delete the local `check && dryRun` guard and nested ternary resolver.
- `Skills.command.ts:40` — delete the comment-only/hand-written invariant embodied by a bare literal union rather than a schema.
- `Skills.command.ts:984-986` — delete the boolean-to-mode application step; the adapter supplies an already legal mode.

### 7. Encoded-side impact

none (internal). `skills-lock.json` and `.codex/config.toml` output formats are unaffected.

### 8. Test impact

`packages/tooling/tool/cli/test/skills-command.test.ts` only calls the workflow with `mode: "write"`; update construction if needed. Add CLI conflict coverage and rely on `packages/tooling/tool/cli/test/cli-kits.test.ts` for shared resolution.

### 9. Risk & sequencing

Land after shared `RunMode` exports. `Skills.command.ts` is large, but downstream logic already uses a literal, so constrain the change to schema ownership, adapter collapse, and option construction.
