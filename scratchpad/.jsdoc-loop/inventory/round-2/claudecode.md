# Round 2 inventory — claudecode (events, hook, config, runtime)

Independent editorial re-review of `scratchpad/claudecode/` after round-1
fixes. Mechanical census is already green (`openModuleCount: 0`,
`openOwningExportCount: 0`). Zero `@example` / `@remarks` / `@module` /
`@template` tags remain.

Hunt (only): residual vacuous Examples (`console.log` of a namespace / type
companion without calling the owning symbol), missing
`@packageDocumentation`, signature-echo leads. `export declare namespace`
companions are type-level — Examples are optional and were not opened.

Write surface: this file only.

## Scope

| Pack | Modules | Owning exports (census-summary) | Notes |
| --- | ---: | ---: | --- |
| `claudecode-events` | 31 | 349 | `Hook/Events/**` including `index.ts` |
| `claudecode-hook` | 8 | 56 | `Hook.ts` + `Hook/{Bus,Context,Envelope,Matcher,Runner,Tool,Transcript}.ts` |
| `claudecode-config` | 11 | 118 | `Frontmatter.ts`, `Frontmatter/**`, `Settings.ts`, `Settings/**` |
| `claudecode-runtime` | 15 | 189 | project/runtime/errors/mcp/plugin/testing + `index.ts` |
| **total** | **65** | **712** | |

Every exporting `.ts` file was grepped for `@packageDocumentation`, titled
`**Example**` fences, `console.log(Hook|Settings|Plugin|Mcp|Frontmatter.…)`,
`typeof program`, `Schema for` / `Constructor for` / `Type-level model`,
bare `@see`, legacy carriers, and `export declare namespace`. Event modules
share one constructor/Example shape; ConfigChange, PreToolUse,
PermissionRequest, Stop, TaskCompleted, WorktreeRemove, and `Events/index.ts`
were read in full as the representative set.

---

## Rejected / not reopened

- **`export declare namespace` missing Examples.** Law: namespaces are
  type-level; Example optional. Census originally flagged these; it no longer
  does. Event `Input`/`Output`/`HookSpecificOutput` companions, Tool input
  companions, and runtime `Mcp*` / `Plugin*` / error companions were not
  opened. Extra Encoded Examples that already exist on some namespaces
  (Settings, Frontmatter, Errors) were left alone — do not add more.
- **Barrel `export { … }` / `export * as` graph edges.** Document the owning
  declaration. `Hook/Events/index.ts` re-exports and `ClaudeRuntime.default`
  stay undocumented as new symbols.
- **`runMain` / `dispatch` / `runHookProgram` / `runDispatchProgram` not
  executing stdin.** Round-1 `claudecode-hook-R1-014` explicitly forbade
  invoking process-main inside the fence and allowed `typeof program` plus
  `hook.event` / registered keys. That compromise is in place (`Runner.ts`
  343–393, 477–532). Not reopened: no new evidence that those fences still
  `console.log` a namespace without calling the constructor they name.
  `Testing.runHookWithMockStdin` is a better teaching vehicle, but asking
  for a second rewrite is extra-Example / taste unless a fixer is already
  in `Runner.ts`.
- **`NpmPluginSource` `"@example/plugin"`.** Sample package string, not a
  `@example` tag.
- **Extra Examples, empty When-to-use/Details, wording churn.** Not opened.
- **Re-opening round-1 Gotchas** (`policy_settings`, inverted Stop `block`,
  FileChanged basename, managed-roots, empty MCP → `O.none()`, untyped post
  `tool_response`). Those leads/Gotchas are present on the constructors.

---

## Accepted findings

### claudecode-R2-001: Namespace hubs missing `@packageDocumentation`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook.ts:1, scratchpad/claudecode/Settings.ts:1, scratchpad/claudecode/Plugin.ts:1, scratchpad/claudecode/Mcp.ts:1
- `symbol`: Hook.ts, Settings.ts, Plugin.ts, Mcp.ts
- `kind`: module
- `evidence`: Loop law requires every exporting module to carry a useful lead, `@packageDocumentation`, and `@since 0.0.0`. Sibling hubs `Frontmatter.ts` and `index.ts` already have the tag. These four 0-owning namespace hubs have a purpose lead and `@since 0.0.0` only (`Hook.ts` also has a titled Example and `@category utilities`). Census skips module findings when `owningExportCount === 0`, which is why round 1 rejected opening them; the header law is independent of that scoring skip.
- `impact`: TSDoc treats the public `import { Hook } from "effect-claudecode"` hubs as ordinary comments. Callers of the documented namespace entry lose the package-doc page that `Frontmatter` already has.
- `suggestedFix`: Insert `@packageDocumentation` immediately before `@since 0.0.0` on each fileoverview. Keep the existing lead. Never `@module`. Do not invent owning-export Examples on the re-export lists.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R2-002: `EffortLevel` Example never calls the schema

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Envelope.ts:22
- `symbol`: EffortLevel
- `kind`: value
- `evidence`: Value-level `LiteralKit` schema. Example is `const level: Hook.EffortLevel = "high"; console.log(level) // "high"`. That annotates the type companion and logs a string literal. Sibling `HookPermissionMode` in the same file decodes with `S.decodeUnknownSync(Hook.HookPermissionMode)("plan")`. Settings `PermissionMode` / `EffortLevel` call `.is.manual` / `.is.xhigh`.
- `impact`: Hover does not show how to decode or narrow an envelope effort level. This is the leftover “log the name without calling the symbol” pattern round 1 removed from event constructors.
- `suggestedFix`: Replace the fence with `S.decodeUnknownSync(Hook.EffortLevel)("high")` (or `Hook.EffortLevel.is.high("high")`) and log the decoded/guard result. Keep the existing lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R2-003: `readTranscript` Example discards the mapped result

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Transcript.ts:40
- `symbol`: readTranscript
- `kind`: value
- `evidence`: Round-1 `claudecode-hook-R1-015` asked to drop `Effect.isEffect` and make `Effect.map((events) => events.length)` the constructed value. The fence now builds that mapped program, then logs `transcriptPath` and `typeof program // "object"`. The length mapping is unused. Law: a compile trick (`typeof` on an Effect) is not an observable result. Gotchas and `@see {@link TranscriptReadError}` from round 1 are present and should stay.
- `impact`: Hover still does not show that the Effect’s success value is an event count / array length. Callers copy `typeof program` as if that were the API.
- `suggestedFix`: Keep the Example filesystem-free. Log something about the constructed program that is not `typeof` — e.g. document the mapped `events.length` as the value being built (`const countEvents = Hook.readTranscript(path).pipe(Effect.map((events) => events.length))` and a comment that running it needs `FileSystem`), or provide `Testing.makeMockFileSystem` / `Path.layer` and `runPromise` a one-line JSONL file. Do not `runPromise` against a real `/tmp` path.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R2-004: `HookDefinition` lead restates the name

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Runner.ts:163
- `symbol`: HookDefinition
- `kind`: type
- `evidence`: Lead is `Type-level model for \`HookDefinition\`.` Law: the lead explains purpose instead of restating the name. The interface is the runner’s `{ event, inputSchema, outputSchema, handler }` contract produced by every event `define()`. Type-level Example is optional; the current type-only alias fence may stay or drop.
- `impact`: Hover adds no information beyond the identifier. Authors of `define()` / `dispatch` maps cannot tell this is the value those factories return.
- `suggestedFix`: One purpose-first lead, e.g. the runnable contract returned by each event `define()`: event name, stdin/stdout codecs, and the handler Effect (which may also yield `HookProcessOutput`). Keep `@category models` `@since 0.0.0`. No Example required.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R2-005: `Transcript.ts` module lead restates the filename

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Transcript.ts:1
- `symbol`: Hook/Transcript
- `kind`: module
- `evidence`: First paragraph is `Transcript reader.` Purpose (JSONL at `transcript_path`, `FileSystem`, parsed unknown values) sits in paragraph two. Law: one useful lead paragraph, not a name-echo followed by the real description. `@packageDocumentation` and `@since 0.0.0` are already present.
- `impact`: Module doc page / hover lead is a filename echo. The next reader has to skip a dead sentence to learn the job.
- `suggestedFix`: Collapse paragraph two into the single lead. Keep the `FileSystem` requirement as a second paragraph or a Details section. Do not add `@module`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-config-R2-006: `LoadOptions` class Example never constructs `LoadOptions`

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Settings/Loader.ts:32
- `symbol`: LoadOptions
- `kind`: value
- `evidence`: The class Example types a plain object as `Settings.LoadOptions.Encoded` and logs `settingsPath`. It never calls `LoadOptions.make` / `S.decodeUnknownSync(LoadOptions)`. The same Encoded literal already lives on the `export declare namespace LoadOptions` companion (type-level, Example optional). Round-1 replaced namespace `accept` identities with Encoded literals; that template was applied to the class as well. Sibling Settings classes (`PermissionsConfig`, `HookMatcherGroup`, `CommandHookEntry`) use `.make` / `decodeSync` on the value export.
- `impact`: Hover for the runtime class does not show how optional keys become `Option`. Callers copy an Encoded object and think that *is* `LoadOptions`.
- `suggestedFix`: On the class, construct with `LoadOptions.make({ settingsPath: O.some("/tmp/session-settings.json") })` and log `O.getOrUndefined(options.settingsPath)`. Leave the namespace Encoded Example as-is (or drop it — type-level does not require one). Keep the managed-roots Gotcha.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-config
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-runtime-R2-007: `ClaudeProject.Service` Example logs an unrun Effect

- `round`: 2
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/ClaudeProject.ts:108
- `symbol`: Service
- `kind`: value
- `evidence`: Example binds `Effect.service(ClaudeProject.Service).pipe(Effect.map((project) => project.cwd))` then `console.log(cwd)` without `provide` or `runPromise`. That prints an Effect object. Round-1 `claudecode-runtime-R1-013` retired the same unrun-Effect pattern on MCP loaders. Sibling `Hook.Context.Service` provides `Hook.Context.layer(Testing.makeMockEnvelope())` and logs the session id. `ClaudeProject.layer` in this file still only proves `Layer.isLayer` — acceptable tautology for a layer value; do not pile a second Example.
- `impact`: Hover does not show how to read `cwd` / settings / mcp from the project service. Callers may think logging the Effect is the API.
- `suggestedFix`: Provide `ClaudeProject.layer({ cwd: "/repo" })` plus `Testing.makeMockFileSystem` / platform layers (same harness MCP/plugin Examples already use) and `runPromise` `ClaudeProject.cwd` or `Effect.service(ClaudeProject.Service)` mapping `project.cwd`. Log the string. One titled Example is enough.
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
graph edges. Round-1 signature-echo (`X hook event.` / `Schema for \`X\``)
and `console.log(Hook.Event.symbol)` placeholders are gone.

### claudecode-hook

Besides R2-001–005: Tool adapters call `decodePostToolUseWith(Adapter, input)`
and log a decoded field (plus `toolName`). Matcher / processOutput /
Context accessors / Bus publish run the owning symbol. `declare namespace`
bodies on Tool and Envelope are type-level.

### claudecode-config

Besides R2-001 and R2-006: Frontmatter codecs `runSync` decode kebab-case
wire keys. Settings class Examples use `.make` / `decodeSync`. Namespace
Encoded fences are optional type-level extras, not misses.

### claudecode-runtime

Besides R2-001 and R2-007: MCP loaders, `Plugin.scan`/`load`/`write`/`validate`,
and Testing harnesses run against in-memory FS or construct `.make` values.
Error classes log `_tag` / a payload field. `index.ts` already has
`@packageDocumentation`.

---

## Pack verdict

- files reviewed: 65
- owning exports reviewed: 712
- confirmed mechanical items: 0
- editorial items: 7
- rejected false positives: 0 (census already 0; declare-namespace Example
  requirements and barrel re-export docs were not reopened)
- accepted findings: 7

`claudecode-events` accepted findings: 0. The seven items are residual
editorial defects in hook / config / runtime after round-1 fixes, not a
mechanical-census regression.
