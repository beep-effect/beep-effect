# CLI and config preparation

This wave consumes the existing inventories for `@beep/ai-provider-cli` and
`@beep/architecture-lab-config`: four existing test files, 43 reviewed rows.
The source-only Codex review covered all four tests and all five inventory
surfaces. All providers are mocked; no provider CLI or credential is invoked.
Current Effect is pinned to `330b7475e2135bb9bc6aad1df5d513d32299ebc1`.

D12 order remains scope, assertions, property, flake, observability. Delete
the two redundant layer wrappers. Pure runner/config stubs retain their D14
exemption; native service/logger composition needs named layer ownership.
Preserve all 17 Option payload/polarity expectations, six provider property
domains at 50 runs and four config domains at 25 runs. Preserve the exact
one-record diagnostics assertion and verify it with tracing enabled.

The architecture config test is an accepted generator template input. Its
intentional changes require operation-plan replay and dependency proof before
publication; no generator production edit is pre-authorized by this wave.

Baseline raw reports and context receipts are under the `cli-config` timing
subdirectories. Source hashes remained stable during each invocation; host
load and pressure are captured, so these are measurements, not speed promises.

- ai-provider-cli node: 18 passed, 0 skipped
- ai-provider-cli bun: 18 passed, 0 skipped
- architecture-lab-config node: 3 passed, 0 skipped
- architecture-lab-config bun: 3 passed, 0 skipped

## Scope proof

Both redundant scoped-layer wrappers are deleted. Native `it.layer` now owns
the distinct provider runners and config fixture; the native diagnostic
fixture retains its exact log record. Capture Refs are isolated in separate
one-test scopes and reset at each invocation. No diagnostic suppression or
manual `Layer.build` replacement was introduced.

Full provider audit/docgen passed (6.6 / 3.5 seconds); full config audit/docgen
passed (7.1 / 3.2 seconds). Initial direct pure-stub provides were rejected by
the checker; the successful proofs apply to the harness-owned replacement.
The Bun architecture operation-plan suite passed all 17 tests, including
byte-for-byte accepted-template replay and second-apply idempotence.

Assertions, property parameters, flake policy and instrumentation have not
yet been migrated in this checkpoint.

## Assertions, property and flake proof

Provider assertion commit `edeb403a1e` replaces seven Some assertions and ten
None assertions with native helpers, retaining every payload and polarity.
Full provider audit/docgen passed (8.7 / 3.3 seconds). Config has no applicable
Option/Result/Exit assertion migration.

Both property surfaces already use native registration. The config's former
runSync/checkEffect/Passed-tag findings were fixed upstream in `b1aa7e320c`
(#1200); all four domains now have separate equality assertions. Preserve the
six provider domains at `fcRuns(50)` and four config domains at `fcRuns(25)`.
Both focused suites passed with `BEEP_FC_NUM_RUNS=400`, seed `20260708`, and CI
enabled: three provider service tests and three config tests.

Source flake review found no sleep, retry, external probe or timeout repair
needed. Single-test captures reset at invocation; path expectations use the
actual host home path. No 30-day hosted flake-clearance claim is made.

## Instrumented runner proof

All four test files now import the accepted `@beep/test-runner`. The two
manifests declare it, four generated project-reference lists include it, and
four generated Fallow entries preserve package boundaries. Cache maintenance
adds only 18 reviewed runner edges; it does not promote cache qualification.

The exact diagnostics logger now applies only to the provider call through
logger/minimum-level references. An initial trace run demonstrated that a
harness-wide logger captured runner lifecycle events; the corrected fixture
keeps those events observable outside the exact production diagnostic capture.
The full snapshot suite passes with CI and tracing enabled: 13 tests, no skips.
Its one-record expectation and redaction assertions remain intact.

Final full audit/docgen passes: provider 7.2 / 2.7 seconds; config 6.6 / 2.8
seconds. Architecture operation-plan replay passes all 17 tests with the new
dependency. A read-only persistence-stage Ticket plan for research-lab carries
both the runner devDependency and its test import. These proofs cover accepted
replay and fresh generated slices; they do not establish dependency augmentation
for an existing target manifest, which the generator deliberately preserves.

Final Node/Bun reports and source/load/pressure receipts are in the `cli-config`
final timing subdirectories. No performance improvement is claimed from these
shared-workstation samples.

- ai-provider-cli node: 18 passed, 0 skipped; 3.368 seconds
- ai-provider-cli bun: 18 passed, 0 skipped; 1.346 seconds
- architecture-lab-config node: 3 passed, 0 skipped; 4.046 seconds
- architecture-lab-config bun: 3 passed, 0 skipped; 1.321 seconds

Ledger, ratchet reconciliation and hosted gates remain before publication.
