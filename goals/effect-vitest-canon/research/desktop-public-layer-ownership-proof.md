# Public layer ownership for Tauri and explicit hook budgets

TauriIpcSocketLive is now installed through the instrumented public it.layer
API. Its layer builds a stateless Socket descriptor; each reader and writer
Effect allocates its own queue/listeners or decoder/buffer when acquired.
Tests continue acquiring those resources inside their own Effect scopes.
Five whole-body scopes were removed, while the deliberate reader child-scope
close-before-join and failed-reader acquisition scope remain intact.

The named socket suite remains serial to protect its hoisted IPC mocks. Its
explicit layer-hook timeout follows the existing shared policy: ten seconds
normally, five minutes for coverage or deep property sweeps. The theme-storage
and filesystem suites now state those same existing hook budgets explicitly.
No test deadlines were enlarged.

A temporary pair of tests acquired the same suite Socket in two test scopes,
left a partial frame in the first writer, and required the second writer's frame
to contain only its own data. Both passed alongside the seven original socket
cases. The temporary cases were removed. Original reader cleanup assertions
still verify listener release and wakeup of suspended pulls.

An AST comparison preserved all fourteen original test titles and all 62
recorded assertion call expressions across the three files. This count includes
nested expect calls; it is preservation evidence rather than a coverage metric.

Final verification passed all fourteen original Node cases, full Desktop audit
and docgen, schema-first checks, and strict baseline/census/ledger decoding. The
ratchet reported zero introduced findings and seven fewer current findings.
The package audit first caught an import-order issue, which was corrected with
Biome before the successful full retry. No baseline rows were rewritten or
closed by this batch; Desktop-wide reconciliation remains pending.
