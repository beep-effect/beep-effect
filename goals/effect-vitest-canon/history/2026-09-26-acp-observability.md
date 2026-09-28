# ACP observability checkpoint

The four registered files in the existing six-path inventory now use the public
@beep/test-runner it entry point. Support files and the later json.test.ts suite
remain unchanged. Forty-eight static info-level events bracket agent, client
and native protocol waits. They contain phase and completion labels only, with
no payloads, credentials or dynamic identifiers; peer stdout remains protocol data.

Full package verification passed after the final log-level correction: audit
11.2 seconds and docgen 4.0 seconds. Token comparison after removing only logs
and accounting for imports preserves all previous source tokens.

Three temporary TestConsole probes observed both the runner start and actual
phase labels under BEEP_TEST_TRACE=1. Each passed with tracing enabled and failed
with tracing disabled and CI=false. All original files were restored byte-for-byte.
The first debug-level probe had exposed filtered phase messages; only those
static events were promoted to info before the successful repeated controls.

The development dependency, lockfile, TypeScript references and Fallow boundaries
were updated through their canonical generation commands. No test domain,
assertion, native constructor, scope or deadline changed in this phase.
