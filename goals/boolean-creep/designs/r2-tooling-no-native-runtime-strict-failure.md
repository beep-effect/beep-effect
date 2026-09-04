# Instance

- id: `r2-tooling-no-native-runtime-strict-failure`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/NoNativeRuntime.ts:106`
- symbol: `NoNativeRuntimeRulesOptions` / `NoNativeRuntimeRulesSummary`
- members: `strictCheck`, `strictFailure`
- evidence class: E4 at `NoNativeRuntime.ts:694-704` — strict failure is derived only from strict mode plus a warning or error count.

# Current shape

`NoNativeRuntimeRulesOptions` stores boundary intent as `strictCheck`; the returned schema-backed summary stores `strictFailure`. The Laws command reads that result to select the process exit, and focused tests assert it directly.

# Cardinality gap

Four bit combinations encode three legal scan outcomes: advisory, strict-clean, and strict-failure. A strict failure without strict mode is never produced.

# Target schema

Reuse `LawScanDisposition` from `internal/LawScan.ts`; do not author a second identical literal family. Keep input `strictCheck`, replace summary `strictFailure` with `disposition`, and derive the member from `strictCheck` plus warning/error presence at the return boundary.

# Migration inventory

- `NoNativeRuntime.ts:106-121` — retain the input toggle.
- `NoNativeRuntime.ts:191-216` — replace the summary boolean schema with the shared disposition schema.
- `NoNativeRuntime.ts:694-704` — derive advisory/strict-clean/strict-failure once.
- `Laws.command.ts:589` — migrate the live NoNativeRuntime result reader to select only the strict-failure disposition and preserve its exact process-exit behavior. The EffectFn reader at lines 465-500 belongs to a different design.
- `test/native-runtime.test.ts` — replace boolean assertions and cover all three members across existing fixtures.

# Guard-deletion accounting

Delete the summary `strictFailure` field, its conjunction writer, and the command's boolean guard. The input toggle remains because it is operator intent, not redundant state.

# Encoded-side impact

None. The summary is not a supported JSON, persistence, MCP, or RPC boundary. Its exported decoded TypeScript shape migrates atomically with every in-repo consumer.

# Test impact

Retain all diagnostic, severity, allowlist, include/exclude, and count assertions. Prove warning-bearing advisory, strict-clean, and strict-failure outcomes and preserve the exact command failure text.

# Risk & sequencing

Tier 1E, in the same repo-CLI batch as the shared LawScan disposition. Import the existing domain instead of duplicating it. Run full `@beep/repo-cli` package verification.
