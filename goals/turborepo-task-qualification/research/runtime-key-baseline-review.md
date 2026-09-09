# Add the reviewed runtime identity to the pilot cache key

The installed-export counterexample reproduces stale successful local replay
on stable and canary while fresh lint fails. The selected source, task
configuration and lockfile stay unchanged. The isolated repair computes the
effective installed tree and uses the existing fingerprint function to derive
a toolchain digest before invoking Turbo. Both clients invalidate correctly
with that digest declared as a task environment input, and restoring dependency
bytes restores safe replay.

Accept one definition change: identity lint declares
`BEEP_CACHE_TOOLCHAIN_DIGEST` in its `env` list. Its cache flag remains false.
Types lint stays excluded and cache-disabled. No command, dependency edge,
other task configuration, global configuration or executable population changes.
The [complete delta](./runtime-key-baseline-delta.json) also records ordinary
input-digest changes for 11 identity and ten CLI computations caused by the
configuration and observer source edits. They do not broaden the reviewed
definition change.

The population remains 142 workspaces and 1,474 executable computations. Keep
the existing identity/types scope, `local-linux-x64-bun1.4.2` profile and
`qualification-v2` epoch. This review updates the disabled baseline; it does not
promote or activate a tuple. Preserve the qualification ledger bytes.

The durable pilot calculates the key itself, includes the actual requested
native Turbo client in that identity, and refuses a source configuration that
does not declare the variable. Its v5 receipt distinguishes the reviewed source
toolchain digest from the actual client-specific runtime key. Complete native
matrix revalidation against the v6 configuration fragments is required.

Ordinary entrypoints do not yet enforce verified runtime-key calculation.
Complete semantic input/read/write/capture coverage and accepted signed
conformance/trust evidence also remain required. Those boundaries prevent live
activation; this config review cannot substitute for their runtime proof.
