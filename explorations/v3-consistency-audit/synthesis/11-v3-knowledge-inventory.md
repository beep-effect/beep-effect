# 11 — v3 knowledge slice: convention inventory

**Scope:** read-only census of `~/YeeBois/projects/beep-effect4/packages/knowledge/{domain,tables,server,client,ui}`
(v3, archived 2026-02-22, HEAD `997a827454`). All counts from `rg`/`find`/`wc` on 2026-08-29; no build tools run.
`K` below = `~/YeeBois/projects/beep-effect4/packages/knowledge`. Excludes `node_modules`, `dist`, `coverage`, `.turbo`.

## TL;DR

1. The v3 knowledge **domain** is a scaffold-generated grammar that is 100% uniform in *shape* (22/22 PascalCase entity folders, 19/19 persisted entities carry all seven role files with identical export names) but only 36% real in *content*: 14/22 entities have 3-line empty `rpc/http/tool` shells.
2. The two error homes are **not duplicates**: `entities/<C>/<C>.errors.ts` (19 files, HTTP-annotated 404/403 unions, `S.TaggedError<X>()(` style) and `errors/<C>.errors.ts` (23 files, engine/service errors, `S.TaggedError<X>($I\`X\`)(` style) are two different error kinds with two different invocation idioms, each 100% uniform inside its home; only 6 concept names overlap.
3. The **server** is a different regime entirely: 16 PascalCase topical modules, 167/189 files with no role suffix, 55/55 services as `Context.Tag($I\`X\`)` (zero `Effect.Service`), 50/55 paired with a same-file `<X>Live` layer (88 `*Live` exports vs 5 `*Layer`, 0 `*Default`), and a per-module barrel style that splits three ways (12 `export * from`, 5 `export {`, 4 `export * as`).
4. **Tests** mirror the server by *directory* (12/21 src dirs have a test twin, 38/52 test files have a same-name src twin) with a 0.28 file ratio and a 0.64 LOC ratio (15,135 / 23,679) — not the "~1:1" the earlier archaeology claimed; `_shared/{TestLayers,LayerBuilders,ServiceMocks,GraphFixtures}` is used by 20/52 tests and 52/52 import `@beep/testkit`.
5. `$I` identity is a role-scoped law, not a file law: 146/281 domain and 70/189 server files carry it; inside the domain it is 100% present in schema-defining roles (model, errors, repo, contracts, values, services) and 0% in composition roles (entity, http, rpc, tool) — with two key-path drifts (`Agent/KnowledgeAgent.model` keys to a non-existent folder; `PropertyDefinition.values` keys bare).

## 1. Tier census

| Tier | src files | test files | src LOC | test LOC | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| domain | 281 | 4 (3 `.test.ts` + `_shared/TestLayers.ts`) | 8,856 | 295 | `find K/domain/src -name '*.ts' \| wc -l` |
| tables | 26 | 1 (`Dummy.test.ts`, vacuous) | 861 | 7 | 21 `.table.ts` + `index`, `tables/index`, `relations`, `schema`, `_check` |
| server | 189 | 57 (52 `.test.ts` + 5 helpers) | 23,679 | 15,724 (15,135 in `.test.ts`) | scout's "52" counted `.test.ts` only |
| client | 1 (docblock stub) | 1 (`Dummy.test.ts`) | 15 | 7 | `// Export client contracts here` |
| ui | 1 (docblock stub) | 1 (`Dummy.test.ts`) | 15 | 7 | `// Export UI components here` |

Command: `for t in domain tables server client ui; do find $t/src -name '*.ts' | wc -l; find $t/test -name '*.ts' | wc -l; done` in `K`.

## 2. Domain tier grammar

### 2.1 Top level

```
domain/src/
  index.ts        export * as {Entities,Errors,Rpc,Services,ValueObjects}   (5 namespaces; projections/ NOT exported)
  entities.ts     export * from "./entities/index"                            (shim for the "./entities" package export)
  entities/       22 PascalCase concept folders + index.ts
  errors/         22 <Concept>.errors.ts + 1 EventBus.error.ts + index.ts
  values/         26 *.value.ts + 1 BatchMachine.schema.ts + rdf/ reasoning/ sparql/ (lowercase) + 4 index.ts
  rpc/            8 <Concept>/index.ts one-line aliases + index.ts
  services/       4 *.service.ts + index.ts
  projections/    GraphRagQueryResult.ts + index.ts
```

Domain suffix distribution (`find domain/src -name '*.ts' | sed 's|.*/||' | awk -F. '{print (NF>=3)?"."$(NF-1):"(none)"}' | sort | uniq -c`):

| suffix | count | suffix | count |
| --- | ---: | --- | ---: |
| `index.ts` | 48 | `.repo` | 19 |
| `.errors` | 41 | `.model` | 19 |
| `.contract` | 32 | `.entity` | 19 |
| `.value` | 26 | `.service` | 4 |
| `.tool` / `.rpc` / `.http` | 22 each | `.values` | 3 |
| single-segment (non-index) | 2 (`entities.ts`, `GraphRagQueryResult.ts`) | `.schema` / `.error` | 1 each |

**279/281 domain files carry a role suffix or are `index.ts`.** The domain is the suffix-disciplined tier; the server is not (§3).

### 2.2 Entity folder census (22 folders)

| path | command | result |
| --- | --- | --- |
| `K/domain/src/entities/` | `ls -d entities/*/ \| wc -l` | **22** folders (scout said 24; archaeology doc 42 says 22 — 22 is correct) |
| same | per-folder `[ -f $d/$c.<role>.ts ]` loop | see table below |
| same | `find entities -type d -name schemas` | **0** — no entity has a `schemas/` dir (scout grammar listed one) |
| same | `find entities -path '*/contracts/*' -name '*.contract.ts' \| wc -l` | **32** contracts across **8** folders (+8 `contracts/index.ts`) |

| Entity | model | entity | errors | http | rpc | tool | repo | contracts | extra |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: | --- |
| Agent | y | y | y | y | y | y | y | – | files named `KnowledgeAgent.*` (folder/file mismatch) |
| Batch | y | y | y | y | y | y | y | 5 | |
| ClassDefinition | y | y | y | y | y | y | y | – | |
| EmailThread | y | y | y | y | y | y | y | – | |
| EmailThreadMessage | y | y | y | y | y | y | y | – | |
| Embedding | y | y | y | y | y | y | y | – | `Embedding.values.ts` |
| Entity | y | y | y | y | y | y | y | 8 | |
| EntityCluster | y | y | y | y | y | y | y | – | |
| Evidence | – | – | – | y | y | y | – | 2 | contract-only |
| Extraction | y | y | y | y | y | y | y | 5 | |
| GraphRag | – | – | – | y | y | y | – | 3 | contract-only |
| MeetingPrep | – | – | – | y | y | y | – | 2 | contract-only |
| MeetingPrepBullet | y | y | y | y | y | y | y | – | |
| MeetingPrepEvidence | y | y | y | y | y | y | y | – | |
| Mention | y | y | y | y | y | y | y | – | |
| MentionRecord | y | y | y | y | y | y | y | – | |
| MergeHistory | y | y | y | y | y | y | y | – | |
| Ontology | y | y | y | y | y | y | y | 8 | `Ontology.values.ts` |
| PropertyDefinition | y | y | y | y | y | y | y | – | `PropertyDefinition.values.ts` |
| Relation | y | y | y | y | y | y | y | 7 | |
| RelationEvidence | y | y | y | y | y | y | y | – | |
| SameAsLink | y | y | y | y | y | y | y | – | |
| **totals** | **19** | **19** | **19** | **22** | **22** | **22** | **19** | **8 folders / 32 files** | 3 `.values.ts` |

Two folder kinds, each internally uniform: **19 persisted entities** = full 7-role kit; **3 contract-only concepts** (Evidence, GraphRag, MeetingPrep) = `http`+`rpc`+`tool`+`contracts/` and nothing else. `index.ts` present 22/22.

### 2.3 What each role file actually is (verified by reading `entities/Batch/*`)

| role | content | export-name uniformity (command: `rg -l '^export <pattern>' entities/*/*.<role>.ts`) |
| --- | --- | --- |
| `.model.ts` | `M.Class<Model>($I\`<C>Model\`)` + `modelKit(Model)`; `$I` key = folder path `entities/<C>` | `export class Model` **19/19**; `modelKit` 19/19; `M.Class` 19/19 |
| `.entity.ts` | **`@effect/cluster` Entity**: `ClusterEntity.fromRpcGroup("Entity", Rpcs).annotateRpcs(ClusterSchema.Persisted, true)` — *not* a domain entity model | `ClusterEntity.fromRpcGroup` **19/19** |
| `.errors.ts` | HTTP-facing errors (`$I.annotationsHttp(..., {status: 404/403})`) + `export const Errors = S.Union(...)` | `Errors = S.Union` **19/19** |
| `.http.ts` | `class Http extends HttpApiGroup.make("<kebab>").add(<Op>.Contract.Http)....prefix("/<kebab>")` | `export class Http` **22/22**; `/kebab` prefix 22/22 |
| `.rpc.ts` | `class Rpcs extends RpcGroup.make(<Op>.Contract.Rpc, ...).prefix("<snake>_")` | `export class Rpcs` **22/22**; `snake_` prefix on all 8 non-empty |
| `.tool.ts` | `export const Toolkit = AiToolkit.make(<Op>.Contract.Tool, ...)` | `export const Toolkit` **22/22** |
| `.repo.ts` | `type RepoShape = DbRepo.DbRepoSuccess<typeof Model>; class Repo extends Context.Tag($I\`Repo\`)<Repo, RepoShape>() {}` | `class Repo extends Context.Tag` **19/19**; `RepoShape` 19/19 |
| `contracts/<Op>.contract.ts` | `class Payload`, `class Success`, `Failure`, `class Contract extends S.TaggedRequest<Contract>($I\`Contract\`)("<op>", {...})` with `static Rpc = Rpc.fromTaggedRequest(Contract)`, `static Tool = Tool.fromTaggedRequest(Contract)`, `static Http = HttpApiEndpoint...` | `Contract` **32/32**; `Payload` 32/32; `Failure|Error(s)` 32/32; `Success` 22/32; `HttpApiEndpoint` 23/32 |

**Empty-shell census** (`rg -l 'RpcGroup\.make\(\)' entities/*/*.rpc.ts` etc.):

| role | empty placeholder | real | verdict |
| --- | ---: | ---: | --- |
| `.rpc.ts` | 14 (`RpcGroup.make()`) | 8 | grammar uniform, content 36% |
| `.http.ts` | 14 (no `.add(`) | 8 | same |
| `.tool.ts` | 14 (`AiToolkit.make()`) | 8 | same |

Line-count fingerprint: 14 entities have `rpc:3 http:3 tool:3`. The 7-role kit is scaffold output; only Batch, Entity, Evidence, Extraction, GraphRag, MeetingPrep, Ontology, Relation were ever filled in.

### 2.4 Entity `index.ts` shape (22/22 identical pattern)

```ts
export * from "./<C>.entity";
export * as <C>Errors from "./<C>.errors";   // namespaced, not spread
export * from "./<C>.http";
export * from "./<C>.model";
export * from "./<C>.repo";
export * as Rpcs from "./<C>.rpc";
export * from "./<C>.tool";
export * as Contracts from "./contracts";     // only the 8 with contracts
```

`entities/index.ts`: `export * as <C> from "./<C>"` **22/22** (`export * as KnowledgeAgent from "./Agent"` is the one alias rename).
`contracts/index.ts`: `export * as <Op> from "./<Op>.contract"` **8/8**.

### 2.5 Values

| path | command | result |
| --- | --- | --- |
| `K/domain/src/values` | `find values -name '*.value.ts' \| wc -l` / `-name '*.schema.ts'` | **26** `.value.ts`, **1** `.schema.ts` (`BatchMachine.schema.ts`), 0 `.schemas.ts`, 4 `index.ts` |
| same | `ls -d values/*/` | 3 lowercase sub-namespaces: `rdf/` (6), `reasoning/` (3), `sparql/` (1), each with `index.ts` |
| same | `rg -l 'extends S\.Class' values` / `LiteralKit\|stringLiteralKit` | 18 `S.Class`, 12 `LiteralKit`-family, 0 `S.Struct` |
| same | export name == file stem loop | **23/26** (`ExtractionProgress`, `ProvenanceVocabulary`, `WorkflowState` differ) |
| `K/domain/src/entities/*/*.values.ts` | `ls entities/*/*.values.ts` | 3 entity-local `.values.ts` (Embedding, Ontology, PropertyDefinition) — plural suffix, `$I`-keyed |
| `values/index.ts` | cat | 20 lines, all `export * from` (files + 3 subfolders) |

Verdict: `.value.ts` singular for shared values (26/27 = 96%) is uniform; entity-local `.values.ts` plural is a second, minority idiom (3 files).

### 2.6 The two error homes

| path | command | result |
| --- | --- | --- |
| `errors/` | `ls errors/*.errors.ts \| wc -l` | **22** `.errors.ts` + `EventBus.error.ts` (singular — 1/23 suffix drift) |
| `entities/*/` | `ls entities/*/*.errors.ts \| wc -l` | **19** |
| both | `comm -12` on concept stems | **6 overlap**: Batch, Embedding, Entity, Extraction, Ontology, Relation |
| both | | 16 only in `errors/` (Activity, Circuit, Cluster, EntityResolution, GraphRag, Grounding, Jina, Llm, Merge, Rdf, Reasoning, Registry, Shacl, Sparql, Split, Workflow); 13 only in `entities/` |
| `errors/Batch.errors.ts` vs `entities/Batch/Batch.errors.ts` | `wc -l` + head | 72 lines (`InvalidStateTransitionError`, ..., `$I.annotations`) vs 30 lines (`BatchNotFoundError` 404, `BatchPermissionDeniedError` 403, `$I.annotationsHttp`, `Errors` union) — **different classes, different purposes** |
| domain | `rg -c 'S\.TaggedError<[A-Za-z]+>\(\)\('` | **38 in 19 files** — all in `entities/`; `()(` then `$I\`X\`` first arg |
| domain | `rg -c 'S\.TaggedError<[A-Za-z]+>\(\$I'` | **68 in 23 files** — all in `errors/`; `$I\`X\`` in first call, literal `"X"` tag second |
| domain | `rg -c annotationsHttp` / `\$I\.annotations\(` | 61 / 294 |

Canonical answer: **neither is "the" home; they are two kinds.** `entities/<C>/<C>.errors.ts` = transport-facing errors with HTTP status, exported as `<C>Errors` namespace + `Errors` union consumed by `contracts/`. `errors/<C>.errors.ts` = engine/service errors consumed by server modules and by contracts' `Failure` (`StartBatch.contract.ts` imports `BatchAlreadyRunningError` from `@beep/knowledge-domain/errors`). Both homes are internally 100% uniform in invocation style; the split between styles is by home, not by author whim. `$I` key style also differs: `errors/batch` (lowercase leaf) vs `entities/Batch/Batch.errors` (path-mirror).

### 2.7 `rpc/<Concept>/` vs `entities/<C>/<C>.rpc.ts`

| path | command | result |
| --- | --- | --- |
| `K/domain/src/rpc/*/index.ts` | `wc -l` | 8 files, **1 line each**: `export * as Batch from "../../entities/Batch/Batch.rpc";` |
| `rpc/index.ts` | cat | 8 × `export { <C> } from "./<C>"` |

`rpc/` is a pure alias layer that re-publishes the 8 non-empty `Rpcs` groups under `Rpc.<C>` so the server can `import { Batch } from "@beep/knowledge-domain/rpc/Batch"`. There is no parallel definition; the 14 empty `Rpcs` are not aliased. 8/8 uniform.

### 2.8 Services and projections

| path | command | result |
| --- | --- | --- |
| `services/*.service.ts` | `rg -n 'Context\.Tag\|Effect\.Service'` | 4/4 `Context.Tag($I\`X\`)<X, XShape|XService>()`; 0 `Effect.Service`; generic name suffix split 2 `Shape` / 2 `Service` |
| `projections/GraphRagQueryResult.ts` | `rg -l '/projections' domain/src server/src` | consumed by 2 GraphRag contracts via `@beep/knowledge-domain/projections`; **not exported from root `index.ts`** (0/5 namespaces) |

### 2.9 `$I` identity convention (domain)

| path | command | result |
| --- | --- | --- |
| `K/domain/src` | `rg -l '^const \$I = ' \| wc -l` | **146 / 281** files; factory always `$KnowledgeDomainId.create(` (146/146) |
| by role | `rg -l '^const \$I' entities/*/*.<role>.ts` | model **19/19**, errors **19/19**, repo **19/19**, contracts **32/32**, values **26/27**, `errors/` **23/23**, services **4/4**; entity **0/19**, http **0/22**, rpc **0/22**, tool **0/22** |
| key shape | `rg -oN 'create\("[^"]+"\)'` vs path | errors/repo/contracts/values: key == `entities/<C>/<file-stem>` **57/58** (exception `PropertyDefinition.values` → bare `entities/PropertyDefinition`); model: key == folder `entities/<C>` **18/19** (exception `Agent/KnowledgeAgent.model` → `entities/KnowledgeAgent/KnowledgeAgent.model`, a folder that does not exist) |

Law as practiced: **files that declare schemas carry `$I` keyed by their src-relative path; files that only compose groups (`.entity/.http/.rpc/.tool`) do not.** 100% on both sides.

### 2.10 Domain import style

| convention | command | result |
| --- | --- | --- |
| `import * as S from "effect/Schema"` | `rg -l` | 192 files (domain+server); `import { Schema } from "effect"` 0; bare `from "effect"` 0 |
| self-alias `@beep/knowledge-domain/*` inside domain src | `rg -c` | 46 imports in 33 files (`/errors` 19, `/values` 13, `/entities` 4, `/projections` 2, deep file paths 8) vs `../` 37 vs `./` 348 |
| package exports | `domain/package.json` | `".": src/index.ts`, `"./entities": src/entities/index.ts`, `"./*": "./src/*.ts"` — the wildcard is why root `entities.ts` shim exists |

## 3. Server tier grammar

### 3.1 Topology (`ls K/server/src`)

| dir | files | subdirs | index style | Tag files |
| --- | ---: | --- | --- | ---: |
| `entities/` | 64 | 22 `<C>/` (+6 `<C>/rpc/`) | `export * as <C>Live` ×22 | 0 |
| `GraphRAG/` | 11 | – | 7 `* as` + 3 `* from` (mixed) | 5 |
| `Extraction/` | 11 | `schemas/` | `* from` ×6 | 5 |
| `utils/` | 10 | – | `* from` ×8 | 0 |
| `Service/` | 10 | `Integrations/` | `* from` ×8 | 8 |
| `EntityResolution/` | 10 | – | `export {` ×9 | 6 |
| `Sparql/` | 8 | – | `* from` ×6 | 3 |
| `Embedding/` | 8 | `providers/` | `export {` ×5 | 2 |
| `Workflow/` | 7 | – | `export {` ×6 | 6 |
| `Rdf/` | 6 | – | `* from` ×5 | 4 |
| `Validation/` `Reasoning/` `Ontology/` `LlmControl/` | 5 each | – | `* from` | 1/1/3/3 |
| `Runtime/` `db/` | 4 each | `db/Db/` | `* from` / mixed | 1/1 |
| `rpc/` `Nlp/` `Grounding/` | 3 each | `rpc/v1/` | `* as` / `* from` / `export {` | 0/1/1 |
| `Ai/` `adapters/` | 2 each | – | `* from` / `export {` | 0/1 |
| root | `index.ts`, `db.ts` (shim), `EmbeddingRateLimiter.ts` | | | 1 |

Dir case: **40 PascalCase / 14 lowercase** (`adapters db entities rpc utils`, `Embedding/providers`, `Extraction/schemas`, `rpc/v1`, 6× `entities/<C>/rpc`). Scout's module list omitted `Ai/`.

### 3.2 File naming

| path | command | result |
| --- | --- | --- |
| `K/server/src` | suffix awk | **167 no suffix**, 19 `.repo`, 3 `.schema` (`Extraction/schemas/{entity,mention,relation}-output.schema.ts` — kebab stems) |
| same | single-segment case | **83 PascalCase** vs **23 lowercase** non-index files |
| lowercase list | | `utils/*` camelCase fn files (8), `entities/*/rpc/<op>.ts` camelCase handlers (10), `db.ts`, `constants.ts`, `openai-wire.ts`, `repositories.ts`, `vector.ts`, `formatting.ts` |
| `Service/` | `ls Service \| grep -c 'Service\.ts$'` | 1/8 files end in `Service` (`ReconciliationService.ts`); others are role nouns (`Storage`, `EventBus`, `OntologyRegistry`, `DocumentClassifier`, ...) |

Server law as practiced: **`<Module>/<PascalNoun>.ts`, one Tag + one Live per file, no role suffix** — except repos (`.repo`, 19/19) and LLM output schemas (`.schema`, 3/3).

### 3.3 Service / Layer definition

| convention | command | result |
| --- | --- | --- |
| `Context.Tag` | `rg -l 'Context\.Tag' server/src \| wc -l` | **53 files / 55 classes**; ids all `$I\`Name\`` (55/55), 0 literal strings |
| `Effect.Service` | `rg -l 'Effect\.Service<'` | **0** (contradicts `40-v3-specs-corpus.md` "RdfStore (Effect.Service over N3.Store)") |
| `Context.GenericTag` | | 0 |
| shape interface | `rg -c 'interface [A-Za-z]+Shape\b'` | **50** `interface <X>Shape`; 0 `interface <X>Service`; 29 use the literal `<X, XShape>` generic |
| same-file Live pairing | loop over Tag classes | **50/55 paired** with `export const <X>Live`; 5 unpaired (`Storage`, `ExternalEntityCatalog`, `EmbeddingRateLimiter`, `FallbackEmbeddingModel`, `Db`) |
| layer suffix | `rg -oN 'export (const\|class) [A-Za-z0-9_]+(Live\|Layer\|Default\|Test)\b'` | **Live 88** (19 are `RepoLive`), Layer 5 (`OpenAiEmbeddingLayer`, `MockEmbeddingModelLayer`, ...), Test 3, Default 0 |
| constructors | `rg -l` | `Layer.effect` 73 files, `Layer.succeed` 4, `Layer.mergeAll` 6 |
| pattern (`Extraction/EntityExtractor.ts:67,294`) | | `export class EntityExtractor extends Context.Tag($I\`EntityExtractor\`)<EntityExtractor, EntityExtractorShape>() {}` … `export const EntityExtractorLive = Layer.effect(EntityExtractor, serviceEffect);` |

### 3.4 `entities/<C>/` in the server

| path | command | result |
| --- | --- | --- |
| `entities/*/<C>.repo.ts` | `ls` | **19/22** (Evidence, GraphRAG, MeetingPrep have none — matches domain contract-only set) |
| repo shape (`Batch.repo.ts`) | cat | `export const RepoLive: Layer.Layer<Entities.Batch.Repo, never, DbClient.SliceDbRequirements> = Layer.effect(Entities.Batch.Repo, DbRepo.make(KnowledgeEntityIds.BatchExecutionId, Entities.Batch.Model)).pipe(Layer.provide(KnowledgeDb.layer))` — 19/19 export `RepoLive` |
| `entities/*/rpc/` | `ls -d` | **6/22** (Batch, Entity, Evidence, GraphRAG, MeetingPrep, Relation) — exactly the domain `rpc/` alias set minus Extraction, Ontology |
| `rpc/<op>.ts` | `find -path '*/rpc/*.ts' -not -name index.ts -not -name _rpcs.ts` | **10** camelCase op files; `export const Handler` **10/10**; `Effect.fn("<group>_<op>")` 8/10; op stem matches a domain `<Op>.contract.ts` **9/10** (`Batch/getStatus` vs `GetBatchStatus.contract`) |
| `rpc/_rpcs.ts` | cat | 6/6: `RpcContracts.<C>.Rpcs.middleware(Policy.AuthContextRpcMiddleware)` → `.of({ <group>_<op>: X.Handler })` → `export const layer = ....toLayer(implementation)` |
| `rpc/index.ts` | cat | 6/6 `export { layer } from "./_rpcs";` |
| `Relation/rpc/_rpcs.ts` | cat | all 6 ops `() => Effect.die("Not implemented")` — declared contract, dead handler |
| `entities/<C>/index.ts` | cat | `export * from "./<C>.repo"` (+ `export * as Rpc from "./rpc"` when present) |
| `entities/index.ts` | cat | `export * as <C>Live from "./<C>"` **22/22** — the `Live` suffix is applied to *namespaces*, not just layers |
| `db/repositories.ts` | head | `type Repos = Entities.Batch.Repo \| ...` union of 19 + a merged layer; published as `KnowledgeRepos` via `db/index.ts` |
| `rpc/v1/_rpcs.ts` | cat | `Layer.mergeAll(Live.BatchLive.Rpc.layer, ... 6)` + 5 `Layer.provide`; `rpc/index.ts` = `export * as V1` |

Server folder names drift from domain: `entities/GraphRAG` vs domain `GraphRag`; `entities/KnowledgeAgent` vs domain `Agent`.

### 3.5 Server barrels and export surface

| path | command | result |
| --- | --- | --- |
| `K/server/src` | `find -name index.ts \| wc -l` + `rg -c` | **54** index.ts; `export * as` 54, `export * from` 82, `export {` 32 |
| root `index.ts` | cat | 16 `export * as <Module>` (Ai, Adapters, Embedding, EntityResolution, Extraction, GraphRAG, Grounding, Nlp, Ontology, Rdf, Reasoning, Runtime, Rpc, Service, Sparql, Validation) + `export * from "./db"`; **omits** `entities`, `Workflow`, `LlmControl`, `utils`, `EmbeddingRateLimiter` |
| per-module index style | table §3.1 | **12** modules `export * from` only; **5** named `export {` only (adapters, Embedding, EntityResolution, Grounding, Workflow — e.g. `export { BatchAggregator, BatchAggregatorLive } from "./BatchAggregator"`); **3** `export * as` (entities, rpc, db); **1** mixed (GraphRAG) |
| self-alias imports | `rg -c 'from "@beep/knowledge-server/'` | **35 in 30 files** (`db` 11, `utils` 6, `Workflow` 5, `Runtime` 3, ...) — how the un-barrelled modules are reached |
| package exports | `server/package.json` | `".": src/index.ts`, `"./Extraction"`, `"./db": src/db.ts`, `"./*": "./src/*.ts"` |
| `_`-prefixed private files | `find -name '_*'` | 7 `_rpcs.ts`, 1 `_check.ts` (tables), 3 `_shared/` test dirs |

### 3.6 `$I` in the server

`rg -l '^const \$I = ' server/src | wc -l` → **70 / 189** (all `$KnowledgeServerId.create(`); keys are `<Module>/<File>` PascalCase path mirrors (68/70; the 2 lowercase are `adapters/...`, `db/Db`). Coverage by dir tracks the Tag files (Service 8, Workflow 6, EntityResolution 6, GraphRAG 5, Extraction 5, ...). No `$I` in `entities/` (repos import `Entities.<C>.Repo` from the domain instead).

## 4. Tables tier

| path | command | result |
| --- | --- | --- |
| `K/tables/src/tables` | `find -name '*.table.ts' \| wc -l` + case grep | **21/21 kebab-case** `.table.ts`, 0 PascalCase |
| same | `rg -oN 'OrgTable\.make'` | **21/21** `OrgTable.make(KnowledgeEntityIds.<X>Id)(...)`; exports are camelCase (`export const entity = ...`), 0 `*Table` names |
| `tables/src/index.ts` | cat | single line `export * as KnowledgeDbSchema from "./schema"` |
| `schema.ts` | cat | `export * from "./relations"; export * from "./tables";` |
| `tables/index.ts` | cat | 21 `export * from "./<kebab>.table"` |
| `relations.ts` | head | imports 11 tables by camelCase name; `drizzle-orm` relations |
| `_check.ts` | `rg -l _check tables` | referenced only by `AGENTS.md`/`ai-context.md`; lists **12** entities (vs 19 models) for `InferSelectModel` alignment — partial |
| model → table | kebab-twin loop | **17/19** models have a same-stem table; `Batch` → `batch-execution.table.ts` (name drift: folder `Batch`, `$I` `BatchExecutionModel`, id `BatchExecutionId`), `KnowledgeAgent` → no table; 3 `workflow-{activity,execution,signal}` tables have no domain model |
| `tables/test` | ls | `Dummy.test.ts` (`expect(true).toBe(true)`) |

## 5. Tests

### 5.1 Server mirror by directory (`for d in src/*/; test/$d exists?`)

| src dir | src files | test files | src LOC | test LOC | mirrored |
| --- | ---: | ---: | ---: | ---: | --- |
| GraphRAG | 11 | 9 | 1,970 | 2,875 | yes |
| Rdf | 6 | 6 | 1,163 | 3,626 | yes |
| Service | 10 | 9 | 2,663 | 1,237 | yes |
| Workflow | 7 | 6 | 1,802 | 1,161 | yes |
| Extraction | 11 | 5 | 2,957 | 1,150 | yes |
| Sparql | 8 | 3 | 2,070 | 1,665 | yes |
| Reasoning | 5 | 3 | 869 | 1,249 | yes |
| EntityResolution | 10 | 3 | 2,137 | 522 | yes (+ own `_shared/`) |
| adapters | 2 | 1 | 534 | 417 | yes |
| Nlp | 3 | 1 | 280 | 124 | yes |
| Validation | 5 | 1 | 395 | 93 | yes |
| Ai, db, Embedding, **entities (64f)**, Grounding, LlmControl, Ontology, rpc, Runtime, utils | 10 dirs | 0 | | | **no test dir** |
| test-only dirs | | `benchmarks/` (1), `Resilience/` (4), `_shared/` (4), root `EmbeddingRateLimiter.test.ts` | | | |

| metric | command | result |
| --- | --- | --- |
| dirs mirrored | | **11 of 21** src dirs have a `test/<dir>` twin (12 counting root-level `EmbeddingRateLimiter.test.ts` ↔ `src/EmbeddingRateLimiter.ts`) |
| file-name twin | per-test `[ -f src/<dir>/<stem>.ts ]` | **38/52** 1:1 by name, 2 same-name-elsewhere, 12 no src twin (Resilience/, benchmarks/, `*.singleNodeSemantics`, ...) |
| file ratio | 52 / 189 | **0.28** |
| LOC ratio | `.test.ts` 15,135 / src 23,679 | **0.64** (0.66 incl. helpers) — archaeology doc 41's "~1:1" is overstated |
| naming | suffix census | `.test.ts` 49, `.schema.test.ts` 1, `.bench.test.ts` 1, `.singleNodeSemantics.test.ts` 1, helpers `.ts` 5 |
| runner | `rg -l '@beep/testkit'` | **52/52**; `bun:test` 0, `vitest` 0, `@effect/vitest` 0 |
| import style | `rg -c 'from "@beep/knowledge-server'` | **112** package-alias imports vs **2** relative `../src` |
| `_shared/` | ls + `rg -l _shared` | `TestLayers.ts`, `LayerBuilders.ts`, `ServiceMocks.ts`, `GraphFixtures.ts` (583 LOC); imported by **20/52** tests (TestLayers 8, GraphFixtures 6, LayerBuilders 5, ServiceMocks 4); a second `test/EntityResolution/_shared/` exists |

### 5.2 Domain / tables / client / ui tests

`domain/test/{services/EntityRegistry.test.ts, services/MergeHistory.test.ts, values/EvidenceSpan.value.test.ts, _shared/TestLayers.ts}` — mirrors `src/services` and `src/values` by directory, keeps the role suffix in the test stem (`EvidenceSpan.value.test.ts`), imports via `@beep/knowledge-domain/*` + `@beep/testkit`. 3 tests / 281 src = 1%. Tables, client, ui: one vacuous `Dummy.test.ts` each.

## 6. Doc drift (AGENTS.md vs code)

| claim | file | reality |
| --- | --- | --- |
| `MentionExtractor.Default` (Effect.Service accessor) | `K/server/AGENTS.md:228` | 0 `.Default` in `server/src`; all services are `Context.Tag` + `<X>Live` |
| `AnthropicLlmLive`, `OpenAiLlmLive` in `Runtime/` | `K/server/AGENTS.md:17` | 0 hits in src |
| `packages/knowledge/server/src/db/repos/` | `K/domain/AGENTS.md`, `K/tables/AGENTS.md:19` | directory does not exist; repos live at `server/src/entities/<C>/<C>.repo.ts` |

## Uniformity ledger

| # | convention | applied N/M | verdict |
| --- | --- | --- | --- |
| D1 | `entities/<PascalConcept>/` folder per concept | 22/22 | uniform |
| D2 | folder name == file stem inside it | 21/22 (`Agent/KnowledgeAgent.*`) | uniform (95%) |
| D3 | persisted entity = 7-role kit `.model .entity .errors .http .rpc .tool .repo` | 19/19 persisted; 3/3 contract-only carry exactly `http/rpc/tool/contracts` | uniform (two kinds, each 100%) |
| D4 | role export names `Model/Entity/Errors/Http/Rpcs/Toolkit/Repo` | 19+19+19+22+22+22+19 = 142/142 | uniform |
| D5 | `rpc/http/tool` files have real content | 8/22 | **habitual — 64% empty scaffold shells** |
| D6 | `contracts/<Op>.contract.ts` with `Contract` class exposing `static Rpc/Tool(/Http)` | 32/32 (`Http` 23/32) | uniform (Http optional) |
| D7 | entity `index.ts` shape (`* from` roles, `* as <C>Errors`, `* as Rpcs`, `* as Contracts`) | 22/22 | uniform |
| D8 | `entities/index.ts` `export * as <C>` | 22/22 | uniform |
| D9 | shared values as `values/<Name>.value.ts` | 26/27 (+1 `.schema.ts`) | uniform (96%) |
| D10 | value export name == file stem | 23/26 | uniform (88%) — borderline |
| D11 | entity-local values as `<C>.values.ts` (plural) | 3 files | minority idiom, consistent among themselves |
| D12 | two error homes with two `S.TaggedError` invocation styles, each style confined to its home | 19/19 in `entities/`, 23/23 in `errors/` | uniform per home; **absent** as a single slice-wide style |
| D13 | `errors/<C>.errors.ts` plural suffix | 22/23 (`EventBus.error.ts`) | uniform (96%) |
| D14 | `rpc/<C>/index.ts` one-line alias of `entities/<C>/<C>.rpc` | 8/8 | uniform |
| D15 | `$I` present in schema-defining roles, absent in composition roles | 142/143 present where expected, 0/85 where not | uniform |
| D16 | `$I` key == src-relative path (`entities/<C>/<stem>`); model uses folder key | 57/58 and 18/19 | uniform (97%) |
| D17 | root barrel `export * as` per top-level dir | 5/6 (`projections/` omitted) | uniform (83%) — one gap |
| D18 | `import * as S from "effect/Schema"` (no root `effect` imports) | 192/192 files that import Schema | uniform |
| D19 | domain self-alias `@beep/knowledge-domain/*` vs relative `../` | 46 vs 37 | **habitual** (mixed) |
| S1 | server modules as PascalCase topical dirs | 16/21 top-level (5 lowercase: adapters, db, entities, rpc, utils) | habitual (76%) |
| S2 | server files single-segment PascalCase, no role suffix | 83 Pascal / 23 lowercase; 167/189 no suffix | uniform for services (88%); lowercase reserved for utils fns + rpc handlers |
| S3 | `.repo.ts` suffix for repos | 19/19 | uniform |
| S4 | services as `class X extends Context.Tag($I\`X\`)<X, XShape>()` | 55/55 Tag+`$I`; 50/55 `XShape` | uniform (91%) |
| S5 | same-file `export const XLive = Layer.effect(X, ...)` | 50/55 | uniform (91%) |
| S6 | `Live` as the layer suffix (vs `Layer`/`Default`) | 88/96 | uniform (92%) |
| S7 | `entities/index.ts` namespace suffix `<C>Live` | 22/22 | uniform |
| S8 | `entities/<C>/rpc/{_rpcs.ts, <camelOp>.ts → Handler, index.ts}` | 6/6 dirs, 10/10 handlers, 9/10 op-name == contract | uniform |
| S9 | per-module barrel style | 12 `* from` / 5 `export {` / 3 `* as` / 1 mixed | **habitual (57%)** |
| S10 | root barrel covers all modules | 17/22 top-level items | habitual (77%) |
| S11 | `$I` in server files | 70/189 (tracks Tag files 53) | role-scoped, uniform where a Tag exists |
| S12 | concept spelling shared with domain | GraphRag/GraphRAG (12 vs 18 files), Agent/KnowledgeAgent, Batch/BatchExecution | **drift** |
| T1 | `tables/<kebab>.table.ts` | 21/21 | uniform |
| T2 | `OrgTable.make` + camelCase export | 21/21 | uniform |
| T3 | model ↔ table twin by name | 17/19 | uniform (89%) |
| T4 | `_check.ts` covers all models | 12/19 | habitual |
| X1 | tests under `<pkg>/test/`, `.test.ts` suffix, `@beep/testkit` | 52/52 server, 3/3 domain | uniform |
| X2 | server tests mirror src topical dir | 12/21 dirs; 38/52 files 1:1 | **habitual (57% of dirs)** |
| X3 | test LOC ratio | 0.64 | — (not "1:1") |
| X4 | `_shared/` helper quartet | 1 canonical dir used by 20/52 tests, +1 nested `_shared/` | habitual (38% adoption) |
| X5 | test imports via package alias not relative `../src` | 112 vs 2 | uniform |
| X6 | non-server tiers tested | domain 3/281, tables/client/ui vacuous | absent |

## Surprises vs scout facts

1. **22 entity folders, not 24** (`ls -d entities/*/ | wc -l`). Archaeology doc 42 already had 22/19; the scout number was wrong.
2. **No `schemas/` dir in any entity folder** (0/22). `.schema.ts` occurs once in domain `values/` and 3× in server `Extraction/schemas/` with kebab stems (`entity-output.schema.ts`).
3. **`.entity.ts` is not a data model** — it is an `@effect/cluster` `Entity.fromRpcGroup(...)` (19/19). The data model is `.model.ts` (`M.Class` + `modelKit`). The scout's "entity folder grammar" conflates the two.
4. **The error homes are not duplicates.** Only 6/35 stems overlap, contents differ (HTTP-status errors vs engine errors), and the two `S.TaggedError` invocation idioms are each 100% confined to one home.
5. **`rpc/<Concept>/` is a 1-line alias layer** (8 × `export * as <C> from "../../entities/<C>/<C>.rpc"`), not a parallel definition.
6. **14/22 entities' `rpc/http/tool` are 3-line empty shells.** The grammar's uniformity is scaffold output; content exists for 8 concepts.
7. **Server test count is 57 files, not 52** (52 `.test.ts` + 5 helper `.ts`); the scout figure is `.test.ts`-only. LOC ratio is **0.64**, not ~1:1; only **12/21** src dirs have a test twin (`entities/` with 64 files has none).
8. **Zero `Effect.Service` in the server** (55 `Context.Tag`), contradicting `40-v3-specs-corpus.md` ("RdfStore (Effect.Service over N3.Store)") and `server/AGENTS.md` (`MentionExtractor.Default`).
9. **Server root barrel omits `entities`, `Workflow`, `LlmControl`, `utils`**; they are reached through the `"./*": "./src/*.ts"` wildcard export and 35 self-alias imports. `db.ts` / `entities.ts` root shims exist only to satisfy that wildcard.
10. **`Ai/` module exists** (2 files, `PromptTemplates.ts`) and was missing from the scout's server module list; `Service/Integrations/`, `Embedding/providers/`, `Extraction/schemas/`, `db/Db/` subdirs also exist.
11. **Concept-name drift across tiers**: `GraphRag` (domain, 12 files) vs `GraphRAG` (server, 18 files); domain folder `Agent/` holding `KnowledgeAgent.*` files, aliased `export * as KnowledgeAgent`, server folder `KnowledgeAgent/`; `Batch` folder vs `BatchExecution{Model,Id}` vs `batch-execution.table.ts`.
12. **`projections/` is not in the domain root barrel** (5 namespaces exported, projections reached only by subpath).
13. **`$I` in knowledge alone = 216 files** (146 domain + 70 server, 0 tables); the scout's 471 was iam+knowledge combined. In the domain it is a *role* law (100% in schema roles, 0% in `.entity/.http/.rpc/.tool`), not a per-file law.
14. **Tables `_check.ts` is partial** (12/19 models) and unreferenced by any `.ts`; scout listed it as part of the grammar without noting it is dead-ish.
15. **Server per-module barrel style is the least uniform convention in the slice** (12 `* from` / 5 `export {` / 4 `* as`), whereas the scout aggregated barrel counts slice-wide, hiding the per-module split.
