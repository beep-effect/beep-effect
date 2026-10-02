# Run-scope fixture qualification

The final migration preserves 16 names and 28 original assertions. Thirteen actual shell-fixture cases retain native FileSystem, Path and process services; two early-return cases use NoProbeLayer without FileSystem or Path, and one case is pure. No real systemd scope is created. Public instrumented layers retain explicit hook budgets.

Private Node/Bun proof passes all 16 cases; types pass. Service-absence controls pass on both runtimes and fail both early returns when native providers are restored. Per-invocation acquireUseRelease retains shorter shell-root lifetimes and propagates cleanup errors. Historical NONE and prior fixed assertion rows remain intact.

## Applied eight-file batch, 2026-10-01

This candidate is now applied in the authoritative inventory-next worktree. Full `bun run beep quality package-verify @beep/repo-cli` completed exit 0: audit 676.6 seconds, docgen 24.4 seconds. Applied CI=true eight-suite proof passes 218/218 tests on Node 22.22.3 (31.01 seconds) and Bun 1.4.2 (16.57 seconds). These are focused correctness timings, not controlled package performance comparisons or hosted proof. Formatting preserves the seven prepared candidate body ASTs. Source commit and ledger reconciliation follow this proof checkpoint; historical private-only statements above describe their original qualification stage.
