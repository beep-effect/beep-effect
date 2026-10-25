# #1855 detector repairs wave 6: EV014 named test layers

Lane `residue-detectors` wave 6, branch `feat/residue-detectors-wave6`, on `main` `17f67293a2`
(includes #1855 waves 4 and 5, #2186 and #2227, and #1875 wave 6, #2228). Scope: the 233 EV014
`resource-layer-without-hook-timeout` rows, all exceptions, that `detectors-wave-4.md` "Closing
frontier" and `detectors-wave-5.md` "Remaining frontier" name as wave 6. EV010, the
`files-command` `withReplacedPath` exception and the seven `#1855 wave 4 register` exceptions are
untouched.

## Measurement at `17f67293a2`

`bun run beep lint effect-vitest`: 2,798 files, 960 findings, `introduced=0 resolved=0`. The
inventory holds 960 rows: 698 exceptions and 262 open. `origin/main` is `17f67293a2`, so the PR
base and the measurement base are the same commit.

Every count below comes from one census, paired by `(ruleId, file, occurrence)` against
`git show 17f67293a2:standards/effect-vitest.inventory.jsonc`.

| Rule | Exceptions before | Open before | Exceptions after | Open after |
| --- | ---: | ---: | ---: | ---: |
| EV001 | 1 | 0 | 1 | 0 |
| EV002 | 98 | 52 | 98 | 52 |
| EV003 | 23 | 0 | 23 | 0 |
| EV004 | 89 | 50 | 89 | 50 |
| EV005 | 6 | 0 | 6 | 0 |
| EV006 | 56 | 0 | 56 | 0 |
| EV007 | 2 | 0 | 2 | 0 |
| EV008 | 2 | 0 | 2 | 0 |
| EV009 | 28 | 0 | 28 | 0 |
| EV010 | 137 | 143 | 137 | 143 |
| EV012 | 6 | 0 | 6 | 0 |
| EV014 | 233 | 0 | 0 | 0 |
| EV015 | 17 | 17 | 17 | 17 |
| **Total** | **698** | **262** | **465** | **262** |

After the wave, `lint effect-vitest --write` leaves 727 rows (465 exceptions, 262 open). Paired
against the base, 233 rows are gone, none is new, and no surviving row changes status or reason.
All 233 gone rows are EV014 exceptions:

- 194 retire through the detector repair (repairs 1 and 2 below);
- 39 retire through explicit `{ timeout: "30 seconds" }` migrations (the same-file ruling below).

Check: 698 − 233 = 465 exceptions; 262 open unchanged; 960 − 233 + 0 = 727 rows. A second
`--write` is byte-identical (sha256 `455b67e2bdcd…`), and the plain scan reports
`introduced=0 resolved=0`. All seven `#1855 wave 4 register` exceptions are present. No open row
converts to an exception, and no exception reason is rewritten, because no EV014 row survives.

## The EV014 census

Each row is classified by the binding behind the first `it.layer` argument, with `Layer.fresh`
unwrapped. This is an AST pass (a scratch ts-morph script over the base inventory), not the
text heuristic `detectors-wave-4.md` used, so the class sizes move: a same-file `const`
initialized by an imported non-Layer call now counts as an imported factory.

| Class | Base rows | Retired by detector | Migrated to `{ timeout }` |
| --- | ---: | ---: | ---: |
| imported layer | 41 | 26 | 15 |
| imported factory | 41 | 39 | 2 |
| same-file factory | 64 | 60 | 4 |
| same-file composition | 72 | 54 | 18 |
| same-file `Layer.effect`/`scoped`/`unwrap` | 15 | 15 | 0 |
| **Total** | **233** | **194** | **39** |

Wave 4 counted 39 / 51 / 64 / 64 / 15 with its text heuristic. The base rows carried 28 distinct
reasons in 61 files. Most argued that a named fixture or a `Layer.succeed`-backed layer acquires
nothing, which a per-file detector could not see. The rest kept default budgets for real
acquisitions (Wink model loads, bundling).

## Repair 1: resolve imported test layers across files

EV014 asked whether the layer `it.layer` builds in its hook acquires something a hook budget
should bound. It followed only `Layer.merge`/`mergeAll` operands and same-file `const`
initializers down to `Layer.succeed`/`mock`/`empty` and the platform service bundles, so every
imported layer, every factory call and every `Layer.provide` pipe was a finding.

**Resolution** (`makeLayerAnalysis`, `moduleExport`, `resolveLayerReference`,
`resolveLayerCallee` in `EffectVitestDetectors.ts`):

- Imports resolve through `ts.resolveModuleName` with bundler resolution against the scan
  project's module resolution host. That covers package `exports`, `.ts` extension imports and
  extensionless relatives, as vitest resolves them. Only TypeScript sources outside
  `node_modules` are followed. A declaration file (an npm `dist`) has no initializer to classify,
  so a layer that reaches one acquires.
- Exports are looked up syntactically: exported `const`/`function`/`class` declarations,
  `export { local as name }`, named and namespace re-exports, then `export *` targets.
  Type-only imports and exports never resolve.
- References follow aliases (`const make = makeInMemory`), `dual(arity, implementation)`, class
  static properties and methods (including `this.member` inside the class), and namespace
  members.
- A call to a resolved function judges every return, with the parameters bound to the call's
  arguments (`bindArguments`). Missing arguments fall back to parameter defaults. Rest and spread
  parameters stay unbound, so a layer operand that reaches one acquires.
- `Effect.fn(name)(function* …)` and `Effect.fnUntraced(function* …)` factories run their
  generator with bound parameters. Extra pipeable arguments are not followed.
- The resolved declaration is classified with the same judges as a same-file layer, in its own
  file's import context. Every judge has a depth bound of 24, so re-export and alias cycles
  terminate unresolved.

The per-file caches (import contexts and resolved modules) live for one
`detectEffectVitestFindings` call. Resolved sources are added to the scan project on demand but
are never scanned themselves, because the scan iterates its own source list. The scan time is
unchanged (about 30 s for 2,802 files).

**A related defect fixed in passing.** ts-morph's `Node.isFunctionLikeDeclaration` omits function
expressions, so the wave 5 `isLayerFactory` treated a `function` expression factory as having no
own returns, and attributed a nested `Effect.gen(function* …)` return to the enclosing arrow.
`isFunctionBoundary` (both predicates) now finds a statement's own function for `isLayerFactory`,
`layerFunctionReturns` and `ownYields`. The EV003 inventory is unchanged by it. Fixture: a
`withFake = function (adapter) { return L.unwrap(…) }` factory is silent.

**Fixtures** (`test/effect-vitest-detectors.test.ts`), written first. Each failed against the
base detector (copied over the repaired file, run, and restored):

- "resolves imported test layers across files and classifies them like same-file layers"
  (`:767`). Silent: an imported `Layer.succeed` `const`, a namespace member under `L.fresh`, an
  imported factory, a class static arrow `makeLayerFromRunner` and a static method, a barrel
  `export *`, a renamed `export { ImplLive as RenamedLive } from`, `export * as Impl from`, and a
  local pipe over an imported stub. Still EV014: an imported `Layer.effect` over `Fx.promise`, a
  merge of a stub with it, a missing module, a missing export, a type-only import, a missing
  static member, and a re-export cycle.
- "binds factory parameters to call arguments when classifying test layers" (`:824`). Silent:
  `testLayer(stub(…))` returning `Layer.succeed`, `withDb(L.succeed(…))`, and a stub default
  parameter. Still EV014: `withDb` over an acquiring layer or an unresolved import, a rest
  parameter, and an acquiring default.
- "follows aliases, dual implementations, this-bound statics and local re-exports" (`:882`).
  Silent: a local `export { LocalLive as ExportedLive }`, an aliased `Effect.fn` factory through a
  barrel that also has `export type *`, a `dual` implementation, an exported `function`, a
  `this.make` static, and a `Layer.provide` array operand. Still EV014: a `declare function`, a
  destructured export, a type-only re-export, a `.d.ts` module, a `node_modules` package, a
  default import, alias and call cycles, a non-function callee, an `Effect.fn` with a computed
  name or pipeable arguments, under-applied `Layer.effect`/`unwrap`/`suspend`, an acquiring
  provide stage, an unknown stage, and a curried `merge`.
- "permits with-named layer factories that hand their Layer to it.layer" (`:487`): the function
  expression factory above.

**Rows retired: 65 imported rows** (26 imported layers, 39 imported factories), most through
repair 2's judges once resolved. Examples: `AiProviderCli.makeLayerFromRunner` (×11, a static
`Layer.succeed`), `OpenclawCli`/`OpenclawSystemd`/`OnePasswordCli.makeLayerFromRunner`,
`N3TurtleCodecLive`, `LegalPositionRelatorPolicyLive`, `ArchitectureLabConfigTest`,
`DockEngineLive` (`Layer.effect` over `Effect.succeed`), `GraphExecutorTest` and
`ResultStoreTest` (`Ref.make`), and the `WorkspaceVaultStore`/`WorkspaceSourceTextResolver` test
layers.

## Repair 2 and the same-file ruling

**Ruling.** Per shape, between (a) a reviewed judgment class the detector recognizes precisely
and (b) an explicit `{ timeout }`:

- **(a) A hermetic in-memory acquisition is not a finding.** A layer is acquisition-free when
  every leaf it composes is one of these:
  - a stub (`Layer.succeed`/`mock`/`succeedContext`/`empty`), or `Layer.sync`/`syncContext` whose
    thunk body is hermetic;
  - a platform service bundle (wave 2 FP-1);
  - a named Effect library layer that builds in memory;
  - a `Layer.effect`/`effectContext`/`effectDiscard`, `Layer.unwrap`, `Layer.suspend` or
    `Toolkit.make(…).toLayer(…)` whose effect is hermetic.

  Composition goes through `merge`/`mergeAll`/`provide`/`provideMerge`/`fresh` (array operands
  included) and data-last `provide`/`provideMerge`/`merge`/`fresh` pipe stages.

  A **hermetic** effect only does these things:
  - reads a service key: a `Context.Service`/`Tag`/`Reference` class or value, or an Effect
    module key such as `FileSystem.FileSystem`;
  - uses `Effect.context`/`service`/`serviceOption`/`scope`, or reads the clock
    (`Clock.currentTimeMillis`/`currentTimeNanos`, `DateTime.now`/`nowAsDate`);
  - lifts a value (`Effect.succeed`/`fail`/`die`/`void`), or runs a thunk (`Effect.sync`/`suspend`/
    `promise`/`try`/`tryPromise`) whose body is hermetic;
  - allocates in-memory state: `Ref.make`/`get`/`set`/`update`/`updateAndGet`/`getAndSet`/`modify`,
    `SynchronizedRef`/`SubscriptionRef`/`TxRef.make`, `Deferred.make`/`succeed`/`done`,
    `Queue`/`PubSub` constructors, `Latch.make`, `Semaphore.make` and `Cache.make`;
  - registers hermetic finalizers (`Effect.addFinalizer`, `Scope.addFinalizer`) or a hermetic
    `Effect.acquireRelease`;
  - composes hermetic effects with `map`/`as`/`asVoid`/`orDie`/`flatMap`/`andThen`/`tap`/`withSpan`;
  - runs an `Effect.gen` or `Effect.fn` generator whose own `yield*` operands are all hermetic and
    whose every other own call is hermetic by the body rule below.

  `Layer.unwrap` also needs the effect to yield an acquisition-free layer (`Effect.succeed`,
  `Effect.sync`, `Effect.map` or `Effect.gen` returns).

  The named library layers, each checked against the installed `effect` source:
  - `Path.layer` is `Layer.succeed(Path)(posixImpl)`;
  - `TestClock.layer()` is `Layer.effectContext` over an in-memory clock and scheduler;
  - `AtomRegistry.layer` and `layerOptions` are a `Layer.effect` that builds a registry and adds a
    finalizer;
  - `FetchHttpClient.layer` is `HttpClient.layerMergedContext(Effect.succeed(fetch))`;
  - `ConfigProvider.layer(ConfigProvider.fromUnknown(…))` is `Layer.succeed` of a provider value;
  - `Logger.layer([Logger.make(…)])` adds logger values;
  - `LanguageModel.make` reads optional services;
  - `Toolkit.toLayer` is `Layer.effectContext(toHandlers(build))`.
- **(b) Everything else keeps flagging, and the test takes the canon budget**
  `{ timeout: "30 seconds" }`, as #1875 wave 2 did. That covers real acquisitions: a thunk or
  generator body that calls external work (a model load, a socket), service method calls, clock
  waits, `Deferred.await`, unlisted library layers, and anything unresolved.

**Why the line sits there.** A hook budget bounds acquisition whose latency depends on the
environment: I/O, processes, sockets, model files. Constructing services from context and
allocating refs costs the same everywhere, so a budget on it guards nothing. Wave 2 FP-1 made the
same call for platform bundles.

**The body rule (review round on #2247).** Every thunk a constructor runs, every callback the
acquisition applies (`map`, `flatMap`, `suspend`, pipe stages) and every statement of a generator
is judged by the calls it makes itself; nested functions only define values. A call is hermetic
when it is:
- an `effect` module function other than the `run*` entry points, curried calls included. A data
  module (`Array`, `Option`, `Record`, `Struct`, `String`, `Match`, `Function`, ...) applies its
  function arguments at once, so those are judged too. Other modules (`Effect`, `Layer`,
  `HttpClient.make`, `ChildProcessSpawner.make`, ...) take callbacks they run later.
- a repository function whose own body is hermetic, with its parameters bound to the arguments;
- an `Effect.fn`/`Effect.fnUntraced` factory call, which only builds an effect;
- `of`/`make` on a value `effect` defines: a class with an `effect` base (`Context.Service`,
  `Schema.Class`), an `effect` export, or an `effect` constructor's result (`Toolkit.make(...)`);
- a `pipe` method or a built-in (`JSON`, `Object`, `Array`, `Math`, `Number`, `String`,
  `Boolean`, `Symbol`, `BigInt`, `Promise`, `Date`), with function arguments judged; `new` only
  of the built-in value constructors (`Map`, `Set`, `Error`, `URL`, ...).

Anything else, unresolved calls included, is acquisition. `Effect.try` follows the same rule as
`Effect.sync`: whether a thunk may throw says nothing about what it does, and the body rule
already flags the external work, because `loadWinkRuntime` and `loadBM25Vectorizer` call the
imported `wink-nlp` loaders. `@beep/utils` resolves without trusting the package: its modules
declare their own helpers and `export * from "effect/<Module>"`, and an Effect star export
resolves to that `effect` module.

**Gotcha.** A function passed by an unresolved name to an `effect` data helper
(`Arr.map(xs, f)`) is not followed.

**Fixtures**, written first; each case failed against the base detector:

- "permits hermetic in-memory acquisitions under it.layer and keeps real acquisitions judged"
  (`:849`). Silent: a `Layer.effect` generator over `FileSystem.FileSystem` and `Ref.make`,
  `Deferred.make`, a curried `Layer.effect(Store)(Fx.map(Recorder, …))`, `Layer.unwrap` over
  `Fx.map` and over `Fx.gen` with `provideMerge(Layer.sync(…))`, an `Effect.fn` factory, a
  same-file `Effect.gen` binding, a hermetic `acquireRelease`, and `Layer.suspend`. Still EV014:
  `Fx.promise`, `Fx.sleep`, an `Fx.try` model load, a service method (`fs.makeTempDirectory()`), a
  bare `yield`, `Deferred.await` in a pipe, an unwrap yielding an acquiring layer or a dynamic
  import, a nested generator's `Fx.promise` (the `isFunctionBoundary` guard), and an acquiring
  `acquireRelease`.
- "judges hermetic effect combinators by every effect they run during acquisition" (`:942`).
  Silent: finalizers, scope, clock and `DateTime` reads, an Effect module key, a
  `Context.Reference`, `Fx.flatMap` over `Ref`, a pipe through `flatMap`/`map`/`asVoid`, `Fx.as`,
  `serviceOption` with `withSpan`, and unwraps of `Fx.sync`/`Fx.succeed`/a bound effect. Still
  EV014: an acquiring continuation or stage, under-applied combinators, unknown stages
  (`timeout`, `retry`), an acquiring finalizer, look-alike keys (an imported namespace, a non-key
  class, a non-key value), a generator-less `Fx.gen`, and acquiring or empty unwraps.
- "names the Effect library layers that build in memory" (`:1104`). Silent: each named library
  layer. Still EV014: a look-alike `Path` module, `ConfigProvider.layer` over a non-literal
  provider, a non-`make` logger, `toLayer` on a non-Toolkit receiver or with an acquiring build,
  and `McpServer.McpServer.layer`.
- The existing case "judges imported and unknown layer constructors but permits proven pure
  compositions" (`:694`): `L.unwrap(Fx.succeed(L.succeed(Service, {})))` moves from flagged to
  silent under the ruling.

**Rows retired by the detector: 194** = the 65 imported rows above plus 129 same-file rows:
- 60 factories: Tika `testLayer(stub(…))` ×20, FFmpeg `makeTestLayer` ×25, docgen `makeTestLayer`
  ×10, tailscale `mockSpawnerLayer` ×5;
- 54 compositions, including `worktree-command` `testLayer` ×25, `SessionStore` ×5,
  `ClockCorrelator` ×6, `FileProcessing` ×4, the langextract `LanguageModel.make` stubs ×5 and
  `Vitest.test` `CaseProbeLayer`;
- 15 `Layer.effect`/`unwrap` recorders: `CliRecorderTest` ×10, `SystemdRecorderTest` ×3, and the
  Tika capturing and slow-response layers.

The reached source makers were audited by hand: every `yield*` they run reads a service key or
allocates a ref. Real work happens only in returned closures, such as spawns or bundles at use
time.

### Review round on #2247: thunk and generator bodies

The beep-reviewer P2 (thread `PRRT_kwDOPbO_N86v9kT1`) found that `Effect.sync` admitted any thunk
and that a generator was judged only by its `yield*` operands. So
`Layer.effect(Tag, Effect.sync(loadWinkRuntime))`, or a generator calling `loadWinkRuntime()`
without yielding it, passed as acquisition-free. The body rule above fixes both.

**Fixtures**, written first:
- "judges thunks and non-yielded generator calls by what their bodies run" (`:993`). 10 silent
  cases, including `Effect.sync(() => ({ count: 0 }))` and a generator that yields services and
  builds values. 16 flagged cases, including `Effect.sync(loadModel)` and a generator calling
  `loadModel()` without yielding it. Plus `Layer.sync`, `Layer.suspend` and `Layer.unwrap(Fx.sync(...))`
  pairs.
- "follows constructors, callables and curried calls inside acquisition bodies" (`:1056`). 9
  silent and 9 flagged cases.

A per-case script against the pushed head `3fc55fbf51` showed 19 of the 30 first-case
expectations wrong. Both reviewer shapes passed silently there. At head the suite fails both new
cases (2 of 249), and the repaired detector passes all 249.

**Returned rows.** The first strict pass returned 115 EV014 rows in 23 files. Each one was traced
to the failing call, and every one was a precision gap in the new rule, not real acquisition:
- curried `Effect.fn("name")(function* ...)` calls whose callee is a call;
- callbacks treated as run when an `effect` constructor only registers them (`HttpClient.make`,
  `ChildProcessSpawner.make`);
- `of` on an `effect` service key or a `Toolkit.make(...)` value;
- members of a named `effect` barrel export.

After those four fixes, 0 rows return: no new migration and no exception. Against `origin/main`
(now `9dadba59f3`, same inventory relationship), `--write` twice is byte-identical
(`455b67e2…`, unchanged from the pushed head). Pairing gives 233 gone, 0 new and 0 changed, so
the census below is unchanged: 233 = 194 by detector + 39 by migration.

**Mutation probes** (Bun, each reverted, `cmp` clean). Each one fails at least one case:
- R1, `Effect.sync` admitted unconditionally: 2 cases fail;
- R2, generator statements not judged: 2;
- R3, callback bodies not judged: 1;
- R4, `Effect.try` thunk not judged: 3;
- R5, `Layer.sync` a stub again: 1;
- R6, no data-module callbacks judged: 2;
- R7, curried repository results followed: 1;
- R8, `run*` admitted: 1;
- R9, `map` callables not judged: 2.

With the timeout removed from `WinkTokenization.test.ts`, the block still flags through the
`Effect.try` body rule: `1 new finding(s)`.

## Migrations: 39 rows in 16 files take `{ timeout: "30 seconds" }`

| Package | File | Rows | Why the layer stays a finding |
| --- | --- | ---: | --- |
| `@beep/wink` | `Backend/WinkBackend`, `Graph/GraphOperationsCatalog`, `NLPService`, `Graph/TextGraph`, `Layers`, `ParityTools`, `ToolValidation`, `WinkEngineRef`, `WinkTokenization` | 28 | `WinkEngineLive` loads the model through `Effect.try({ try: loadWinkRuntime })`; the corpus layer loads BM25 the same way. |
| `@beep/nlp-mcp` | `Server.test.ts` | 1 | `WinkNlpToolkitLive` over the live Wink engine. |
| `@beep/nlp-mcp` | `SanitizedSpan.test.ts` | 1 | `McpServer.McpServer.layer` (`Layer.effect(McpServer)(McpServer.make)`, which builds an RPC client; not provable). |
| `@beep/m365-mcp` | `SanitizedSpan.test.ts` | 1 | Same `McpServer` layer. |
| `@beep/gov-legal-mcp` | `Server.test.ts` | 4 | Same `McpServer` layer. |
| `@beep/qa-capture` | `Witness.service.test.ts` | 2 | `Effect.cached(bundleWitness)`: `Effect.cached` is not listed, and the memoized work is a `Bun.build`. |
| `@beep/architecture-lab-proof` | `ArchitectureLabProof.test.ts` | 1 | `ArchitectureLabServerLive` reads `Config` through the ambient `ConfigProvider`. |
| `@beep/repo-cli` | `step-capture-lifecycle.test.ts` | 1 | `MemoryFileSystem.layer` builds its volume through `makeDirectory`, which is not provable. |

The edit is mechanical: `it.layer(X)` becomes `it.layer(X, { timeout: "30 seconds" })`, and
`{ concurrent: false }` becomes `{ concurrent: false, timeout: "30 seconds" }`. Biome reformatted
the long lines. No assertion, test deadline or layer changed. The `@effect/vitest` 4.0.5
`makeLayer` (`internal.ts:240-358`) passes `timeout` to the block's `beforeEach`/`beforeAll` and
`afterAll` hooks only. Without it, the root `vitest.shared.ts` `hookTimeout` applies: 10 s, or
300 s in coverage and deep-sweep runs. So the explicit 30 s budget is tighter than the coverage
default. That suits a model load or a bundle, which take seconds.

No row becomes an exception, so no reason needs `<why>. Owner. Exit.`

## Mutation probes

Each probe was applied, run on Bun, and reverted from a byte copy (`cmp` clean afterwards).

| Probe | Result |
| --- | --- |
| `moduleSource` resolves nothing (repair 1) | 2 cases fail: cross-file, aliases/re-exports |
| `Layer.effect` never hermetic (repair 2) | 4 cases fail |
| `isFunctionBoundary` back to `isFunctionLikeDeclaration` | 3 cases fail, including the wave 5 factory case |
| parameters never bound | the binding case fails |
| library layers off | the library case fails |
| migration: drop the timeout from `WinkTokenization.test.ts:11` | `lint effect-vitest`: `1 new finding(s)`, exit 1 |
| migration: `timeout: "1 millis"` on the same block | `Hook timed out in 1ms` on Bun, so the budget is live |
| review round R1-R9 (body rules) | see "Review round on #2247" |

## Remaining frontier

- **EV014: closed.** 0 rows.
- **Waves 7-9, the owner/exit register.** 465 exceptions, 434 without an owner and exit: EV010
  137, EV002 94, EV004 86, EV006 56, EV009 28, EV015 16, EV005 6, EV012 6, EV007 2, EV008 2 and
  EV001 1. EV003's 23 rows, the seven wave 4 rows and one EV015 row already carry theirs.
  - Wave 7 is EV010.
  - Wave 8 is EV002, EV004 and EV006.
  - Wave 9 is the rest: EV009, EV015, EV005, EV012, EV007, EV008 and EV001.
- **Open rows: 262.** EV010 143, EV002 52, EV004 50 and EV015 17. These are #1875 migrations; the
  19 EV002 hand-offs from #1875 wave 6 are among them.
- **Closeout:** a fresh zero actionable scan once #1875 has migrated its cohorts, then flip
  #1855 to `complete`.

## Verification

All on `17f67293a2` with the change applied. Each heavy command ran alone through `beep-heavy`
with `</dev/null`. Dependency dists were rebuilt first: `bunx turbo run build` with
`--filter=<pkg>^...` for `@beep/repo-cli` (65/65 tasks), then for wink, nlp-mcp, m365-mcp,
gov-legal-mcp, qa-capture and architecture-lab-proof (46/46). The results are in the lane report;
this receipt records the commands.

- Typed checks:
  - `bun run check` exits 0 in all seven touched packages;
  - repo-cli `bunx tsc-rs -p test/tsconfig.json --noEmit` exits 0;
  - the other six check their tests through `beep:check:tests` (`tsconfig.test.json`).
- Suites:
  - effect-vitest-detectors (249 tests, 9 of them new or changed), -contract, -primitives and
    -store, lint-command and step-capture-lifecycle: 388 of 388 on Bun and on Node;
  - the 15 migrated files in the other six packages: 89 of 89 on Bun and 87 of 89 on Node. The
    Node failures are the two `Witness.service.test.ts` tests, which call `Bun.build`. They fail
    identically on Node with the base file, so they are environment-only and inherited.
- Coverage ratchet: a scoped lcov of `EffectVitestDetectors.ts` over its 11 referencing suites
  on Node gives 99.59 % lines, 97.93 % statements, 95.94 % branches and 98.59 % functions.
  Every metric is at or above its floor (99.24 / 97.89 / 95.6 / 98.2), and no floor changed. The
  other packages changed only test files.
- `lint effect-vitest` `introduced=0`; `lint:schema-first` `introduced=0` on every ratchet.
- `quality fallow audit --base origin/main --check` passes with 0 findings. The first run found
  6 complexity and 3 duplication findings in the new judges; the judges were rewritten as rule
  tables (`makeLayerJudge`), with byte-identical inventory output.
- Biome on the 18 changed TypeScript files, root `lint:oxlint`, and
  `oxlint . --config .oxlintrc.docs.json --max-warnings=0`: clean.
- `jsdoc:inventory:check` passes; `jsdoc:ratchet:check` reports `increased=0`.
- `laws native-runtime --check`: errors=0, warnings=0; `effect-imports`, `effect-fn` and
  `allowlist-check` pass. `terse-effect --check` exits 1 on 42 inherited blocking files, none of
  them in this lane.
- `lint:retired-effect-paths` findings=0. `goals:doctor`, docgen and `package-verify`: see the
  lane report.

The scan now reports 2,802 files instead of 2,798. The `turbo build` wrote four ignored
`dist/test/*.test-kit.d.ts` files that the existing `**/test/**/*.ts` scope matches. They
produce no findings and are not committed.

Route: S39/S41 Claude chain, `claude-opus-5-5` Agent child (step 1), no fallback and no
cross-provider lane.

## Reversal

Revert the PR. The 233 EV014 rows come back from the base inventory with their exception status
and their 28 reasons; no surviving row changed. Per part:

- **Repair 1:** make `moduleSource` return none. The 65 imported rows return.
- **Repair 2:** reduce the `LAYER_FREE_RULES` call rules to the stub, library and composer
  entries, and drop the effect, unwrap, suspend and toolkit entries. The 129 same-file rows
  return.
- **Migrations:** remove the 39 `timeout: "30 seconds"` options.
- **Body rules (review round):** restore `sync` to `EFFECT_CONSTANTS` and `STUB_LAYER_MEMBERS`,
  drop `isHermeticSyncBody` from `isHermeticGenerator` and `callbackReturns`, and drop the `sync`,
  `promise`, `try`/`tryPromise` and `suspend` rules. No row moves, because no row came back.

Each part needs `lint effect-vitest --write` and the reasons restored from
`git show 17f67293a2:standards/effect-vitest.inventory.jsonc`. The `isFunctionBoundary` fix
reverts with repair 1; on its own it moves no row.
