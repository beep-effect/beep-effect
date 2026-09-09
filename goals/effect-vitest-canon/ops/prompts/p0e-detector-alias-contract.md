# P0e detector integration for the instrumented tester

This is a bounded P0e integration lane, not P1/P2 adoption or a detector rewrite.
The user explicitly requires Codex CLI implementation lanes with disjoint
ownership, report-first, medium effort and gpt-daybreak-blue-latest. Create
history/lanes/p0e-detector-alias.md within the first actions and append as you
work. Your final response is only that report's absolute path.

You are not alone. Another lane owns test-utils Vitest source/roles/tests and
fixtures. The orchestrator owns packet docs/charters/decisions, dependencies,
all git/inbox-waiver/publication actions, final artifact regeneration and full
package verification. Preserve every concurrent and prior edit. Never run git
commands, spawn agents, acknowledge/waive inbox rows, or edit other paths.

## Concrete problem

P0d completed with a verified syntax-only ratchet. P0e adds the public
@beep/test-utils/Vitest subpath exporting an instrumented it. Three paired
orchestrator syntax probes confirm that changing only the import module from
@effect/vitest to @beep/test-utils/Vitest suppresses EV001, EV004 and EV008.
The probe data and reproducible script are supplied in the private cache.
The new facade must remain visible to the ratchet before P2 adoption.

## Owned files

- packages/tooling/tool/cli/src/commands/Lint/internal/EffectVitestSyntax.ts:
  only module/binding recognition needed for the new public instrumented it.
- packages/tooling/tool/cli/test/effect-vitest-detectors.test.ts:
  meaningful paired alias/provenance and regression coverage.
- goals/effect-vitest-canon/history/lanes/p0e-detector-alias.md: your report.

No Detectors.ts algorithm edits, scan/glob/census/schema/policy/graph changes,
other source/test packages, generated baseline/rows, dependencies, configuration
or broad refactoring. Request a concrete ownership extension in the report if
the exact fix requires another path. The P0c/P0d Syntax freeze is lifted ONLY
for this explicitly assigned alias integration. All other completed behavior
and tests remain binding.

## Implementation and evidence

Read AGENTS, the Effect-first/schema-first laws relevant to the edit, and the
P0c/P0d receipts. Search live source and barrels before adding any helper.
Reuse the existing provenance and shadowing logic; keep ts-morph syntax-only
and preserve rule predicates, finding identities/evidence/classification and
the D9 scope. No import prefilter or performance algorithm change.

The new subpath exports it and TestHang; it does not export expect, vi,
beforeEach, test, standalone effect/live/layer, or other Vitest API names.
Do not blanket-classify every symbol from that module as a tester. Support
direct it, renamed imports and namespace.it, including effect/live/each/prop,
layer and nested layer callback bindings. Preserve shadowing and negative
cases for unrelated test-utils subpaths and non-tester exports. Standard
@effect/vitest and vitest behavior stays unchanged.

Prove paired equivalent findings for original versus instrumented imports,
including runtime boundary, scope and TestClock cases, plus the public forms
above. Do not weaken any old expectations to pass. Compare rule/class/evidence/
mechanization as appropriate; module spelling itself is the only test input
change for paired probes.

Use command-scoped Bun 1.4.1. Run the complete focused effect-vitest detector,
contract, primitives and store suites, plus the affected lint allowlist test.
Run changed-file Biome and direct Effect compiler if possible; record a managed
Node-launcher failure honestly and use the existing Bun tsgo shim for supporting
proof. Do not run package-verify, a broad audit/build/check/coverage command, or
scanner writer/timing while the other test-utils writer is active. The
orchestrator runs required full @beep/repo-cli package verification after both
writers have handed back and regenerates artifacts only through the exact CLI.

Read-only access to the new facade is available for its export contract; do
not modify or depend on unfinished private implementation details. Report
changed paths, paired-probe results, focused test counts/commands/exits,
compiler/lint evidence and any concrete open concern. No work in P0.5 or later.
