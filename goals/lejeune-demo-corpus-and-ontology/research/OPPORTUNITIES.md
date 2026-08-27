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

## 2026-08-27: bundle output roots were relative to the package command

- Work: build two ignored offline publications and compare all five JSON contracts byte for byte.
- Evidence: both builds succeeded, but the first comparison returned
  `cmp: .beep/lejeune-demo-publication-v5/bundle/bundle.json: No such file or directory`.
  `bun run --cwd apps/labs/lejeune-bolt-workbench bundle:build` resolved the relative output roots
  from the lab directory, while the comparison ran from the repository root.
- Impact: no publication data was lost. The path mismatch caused one false comparison failure and
  required a targeted ignored-file inventory before the real comparison could run.
- Prevention: print the resolved publication root in the successful builder log, or document that
  `LEJEUNE_BUNDLE_ROOT` and `LEJEUNE_MUTABLE_ROOT` are relative to the package command's working
  directory.
