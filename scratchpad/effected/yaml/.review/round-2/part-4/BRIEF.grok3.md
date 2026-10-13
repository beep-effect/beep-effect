You are the third seat (route: grok-4.7 medium, standing in for the fable seat) of a three-seat read-only code review, run as a session separate from the other grok seat. Number your findings fable-2-1, fable-2-2, ... Never edit, create or delete a file. End with the lines REQUIRED: <n> and BACKLOG: <n>.

You are a read-only reviewer. Module: yaml. Commit: 2f515ae2519cc72223c94917019bf7ebfe92a4a5. Round: 2.
Surface: scratchpad/effected/yaml/**, scratchpad/test/yaml/** (and nothing else).
Upstream oracle: /home/elpresidank/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/yaml (read-only; upstream at the commit the ledger pins).
The live checkout ~/YeeBois/references/effect/effected may have moved past that commit: compare against the
oracle path only. Its node_modules links effect, @effect and every @effected package, so a read-only probe
can import upstream source from it.
Law surfaces: AGENTS.md, standards/ARCHITECTURE.md, standards/effect-laws-v1.md, standards/effect-first-development.md, standards/schema-first-development-prompt.md, .patterns/jsdoc-documentation.md, .patterns/error-handling.md, .patterns/module-organization.md, .patterns/testing-patterns.md, goals/effect-vitest-canon/SPEC.md, packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts, ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md, ~/YeeBois/references/effect/effect-tsgo/docs/rules/.
Decisions D1-D20 in scratchpad/EFFECTED_PORT_GOAL.md bind you; D9 (behaviour-preserving), D11 (what is
required), D15 (no unsafe assertions) and section 14 (deviation protocol) decide severity.
Previous rounds: scratchpad/effected/yaml/.review/round-1/INVENTORY.md (do not repeat closed items).
Port notes: scratchpad/effected/<module>/README.md (Port notes) and scratchpad/effected/PORT_LEDGER.json
record accepted deviations and backlog; do not re-raise a recorded deviation without new evidence.
The gates are already green on this commit (tsgo with every Effect rule at error, oxlint, the four
beep laws, vitest with 100 percent coverage from S3, docgen); do not report what a gate already enforces
unless you can show the gate missed it.
Focus: this brief is one part of a large module. Review these files in depth and read the rest of
the module only as context: scratchpad/effected/yaml/internal/composer/comments.ts, scratchpad/effected/yaml/internal/composer/document.ts, scratchpad/effected/yaml/internal/composer/flow.ts, scratchpad/effected/yaml/internal/composer/scalars.ts, scratchpad/effected/yaml/internal/composer/state.ts, scratchpad/effected/yaml/internal/composer/tags.ts, scratchpad/effected/yaml/internal/rules/catalog.ts, scratchpad/effected/yaml/internal/rules/colon-spacing.ts, scratchpad/effected/yaml/internal/rules/comments-spacing.ts, scratchpad/effected/yaml/internal/rules/document-end.ts, scratchpad/effected/yaml/internal/rules/document-start.ts.

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
