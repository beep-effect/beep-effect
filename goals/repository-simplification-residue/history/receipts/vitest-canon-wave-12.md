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

## Detector repair (final rule)

`observedShorterScope` in `EffectVitestDetectors.ts` accepts a non-whole-body `Effect.scoped`
(call form or pipe stage) only when both passes hold. That is the canonical way to observe a
release.

- **`scopeRuns`**: every step from the scope up to the test or helper callback runs it. Each
  enclosing body statement must `yield*` the scoped effect; `const work = Effect.scoped(acquire)`
  only builds it. The one exception is the test callback's own `return`, which hands the effect
  to the harness. The walk ends, and the row stays a judgment, at:
  - a conditional (`if`, `switch`, loops, `try`, `?:`, `&&`, `||`, `??`);
  - a fork, in method or free-function `pipe` form (`forkChild`, `forkScoped`, `forkDetach`),
    whose scope can outlive the later statements;
  - a nested function declaration;
  - any callback other than an `Effect.gen` generator, which runs in place. This includes
    `Effect.flatMap` and `acquireUseRelease` callbacks and uninvoked `Effect.fnUntraced` values.
- **`observedAfterScope`**: a later statement asserts unconditionally. Nothing inside `if`/`else`,
  `switch`, loops, `try`/`catch`, conditional expressions, short-circuits, nested blocks, or
  function, method, accessor or class bodies counts. An observation is an applied `expect`
  matcher (`expect(x).toBe(y)`, including `.not` and `.resolves` chains; a bare `expect(x)`
  checks nothing), a Boolean assertion, or an `@effect/vitest/utils` or vitest `assert` value
  assertion (`deepStrictEqual`, `strictEqual`, `assertSome`, `assertSuccess`, `assertFailure`,
  and so on).

The scoped operand counts as pure, and the row stays a judgment, when it is `Effect.succeed(...)`
or `Effect.sync(...)`. It is claimed only when `Effect.scoped` is the first pipe stage, because a
later stage closes the earlier stages' output.

The rule reached this form over four greptile review rounds, recorded below. Each round only
narrowed it.

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

Counterexamples in `test/effect-vitest-detectors.test.ts` (final set):

- accepted: call form, pipe stage, a scope in a same-file helper, an executed later stage, a
  `deepStrictEqual` or `assert.strictEqual` observation, a negated matcher, the test callback's
  own `return`, and an in-place `Effect.gen` generator;
- kept as judgment: an assertion only before or inside the scope; an assertion inside a later
  closure, method, accessor or class; a deferred or uninvoked closure; a forked scope in either
  pipe form; a pure operand or pure first stage; a built-but-unyielded scope, in call and pipe
  form; a scope inside an `if` or a non-`Effect.gen` callback; a later assertion inside `if`,
  `if (false)`, `else`, `switch`, `for`, `for of`, `while`, `do`, `try`, `?:`, `&&`, `??` or a
  nested block; a bare `expect(x)`; and an unapplied matcher.

The existing "retains shorter or uncertain scope ownership" cases (no later assertion) still
report a judgment.

## Inventory, paired by `(ruleId, file, occurrence)` against the merge base `4f9e3ef756`

| | Rows | Exceptions | Open |
| --- | ---: | ---: | ---: |
| Before | 555 | 555 | 0 |
| After | 493 | 493 | 0 |

| Change | Count |
| --- | ---: |
| Gone | 62, all EV004 (68 at first push; review rounds 1 and 3 restored 6 rows) |
| New | 0 |
| Status changed | 0 |
| Reason changed | 0 |
| Line-only shifts | 2 (`SqlTest.offline.test.ts:178/193`, one line stale on `main`'s committed inventory; the file is unchanged here) |

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

### Review rounds 2 and 3 (greptile on #2424): the whole class closed

Round 2 found that assertions inside uninvoked methods counted, and that a free-function
`pipe(x, Effect.forkChild)` escaped the fork guard. Round 3 found that assertions inside an `if`
counted. Rather than patch each construct, the rule now has two passes:

- **`scopeRuns`**: every step from the scope up to the test or helper callback must run it. Each
  enclosing body statement yields the scoped effect, except the test callback's own `return`,
  which hands the effect to the harness. No step may be a conditional (`if`, `switch`, loops,
  `try`, `?:`, `&&`, `||`, `??`), a fork in either pipe form, or a nested declaration. The only
  function bodies crossed are `Effect.gen` generators, which run in place. Any other callback,
  including `Effect.flatMap` and `acquireUseRelease` callbacks and uninvoked `Effect.fnUntraced`
  values, ends the walk.
- **`observedAfterScope`**: a later statement must assert unconditionally. Nothing inside
  `if`/`else`, `switch`, loops, `try`/`catch`, conditional expressions, short-circuits, nested
  blocks, or function, method, accessor or class bodies counts.

The counterexamples cover one case per construct (16 judgment cases, plus `root return` and
`in-place generator` as accepted shapes).

The stricter rule returned 5 more of the first-retired rows, each restored with its original
exception and reason: `CosmosProjection.test.ts:190/194/237` (scopes inside `try`/`finally`),
`AgentMessage.runtime.test.ts:771` and `worktree-command.test.ts:2270`. The wave now retires
**62** EV004 exceptions with none added. A plain rescan after merging main reports
`introduced=0 resolved=0`, and Fallow passes after `isForkStage` was shared with `forkCall`.

### Review round 4 (greptile and CodeRabbit on #2424)

- A bare `expect(x)` counted as an observation. Only an applied matcher on an `expect(...)`
  receiver counts now (`isExpectMatcher`). The `bare expect` and `unapplied matcher` cases stay
  judgments, and `negated matcher` is accepted. A fresh `--write` scan after merging main
  `4f9e3ef756` (with #2432) adds 0 rows against the branch, so all 62 retirements hold.
- This receipt's rule and inventory sections were rewritten to the final state (CodeRabbit).
