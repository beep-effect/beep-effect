# Round 1 inventory — claudecode-config

Pack slice: 11 exporting modules, 118 owning exports, 10 re-exports.
Census open set confirmed: **3 modules** and **6 owning exports**.

Paths below are repo-root relative (`scratchpad/claudecode/...`). Census records use the scratchpad-relative form (`claudecode/...`).

## Files reviewed

| File | Owning | Census module | Review |
| --- | ---: | --- | --- |
| `scratchpad/claudecode/Frontmatter.ts` | 0 | none (barrel) | Re-exports only; header has lead, `@packageDocumentation`, `@since 0.0.0`. No owning symbols to document. |
| `scratchpad/claudecode/Frontmatter/Command.ts` | 4 | none | Namespace has a titled Encoded Example. Class Example is an unrun `Effect.gen` (editorial). |
| `scratchpad/claudecode/Frontmatter/OutputStyle.ts` | 4 | none | Same shape as Command. Class Example unrun (editorial). |
| `scratchpad/claudecode/Frontmatter/Parser.ts` | 9 | none | `parse` Example leaves `program` unused (editorial). File parsers are titled and observable. |
| `scratchpad/claudecode/Frontmatter/Render.ts` | 7 | none | Titled Examples run via `Effect.runPromise`. No open mechanical. |
| `scratchpad/claudecode/Frontmatter/Skill.ts` | 8 | none | `SkillFrontmatter` namespace missing titled Example (mechanical). Type aliases mis-categorized (editorial). |
| `scratchpad/claudecode/Frontmatter/Subagent.ts` | 4 | none | `SubagentFrontmatter` namespace missing titled Example (mechanical). `SubagentColor` type alias mis-categorized (editorial). |
| `scratchpad/claudecode/Settings.ts` | 0 | none (barrel) | Header has lead + `@since`, no `@packageDocumentation`. Census skips 0-owning barrels; not opened. |
| `scratchpad/claudecode/Settings/HooksSection.ts` | 24 | missing-packageDocumentation | Module + two namespaces mechanical. Four sibling namespace Examples are vacuous `accept` identities (editorial). |
| `scratchpad/claudecode/Settings/Loader.ts` | 6 | missing-packageDocumentation | Module mechanical. `LoadOptions`/`load` omit the managed-roots interaction (editorial). `LoadOptions` namespace Example is the Encoded template to copy. |
| `scratchpad/claudecode/Settings/Schema.ts` | 52 | missing-packageDocumentation | Module + `Marketplace`/`SettingsFile` namespaces mechanical. Vacuous `accept` and unused-decode Examples (editorial). |

---

## Confirmed mechanical

### claudecode-config-R1-001: HooksSection module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/HooksSection.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Fileoverview has a useful lead and `@since 0.0.0` but no `@packageDocumentation`. The jsonc fence in the header is not a `ts` fence and is not a carrier violation.
- `impact`: Exporting modules must carry lead + `@packageDocumentation` + `@since 0.0.0`. The census open-module gate stays red until the tag is added.
- `suggestedFix`: Keep the existing lead. Add `@packageDocumentation` immediately before `@since 0.0.0`. Do not introduce `@module`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-002: Loader module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Loader.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead documents merge/precedence; `@since 0.0.0` is present; `@packageDocumentation` is absent.
- `impact`: Same module-header law as R1-001. Census open-module gate.
- `suggestedFix`: Add `@packageDocumentation` before `@since 0.0.0` on the existing fileoverview. Leave the precedence lead intact.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-003: Schema module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Schema.ts:1
- `symbol`: (module)
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead cites the 2.1.220 settings contract and `{@link SettingsRaw}`; `@since 0.0.0` is present; `@packageDocumentation` is absent.
- `impact`: Same module-header law as R1-001. Census open-module gate.
- `suggestedFix`: Add `@packageDocumentation` before `@since 0.0.0`. Do not rewrite the lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-004: `SkillFrontmatter` namespace missing a titled Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Frontmatter/Skill.ts:156
- `symbol`: SkillFrontmatter
- `kind`: value
- `evidence`: Census `missing-required-tags` / `Missing @example` on `export declare namespace SkillFrontmatter` (`exportKind=namespace`). Lead and `@category dtos` `@since 0.0.0` are present; no `**Example** (Title)`. Sibling `CommandFrontmatter` / `OutputStyleFrontmatter` namespaces in this pack already ship titled Encoded Examples. Census classifies a namespace *with a body* as value-level, so a titled Example is required to close the owning-export gate. Do **not** add a retired `@example` tag.
- `impact`: Callers never see the kebab-case / snake_case Encoded shape (`allowed-tools`, `when_to_use`) that the namespace exists to name. Census stays open.
- `suggestedFix`: Add one titled Encoded Example after the lead, before tags, matching `CommandFrontmatter` (Command.ts:108): assign a `Frontmatter.SkillFrontmatter.Encoded` object with `name` plus a kebab-case key such as `"allowed-tools"`, then `console.log` a field. Do not copy the vacuous `const accept = (input) => input` pattern from Settings namespaces (R1-008 / R1-009).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-005: `SubagentFrontmatter` namespace missing a titled Example

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Frontmatter/Subagent.ts:108
- `symbol`: SubagentFrontmatter
- `kind`: value
- `evidence`: Census `missing-required-tags` / `Missing @example` on `export declare namespace SubagentFrontmatter`. Same value/namespace + missing titled Example as R1-004. Class Example (line 51) is a separate owning export and does not satisfy the namespace.
- `impact`: The namespace's job is the Encoded boundary (`name`/`description` required; optional camelCase keys). Without an Example, callers copy the class `make`/`Option` shape into JSON/YAML.
- `suggestedFix`: Add `**Example** (Describe encoded subagent frontmatter)` with a `Frontmatter.SubagentFrontmatter.Encoded` object `{ name, description, model }` and `console.log(input.name)`. Titled section, not `@example`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-006: `AgentHookEntry` and `HookMatcherGroup` namespaces missing titled Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/HooksSection.ts:397, scratchpad/claudecode/Settings/HooksSection.ts:502
- `symbol`: AgentHookEntry, HookMatcherGroup
- `kind`: value
- `evidence`: Census `missing-required-tags` / `Missing @example` on both `export declare namespace` companions. Sibling namespaces in this file (`CommandHookEntry`, `HttpHookEntry`, `McpToolHookEntry`, `PromptHookEntry`) have titled Examples; these two do not. Classes at lines 379 and 486 already have Examples and do not cover the namespaces.
- `impact`: Two remaining HooksSection owning exports keep the census open. Callers miss the Encoded objects (`type: "agent"`; matcher + hook array without `Option` wrappers).
- `suggestedFix`: Add one titled Encoded Example on each namespace. Follow `LoadOptions` (Loader.ts:60), **not** the `accept` identity used by sibling hook namespaces (replace those under R1-008). For `AgentHookEntry.Encoded`: `{ type: "agent", prompt: "Verify $ARGUMENTS" }` and log `prompt`. For `HookMatcherGroup.Encoded`: `{ matcher: "Bash", hooks: [{ type: "command", command: "bun hook.ts" }] }` and log `hooks.length`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: R1-008 (do not copy the vacuous sibling pattern)
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-007: `Marketplace` and `SettingsFile` namespaces missing titled Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Schema.ts:1200, scratchpad/claudecode/Settings/Schema.ts:1841
- `symbol`: Marketplace, SettingsFile
- `kind`: value
- `evidence`: Census `missing-required-tags` / `Missing @example` on both namespaces. Classes at 1184 and 1688 already have titled Examples (`decodeSync` / `make` + `Option`). The namespaces are the Encoded companions and still have no Example. Other Schema namespaces in this file already have titled Examples (quality of those is R1-009).
- `impact`: `SettingsFile.Encoded` is optional camelCase JSON **without** `Option` wrappers; the class Example uses `O.some(...)`. Without a namespace Example, callers feed `Option` values into `settings.json`. Census stays open on these two owning exports.
- `suggestedFix`: Add titled Encoded Examples (not `@example`). `Marketplace.Encoded`: `{ source: { source: "directory", path: "./plugins" }, autoUpdate: false }` and log `source.source`. `SettingsFile.Encoded`: `{ model: "claude-sonnet-5", theme: "dark" }` and log `model`. Do not use the `accept` identity (R1-009).
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: R1-009
- `status`: open
- `fixedCommit`: pending

---

## Editorial

### claudecode-config-R1-008: Vacuous `accept` identity Examples on HooksSection namespaces

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/HooksSection.ts:160, scratchpad/claudecode/Settings/HooksSection.ts:221, scratchpad/claudecode/Settings/HooksSection.ts:285, scratchpad/claudecode/Settings/HooksSection.ts:346
- `symbol`: CommandHookEntry, HttpHookEntry, McpToolHookEntry, PromptHookEntry
- `kind`: value
- `evidence`: Each namespace Example is `const accept = (input: Settings.<Name>.Encoded) => input` / `console.log(accept)`. That logs a function, never an Encoded value. REVIEW-BRIEF vacuous Example (`void x`, unused binding, no observable result). Census `hasTitledExample` is already true, so this is not a mechanical miss.
- `impact`: Callers still do not see command/url/server+tool/prompt Encoded objects. Copying this pattern into R1-006 would close census without teaching the wire shape.
- `suggestedFix`: Replace each fence with a typed Encoded literal and `console.log` of a discriminant field, e.g. CommandHookEntry: `{ type: "command", command: "bun hook.ts" }` → log `command`. One titled Example per namespace; do not add extras.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-009: Vacuous Examples on Schema namespaces and four value exports

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Schema.ts:280, scratchpad/claudecode/Settings/Schema.ts:349, scratchpad/claudecode/Settings/Schema.ts:428, scratchpad/claudecode/Settings/Schema.ts:534, scratchpad/claudecode/Settings/Schema.ts:601, scratchpad/claudecode/Settings/Schema.ts:726, scratchpad/claudecode/Settings/Schema.ts:768, scratchpad/claudecode/Settings/Schema.ts:856, scratchpad/claudecode/Settings/Schema.ts:917, scratchpad/claudecode/Settings/Schema.ts:980, scratchpad/claudecode/Settings/Schema.ts:1040, scratchpad/claudecode/Settings/Schema.ts:1102, scratchpad/claudecode/Settings/Schema.ts:1137, scratchpad/claudecode/Settings/Schema.ts:1184, scratchpad/claudecode/Settings/Schema.ts:1381, scratchpad/claudecode/Settings/Schema.ts:1460, scratchpad/claudecode/Settings/Schema.ts:1523, scratchpad/claudecode/Settings/Schema.ts:1584, scratchpad/claudecode/Settings/Schema.ts:1616
- `symbol`: PermissionsConfig, SandboxFilesystemConfig, SandboxNetworkConfig, SandboxConfig, StatusLineConfig, VoiceConfig, McpServerPolicyMatcher, DirectorySourceSpec, GithubSourceSpec, GitSourceSpec, HostPatternSourceSpec, SettingsSourceSpec, MarketplaceSourceSpec, Marketplace, AttributionConfig, PluginOptionsConfig, WorktreeConfig, PolicyHelperConfig, SettingsRaw
- `kind`: value
- `evidence`: Fifteen namespace Examples use `const accept = (input) => input; console.log(accept)` (function, not Encoded data). Four value Examples bind a decode and never observe it: `McpServerPolicyMatcher` (768), `MarketplaceSourceSpec` (1137), `Marketplace` class (1184), `SettingsRaw` (1616) — `const x = S.decodeSync(...)` with no `console.log` / assertion. REVIEW-BRIEF vacuous Example. Classes that already `console.log` a field are out of scope.
- `impact`: Census is green on these symbols, but the Examples do not show the schema doing its job. Marketplace class + namespace would both stay non-teaching after R1-007 if the class fence is left unused.
- `suggestedFix`: Replace `accept` Examples with Encoded object literals + `console.log` of a field (`LoadOptions` / `CommandFrontmatter` pattern). On the four unused-decode exports, log a discriminant (`matcher.serverName`, `source.source`, `marketplace.source`, `raw.futureSetting`). Do not add a second Example where one titled fence already exists.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-010: Unrun `Effect.gen` Examples leave `program` unused

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Frontmatter/Command.ts:43, scratchpad/claudecode/Frontmatter/OutputStyle.ts:36, scratchpad/claudecode/Frontmatter/Skill.ts:123, scratchpad/claudecode/Frontmatter/Subagent.ts:78, scratchpad/claudecode/Frontmatter/Parser.ts:190
- `symbol`: CommandFrontmatter_, OutputStyleFrontmatter_, SkillFrontmatter, SubagentFrontmatter, parse
- `kind`: value
- `evidence`: Each Example binds `const program = Effect.gen(function* () { ... console.log(...) })` and never runs it. Unused binding / no observable result (REVIEW-BRIEF). Sibling const codecs (`CommandFrontmatter`, `OutputStyleFrontmatter`) and Render helpers already use `Effect.runSync` / `Effect.runPromise`.
- `impact`: `parse` is the only string-level frontmatter API; copy-paste compiles and prints nothing. Class Examples hide that decode is effectful until run.
- `suggestedFix`: Collapse to `Effect.runSync(S.decodeUnknownEffect(...)({...}))` / `Effect.runSync(Frontmatter.parse(source, path))` and keep the existing `console.log` of a decoded field. Empty generator bodies are forbidden; do not leave `program` unbound. One titled Example per export.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-011: Frontmatter type aliases restate the name, use `{@inheritDoc}`, and sit in `@category models`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/claudecode/Frontmatter/Skill.ts:42, scratchpad/claudecode/Frontmatter/Skill.ts:70, scratchpad/claudecode/Frontmatter/Skill.ts:98, scratchpad/claudecode/Frontmatter/Subagent.ts:49
- `symbol`: StringOrStringArray, EffortLevel, FrontmatterShell, SubagentColor
- `kind`: type
- `evidence`: Leads are `Type for {@link X}. {@inheritDoc X}` (name/signature echo). `@category models` on pure type companions; Command.ts / OutputStyle.ts same-name aliases correctly use `@category type-level` plus a described `@see`. No Example required (kind-split); none present — correct.
- `impact`: Hover and category indexes treat decoded literals as runtime models. `{@inheritDoc}` duplicates the schema lead instead of naming the decoded value.
- `suggestedFix`: Match Command.ts:100. Lead: `Decoded value produced by {@link X}.` Add `@see {@link X} for the runtime schema and decoding behavior.` Switch `@category` to `type-level`. Drop `{@inheritDoc}`. Do not add Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-012: Two `EffortLevel` schemas omit a described sibling `@see`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: suggestion
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Frontmatter/Skill.ts:58, scratchpad/claudecode/Settings/Schema.ts:82
- `symbol`: EffortLevel
- `kind`: value
- `evidence`: `Frontmatter.EffortLevel` literals are `low|medium|high|xhigh|max`. `Settings.EffortLevel` is `low|medium|high|xhigh` (no `max`). Both export as `EffortLevel` from different barrels. Neither `@see` tells a caller which closed set they are holding. Leads mention “skill, command, and subagent frontmatter” vs “persisted reasoning-effort” but do not name the sibling or `max`.
- `impact`: Decoding skill frontmatter `effort: max` through `Settings.EffortLevel` fails; the reverse silently cannot express `max`. This is a choose-the-sibling risk the law’s described `@see` is for.
- `suggestedFix`: On each value export, add `@see {@link ...} for the other closed set (`max` is frontmatter-only).` Target the sibling schema (Frontmatter vs Settings). Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R1-013: `LoadOptions` / `load` omit the managed-roots interaction

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Loader.ts:49, scratchpad/claudecode/Settings/Loader.ts:372
- `symbol`: LoadOptions, load
- `kind`: value
- `evidence`: `managedRoots` (line 271) uses `managedSettingsRoots` when present and **ignores** `managedSettingsRoot`; the single-root field is only consulted when roots is `None`; otherwise the hardcoded triple `/Library/Application Support/ClaudeCode`, `/etc/claude-code`, `C:\Program Files\ClaudeCode` is used. Class/load docs list overrides and precedence but not this interaction or the default roots. Conditional-tag law: `@param` / Gotchas for interactions not visible in the type.
- `impact`: Passing both fields looks like “root plus extras”; implementation is “array replaces everything.” Operators will not search those default managed paths from the hover.
- `suggestedFix`: Add a short **Gotchas** on `LoadOptions` (and optionally `load`): `managedSettingsRoots` replaces default managed roots and ignores `managedSettingsRoot`; name the three default roots. Do not add a second Example on either symbol.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Rejected / not opened

- **Settings.ts missing `@packageDocumentation`.** Barrel, `owningExportCount=0`. Census only emits module findings when `owning.length > 0` (`census.ts` visitSource). Sibling `Frontmatter.ts` already has the tag. Not a census open module; do not treat as a fourth module fix unless a later pass tightens barrel headers.
- **Census `@acme` on `MarketplacePolicySourceSpec`.** `tagsFrom` matches `@acme/plugins` inside the Example. Not a JSDoc tag.
- **Census `@effect` on `parseFile` / `parseSkillFile` / `parseCommandFile` / `parseSubagentFile` / `parseOutputStyleFile`.** Same parser hitting `import ... from "@effect/platform-bun/..."`. Real tag is `@effects`.
- **Type aliases and `.Encoded` type companions without Examples.** Kind-split: Example optional. Census did not flag them. Includes `HookEntryType`, `HookShell`, `HookEntry`, `HooksSection`, `PermissionMode`, `MarketplaceSourceSpec` types, inner `namespace` `Type`/`Encoded` aliases, `DecodedFrontmatter` (optional Example already present and useful).
- **Barrel re-exports** on `Frontmatter.ts` and `Settings.ts`. Graph edges; REVIEW-BRIEF forbids documenting them as new symbols.
- **Extra Examples** on class vs const pairs (`CommandFrontmatter_` / `CommandFrontmatter`, `OutputStyleFrontmatter_` / `OutputStyleFrontmatter`). Each is its own owning export; one titled Example each is required. Not opened as extras.
- **The six open namespaces as type-level false positives.** Law lists namespaces as type-level with optional Example, but census `isTypeOnly` only treats a namespace as type-level when `body === undefined`. These `export declare namespace` blocks have bodies, so they are value/namespace and the pack already documents Encoded companions with titled Examples. Confirmed, not rejected.

---

## Pack verdict

- files reviewed: 11
- owning exports reviewed: 118
- confirmed mechanical items: 9 (3 modules + 6 owning exports; written as 7 items)
- editorial items: 6
- rejected false positives: 7
- accepted findings: 13
