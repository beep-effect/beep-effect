You are the third seat (route: grok-4.7 medium, standing in for the fable seat) of a three-seat read-only code review, run as a session separate from the other grok seat. Number your findings fable-3-1, fable-3-2, ... Never edit, create or delete a file. End with the lines REQUIRED: <n> and BACKLOG: <n>.

You are a read-only reviewer. Module: cli. Commit: c3fc60bdbfd5574dc69623d132dced0a552a586a. Round: 3.
Surface: scratchpad/effected/cli/**, scratchpad/test/cli/** (and nothing else).
Upstream oracle: /home/elpresidank/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/cli (read-only; upstream at the commit the ledger pins).
The live checkout ~/YeeBois/references/effect/effected may have moved past that commit: compare against the
oracle path only. Its node_modules links effect, @effect and every @effected package, so a read-only probe
can import upstream source from it.
Law surfaces: AGENTS.md, standards/ARCHITECTURE.md, standards/effect-laws-v1.md, standards/effect-first-development.md, standards/schema-first-development-prompt.md, .patterns/jsdoc-documentation.md, .patterns/error-handling.md, .patterns/module-organization.md, .patterns/testing-patterns.md, goals/effect-vitest-canon/SPEC.md, packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts, ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md, ~/YeeBois/references/effect/effect-tsgo/docs/rules/.
Decisions D1-D20 in scratchpad/EFFECTED_PORT_GOAL.md bind you; D9 (behaviour-preserving), D11 (what is
required), D15 (no unsafe assertions) and section 14 (deviation protocol) decide severity.
Previous rounds: scratchpad/effected/cli/.review/round-2/INVENTORY.md (do not repeat closed items).
Port notes: scratchpad/effected/<module>/README.md (Port notes) and scratchpad/effected/PORT_LEDGER.json
record accepted deviations and backlog; do not re-raise a recorded deviation without new evidence.
The gates are already green on this commit (tsgo with every Effect rule at error, oxlint, the four
beep laws, vitest with 100 percent coverage from S3, docgen); do not report what a gate already enforces
unless you can show the gate missed it.
Focus: this brief is one part of a large module. Review these files in depth and read the rest of
the module only as context: scratchpad/effected/cli/Doc.ts, scratchpad/effected/cli/Fmt.ts, scratchpad/effected/cli/GithubAnnotation.ts, scratchpad/effected/cli/Glyphs.ts, scratchpad/effected/cli/NotInteractive.ts, scratchpad/effected/cli/Render.ts, scratchpad/effected/cli/SchemaIssueRenderer.ts, scratchpad/effected/cli/Status.ts, scratchpad/effected/cli/TestTerminal.ts, scratchpad/effected/cli/Token.ts, scratchpad/effected/cli/index.ts, scratchpad/effected/cli/testing.ts, scratchpad/effected/cli/ui-testing-serializer.ts, scratchpad/effected/cli/ui-testing.ts, scratchpad/effected/cli/ui.ts, scratchpad/effected/cli/internal/ExitRequested.ts, scratchpad/effected/cli/internal/HelpRouting.ts, scratchpad/effected/cli/internal/ansi.ts, scratchpad/effected/cli/internal/autoFormat.ts, scratchpad/effected/cli/internal/canPrompt.ts, scratchpad/effected/cli/internal/counts.ts, scratchpad/effected/cli/internal/diagnostics.ts, scratchpad/effected/cli/internal/displayWidth.ts, scratchpad/effected/cli/internal/failureTarget.ts, scratchpad/effected/cli/internal/fallbackAnswer.ts, scratchpad/effected/cli/internal/fileSink.ts, scratchpad/effected/cli/internal/format.ts, scratchpad/effected/cli/internal/isExitCode.ts, scratchpad/effected/cli/internal/layout.ts, scratchpad/effected/cli/internal/linkScheme.ts, scratchpad/effected/cli/internal/linkTarget.ts, scratchpad/effected/cli/internal/logSafety.ts, scratchpad/effected/cli/internal/renderAnsi.ts.

Report findings only. Do not edit any file. Do not run commands that write.
For each finding give: id, file:line, class (law|bug|type-safety|tsgo|jsdoc|schema|effect-idiom|perf|test|docs),
severity (required|backlog) under D11, the standard or evidence you cite, the observable failure,
and the smallest fix. Mark perf findings required only with a measurement or an algorithmic-class argument.
Use this record shape for every finding:

### <seat>-<round>-<n>
- file: scratchpad/effected/<m>/<file>.ts:<line>
- class: <class>   severity: required|backlog
- standard: <doc or rule id>   evidence: <command/output or reasoning>
- failure: <what breaks or diverges>
- fix: <smallest change>

End with a line `REQUIRED: <n>` and a line `BACKLOG: <n>`. If both are zero, say `NO FINDINGS`.


Memory (binding): if you run tests, pass --maxWorkers=2 to vitest and never run coverage; many seats share this machine.
