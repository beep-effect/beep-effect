I'll review the sixteen CLI files against the round-2 inventory, the port decisions, and the pinned upstream oracle. Findings only; nothing will be edited.Round 2 already closed several of these files. I'll read the current commit against the port notes and the pinned oracle, and only raise what is still open.### grok-3-1
- file: scratchpad/effected/cli/CliLinks.ts:127
- class: bug   severity: required
- standard: EFFECTED_PORT_GOAL.md D9, D11 and §14 (verified upstream bug). `LinkTarget` is the executable contract (`Doc.ts:74`). Round-2 `cli-r2-8` replaced this presence test in `Doc.link` and `layout.safeTarget`; this call site still has it.
- evidence: `scratchpad/test/cli/Doc.test.ts:417` builds `{ url: undefined, file: "src/a.ts", line: 3, col: 4 }` and asserts `S.is(LinkTarget)` is true. `makeTarget` still branches on `"url" in target` and calls `cleanUrl(target.url)`. `cleanUrl` (`CliLinks.ts:122`) calls `sanitize` → `stripAnsi` (`internal/displayWidth.ts:29`), which is `input.replace`. `undefined.replace` throws `TypeError`. The pinned oracle `packages/cli/src/CliLinks.ts:82` uses the same `"url" in target` test. `Doc.ts:940` and `internal/layout.ts:58` already select the URL member with `S.is(LinkTarget.members[0])`.
- failure: `CliLinks.target` throws on a schema-valid file link that also carries a non-string `url`. A file URL is never produced, so editor links and OSC 8 wrapping die while `Doc.link` labels that same value as the file.
- fix: Select the URL branch with `S.is(LinkTarget.members[0])`, and keep the file branch for every other `LinkTarget`. A string `url` still wins, including when `file` is also present. Add a `layerTest` regression for the `Doc.test.ts:417` target and record the upstream bug under §14.

### grok-3-2
- file: scratchpad/effected/cli/CliLog.ts:650
- class: schema   severity: required
- standard: D5 and D11; `standards/ARCHITECTURE.md` §5; `standards/effect-first-development.md` EF-33. Struct excess keys are ignored (`SchemaRepresentation.ts` default `onExcessProperty: "ignore"`). Round-2 `cli-r2-5` required this schema to own the branch.
- evidence: `CliLogFile` (`CliLog.ts:195`) is an `S.Union` of `{ envVar: string }` then `{ path: string }`. For `{ path: undefined, envVar: "TOOL_LOG_FILE" }`, the envVar member decodes and the path member does not, so `S.is(CliLogFile)` is true as the envVar case. The layer still uses `"path" in file`, wraps `undefined` in `O.some`, and calls `Path.resolve` (`effect/Path.ts:390` reads `path.length`). An object with both strings matches both members; the union lists envVar first, while line 650 always takes `path` when the key is present.
- failure: A schema-valid `{ envVar }` configuration that also has a non-string `path` key throws while the layer is built, and the variable is never read. Two valid keys are the envVar case under the schema and the path case at runtime, so the file that is written depends on which contract the caller uses.
- fix: Declare the path struct first. Choose it with `S.is` of that member, and read `envVar` for every other `CliLogFile`. Valid dual-key objects keep today's path precedence; a non-string `path` follows the envVar case. Add both regressions and record the schema-owned branch under the existing schema-first deviation.

### grok-3-3
- file: scratchpad/effected/cli/CliPrompt.ts:134
- class: bug   severity: required
- standard: D5 and D11; ARCHITECTURE §5; EF-33. `CliPrompt.fallback` passes a `CliPromptTarget` into `answerWithoutPerson` (`internal/fallbackAnswer.ts:40`).
- evidence: `CliPromptTarget` (`CliPrompt.ts:34`) tries `{ flag: string }` first, then `{ argument: string }`, and ignores excess keys. `{ flag: undefined, argument: "file" }` fails the flag member and passes the argument member, so `S.is(CliPromptTarget)` is true. `answerWithoutPerson` then sees `"flag" in target` and calls `CliError.MissingOption.make({ option: undefined })`. `Schema.TaggedError.make` is `SchemaParser.make` (`Schema.ts:15903`), and `makeConstructorSync` (`SchemaParser.ts:1139`) throws through `runSync` when the payload is not a string. The same presence test is what upstream used before this schema existed.
- failure: A non-interactive fallback for a schema-valid argument target dies with a schema constructor error whenever the object also has a non-string `flag` key. The run never fails with `MissingArgument` for `file`, so `CliRuntime.main` does not exit `64` with core's missing-argument report.
- fix: In `answerWithoutPerson`, select the flag error with `S.is(CliPromptTarget.members[0])` and the argument error otherwise. Keep the `otherwise` check ahead of both. Add a regression for `{ flag: undefined, argument: "file" }` with no `otherwise`, expecting `MissingArgument`.

REQUIRED: 3
BACKLOG: 0
