# #1875 Effect Vitest canon wave 12: record

Branch `claude/youthful-burnell-9c23fd` off `main` `2e17c92111`. Scope: the EV004 exceptions
whose exit is a detector repair, "retire when EV004 recognises assertions that run after a
shorter scope closes" (#1855 wave 8 register), plus any other EV004 row the same repair covers.

## Frontier at the base

The live scan at `2e17c92111` holds 553 rows, all exceptions, and **0 open**. #2300 (wave 11)
and #2308 (the `roadmap-refs` seam) retired the last open migration rows. The canon goal still
cannot close: D4 requires an empty baseline at close, so the remaining work is the 553 owned
exceptions. Most name a detector repair as their exit; the rest name a `src/` seam.

| Exit family (base) | Rows |
| --- | ---: |
| EV004 recognises assertions after a shorter scope closes | 72 |
| EV002 recognises a layer that reads values the test body creates | 47 |
| Other EV002 detector repairs (shorter `Layer.build`, `Effect.exit`, freshness, ConfigProvider) | 38 |
| EV006, EV005, EV009 and EV010 detector repairs | about 70 |
| `src/` seams (injected Clock, ConfigProvider, cwd, spawner, MemoryFileSystem) | the rest |

## Detector repair

`assertsAfterScopeClose` in `EffectVitestDetectors.ts` accepts a non-whole-body `Effect.scoped`
(call form or pipe stage) when a later statement of the same test or helper runs an assertion
after the scoped effect completes. That is the canonical way to observe a release. The walk
from the scope up to the test or helper callback gives up, and the row stays a judgment, when:

- the path crosses a closure that is not an executed call argument (a closure bound to a
  variable may run later or never);
- the path crosses a nested function declaration;
- the path crosses a fork (`forkChild`, `forkScoped`, `forkDetach`), whose scope can outlive
  the later statements;
- the scoped operand is `Effect.succeed(...)` or `Effect.sync(...)`, which acquires nothing. The
  operand is claimed only when `Effect.scoped` is the first pipe stage, because a later stage
  closes the earlier stages' output;
- no `yield*` runs the scoped effect at the statement (`const work = Effect.scoped(acquire)`
  builds it without running it). A `return` passes the effect to the enclosing call, and the walk
  checks that call next.

An assertion counts only when it runs directly in the later statement, not inside a nested
closure. An assertion inside the scope, or before it, does not count. Observations are the
`expect` and Boolean forms plus the `@effect/vitest/utils` and vitest `assert` value assertions
(`deepStrictEqual`, `strictEqual`, `assertSome`, `assertSuccess`, `assertFailure`, and so on).

### Review round 1 (greptile on #2424)

- The rule accepted a scope that was built but never yielded before the assertion. It is fixed
  with the executed-statement requirement and the `built` and `bare` counterexamples. That
  returned one of the 68 rows to review: `setup-effect-ref.test.ts:85`, whose scope runs inside
  an effect stored in a variable and yielded later. Its original exception and reason are
  restored unchanged.
- The pure-operand check read the pipe input even when `Effect.scoped` was a later stage. That
  made it conservative (a row stayed flagged), and it is now precise (`staged` and `pure stage`
  cases).
- Value assertions from `@effect/vitest/utils` and `assert` were not counted as observations.
  That was also conservative, and they now count (`utils` and `assert` cases).
- Fallow's complexity and duplication findings on the new code were fixed by splitting the walk
  into `leavesExecution`, `statementVerdict`, `atStatement` and `scopeObservedFrom`, and by sharing
  `observedShorterScope` and `appliedScopeRuns` between the two call sites.

Counterexamples added to `test/effect-vitest-detectors.test.ts`:

- accepted: call form, pipe stage, a scope inside an `if` block, a scope inside an executed
  `Effect.flatMap` callback, a scope in a same-file helper;
- kept as judgment: assertion only before the scope, assertion only inside a later closure,
  a deferred closure, a forked scope, a pure operand, an assertion only inside the scope.

The existing "retains shorter or uncertain scope ownership" cases (no later assertion) still
report a judgment.

## Inventory, paired by `(ruleId, file, occurrence)` against the base

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 553 | 553 | 0 |
| After | 486 | 486 | 0 |

| Change | Count |
| --- | ---: |
| Gone | 67, all EV004 (68 at first push; review round 1 restored `setup-effect-ref.test.ts:85`) |
| New | 0 |
| Status changed | 0 |
| Reason changed | 0 |
| Line-only drift already on `main` | 3 (`ci-lane`, `package-scripts.policy`, `lint-workers`) |

Of the 68 first retired, 55 carried the cohort exit. The other 13 described the same shape in their own
words: cleanup-before-assertion scopes (4), assertions that read state finalizers wrote (2), a
shorter property-case lifetime (1), and the six `cache-command` TURBO_* environment scopes that
restore the environment before the following assertions. 17 rows of the 72-row cohort survive
because their assertions run inside the scope, after a fork, or in the caller of a helper. They
keep their reasons and exits.

| File | Package | Gone |
| --- | --- | ---: |
| `packages/agents/client/test/run-turn-reconciliation.test.ts` | agents-client | 1 |
| `packages/agents/client/test/selected-thread-lifetime.test.ts` | agents-client | 1 |
| `packages/drivers/cosmos/test/CosmosProjection.test.ts` | cosmos | 3 |
| `packages/drivers/duckdb/test/DuckDb.service.test.ts` | duckdb | 1 |
| `packages/epistemic/server/test/RetentionAuthority.pglite.test.ts` | epistemic-server | 1 |
| `packages/epistemic/server/test/integration/ContradictionTriage.pg.test.ts` | epistemic-server | 4 |
| `packages/drivers/obs/test/ObsProtocol.test.ts` | obs | 2 |
| `packages/drivers/openclaw/test/integration/OpenclawTimeout.acceptance.test.ts` | openclaw | 1 |
| `packages/drivers/pglite/test/integration/PgliteClient.persistent.test.ts` | pglite | 3 |
| `apps/professional-desktop/test/integration/PgliteDataDirCompatibility.test.ts` | professional-desktop | 2 |
| `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts` | professional-desktop | 4 |
| `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts` | professional-desktop | 4 |
| `apps/professional-desktop/test/tauri-ipc-socket.test.ts` | professional-desktop | 1 |
| `packages/tooling/library/qa-capture/test/Collector.test.ts` | qa-capture | 4 |
| `packages/tooling/tool/cli/test/*` (17 files) | repo-cli | 28 |
| `packages/tooling/tool/docgen/test/Core.test.ts` | repo-docgen | 1 |
| `packages/tooling/test-kit/test-utils/test/SqlTest*.test.ts` (3 files) | test-utils | 7 |

No test file changed; only the detector, its tests and the generated inventory.

## Held: the EV002 "test-body values" cohort (47 rows)

A rule that accepts any provided layer reading a test-body binding contradicts the existing
fixture "permits repeated lifecycles ... and keeps single provisions": a single provision of
`Store.makeLayer({ dataDir })` over a body-allocated `dataDir` must stay flagged, because an
`it.layer` can allocate its own directory. The cohort needs a narrower discriminator, such as
the body writing into the value before the provision, or the layer reading a fake client or
fixture object built in the body. It is the next wave's design question.

## Verification

| Check | Result |
| --- | --- |
| `test/effect-vitest-detectors.test.ts`, Bun (`bunx --bun vitest run`) | 259 passed |
| same, Node 24 (`bunx vitest run`) | 259 passed |
| `bun run beep lint effect-vitest --write` | 553 → 486 rows after review round 1, 0 introduced; plain rescan after merging main `introduced=0 resolved=0` |
| `quality fallow audit --base origin/main` | pass, 0 introduced |
| repo-cli `bun run check` (after `turbo run build --filter=@beep/repo-cli^...`) | exit 0 |
| Biome on the two touched source files | clean |

Two earlier runs were SIGTERM'd by the workstation earlyoom while other sessions held about
105 GB. That was environment-only; the reruns above passed. The full repo-cli coverage ratchet
and package-verify were left to hosted CI under the operator's push-first rule.
