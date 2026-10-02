# CI runner security private qualification

The candidate replaces 21 manual providers with a public instrumented
NodeServices layer. Default test services remain. These tests inspect actual
checked-in workflow/action/script files and native shell execution, Git diffs
and executable permissions, so retain native filesystem access. Existing
temporary roots are already scoped. No cloud or real secret operation occurs.

Existing L-FLAKE-04 is repaired by blanking inherited BEEP_CI_SECRET_ variables
before synthetic scenario inputs are applied. Tests run with deliberately
synthetic ambient Turbo/database values. Node and Bun pass all 21 cases
(4.82s/3.40s); types pass; all 195 assertions and 21 names are unchanged.
Restoring the original environment construction fails the empty-secret case
on Bun, proving the repair rejects inherited fixture inputs.

A filtering-only first attempt passed Bun but failed Node: vitest.setup.ts
merges parent process.env with explicit spawn env, reinstating omitted keys.
Explicit blank values isolate this fixture in both runtimes. The adapter parity
gap remains follow-up work; do not claim global subprocess conformance from
this fixture qualification. Final candidate is ci-runner-security.final.next.ts
with safe Biome formatting/import fixes after the runtime proof and final AST
parity. Applied ledger, ratchet and full package proof remain pending.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.
