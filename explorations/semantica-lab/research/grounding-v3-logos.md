## 1. What the packages implement

Paths below are relative to the archived `beep-effect-logos` root.

### `@beep/rules`

- The root barrel exports only `beep = "beep"`; it does not export a usable rule model or engine (`packages/common/rules/src/index.ts`). The package's wildcard export still makes source subpaths importable (`packages/common/rules/package.json`).
- The implemented data artifacts are `ConditionType = "or" | "and" | "none"`, `IntrospectionStep`, and `ValidationResult` schemas (`src/ConditionType.ts`, `src/IntrospectionStep.ts`, `src/ValidationResult.ts`). Nothing consumes them inside this package.
- `OperatorFactory.ts` is a schema-construction meta-model. It separates category, kind, domain, and operator fields, then produces an annotated struct with defaulted `category`, `operator`, and `type`, plus metadata such as symbol, `requiresValue`, and `isNegatable` (`src/internal/OperatorFactory.ts:7-235`).
- The catalog declares 94 operator kinds across comparison, emptiness, pattern, set, structure, temporal, and type categories (`src/operators/categories/*.ts`). Only the 34 type predicates are bound to a domain and emitted as schema classes (`src/operators/domains/any.ts`); `array.ts`, `date.ts`, `number.ts`, `object.ts`, `string.ts`, and the domain barrel are zero-byte files.
- There is no condition aggregate, evaluator, normalization, action, working memory, or chaining algorithm. This is an unfinished operator-schema vocabulary, not a rules engine.

### `@beep/rete`

- The root API exports `beep`, auditor types/console auditor, the high-level condition/query types, and React hooks `useRule`/`useRuleOne` (`packages/common/rete/src/index.ts`, `src/core/{beep,auditor,types,useRule}.ts`). Deep source exports expose a lower-level `rete` object containing session/production setup, fact insert/retract/get, condition registration, firing, querying, and subscriptions (`src/network/rete.ts:16-31`).
- Facts are EAV triples `[id, attribute, value]`; tokens classify insert, retract, and update; variable bindings form parent-linked records; productions hold ordered conditions and callback actions (`src/network/types.ts:40-113,182-221`). The high-level DSL models each field condition as `{ match?: value, join?: alias, then?: boolean }`; aliases beginning with `$` bind arbitrary entity IDs (`src/core/types.ts:5-41`, `src/core/beep.ts:28-159`).
- This is a real, restricted Rete network, not a sketch. It builds a shared alpha discrimination tree over identifier/attribute/value tests; matching alpha nodes retain facts (`src/network/add-nodes/add-nodes.ts`, `get-alpha-nodes-for-fact/get-alpha-nodes-for-fact.ts`, `right-activation-with-alpha-node/right-activation-with-alpha-node.ts`).
- Its beta side is represented by alternating `JoinNode` and `MemoryNode` objects rather than a class named `BetaNode`. Right activations join alpha facts against partial-memory bindings; left activations walk successor alpha memories; terminal memory stores complete matches (`src/network/add-production-to-session/add-production-to-session.ts`, `right-activation-with-join-node/right-activation-with-join-node.ts`, `left-activation/shared.ts`).
- Insert/update/retract tokens propagate through alpha and join memories. Terminal matches queue `then` and `thenFinally` callbacks; callbacks may insert more facts, so `fireRules` repeatedly drains the queue with a default recursion limit of 16. Queries and subscriptions read terminal memories (`src/network/{upsert-fact,fire-rules,retract-fact,query-all,subscribe-to-production}/`).
- Limits are substantial: alpha tests are equality only; arbitrary `when` predicates run after a complete match; there are no negation/NCC nodes, salience/conflict resolution, agenda groups, production removal, backward chaining, Datalog parser, truth maintenance, or proof objects. Async actions return `Promise<void>` but the synchronous fire loop does not await them (`src/network/types.ts:102-110`, `fire-rules/fire-rules.ts:90-138`).

### `@beep/logos`

- `logos` does not import or wrap `rules` or `rete`. It is an independent serializable predicate-tree engine. The three packages share a theme, not an implementation stack.
- V1 models UUID-addressed `root`, `group`, and `rule` nodes. Groups recursively contain rules/groups and combine booleans with `and`/`or`; rules discriminate by `type`, carry a field path, a tagged operator, and operator-specific data (`packages/common/logos/src/{groups,rules,operators}.ts`, `src/internal/{Node,Operator,makeRule}.ts`).
- V1 has 11 rule families: string, number, boolean, array value/length, object key/value/entry, generic comparison/type, and date. Operators cover equality/order, containment, regex, type/presence checks, and date ordering (`src/rules.ts`, `src/operators.ts`). Evaluation resolves a field, dispatches to a pure validator, recursively short-circuits groups, and treats an empty group as true (`src/prepare.ts:25-83`).
- The V1 facade includes recursive CRUD, group construction, normalization, validation, compile/cache, and one-shot run. A structural fingerprint excluding node IDs invalidates a `WeakMap` runner cache; another cached index maps IDs to nodes, parents, and child slots (`src/{crud,normalize,prepare,run,validate}.ts`, `src/internal/{fingerprint,idIndex}.ts`). `run` is available by subpath but omitted from the root barrel (`src/index.ts`).
- V2 is a parallel rewrite, not a compatibility layer (`src/v2.ts`, `src/v2/`). It replaces shared operator payloads with rule-local schema classes and typed constructors such as `StringRule.eq`, `NumberRule.between`, set predicates, and same-period date predicates (`src/v2/rules/*.ts`, `src/v2/internal/Operands.ts`). It duplicates the node tree, CRUD API, normalizer, validator, compiler, fingerprint, and ID index; it also adds `and`/`or` construction combinators, although the V2 barrel does not export them (`src/v2/{api,combinators,prepare}.ts`, `src/v2/index.ts`).

## 2. Maturity

- Physical TypeScript LOC: `rules` 1,607 source + 7 test = 1,614; `rete` 2,467 source + 2,197 test = 4,664; `logos` 4,811 source + 2,520 test = 7,331.
- Live read-only test run on 2026-08-24 with Bun 1.4.0: `rules` 1 pass/0 fail, `rete` 46/0, `logos` 159/0. `rules` only asserts `true` (`packages/common/rules/test/Dummy.test.ts`), so its green result proves no behavior.
- `rete` has 11 test files and exercises queries, out-of-order facts, multiple joins, inserts from actions, updates, retractions, subscriptions, recursion limits, audit output, and performance (`packages/common/rete/test/lib/`, `test/rete/`). It is working code. A test documents an insertion/hash-order failure, and source TODOs call out binding consolidation and working-memory redesign (`test/rete/rete.test.ts:166`, `src/network/types.ts:201-206`, `right-activation-with-join-node/right-activation-with-join-node.ts:24`).
- `logos` has 33 test files, four fully commented placeholders. V1 CRUD/normalize/prepare/run has broad tests under `test/rules-engine/`; V2 rule validators have direct tests under `test/rules/`. The V2 API/normalize/prepare/run placeholders mean the rewrite's integrated path is unproved (`test/{api,normalize,prepare,run}.test-placeholder.ts`).
- V2 still contains integration defects hidden by that split coverage: three `prepare` guards test the returned `S.is(...)` predicate itself instead of applying it to `resolved` (`src/v2/prepare.ts:53-90`). V1's `DateRule.isBetween` ignores the `range` payload's bounds and only evaluates a `comparison` payload using bounds stored on the operator (`src/rules.ts:345-414`).
- The `logos` README is stale: it names nonexistent `src/ruleGroup.ts`, documents operator names and payloads that do not match V1, and is copied verbatim into the `rules` package (`packages/common/{logos,rules}/README.md`). V1/V2 duplication, stale docs, placeholders, and the last package-specific work in October 2025 indicate an abandoned mid-rewrite rather than a finished library.
- No TypeScript/JavaScript file outside these three package trees imports `@beep/rules`, `@beep/rete`, or `@beep/logos`. Web/runtime manifests declare them, and Next config has only commented entries (`apps/web/package.json:50-52`, `packages/runtime/{client,server,shared}/package.json`, `apps/web/next.config.ts:62-64`). They were never wired into product code in this archive.

## 3. Idioms and Effect v4 translation

- The archive pins Effect 3.18.4 (`package.json:213`). `rules` and `logos` use V3 `effect/Schema` heavily: `S.Struct`/`Union`/`Class`, `.annotations`, mutable schemas, property signatures, raw-thunk constructor defaults, manual `Type`/`Encoded` namespaces, and custom `@beep/schema` helpers. They also use `effect/Match`, `Array`, `Option`, `Record`, and `String` for pure evaluation.
- The new repo pins Effect 4.0.0-rc.111. Current V4 conventions use identity-bound `S.Class`, `S.tag` discriminators, `annotate`/`annotateKey`, identity annotation helpers, `LiteralKit`, and effectful constructor defaults. The V3 schema declarations are therefore reference material, not copyable code.
- `rules` should preserve only its operator taxonomy and metadata questions. Its four-layer generic factory, manual static namespaces, defaulted discriminator fields, empty domains, and generated class boilerplate should not survive.
- `rete` is mostly mutable TypeScript `Map`/`Set` state with thin Effect helper use. Its network topology and propagation tests translate; its interfaces, numeric schema enums, thrown exceptions, closure-owned mutable session, direct React dependency, and unawaited `Promise<void>` callbacks do not. Put mutable engine state behind an explicit V4 service boundary and model actions/errors in Effect.
- `logos` has durable semantics in its tagged rule AST and pure validators, but the tree should be rebuilt as one V4 schema-first model. Do not port both versions, mutable parent IDs, ad hoc UUID creation, weak-cache invalidation protocol, or decode/encode validation walls verbatim.

## 4. Comparison

- Against classic Rete, `rete` has genuine alpha memories, join nodes, partial/terminal beta-equivalent memories, variable binding, and incremental insert/update/retract propagation. It lacks classic negation/NCC nodes and a real conflict-resolution agenda. `logos` is not Rete: every call walks or compiles a static boolean expression tree against one object, with no working memory or token propagation. `rules` does not execute.
- Against semantica's described shape, none parses string rules or Datalog. `rete` supplies programmatic typed patterns over EAV facts and forward chaining through fact-producing actions; it has no backward chaining. `logos` supplies a serializable JSON-like condition AST but no heads/conclusions, derivation loop, or relation model.
- Semantica-style explanation objects have no counterpart. `rete` can return bound matches and has audit records plus DOT visualization (`src/network/{audit,debug}.ts`), which are useful raw trace inputs but not provenance-bearing proofs. `logos` returns only boolean; `rules` defines orphaned introspection/validation schemas.
- The useful synthesis is a typed, schema-first rule IR with optional string parse/print adapters, a Rete execution plan for incremental forward inference, and explanation events emitted during propagation. Backward chaining and Datalog should remain separate evaluators over the same logical IR rather than being inferred from these packages.

## 5. Verdict for the new lab

- `rules`: **PATTERN**. Re-derive the category/kind/domain/operator metadata model schema-first. Do not port the package; its root API, domain implementations, tests, and evaluator are effectively absent.
- `rete`: **SALVAGE**. Preserve the EAV/variable-binding model, alpha/join/memory topology, token propagation, terminal-match queries, audit/DOT hooks, and especially the behavioral tests. Port selectively behind a V4 service; do not bless its current public API or missing Rete features.
- `logos`: **PATTERN**. Treat V2 rule constructors/validators and tests as a semantic catalog, and re-derive one immutable V4 AST plus compiler. Skip the duplicated V1/V2 facades and caches as source code.

Most valuable carryovers:

1. `rete/src/network/types.ts`, `add-production-to-session/`, and the left/right activation modules as a compact map of a working alpha/join/memory implementation.
2. `rete/test/rete/rete.test.ts` and `test/lib/usage.test.ts` as an executable oracle for joins, incremental updates, retractions, and rule-induced facts.
3. `logos/src/v2/rules/*.ts` plus `logos/test/rules/*.test.ts` as operator semantics and edge-case inventory, not as V4 schema source.
4. `logos/src/{prepare.ts,internal/fingerprint.ts,internal/idIndex.ts}` for the ideas of compile-once plans, semantic fingerprints, and indexed tree editing; redesign ownership and invalidation.
5. `rete/src/network/{audit.ts,debug.ts}` as the starting event vocabulary for real explanation objects and network inspection.
