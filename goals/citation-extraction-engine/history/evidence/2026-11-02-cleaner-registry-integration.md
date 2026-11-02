# Live cleaner registry, callbacks and native hashes

The private cleaner registry now joins the real value owner, primitive Python
hash service, CPython dictionary backend, builtin dispatcher and lazy executor.
Exact text uses retained native storage for both hashing and Unicode-table
comparison. Bytes use the same pinned hash service and primitive byte equality;
equal ASCII byte/string hashes do not make those keys equal. General tables
continue primitive equality after their first non-exact-key insertion. Text
subclasses and host objects use captured server hash/rich-comparison protocols,
including the adapter's normalized signed-64-bit hash and reflected/truth rules.
No fixture supplies production primitive hashes or builtin lookup outcomes.

Membership and value lookup each hash and probe the live table. A changed hash
can select another function on the second lookup; deletion during that hash can
raise the closed missing-key failure. Registry entries retain the original key
and current value handles. Query-only references are pruned after return, with
active references protected across same-fiber reentrant mutation. The scoped
owner clears retained references on closure and rejects further execution.

Captured callback protocols provide lazy cursors, callability and invocation.
Callbacks receive the real work capability; outputs retain arbitrary owned host
identities and original text reservation tickets. Callables remain services,
never request data. Named membership precedes direct callable dispatch, including
function-object keys. The adapter, registry and callback state survive successive
runs instead of being reconstructed for each step.

The registry has a captured lifetime probe ceiling and a captured minimum
clean/operation deadline per outer registry entry. Direct nested mutation shares
the current ownership guard. Deadline execution forks a fiber, so ownership is
captured inside the actual guarded acquisition; the reentrant controls cover the
deadlock found and repaired during development. Entry capacity uses the existing
private authorities projection, including five initial builtin entries. Too-small
capacity fails explicitly as authorities exhaustion; it is never raised silently.
Final public-policy/global admission integration remains open.

Only the five schema-checked builtin names have a private constant-issuance path.
Their fixed 17-unit maximum is independent of request-source and produced-output
ceilings. Arbitrary text cannot use this path. Normal source and callback output
retain their existing independent limits and ledger duties.

Validation:

- The shared source-history harness now uses live named registry lookup and
  production hashes. All 1,068 non-HTML histories, 2,784 transitions and 3,852
  native values retain exact bytes, width, lengths, source hash and reference
  relations through the reservation ledger.
- Focused checks cover changing hashes, deletion during second hashing, live
  callback replacement/step append, arbitrary intermediate host values, native
  pair/scalar keys, byte/string hash collisions, structural-handle rejection,
  lifetime work/entry limits and closure. Registered function keys and callback
  state across successive runs have a separate control.
- A five-file run passed 22 tests in 7.73 seconds before the additional retained
  callback-state control. The final seven registry controls pass in 4.19 seconds.
  Server source/test type checking, focused Oxlint and
  native-runtime checks passed. The catalog uses the canonical writer.
- The hosted 2,016-history HTML replay now uses this same registry/hash path.
  Real native replay is still pending hosted CI and was not rerun locally.

This joins captured protocols; it does not claim a complete generic Python host
object evaluator or full replay of the 1,155-case sequence corpus. The focused
controls correspond to source scenes including dispatch:switch-hash,
dispatch:delete-second-hash, live-step-append, registry-replace,
registry-function-key and state-across-runs. Complete source-event accounting,
all callback/iteration failure scenes, public Layer/global admission and full
engine parity remain unfinished. No canonical completion row or semantic waiver
is advanced by these checks.

Hosted repairs are tracked separately. Commit 720a903ba0 makes coverage run
Vitest under Bun, because worker executable selection uses process.execPath and
requires Bun flags. The scoped cache review records only the two changed citation
package manifests through the canonical writer, carries 188 other reviews and
leaves qualification unchanged. Its follow-up policy audit reports zero blockers.
Earlier hosted lint/property/Fallow findings remain subject to the current run;
this evidence does not label queued or unexecuted checks as passed.
