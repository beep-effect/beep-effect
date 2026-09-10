# Reviewed lint capture repair

The complete isolated preflight supports changing only identity's `lint`
script from `bun run beep:lint` to `biome check . > /dev/null 2>&1`.
The six direct comparisons preserve exit status. Each exact Turbo client
records five selected-task executions with safe bounded task logs; invalid
root configuration fails the types dependency before identity executes.
Detailed `beep:lint` and `beep:audit` diagnostics remain available. See the
[sanitized preflight receipt](./quiet-lint-complete.json).

The identity package passes its full audit and docgen after this repair.
Identity lint remains excluded, its cache flag remains false, and no pilot
has qualified. The repair does not supply signed replay, shadow or
activation-invariance evidence.

The current census still has 142 workspaces, 2,840 configured graph nodes and
1,503 executable nodes. Its projection has the same computation population
and global configuration as the previous baseline. The only actual command
change is identity lint; the only effective task-setting change from that
initial baseline is its already-reviewed cache disablement. The only added
Turbo source is the inheriting identity child configuration.

Eleven identity computation records change their complete-workspace-script
digest because that digest intentionally binds all scripts in the manifest.
The other ten commands, their dependencies and their effective settings are
unchanged. The policy audit consequently flags six cached, unassessed identity
computations for drift. This review attributes those shared digest changes to
the one lint repair; it grants no new assessment or cache expansion.

Refresh the baseline through the canonical writer with the exact prior
baseline digest. Preserve scope `@beep/identity#lint`, profile
`local-linux-x64-bun1.4.1`, epoch `qualification-v1`, and the revision-one
excluded ledger. The prior baseline bytes are retained privately before
replacement. Re-audit the resulting projection and require zero findings.

Rollback restores the prior script and its matching reviewed baseline while
keeping the explicit excluded state and disabled child cache. Neither a
rollback nor this configuration review counts as qualification evidence.
