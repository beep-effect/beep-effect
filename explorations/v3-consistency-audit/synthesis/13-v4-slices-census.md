# 13 — v4 slice conformance census (actual packages vs doctrine vocabulary)

> **Post-verification note (2026-08-30):** first-pass counts; `21`/`23` supersede: tier-correct suffixes 331 → **335/432** (four valid `.<port-name>.ts` implementations), `$I` files 380 → **379**; 169 `*.test.{ts,tsx}` files (171 TypeScript files under `test/` incl. 2 helpers).

Measured 2026-08-29 against `~/YeeBois/projects/beep-effect7` at `3435c24f94`.
All commands ran from `~/YeeBois/projects/beep-effect7/packages` with
`node_modules`, `coverage`, `dist` excluded. Read-only; no package scripts run.
Doctrine source: `standards/ARCHITECTURE.md` (Canonical Concept Topology
L827-950, Domain-Kind Folders L954, Role Suffixes L969-1129) and
`standards/architecture/DECISIONS.md` (2026-04-21 "Use Concept-Qualified Role
Suffixes").

## TL;DR

1. 948 src files across 40 slice packages: 327 `index.ts`, 189 single-segment (no role), 432 role-suffixed. Of the 432, **331 (77%) use a suffix in the doctrine vocabulary for their tier, 101 do not**; 67 distinct suffixes exist, 43 of them singletons.
2. The folder grammar `<Concept>/<Concept>.<role>.ts` is the strongest real convention: 403/432 suffixed files (93%) sit in a folder named after their prefix, and 253/254 PascalCase concept folders carry an `index.ts`. The 29 mismatches cluster in four packages (`law-practice/server` root `PracticeKg.*`, `agents/client` root files, `documents/server` sub-concept files, `workspace/server` sub-concept files).
3. Domain-kind folders (`aggregates|entities|values`) are uniform in `domain` (8/8) and `tables` (7/7) but 50/50 elsewhere: `use-cases` 5/8, `server` 4/7, `client` 2/4, `ui` 2/3, `config` 1/3. Epistemic and law-practice use bare `<Concept>/` in every non-domain tier.
4. The biggest off-doctrine but habitual convention is `<Concept>.converters.ts` in tables (25 files, 5/7 tables packages) — larger than most doctrine roles. Contested roles: `.ports` (12) vs `.repository` (7) for use-case ports, `.service` (14) vs `.use-cases` (4) for the facade, `-handlers` (2) vs bare `.http/.rpc/.tools` (3) in server; `tables.ts`/`Tables.ts`/`Schema.ts` split 3/1/3; config composers are lowercase `layer.ts/public.ts/...` 3/3 vs doctrine PascalCase 0/3.
5. Enforcement is absent for all of the above: `beep architecture check` validates an operation-plan JSON (`Architecture.command.ts:187-194`), the only PascalCase-filename lint is scoped to tooling CLI files (`Lint.command.ts:275-283`), and `Architecture/internal/AcceptedProofManifest.ts` hard-codes the off-vocabulary names (`WorkItem.repository.ts`, `WorkItem.use-cases.ts`, `WorkItem.http.ts`, `.rpc.ts`, `.tools.ts`, `.client.ts`, `.view-model.ts`) as the accepted proof.

## 1. Slice × tier census

Legend for "src dirs": **DK** = doctrine domain-kind folders (`aggregates|entities|values`), **bare** = PascalCase `<Concept>/` directly under `src/`, **lower** = lowercase topical folder, **flat** = no folders. "Same-name" = suffixed files whose prefix equals the parent folder. "IN/OFF" = role suffix in / not in that tier's doctrine vocabulary. "Single" = non-`index.ts` files with no role suffix.

| Package | src | test | src dirs (first level) | Same-name / suffixed | IN / OFF | Single | index.ts | Root files present |
|---|---|---|---|---|---|---|---|---|
| agents/client | 7 | 6 | `internal` (lower); **flat** concept files | 0 / 4 | 4 / 0 | 2 | 1 | `Chat.atoms.ts Chat.layer.ts ClientObservability.ts ProviderInstance.atoms.ts ProviderInstance.service.ts index.ts` |
| agents/domain | 16 | 2 | `entities values` (DK) | 8 / 9 | 9 / 0 | 0 | 7 | `index.ts` |
| agents/server | 11 | 6 | `AssistantTurn ProviderInstance` (bare) | 3 / 3 | 2 / 1 | 5 | 3 | `index.ts test.ts` — **no Layer.ts** |
| agents/tables | 6 | 1 | `entities` (DK) | 2 / 2 | 1 / 1 | 1 | 3 | `index.ts tables.ts` |
| agents/use-cases | 31 | 5 | `entities` (DK) + `processes` (lower, not in doctrine) | 21 / 21 | 11 / 10 | 6 | 4 | `index.ts public.ts server.ts test.ts proof.ts` |
| architecture-lab/client | 3 | 1 | `aggregates` (DK) | 1 / 1 | 0 / 1 | 0 | 2 | `index.ts` |
| architecture-lab/config | 9 | 1 | `aggregates` (DK) | 2 / 2 | 1 / 1 | 5 | 2 | `index.ts layer.ts public.ts secrets.ts server.ts test.ts` |
| architecture-lab/domain | 15 | 4 | `aggregates entities values` (DK) | 8 / 8 | 8 / 0 | 0 | 7 | `index.ts` |
| architecture-lab/server | 13 | 3 | `aggregates entities` (DK) | 7 / 7 | 4 / 3 | 2 | 4 | `Layer.ts index.ts test.ts` |
| architecture-lab/tables | 7 | 2 | `aggregates entities` (DK) | 2 / 2 | 2 / 0 | 1 | 4 | `index.ts tables.ts` |
| architecture-lab/ui | 3 | 1 | `aggregates` (DK) | 1 / 1 | 0 / 1 | 0 | 2 | `index.ts` |
| architecture-lab/use-cases | 18 | 4 | `aggregates entities` (DK) | 10 / 10 | 6 / 4 | 4 | 4 | `index.ts public.ts server.ts` — no test.ts |
| documents/domain | 26 | 7 | `aggregates entities values` (DK) | 14 / 14 | 12 / 2 | 0 | 12 | `index.ts` |
| documents/server | 28 | 11 | `aggregates entities` (DK) + `entities/internal` | 8 / 12 | 8 / 4 | 8 | 8 | `Layer.ts index.ts test.ts` |
| documents/tables | 15 | 4 | `entities` (DK) | 8 / 8 | 4 / 4 | 1 | 6 | `index.ts tables.ts` |
| documents/use-cases | 27 | 8 | `aggregates entities` (DK) | 8 / 8 | 4 / 4 | 12 | 7 | `index.ts public.ts server.ts` |
| epistemic/client | 4 | 2 | `ContradictionTriage` (bare) | 1 / 1 | 1 / 0 | 1 | 2 | `index.ts Protocol.ts` |
| epistemic/config | 9 | 1 | **flat** | 0 / 0 | 0 / 0 | 8 | 1 | `Audience.ts ServerConfig.ts TestLayer.ts index.ts layer.ts public.ts secrets.ts server.ts test.ts` |
| epistemic/domain | 55 | 7 | `entities values` (DK) + `values/internal` | 26 / 28 | 28 / 0 | 1 | 26 | `index.ts` |
| epistemic/server | 23 | 14 | 7 bare: `ClaimDisposition ContradictionTriage EdgeAuthority ExecutionLedger GovernedEgress GovernedTierGate ShaclValidation` | 13 / 14 | 12 / 2 | 1 | 8 | `Layer.ts index.ts` — no test.ts |
| epistemic/tables | 28 | 4 | `entities values` (DK) | 16 / 16 | 8 / 8 | 1 | 11 | `Schema.ts index.ts` |
| epistemic/ui | 5 | 3 | `ContradictionTriage` (bare) | 0 / 0 | 0 / 0 | 3 | 2 | `index.ts` |
| epistemic/use-cases | 28 | 7 | 7 bare: `ClaimDisposition ClaimGate ClaimLifecycle ClaimProjection ContradictionTriage EdgeAuthority ExecutionLedger` | 16 / 16 | 16 / 0 | 4 | 8 | `index.ts public.ts server.ts` |
| law-practice/domain | 214 | 3 | `entities values` (DK) + `internal/generated/free-law-project` | 109 / 110 | 106 / 4 | 7 | 97 | `index.ts` |
| law-practice/server | 23 | 10 | 3 bare: `CandorPromotionGate CandorRecord LegalPositionRecord` + `internal` | 6 / 16 | 7 / 9 | 3 | 4 | `Layer.ts Tools.ts index.ts` + 10× `PracticeKg.*.ts` |
| law-practice/tables | 34 | 3 | `entities` (DK) | 19 / 19 | 11 / 8 | 2 | 13 | `Tables.ts ReadModels.ts index.ts` |
| law-practice/use-cases | 32 | 4 | 6 bare: `CandorPolicy CandorRecord IrToLaw LegalPositionRecord LegalPositionRelatorPolicy OfficeActionReview` + `internal` | 18 / 19 | 14 / 5 | 6 | 7 | `Tools.ts PracticeKg.tools.ts index.ts public.ts server.ts test.ts` |
| ontology/client | 4 | 11 | `aggregates` (DK) | 2 / 2 | 1 / 1 | 0 | 2 | `index.ts` |
| ontology/config | 9 | 1 | **flat** | 0 / 0 | 0 / 0 | 8 | 1 | `McpConfig.ts ServerConfig.ts TestLayer.ts index.ts layer.ts public.ts secrets.ts server.ts test.ts` |
| ontology/domain | 6 | 2 | `aggregates` (DK) | 3 / 3 | 3 / 0 | 0 | 3 | `index.ts` |
| ontology/server | 8 | 4 | `aggregates` (DK) + `tools` (lower) | 2 / 2 | 1 / 1 | 3 | 3 | `Layer.ts index.ts test.ts` |
| ontology/ui | 15 | 1 | `aggregates` (DK) + `Session/tree` (lower) | 12 / 12 | 0 / 12 | 0 | 3 | `index.ts` |
| ontology/use-cases | 23 | 8 | `aggregates` (DK) + `tools` (lower) | 13 / 13 | 5 / 8 | 7 | 3 | `index.ts public.ts server.ts worker.ts` |
| shared/domain | 105 | 9 | `aggregates entities values` (DK) + `entity identity` (lower) | 12 / 12 | 11 / 1 | 73 | 20 | `index.ts aggregates.ts entities.ts entity.ts identity.ts values.ts` |
| shared/tables | 9 | 1 | `entities` (DK) | 3 / 3 | 3 / 0 | 1 | 5 | `Schema.ts index.ts` |
| shared/use-cases | 6 | 1 | `PromotionGate` (bare) | 2 / 2 | 1 / 1 | 2 | 2 | `index.ts public.ts server.ts` |
| workspace/domain | 30 | 2 | `entities values` (DK) | 15 / 15 | 15 / 0 | 0 | 15 | `index.ts` |
| workspace/server | 12 | 4 | `aggregates` (DK) + `SourceText` (bare) | 1 / 5 | 4 / 1 | 3 | 4 | `Layer.ts index.ts test.ts` |
| workspace/tables | 19 | 1 | `entities` (DK) | 10 / 10 | 6 / 4 | 1 | 8 | `Schema.ts index.ts` |
| workspace/use-cases | 12 | 2 | `aggregates` (DK) | 1 / 2 | 2 / 0 | 7 | 3 | `index.ts public.ts server.ts` |
| **Total** | **948** | **171** | 254 PascalCase dirs, 45 DK dirs, 15 lower dirs | **403 / 432** | **331 / 101** | **189** | **327** | |

Evidence:

| path | command | result |
|---|---|---|
| `packages/{8 slices}` | `for s in …; for t in $(ls $s); find $s/$t/src -type f \( -name '*.ts' -o -name '*.tsx' \) \| wc -l; find $s/$t/test … \| wc -l` | 40 rows above; 948 src / 171 test files (169 `*.test.*` + `law-practice/server/test/fixture.ts` + `shared/domain/test/StaticProbes.ts`) |
| `packages/**/src/**` | `find … \| awk -F/ '{parent=$(NF-1); split(basename,p,"."); if(p[1]==parent) same++ …}'` | same-name 403, mismatch 29, single 189, index 327 |
| `packages/**/src/**` | awk with per-tier vocab sets from ARCHITECTURE.md L1015-1127 | IN 331 / OFF 101 |
| `packages/**/src/**` | `find … -type d \| awk '{d=$NF; PascalCase? domain-kind? lower}'` | 254 Pascal, 45 DK (entities 19, aggregates 18, values 8), lower: `internal`×6, `tools`×2, `processes`, `tree`, `identity`, `entity`, `generated`, `free-law-project` ×1 each |
| `packages/**/src/**` | `find … -type d` + `[ -f $d/index.ts ]` | PascalCase concept dirs 253/254 have index.ts (missing: `agents/use-cases/src/processes/ProfessionalRuntime`); DK dirs 29/45 |

## 2. Role suffix vocabulary conformance per tier

Doctrine vocabulary used (ARCHITECTURE.md L1015-1127): domain `.model .values .errors .behavior .policy .access .contracts .events .machine`; use-cases `.commands .queries .access .ports .service .errors .http .rpc .tools .cluster .workflows .processes .schedulers`; server `.repo .<port-name> .http-handlers .rpc-handlers .tool-handlers .event-handlers .cluster-handlers .workflow-handlers .projections .layer`; client `.command-client .query-client .service .atoms .form-model .machine .layer`; config `.config`; tables `.table .read-model-table`; ui `.form .fields .table .list .detail .admin` (tsx). The server `.<port-name>` open slot is counted as OFF below but flagged "claimable".

### 2a. Aggregate suffix distribution (all 8 slices, src only)

| suffix | count | tier(s) | doctrine status |
|---|---|---|---|
| `index.ts` | 327 | all | — |
| (single-segment, no role) | 189 | all | see §4 |
| `.model` | 148 | domain | IN |
| `.values` | 35 | domain 31, use-cases 4 | IN (domain) / OFF (use-cases: `agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.values.ts`, `law-practice/use-cases/src/{CandorPolicy,LegalPositionRecord,LegalPositionRelatorPolicy}/*.values.ts`) |
| `.table` | 32 | tables | IN |
| `.converters` | 25 | tables | **OFF** — not in ARCHITECTURE.md at all (`rg '\.converters' standards/ARCHITECTURE.md` → 0) |
| `.layer` | 22 | server 20, client 1, config 1 | IN (server/client) / OFF (config: `architecture-lab/config/src/aggregates/WorkItem/WorkItem.layer.ts`) |
| `.errors` | 21 | domain 4, use-cases 16, server 1 | IN / OFF (server: `law-practice/server/src/PracticeKg.errors.ts`) |
| `.service` | 17 | use-cases 14, client 1, server 2 | IN / OFF (server: `documents/server/src/aggregates/Document/DocumentIntake.service.ts`, `…/Sync/VaultSyncEngine.service.ts`) |
| `.repo` | 15 | server | IN |
| `.ports` | 13 | use-cases 12, server 1 | IN / OFF (server: `law-practice/server/src/CandorPromotionGate/CandorPromotionGate.ports.ts`) |
| `.behavior` | 9 | domain | IN |
| `.rpc` | 8 | use-cases 7, server 1 | IN / OFF (server: `architecture-lab/server/src/aggregates/WorkItem/WorkItem.rpc.ts`) |
| `.commands` | 8 | use-cases | IN |
| `.repository` | 7 | use-cases | **OFF** (doctrine `.ports`) |
| `.use-cases` | 4 | use-cases | **OFF** (doctrine `.service`) |
| `.atoms` | 4 | client | IN |
| `.read-model-table` | 3 | tables (law-practice) | IN |
| `.models` | 3 | domain (law-practice values) | OFF (doctrine `.model`) |
| `.config` | 3 | config 1, server 2 | IN / OFF (server: `documents/server/src/aggregates/{Sync/VaultSync,Document/FilingDecisionLlm}.config.ts`) |
| `.contracts`, `.projections`, `.queries`, `.sparql`, `.tools`, `.validation` | 2 each | mixed | `.contracts` OFF in use-cases (agents); `.projections` IN server (law-practice) / OFF use-cases (ontology); `.queries` IN use-cases / OFF server; `.tools` IN use-cases (law-practice) / OFF server (arch-lab) |
| 43 singleton suffixes | 1 each | — | e.g. `.probe .fetch .gate .file-store .fts .host .rows .emails .claims .schemas .schema .seed .projection .fields .calendar .kernel .fixture .fixtures .fixture-service .repair-errors .candidates .reader .client .view-model .visualizer .visualizer.worker .worker-protocol .reasoner .pizza-tutorial .repo.internal .tool-handlers .rpc-handlers .changelog .document .explorer .graph .inspector .metrics .source .tree .workbench .workbench.shared` |

Command: `find … \| awk '{split(basename,p,"."); suf=".".p[2..n]; c[suf]++}' \| sort -rn` → 67 distinct suffixes, 43 singletons.

### 2b. Off-vocabulary files by tier (every path)

| tier | IN | OFF | off-vocabulary paths |
|---|---|---|---|
| domain | 192 | 7 | `documents/domain/src/values/Taxonomy/Taxonomy.{seed,projection}.ts`; `law-practice/domain/src/entities/LawPracticeEntity.fields.ts`; `law-practice/domain/src/values/{Citation,CitationWarning,ComponentSpan}/*.models.ts`; `shared/domain/src/values/LocalDate/LocalDate.calendar.ts` |
| use-cases | 59 | 32 | `.repository` ×7: `agents/use-cases/src/entities/ProviderInstance/ProviderInstance.repository.ts`, `architecture-lab/use-cases/src/{aggregates/WorkItem/WorkItem,entities/Worker/Worker}.repository.ts`, `documents/use-cases/src/entities/{SyncConflict,SyncCursor,SyncItem,SyncOperation}/*.repository.ts`; `.use-cases` ×4: `agents/…/ProviderInstance.use-cases.ts`, `architecture-lab/…/{WorkItem,Worker}.use-cases.ts`, `ontology/use-cases/src/aggregates/Session/Session.use-cases.ts`; agents `processes/`: `AssistantTurn.{contracts,fixture,kernel,repair-errors}.ts`, `ProfessionalRuntime.{contracts,fixtures,fixture-service,values}.ts`; law-practice: `OfficeActionReview.candidates.ts`, `CandorRecord.reader.ts`, 3× `.values.ts`; ontology Session: `.pizza-tutorial .projections .reasoner .sparql .validation .visualizer .worker-protocol`; `shared/use-cases/src/PromotionGate/PromotionGate.schema.ts` |
| server | 38 | 21 | claimable `.<port-name>`: `agents/server/src/ProviderInstance/ProviderInstance.probe.ts`, `epistemic/server/src/GovernedEgress/GovernedEgress.fetch.ts`, `epistemic/server/src/GovernedTierGate/GovernedTierGate.gate.ts`, `ontology/server/src/aggregates/Session/Session.file-store.ts`, `law-practice/server/src/PracticeKg.{fts,host,emails}.ts`; clearly off: `architecture-lab/server/src/aggregates/WorkItem/WorkItem.{http,rpc,tools}.ts` (doctrine `-handlers`), `documents/server/src/aggregates/{Document/DocumentIntake.service,Document/FilingDecisionLlm.config,Sync/VaultSync.config,Sync/VaultSyncEngine.service}.ts`, `law-practice/server/src/PracticeKg.{rows,queries,schemas,claims,errors}.ts`, `law-practice/server/src/CandorPromotionGate/CandorPromotionGate.ports.ts`, `workspace/server/src/aggregates/Thread/ThreadStore.repo.internal.ts` |
| client | 6 | 2 | `architecture-lab/client/src/aggregates/WorkItem/WorkItem.client.ts`; `ontology/client/src/aggregates/Session/Session.visualizer.worker.ts` |
| config | 1 | 1 | `architecture-lab/config/src/aggregates/WorkItem/WorkItem.layer.ts` |
| tables | 35 | 25 | all `.converters.ts`: agents 1, documents 4, epistemic 8, law-practice 8, workspace 4 (e.g. `epistemic/tables/src/entities/Contradiction/Contradiction.converters.ts`, `law-practice/tables/src/entities/ActFrame/ActFrame.converters.ts`) |
| ui | 0 | 13 | `architecture-lab/ui/src/aggregates/WorkItem/WorkItem.view-model.ts`; `ontology/ui/src/aggregates/Session/Session.{changelog,document,explorer,graph,inspector,metrics,source,sparql,validation,workbench}.tsx`, `Session.{tree,workbench.shared}.ts`; epistemic/ui uses 3 unsuffixed `.tsx` (`ContradictionTriagePanel.tsx`, `ContradictionTriageView.tsx`, `EvidenceSourcePanel.tsx`). Doctrine `.form/.fields/.table/.list/.detail/.admin.tsx`: **0 files** (`find … -path '*/ui/src/*' -name '*.form.tsx' -o …` → 0) |

Contested-role tallies (same responsibility, two spellings):

| responsibility | spelling A | spelling B | split by slice |
|---|---|---|---|
| use-case port declaration | `.ports.ts` 12 (epistemic 5, law-practice 6, ontology 1) | `.repository.ts` 7 (agents 1, architecture-lab 2, documents 4) | 3 slices vs 3 slices |
| use-case facade | `.service.ts` 14 (agents 2, arch-lab 2, epistemic 4, law-practice 4, ontology 1, shared 1) | `.use-cases.ts` 4 (agents 1, arch-lab 2, ontology 1) | arch-lab and agents ship both |
| server protocol handlers | `.rpc-handlers.ts` 1 + `.tool-handlers.ts` 1 (epistemic, law-practice) | `.http.ts .rpc.ts .tools.ts` 3 (architecture-lab) | 2 vs 1 slices |
| domain value model | `.model.ts` 148 | `.models.ts` 3 (law-practice) | singleton drift |
| ui module | doctrine `.form/.fields/...` 0 | region grammar 12 (ontology), unsuffixed 3 (epistemic), `.view-model` 1 (arch-lab) | doctrine absent 0/13 |

## 3. Folder grammar

### 3a. Domain-kind folder usage per tier

| tier | uses `aggregates|entities|values` | bare `<Concept>/` | flat / other |
|---|---|---|---|
| domain | 8/8 (shared adds lowercase `entity/`, `identity/`; law-practice adds `internal/generated/free-law-project/`) | 0 | — |
| tables | 7/7 | 0 | — |
| use-cases | 5/8 (agents, architecture-lab, documents, ontology, workspace; agents also `processes/`) | 3/8 (epistemic 7 folders, law-practice 6, shared 1) | ontology + law-practice add `tools/`/`internal/` |
| server | 4/7 (architecture-lab, documents, ontology, workspace) | 3/7 (agents 2, epistemic 7, law-practice 3) + workspace mixes `aggregates/` with bare `SourceText/` | law-practice root `PracticeKg.*` |
| client | 2/4 (architecture-lab, ontology) | 1/4 (epistemic) | agents: flat concept files at src root |
| ui | 2/3 (architecture-lab, ontology) | 1/3 (epistemic) | — |
| config | 1/3 (architecture-lab) | 0 | epistemic, ontology flat |

Command: `find $s/$t/src -mindepth 1 -maxdepth 1 -type d` per tier (§1 table, "src dirs" column).

### 3b. Same-name folder+file mismatches (29 files)

| cluster | paths |
|---|---|
| concept-less root files (14) | `law-practice/server/src/PracticeKg.{claims,emails,errors,fts,host,projections,queries,rows,schemas,tool-handlers}.ts` (10), `law-practice/use-cases/src/PracticeKg.tools.ts`, `agents/client/src/{Chat.atoms,Chat.layer,ProviderInstance.atoms,ProviderInstance.service}.ts` (4, no concept folders exist in that package) |
| sub-concept file inside a Concept folder (11) | `documents/server/src/aggregates/Document/{DocumentIntake.service,FilingDecisionLlm.config}.ts`, `documents/server/src/aggregates/Sync/{VaultSync.config,VaultSyncEngine.service}.ts`, `workspace/server/src/aggregates/Thread/ThreadStore.repo{,.internal}.ts`, `workspace/server/src/aggregates/Workspace/WorkspaceVault.{layer,repo}.ts`, `workspace/use-cases/src/aggregates/Workspace/WorkspaceVault.rpc.ts`, `epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts`, `epistemic/domain/src/values/ClaimProjection/ClaimProjectionView.model.ts`, `epistemic/server/src/ShaclValidation/BoundedShaclValidator.layer.ts` |
| suffixed file directly under a domain-kind folder (2) | `agents/domain/src/entities/Fixture.values.ts`, `law-practice/domain/src/entities/LawPracticeEntity.fields.ts` |

Command: `find … \| awk '{if(p[1]!=parent) print}'` → 29 lines.

## 4. Single-segment files (189, no role suffix)

| cluster | count | examples |
|---|---|---|
| boundary/composer roots (`public.ts server.ts test.ts worker.ts proof.ts Layer.ts Tools.ts tables.ts Tables.ts ReadModels.ts Schema.ts layer.ts secrets.ts`, config `Audience.ts ServerConfig.ts TestLayer.ts McpConfig.ts`, shared `aggregates.ts entities.ts entity.ts identity.ts values.ts`) | 67 | `agents/use-cases/src/proof.ts`, `ontology/use-cases/src/worker.ts`, `law-practice/server/src/Tools.ts` |
| per-concept `server.ts` (+ `ontology/use-cases/src/aggregates/Session/worker.ts`) inside use-cases concept folders | 15 | `documents/use-cases/src/entities/SyncItem/server.ts`, `epistemic/use-cases/src/ContradictionTriage/server.ts` |
| `shared/domain` identity + entity kernel | 68 | `shared/domain/src/identity/LawPractice/MatterId.ts` (57 `*Id.ts`), `shared/domain/src/entity/{AuditEntity,BaseEntity,EntityId,EntityKit,EntityRef,OrgEntity,primitives,Principal,ProductEntity,PublicEntityId,SourceKind}.ts` (11) |
| unsuffixed concept modules (PascalCase, single concept, no role) | 27 | `agents/server/src/AssistantTurn/{AnthropicTurnCodec,AnthropicTurnKernel,BlockRepair,ScanState}.ts`, `documents/server/src/aggregates/Document/{FilingDecisionHeuristic,FilingDecisionLlm,FilingTextExtraction}.ts`, `documents/server/src/aggregates/Sync/{DmsMirrorBox,DmsMirrorFixture}.ts`, `documents/use-cases/src/aggregates/{Document/DocumentIntake,Document/FilingDecision,Sync/DmsMirror,Sync/VaultSyncEngine}.ts`, `epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts`, `epistemic/ui/src/ContradictionTriage/*.tsx` (3), `epistemic/client/src/Protocol.ts`, `agents/client/src/ClientObservability.ts`, `law-practice/use-cases/src/OfficeActionReview/OfficeActionExtractionLabel.ts`, `ontology/server/src/tools/OntologyToolHandlers.ts`, `ontology/use-cases/src/tools/{OntologyToolkit,OntologyToolService}.ts`, `workspace/server/src/SourceText/WorkspaceSourceTextResolver.ts`, `workspace/use-cases/src/aggregates/Thread/{ThreadStore,ThreadTimeline}.ts`, `workspace/use-cases/src/aggregates/Workspace/WorkspaceVault.ts` |
| `internal/` helpers | 5 | `agents/client/src/internal/BrowserHttpUrl.ts`, `documents/server/src/entities/internal/RepoSupport.ts`, `law-practice/server/src/internal/RepoSupport.ts`, `law-practice/use-cases/src/internal/spikeEntity.ts` (camelCase), `epistemic/domain/src/values/internal/CanonicalJson.ts` |
| generated kebab-case | 7 | `law-practice/domain/src/internal/generated/free-law-project/{case-name-abbreviations,courts,journals,laws,regexes,reporters,state-abbreviations}.ts` |

Command: `find … \| awk '{if(f!="index" && index(f,".")==0) print}'` → 189 lines.

## 5. Root files vs doctrine-expected composers

| composer (doctrine) | expected in | present | absent / variant |
|---|---|---|---|
| `use-cases/src/public.ts` | 8 | 8/8 | `law-practice/use-cases/src/public.ts` is literally `export {};` |
| `use-cases/src/server.ts` | 8 | 8/8 | — |
| `use-cases/src/test.ts` | 8 | 2/8 (agents, law-practice) | 6 absent |
| `server/src/Layer.ts` | 7 | 6/7 | `agents/server` has none |
| `server/src/test.ts` | 7 | 5/7 | epistemic, law-practice absent |
| `Api.ts` / `Rpc.ts` / `Events.ts` / `Cluster.ts` (use-cases or server) | 15 | 0 | — |
| `Tools.ts` | 15 | 2 (`law-practice/server/src/Tools.ts`, `law-practice/use-cases/src/Tools.ts`) | — |
| `tables/src/Tables.ts` | 7 | 1/7 (law-practice) | `tables.ts` lowercase ×3 (agents, architecture-lab, documents); `Schema.ts` ×3 (epistemic, shared, workspace) |
| `tables/src/ReadModels.ts` | 7 | 1/7 (law-practice) | — |
| `config/src/{Config,PublicConfig,Secrets,Layer}.ts` | 3 | 0/3 | all three use lowercase subpath-named `layer.ts public.ts secrets.ts server.ts test.ts` |
| `config/src/{ServerConfig,TestLayer}.ts` | 3 | 2/3 (epistemic, ontology) | architecture-lab absent |
| `export const VERSION` in tier `index.ts` (create-package residue, not doctrine) | — | 27/40 | — |

Command: `find … -maxdepth 3 -name 'Api.ts' -o -name 'Rpc.ts' -o -name 'Tools.ts' -o -name 'Events.ts' -o -name 'Cluster.ts'` → 2; `ls */config/src`; `grep -l 'export const VERSION' */*/src/index.ts \| wc -l` → 27.

## 6. Barrel style and completeness

### 6a. Style counts (src, per package)

| package | `export * as` | `export * from` | `export {…} from` | dominant |
|---|---|---|---|---|
| agents/client | 0 | 4 | 2 | star-from |
| agents/domain | 2 | 15 | 0 | star-from (+ namespaced kinds) |
| agents/server | 2 | 7 | 0 | star-from |
| agents/tables | 2 | 3 | 0 | mixed |
| agents/use-cases | 2 | 26 | 3 | star-from |
| architecture-lab/client | 1 | 1 | 0 | mixed |
| architecture-lab/config | 0 | 2 | 6 | named |
| architecture-lab/domain | 9 | 8 | 0 | namespaced |
| architecture-lab/server | 3 | 8 | 0 | star-from |
| architecture-lab/tables | 3 | 3 | 0 | mixed |
| architecture-lab/ui | 1 | 1 | 0 | mixed |
| architecture-lab/use-cases | 5 | 11 | 2 | star-from |
| documents/domain | 11 | 16 | 0 | mixed |
| documents/server | 4 | 20 | 4 | star-from |
| documents/tables | 5 | 9 | 0 | star-from |
| documents/use-cases | 8 | 21 | 5 | star-from |
| epistemic/client | 0 | 3 | 0 | star-from |
| epistemic/config | 0 | 1 | 4 | named |
| epistemic/domain | 0 | 54 | 0 | star-from only |
| epistemic/server | 0 | 18 | 4 | star-from |
| epistemic/tables | 10 | 16 | 1 | mixed |
| epistemic/ui | 0 | 4 | 0 | star-from |
| epistemic/use-cases | 8 | 21 | 2 | star-from |
| law-practice/domain | 1 | 205 | 0 | star-from only |
| law-practice/server | 0 | 16 | 2 | star-from |
| law-practice/tables | 11 | 22 | 1 | star-from |
| law-practice/use-cases | 2 | 21 | 3 | star-from |
| ontology/client | 0 | 2 | 0 | star-from |
| ontology/config | 0 | 1 | 5 | named |
| ontology/domain | 3 | 4 | 0 | mixed |
| ontology/server | 1 | 4 | 2 | star-from |
| ontology/ui | 0 | 1 | 13 | named |
| ontology/use-cases | 3 | 25 | 1 | star-from |
| shared/domain | 34 | 74 | 0 | mixed (namespaced kinds) |
| shared/tables | 4 | 3 | 0 | namespaced |
| shared/use-cases | 0 | 4 | 0 | star-from |
| workspace/domain | 2 | 29 | 0 | star-from |
| workspace/server | 3 | 6 | 0 | star-from |
| workspace/tables | 7 | 10 | 1 | star-from |
| workspace/use-cases | 4 | 10 | 0 | star-from |
| **Total** | **151** | **709** | **46** single-line (72 `export {` lines incl. multi-line) | star-from 30/40 |

Command: `find … \| xargs grep -h '^export \* as ' \| wc -l` etc.

### 6b. Domain root `index.ts` grammar — four shapes across 8 slices

| shape | slices | example |
|---|---|---|
| namespaced kinds **and** flat re-export of the same kinds | agents, workspace | `export * as Entities from "./entities/index.ts"; export * from "./entities/index.ts";` |
| namespaced only (`Aggregates`, `Entities`, `Values`, plus per-concept namespaces) | architecture-lab, shared | `export * as WorkItem from "./aggregates/WorkItem/index.ts"` |
| flat `export * from` kinds only | epistemic, law-practice | `export * from "./entities/index.ts"; export * from "./values/index.ts";` |
| mixed (flat concept + namespaced kinds) | documents, ontology | documents: `export * from "./aggregates/Document/index.ts"; export * as Aggregates …` |

### 6c. Tier root index completeness (concept folders reachable from `src/index.ts`, directly or through `public.ts`)

| package | concept folders | re-exported from root index (or public.ts for use-cases) | not reachable from root barrel |
|---|---|---|---|
| use-cases (8/8) | — | root `index.ts` is exactly `export * from "./public.ts"` in 8/8 | `server.ts` is intentionally excluded everywhere |
| agents/use-cases | 4 | 4 via public.ts | — |
| architecture-lab/use-cases | 2 | 2 | — |
| documents/use-cases | 6 | 2 via public.ts (Document, Sync); 6 via server.ts | SyncConflict/SyncCursor/SyncItem/SyncOperation are server-only (`*.repository.ts` + `server.ts`) |
| epistemic/use-cases | 7 | 2 via public.ts (ClaimProjection, ContradictionTriage); 6 via server.ts | ClaimDisposition, ClaimGate, ClaimLifecycle, EdgeAuthority, ExecutionLedger client-invisible |
| law-practice/use-cases | 6 | **0 via public.ts (`export {}`)**; 2 via server.ts (IrToLaw, OfficeActionReview) | CandorPolicy, CandorRecord, LegalPositionRecord, LegalPositionRelatorPolicy reachable only via package.json subpaths |
| ontology/use-cases | 1 | 1 | `tools/` only via `./tools` subpath |
| shared/use-cases | 1 | 1 | — |
| workspace/use-cases | 2 | 2 | — |
| agents/server | 2 | 2 (`* as AssistantTurn`, `* as ProviderInstance`) | — |
| architecture-lab/server | 2 | 2 | — |
| documents/server | 6 | 2 (aggregates Document, Sync) | `entities/` (4 Sync* repos) not re-exported from root; only via `./entities/*` subpath |
| epistemic/server | 7 | 7 | — |
| law-practice/server | 3 | **0** (root exports only `Layer.ts`, `Tools.ts`, 8 of 10 `PracticeKg.*`) | CandorPromotionGate, CandorRecord, LegalPositionRecord via subpaths; `PracticeKg.emails.ts`, `PracticeKg.fts.ts` unexported |
| ontology/server | 1 + `tools/` | 1 | `tools/` via `./tools` |
| workspace/server | 3 | 3 | — |
| domain (8) | — | 8/8 root indexes reach every domain-kind folder; every `entities|aggregates|values/index.ts` re-exports every concept folder (law-practice: 19 exports / 19 concept entries) | `internal/` dirs (3) excluded by design |
| tables (7) | — | 7/7 reach `entities/` (+ `values/`); root composer (`tables.ts`/`Tables.ts`/`Schema.ts`) reachable from root in 6/7 (epistemic, workspace via named `DbSchema`; `shared/tables` omits `Schema.ts`) | — |

Concept-folder `index.ts` omissions inside concept barrels (files present but not re-exported): `agents/use-cases/…/AssistantTurn/index.ts` omits `AssistantTurn.fixture.ts`; `documents/use-cases/…/Sync/index.ts` omits `DmsMirror.ts`; `law-practice/use-cases/…/OfficeActionReview/index.ts` omits `OfficeActionReview.candidates.ts`; `ontology/client/…/Session/index.ts` omits `Session.visualizer.worker.ts`; `ontology/ui/…/Session/index.ts` omits `tree/`; `shared/domain/…/LocalDate/index.ts` omits `LocalDate.calendar.ts`; `workspace/server/…/Thread/index.ts` omits `ThreadStore.repo.internal.ts`; `workspace/use-cases/…/Thread/index.ts` omits `Thread.errors.ts`, `ThreadStore.ts`. All `*.repository.ts` / use-case `*.service.ts` / `server.ts` are routed through the sibling `server.ts` instead of `index.ts` (consistent in 6/6 packages that use the split).

Command: for every `index.ts`, `ls $(dirname)` vs `grep -E "\./<sibling>"` → 45 barrels with at least one unreferenced sibling; listed above after removing `server.ts`/`test.ts`/`internal` by-design omissions.

## 7. package.json exports grammar

| grammar | packages (N/40) | examples |
|---|---|---|
| `"./internal/*": null` | 33/40 | missing in `agents/domain`, `agents/use-cases`, `documents/tables`, `epistemic/tables`, `law-practice/domain`, `workspace/domain`, `workspace/tables` |
| explicit per-concept subpaths (`./entities/Agent`, `./aggregates/WorkItem`, `./ClaimDisposition`) | 28/40 (agents/server and ontology/ui also appear in other rows) | `epistemic/domain` lists 8 entities + 15 values individually; `law-practice/domain` 18 + 7 |
| per-kind wildcard (`./entities/*`, `./aggregates/*` → `./src/<kind>/*/index.ts`) | 7/40 | `agents/tables`, `law-practice/tables`, `documents/{domain,server,use-cases}`, `ontology/{client,ui}` |
| per-concept `…/server` boundary subpath in use-cases | 5/8 | explicit: `architecture-lab` (`./aggregates/WorkItem/server`), `workspace`, `ontology` (+`/worker`); wildcard: `documents` (`./aggregates/*/server`, `./entities/*/server`); absent: agents, epistemic, law-practice, shared |
| per-file subpaths (`./Chat.atoms`, `./AnthropicTurnCodec`, `./AssistantTurn.contracts`) | 3/40 | agents/client, agents/server, agents/use-cases only |
| root wildcard `"./*": "./src/*.ts"` (doctrine: forbidden in new work) | 2/40 | `shared/domain`, `shared/tables` |
| root-only (`"."` + internal + package.json) | 4/40 | `epistemic/client`, `epistemic/ui`, `epistemic/config`, `ontology/config` |
| use-cases `./public` + `./server` | 8/8 | `./test` only agents, law-practice (2/8); `./proof` agents only |
| config `./public ./server ./secrets ./layer ./test` | 3/3 | — |
| server `./layer` | 6/7 (agents none) | server `./test` 5/7 |
| `publishConfig.exports` mirror of `exports` | 31/40 | absent in agents/domain, agents/use-cases, epistemic/{domain,server,use-cases}, law-practice/{domain,server,use-cases}, workspace/domain (9) |

Commands: `rg -n '"\./internal/\*"' … -g package.json` → 33 files; `rg '"\./\*"'` → 2; `rg '"\./(entities|aggregates|values)/\*"'` → 7; `grep -c '"exports"' */*/package.json` → 2 in 31 files.

## 8. Tests

| convention | applied | notes |
|---|---|---|
| tests only under `<pkg>/test/`, none in `src/` | 40/40 packages, 0 src tests | `find … -path '*/src/*' -name '*.test.ts'` → 0 |
| flat `test/` (no concept mirroring) | 36/40 flat; `integration/` in 4 server packages (architecture-lab, documents, epistemic, workspace); `browser/` in ontology/client; `fixtures/` in ontology/server | no test dir mirrors `aggregates/`/`entities/` |
| test name begins with a src concept folder name | 95/169 (56%) | agents/client 0/6, ontology/client 1/11, law-practice/tables 0/3 |
| kebab-case test names | 12/169 | `agents/client/test/{run-turn-defect,run-turn-reconciliation,selected-thread-lifetime}.test.ts`, `ontology/client/test/{auto-open,failure-messages,graph-centrality,graph-labels,inspector-actions,stale-read,worker-wire,workbench-state-lifetime,browser/graph-renderer-toggle}.test.ts` |
| plain `.test.ts` | 123/169 | `.test.tsx` 3 (epistemic/ui) |
| `TaggedError.equivalence.test.ts` | 14/40 packages | agents/uc, arch-lab/{domain,uc}, documents/{domain,uc}, epistemic/{domain,uc}, law-practice/{server,uc}, ontology/{client,domain,uc}, shared/domain, workspace/uc |
| schema-parity test spelling | `SchemaParity.test.ts` 5 vs `.schema-parity.test.ts` 2 (agents) | two spellings for one role |
| driver-tagged integration tests | `.pglite.test.ts` 9 (+ `.p0.pglite`, `.restart.pglite`), `.pg.test.ts` 2, `.e2e.test.ts` 2, `.integration.test.ts` 1 | `standards/architecture/08-testing.md:223-279` shows `*.contract.ts`/`*.contract.test.ts` — **0 files** use it |
| src:test ratio by tier | domain 467:35, use-cases 177:39, server 118:51, tables 118:16, client 18:20, config 27:3, ui 23:5 | law-practice/domain 214:3 |

## 9. Identity (`const $I = …`)

| tier | files with `$I` / src |
|---|---|
| domain | 253/467 (54%) — law-practice 110/214, shared 75/105, epistemic 24/55 |
| use-cases | 84/177 (47%) |
| server | 28/118 (24%) — ontology/server 0/8 |
| tables | 2/118 (2%) — `$I` is effectively absent from tables (only architecture-lab 1/7, epistemic 1/28) |
| client | 6/18; config 5/27; ui 2/23 (ontology/ui 0/15) |
| **total** | **380/948** |

Command: `rg -l 'const \$I = ' $s/$t/src \| wc -l` per tier.

## 10. Enforcement (what actually checks any of this)

| claim | evidence | result |
|---|---|---|
| `beep architecture check` validates existing packages | `packages/tooling/tool/cli/src/commands/Architecture/Architecture.command.ts:187-194` (`checkCanonicalSliceOperationPlan(rootDir, plan)`) | No — it checks an operation-plan JSON for idempotency |
| any lint references role suffixes | `rg -l '\.model\.ts\|\.repo\.ts\|\.ports\.ts\|read-model-table' packages/tooling/tool/cli/src/commands` | only `Architecture/internal/{AcceptedProofManifest,TemplateRetarget}.ts` and `Laws/FrozenGrantSet.ts:30` (one hard-coded path) — no gate |
| filename casing gate exists | `Lint/Lint.command.ts:275-283` `pascal-case-file` | scoped to `isToolingFile` only; slices never scanned |
| CLI proof manifest agrees with doctrine | `rg -o '[A-Za-z]+\.[a-z-]+\.tsx?' Architecture/internal/AcceptedProofManifest.ts` | manifest enumerates `WorkItem.repository.ts`, `WorkItem.use-cases.ts`, `WorkItem.http.ts`, `WorkItem.rpc.ts`, `WorkItem.tools.ts`, `WorkItem.client.ts`, `WorkItem.view-model.ts`, `Worker.repository.ts`, `Worker.use-cases.ts` — the accepted proof freezes the off-vocabulary names |
| `.fallowrc.jsonc` role/casing rules | `rg -i 'suffix\|role\|PascalCase' .fallowrc.jsonc` | none (only Fallow attribution notes) |

## Uniformity ledger

Verdict scale: **uniform** ≥ 90 %, **habitual** 60-89 %, **split** 40-59 %, **absent/singleton** < 40 %.

| convention | applied N/M | verdict |
|---|---|---|
| tests live under `<pkg>/test/`, none in `src/` | 40/40 packages | uniform |
| every PascalCase concept folder has `index.ts` | 253/254 | uniform |
| suffixed file prefix == parent concept folder | 403/432 files | uniform (93%) |
| `domain` tier uses `aggregates|entities|values` | 8/8 | uniform |
| `tables` tier uses domain-kind folders | 7/7 | uniform |
| domain-kind folder `index.ts` re-exports every concept folder | domain 18/18, tables 8/9 | uniform |
| use-cases root `index.ts` = `export * from "./public.ts"` | 8/8 | uniform |
| use-cases `public.ts` + `server.ts` present | 8/8 | uniform (but law-practice public is `export {}`) |
| config lowercase boundary files `layer/public/secrets/server/test.ts` | 3/3 | uniform (off-doctrine casing) |
| server root `Layer.ts` | 6/7 | habitual |
| `*.table.ts` has sibling `*.converters.ts` | 25/32 files, 5/7 packages | habitual (off-doctrine) |
| role suffix is in doctrine vocabulary for its tier | 331/432 | habitual (77%) |
| `"./internal/*": null` | 33/40 | habitual |
| `publishConfig.exports` mirror | 31/40 | habitual |
| `export const VERSION` in tier index | 27/40 | habitual |
| `export * from` as dominant barrel style | 30/40 packages; 709 of 906 barrel lines | habitual |
| explicit per-concept export subpaths | 28/40 | habitual |
| server root `test.ts` | 5/7 | habitual |
| `$I` identity in domain files | 253/467 | split (54%) |
| use-cases per-concept `server.ts` split | 14/29 concept folders; 6/8 slices | split |
| use-cases tier uses domain-kind folders | 5/8 | split |
| server tier uses domain-kind folders | 4/7 | split |
| client/ui tier uses domain-kind folders | 2/4, 2/3 | split |
| use-case port role `.ports` vs `.repository` | 12 vs 7 files; 3 vs 3 slices | split |
| test name prefixed by a concept folder | 95/169 | split (56%) |
| domain root barrel grammar | 4 shapes × 2 slices each | split |
| tables root composer `tables.ts` / `Schema.ts` / `Tables.ts` | 3 / 3 / 1 of 7 | split three ways |
| server handler suffix `-handlers` vs bare | 2 vs 3 files; 2 vs 1 slices | split |
| use-cases `test.ts` | 2/8 | absent |
| `Api.ts` / `Rpc.ts` / `Events.ts` / `Cluster.ts` composers | 0/15 | absent |
| `Tools.ts` composer | 2/15 (law-practice only) | singleton |
| `ReadModels.ts` + `.read-model-table.ts` | 1/7 | singleton |
| config PascalCase composers `Config/PublicConfig/Secrets/Layer.ts` | 0/3 | absent |
| doctrine UI roles `.form/.fields/.table/.list/.detail/.admin.tsx` | 0/13 suffixed ui files | absent |
| `*.contract.test.ts` (08-testing.md) | 0/169 | absent |
| root wildcard `"./*"` export | 2/40 (shared) | singleton |
| per-file export subpaths | 3/40 (agents) | singleton |
| kebab-case test names | 12/169 (agents/client, ontology/client) | singleton cluster |
| `processes/` folder | 1/40 (agents/use-cases) | singleton |
| concept-less root role files (`PracticeKg.*`, `agents/client`) | 2/40 packages, 14 files | singleton cluster |
| `.models.ts` (vs `.model.ts`) | 3 files, 1 slice | singleton |
| singleton suffixes overall | 43 of 67 distinct suffixes | — |

## Top drift clusters (exact paths)

1. **`.converters.ts` in tables (25 files)** — `agents/tables/src/entities/ProviderInstance/ProviderInstance.converters.ts`; `documents/tables/src/entities/{SyncConflict,SyncCursor,SyncItem,SyncOperation}/*.converters.ts`; `epistemic/tables/src/entities/{CandidateClaim,ClaimDisposition,Contradiction,EdgeVersion,Evidence,EvidenceVerification,UsageRecord}/*.converters.ts` + `values/ExecutionRecord/ExecutionRecord.converters.ts`; `law-practice/tables/src/entities/{ActFrame,CandorDisposition,CorrectionDelta,IdsSubmissionFact,LegalOppositionCandidate,LegalPositionRelator,PatentCitationEvent,PowerExercise}/*.converters.ts`; `workspace/tables/src/entities/{Message,Thread,Turn,Workspace}/*.converters.ts`. Role not in doctrine; no `$I` in any of them.
2. **Port/facade spelling split in use-cases** — `.repository.ts` (7): `agents/use-cases/src/entities/ProviderInstance/ProviderInstance.repository.ts`, `architecture-lab/use-cases/src/aggregates/WorkItem/WorkItem.repository.ts`, `architecture-lab/use-cases/src/entities/Worker/Worker.repository.ts`, `documents/use-cases/src/entities/{SyncConflict,SyncCursor,SyncItem,SyncOperation}/*.repository.ts` vs `.ports.ts` (12) in epistemic/law-practice/ontology; `.use-cases.ts` (4): `agents/…/ProviderInstance.use-cases.ts`, `architecture-lab/…/{WorkItem,Worker}.use-cases.ts`, `ontology/use-cases/src/aggregates/Session/Session.use-cases.ts` vs `.service.ts` (14).
3. **Server handler suffix** — `architecture-lab/server/src/aggregates/WorkItem/WorkItem.{http,rpc,tools}.ts` vs `epistemic/server/src/ContradictionTriage/ContradictionTriage.rpc-handlers.ts`, `law-practice/server/src/PracticeKg.tool-handlers.ts`. The proof manifest (`Architecture/internal/AcceptedProofManifest.ts`) enshrines the arch-lab spelling.
4. **Concept-less root role files** — `law-practice/server/src/PracticeKg.{claims,emails,errors,fts,host,projections,queries,rows,schemas,tool-handlers}.ts` (10) + `law-practice/use-cases/src/PracticeKg.tools.ts`; `agents/client/src/{Chat.atoms,Chat.layer,ProviderInstance.atoms,ProviderInstance.service}.ts`.
5. **Sub-concept files inside a concept folder** — `documents/server/src/aggregates/Sync/{VaultSync.config,VaultSyncEngine.service,DmsMirrorBox,DmsMirrorFixture}.ts`; `documents/server/src/aggregates/Document/{DocumentIntake.service,FilingDecisionLlm.config,FilingDecisionHeuristic,FilingDecisionLlm,FilingTextExtraction}.ts`; `workspace/server/src/aggregates/Thread/ThreadStore.repo{,.internal}.ts`, `…/Workspace/WorkspaceVault.{layer,repo}.ts`; `workspace/use-cases/src/aggregates/Thread/{ThreadStore,ThreadTimeline}.ts`; `agents/server/src/AssistantTurn/{AnthropicTurnCodec,AnthropicTurnKernel,BlockRepair,ScanState}.ts`.
6. **Ontology feature-suffix grammar** — `ontology/ui/src/aggregates/Session/Session.{changelog,document,explorer,graph,inspector,metrics,source,sparql,tree,validation,workbench,workbench.shared}.*` (12) and `ontology/use-cases/src/aggregates/Session/Session.{pizza-tutorial,projections,reasoner,sparql,validation,visualizer,worker-protocol,use-cases}.ts` (8): one concept folder carrying 20 bespoke roles.
7. **Root composer casing** — `agents/tables/src/tables.ts`, `architecture-lab/tables/src/tables.ts`, `documents/tables/src/tables.ts` vs `law-practice/tables/src/Tables.ts` vs `epistemic/tables/src/Schema.ts`, `shared/tables/src/Schema.ts`, `workspace/tables/src/Schema.ts`; config `layer.ts` ×3 vs doctrine `Layer.ts`.
8. **Domain-kind folder omission outside domain/tables** — epistemic (`use-cases`, `server`, `client`, `ui` all bare), law-practice (`server`, `use-cases` bare), agents (`server` bare, `client` flat), shared/use-cases bare, workspace/server mixes `aggregates/` with `SourceText/`.
9. **Empty public boundary** — `law-practice/use-cases/src/public.ts` is `export {};` while `CandorPolicy`, `CandorRecord`, `LegalPositionRecord`, `LegalPositionRelatorPolicy` are reachable only through `package.json` subpaths; `documents/server/src/index.ts` and `law-practice/server/src/index.ts` likewise omit their concept folders.
10. **`shared/domain` unsuffixed kernel** — 68 single-segment files (`entity/*.ts` 11, `identity/**/*Id.ts` 57) plus root `aggregates.ts entities.ts entity.ts identity.ts values.ts` and the only two `"./*"` wildcard exports in the slice family.
11. **`agents/use-cases/src/processes/`** — folder outside the domain-kind table; `ProfessionalRuntime/` has 8 files and no `index.ts`; carries `.fixture .fixtures .fixture-service .kernel .repair-errors .contracts` roles.

## Surprises vs scout facts

| scout fact | measured | verdict |
|---|---|---|
| "No Api.ts/Rpc.ts/Tools.ts root files anywhere" | `Tools.ts` exists at `law-practice/server/src/Tools.ts` and `law-practice/use-cases/src/Tools.ts`; Api/Rpc/Events/Cluster 0 | **wrong for Tools.ts** |
| "use-cases public.ts/server.ts/test.ts (all slices)" | public 8/8, server 8/8, **test.ts 2/8** (agents, law-practice) | partially wrong |
| suffix distribution `.model 118, .values 20, .converters 17, .table 16, .layer 15, .errors 11, .service 10, .ports 8, .repo 7, .commands 7, .repository 6, .rpc 5` | `.model 148, .values 35, .table 32, .converters 25, .layer 22, .errors 21, .service 17, .repo 15, .ports 13, .rpc 8, .commands 8, .repository 7` | every count undercounted by 15-50%; ordering also differs (`.table` > `.converters`) |
| "659 single-segment src files" | 189 non-index single-segment; 516 if `index.ts` is counted | not reproducible on the 8 slices |
| "~30 singleton suffixes" | 43 singletons of 67 distinct | undercounted |
| barrels 120 `export * as` / 641 `export * from` / 30 `export {` | 151 / 709 / 46 single-line (72 lines starting `export {`) | undercounted |
| "Src dirs: 176 PascalCase vs 11 lowercase (entities 57, aggregates 54, values 24, internal 18 …)" | 254 PascalCase, 45 domain-kind (entities 19, aggregates 18, values 8), 15 other lowercase (internal 6) | the per-name counts do not match slice directories at all; likely counted a wider tree |
| `index.ts` 327; `$I` in 380 files | 327; 380 | confirmed exactly |
| "epistemic/{use-cases,server,client,ui}, law-practice/{server,use-cases}, agents/server, shared/use-cases use bare Concept folders" | confirmed; additionally agents/client is flat (no folders), agents/use-cases uses `processes/`, workspace/server mixes `aggregates/` and bare `SourceText/` | confirmed + extended |
| "architecture-lab diverges: WorkItem.repository.ts, .use-cases.ts, .http/.rpc/.tools, tables.ts, config layer.ts; server test flat" | confirmed; and `AcceptedProofManifest.ts` hard-codes those names, so `beep architecture` cannot flag them | confirmed + root cause located |
| "tables Tables.ts+ReadModels.ts only in law-practice" | confirmed; the other six split `tables.ts` ×3 / `Schema.ts` ×3 | confirmed + extended |
| "test naming .test.ts 126, .equivalence.test 14, .pglite.test 9" | 123 plain / 14 / 9 (+2 pglite variants); plus 5 `SchemaParity.test.ts` vs 2 `.schema-parity.test.ts` | close; spelling split not in scout |
| "No file-role/suffix/casing/barrel gate exists" | confirmed for slices; but `Lint.command.ts:275-283` has a `pascal-case-file` rule scoped to tooling CLI files only | confirmed with one scoped exception |
| "law-practice/domain: 214 src vs 3 test files" | confirmed | confirmed |
| Not in scout: `law-practice/use-cases/src/public.ts` is `export {};` | measured | new |
| Not in scout: `$I` absent from tables tier (2/118) and from ontology/server + ontology/ui (0/23) | measured | new |
| Not in scout: `08-testing.md` `.contract.test.ts` pattern has 0 real files | measured | new |
