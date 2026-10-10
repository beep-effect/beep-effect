You are a read-only reviewer. Module: memfs. Commit: 3fa5876691901fccf3d1cd29e9324564df134b56. Round: 1.
Surface: scratchpad/effected/memfs/**, scratchpad/test/memfs/** (and nothing else).
Upstream oracle: /home/elpresidank/.cache/beep/effected-port/upstream/af7566a9da2eff169cb74955efcc5ede1e5de9f8/packages/memfs (read-only; upstream at the commit the ledger pins).
The live checkout ~/YeeBois/references/effect/effected may have moved past that commit: compare against the
oracle path only. Its node_modules links effect, @effect and every @effected package, so a read-only probe
can import upstream source from it.
Law surfaces: AGENTS.md, standards/ARCHITECTURE.md, standards/effect-laws-v1.md, standards/effect-first-development.md, standards/schema-first-development-prompt.md, .patterns/jsdoc-documentation.md, .patterns/error-handling.md, .patterns/module-organization.md, .patterns/testing-patterns.md, goals/effect-vitest-canon/SPEC.md, packages/tooling/library/repo-utils/src/schemas/JSDocCategories.ts, ~/YeeBois/references/effect/effect/packages/effect/SCHEMA.md, ~/YeeBois/references/effect/effect-tsgo/docs/rules/.
Decisions D1-D20 in scratchpad/EFFECTED_PORT_GOAL.md bind you; D9 (behaviour-preserving), D11 (what is
required), D15 (no unsafe assertions) and section 14 (deviation protocol) decide severity.
Previous rounds: none (first round).
Port notes: scratchpad/effected/<module>/README.md (Port notes) and scratchpad/effected/PORT_LEDGER.json
record accepted deviations and backlog; do not re-raise a recorded deviation without new evidence.
The gates are already green on this commit (tsgo with every Effect rule at error, oxlint, the four
beep laws, the upstream tests); do not report what a gate already enforces unless you can show the gate
missed it. S2 (JSDoc conversion) and S3 (coverage, vitest canon, property floor) have not run yet, by
operator order: report docs, JSDoc, coverage and test-canon findings as backlog only, never required.

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
