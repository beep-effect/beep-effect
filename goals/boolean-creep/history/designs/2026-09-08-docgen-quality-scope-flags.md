# Superseded out-of-scope design

Withdrawn on 2026-09-08 against source `7440cb8c4302ce64b87860069a464bafbf65f576`.
This declaration contains only inline function flag parameters, explicitly
excluded by SPEC and `ops/prompts/sweep-lane-round1.md:44`. Supported callers
invoke the resolver directly; no all/changedFiles state carrier is stored.
Its current orphan-audit and conflict error precedence remain outside this
campaign. See `data/design-refresh-2026-09-08-tooling-baseline.md`.
This historical design is not an implementation instruction.

# docgen-quality-scope-flags

This is the per-instance GATE 2 review surface. It uses the shared literal schemas and CLI-boundary resolvers specified in [family-cli-mode-flags.md](./family-cli-mode-flags.md); the instance-specific contract follows in full.


### 1. Instance

- id: `docgen-quality-scope-flags`
- file: `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:107`
- symbol: `resolveDocgenQualityTargets`
- members: `all`, `changedFiles`
- evidence: E2 at `packages/tooling/tool/cli/src/commands/Docgen/internal/quality/Quality.scope.ts:140` — after the conflict check, readers take package, then all, then changedFiles versus default affected; combined-true is never a scope. The `countSelectedScopes > 1` guard at line 118 is supporting evidence, not E3.

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
- `Docgen.command.ts:131,143,782-795` — keep the CLI flags and resolve one
  complete tagged case at the adapter. After rejecting package-plus-explicit
  scope, `Some(packageSelector)` constructs
  `ResolveDocgenQualityTargetsOptions.cases.package.make({ packageSelector })`.
  With no selector, exhaustively map the resolved literal to the payload-free
  `all`, `changed-files`, or `affected` case constructor. Pass that case value
  directly; never call the resolver with a `{ scope, packageSelector }` bag.
- `internal/Targets.ts:257-280,292-296` — its worker-eval input still has its
  own `all` flag. Reject `all` plus a package selector with the same tagged
  conflict error before constructing anything. Then construct the `package`
  case with the narrowed `Some.value`, or the payload-free `all`/`affected`
  case when no selector exists. Never use a precedence ternary or build a
  package case without its required string payload.
- `docgen.test.ts:2998` and its enclosing case — `quality --changed-files --json` remains unchanged and continues asserting encoded scope `changed-files`.

### 6. Guard-deletion accounting

- `Quality.scope.ts:74-75` — delete boolean selector counting.
- `Quality.scope.ts:118-122` — delete the broad three-input coherence guard; only the adapter validates package payload versus explicit scope.
- `Quality.scope.ts:140-149` — delete the `if (all)` plus `changedFiles ? ...` chain.
- `Quality.scope.ts:33-39` — retain the changed-files probe comment; it describes git behavior, not boolean coherence.

### 7. Encoded-side impact

none (internal). Quality reports already encode `DocgenQualityScopeMode`; their JSON stays stable.

### 8. Test impact

Retain changed-files coverage and add adapter conflict coverage for
`--all --changed-files`, package-plus-explicit-scope, and the worker-eval
`all + package` combination. The last case must prove rejection occurs before
any tagged scope is constructed.

### 9. Risk & sequencing

Shares `Docgen.command.ts` and `docgen.test.ts` with the local-plan instance;
apply serially. The literal domain remains `DocgenQualityScopeMode`; the
derived tagged union exists only because `package` alone carries a selector
payload. Preserve command-specific conflict errors at every adapter boundary.
