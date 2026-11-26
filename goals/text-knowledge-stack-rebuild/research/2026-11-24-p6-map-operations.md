# P6 map: operations, the Combiner/Reducer census and the activity model (L5)

Measured at commit f8cbd3c9f69.

Read-only measurement at f8cbd3c9f69. No source was edited. Paths are repo-relative; `nlp/` abbreviates `packages/foundation/modeling/nlp/` and `np/` abbreviates `packages/foundation/capability/nlp-processing/`. Effect APIs were checked against the v4 reference checkout (`effect` 4.1.5 in both `node_modules/effect/package.json:4` and `.repos/effect/packages/effect/package.json:4`). Census rows quoted from `research/consumer-census.md:140-180` were measured at f9982f3b5e6; every count here is re-measured on this head, and where they differ this map wins. Two counterexamples below were checked by a throwaway script outside the repo that copies the combine bodies verbatim; they are stated so the P6 law tests can reproduce them.

This map covers L5 only: `nlp/Operations`, `nlp/Algebra`, the operation models inside `np/`, the census the PLAN row requires, `withActivity`, the L5-1 to L5-3 laws, the activity time model and the instrumentation shard. The MCP write tools, the office-action flow and the matter wall are other P6 maps; section 4 names where `np/Tools` touches L7.

## 1. `@beep/nlp/Operations`: every export

Three files, 794 lines (`Composable.ts` 635, `Definition.ts` 112, `index.ts` 47). The barrel exports `Composable` as a namespace (`nlp/src/Operations/index.ts:32`) and `Definition` as a type-only namespace (`:47`). The root barrel `nlp/src/index.ts:23-117` does not re-export Operations.

| Export | Evidence | What it is | Consumers outside `nlp/` |
| --- | --- | --- | --- |
| `OperationDefinition<A, B, R, E>` | `nlp/src/Operations/Definition.ts:51-58` | interface: `name: string`, `inputSchema`, `outputSchema`, `implementation`, optional `description` and `metadata: Record<string, unknown>` | 0 |
| `OperationInput<D>`, `OperationOutput<D>` | `Definition.ts:84-85`, `:111-112` | type-level extractors | 0 |
| `NLPOperation<A, B, R, E>` | `nlp/src/Operations/Composable.ts:55` | `(input: A) => Effect<B, E, R>` | 0 |
| `OperationBuilder<A, B, R, E>` | `Composable.ts:81-226` | class holding `operation`, `inputSchema`, `outputSchema`, `name: string`; methods `run` (`:111`), `map` (`:133`), `flatMap` (`:157`, names the result `` `${name}.flatMap` ``), `product` (`:185`), `zipWith` (`:211`) | 0 |
| `makeOperation` | `Composable.ts:282-302` | `dual(4, ...)` constructor | 0 |
| `fromDefinition` | `Composable.ts:327-328` | builder from a definition | 0 |
| `makePureOperation` | `Composable.ts:355-370` | `flow(f, Effect.succeed)`; the L5-2 `Pure` shape | 0 |
| `map`, `product`, `zipWith` | `Composable.ts:396`, `:438`, `:481` | dual wrappers; `product` runs `Effect.all([...], { concurrency: 1 })` (`:238`), so it is sequential, left first | 0 |
| `compose` | `Composable.ts:528-545` | `first.flatMap(second)`; error and requirement channels are unioned (`R1 \| R2`, `E1 \| E2`), not fixed | 0 |
| `identity` | `Composable.ts:560-561` | `makePureOperation("identity", schema, schema, a => a)` | 0 |
| `traverse` | `Composable.ts:582-585` | `Effect.forEach(..., { concurrency: 1 })` | 0 |
| `Aggregated<M>`, `aggregate` | `Composable.ts:609`, `:628-635` | fold through the local `Monoid` (`A.reduce(values, monoid.empty, ...)`) | 0 |

Consumers: `rg "@beep/nlp/(Operations|Algebra)"` outside `nlp/` and `goals/` finds only generated path maps (`tsconfig.json:801-808`, `:1349-1355`, `vitest.aliases.generated.json:708-713`, `:1216-1220`), the schema catalog and the coverage baseline. The only importer is `nlp/test/Operations/Composable.test.ts:10-11`. Census row "Operations 0 / 0" (`consumer-census.md:165`) still holds.

What the tests prove today (`nlp/test/Operations/Composable.test.ts:183-275`): functor identity and composition, left and right identity and associativity, and traverse order, each comparing only the success value of pure arrows (`len`, `inc`, `dbl`) with `toBe`. No test generates an effectful or failing operation, observes a failure, or observes effect order. Those are exactly what L5-1 and L5-2 add.

## 2. `@beep/nlp/Algebra`: every export, lawfulness and upstream coverage

Three files, 1,792 lines (`Monoid.ts` 882, `NLPMonoid.ts` 873, `index.ts` 37). Consumers outside `nlp/`: 0 (same search as section 1). Neither file imports `effect/Combiner` or `effect/Reducer`; no file in the repo outside `.repos/` does (`rg 'from "effect/(Combiner|Reducer)"'`: 0), and no file uses `Number.ReducerSum`-style instances (`rg '(Number|String|Boolean)\.Reducer\w+|makeReducer'` over `packages` and `apps`: 0).

The local `Monoid<A>` (`nlp/src/Algebra/Monoid.ts:43-57`) has a curried `combine` and an `empty`. Upstream `Combiner<A>` is `{ combine(self, that) }` (`.repos/effect/packages/effect/src/Combiner.ts:43-52`) and `Reducer<A>` adds `initialValue` and `combineAll` (`Reducer.ts:56-75`, `make` at `:120-135`).

"Lawful" below means the monoid laws hold over the carrier the type admits. "Lawful on a restricted domain" means they hold only on the domain the existing test generates.

### 2.1 `Monoid.ts`

| Export | Evidence | Lawful? | Upstream equivalent in 4.1.5 | Disposition |
| --- | --- | --- | --- | --- |
| `Monoid<A>` | `:43` | n/a | `Reducer.Reducer<A>` (`Reducer.ts:56`) | retire; upstream covers |
| `make` | `:86-89` | n/a | `Reducer.make` (`Reducer.ts:120`) | retire |
| `fold`, `combineAll` | `:113-121`, `:140-143` | n/a | `Reducer.combineAll` field | retire |
| `StringConcat` | `:171-174` | yes | `String.ReducerConcat` (`String.ts:1603`) | retire, covered |
| `StringJoin(sep)` | `:197-204` | yes (empty strings are skipped, so `""` is a two-sided identity) | none exact: `Combiner.intercalate` (`Combiner.ts:310-313`) inserts the separator around an empty operand | retire; no consumer |
| `StringDelimited` | `:223-243` | **no**: identity fails (`combine("", "a") = "[a]"`), associativity fails (with `[`, `]`, `,` on `["", "", "a"]`: left `"[a]"`, right `"[[a]]"`, 33 of 64 triples over a 4-string alphabet), and an empty suffix makes `slice(p, -0)` drop all content (`combine("a", "b") = ","`) | none | **delete**: unlawful, untested (`nlp/test/Algebra/Monoid.test.ts` never names it), no consumer |
| `NumberSum`, `NumberProduct` | `:262-265`, `:284-287` | lawful on integers only; IEEE addition is not associative (`(0.1+0.2)+0.3 !== 0.1+(0.2+0.3)`) | `Number.ReducerSum`, `ReducerMultiply` (`Number.ts:805`, `:829`), same caveat | retire, covered; the tests generate `S.Int` only (`Monoid.test.ts:45-50`) |
| `NumberMax`, `NumberMin` | `:306-309`, `:328-331` | lawful on non-NaN numbers (`Math.max(-Infinity, NaN)` is `NaN`) | `Number.ReducerMax`, `ReducerMin` (`Number.ts:861`, `:886`) | retire, covered |
| `ArrayConcat<A>()` | `:354-357` | yes | `Array.makeReducerConcat` (`Array.ts:5127`) | retire, covered |
| `MultiSet<K>()` | `:387-394` | yes (immutable `HashMap`, integer counts) | none (no `HashMap` reducer in `HashMap.ts`) | retire; no consumer |
| `SetUnion<A>()` | `:417-420` | yes | none (no `HashSet` reducer in `HashSet.ts`; `HashSet.union` exists at `HashSet.ts:363`) | **the one instance P6 needs**: the activity log of `withActivity` is a `HashSet<Activity>` combined by union (section 6). Re-express as `Reducer.make(HashSet.union, HashSet.empty())` beside `Operation`, kept by its own decision per `consumer-census.md:167` |
| `SetIntersection<A>()` | `:451-460` | yes (`None` is the top element) | none | retire; no consumer |
| `VectorAdd(d)` | `:486-489` | lawful only at length `d`: `combine(empty3, [1, 2]) = [1, 2, 0]` breaks left identity; mismatched lengths truncate to the left operand | none | retire; tested only at length 3 (`Monoid.test.ts:116-130`) |
| `VectorAverage(d)`, `getAverage` | `:512-520`, `:539-542` | same length caveat | none | retire |
| `Product`, `Product3` | `:569-580`, `:601-612` | yes when components are | `Tuple.makeReducer` (`Tuple.ts:736`) | retire, covered |
| `Option(m)` | `:635-645` | yes | `Option.makeReducer` (`Option.ts:2473`) | retire, covered |
| `Endo<A>()` | `:670-673` | yes | none named; `Reducer.make` over composition | retire |
| `Dual(m)` | `:696-699` | yes | `Reducer.flip` (`Reducer.ts:173`) | retire, covered |
| `BooleanAll`, `BooleanAny` | `:722-725`, `:744-747` | yes | `Boolean.ReducerAnd`, `ReducerOr` (`Boolean.ts:458`, `:479`) | retire, covered |
| `checkLeftIdentity`, `checkRightIdentity`, `checkAssociativity`, `checkLaws` | `:781`, `:805`, `:829`, `:859-882` | n/a (test helpers in `src`, default equality `===`) | none; the repo pattern is `it.prop` | retire; the law tests own this |

### 2.2 `NLPMonoid.ts`

The map-valued carriers are `MutableHashMap<string, number>` with a declared codec (`nlp/src/Algebra/NLPMonoid.ts:51-67`). `combineNumericMaps` copies the left operand before adding (`:76-85`), so `combine` does not mutate its inputs, but each `empty` is one shared mutable instance (`:181`, `:386`, `:559`, `:612`, `:638`). A caller that mutates a result of `combine(empty, x)` is safe, and one that mutates `empty` changes the identity for every later call.

| Export | Evidence | Lawful? | Disposition |
| --- | --- | --- | --- |
| `BagOfWords` (schema and type) | `:106`, `:126` | n/a | retire with the package; schema-catalog row `standards/schema-catalog/@beep/nlp.generated.jsonc:7` |
| `TokenConcat` | `:154` | yes (`StringJoin(" ")`) | retire |
| `TokenBagOfWords`, `TermFrequency`, `DocumentFrequency` | `:180-183`, `:535`, `:558-561` | yes on integer counts; the schema admits any `S.Finite` (`:49`), so non-integer counts break associativity | retire |
| `TokenSetUnion`, `Vocabulary` | `:207`, `:584` | yes | retire (`SetUnion` re-expressed, section 2.1) |
| `SentenceConcat` | `:238-246` | **associative and lawful**, though the suite asserts identity only and calls it a near-monoid (`nlp/test/Algebra/NLPMonoid.test.ts:5-10`, `:110-125`). Every nonempty `x•y` ends with `y`, so both bracketings give `N(x) + " " + N(y) + " " + z`; 216 of 216 triples over a 6-string alphabet agree. This is the "skips the associativity test on a monoid that is associative" half of report D7 (`research/2026-11-08-rebuild-report.md:76`); `StringDelimited` above is the half that "ships one that is not" | retire; no consumer |
| `SentenceArray`, `NamedEntityList`, `DependencyParse` | `:269`, `:453`, `:508` | yes (`ArrayConcat`) | retire |
| `DocumentText` | `:293` | yes (`StringJoin("\n\n")`) | retire |
| `DocumentStatistics`, `DocumentStats` | `:316`, `:348-356` | yes on the non-negative integer counts the schema declares | retire; schema-catalog row `:9` |
| `AnnotationMap<K, V>()` | `:385-397` | yes (left-biased union) | retire |
| `NamedEntity`, `DependencyEdge` | `:420`, `:476` | n/a (schemas) | retire; schema-catalog rows `:8`, `:10` |
| `WeightedTokens`, `NGramFrequency` | `:611-614`, `:637-640` | lawful only on integers; weights are floats by intent, so associativity fails | retire |
| `TextAnalysis`, `TextAnalysisMonoid` | `:670`, `:719-731` | yes when components are | retire; schema-catalog row `:11` |
| `bagOfWordsToTF`, `computeTFIDF` | `:756-768`, `:795-808` | n/a (functions); `computeTFIDF` defaults a missing document frequency to 1 | retire; no consumer |
| `aggregateTokens`, `aggregateSentences`, `aggregateStats` | `:830-831`, `:850`, `:872-873` | n/a | retire |

## 3. The Combiner/Reducer census across nlp, nlp-processing and their consumers

Scope searched: `nlp/src`, `np/src`, and every package that imports either: `packages/drivers/wink`, `packages/drivers/nlp-mcp`, `packages/foundation/capability/langextract`, `apps/labs/semantica`, `packages/law-practice/*` and `scratchpad/effect-ontology`. Search: `effect/(Combiner|Reducer)`, `Monoid`, `Semigroup`, `combine:`, `combineAll`, `Reducer*.`/`Combiner*.` and every `A.reduce` fold in `np/src` and `wink/src`.

| Value | Evidence | Lawful? | Live use | Verdict |
| --- | --- | --- | --- | --- |
| 25 `Monoid.ts` values and 4 law helpers | section 2.1 | 21 lawful, `StringDelimited` unlawful, numeric and vector instances lawful only on restricted domains | 0 consumers | retire: 14 covered upstream, the rest uncovered and unused; `SetUnion` survives in a new form |
| 26 `NLPMonoid.ts` exports | section 2.2 | lawful except float-weighted maps | 0 consumers | retire |
| `ExecutionMetrics.empty` / `.combine` | `np/src/Graph/GraphOperations/Types.ts:160-187` | yes (sums of `S.Natural` and `Duration.sum`) | `empty()` at `np/src/Graph/GraphOperations/Executor.ts:311`, `:443`; `combine` only in `np/test/Graph/GraphOperations.test.ts:56-77` (laws tested) | dead `combine` in `src`; the executor never accumulates metrics. Moves or dies with the graph executor (O7) |
| `TypeClass.Composable`, `identityOperation`, `composeOperations` | `np/src/Graph/TypeClass.ts:150-173`, `:173-182`, `:203-226` | **no**: `identityOperation` mints a fresh node id and sets `parentId` (`:174-181`), so `compose(identity, f)` differs from `f` in every node id | `np/test/Graph/TypeClass.test.ts` only | delete with `TypeClass.ts` |
| `foldableGraph` | `np/src/Graph/TypeClass.ts:269-` | n/a | test only | delete |
| `GraphOps` folds ("Monoid Homomorphisms") | `nlp/src/Graph/GraphOps.ts:416-431` | n/a (folds take an initial value and a step) | 0 consumers (`consumer-census.md:159`) | retire in P6 per census |
| `PatternBuilders.combine` | `nlp/src/Core/PatternBuilders.ts:638-645` | not a monoid (each call takes an `id`) | moves with Core | out of census scope; moves with Core |
| ad-hoc sum folds | `np/src/Graph/GraphOperations/Executor.ts:330`, `ResultStore.ts:327`, `TypeClass.ts:560`, `packages/drivers/wink/src/WinkUtils.service.ts:139`, `WinkTools.service.ts:434` | yes (integer sums) | live | no change required; `Number.ReducerSum.combineAll` is the upstream spelling if touched |
| `Order.combineAll` | `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:70`, `packages/law-practice/domain/src/values/ClaimElement/Antecedent.policy.ts:224` | upstream | live | not an nlp value; unaffected |

Verdict: nothing in `nlp/Algebra` has a consumer, so P6 retires the module wholesale (census rule 2, `consumer-census.md:166-167`) and no law row is owed for any instance. The one instance P6 code needs is union over `HashSet<Activity>`. Upstream 4.1.5 has no `HashSet` reducer, so it is kept as a local `Reducer` value by decision; it is not moved from `SetUnion`. The report's "algebra laws for each instance that survives the census" (`research/2026-11-08-rebuild-report.md:288`) reduce to that one value; its laws (identity, associativity, commutativity, idempotence) are cheap `it.prop` rows inside the L5-3 file, or a row of their own if the law plan wants one (O3).

## 4. `@beep/nlp-processing` today

63 source and test files, 15,065 lines with manifests. Runtime dependencies: `@beep/identity`, `@beep/nlp`, `@beep/observability`, `@beep/schema`, `@beep/utils`, `effect` (`np/package.json`, `dependencies`). There is no `@beep/jsonc` edge, which the activity record needs (section 6). Exports: `.`, `Backend`, `Core`, `Graph`, `Graph/GraphOperations`, `NLPService`, `Tools` and their `*` subpaths (`np/package.json`, `exports`).

| Module | Lines | Facet | External consumers (files) |
| --- | --- | --- | --- |
| `Backend/NLPBackend.ts`, `Backend/Composition.ts` | 549, 422 | engine port; `withFallback` (`:131`), `CachingOptions` (`:225`), `withCaching` (`:295`), `selectByCapability` (`:408`) | wink 2, semantica 1 |
| `Core/Tokenization.ts` | 233 | `Tokenization` service | wink 4, law-practice use-cases 2, scratchpad 1 |
| `Graph/EffectGraph.ts` | 797 | local graph carrier (duplicated by `nlp/src/Graph/GraphOps.ts`, census `:159`) | wink 1 (test) |
| `Graph/TextGraph.ts`, `Graph/AnnotatedTextGraph.ts` | 895, 906 | linguistic graphs over `@beep/nlp` Core and Graph `Schema` | wink 2 (tests) |
| `Graph/TypeClass.ts` | 1,031 | **operation model 3**: `TextOperation` (`:62-65`), its own `makeOperation` (`:83`), `pureOperation`, `Functor`, `Foldable`, `map`/`flatMap`/`ap`/`alt`/`traverse`/`replicate`/`when`/`unless` | 0 (only `np/test/Graph/TypeClass.test.ts`) |
| `Graph/GraphOperations/Operation.ts` | 356 | **operation model 4**: `GraphOperation` (`:61-68`), Kleisli in `node -> Effect<ReadonlyArray<node>>` with `category`, `estimateCost`, `validate` | through `Catalog` and `Executor` |
| `Graph/GraphOperations/{Catalog,Executor,ResultStore,Types,Errors}.ts` | 360, 563, 402, 854, 287 | seven backend-backed graph operations, a `GraphExecutor` `Context.Service` (`Executor.ts:138`), a result store | wink 1 (`test/Graph/GraphOperationsCatalog.test.ts`) |
| `NLPService.ts` | 399 | product-neutral workflows | semantica 4, wink 1 |
| `Tools/*` (30 files, `index.ts` 1,038, `_schemas.ts` 802, `ToolExport.ts` 432, `NlpToolkit.ts` 145) | | AI tool schemas and `NlpToolkit`; the existing L7 surface on this package (all read tools; `CreateCorpus`, `DeleteCorpus`, `LearnCorpus`, `LearnCustomEntities` mutate an in-memory corpus, not claims or annotations) | nlp-mcp 4, wink 5 |
| `internal/observability.ts` | 274 | span and metric helpers | internal |

`np/` imports `@beep/nlp` in 14 files today (census `:178`: 14 / 12 / 2 / 163). Of the subpaths, `@beep/nlp/Core` is imported by 9 `np` files and `@beep/nlp/Graph` by 6.

Four operation models exist where the census counted three (`consumer-census.md:165`, "three overlapping operation models"): nlp `OperationBuilder`/`NLPOperation` (with the type-only `OperationDefinition`), np `TextOperation`, np `GraphOperation`, and the sketch's `Operation`. The chapter wants "its own duplicated operation modules merge into one" (`standards/architecture/16-knowledge-stack.md:384-388`). `TextOperation` has no consumer and goes. `GraphOperation` is the only live one (Catalog and Executor), and it is not an `A -> Effect<B>` arrow: it is a node-to-node-list arrow with cost and validation metadata. It either becomes `Operation<GraphNode<A>, ReadonlyArray<GraphNode<B>>, E, R>` plus a metadata record, or stays a graph-executor-specific type that is not called an operation (O6).

The chapter says L5 also absorbs `nlp/Core` (`16-knowledge-stack.md:386-387`), and decision `2026-11-22-p3-graph-span-becomes-an-optional-position` moves Graph `Schema` with it. Live consumers of those two subpaths outside `nlp/` and `np/`: Core in wink (8 files), law-practice use-cases (1 test, `ClaimInspection.lexical.test.ts:13`, which also uses `CharPosition`) and scratchpad (1, `effect-ontology/Service/Nlp.ts:15-16`); Graph `Schema` in semantica (3: `src/layers/ExtractorLive.ts:60`, `test/Extractor.test.ts:42`, `test/Extractor.signals.test.ts:9`) and wink (2). `IdentifierText`, `PathText`, `QueryText` and `VariantText` have 0 consumers and retire in P7 per census `:169`. `CharPosition` retires to the text position (census `:168`) and still has 3 live sites (`packages/drivers/wink/src/WinkTokenization.service.ts:11`, `:165`, `:174`, the law-practice test, and the `np/src/Graph/TextGraph.ts:352-361` JSDoc example).

## 5. What "Operation" and "Kleisli laws under a declared observation" mean here

### 5.1 The arrow

`Operation<A, B, E, R> = { name: TermIri, run: A -> Effect<B, E, R> }` (`goals/text-knowledge-stack-rebuild/ops/design/L5.operations.ts:27-30`). `compose` fixes one `(E, R)` for both sides (`:66-75`), which the live `Composable.compose` does not (`Composable.ts:528-545` unions them). Fixing the channels is what makes the hom-sets a category: with unioned channels, `id ∘ f` has a different type from `f`. `pure` is `flow(f, Effect.succeed)` (`:57-63`), the same body as `makePureOperation` (`Composable.ts:368`).

`name` is a `TermIri` (`@beep/identity/Term`, `packages/foundation/modeling/identity/src/Term.ts:49-60`). The registry's `operation:` namespace declares one term, `Extract` (`packages/foundation/modeling/identity/src/internal/generated/Registry.data.ts:362-367`). Every new named operation is therefore a registry term, and adding one moves the term snapshot release (decision `2026-11-19-p1-since-is-a-snapshot-vocabulary-release`). `compose` takes the composite's name as an argument, so a composite also needs a term, or a composite name derived without one (O4).

### 5.2 The declared observation

The report defines it (`research/2026-11-08-rebuild-report.md:288`): an observation is the `Exit` of the run plus a `Ref` trace, and defects, tracing and interruption are excluded in the test preamble. In Effect 4.1.5 terms:

- `Effect.exit` (`.repos/effect/packages/effect/src/Effect.ts:2504`) turns the run into `Exit<B, E>`. Equality is `Equal.equals`, which is structural for plain objects and arrays (`Equal.ts:2-4`, `:117-132`).
- The trace is a `Ref<ReadonlyArray<Event>>` (`Ref.ts`) that each generated operation appends to before it succeeds or fails, so a reordering is visible.
- The observation of an operation `f` at input `a` is the pair `(Exit, trace)` from running `f.run(a)` against a fresh `Ref`.
- Excluded: defects (`Exit` failures whose cause is a die), interruption, spans and tracing, and the `name` field. The name has to be excluded, because `compose(pure(id), f, n)` carries `n` and not `f.name`.

Under that observation:

- **L5-1** (`research/law-test-plan.md:33`): for generated operations `f, g, h` over a fixed `(E, R)`, `compose(pure(identity), f) ≈ f ≈ compose(f, pure(identity))` and `compose(compose(f, g), h) ≈ compose(f, compose(g, h))`. The generator is a finite family of operations, each "append event `k` to the trace, then succeed with `t(a)` or fail with `e`", drawn by `Arbitrary` over a small schema of operation descriptors. That is the failing-and-effectful coverage today's suite lacks (section 1). The live `flow(self.run, Effect.flatMap(that.run))` satisfies these by the Effect monad laws, so the test is a regression guard ("an effectful composition reorders", report `:367`).
- **L5-2** (`law-test-plan.md:34`): `Pure` commutes with every operation. The statement needs a binary combinator, which the sketch does not define. The report names sequential `product` "with a `commutes` witness required to claim interchange" (`:286`). The live `product` (`Composable.ts:238`) runs left then right. The law: for `p = pure(f)` and any generated `q`, `product(p, q)` and `swap ∘ product(q, p)` give one observation. The acceptance half: `Effect.sync(() => { throw })` is a die, and a die is outside the observation, so the counterexample has to be observable within it. One reading: a `sync` that appends to the trace (an effect `pure` cannot perform) and then returns. It does not commute with a generated trace-writing `q`, because the two traces differ. The throwing variant shows that the die is not a `Pure`: under the exclusion it cannot be compared at all, so it cannot be admitted as central (O2).
- **L5-3** (`law-test-plan.md:35`): section 6.

### 5.3 `withActivity` as a Writer

`withActivity(ids)(op): Operation<A, Logged<B>, E, R>` (`L5.operations.ts:97-119`) returns `{ value, activities: HashSet<Activity> }`. It is the Writer transformer over the Kleisli arrow, with log monoid `(HashSet<Activity>, union, ∅)`. That monoid is the surviving `SetUnion` (section 3). The sketch defines the wrapper but not the composition of two wrapped operations. `compose(withActivity(f), withActivity(g))` does not type-check: `g` takes `B`, and `f` now yields `Logged<B>`. The Writer bind it needs is "run `g` on `value`, union the logs". Without it, "composition records fine-grained activities; a composite is a derived view" (report `:286`) has no code, and L5-3's "every output attributed" can only be stated for single operations, where it is trivial (O1).

`HasIds<A, B>` (`:84-89`) reads `used` from the input and `generated` from the output as `ContentHash` iterables. Every id the stack mints is a `ContentHash` sub-brand: `CaptureId` (`packages/foundation/modeling/text/src/Capture.ts:46`), `AnnotationId` and `RunEntityId` (`packages/foundation/modeling/annotation/src/AnnotationId.ts:47`, `:90`), `ClaimId` (`packages/foundation/modeling/epistemics/src/ClaimCore.schema.ts:36`), `ActivityId` (`packages/foundation/modeling/schema/src/ContentHash.ts:139`). So `HasIds` can be written for every L2 to L4 output without casts.

## 6. The prov time model L5-3 needs

### 6.1 What exists

- **L0 (P1)**: `ActivityStartFields` = `operation: IRI`, `pin: ActivityPin` (`Engine {engine, edition}` or `Model {model, version}`), `promptDigest: Option<Sha256PrefixedDigest>`, `used: CanonicalHashSet(ContentHash)`, `started: DateTimeUtcFromMillis` (`packages/foundation/modeling/jsonc/src/ActivityStart.ts`, `ActivityPin` and `ActivityStartFields`). `ActivityPreimage` is `activity/v1` over `(operation, pin, promptDigest, used, started)` with a golden. `mintActivityId` is an `Effect.fn("ActivityStart.mintActivityId")` requiring `Digest.Digest`, and `mintActivityIdResult(digest)` is the pure variant. `operation` is typed `IRI`, not `TermIri`; the brand narrows into it, so the sketch's assignment type-checks.
- **P3 (annotation)**: `Generation { run: RunEntityId, content: AnnotationId, activity: ActivityId, at: Option<DateTimeUtcFromMillis> }` (`packages/foundation/modeling/annotation/src/Generation.ts:51-64`). `at` is the stated time, canonical per `(content, activity)` and absent when none was stated (decision `2026-11-22-p3-generation-time-is-the-stated-time`). The run entity is `mintRunEntityId(content, activity)` (`:97-103`). The langextract handoff mints its activity at start: `started` is read before the prompt (`packages/foundation/capability/langextract/src/Service/Service.layer.ts:77-84`), and `startExtraction` builds `ActivityStart` with `operation:Extract` and `ExtractionActivity { id, start }` (`packages/foundation/capability/langextract/src/Handoff/Handoff.behavior.ts:69-88`, `Handoff.model.ts`, `class ExtractionActivity`). Every generation of the run gets `at = Some(t)` from one clock read after alignment, "so generated never precedes started (the L5-3 order holds for the handoff)" (decision `2026-11-22-p3-handoff-activity`). The handoff records no `ended`.
- **P4 (claims)**: `ClaimCore.generatedBy: ActivityId` (`ClaimCore.schema.ts:163`; stance records `:229-230`). `GenerationFact { activity, at }` is the trusted generation fact that admission reads through the `generation` port (`packages/foundation/modeling/epistemics/src/Admission.ts:166-171`, `:286`). The party slice stores the native receipt `ClaimGeneration { claim, activity: ActivityStart, ended }` (`packages/party/domain/src/entities/Claim/Claim.model.ts:310`) and `ClaimCreation { activity: ActivityStart, generatedAt, knowledgeStart, ... }` (`:205-212`). Its ledger refuses `started > ended` as `generation-order`, re-mints the id from the stored start and refuses a mismatch with `generatedBy` (`packages/party/server/src/values/Ledger/Ledger.memory.ts:89-94`).
- **P5 (interchange)**: the OA import activity is `import-activity/v2` over the canonical dataset digest; `importedAt` stays outside the id (decision `2026-11-23-p5-oa-import-activity-digests-the-canonical-dataset`).

### 6.2 What the sketch's `Activity` adds, and what is missing

The sketch `Activity` is `ActivityStartFields` plus `generated: CanonicalHashSet(ContentHash)` and `ended`, with an `ActivityOrderCheck` (`started <= ended`) (`L5.operations.ts:36-54`). It matches the party `ClaimGeneration` shape (start facts plus `ended`) and is the general form of what langextract records without `ended`. Gaps:

1. **No `id` field and no minting.** `withActivity` never calls `mintActivityId`. Decision `2026-11-19-p0-activity-id-minted-at-start` and the chapter (`16-knowledge-stack.md:399-403`) require the id to be minted at start. Minting adds `Digest.Digest` to the wrapped operation's requirements. That conflicts with "`E` and `R` fixed per pipeline" unless the pipeline's `R` already includes `Digest`, or `withActivity` takes a `JsoncDigest` and uses `mintActivityIdResult` (O5).
2. **The time law is per activity only.** The PROV order L5-3 states, "`generated` never earlier than `used`", has two readings. Within one activity, usage is at `started` and generation at `ended`. The sketch makes that true by construction: it clamps `ended = DateTime.max(started, clock)` (`:106-107`; `DateTime.max` at `.repos/effect/packages/effect/src/DateTime.ts:1347`). Across a composite, an entity generated by `a1` at `a1.ended` and used by `a2` at `a2.started` needs `a1.ended <= a2.started`. Nothing enforces that: `DateTime.now` is `Clock.currentTimeMillis` (`.repos/effect/packages/effect/src/internal/dateTime.ts:364`), `Clock` is a `Context.Reference` (`Clock.ts:195`), and a clock that steps backwards between the two runs breaks the cross-activity order. The law has teeth only in the cross-activity reading. That reading needs the Writer bind (O1) to clamp `a2.started` to at least the latest `ended` among its used entities' generating activities, or the law has to be restated as per-activity only. A test can supply a stepping `Clock` with `Effect.provideService(Clock.Clock, ...)`. Under `@effect/vitest`'s default `TestClock` (`testing/TestClock.ts:571`, `adjust` `:647`, `setTime` `:685`), time does not advance unless the test moves it, so `started == ended` everywhere and the law passes vacuously.
3. **Generation time is implicit.** The sketch gives every generated entity the time `ended`. P3's `Generation.at` is optional and per `(content, activity)`, and P4's `GenerationFact.at` is required. A `withActivity`-produced annotation would project `Generation.at = Some(ended)` and a claim `GenerationFact.at = ended`, consistent with the party ledger (`appendClaim(..., { activity, at: generation.ended })`, `Ledger.memory.ts:100`). The handoff's `at` is a clock read after alignment, not an `ended`. Converging on one rule ("generation time is the activity's `ended`") touches the P3 handoff decision (O8).
4. **`wasAssociatedWith`.** The report records `wasAssociatedWith` as the pin plus prompt digest (`:286`). The sketch carries `pin` and `promptDigest` from `HasIds` (`:87-88`) rather than reading them from the environment the way the handoff reads `Model.ProviderName` and `Model.ModelName`. Both satisfy the start-time preimage. Choosing between them decides whether a model-backed `Operation` needs the Effect AI model services in `R` (O9).
5. **"Every output attributed".** For one wrapped run, `generated(value)` is by definition the attribution set. The falsifiable statement is on composites: every id in the final output's `generated` appears in the `generated` of some activity in the log, and the log's union over activities covers every intermediate id. That again needs the Writer bind (O1).
6. **Where the record schema lives.** `Activity` is plain data with no capability. By the routing rule (pure schemas in `foundation/modeling`, SPEC Target Surfaces and `standards/ARCHITECTURE.md`), it sits beside `ActivityStart` in `@beep/jsonc` or in another modeling package, and `np/` holds only the arrow and the wrapper. The sketch puts both in `np/` (`L5.operations.ts:5-7`) (O10).

## 7. Instrumentation

- **Shard today**: `standards/instrumentation-catalog/@beep/nlp-processing.generated.jsonc` (60 lines) lists 50 spans, 39 conforming and 11 not (`applyOne`, `cacheResult`, `executeOperation`, `executeOperations`, `fromDocument`, `fromDocumentAnnotated`, `makeNode`, `runStrategy`, `singleton`, `tokenizeNodes`, `withCaching`), with `attributes: []` and `instruments: []`. `@beep/nlp.generated.jsonc` (11 lines) lists one non-conforming span, `mapNodesEffect` (`nlp/src/Graph/GraphOps.ts`). A scoped check, `bun run beep observability catalog --check packages/foundation/capability/nlp-processing packages/foundation/modeling/nlp` at this head, printed `shards=2 drifted=0`, `spans=51 conforming=39 non-conforming=12` and `non-literal span names=2 (reported, not failing)`. Both non-literal sites are `Effect.withSpan(name, ...)` in `np/src/internal/observability.ts:123`, `:161`.
- **Where the non-conforming names live**: `executeOperation` and `executeOperations` at `np/src/Graph/TypeClass.ts:314`, `:361`, which leave with `TypeClass.ts`. `applyOne`, `cacheResult` and `runStrategy` at `Executor.ts:217`, `:301`, `:356`. `makeNode` and `singleton` at `EffectGraph.ts:282`, `:341`. `fromDocument` and `tokenizeNodes` at `TextGraph.ts:223`, `:404`. `fromDocumentAnnotated` at `AnnotatedTextGraph.ts:408`. `withCaching` at `Backend/Composition.ts:295`. The catalog keeps pre-domain names as `conforms: false` with no mass rename (`packages/tooling/tool/cli/src/commands/Observability/Observability.render.ts:425`). Renaming them is optional unless P6 rewrites those functions anyway.
- **How the harvester reads names**: syntax-only, from the first argument of `Effect.fn`, `Effect.fnUntraced` and `Effect.withSpan` (`Observability.harvest.ts:1-13`; `SpanCallee`, `Observability.schemas.ts:125`). Literals and same-file top-level `const` strings are recorded. Template literals with substitutions are `interpolated` and fail `--check`. Any other expression is `non-literal` and is reported without failing (`Observability.service.ts:322-342`).
- **What this means for `withActivity`**: the sketch's `Effect.fnUntraced` (`L5.operations.ts:101`) emits no span. SPEC Constraints require every package that gains spans to name them `Concept(.Sub)*.action` and regenerate its shard; every `Operation` run emits a `prov:Activity`; span attributes carry ids, digests and counts, never text (SPEC `:304-308`). A per-operation span name would be `operation.name`, which is non-literal (allowed, but invisible to the catalog) or interpolated (fails). The catalog-visible option is one literal span for every run, for example `Effect.fn("Operation.run")`, with the operation term IRI, activity id and `used`/`generated` counts as attributes (O11). The package label is also wrong today: `packageAttributes = { package: "@beep/nlp" }` (`np/src/internal/observability.ts:16`, census `:182`), and the metric names are `nlp_*_total` counters (`:19-29`). Chapter 12 wants `beep.<area>.<noun>` names with a UCUM unit and no `_total` suffix, declared in a `*.instruments.ts` file (`standards/architecture/12-observability.md:43-44`); `np/` declares none (8 declaration files repo-wide, none in nlp packages). Neither the label nor the metric names fail `--check` today.
- **Regenerating**: `bun run beep observability catalog --write` (optionally scoped to the touched paths). The `np` shard changes when `TypeClass.ts` leaves (−2 spans), when `Operation.run` (or equivalent) arrives (+1), when the Core and Graph `Schema` moves bring spans (Core has none by `rg`; `GraphOps.ts`'s `mapNodesEffect` retires with the duplicate), and when the `nlp` shard is deleted or emptied. Only P7 retires the nlp package, so P6 leaves an `@beep/nlp` shard with whatever spans remain. If `GraphOps.ts` retires in P6, that shard is empty and still checked.

## 8. The L5 sketch against the live tree

| Surface | Sketch | Live tree | Decision and gap |
| --- | --- | --- | --- |
| `Operation<A, B, E, R>` | `name: TermIri`, `run` (`L5.operations.ts:27-30`) | `OperationBuilder` with schemas and `name: string` (`Composable.ts:81-104`); `TextOperation` (`TypeClass.ts:62-65`); `GraphOperation` (`Operation.ts:61-68`) | adopt the sketch; drop the input and output schemas from the arrow (the MCP map decides whether tool schemas attach elsewhere). `TextOperation` deleted; `GraphOperation` O6 |
| `pure` | `flow(f, Effect.succeed)` (`:57-63`) | `makePureOperation` identical body (`Composable.ts:368`); `TypeClass.pure` (`:758`) | adopt |
| `compose` | dual, fixed `(E, R)`, explicit composite name (`:66-75`) | unions channels (`Composable.ts:528-545`); `TypeClass.composeOperations` names `` `${a} -> ${b}` `` (`:208-211`) | adopt; composite naming O4 |
| identity | none (expressed as `pure(identity)`) | `Composable.identity(schema)` (`:560`), unlawful `TypeClass.identityOperation` (`:173-182`) | no separate export needed; L5-1 uses `pure` |
| `product`, `traverse` | absent | `Composable.product` sequential (`:438`, `:238`), `traverse` sequential (`:582-585`) | design needed: L5-2 has no statement without `product` (O2) |
| aggregation | absent | `Composable.aggregate` over the local `Monoid` (`:628-635`) | delete; callers use `Reducer.combineAll` |
| `Activity` | start fields + `generated` + `ended`, order check (`:36-54`) | `ActivityStart` (L0), party `ClaimGeneration` (start + `ended`), `ExtractionActivity { id, start }` | adopt with an `id: ActivityId` field (O5); home O10 |
| `Logged<B>` | `{ value, activities: HashSet<Activity> }` (`:78-81`) | none | adopt as an `S.Opaque` or a plain type; `HashSet` of opaque structs uses structural `Equal` |
| log monoid | implicit `HashSet.make(activity)` | `SetUnion` (`Monoid.ts:417-420`), no upstream | `Reducer.make(HashSet.union, HashSet.empty())`, kept by decision |
| Writer bind (compose of wrapped ops) | absent | none | design needed (O1); L5-3 composite law and attribution depend on it |
| `HasIds<A, B>` | `used`, `generated`, `pin`, `promptDigest` (`:84-89`) | none; langextract reads the pin from `Model.*` services | adopt; source of pin O9 |
| `withActivity` | `Effect.fnUntraced`, no id, clamps `ended` (`:97-119`) | the langextract handoff does this by hand (`Handoff.behavior.ts:69-88`) | adopt with id minting, a literal span and cross-activity clamping (O1, O5, O11); migrate the handoff onto it or record why not (O12) |
| imports | `@beep/jsonc/ActivityStart`, `@beep/schema/CanonicalHashSet`, `@beep/schema/ContentHash`, `@beep/identity/Term` (`:12-22`) | `np/` has no `@beep/jsonc` dependency (`np/package.json`) | add the edge; the chapter allows `np -> L0` (`16-knowledge-stack.md:462-463`) |
| typecheck | `bunx tsrs -p goals/tsconfig.ops.json --noEmit` printed no diagnostic at this head | n/a | the sketch compiles against live `ActivityStartFields` |

## 9. Inventories and gates touched

- **S31 coverage baseline**: rows for `nlp/src/Operations/Composable.ts` (`standards/coverage.regression-baseline.jsonc:29102`, 97.43% lines), `Definition.ts` (`:29114`), `Operations/index.ts` (`:29126`), `nlp/src/Algebra/Monoid.ts` (`:28898`, 62.06% lines), `NLPMonoid.ts` (`:28910`), `Algebra/index.ts` (`:28922`), `np/src/Graph/TypeClass.ts` (`:29516`, 77.64%), `np/src/Graph/GraphOperations/Operation.ts` (`:29456`), `np/src/internal/observability.ts` (`:29924`). Deleted files leave the baseline. A file moved by `git mv` carries its row by rename (decision `2026-11-19-p1-s31-rows-move-with-the-file`). New `src` files need 100% coverage (decision `2026-11-22-p2-coverage-rows-at-full-coverage-are-registration`), and that includes the new `Operation` module and whatever `withActivity` lives in.
- **Generated catalogs**: `standards/schema-catalog/@beep/nlp.generated.jsonc` (52 lines naming nlp paths; rows `:7-11` are `NLPMonoid.ts` schemas) and both instrumentation shards. `tsconfig.json` and `vitest.aliases.generated.json` path maps for `@beep/nlp/Algebra` and `@beep/nlp/Operations` drop when the subpaths leave the manifest's `exports` (`nlp/package.json`, `./Algebra`, `./Operations`).
- **Registry**: every new `operation:` term (section 5.1) moves the term snapshot release.
- **Docs**: `standards/architecture/16-knowledge-stack.md:59`, `:61`, `:384-388` ("Pending P6") and `:780-783` (the kept claims ledger). `nlp/README.md:14` ("`@beep/nlp/Operations` exposes pure composable operation models"). `np/README.md:7-17`. `nlp/THEORY.md:70`, `:172` cite `src/Graph/TypeClass.ts`, which is in `np/` (census `:171`).
- **Package verify**: `bun run beep quality package-verify @beep/nlp-processing` and `@beep/nlp` at handoff (repo law).

## 10. Law rows and their test paths

| Row | Kind | Test file (planned, absent today) | Live surface it tests |
| --- | --- | --- | --- |
| `L5-1` | law | `np/test/Operation.kleisli.laws.test.ts` | none generic; nlp `Composable` laws compare success values of pure arrows only |
| `L5-2` | law + acceptance | `np/test/Operation.pure.laws.test.ts` | none; needs `product` |
| `L5-3` | law | `np/test/Operation.activity.laws.test.ts` | none; the party ledger's `generation-order` refusal and the handoff's single-run order are the nearest live checks |

`np/` already has `@effect/vitest`, `@beep/test-utils` and `@beep/test-runner` as dev dependencies (`np/package.json`, `devDependencies`), which is enough for `it.prop` and `it.effect.prop` with `fcRuns`. The deleted nlp suites (`nlp/test/Operations/Composable.test.ts`, `nlp/test/Algebra/*.test.ts`) have no law-plan row, so they retire with their modules and are not ported. Only the Kleisli cases reappear inside L5-1, in effectful form.

## Open questions

O1. Does P6 define the Writer bind for wrapped operations (`composeLogged`, or `compose` lifted over `Logged`) so that a composite pipeline carries the union of fine-grained activities? Without it, L5-3's "every output attributed" holds trivially for single runs, and the cross-activity order "generated never earlier than used" has no subject. If yes, does the bind clamp the downstream `started` to the latest upstream `ended` of the entities it uses, or does it refuse the run with a typed order error?

O2. What exactly does L5-2 state, given that the sketch has no binary combinator? Proposed: sequential `product` with `swap ∘ product(q, p)` as the interchange, `pure` central under the declared observation, and a trace-writing `sync` (not a throwing one) as the observable counterexample, the throwing `sync` shown separately as a die outside the observation. That restates the acceptance half of the row; is the restatement a decision file and a law-plan edit?

O3. The `HashSet<Activity>` union reducer is the only census survivor. Are its laws (identity, associativity, commutativity, idempotence) folded into the L5-3 file, or do they get a law-plan row of their own, given the plan says a law without a named bug is deleted?

O4. How is a composite named? `compose` takes a `TermIri`, and the `operation:` namespace holds only `Extract`. Is each pipeline a declared registry term, or is a composite named by its components (a derived, non-term name), which changes `Operation.name`'s type to a union?

O5. Where does the activity id come from, given that minting needs `Digest`? `withActivity` could require `Digest.Digest` in `R` (changing every wrapped pipeline's `R`, against "fixed per pipeline"), or take a `JsoncDigest` and use `mintActivityIdResult`. And does `Activity` gain an `id: ActivityId` field checked against its start facts on decode, as the party ledger checks `generatedBy`?

O6. Does `GraphOperation` (node to node-list, with cost and validation) merge into `Operation`, or stay a graph-executor type outside L5? Its only external consumer is one wink test (`packages/drivers/wink/test/Graph/GraphOperationsCatalog.test.ts`). `ExecutionMetrics.combine` is dead in `src`. Do the executor, the result store and the metrics monoid stay, or retire with the duplicate graph layer?

O7. The chapter has L5 absorb `nlp/Core`, and decision `2026-11-22-p3-graph-span-becomes-an-optional-position` moves Graph `Schema` with it. Both are pure schemas, and the routing rule puts pure schemas in `foundation/modeling`. Do Core and Graph `Schema` move into the capability package `np/` as the chapter and census say (consumers: wink 10 files, semantica 3, law-practice use-cases 1, scratchpad 1), or into a modeling home? This map scopes only Operations and Algebra; the Core move needs its own consumer map.

O8. What is the canonical generation time of an entity produced by a wrapped operation: the activity's `ended`, or a separately stated time as in P3 (`Generation.at`, optional) and the handoff (one read after alignment)? One rule would let `withActivity` project both P3 `Generation` and P4 `GenerationFact` without a second clock read.

O9. Is the pin supplied by `HasIds` (sketch) or read from the environment (`Model.ProviderName` and `Model.ModelName`, as the handoff does)? The second makes model-backed operations require the Effect AI model services in `R`.

O10. Does the `Activity` record schema live beside `ActivityStart` in `@beep/jsonc` (modeling, which the routing rule prefers for pure data), or in `np/` as the sketch says? The party slice's `ClaimGeneration` is the same shape, and a shared modeling schema would let it reuse the order check.

O11. What is the span contract for an operation run: one literal `Operation.run` span with the term IRI, activity id and counts as attributes (catalog-visible), or a per-operation name (non-literal, outside the catalog)? Does P6 also fix the `package: "@beep/nlp"` label (`np/src/internal/observability.ts:16`) and move the `nlp_*_total` metrics to declared `beep.nlp.*` instruments, or leave both as reported debt?

O12. Which live runs become `Operation`s in P6, so that "every run emits a `prov:Activity`" has subjects beyond the law tests? Candidates: the langextract extraction (it already mints its activity by hand), `NLPService` workflows, the graph catalog operations and the office-action flow steps. Is migrating the handoff onto `withActivity` in scope, or recorded as staying hand-rolled?

O13. Does P6 delete `nlp/Operations` and `nlp/Algebra` outright (0 consumers; nothing to migrate), or move them into `np/` first, as the PLAN wording "absorbs" suggests? The census verdict is retire, and only the reducer and the arrow are re-expressed in new code. A decision file is needed to read "absorbs" as "replaced by".
