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
are closed. The portfolio guard package proof has passed; PR 1323 CI repair currently takes
priority over applying the draft.

## Private draft and API audit

The prepared draft converts fifteen plain callbacks and supplies fresh consoles
to all twenty-four Effect callbacks. The shared layer supplies BunCrypto and
Path; serial describe scopes protect the existing cache-verdict behavior.
Synchronous public API cases and module-level environment seeding remain.

Local Effect reference source confirms that FileSystem.layerNoop wraps
FileSystem.makeNoop in Layer.succeed. ConfigProvider.layer likewise wraps a
pure provider in Layer.succeed. Direct service injection therefore preserves
the mock construction and per-call configuration overrides without rebuilding
those layers. The subprocess path reaches runToExit and the mocked child
handle, without the capture drain timers used by native capture tests. The
admission preparation and registration path contains no sleeps; absent or
inherited workload bindings return without owned-workload registration.

The draft retains all 105 assertion trees. The comparison normalizes only
parentheses, yield expressions, and the removed Effect.runSync boundary; it
excludes no assertion. The initial comparison correctly rejected the two
runSync expressions inside assertions until that intended boundary change was
explicitly normalized. Private receipts: cli-shared-internals-proposal.json
and cli-shared-internals-draft-assertions.json. Runtime proof, resource probes,
types and inventory lineage reconciliation remain required before closure.

The draft preserves all 44 static test names and registration options. A
syntax-only detector comparison finds ten runtime, eight provider, one wrapper
and one hook-timeout finding before the draft, and no findings after it. The
shared layer now has an explicit ten-second hook timeout. This is draft
evidence only: it closes no inventory row and does not replace runtime proof.
