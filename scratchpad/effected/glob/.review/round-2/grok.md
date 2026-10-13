I'll review the glob port against the pinned upstream oracle and the round-1 inventory, and report only new findings.The prior pass left one open candidate: stale `#fillNegs` prose. I am checking that site against the round-1 inventory and the pinned oracle before deciding whether it is a new finding.The coverage ledger removed the `#fillNegs` child throw and left the JSDoc. I am checking the other removed branches for the same stale-prose drift before deciding whether that is a finding.### grok-2-1
- file: scratchpad/effected/glob/internal/ast.ts:643
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.1 (prose that is wrong after a law-driven change must be rewritten). D11: not a structural JSDoc-law break. evidence: `#fillNegs` **Details** says a child call throws `ASTError`. The body at line 658 no longer checks `this !== this.#root`. The pinned oracle throws `new Error("should only call on root")` at `ast.ts:254`. The ledger coverage row for `ast.ts:659` records that check as removed because the only caller is the root (`toRegExpSource`, line 1382). That row does not accept the leftover sentence. Distinct from fable-1-12 (brace-expansion `TypeError` comments).
- failure: The hover claims a child call throws `ASTError`. A child call now runs the shared `#negs` fill and does not throw.
- fix: Delete the throw clause. Say the only caller is the root inside `toRegExpSource`.

### grok-2-2
- file: scratchpad/effected/glob/internal/ast.ts:1249
- class: docs   severity: backlog
- standard: EFFECTED_PORT_GOAL.md §10.1; `.patterns/jsdoc-documentation.md` (Details/Gotchas teach the call contract). D11 keeps this backlog, same disposition as fable-1-12. evidence: `AST.fromGlob` **Gotchas** requires a non-negative `maxExtglobRecursion`. `assertCap` (`internal/limits.ts:314`) rejects `value < 1`, and `GlobPatternOptions.maxExtglobRecursion` (`GlobPattern.ts:260`) is `S.isGreaterThan(0)`. The oracle `assertCap` uses the same `< 1` check. `0` is non-negative and is a defect.
- failure: A caller who passes `0` from this gotcha gets `InvalidCap`, not degrade-to-literal.
- fix: Change "non-negative" to "positive".

REQUIRED: 0
BACKLOG: 2
