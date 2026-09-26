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
