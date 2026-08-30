# Round 1 review — `claudecode-hook`

Scope: every exporting module and owning export under `scratchpad/claudecode/Hook/` except `Hook/Events/`. Census listed 7 open modules (`missing-packageDocumentation`) and 0 open owning exports. Barrel `claudecode/Hook.ts` was reviewed as a re-export hub only.

Census mechanical export surface is clean: owning value exports already have leads, `@category`, `@since 0.0.0`, and titled Example carriers. Editorial defects remain — placeholder Examples, wrong-symbol Examples, restating leads, missing described `@see` between siblings a caller must choose, and a few Gotchas already present in implementation comments.

## Mechanical module headers

### claudecode-hook-R1-001: Bus module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Bus.ts:1
- `symbol`: Hook/Bus
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Fileoverview lead and `@since 0.0.0` are present; the TSDoc package tag is not. Law: module headers use `@packageDocumentation`, never `@module`.
- `impact`: TSDoc treats the file as an ordinary comment, not a module doc page; the loop's module-header ratchet stays red.
- `suggestedFix`: Add `@packageDocumentation` immediately before `@since 0.0.0` on the fileoverview. Keep the existing lead.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-002: Context module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Context.ts:1
- `symbol`: Hook/Context
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Useful lead and `@since 0.0.0` exist; `@packageDocumentation` does not.
- `impact`: Same module-header miss as the rest of the pack; census stays open on this file.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-003: Envelope module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Envelope.ts:1
- `symbol`: Hook/Envelope
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead already explains `envelopeFields` vs `HookEnvelope`.
- `impact`: Module doc is not a TSDoc package entry; census remains open.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-004: Matcher module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Matcher.ts:1
- `symbol`: Hook/Matcher
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Fileoverview already carries the settings.json vs in-process matcher Gotcha.
- `impact`: Census module finding stays open.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-005: Runner module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Runner.ts:1
- `symbol`: Hook/Runner
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead already distinguishes `runMain` vs `dispatch`.
- `impact`: Census module finding stays open.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-006: Tool module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Tool.ts:1
- `symbol`: Hook/Tool
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead already explains raw `tool_input` vs typed adapters.
- `impact`: Census module finding stays open.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-007: Transcript module missing `@packageDocumentation`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; scratchpad/.jsdoc-loop/REVIEW-BRIEF.md
- `affectedFiles`: scratchpad/claudecode/Hook/Transcript.ts:1
- `symbol`: Hook/Transcript
- `kind`: module
- `evidence`: Census `missing-packageDocumentation`. Lead already names the `FileSystem` requirement.
- `impact`: Census module finding stays open.
- `suggestedFix`: Insert `@packageDocumentation` before `@since 0.0.0` on the fileoverview.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Tool.ts

### claudecode-hook-R1-008: Tool value Examples log constructors instead of using them

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Tool.ts:63
- `symbol`: definePreAdapter
- `kind`: value
- `evidence`: Quality bar forbids placeholder Examples of the form `import { fn } from "..."; console.log(fn)`. Every listed value-level export does exactly that via `console.log(Hook.Tool.<Symbol>)` (or `console.log(Hook.Tool.definePreAdapter)` / `definePostAdapter` without calling them). Symbols: `definePreAdapter` (63), `definePostAdapter` (83), `BashToolInput` (108), `BashToolResponse` (135), `ReadToolInput` (162), `ReadToolResponse` (188), `WriteToolInput` (210), `EditToolInput` (232), `GlobToolInput` (259), `GrepOutputMode` (281), `GrepToolInput` (311), `WebFetchToolInput` (340), `WebSearchToolInput` (369), `AgentToolInput` (395), `AgentToolResponse` (435), `AskUserQuestionOption` (468), `AskUserQuestionQuestion` (490), `AskUserQuestionToolInput` (517), `ExitPlanAllowedPrompt` (542), `ExitPlanModeToolInput` (571), `ExitPlanModeToolResponse` (597), `BashAdapter` (627), `ReadAdapter` (648), `WriteAdapter` (669), `EditAdapter` (690), `GlobAdapter` (711), `GrepAdapter` (732), `WebFetchAdapter` (753), `WebSearchAdapter` (774), `AgentAdapter` (795), `AskUserQuestionAdapter` (816), `ExitPlanModeAdapter` (837), `SupportedToolName` (858). Contrast with `decodePreToolUse` / `decodePreToolUseWith` / `decodePostToolUse` / `decodePostToolUseWith`, which already construct payloads and assert decoded fields.
- `impact`: Hover docs do not show make/decode/adapter use. Callers copy `console.log(Hook.Tool.BashToolInput)` and never see `make`, `S.decodeUnknownSync`, or `decodePreToolUseWith`.
- `suggestedFix`: Replace each Example with one observable use of that symbol: `Schema` classes via `.make` or decode; LiteralKits via a decoded/assigned literal; `definePreAdapter`/`definePostAdapter` by constructing a custom adapter; built-in adapters by passing them to `decodePreToolUseWith`/`decodePostToolUseWith` (or logging `adapter.toolName` plus a decoded field). Keep one titled fence per block. Do not add extra Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-009: Post adapters with `S.Unknown` response hide an untyped output channel

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Tool.ts:669
- `symbol`: WriteAdapter
- `kind`: value
- `evidence`: Implementation comments are implicit in `responseSchema: S.Unknown` on `WriteAdapter` (669), `EditAdapter` (690), `GlobAdapter` (711), `GrepAdapter` (732), `WebFetchAdapter` (753), `WebSearchAdapter` (774), `AskUserQuestionAdapter` (816). Leads say "Built-in adapter for the `Write` tool" with no Gotcha. Typed siblings (`BashAdapter`, `ReadAdapter`, `AgentAdapter`, `ExitPlanModeAdapter`) use real response classes. `PostToolTypeMap` encodes `response: unknown` for the untyped set.
- `impact`: Callers of `decodePostToolUse("Write", input)` expect a typed `response` like Bash/Read and then cannot narrow `decoded.response`. That is not visible from the adapter lead.
- `suggestedFix`: Add a short `**Gotchas**` on each untyped post adapter (or one shared sentence in the lead): post-tool `tool_response` is decoded as `unknown` because Claude Code does not publish a stable response shape for this tool. Point `@see` at `decodePostToolUse` / `BashAdapter` as the typed contrast. Do not invent a fake response schema in docs.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-hook-R1-008
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-010: Tool type companions restate names, skip `@see`, and ship tautological Examples

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/claudecode/Hook/Tool.ts:294
- `symbol`: GrepOutputMode
- `kind`: type
- `evidence`: Same-name aliases `GrepOutputMode` (294) and `SupportedToolName` (883) lead with "Type-level model for `…`" and have no described `@see` to the runtime schema (annotation-patterns required companion form). `DecodedPreToolUseWith` (985), `DecodedPreToolUse` (997), `DecodedPostToolUseWith` (1006), `DecodedPostToolUse` (1019) restates "Decoded typed view over …" and never links the decode helpers a caller must choose (`decodePreToolUse` vs `decodePreToolUseWith`, `decodePostToolUse` vs `decodePostToolUseWith`). Eighteen `declare namespace` companions (1255–1833) share the tautology `Encoded extends Readonly<Record<string, unknown>> ? true : false` / `const isWireObject = true` / `console.log(isWireObject) // true` — unused type binding, no encoding shown. `PreToolAdapter` (32) and `PostToolAdapter` (44) lack `@see` to `definePreAdapter` / `definePostAdapter`.
- `impact`: Type-hover readers cannot jump from alias → schema or from `DecodedPreToolUse` → the function that produces it. Namespace Examples teach nothing about wire vs decoded fields.
- `suggestedFix`: Rewrite same-name alias leads as "Decoded value produced by {@link GrepOutputMode}" (and the SupportedToolName equivalent) with `@see {@link …} for the runtime schema and decoding behavior.` Add described `@see` from `Decoded*` to the matching `decode*` pair, and from the adapter interfaces to `definePreAdapter`/`definePostAdapter`. For namespaces, either drop the optional Example or replace it with a real `.make` plus `typeof x.Encoded` / encode round-trip like `HookEffort` in Envelope.ts. Do not add Examples to type aliases that stay prose-only.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-hook-R1-008
- `status`: open
- `fixedCommit`: pending

## Editorial — Matcher.ts

### claudecode-hook-R1-011: Matcher Examples document a sibling, not the owning symbol

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Matcher.ts:49
- `symbol`: matchValue
- `kind`: value
- `evidence`: `matchValue` Example (27–44) only calls `Hook.matchTool`. `testValue` Example (67–73) only calls `Hook.testTool("Bash", "Bash")` with no expected result. `matchFileName` Example (136–147) never calls `matchFileName`; it constructs `Hook.FileChanged.onMatcher` and logs `hook.event`. `matchTool` (129) and `testTool` (178) already have correct Examples on the aliases. Implementation: `matchFileName` splits on `|` as literal basenames and does **not** compile non-exact strings as regex, unlike `matchValue`.
- `impact`: Hover on `matchValue` / `matchFileName` teaches the wrong API. A caller who copies the `matchFileName` Example never sees basename matching, and may assume FileChanged matchers honor `mcp__.*` regex rules.
- `suggestedFix`: Show `matchValue("Bash"|"Edit|Write"|"mcp__.*")` against sample names; show `testValue(pattern, name)` with `// true`/`// false`; show `matchFileName("README.md|package.json")("README.md")` and a regex-looking string that does **not** match as regex. Leave `matchTool` / `testTool` / `handleMatcher` Examples as-is.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-012: matchTool vs matchFileName missing described `@see`; `testTool` lead is wrong

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Matcher.ts:129
- `symbol`: matchTool
- `kind`: value
- `evidence`: Callers must choose `matchValue`/`matchTool` (exact, `|` list, or JS regex when the pattern has other characters) vs `matchFileName` (literal `|` basenames only). No described `@see` exists on either. Fileoverview already warns matchers are **not** required because `settings.json` filters before spawn — that Gotcha is not on the public helpers. `testTool` lead (164) says "Test whether a regex pattern matches a tool name" even though `testTool = testValue` accepts exact tokens and `|` lists.
- `impact`: A FileChanged author who copies `matchTool('README.md|package.json')` still gets regex/exact-list semantics, not basename semantics. `testTool` hover implies only regex.
- `suggestedFix`: Add `@see {@link matchFileName} for FileChanged basename matchers, which never compile `|` segments as regular expressions.` (and the inverse on `matchFileName`). Add a Gotcha on `matchTool`/`testTool` that Claude Code already applies `matcher` in settings before spawn. Rewrite the `testTool` lead to "one-shot test of a tool-name matcher" and drop "regex".
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: claudecode-hook-R1-011
- `status`: open
- `fixedCommit`: pending

## Editorial — Runner.ts

### claudecode-hook-R1-013: processOutput family Examples never call the constructors

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Runner.ts:91
- `symbol`: processOutput
- `kind`: value
- `evidence`: Leads restates the name: "Constructor for `processOutput`" (76), "Constructor for `stderrExit`" (103), "Constructor for `rawStdout`" (122). Examples call `Hook.TaskCompleted.block(...)` or `Hook.WorktreeCreate.created(...)` and log `exitCode` — those helpers *use* `stderrExit`/`rawStdout` internally, but the owning symbols are never shown. `HookProcessOutput` (47) is similar (`TaskCompleted.block`) though it at least yields a process-output instance.
- `impact`: A handler author looking at `processOutput` cannot see `{ exitCode, stdout, stderr }` defaults (`exitCode ?? 0`, optional streams as `Option`). They may think these constructors are event-specific.
- `suggestedFix`: Rewrite leads to the job (build a raw stdio/exit response the runner writes instead of JSON). Examples: `processOutput({ stdout: "ok\n" })`, `stderrExit("blocked", 2)`, `rawStdout("/tmp/wt\n")`, logging `exitCode` and whether stderr/stdout is present. Add described `@see` among the three constructors. Optionally keep `TaskCompleted.block` as a second Example only if titles stay unique; one constructor Example is enough.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-014: Runner program Examples are non-observable; process takeover is undocumented

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Runner.ts:340
- `symbol`: runHookProgram
- `kind`: value
- `evidence`: `runHookProgram` (323) and `runDispatchProgram` (356) Examples `console.log(program)` — unused Effect binding, no execution. `runMain` (450) and `dispatch` (484) log `hook.event` / `Object.keys(hooks)` then call the process-main function (`void` result, reads stdin, writes stdout, `hookTeardown` exit). Law: a void-discarded call is not documentation; Examples must not imply they are safe to run as snippets. `runHookProgram` prose already says production should use `runMain`, but there is no described `@see`. `runDispatchProgram` lead documents "unregistered event succeeds with no output"; that Gotcha is absent from `dispatch`. Exit-code mapping lives only on `hookTeardown` (407–419).
- `impact`: Copied `Hook.runMain(hook)` from the Example takes over the current process. Dispatch authors miss that an unknown `hook_event_name` is a silent success (exit 0, no stdout), which Claude Code treats as passthrough.
- `suggestedFix`: For `runHookProgram`/`runDispatchProgram`, show an observable non-running check (`Effect.isEffect(program)` is still tautological — prefer constructing the hook map and logging `hook.event` / registered keys, or `typeof program`). Do **not** invoke `runMain`/`dispatch` inside the fence; show the definition that would be passed and `@effects`/`@see {@link hookTeardown}` plus `@see {@link runHookProgram}` for the testable form. Lift the unknown-event Gotcha onto `dispatch`. Cross-link `runMain`↔`runHookProgram` and `dispatch`↔`runDispatchProgram`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Transcript.ts

### claudecode-hook-R1-015: `readTranscript` Example is tautological; error/JSONL Gotchas are missing

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P1-high
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Transcript.ts:63
- `symbol`: readTranscript
- `kind`: value
- `evidence`: Example (45–58) builds a program then `console.log(Effect.isEffect(program)) // true`. Implementation (66–74) maps fs and JSON decode failures to `TranscriptReadError`, splits on `\n`, trims, and drops empty lines. Lead mentions `FileSystem` but not those behaviors. No `@see {@link TranscriptReadError}`.
- `impact`: Hover does not show that bad JSONL becomes `TranscriptReadError` (not a raw parse throw) or that blank lines are skipped. `Effect.isEffect` teaches nothing about the return array.
- `suggestedFix`: Keep the Example compilable without touching the filesystem (do not `runPromise` against a real path). Make the result observable by logging a field of the built program that is not tautological, or show `Effect.match` types / `Effect.map((events) => events.length)` as the value being constructed. Add Gotchas: empty/whitespace lines are dropped; each non-empty line is JSON-decoded; both read and parse failures surface as `TranscriptReadError`. Add `@see {@link TranscriptReadError} for the tagged failure raised on read or JSONL decode errors.`
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Bus.ts

### claudecode-hook-R1-016: Bus Interface/Service/layer Examples are unused bindings

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Bus.ts:39
- `symbol`: Interface
- `kind`: type
- `evidence`: `Interface` Example (28–34) is `type Example = Hook.Bus.Interface` with no use. `Service` Example (50–60) logs the unreeling `Effect` from `Effect.service`. `layer` Example (87–94) is `Layer.isLayer(Hook.Bus.layer) // true`. `bus` (108) and `publish` (128) already run against `Hook.Bus.layer` and are acceptable.
- `impact`: Type-level Example is optional; a vacuous one is worse than none. Service/layer hovers do not show subscribe/publish.
- `suggestedFix`: Drop the `Interface` Example or replace it with a type that uses `stream("PreToolUse")`. For `Service`/`layer`, either provide the layer and read `bus.events` (as `bus` already does) or construct `Hook.Bus.layer` and show `Layer.isLayer` is not the job — show `Effect.provide(Hook.Bus.publish(event), Hook.Bus.layer)` instead. Do not add extra Examples on `bus`/`publish`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-017: `publish` is categorized as a getter; bus/publish/`layer` are unlinked

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts
- `affectedFiles`: scratchpad/claudecode/Hook/Bus.ts:147
- `symbol`: publish
- `kind`: value
- `evidence`: `@category getters` on `publish` (144). The symbol writes to the in-process `PubSub`. Canonical roles include `events` (and `utilities`); `getters` is the accessor role used correctly by `bus`. No described `@see` among `publish`, `bus`, `layer`, and `Interface.stream`. `@effects` already notes it publishes to subscribers.
- `impact`: Doc index groups a mutating publish helper with field accessors. Callers of `bus` are not steered to `publish` or to `layer` as the provider.
- `suggestedFix`: Change `publish` to `@category events`. Add `@see {@link bus} for Effectful access to the same service` and `@see {@link layer} for the layer that must be provided`. `bus` may `@see {@link publish}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Context.ts

### claudecode-hook-R1-018: Context accessor leads restate the identifier

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Context.ts:140
- `symbol`: sessionId
- `kind`: value
- `evidence`: Nine accessors share the formula "Effectful access to the …": `sessionId` (121), `transcriptPath` (145), `cwd` (168), `permissionMode` (191), `promptId` (214), `hookEventName` (237), `effort` (260), `agentId` (284), `agentType` (307). Signature already says `Effect.Effect<…, never, Service>`. Examples that `provide(Hook.Context.layer(Testing.makeMockEnvelope()))` and `runPromise` are acceptable — do not replace them just to add more Examples.
- `impact`: Hover repeats the name. Optional-field accessors (`promptId`, `effort`, `agentId`, `agentType`, `permissionMode`) do not say the envelope defaults missing keys to `Option.none` via `SchemaUtils.withNoneDefault`.
- `suggestedFix`: Rewrite each lead as the field's role in a handler (session correlation, JSONL path for `readTranscript`, process cwd, Claude permission mode, etc.). Mention `Option` for the optional fields. Optionally `@see {@link readTranscript}` on `transcriptPath` and `@see {@link fromEnvelope}` as the constructor. Do not invent empty When-to-use sections.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-019: Context Interface/Service/layer Examples are unused or tautological

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Context.ts:39
- `symbol`: Interface
- `kind`: type
- `evidence`: `Interface` Example (28–34) unused `type Example`. `Service` Example (54–63) logs an unprovided `Effect`. `layer` Example (101–109) is `Layer.isLayer(layer) // true`. `fromEnvelope` Example (75–81) is the model to copy (`context.sessionId // "test-session"`).
- `impact`: Same as Bus: optional type Example that does nothing; Service/layer hovers do not show provision.
- `suggestedFix`: Drop or replace the `Interface` Example. Point `Service`/`layer` at the same `Effect.provide(layer(Testing.makeMockEnvelope()))` pattern already used by `sessionId`. Do not add extra accessor Examples.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Editorial — Envelope.ts

### claudecode-hook-R1-020: Envelope same-name types restate the schema and use unused `type Example`

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: target-doctrine-violation
- `sourceRefs`: .patterns/jsdoc-documentation.md; .agents/skills/jsdoc-annotation-specialist/references/annotation-patterns.md
- `affectedFiles`: scratchpad/claudecode/Hook/Envelope.ts:57
- `symbol`: EffortLevel
- `kind`: type
- `evidence`: `export type EffortLevel` (42–57) and `export type HookPermissionMode` (89–104) lead with "Type-level model for `…`" and Example `type Example = Hook.EffortLevel` / `Hook.HookPermissionMode` (unused binding). No `@see` to the runtime LiteralKit. Annotation-patterns require: "Decoded value produced by {@link …}" plus a described `@see`.
- `impact`: Companion types do not navigate to decode/assign behavior already shown on the value exports.
- `suggestedFix`: Replace leads and add `@see {@link EffortLevel} for the runtime schema and decoding behavior.` (and HookPermissionMode). Drop the vacuous Examples; the value-level Examples already teach assignment/decode.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

### claudecode-hook-R1-021: HookPermissionMode and HookEffort leads restate "Schema for `Name`"

- `round`: 1
- `reviewer`: jsdoc-annotation-specialist
- `label`: issue
- `blockingStatus`: blocking
- `severity`: P2-medium
- `doctrineBucket`: cleanup-on-touch
- `sourceRefs`: .patterns/jsdoc-documentation.md
- `affectedFiles`: scratchpad/claudecode/Hook/Envelope.ts:76
- `symbol`: HookPermissionMode
- `kind`: value
- `evidence`: `HookPermissionMode` lead (60) is "Schema for `HookPermissionMode`." `HookEffort` lead (107) is "Schema for `HookEffort`." Examples themselves are fine (decode `"plan"`, `HookEffort.make({ level: "high" })`). `EffortLevel`, `envelopeFields`, `HookEnvelope`, and both `declare namespace` blocks already teach purpose.
- `impact`: Signature echo; hover does not say these are the envelope's permission-mode literal and effort metadata class.
- `suggestedFix`: Rewrite leads to the envelope role (permission mode Claude reports on the hook; effort metadata attached to an invocation). Keep existing Examples. Optional `@see {@link envelopeFields}` / `{@link HookEnvelope}`.
- `recommendedSkillOrAgent`: jsdoc-annotation-specialist
- `fixerGroup`: claudecode-hook
- `acceptanceCommands`: bun scratchpad/.jsdoc-loop/census.ts
- `testsNeeded`: none
- `dependencies`: none
- `status`: open
- `fixedCommit`: pending

## Rejected / not opened

- **Hook.ts `@packageDocumentation`:** census correctly skipped this barrel (`owningExportCount` 0). The hub already has a useful lead, titled Example, `@category`, and `@since`. Do not document the `export { … } from "./Hook/…"` blocks as owning symbols; those leads ("Re-exports the ./Hook/Context.ts public surface") are graph edges.
- **Census owning-export mechanical misses:** none. Confirmed 0 open owning exports: every value export has lead + `@category` + `@since` + titled Example; type exports have lead + tags.
- **Type-level Example optional:** `PreToolAdapter`, `PostToolAdapter`, `GrepOutputMode` (type), `SupportedToolName` (type), `DecodedPreToolUse*`, `DecodedPostToolUse*`, `HookDefinition`, `DispatchMap` — do not open a required-Example item. R1-010 only asks for prose/`@see` (and to drop vacuous namespace Examples).
- **Good Examples left alone:** `decodePreToolUse` / `decodePreToolUseWith` / `decodePostToolUse` / `decodePostToolUseWith`; Context accessors + `fromEnvelope`; Envelope `EffortLevel` value, `envelopeFields`, `HookEnvelope`; Matcher `matchTool`, `testTool`, `handleMatcher`; Runner `hookTeardown`; Bus `bus` / `publish`.
- **Taste-only:** extra blank lines between `@category` and `@since`; trailing blank before `*/`; `import * as Effect from "effect/Effect"` (not a forbidden named Schema/Array/Option import).
- **LiteralKit annotation form:** `EffortLevel`, `HookPermissionMode`, `GrepOutputMode`, `SupportedToolName` already use `$I.annoteSchema` and same-name aliases. Not a missing-annotation gap.
- **Empty `**When to use**` / extra Examples:** do not add formulaic sections or second Examples where one observable fence already exists (or will exist after R1-008/011/013).

## Pack verdict

- files reviewed: 8
- owning exports reviewed: 109
- confirmed mechanical items: 7
- editorial items: 14
- rejected false positives: 0
- accepted findings: 21
