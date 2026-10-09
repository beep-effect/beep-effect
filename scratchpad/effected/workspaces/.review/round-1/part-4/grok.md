I'll review the workspaces port against the pinned upstream oracle and the binding decisions, starting with the decision log, port notes, and the files in this brief.The brief is a behaviour-preserving port review. I'll read the deviation protocol and the module's recorded notes, then diff these files against the pinned upstream oracle.Port notes record no deviations. Next I’ll diff the brief’s files against the pinned upstream sources and look for behaviour or law breaks the gates would miss.The export surface matches. I’ll compare the small internals first, where a HashSet swap or a prototype-key change would actually change behaviour.The prior pass left six unrecorded behaviour changes. I am checking those call sites against the pinned oracle before writing the report.The lab sites match the earlier notes. Next I am reading the oracle counterparts and the tests that pin the error class.### grok-1-1
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:669
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 11.1, section 14   evidence: Oracle `src/WorkspacesSync.ts:626` throws `new RangeError(\`getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}\`)`. Oracle `__test__/WorkspacesSync.test.ts:206-208` asserts `RangeError`. The lab test `scratchpad/test/workspaces/WorkspacesSync.test.ts:209-211` asserts `WorkspaceEnumerationDepthError`. README Port notes and the `w4-workspaces` ledger row both record no deviations. `traverse.ts:49` still describes this path as a thrown `RangeError`. `.patterns/error-handling.md` does not require a tagged error for this synchronous throw.
- failure: `getWorkspacePackagesSync` throws `WorkspaceEnumerationDepthError` (`WorkspacesSync.ts:59`). `instanceof RangeError` is false. The sentence is unchanged. The new class is exported from this module while README Added exports is None, and the upstream assertion was retargeted with no ledger entry.
- fix: Throw `new RangeError(\`getWorkspacePackagesSync: ${badMaxDepthMessage(maxDepth)}\`)`, delete `WorkspaceEnumerationDepthError`, and restore the three `RangeError` assertions.

### grok-1-2
- file: scratchpad/effected/workspaces/WorkspacesSync.ts:284
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/WorkspacesSync.ts:243` uses `new Error("package.json is not a JSON object")`, and lines 485 and 493 use `new Error(\`version must be a string, got ${typeof version}\`)` and `new Error("version must be a non-empty string")`. The same sentences are still what `scratchpad/test/workspaces/WorkspacesSync.test.ts:668-670` reads from `cause.message`. No deviation is recorded.
- failure: Those three `invalidShape` causes (`WorkspacesSync.ts:284`, `:527`, `:535`) are `WorkspaceSyncManifestError` (`:35`), so the skip `cause` carries `_tag: "WorkspaceEnumerationDepthError"`'s sibling tag `WorkspaceSyncManifestError` and `name` `WorkspaceSyncManifestError`. `instanceof Error` and `.message` still hold. Section 14 counts a new error tag as a deviation.
- fix: Restore the three `new Error(...)` values and delete `WorkspaceSyncManifestError`.

### grok-1-3
- file: scratchpad/effected/workspaces/internal/enumerate.ts:75
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/internal/enumerate.ts:60` is `Effect.die(new Error(\`enumerate: ${badMaxDepthMessage(maxDepth)}\`))`. The lab dies with `EnumerationOptionsError.make` (`enumerate.ts:23`). No deviation is recorded.
- failure: A bad `maxDepth` defect is `EnumerationOptionsError` (`_tag` and `name` `EnumerationOptionsError`). The message text is the upstream sentence. Callers inspecting the die value no longer see a plain `Error`.
- fix: Restore `Effect.die(new Error(\`enumerate: ${badMaxDepthMessage(maxDepth)}\`))` and delete `EnumerationOptionsError`.

### grok-1-4
- file: scratchpad/effected/workspaces/internal/packedInstallPlan.ts:244
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/internal/packedInstallPlan.ts:224` returns `Result.fail(new Error("package.json is not an object"))`. Syntax errors still return the `JSON.parse` throw (`packedInstallPlan.ts:238-241`, matching the oracle). No deviation is recorded.
- failure: A parsed non-object manifest fails as `PackedManifestError` (`packedInstallPlan.ts:24`) with the same message. The failure value's `_tag` and `name` are `PackedManifestError`.
- fix: Return `Result.fail(new Error("package.json is not an object"))` and delete `PackedManifestError`.

### grok-1-5
- file: scratchpad/effected/workspaces/internal/configDependencyShared.ts:96
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/internal/configDependencyShared.ts:79-81` is `Effect.try({ try: () => JSON.parse(text.value), catch: (cause) => hooksError(name, cause) })`, so `cause` is the `SyntaxError`. Lab `S.decodeEffect(JsonValue)` maps the failure through `hooksError`. `SchemaGetter.parseJson` (`packages/effect/src/SchemaGetter.ts:1264-1270`) drops that `SyntaxError` and fails with `SchemaIssue.InvalidValue` expected `"a valid JSON string"`. `SchemaError.message` (`Schema.ts:1220-1221`) is `SchemaIssue.defaultFormatter`, which renders `Expected a valid JSON string` (`SchemaIssue.ts:1191-1193`, `1327-1328`). `CatalogAssemblyError.message` (`scratchpad/effected/npm/CatalogAssemblyError.ts:92-96`) appends `cause.message`. No deviation is recorded. The sync reader in this module still uses `JSON.parse`, so this substitution is not what the green gates require.
- failure: An unparseable config-dependency `package.json` makes `CatalogAssemblyError.message` end in the schema sentence. Upstream ends in the `SyntaxError` message (`Unexpected token …`). `cause instanceof SyntaxError` is false.
- fix: Parse with `Effect.try(() => JSON.parse(text.value))` and `hooksError(name, cause)` on the thrown `SyntaxError`, as the oracle does.

### grok-1-6
- file: scratchpad/effected/workspaces/internal/patterns.ts:83
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/internal/patterns.ts:77-79` stores the `JSON.parse` throw as `PatternReadFailure.cause` with `kind: "invalidJson"`. The lab stores the `SchemaError` from `S.decodeEffect(JsonValue)`. `WorkspaceDiscovery.ts:448-455` copies `failure.cause` onto `WorkspaceDiscoveryError`. That error's own `message` (`WorkspaceDiscovery.ts:72-74`) stays `Workspace discovery failed at ${path} (${kind})`. The cause field is public. Same `SchemaGetter.parseJson` drop of the `SyntaxError` as grok-1-5. No deviation is recorded.
- failure: An unparseable root `package.json` (no usable `pnpm-workspace.yaml`) reports `invalidJson` whose `cause` is a `SchemaError` with message `Expected a valid JSON string`. Upstream's `cause` is the `SyntaxError`.
- fix: Restore `Effect.try(() => JSON.parse(content))` and put that thrown value on `invalidJson`.

### grok-1-7
- file: scratchpad/effected/workspaces/internal/configDependencyResolution.ts:128
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, section 14   evidence: Oracle `src/internal/configDependencyResolution.ts:105` fails with `hooksError(name, new Error(...))`; `:395` and `:400-402` use `new Error(message)` or `new Error(message, { cause })`; `:487-493` uses `new Error(...)`. The lab uses `ConfigDependencyResolutionError.make` at `:128`, `:414`, `:420`, and `:511`. `{ message: S.String }` exposes that string as `.message` (the skip tests in grok-1-2), and `CatalogAssemblyError.message` splices `cause.message`, so the assembly sentence matches. No deviation is recorded.
- failure: The `CatalogAssemblyError` cause for a `..` segment, an ambiguous store match, a not-installed dependency, and a lookup miss is `ConfigDependencyResolutionError` (`_tag` and `name`). Upstream's cause is a plain `Error` with the same message, and with `.cause` set to the fetch cause when one exists.
- fix: Pass `new Error(message)` and `new Error(message, { cause })` into `hooksError`, and delete `ConfigDependencyResolutionError`.

REQUIRED: 7
BACKLOG: 0
