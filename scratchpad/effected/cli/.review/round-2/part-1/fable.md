<!-- seat: grok-4.7 medium (third seat; Fable and cursor Opus quota exhausted, 2026-10-09) -->
I'll review this CLI slice read-only against the round-1 inventory, the port ledger, and the pinned upstream oracle.Round-1 items on this slice are closed or deferred. I'll diff the focus files against the pinned oracle and look for new divergences the gates would miss.S2 and S3 are recorded green, so I’ll read the focus implementations against the oracle and look for divergences the gates would not catch.The remaining open questions are whether `S.is` widens `instanceof` on the CLI errors, and whether the leftover literal lists are still a required schema miss. I’ll check those against the oracle and the cited laws, then report only new findings.### fable-2-1
- file: scratchpad/effected/cli/CliFailure.ts:298
- class: bug   severity: required
- standard: D9 / section 14 (accepted input and formatted result); upstream `CliFailure.ts` dieBlocks/failBlocks use `instanceof Cancelled` and `instanceof NotInteractive`   evidence: `Schema.is` (`SchemaParser.ts:143-157`) returns true when the parser succeeds, and `compilerAdaptersEnabled` defaults to false (`compilerRegistry.ts:37`). A class parser (`interpreter.ts:86-90`) decodes any value that is not already constructed, and the class transform builds `new self(input)` (`Schema.ts:15947-15949`). `{ _tag: "Cancelled", reason: "escape" }` and `{ _tag: "NotInteractive" }` therefore pass `S.is` without being instances. Line 298 and line 329 then read `.message` and return that single paragraph.
- failure: A plain lookalike takes the one-line cancellation path. It does not carry the prototype getter (`cancelled; nothing written` / `not interactive: run in a terminal or pass the flag`), so the report prints that object's own `message` and skips the failure-status line upstream still builds for a non-instance.
- fix: Gate both short-circuits with `instanceof Cancelled` and `instanceof NotInteractive`, as upstream does. Real `S.TaggedError` instances still match; decoded lookalikes keep the generic report.

### fable-2-2
- file: scratchpad/effected/cli/CliRuntime.ts:462
- class: bug   severity: required
- standard: D9 / section 14; `Cause.YieldableError` is what `yield*` can fail with (`Cause.ts:1186-1188`); upstream `CliRuntime.ts:379` and `:424-425` use `instanceof`   evidence: Same parser path as fable-2-1. `ExitRequested` is `{ _tag: "ExitRequested", code: Finite }`, so `{ _tag: "ExitRequested", code: 2 }` passes `S.is(ExitRequested)` and is not iterable. The same widening sets `isCancelled` / `isNotInteractive` at lines 506-507.
- failure: `reportFailures` treats that lookalike as an already-handled exit and then `yield*`s it. The generator throws because the object has no effect iterator, so the original failure becomes a defect in the reporter. A custom `render` also sees `isCancelled` or `isNotInteractive` for a non-instance and can suppress the report upstream would still print.
- fix: Use `instanceof ExitRequested`, `instanceof Cancelled`, and `instanceof NotInteractive` for these three branches. Keep `yield*` only for a real `ExitRequested` instance.

### fable-2-3
- file: scratchpad/effected/cli/CliAudience.ts:27
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; AGENTS.md Code Laws (named `LiteralKit` domains over duplicate literal lists); `standards/schema-first-development-prompt.md` "Derive behavior instead of duplicating truth"   evidence: `KINDS` is `["human", "agent", "ci"]` and `Flag.Literals("audience", KINDS)` is at line 199. `env/index.ts` type-only-exports `AudienceKind`. The value kit is `LiteralKit(["human", "agent", "ci"])` in `scratchpad/effected/env/Audience.ts:31`, and `internal/scanAudience.ts:62` already guards with `S.is(AudienceKind)`. Round-1 cli-14 fixed only that scanner. A `ReadonlyArray<AudienceKind>` may omit a member and still typecheck.
- failure: `--audience` choices and the pre-parse scan are two copies of one domain. A new `AudienceKind` member is recognized by `scanAudience` and omitted from the flag, so help, core's parser, and the argv scan disagree.
- fix: Import the `AudienceKind` value from `../env/Audience.ts`, pass `AudienceKind.literals` to `Flag.Literals`, and delete `KINDS`. Leave the `--human`, `--agent`, and `--ci` boolean flags as they are.

### fable-2-4
- file: scratchpad/effected/cli/CliLinks.ts:32
- class: schema   severity: required
- standard: `standards/effect-laws-v1.md` law 19; `standards/effect-first-development.md` EF-35; `standards/schema-first-development-prompt.md` (prefer `LiteralKit.literals` and `S.is` over a duplicate literal array)   evidence: `export type EditorLinks = "auto" | "vscode" | "file" | "off"` at line 32, repeated by `MODES` at line 91. `parseSetting` (line 93) and the warning at line 173 both use `MODES`. `CliEnv.ts:108` and `index.ts` consume the type. Dropping a member from `MODES` still typechecks. This symbol is outside the schema-first ledger list (color, token, status, key, span, scanAudience).
- failure: The accepted editor-link setting and the "not one of …" warning can drift from the exported type. An env value that the type allows is ignored when it is missing from `MODES`.
- fix: Define an identity-annotated `LiteralKit(["auto", "vscode", "file", "off"])`, derive `export type EditorLinks` from it, parse with the existing trim and lower-case plus `S.is`, and join `EditorLinks.literals` in the warning. Keep the member order.

REQUIRED: 4
BACKLOG: 0
