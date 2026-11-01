# #1875 Effect Vitest canon wave 20: record

Branch `claude/vitest-canon-w20` off `main` `aa39a3da99`. Scope: the "Node and Bun crypto plus
filesystem" class of the remaining EV010 rows: two rows on `corpus-provenance-index.test.ts`, one
per platform import.

## Finding

The suite chose its platform at runtime:
`process.versions.bun === undefined ? Node bundle : Bun bundle`. EV010 treats a conditional
layer as opaque (the `flag ? NodeServices.layer : Fake.layer` counterexample), so neither import
could prove its harness. Every harness already reaches the fixture's native `fs.symlink`, so the
subject is the native filesystem whichever runtime runs it.

The switch came with the suite in #1530 and no reason was recorded. `NodeServices` and
`NodeCrypto` run under Bun, as the rest of repo-cli's tests do on both runtimes. The suite now
uses `Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)` on both, and the Bun import goes.
No assertion changed.

## Inventory, paired by `(ruleId, file, occurrence)` against `aa39a3da99`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 449 | 440 | 9 |
| After | 447 | 440 | 7 |

Gone: the 2 `corpus-provenance-index` EV010 rows. New: 0. No exception added. No detector change.

## Still open (7)

| Class | Rows |
| --- | ---: |
| Concurrent independent processes (`observation-launch-claims-crash`) | 1 |
| A `Deferred`-held spawner child (`AgentMessage.observation`) | 1 |
| Spawned `git` | 3 |
| Real transcript discovery (`observation-worker`) | 1 |
| Unix-domain sockets (`vitest-bun-serve-shim`) | 1 |

## Verification

| Check | Result |
| --- | --- |
| `test/corpus-provenance-index.test.ts`, Bun and Node | 24 passed each |
| repo-cli `bun run check` | exit 0 |
| `lint policy-fingerprint` | current |
| `bun run beep lint effect-vitest --write` | 449 → 447 rows, 0 new |
| `quality fallow audit --base origin/main` | 0 introduced |
