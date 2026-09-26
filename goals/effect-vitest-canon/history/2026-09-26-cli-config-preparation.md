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
