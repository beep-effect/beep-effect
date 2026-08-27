# Research friction receipts

## 2026-08-27: provider smoke proof stalled behind conflicting 1Password state

- Work: inject the existing `op://` references for the required live Anthropic
  extraction without reading or writing secret values.
- Evidence: the 1Password MCP authentication call returned `1Password desktop
  app is not running` while the desktop process was present. `op whoami` had no
  signed-in session. The single `op run --env-file=.env` fallback waited without
  terminal output, then returned `authorization prompt dismissed`.
- Impact: package build, tests, deterministic replay, and all local projections
  are green, but the sanitized successful provider recording cannot be created
  until the operator authorizes secret injection.
- Prevention: add an agent preflight that distinguishes desktop process state,
  MCP bridge availability, CLI sign-in, and a pending authorization prompt
  before a provider proof begins. It should report only state labels and never
  secret values.
