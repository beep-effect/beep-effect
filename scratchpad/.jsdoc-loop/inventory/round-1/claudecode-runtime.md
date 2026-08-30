# Round 1 inventory — claudecode-runtime

Read-only JSDoc review of `scratchpad/claudecode/` excluding Frontmatter, Settings, and Hook (other packs). Scope matches `scratchpad/.jsdoc-loop/packs/claudecode-runtime/`: 15 exporting modules, 190 owning exports, 21 barrel re-exports.

Census open set confirmed: **12 open modules** (all `missing-packageDocumentation`) and **22 open owning exports**. All 22 owning flags are rejected as false positives (see below). Editorial review of the remaining owning exports found additional vacuous Examples and one implementation Gotcha.

Barrels `claudecode/Mcp.ts`, `claudecode/Plugin.ts`, and `claudecode/index.ts` have 0 owning exports. `index.ts` already carries `@packageDocumentation`. Do not invent Examples for re-export declarations.

---

## Confirmed mechanical — module headers

Census `missing-packageDocumentation` is confirmed on every owning-export module. Sibling Frontmatter files in this tree already use `@packageDocumentation` + `@since 0.0.0`. Law: module header needs a useful lead, `@packageDocumentation`, and `@since 0.0.0`; never `@module`.

### claudecode-runtime-R1-001: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/ClaudeProject.ts:1
- `symbol`: claudecode/ClaudeProject.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete; callers lose the package-doc entry in generated API docs.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-002: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/ClaudeRuntime.ts:1
- `symbol`: claudecode/ClaudeRuntime.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-003: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Errors.ts:1
- `symbol`: claudecode/Errors.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-004: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Mcp/JsonFile.ts:1
- `symbol`: claudecode/Mcp/JsonFile.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-005: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Mcp/Schema.ts:1
- `symbol`: claudecode/Mcp/Schema.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-006: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Define.ts:1
- `symbol`: claudecode/Plugin/Define.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`. The layout diagram uses a `text` fence, not a loose `ts` fence.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead, layout diagram, and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-007: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Layout.ts:1
- `symbol`: claudecode/Plugin/Layout.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-008: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Load.ts:1
- `symbol`: claudecode/Plugin/Load.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-009: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Manifest.ts:1
- `symbol`: claudecode/Plugin/Manifest.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-010: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Marketplace.ts:1
- `symbol`: claudecode/Plugin/Marketplace.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-011: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Validate.ts:1
- `symbol`: claudecode/Plugin/Validate.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-012: Module header missing @packageDocumentation

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Testing.ts:1
- `symbol`: claudecode/Testing.ts
- `kind`: module
- `evidence`: Fileoverview lead and `@since 0.0.0` are present; `@packageDocumentation` is absent. Census rule `missing-packageDocumentation`.
- `impact`: Docgen/module-header ratchet treats this exporting module as incomplete.
- `suggestedFix`: Add `@packageDocumentation` to the fileoverview (keep the existing lead and `@since 0.0.0`; do not add `@module`).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected false positives (census open owning exports)

Do **not** add Examples to these symbols. Do **not** convert a non-existent `@example` tag on `NpmPluginSource`.

### `export { defaultRuntime as default }` is documented; not a missing owning export

- `claudecode/ClaudeRuntime.ts:399` `default` (`value` / census `re-export` exportKind)
- Census: `missing-summary`, `missing-required-tags` (`@category`, `@since`, `@example`)
- Rejection: JSDoc lives on the `export { defaultRuntime as default }` statement (lines 384–398) with a useful lead, titled `**Example** (Use the default alias)`, `@category constructors`, and `@since 0.0.0`. Census attached findings to the export specifier, which has no own JSDoc. This is a local alias of already-documented `defaultRuntime`, not a new owning symbol. Brief: reject `export { Foo }` / `export { default }` graph edges and leftover “JSDoc on the export statement” misses.

### `export declare namespace` companions are type-level (Example optional)

Census classified these as `kind: value` / `exportKind: namespace` because the namespace body is present, then required `@example`. Law: namespaces and `.Encoded` companions are pure type-level; prose + `@category` + `@since` suffice. Each already has a lead such as “Companion types for `{@link …}`”, `@category type-level`, and `@since 0.0.0`.

| File | Line | Symbol |
| --- | --- | --- |
| `claudecode/Mcp/JsonFile.ts` | 63 | `McpJsonFile` |
| `claudecode/Mcp/JsonFile.ts` | 113 | `ClaudeJsonProject` |
| `claudecode/Mcp/JsonFile.ts` | 168 | `ClaudeJsonFile` |
| `claudecode/Mcp/Schema.ts` | 48 | `McpOAuth` |
| `claudecode/Mcp/Schema.ts` | 101 | `StdioMcpServer` |
| `claudecode/Mcp/Schema.ts` | 187 | `HttpMcpServer` |
| `claudecode/Mcp/Schema.ts` | 236 | `WsMcpServer` |
| `claudecode/Plugin/Manifest.ts` | 47 | `AuthorInfo` |
| `claudecode/Plugin/Manifest.ts` | 223 | `UserConfigEntry` |
| `claudecode/Plugin/Manifest.ts` | 302 | `ChannelSpec` |
| `claudecode/Plugin/Manifest.ts` | 352 | `PluginDependency` |
| `claudecode/Plugin/Manifest.ts` | 433 | `ExperimentalSpec` |
| `claudecode/Plugin/Manifest.ts` | 503 | `PluginManifest` |
| `claudecode/Plugin/Marketplace.ts` | 182 | `GitSubdirPluginSource` |
| `claudecode/Plugin/Marketplace.ts` | 424 | `MarketplaceMetadata` |
| `claudecode/Plugin/Marketplace.ts` | 486 | `MarketplaceFile` |
| `claudecode/Plugin/Validate.ts` | 95 | `PluginIssue` |
| `claudecode/Plugin/Validate.ts` | 143 | `PluginValidationError` |
| `claudecode/Plugin/Validate.ts` | 198 | `PluginLintReport` |

Same-name runtime classes already have titled Examples. Do not duplicate those onto the namespaces.

### `legacy-example` is a package-name collision, not a retired tag

- `claudecode/Plugin/Marketplace.ts:216` `NpmPluginSource` (class)
- `claudecode/Plugin/Marketplace.ts:246` `NpmPluginSource` (namespace)
- Census: `legacy-example` because `/@example\b/` matches the example payload `package: "@example/plugin"`.
- Both blocks already use titled `**Example**` carriers (`Reference an npm plugin`, `Inspect encoded npm source input`). There is no `@example` TSDoc tag. Do not “convert” anything; optional cleanup is renaming the sample package so the census regex stops firing (for example `@scope/plugin`).

---

## Editorial findings

### claudecode-runtime-R1-013: Vacuous Effect Examples on MCP loaders

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Mcp/JsonFile.ts:321, scratchpad/claudecode/Mcp/JsonFile.ts:542, scratchpad/claudecode/Mcp/JsonFile.ts:572, scratchpad/claudecode/Mcp/JsonFile.ts:612, scratchpad/claudecode/Mcp/JsonFile.ts:709
- `symbol`: managedMcpJsonPaths, loadJson, loadClaudeJson, loadManagedMcp, loadEffective
- `kind`: value
- `evidence`: Titled Examples exist but only prove the value is an Effect: `console.log(Effect.isEffect(program)) // true` (`loadJson`, `loadClaudeJson`) or `console.log(program)` of the unrun Effect (`managedMcpJsonPaths`, `loadManagedMcp`, `loadEffective`). Contrast `userClaudeJsonPath` / `projectMcpJsonPath`, which `Effect.runSync` with `Path.layer` and assert a path. Placeholder pattern: `console.log(fn)`.
- `impact`: Callers never see missing-file errors, reserved `workspace` skipping, managed exclusive control, or scope precedence — the jobs these functions exist to do.
- `suggestedFix`: Replace each Example in place (do not add a second). Provide `FileSystem` + `Path` (in-memory or `Testing.makeMockFileSystem`) and assert a decoded `McpJsonFile` / path list / `Option`. For `loadEffective`, show either managed-exclusive or local > project > user > plugin precedence with realistic server entries.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-014: mergeMcpJsonFiles Example ignores the merge law

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Mcp/JsonFile.ts:427
- `symbol`: mergeMcpJsonFiles
- `kind`: value
- `evidence`: Lead documents later-file-wins by server name and endpoint-duplicate removal, with no field merging. Example merges a single empty `mcpServers` record and logs `{}`.
- `impact`: Callers of `loadEffective` / plugin MCP composition cannot see whether two servers with the same URL collapse or whether fields merge.
- `suggestedFix`: Replace the Example with two files that share a name or stdio/URL endpoint and assert the surviving later entry (and that unmatched earlier servers remain).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-015: Vacuous Effect Examples on Plugin.scan / Plugin.load

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Load.ts:577, scratchpad/claudecode/Plugin/Load.ts:731
- `symbol`: scan, load
- `kind`: value
- `evidence`: Both Examples are `const program = Plugin.scan|load("./my-plugin")` then `console.log(Effect.isEffect(program)) // true`.
- `impact`: Callers do not see inferred manifest paths, missing `plugin.json` behavior, or the `LoadedPlugin` shape; the Example is a type-tautology.
- `suggestedFix`: Replace each Example: `Plugin.define` + `Testing.writePluginToMemory` (or `makeMockFileSystem`) then run `scan` / `load` and log observable fields (`inferredManifest.name`, command paths, `skills.length`). Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-016: Plugin.sync Example does not show default-path fill

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Load.ts:797
- `symbol`: sync
- `kind`: value
- `evidence`: Lead says sync preserves explicit layout and fills default paths for omitted component/config entries. Example defines `{ manifest: { name: "example-plugin" } }` and logs `normalized.manifest.name`, which is unchanged.
- `impact`: Callers cannot tell whether `commands` / `hooks` / `.mcp.json` defaults appear after sync; they may skip `sync` before `write`.
- `suggestedFix`: Replace the Example: define a plugin with at least one command (no custom path) and assert the synced manifest path spec (for example `./commands`) rather than the name.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-017: Plugin.write Example logs the unrun Effect

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Define.ts:756
- `symbol`: write
- `kind`: value
- `evidence`: Example builds a definition then `const program = Plugin.write(def, "/tmp/my-plugin"); console.log(program)`. Lead already explains deterministic write order and `FileSystem` / `Path` requirements; the fence never materializes files.
- `impact`: Callers do not see `.claude-plugin/plugin.json` or `commands/<name>.md` emission; `console.log(program)` is a compile-shaped placeholder.
- `suggestedFix`: Replace the Example using `Testing.writePluginToMemory` or `makeMockFileSystem` + `Effect.provide`, then assert an emitted path. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-018: Vacuous Examples on Plugin.validate / Plugin.doctor

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Validate.ts:580, scratchpad/claudecode/Plugin/Validate.ts:606
- `symbol`: validate, doctor
- `kind`: value
- `evidence`: `validate` logs the unrun Effect (`console.log(program)`). `doctor` is `console.log(Effect.isEffect(program)) // true`. Sibling `lint` already runs and logs `report.errors`.
- `impact`: Callers do not see success vs `PluginValidationError`, or that `doctor` returns scan + load + lint together.
- `suggestedFix`: Replace `validate` with `Effect.runSync` / `Exit` on a definition that either succeeds or fails with a duplicate-name issue. Replace `doctor` with an in-memory plugin tree and assert `errors` / `warnings` / `loaded.manifest.name`. Keep the existing `lint` Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-019: Unused decode bindings in Manifest schema Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Manifest.ts:68, scratchpad/claudecode/Plugin/Manifest.ts:97, scratchpad/claudecode/Plugin/Manifest.ts:126, scratchpad/claudecode/Plugin/Manifest.ts:244, scratchpad/claudecode/Plugin/Manifest.ts:373
- `symbol`: ComponentPathSpec, HooksSpec, ServerConfigSpec, UserConfigRecord, DependencySpec
- `kind`: value
- `evidence`: Each Example is `const x = S.decodeUnknownSync(Plugin.…)(…)` with no `console.log`, assertion, or `// =>`. Brief lists unused bindings as vacuous. Class schemas in the same file (`AuthorInfo`, `ChannelSpec`, `PluginManifest`) already log a field.
- `impact`: Callers cannot see decoded string-vs-array / name-vs-structured outcomes; docgen may compile while doctest reports the fences as vacuous.
- `suggestedFix`: Replace each Example in place: log the decoded value (and a failing input via `S.is` / `O.none` if it teaches the union). Namespace imports: `import * as S from "effect/Schema"`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-020: Missing Gotcha — empty effective MCP becomes None

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/ClaudeProject.ts:148, scratchpad/claudecode/ClaudeProject.ts:251
- `symbol`: layer, mcp
- `kind`: value
- `evidence`: Implementation in `layer` maps an empty `mcpServers` record to `O.none()` (`R.isEmptyReadonlyRecord(effective.mcpServers) ? O.none() : O.some(effective)`). `mcp` is documented only as “cached optional MCP config”; its Example logs `O.isSome(loaded)` without saying empty configs are absent rather than `Some({ mcpServers: {} })`.
- `impact`: Callers treating `O.some` as “MCP was loaded” will mis-handle a present `.mcp.json` whose servers were all reserved/`workspace`-stripped or empty.
- `suggestedFix`: Add a non-empty `**Gotchas**` on `mcp` (and/or `layer`) stating that a successfully loaded effective config with no servers is `O.none()`. Optionally assert that in the existing `mcp` Example. Do not add a second Example.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R1-021: Layout.syncManifest Example does not show path synchronization

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Plugin/Layout.ts:313
- `symbol`: syncManifest
- `kind`: value
- `evidence`: Lead: “Synchronizes manifest path fields with a plugin definition's materialized components.” Example defines a name-only plugin and logs `manifest.name`. Same gap as `Plugin.sync`.
- `impact`: Internal `Plugin.Layout` callers cannot see which omitted path fields become `None` vs default `./commands`.
- `suggestedFix`: Replace the Example: include a command entry and log the synced `commands` / hooks path spec. Keep `@internal`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Editorial review notes (no item opened)

- `Errors.ts` (36 owning): tagged errors construct + log `_tag`; namespaces already have optional Examples. No `@remarks` / `@example` tags.
- `Mcp/Schema.ts` runtime classes and `HttpMcpTransport` / `McpServerConfig` have observable Examples; `$I.annote` / `$I.annoteSchema` and same-name type aliases are present.
- `Plugin/Define.ts` `command` / `agent` / `skill` / `outputStyle` / `define` Examples construct and log fields. Type-level entry/config interfaces have useful prose without required Examples.
- `Plugin/Layout.ts` predicates (`isSafePluginPath`, `isMarkdownFilePath`, …) have observable true/false Examples.
- `Plugin/Marketplace.ts` class Examples (except the census false-positive package name) construct and log fields. Extra namespace Examples on `GithubPluginSource` / `UrlPluginSource` are optional, not missing.
- `Plugin/Validate.ts` `lint` Example is useful; `PluginIssue` / `PluginValidationError` / `PluginLintReport` class Examples construct values.
- `Testing.ts` (21 owning): harness, fixtures, assertions, and in-memory FS Examples exercise the actual APIs. Type-level `satisfies` Examples are optional and pedagogical.
- `ClaudeRuntime.ts` constructors `make` / `defaultRuntime` / `project` / `plugin` create and `dispose` a runtime. `LoggerKind` has a LiteralKit Example.
- `ClaudeProject.ts` `settings` / `mcp` / `plugin` accessors run through `ClaudeRuntime.project` (aside from the empty-MCP Gotcha above).
- Categories in this pack are canonical kebab-case roles (`schemas`, `type-level`, `constructors`, `layers`, `errors`, `testing`, …). No `exports` / `core` topology slugs.
- No `@module`, `@template`, `@remarks`, or bare `@see` in these files. `@effects` tags, where present, add environment/side-effect facts beyond the signature.
- Re-exports in `index.ts`, `Mcp.ts`, and `Plugin.ts` are graph edges; they have leads + `@category` + `@since` and must not gain Examples.

---

## Pack verdict

- files reviewed: 15
- owning exports reviewed: 190
- confirmed mechanical items: 12
- editorial items: 9
- rejected false positives: 22
- accepted findings: 21
