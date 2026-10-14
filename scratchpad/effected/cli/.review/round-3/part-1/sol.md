### sol-3-1
- file: scratchpad/effected/cli/CliLinks.ts:127
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `LinkTarget`’s executable contract.   evidence: A read-only probe passed `{ file: "/repo/a.ts", url: undefined }` to `CliLinks.layerTest("file")`’s `target`. `S.is(LinkTarget)(target)` returned `true`, and an in-memory TypeScript caller produced zero diagnostics. Both the reviewed port and pinned oracle threw `TypeError: undefined is not an object (evaluating 'input.replace')`. Round-2 cli-r2-8 repaired this input in `Doc.link` and layout; this public service remains a separate failing consumer.
- failure: A schema-valid, type-correct file target enters the URL branch because the unused `url` property exists. Direct service calls and calls through `CliLinks.linker` can throw instead of returning the file URL or label.
- fix: Select the URL branch with the URL-member schema guard, preserving precedence for a valid URL and otherwise using the file member. Add a direct-service regression and extend the recorded upstream-bug deviation to this consumer.

### sol-3-2
- file: scratchpad/effected/cli/CliLog.ts:650
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `CliLogFile`’s executable contract.   evidence: `{ envVar: "LOG_PATH", path: undefined }` passes `S.is(CliLogFile)` and compiles as `CliLogFile` with zero caller diagnostics. A read-only probe supplied `LOG_PATH=/logs/a.ndjson`, a stub filesystem, and the Path service. Building and using the logger returned a defect, `TypeError: undefined is not an object (evaluating 'path.length')`, in both the port and pinned oracle; the stub received zero writes.
- failure: A valid environment-variable configuration selects the path branch solely because `path` exists. `Path.resolve(undefined)` then kills logger construction instead of resolving the configured environment path.
- fix: Select the path branch with a named path-member schema guard and otherwise resolve the environment-variable member. Preserve explicit-path precedence when both values are valid. Add the regression and record the verified upstream bug.

### sol-3-3
- file: scratchpad/effected/cli/CliPrompt.ts:134
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `CliPromptTarget` and the documented noninteractive missing-parameter behavior.   evidence: `{ argument: "project", flag: undefined }` passes `S.is(CliPromptTarget)` and compiles as `CliPromptTarget` with zero caller diagnostics. Running `CliPrompt.fallback(Prompt.succeed("unused"), target)` with the default noninteractive reference returned `Failure(Die(Error: Schema validation failed))` in both the port and pinned oracle. The delegated `answerWithoutPerson` selects `MissingOption` using `"flag" in target` and constructs it with `option: undefined`.
- failure: A valid positional-argument target becomes a defect instead of the typed `MissingArgument("project")` usage error. Under failure reporting, it consequently follows the defect path rather than the expected missing-parameter path.
- fix: In the shared fallback-answer helper, select the flag case by its valid string payload or member-schema guard; otherwise select the argument case. Preserve flag precedence when both payloads are valid. Add a public `CliPrompt.fallback` regression and record the verified upstream bug.

### sol-3-4
- file: scratchpad/effected/cli/CliLog.ts:195
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D9 and D11; standards/ARCHITECTURE.md §5, “Schemas Are Executable Contracts”; standards/effect-first-development.md EF-33.   evidence: A read-only probe encoded and decoded `{ path: "/explicit.ndjson", envVar: "LOG_PATH" }` through `CliLogFile`. Both operations selected the first, environment-variable member, producing `{ envVar: "LOG_PATH" }`. With `LOG_PATH=/environment.ndjson`, a stub filesystem observed `/explicit.ndjson` when logging with the original value and `/environment.ndjson` after the schema round trip. The original value compiles as `CliLogFile` with zero caller diagnostics.
- failure: The new codec changes the configuration’s meaning. Runtime dispatch gives a valid explicit path precedence, while schema encoding and decoding give `envVar` precedence and discard the path. Persisting or normalizing an otherwise valid configuration redirects its log output.
- fix: Put the path member before the environment-variable member in `CliLogFile`, matching the existing runtime precedence. Add a round-trip fidelity regression with both keys present. This repairs the introduced schema implementation without changing upstream runtime behavior.

### sol-3-5
- file: scratchpad/effected/cli/CliRuntime.ts:631
- class: effect-idiom   severity: required
- standard: standards/effect-first-development.md EF-30, precise recovery; EFFECTED_PORT_GOAL.md D11 and §14’s verified-upstream-bug exception.   evidence: A read-only probe supplied a platform layer whose first build self-interrupted and whose next build returned test Stdio and Terminal services. `CliRuntime.main` ran with `env.log: { format: "json", level: "None" }`. Both the port and pinned oracle returned `{ builds: 2, executed: 1, exit: "Success" }`. The unconditional logger-build `Layer.catchCause` recovered the first interruption. The recorded round-2 interruption correction concerns `inkChalk`, not this runtime fallback.
- failure: A platform interruption becomes a logger fallback. `main` rebuilds the platform, executes the program, and can report success after initialization explicitly interrupted.
- fix: Propagate interruption causes from logger construction; use the plain logger fallback only for noninterrupt causes. Add the self-interrupting-platform regression and record this independently verified upstream bug.

### sol-3-6
- file: scratchpad/effected/cli/CliRuntime.ts:751
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11, and §14’s verified-upstream-bug exception; `reportFailures`’ documented guarantee to render and re-fail with runtime marks preserving the chosen exit code.   evidence: A read-only probe ran `Effect.fail(Object.freeze(new Error("original")))` through `reportFailures({ exitCode: 23 })` with a capturing logger. Both the port and pinned oracle emitted one diagnostic, then returned `Die(TypeError: Attempting to define property on object that is not extensible.)`; `Runtime.getErrorExitCode(Cause.squash(exit.cause))` returned `1`. Round-2 cli-r2-3 fixed throwing string conversion, not marker installation on immutable errors.
- failure: Successfully reporting an immutable error creates a secondary, unmarked defect while installing the runtime markers. The requested exit code is lost, and the platform runtime can report the secondary defect again.
- fix: Handle failed marker installation by creating a fresh marked error that retains the original failure as its cause and carries the selected exit code. Keep in-place marking for mutable errors, and make the return signature account for the fallback wrapper. Add the immutable-error regression and record the verified upstream bug.

### sol-3-7
- file: scratchpad/effected/cli/CliRuntime.ts:739
- class: type-safety   severity: required
- standard: EFFECTED_PORT_GOAL.md D11; the generic overload’s returned type must describe the implementation’s result.   evidence: An in-memory TypeScript caller passed `{ name: "Error", message: "boom", _tag: "RemoteError", code: 42 }` to `CliRuntime.reported` and assigned `marked.code` to `number` and `marked._tag` to `string`, with zero caller diagnostics. A read-only runtime probe returned a different instance with `_tag: "CliRuntimeError"` and `code: undefined`. The pinned oracle likewise strips `code`. The prose at lines 720–725 acknowledges structural Error lookalikes, but neither that prose nor the recorded deviations makes the overload sound.
- failure: A valid structural `E extends Error` caller receives a wrapper typed as its original subtype. Code can typecheck against properties and methods that the returned object does not have; tagged recovery can also dispatch on a different tag than the advertised subtype.
- fix: Widen the overload to include the fallback `Error` result, such as `E | Error`, and adjust callers to narrow it. Preserve the existing runtime wrapping behavior. Add a structural-Error regression proving that the public signature no longer promises stripped subtype members.

### sol-3-8
- file: scratchpad/effected/cli/CliAudience.ts:52
- class: schema   severity: required
- standard: EFFECTED_PORT_GOAL.md D5 and D11; standards/ARCHITECTURE.md §5; standards/schema-first-development-prompt.md, “Schema owns pure data”; standards/effect-first-development.md EF-33.   evidence: `AudienceFlagInput` remains a handwritten array payload, and `CliAudienceFlagsOptions` at line 70 remains a handwritten boolean configuration. The focused surface also retains pure-data declarations for `CliLinksOptions` (`CliLinks.ts:86`), `CliEnvTestOptions` (`CliEnv.ts:129`), `CliThemeOptions` and `CliThemeTestOptions` (`CliTheme.ts:84,98`), `CliMessageOptions` (`CliMessage.ts:17`), and `CliLogStatusOptions` (`CliLog.ts:45`). These contain scalar fields, arrays, records, or existing schema-backed models; they are not service contracts or type-level transforms. No executable schemas own these declarations. The green mechanical gates therefore miss the same semantic schema-ownership requirement identified for other payloads in prior rounds.
- failure: These public input and configuration models still have erased declarations as their source of truth. Their validation, codecs, metadata, and schema-derived arbitraries cannot be derived from the required executable contracts.
- fix: Define identity-annotated structural schemas and derive the existing types from them, reusing the existing audience, color, token, style, and editor-link domains. Preserve optional-key and explicit-`undefined` behavior and existing constructor behavior. Register added value exports and add the D10 properties.

### sol-3-9
- file: scratchpad/effected/cli/CliLinks.ts:44
- class: test   severity: required
- standard: EFFECTED_PORT_GOAL.md D10’s per-exported-schema round-trip property requirement; D11’s law-violation criterion.   evidence: `EditorLinks` is now an exported runtime schema. An exhaustive `rg -n 'EditorLinks' scratchpad/test/cli` finds only type imports and option annotations in the existing link tests. No test encodes or decodes `EditorLinks`, and no property uses `Arbitrary.schema(EditorLinks)`. The nearest property, `CliLinks.property.test.ts:40`, constructs a separate `S.Literals(["file", "vscode", "off"])`, excludes `"auto"`, and tests environment parsing rather than the production schema’s codec. Thus the green suite does not establish D10 for this added schema.
- failure: The required schema-derived round-trip proof is absent for `EditorLinks`; changes to its codec or complete vocabulary are outside the purported property floor.
- fix: Add an `fcRuns`-bounded property generated from `Arbitrary.schema(EditorLinks)` that encodes, decodes, and re-encodes every generated value, asserting value and encoded-form fidelity. Keep the environment-parser property as a separate behavior test.

REQUIRED: 9
BACKLOG: 0