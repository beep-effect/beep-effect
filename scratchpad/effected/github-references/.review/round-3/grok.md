I'll review the github-references port against the pinned upstream oracle and the round-2 inventory, and report only new findings.Round 2 left three required items. I'll check whether those fixes hold and look for new divergences the green gates would miss.### grok-3-1
- file: scratchpad/effected/github-references/README.md:4
- class: docs   severity: backlog
- standard: scratchpad/EFFECTED_PORT_GOAL.md §10.1 (a sentence that becomes wrong after a law-driven change is rewritten and cited in Port notes). Evidence is the source imports and exports, not the published-package paragraphs already recorded as grok-1-7 and fable-2-8.
- failure: Line 4 says `effect` is the only peer and that the module has no runtime dependencies. Line 14 says `Option` is the only part of `effect` the surface touches. The lab files import `@beep/identity/packages` and `@beep/schema/LiteralKit`, and `IssueReferences.ts` / `ClosingList.ts` import `effect/Array`, `effect/Option`, `effect/Record`, `effect/Schema`, and `effect/String`. The barrel exports those schemas as values. Both sentences describe the upstream package, not this tree.
- fix: Rewrite those two sentences so they name the modules the lab source actually imports, and add one Port notes clause pointing at the schema-first and effect-imports deviations. Leave the grammar, dialect, and fidelity prose as it is.

REQUIRED: 0
BACKLOG: 1
