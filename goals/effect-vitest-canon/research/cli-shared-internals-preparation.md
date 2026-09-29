# Shared internals runtime preparation

The existing CLI inventory has nineteen open runtime/provider/wrapper findings
for shared-internals.test.ts: ten EV001, eight EV002, and one EV003. Current
source inspection also finds two runSyncExit calls outside those ten runtime
rows. Both failure-channel cases belong in the migration even though the old
syntax detector did not emit separate rows for them.

The unchanged baseline passes all 44 tests on Node and Bun. Whole-command
observations are 3.520 and 1.566 seconds, respectively, overlapping the portfolio
guard full package proof. Source hashes are stable and isolated temporary
residue is empty; these timings do not establish a causal performance claim.

The line renderer helper has two callers. The synchronous overridesFor helper
has seven callers. Ten uses of the local scoped-provider helper include
ConfigProvider overrides and a filesystem/path stub composition. Migrate
those Effects through public scopes while preserving per-call provider changes,
the exact failure assertions, mock subprocess contracts and original test
options. Retain the existing synchronous API tests: their module-level Bun.env
fixtures deliberately precede the first default ConfigProvider snapshot.

The suite also clears a process-global cache-session verdict map. Preparation
must audit ordering, clock requirements and stub finalizers before choosing the
fixture scope. Fresh-console controls must cover existing Effect tests as well
as newly converted callbacks. No source draft is applied and no inventory rows
are closed. The portfolio guard package proof remains the source-edit gate.
