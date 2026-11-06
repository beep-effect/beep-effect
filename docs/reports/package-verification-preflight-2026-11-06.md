# Package verification lint preflight, 2026-11-06

Default `quality package-verify` previously ran the full audit before discovering
package lint failures. The audit owns build, check, test and final lint, so a
simple rejection could arrive after those earlier tasks. Sol round 1 identified
this ordering as candidate S1; a historical effectiveness receipt recorded more
than six minutes before an import-order rejection.

The default plan now runs the existing package `beep:lint` first. If it fails,
audit and docgen do not start and their report rows say `skip`. A passing
preflight preserves the full audit, including its final lint, and docgen.
A package without `beep:lint` reports that preflight as skipped and proceeds to
audit; there is no replacement root scan. Quick mode retains its lint/check
plan and concurrency.

Successful full-mode preflight is early feedback, not an encompassing audit
receipt. It cannot clear earlier lint or check poison. Only a successful full
audit supplies those existing success credits; a failed preflight records its
own lint failure and supplies no audit or check credit.

## Controlled evidence

Real subprocess fixtures cover failing lint, successful full verification,
missing package lint and poison handling. The failing fixture leaves both audit
and docgen markers absent. The green fixture records two lint markers (preflight
and the audit's final lint), one audit marker and one docgen marker. A green
preflight followed by audit exit 7 still runs docgen and records its marker,
preserving the existing collection of later diagnostic results.

A separate local command-order control used a failing lint command plus a
synthetic 200 ms audit and 200 ms docgen. The new preflight returned in 30 ms,
with neither later marker created. Replaying the prior audit/docgen subprocess
order took 453 ms, created both markers and returned audit/docgen exit codes
7/0. The preflight measurement includes target discovery; the prior-order
control directly dispatches those subprocess plans. This demonstrates avoided
work in that fixture, not a production A/B measurement or a net CI percentage.

The earlier real CLI lint sample checked 1,465 files in 1.60 seconds. A green
full run pays one extra package lint invocation of that kind. The final lint
remains necessary because audit tasks can change lint-relevant files.

This preflight covers the package script. For the CLI that script is Biome; it
does not cover the separate repository Effect-Vitest policy. It would not have
caught the EV006 assertion discovered after the fingerprint package audit.

## Validation and reversal

The focused package-verification suite passes 26 tests. Full owning-package
verification passed with the new plan: lint 1.4 s, audit 164.8 s and docgen 40.2 s.
The existing Effect-Vitest detector reports no findings for the touched test file.
The synthetic probe's timings are recorded above separately from this full run.
Run the focused suite with:

```sh
bun run --cwd packages/tooling/tool/cli test test/package-verify.test.ts
```

Reversal removes the default lint preflight and its stop condition, restoring
audit then docgen. Existing quick-mode behavior and audit poison semantics need
no migration.
