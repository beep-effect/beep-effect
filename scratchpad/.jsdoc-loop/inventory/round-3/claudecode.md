# Round 3 inventory — claudecode (events, hook, config, runtime)

Independent editorial re-review of `scratchpad/claudecode/` after round-2
fixes. Mechanical census is green (`openModuleCount: 0`,
`openOwningExportCount: 0`). Zero `@example` / `@remarks` / `@module` /
`@template` tags remain.

Hunt: residual vacuous Examples (unrun Effects, `console.log` of a
namespace without calling the owning symbol), missing
`@packageDocumentation`, signature-echo leads, TSDoc grammar, undescribed
`@see`, kind-split Example law. `export declare namespace` companions are
type-level — Examples are optional and were not opened.

Write surface: this file only.

## Scope

| Pack | Modules | Owning exports (census-summary) | Notes |
| --- | ---: | ---: | --- |
| `claudecode-events` | 31 | 349 | `Hook/Events/**` including `index.ts` |
| `claudecode-hook` | 8 | 56 | `Hook.ts` + `Hook/{Bus,Context,Envelope,Matcher,Runner,Tool,Transcript}.ts` |
| `claudecode-config` | 11 | 118 | `Frontmatter.ts`, `Frontmatter/**`, `Settings.ts`, `Settings/**` |
| `claudecode-runtime` | 15 | 189 | project/runtime/errors/mcp/plugin/testing + `index.ts` |
| **total** | **65** | **712** | |

Every exporting `.ts` file was grepped for `@packageDocumentation` (65/65),
legacy carriers, titled `**Example**` fences, `typeof program`,
`Effect.isEffect` / unrun `Effect.map` + `console.log`, `Schema for` /
`Constructor for` / `Type-level model`, bare `@see`, type braces / hyphen
after `@returns`/`@throws`, named Schema/Option/Array example imports, and
`export declare namespace`. Event modules share one constructor/Example
shape; ConfigChange, PreToolUse, PermissionRequest, Stop, TaskCompleted,
WorktreeRemove, UserPromptSubmit, FileChanged, Elicitation, and
`Events/index.ts` were read in full as the representative set. Round-2
fix sites (`Hook.ts`, `Settings.ts`, `Plugin.ts`, `Mcp.ts`,
`Hook/Envelope.ts`, `Hook/Transcript.ts`, `Hook/Runner.ts`,
`Settings/Loader.ts`, `ClaudeProject.ts`) were re-read.

---

## Round-2 items verified closed

| id | status |
| --- | --- |
| claudecode-R2-001 | closed — `@packageDocumentation` is present on `Hook.ts`, `Settings.ts`, `Plugin.ts`, `Mcp.ts` immediately before `@since 0.0.0`. |
| claudecode-hook-R2-002 | closed — `EffortLevel` decodes with `S.decodeUnknownSync(Hook.EffortLevel)("high")` and logs `"high"`. |
| claudecode-hook-R2-003 | closed — `readTranscript` provides `Testing.makeMockFileSystem`, `runPromise`s mapped `events.length`, logs `2`. |
| claudecode-hook-R2-004 | closed — `HookDefinition` lead is the runnable `define()` contract (event name, codecs, handler / `HookProcessOutput`). |
| claudecode-hook-R2-005 | closed — `Transcript.ts` fileoverview is one purpose-first lead; `FileSystem` requirement is paragraph two. |
| claudecode-config-R2-006 | closed — `LoadOptions` class Example calls `.make` and logs `O.getOrUndefined(options.settingsPath)`. |
| claudecode-runtime-R2-007 | closed — `Service` Example provides `ClaudeProject.layer({ cwd: "/repo" })` plus `Testing.makeMockFileSystem().layer` and logs `"/repo"`. The sibling getter `project` was not part of that item and is opened below. |

---

## Rejected / not reopened

- **`export declare namespace` missing Examples.** Law: namespaces are
  type-level; Example optional. Event `Input`/`Output`/`HookSpecificOutput`
  companions, Tool input companions, MCP/plugin/error companions, and
  Settings/Frontmatter Encoded companions were not opened. Extra Encoded
  Examples that already exist on some namespaces (Settings, Frontmatter,
  Errors, Envelope) were left alone — do not add more.
- **Barrel `export { … }` / `export * as` graph edges.** Document the owning
  declaration. Hub comments such as `Re-exports the ./Hook/Context.ts public
  surface` stay undocumented as new symbols. `Hook/Events/index.ts`
  re-exports and `ClaudeRuntime.default` stay graph edges.
- **`runMain` / `dispatch` / `runHookProgram` / `runDispatchProgram` not
  executing stdin.** Round-1 `claudecode-hook-R1-014` forbade process-main
  inside the fence and allowed `hook.event` / registered keys plus
  `typeof program`. That compromise is still in place (`Runner.ts`
  345–394, 479–534). No new evidence that those fences `console.log` a
  namespace without calling the constructor they name.
- **Layer tautologies.** `ClaudeProject.layer` and `Testing.makeMockStdioLayer`
  still prove `Layer.isLayer`. `ClaudeRuntime.baseLayer` / `layer` log the
  constructed Layer. Round-2 accepted `Layer.isLayer` as a tautology for a
  layer value; these call the owning symbol. Not reopened.
- **`NpmPluginSource` `"@example/plugin"`.** Sample package string, not a
  `@example` tag.
- **Loose `jsonc` fence on `Settings/HooksSection.ts`.** Law forbids a loose
  `ts` fence outside an Example. The fileoverview illustrates the settings
  wire shape in `jsonc`; docgen does not extract it.
- **Extra Examples, empty When-to-use/Details, wording churn, title polish
  (`Create mcp oauth`, `Use define`).** Not opened.
- **Re-opening round-1 Gotchas** (`policy_settings`, inverted Stop `block`,
  FileChanged basename, managed-roots, empty MCP → `O.none()`, untyped post
  `tool_response`, PreToolUse `defer`). Those leads/Gotchas are present on
  the constructors.

---

## Accepted findings

### claudecode-runtime-R3-001: `ClaudeProject.project` Example logs an unrun Effect

- `round`: 3
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/ClaudeProject.ts:224
- `symbol`: project
- `kind`: value
- `evidence`: Value-level `Effect.Effect<Interface, never, Service>` getter. Example is `const cwd = Effect.map(ClaudeProject.project, (service) => service.cwd)` then `console.log(cwd)` with no `provide` and no `runPromise`. That prints an Effect object. Title is "Read the project root". Round-2 `claudecode-runtime-R2-007` retired this exact pattern on `Service` in the same file (now provides `ClaudeProject.layer({ cwd: "/repo" })` plus `Testing.makeMockFileSystem().layer` and logs `"/repo"`). Sibling getters `settings` / `mcp` / `plugin` also `runPromise`.
- `impact`: Hover still teaches logging the mapped Effect as if it were the project root. Callers copy an unrun program and never see `cwd`.
- `suggestedFix`: Match the `Service` Example: provide `ClaudeProject.layer({ cwd: "/repo" })` plus `Testing.makeMockFileSystem().layer`, `runPromise` `ClaudeProject.project` mapped to `service.cwd`, and log `"/repo"`. Keep the existing lead. One titled Example is enough.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-runtime
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

---

## Pack notes (no extra items)

### claudecode-events

Clean for this hunt. All 31 exporting modules have a purpose-first lead,
`@packageDocumentation`, and `@since 0.0.0`. Value constructors (`Input`,
`Output`, `define`, `allow`/`block`/`passthrough`, matchers) call the owning
symbol and log a field (`source`, `decision`, `hook.event`, `exitCode`).
`export declare namespace` companions have prose + `@category type-level` +
`@since 0.0.0` and no required Example. Barrel re-exports on `index.ts` are
graph edges. Round-1 signature-echo and placeholder `console.log(Hook.Event.symbol)`
Examples stay gone. `HookInput` decodes a tagged Stop payload.

### claudecode-hook

Round-2 Envelope / Transcript / Runner / hub fixes hold. Tool adapters
call `decodePostToolUseWith(Adapter, input)` and log a decoded field (plus
`toolName`). Matcher / processOutput / Context accessors / Bus publish run
the owning symbol. `declare namespace` bodies on Tool and Envelope are
type-level. `HookDefinition` remains type-level with an optional type-only
alias fence.

### claudecode-config

Round-2 `LoadOptions` class Example constructs with `.make`. Frontmatter
codecs `runSync` decode kebab-case wire keys. Settings class Examples use
`.make` / `decodeSync` / LiteralKit `.is`. Namespace Encoded fences are
optional type-level extras, not misses. All 11 modules carry
`@packageDocumentation`.

### claudecode-runtime

Besides R3-001: MCP loaders, `Plugin.scan`/`load`/`write`/`validate`, and
Testing harnesses run against in-memory FS or construct `.make` values.
Error classes log `_tag` / a payload field. Namespace companions that
include an Example are type-level extras (not required). `index.ts` already
has `@packageDocumentation`.

---

## Pack verdict

- files reviewed: 65
- owning exports reviewed: 712
- confirmed mechanical items: 0
- editorial items: 1
- rejected false positives: declare-namespace Example requirements, barrel
  re-export docs, layer tautologies, `runMain`/`dispatch` typeof compromise
- accepted findings: 1

`claudecode-events` accepted findings: 0. `claudecode-hook` accepted
findings: 0. `claudecode-config` accepted findings: 0. The one item is a
residual unrun-Effect Example on `ClaudeProject.project` that round-2
fixed on `Service` in the same file and did not extend to the getter.
Declare namespaces do not need Examples.
