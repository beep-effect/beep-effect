### sol-2-1

- file: scratchpad/effected/workspaces/WorkspaceSnapshots.ts:257
- class: bug   severity: required
- standard: D11; D9 / §14 (`upstream-bug`); the recorded Bun top-level catalog correction; `WorkspaceSnapshots.ts:465–472` explicitly requires ref and worktree catalog assembly to agree.   evidence: A read-only `bun --no-cache -e` probe provided scripted Git data containing `package.json` with `workspaces: ["packages/*"]`, `catalog: { effect: "^4.0.0" }`, and `catalogs: { build: { typescript: "^6.0.0" } }`, with no lockfile. `CatalogSet.fromManifestWorkspaces` and the worktree snapshot returned both catalogs, but `at("HEAD").catalogs.entries` returned `{}`. Resolving `effect` with `catalog:` returned `None` in the ref snapshot and `Some("^4.0.0")` in the worktree snapshot. The pinned oracle contains the same incomplete `bunInlineCatalogs` implementation; the accepted deviation fixes the live reader without fixing this separate historical reader.
- failure: A valid Bun workspace loses its top-level default and named catalogs when captured at a Git ref. Comparing an unchanged ref and worktree can therefore produce different dependency resolutions. A committed lockfile can also supply an older catalog value that the ignored inline manifest should override.
- fix: Extend `bunInlineCatalogs` to normalize the manifest’s top-level `catalog`/`catalogs` and merge them with the workspaces-object catalogs, retaining the recorded precedence and the historical reader’s tolerant handling. Add a ref/worktree parity regression with top-level catalogs and no lockfile.

### sol-2-2

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:95
- class: schema   severity: required
- standard: `standards/effect-first-development.md`, tagged-error template: “Cause-carrying errors declare `cause: S.Defect({ includeStack: true })` explicitly in their fields”; D11.   evidence: Both `WorkspaceDiscoveryError.cause` here and `WorkspaceManifestError.cause` at `WorkspacePackage.ts:135` still use `S.Defect()`. A read-only encoding probe constructed each error with `new Error("original")` as its cause. Both encoded causes were `{"name":"Error","message":"original"}`, with `stackPresent false`; the `S.Defect({ includeStack: true })` control retained the stack. Round-1 r01 repaired three other error schemas and did not cover these two declarations.
- failure: Encoding either public error discards the originating failure’s stack, contrary to the explicit cause-schema requirement. The green gates do not establish stack preservation at these remaining sites.
- fix: Change both cause fields to `S.Defect({ includeStack: true })`, retaining their annotations. Add a stack-preservation encoding assertion for each error.

### sol-2-3

- file: scratchpad/effected/workspaces/WorkspaceDiscovery.ts:1078
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 17; `standards/effect-first-development.md` EF-12b and EF-35 require schema-owned structural constraints and guards derived with `S.is(...)`; D11.   evidence: `isStringRecord` manually defines the dependency-map constraint through `P.isObject(value) && R.values(value).every(P.isString)`. It controls all four dependency fields at lines 543–546, although `WorkspacePackage.fields.dependencies` already owns the corresponding record schema. A read-only probe confirmed equivalent acceptance for valid string records, empty records, mixed-value records, arrays, null, and functions. Round-1 r45 repaired this duplication in `WorkspacesSync.ts`; this independent discovery implementation remains.
- failure: Async discovery maintains a second handwritten definition of the model’s dependency-map contract. Its tolerant boundary decision can drift independently from the schema that subsequently constructs `WorkspacePackage`; the schema-derived guard requirement remains unmet despite green gates.
- fix: Derive the guard from the existing dependency-field schema, or its underlying record schema if needed to preserve missing-value handling. Retain the current all-or-nothing fallback for malformed dependency maps and the defaults for omitted maps.

### sol-2-4

- file: scratchpad/effected/workspaces/WorkspaceRoot.ts:56
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5; `standards/schema-first-development-prompt.md`, “Schema owns pure data,” explicitly includes configuration payloads; `standards/effect-first-development.md` EF-33; D11.   evidence: `FindWorkspaceRootOptions` remains a pure interface containing `stopAt` and `maxDepth`. The same gap remains in `WorkspaceDiscoveryOptions` at `WorkspaceDiscovery.ts:267`, `WorkspaceCatalogsOptions` at `WorkspaceCatalogs.ts:798`, and `WorkspaceSnapshotsOptions` at `WorkspaceSnapshots.ts:104`. These contain only schema-representable configuration data. Unlike the adjacent service shapes, they contain no operations or dependency-inversion contract. The recorded schema-first deviation names the repaired `LockfileReaderOptions`; it does not grant an exception for these remaining options models.
- failure: Four public configuration models have no owning runtime schema. Their types, optionality, annotations, and any future construction or decoding remain independent rather than deriving from the required executable contract.
- fix: Define annotated structural schemas and derive the existing option type names from `.Type`. Preserve exact optional-key semantics, explicit `undefined` where currently accepted, lazy cwd resolution, and existing runtime validation/default behavior.

### sol-2-5

- file: scratchpad/effected/workspaces/WorkspacePackage.ts:93
- class: schema   severity: required
- standard: `standards/ARCHITECTURE.md`, Core Principle 5; `standards/effect-first-development.md` EF-33 and EF-12b; `standards/schema-first-development-prompt.md`, “Schema owns pure data”; D11.   evidence: `DependencyDiff` is a handwritten result payload with three record fields and a nested `{ from, to }` payload. Other remaining schema-representable data models in the focus files are `LayeringGraph` at `WorkspaceLayering.ts:73`, the named and matched `Place` variant union at `WorkspaceLayering.ts:159`, `ImporterVersions` at `WorkspaceCatalogs.ts:90`, `Assembled` at `WorkspaceCatalogs.ts:618`, and `LockfileRecord` at `WorkspaceSnapshots.ts:274`. None is a service contract, overload surface, or type-level utility. `WorkspaceStateSnapshot.ts:202` separately spells the importer-version runtime record shape instead of sharing an owner with `ImporterVersions`.
- failure: These named domain inputs, results, and intermediate values remain type-only models. In particular, importer versions have separate type and runtime-schema definitions, while layering classification maintains a handwritten variant model used by construction and branching. The required schema source of truth is absent.
- fix: Introduce annotated structural schemas for these payloads, reuse the importer-version schema in `WorkspaceStateSnapshot`, and derive the existing types from their schemas. Model `Place` as a schema-backed discriminated union. Preserve plain record results, field mutability, ordering, and accepted values.

REQUIRED: 5
BACKLOG: 0