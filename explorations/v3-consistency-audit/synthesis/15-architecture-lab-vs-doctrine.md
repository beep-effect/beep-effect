# 15 — architecture-lab vs doctrine (lab-vs-doctrine diff)

> **Post-verification note (2026-08-30):** the TL;DR's "6 non-vocabulary suffixes" parenthetical names 7: **3 tier-incorrect** (`.http`/`.rpc`/`.tools` are use-cases declaration names used in `server`) + **4 absent from every vocabulary** (`.repository`, `.use-cases`, `.client`, `.view-model`). "Nine divergences" are categories; §2 lists **14 manifest line locations** — the file-level count the first audit run must reproduce (`../MAP.md` §First Vertical Slice).

Scope: every file under `~/YeeBois/projects/beep-effect7/packages/architecture-lab/*/{src,test}`
(coverage/ excluded) diffed against `standards/ARCHITECTURE.md` (Canonical Concept Topology
L827-950, Domain-Kind Folders L954, Role Suffixes L969-1128), `standards/architecture/08-testing.md`,
`standards/architecture/DECISIONS.md`, and the `goals/canonical-slice-factory/` packet. Read-only;
all counts from `find`/`rg` at HEAD `3435c24f94`.

## TL;DR

1. The lab has 68 src files: 25 `index.ts`, 31 `<Concept>.<role>.ts`, 10 root composers, 2 per-concept `server.ts`. Of the 17 distinct role suffixes it uses, **11 are in the tier vocabulary and 6 are not** (`.repository` `.use-cases` `.http`/`.rpc`/`.tools` in server, `.client`, `.view-model`), plus 1 mis-tiered (`.layer` in config) and 1 mis-cased composer (`tables.ts`).
2. **None of the 9 divergences has a recorded decision.** `DECISIONS.md` 2026-04-21 fixed the vocabulary three weeks *before* the lab landed (`b22f7b7306` 2026-04-21 vs `b99c7b8ed5` 2026-05-12), so these are post-doctrine drift, not grandfathered legacy. The only packet cite (`SPEC.md` L170 `src/tables.ts`) is a v3 db-admin *inspection list*, not a naming decision.
3. Every divergence is a template: `AcceptedProofManifest.ts` lists all 68 lab src files as `acceptedProofFiles`; `beep architecture add concept` retargets only the concept/slice tokens (`WorkItem`→`Ticket`, verified by `architecture-operation-plan.test.ts:390`) and preserves suffixes, so each `add concept` reproduces all 9. `beep architecture check` tests plan idempotency, not doctrine.
4. In the wider repo the doctrine spelling is winning where the lab lost: `.ports.ts` 12 vs `.repository.ts` 7 in use-cases; `.rpc-handlers.ts`/`.tool-handlers.ts` 1 each vs lab's `.rpc.ts`/`.tools.ts` 1 each in server; `.http-handlers.ts` 0 vs lab `.http.ts` 1 (nobody else writes HTTP handlers yet). The lab is the sole `.client.ts`, `.view-model.ts`, config `.layer.ts`, and one of three `tables.ts`.
5. Scout facts wrong on four points: use-cases `test.ts` exists in 2/8 slices, not all; `Tools.ts` composers exist (law-practice use-cases + server); `.repo.ts` is 15 not 7 and `.ports.ts` 13 not 8; and the SPEC's own "protocol stage" asked for use-cases `.http/.rpc/.tools` declarations *plus* server handler modules *plus* composers — the lab shipped only the handler half, under the declaration names.

## 1. Lab census

| Measure | Command | Result |
|---|---|---|
| src files | `find packages/architecture-lab/*/src -type f \| wc -l` | 68 |
| `index.ts` barrels | `find packages/architecture-lab/*/src -name index.ts \| wc -l` | 25 |
| `<Concept>.<role>.ts` | `find ... -regex '.*/[A-Z][A-Za-z]*\.[a-z-]+\.ts' \| wc -l` | 31 |
| root composers (`src/*.ts` non-index) | `find packages/architecture-lab/*/src -maxdepth 1 -type f -not -name index.ts \| wc -l` | 10 |
| other | remainder | 2 (`use-cases/src/{aggregates/WorkItem,entities/Worker}/server.ts`) |
| test files (excluding `.gitkeep`) | `find packages/architecture-lab/*/test -type f -not -name .gitkeep \| wc -l` | 16 |

Suffix histogram (31 role files): `.model` 3, `.layer` 3, `.errors` 3, `.values` 2, `.use-cases` 2, `.table` 2, `.service` 2, `.repo` 2, `.repository` 2, `.commands` 2, `.behavior` 2, `.view-model` 1, `.tools` 1, `.rpc` 1, `.http` 1, `.config` 1, `.client` 1.

## 2. File-by-file verdict table

Legend — **conforms**: name in tier vocabulary (ARCHITECTURE.md L1012-1128) or Canonical Concept
Topology (L827-950) or a sanctioned subpath entry; **divergent-undecided**: not in vocabulary and
no decision found in `DECISIONS.md` or the packet; **divergent-decided-with-cite**: none found.
Consequence column: `T` = file is an `acceptedProofFiles` template (`AcceptedProofManifest.ts` line
given), so `beep architecture add concept` reproduces it per concept.

### domain (`~/…/packages/architecture-lab/domain`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.model.ts` | `.model.ts` (L1016) | conforms | T L159 |
| `src/aggregates/WorkItem/WorkItem.errors.ts` | `.errors.ts` (L1018) | conforms | T L153 |
| `src/aggregates/WorkItem/WorkItem.values.ts` | `.values.ts` (L1017) | conforms | T L165 |
| `src/entities/Worker/Worker.model.ts` | `.model.ts` | conforms | T L189 |
| `src/entities/Worker/Worker.values.ts` | `.values.ts` | conforms | T L195 |
| `src/entities/Worker/Worker.behavior.ts` | `.behavior.ts` (L1019) | conforms | T L201 |
| `src/values/WorkPriority/WorkPriority.model.ts` | `.model.ts` | conforms | T L225 |
| `src/values/WorkPriority/WorkPriority.behavior.ts` | `.behavior.ts` | conforms | T L231 |
| `src/{index,aggregates/index,entities/index,values/index}.ts`, concept `index.ts` ×3 | barrels (topology L836) | conforms | T |
| `test/{WorkItem,Worker,WorkPriority}.test.ts`, `test/TaggedError.equivalence.test.ts` | no test-name doctrine; flat `test/` per 08-testing examples | conforms (by absence) | T L171/207/237/243 |

Domain: 8/8 role files conform; `aggregates/ entities/ values/` folders match Domain-Kind Folders L954.

### use-cases (`~/…/packages/architecture-lab/use-cases`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.commands.ts` | `.commands.ts` (L1033) | conforms | T L281 |
| `src/aggregates/WorkItem/WorkItem.errors.ts` | `.errors.ts` (L1038) | conforms | T L287 |
| `src/aggregates/WorkItem/WorkItem.repository.ts` — header: "WorkItem repository port"; exports `WorkItemRepository` Context tag + `WorkItemRepositoryNotFound/Conflict` errors | `WorkItem.ports.ts` (L1036 "Product ports needed by use-cases"). `.<port-name>.ts` exists only in the **server** vocabulary (L1100, "Product port implementation named after the port") — it is not a use-cases spelling. | **divergent-undecided** | T L293 |
| `src/aggregates/WorkItem/WorkItem.use-cases.ts` — header: "WorkItem use-case service"; exports `WorkItemUseCasesShape` + `WorkItemUseCases` Context tag (the contract) | `WorkItem.service.ts` (L1037 "Application service contract/orchestration facade"). `.use-cases.ts` is not in any vocabulary. | **divergent-undecided** | T L299 |
| `src/aggregates/WorkItem/WorkItem.service.ts` — header: "server-side use-case implementation"; exports `makeWorkItemUseCases`, `toWorkItemActionError` | `.service.ts` — conforms as "orchestration facade", but the lab split doctrine's single `.service.ts` into contract (`.use-cases.ts`) + impl (`.service.ts`) | conforms (name) / divergent (split) | T L305 |
| `src/aggregates/WorkItem/server.ts` (per-concept; exported as `./aggregates/WorkItem/server`) | not in doctrine: only package-level `/public`, `/server`, `/test` subpaths exist (L400-449, L1052-1060). `rg -n 'Concept>/server\|WorkItem/server' standards/ARCHITECTURE.md standards/architecture/DECISIONS.md` → 0 hits | **divergent-undecided** | T L275 |
| `src/entities/Worker/Worker.{commands,errors,repository,use-cases,service}.ts`, `server.ts` | same as WorkItem row-for-row | same verdicts | T L335-365 |
| `src/public.ts`, `src/server.ts` | `/public`, `/server` subpath entries (L408-412) | conforms | T L257/263 |
| (absent) `src/test.ts` | `/test` "required name when that role exists" (L444) | conforms (no fixtures exported) | — |
| (absent) `Api.ts`, `Rpc.ts`, `Tools.ts` | topology L860-863; "vocabulary, not a requirement" (L949) | conforms by absence — but see §5 SPEC protocol-stage gap | — |
| (absent) `WorkItem.http.ts`, `.rpc.ts`, `.tools.ts` (driver-neutral declarations, L1039-1041; DECISIONS 2026-04-21 "Put Protocol Declarations In use-cases") | expected here per SPEC.md L113-116 | **absent — declarations were written as server handlers instead** | — |
| `test/{WorkItem,Worker}.test.ts`, `test/SchemaParity.test.ts`, `test/TaggedError.equivalence.test.ts` | flat `test/` | conforms (by absence) | T L311-377 |

### config (`~/…/packages/architecture-lab/config`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.config.ts` | `.config.ts` (L1074) | conforms | T L525 |
| `src/aggregates/WorkItem/WorkItem.layer.ts` (217 lines: `WorkItemConfig` tag, `ArchitectureLabConfigLive/Test`) | Config vocabulary (L1072-1081) has **no** concept-level `.layer.ts`; only package-level `Layer.ts`/`TestLayer.ts`. `.layer.ts` is server/client vocabulary. | **divergent-undecided** (mis-tiered role) | T L531 |
| `src/public.ts`, `src/server.ts`, `src/secrets.ts`, `src/layer.ts`, `src/test.ts` (all re-export shims of the concept folder) | Composers `PublicConfig.ts`, `ServerConfig.ts`, `Secrets.ts`, `Layer.ts`, `TestLayer.ts` (L1000-1010, L1075-1080) mapped to subpaths `/public /server /secrets /layer /test` (L1083-1089). Doctrine names the *files* PascalCase and the *subpaths* lowercase; the lab named the files after the subpaths. | **divergent-undecided** (casing/composer naming) | T L489-513 |
| `test/WorkItemConfig.test.ts` | — | conforms | T L537 |

### server (`~/…/packages/architecture-lab/server`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.repo.ts`, `src/entities/Worker/Worker.repo.ts` | `.repo.ts` (L1099) | conforms | T L415/469 |
| `src/aggregates/WorkItem/WorkItem.layer.ts`, `Worker.layer.ts` | `.layer.ts` (L1108) | conforms | T L409/463 |
| `src/aggregates/WorkItem/WorkItem.http.ts` — header "WorkItem HTTP handlers"; exports `WorkItemHttpStatus`, `makeWorkItemHttpHandlers` | `WorkItem.http-handlers.ts` (L1101). `.http.ts` is the **use-cases** declaration role (L1039). | **divergent-undecided** (declaration suffix on a handler file) | T L433 |
| `src/aggregates/WorkItem/WorkItem.rpc.ts` — header "WorkItem RPC handlers"; `makeWorkItemRpcHandlers` | `WorkItem.rpc-handlers.ts` (L1102) | **divergent-undecided** | T L439 |
| `src/aggregates/WorkItem/WorkItem.tools.ts` — header "WorkItem tool handlers"; `makeWorkItemToolHandlers` | `WorkItem.tool-handlers.ts` (L1103) | **divergent-undecided** | T L445 |
| `src/Layer.ts` | `Layer.ts` (L903) | conforms | T L391 |
| `src/test.ts` | not in ARCHITECTURE.md composer list, but `08-testing.md` L293-294 names `@beep/<slice>-server/test` as the slice test Layer surface | conforms (decided: 08-testing.md) | T L397 |
| `test/WorkItemServer.test.ts`, `test/WorkerServer.test.ts`, `test/integration/WorkItemDrizzleRepository.pglite.test.ts` | `08-testing.md` L340 cites `server/test/integration/<X>.pg.test.ts`; no mirroring rule exists | conforms | T L421/427/475 |

### tables (`~/…/packages/architecture-lab/tables`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.table.ts`, `src/entities/Worker/Worker.table.ts` | `.table.ts` (L1126) | conforms | T L563/587 |
| `src/tables.ts` (exports `DbSchema`) + `./tables` subpath | `Tables.ts` (L907, L1008, L1126) | **divergent-undecided** — `SPEC.md` L170 and `ops/manifest.json` L36 mention `src/tables.ts` only as v3 `_internal/db-admin` files to *inspect* ("Inspect these files before designing"), not as a naming decision | T L551 |
| `test/{WorkItem,Worker}Table.test.ts` | — | conforms | T L569/593 |

### client (`~/…/packages/architecture-lab/client`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.client.ts` — "client facade for command/query transport adapters"; exports `WorkItemClientTransport` Context tag + facade | `.command-client.ts` / `.query-client.ts` (adapters, L1114-1115) and/or `.service.ts` (facade, L1116). `.client.ts` is only a `foundation/capability` anchor (L691), never a slice-client role. | **divergent-undecided** | T L613 |
| `test/WorkItemClient.test.ts` | — | conforms | T L619 |

### ui (`~/…/packages/architecture-lab/ui`)

| File | Doctrine-expected | Verdict | Consequence |
|---|---|---|---|
| `src/aggregates/WorkItem/WorkItem.view-model.ts` — "UI read models"; pure `S.Class` schemas + `LiteralKit`, no React | UI vocabulary is `.form/.fields/.table/.list/.detail/.admin.tsx` only (L1127). `rg -n -i 'view-model' standards/ARCHITECTURE.md` → 0. A `.ts` read-model has no UI slot; nearest doctrine homes are client `.form-model.ts`/`.atoms.ts` (L1118-1119). | **divergent-undecided** | T L639 |
| `test/WorkItemViewModel.test.ts` | — | conforms | T L645 |

## 3. Which spelling is winning in practice (all 8 slices, `src/` only)

Command shape: `find packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,shared,workspace}/<tier>/src -name '*.<suffix>.ts' | wc -l`.

| Suffix | domain | use-cases | config | server | client | ui | Lab's pick | Doctrine's pick | Who wins |
|---|---|---|---|---|---|---|---|---|---|
| `.repository.ts` | 0 | **7** (agents 1, lab 2, documents 4) | 0 | 0 | 0 | 0 | use-cases | — | doctrine (`.ports`) 12:7 |
| `.ports.ts` | 0 | **12** (epistemic 5, law-practice 6, ontology 1) | 0 | 1 (law-practice `CandorPromotionGate.ports.ts`, server-side seam) | 0 | 0 | — | use-cases | |
| `.repo.ts` | 0 | 0 | 0 | **15** (7 slices) | 0 | 0 | server | server | conforms, uniform 15/15 |
| `.use-cases.ts` | 0 | **4** (agents 1, lab 2, ontology 1) | 0 | 0 | 0 | 0 | use-cases | — (`.service`) | no doctrine spelling for "contract vs impl" split; 4 files, 3 slices |
| `.service.ts` | 0 | 14 | 0 | 2 | 1 | 0 | both tiers | use-cases + client | |
| `.http.ts` | 0 | 0 | 0 | **1** (lab) | 0 | 0 | server | use-cases | lab is the only HTTP file in any slice; wrong tier |
| `.http-handlers.ts` | 0 | 0 | 0 | **0** | 0 | 0 | — | server | nobody |
| `.rpc.ts` | 0 | **7** (declarations — conform) | 0 | **1** (lab) | 0 | 0 | server | use-cases | doctrine 7:0 in use-cases; lab alone mis-tiers |
| `.rpc-handlers.ts` | 0 | 0 | 0 | **1** (epistemic) | 0 | 0 | — | server | doctrine 1 : lab `.rpc` 1 |
| `.tools.ts` | 0 | 1 (law-practice `PracticeKg.tools.ts`, conforms) | 0 | **1** (lab) | 0 | 0 | server | use-cases | |
| `.tool-handlers.ts` | 0 | 0 | 0 | **1** (law-practice) | 0 | 0 | — | server | doctrine 1 : lab `.tools` 1 |
| `.layer.ts` | 0 | 0 | **1** (lab) | 20 | 1 | 0 | config+server | server/client | config `.layer` is lab-only |
| `.client.ts` | 0 | 0 | 0 | 0 | **1** (lab) | 0 | client | — | lab-only |
| `.command-client.ts` / `.query-client.ts` | 0 | 0 | 0 | 0 | **0 / 0** | 0 | — | client | nobody |
| `.view-model.ts` | 0 | 0 | 0 | 0 | 0 | **1** (lab) | ui | — | lab-only; epistemic ui uses `<Name>.tsx` components |

Root composers (`ls packages/<slice>/<tier>/src`):

| Composer | Where | Count | Notes |
|---|---|---|---|
| `tables/src/tables.ts` | agents, architecture-lab, documents | 3 | lowercase, `./tables` subpath |
| `tables/src/Tables.ts` (+`ReadModels.ts`) | law-practice | 1 | doctrine spelling |
| `tables/src/Schema.ts` | epistemic, shared, workspace | 3 | third spelling, not in doctrine |
| `server/src/Layer.ts` | 6/7 server pkgs (agents lacks) | 6 | doctrine spelling; `./layer` subpath maps to `Layer.ts` — proves lowercase subpath + PascalCase file is already normal |
| `server/src/test.ts` | 5/7 | 5 | sanctioned by 08-testing.md |
| `config/src/{public,server,secrets,layer,test}.ts` | all 3 config pkgs | 3/3 | epistemic + ontology *also* have `ServerConfig.ts` + `TestLayer.ts` composers behind the shims (2/3); lab has none |
| `use-cases/src/test.ts` | agents, law-practice | 2/8 | scout claimed all |
| `use-cases/src/Tools.ts`, `server/src/Tools.ts` | law-practice | 1 each | scout claimed none |
| per-concept `use-cases/src/<kind>/<Concept>/server.ts` | agents 2, lab 2, documents 6, ontology 1, workspace 2 | 13 of ~30 concept dirs, 5/8 slices | habitual, undocumented |

Domain-kind folder usage in `use-cases/src` and `server/src`: `aggregates|entities|values|processes|tools` used by agents (entities, processes), architecture-lab, documents, ontology, workspace — 5/7; bare `<Concept>/` used by epistemic and law-practice — 2/7. `TemplateRetarget.ts` L28-30 infers the kind from `/entities/` or `/aggregates/` in the source path, so CLI output always carries the kind folder.

## 4. Propagation proof (why each divergence is a factory bug, not a one-off)

| Claim | Evidence |
|---|---|
| The lab is the oracle, not doctrine | `packages/tooling/tool/cli/test/fixtures/architecture-operation-plan/accepted-work-item-manifest.json` L3: `"acceptedOracle": "live architecture-lab WorkItem proof"`, `includedSurfaces` = `packages/architecture-lab/*/src/**` |
| Every lab src file is a template | `rg -n 'path: "' .../Architecture/internal/AcceptedProofManifest.ts` → 119 entries; the 9 divergent files at L275, L293, L299, L335, L353, L359, L433, L439, L445, L507, L531, L551, L613, L639 |
| `add concept` flows through the manifest | `Architecture.command.ts` L228-238 `addConceptCommand` → `makePlanFromCommand` → `Architecture.plan.ts` L22/L127/L193 `acceptedProofFiles` |
| Retarget preserves the suffix | `TemplateRetarget.ts` L20-30, L115-135: only `WorkItem`/`Worker`/`architecture-lab` tokens are substituted; `architecture-operation-plan.test.ts:390` expects `packages/research-lab/domain/src/aggregates/Ticket/Ticket.model.ts` |
| `check` is not a doctrine gate | `Architecture.command.ts` check validates operation-plan idempotency; scout's lint inventory confirms no file-role/suffix/casing gate exists (`ls .../commands/Lint/` — none named role/suffix/topology except `schema-topology` scoped to `@beep/schema`) |
| Timeline: drift is post-doctrine | `git log -S'Use Concept-Qualified Role Suffixes' -- standards/architecture/DECISIONS.md` → `b22f7b7306 2026-04-21`; lab archetypes `b99c7b8ed5 2026-05-12`; review-gap fix `80bdc14d76 2026-05-12` did not rename |
| Packet records no naming decision | `rg -n -i 'repository\|use-cases\.ts\|\.http\.ts\|tables\.ts' goals/canonical-slice-factory/{README,SPEC,PLAN}.md` → only SPEC L91/99/110/183/224 (prose "repository"), SPEC L114 (`.http.ts` etc. as *use-cases* declarations), SPEC L170 + PLAN L30 (`src/tables.ts` in the v3 db-admin inspection list). `history/reflections/2026-06-12-codex.md` has no naming finding. |

## 5. SPEC self-contradiction: the protocol stage

`goals/canonical-slice-factory/SPEC.md` L113-116: "driver-neutral `.http.ts`, `.rpc.ts`, `.tools.ts`,
package composers, server handler modules, and tests are in scope". Under DECISIONS 2026-04-21
("Put Protocol Declarations In `use-cases`") those three suffixes *are* use-cases declarations, and
"server handler modules" are a second set of files. What shipped:

| SPEC item | Expected path | Present? |
|---|---|---|
| driver-neutral `.http.ts` | `use-cases/src/aggregates/WorkItem/WorkItem.http.ts` | no (`find packages/architecture-lab/use-cases -name '*.http.ts'` → 0) |
| driver-neutral `.rpc.ts` / `.tools.ts` | `use-cases/…/WorkItem.rpc.ts`, `.tools.ts` | no |
| package composers | `use-cases/src/{Api,Rpc,Tools}.ts`, `server/src/{Api,Rpc,Tools}.ts` | no (`find packages/architecture-lab -maxdepth 3 -name 'Api.ts' -o -name 'Rpc.ts' -o -name 'Tools.ts'` → 0) |
| server handler modules | `server/…/WorkItem.{http,rpc,tool}-handlers.ts` | present but named `WorkItem.{http,rpc,tools}.ts` |

So the lab collapsed declarations + handlers into one server file per protocol and reused the
declaration suffix. Every `add concept --stage protocol` reproduces this shape. The two slices that
did write handlers by hand (epistemic `ContradictionTriage.rpc-handlers.ts`, law-practice
`PracticeKg.tool-handlers.ts`) used the doctrine spelling and kept the declaration in use-cases.

## 6. Uniformity ledger

| Convention | Applied N/M | Verdict |
|---|---|---|
| `<Concept>.<role>.ts` grammar in lab | 31/31 role files (0 single-segment) | uniform |
| Domain vocabulary (`.model/.values/.errors/.behavior`) in lab | 8/8 | uniform |
| Domain-kind folders (`aggregates/entities/values`) in lab across 7 tiers | 7/7 tiers | uniform |
| Domain-kind folders across all slices' use-cases+server | 5/7 slices | habitual |
| `index.ts` per concept folder in lab | 16/16 concept dirs | uniform |
| `.repo.ts` for repo impl (server) | 15/15 repo-side; lab 2/2 | uniform |
| `.layer.ts` concept Layer (server) | 20/20; lab 2/2 | uniform |
| `.ports.ts` for use-case ports | 12/19 port files repo-wide; lab 0/2 | habitual (doctrine winning) — lab on the wrong side |
| `.repository.ts` for use-case ports | 7/19; lab 2/2 | habitual minority, undecided |
| `.use-cases.ts` contract split from `.service.ts` impl | 4 files / 3 slices; lab 2/2 | habitual minority, undecided |
| Per-concept `server.ts` subpath in use-cases | 13/~30 concept dirs, 5/8 slices; lab 2/2 | habitual, undecided |
| `.{http,rpc,tool}-handlers.ts` (server) | 2/2 non-lab handler files; lab 0/3 | doctrine spelling uniform outside lab — lab absent |
| `.{http,rpc,tools}.ts` as server handler names | 3/3 lab only | lab-only |
| `.rpc.ts` / `.tools.ts` as use-cases declarations | 8/8 non-lab; lab 0 | uniform outside lab — lab absent |
| `Tables.ts` composer | 1/7 tables pkgs; `tables.ts` 3/7; `Schema.ts` 3/7 | absent (three-way split) |
| `Layer.ts` server composer | 6/7 | uniform-ish; lab conforms |
| `server/src/test.ts` | 5/7 | habitual; lab conforms |
| Config PascalCase composers (`ServerConfig.ts`, `TestLayer.ts`) | 2/3 config pkgs; lab 0/1 | habitual — lab absent |
| Config lowercase subpath shims (`public/server/secrets/layer/test.ts`) | 3/3 | uniform (including lab) |
| Config concept `.layer.ts` | 1/1 (lab only) | lab-only |
| `.command-client.ts`/`.query-client.ts`/client `.service.ts` | 0/0/1 repo-wide; lab uses `.client.ts` 1 | absent |
| UI `.tsx` role vocabulary | 0 files repo-wide use `.form/.fields/.table/.list/.detail/.admin.tsx`; epistemic ui uses bare `<Name>.tsx` (3); lab uses `.view-model.ts` (1) | absent |
| use-cases `test.ts` | 2/8 | habitual minority |
| Flat `test/` (+ optional `integration/`) instead of mirrored concept dirs | 7/7 slices; lab 7/7 tiers | uniform |
| Doctrine-vs-lab enforcement (any role/suffix/casing gate) | 0 gates | absent |

## 7. Surprises vs scout facts

1. **"use-cases public.ts/server.ts/test.ts (all slices)" is wrong.** `test.ts` exists only in `agents` and `law-practice` (2/8); `./test` export only there too. The lab has no use-cases `test.ts`.
2. **"No Api.ts/Rpc.ts/Tools.ts root files anywhere" is wrong.** `packages/law-practice/use-cases/src/Tools.ts` and `packages/law-practice/server/src/Tools.ts` exist (doctrine composers). Still 0 `Api.ts`/`Rpc.ts`.
3. **Scout suffix counts are undercounts for the slice tree:** `.repo` 15 (scout 7), `.ports` 13 (scout 8), `.repository` 7 (scout 6), `.use-cases` 4 (scout 3), `.layer` 22 (scout 15). Scout probably scoped a subset of slices; the direction of every finding holds.
4. **'repository' is not a legitimate use-cases port name.** `.<port-name>.ts` is server vocabulary (L1100) for *implementations*; the use-cases vocabulary has exactly `.ports.ts`. The suspect is confirmed, not excused.
5. **The config divergence is deeper than `layer.ts` vs `Layer.ts`.** Every config package (3/3) uses lowercase subpath-named shims; epistemic and ontology additionally keep the doctrine PascalCase composers behind them. The lab has only the shims and a concept-level `.layer.ts` that config vocabulary does not define. `tables` has the same file-vs-subpath confusion (`tables.ts` ↔ `./tables`) even though `server` already shows the right pattern (`Layer.ts` ↔ `./layer`).
6. **Server test layout is not a divergence.** Doctrine (08-testing.md L340) itself uses `server/test/integration/`; no mirroring rule exists anywhere. The scout's "not mirrored" observation is true but carries no doctrine weight.
7. **The lab never wrote the use-cases protocol declarations the SPEC asked for** (§5). The three server files use the declaration suffixes and the declarations do not exist — a tier and a name error at once, and the only HTTP handler sample in the repo.
8. **Drift is post-doctrine.** The vocabulary decision predates the lab by 21 days; nothing in the packet, DECISIONS.md, or the reflection amends it. There is no `divergent-decided-with-cite` row anywhere in §2.

## 8. Enforcement recommendation (analysis only, no relitigating PascalCase)

- Add a doctrine-derived oracle to the factory: a role-vocabulary table per tier (from ARCHITECTURE.md L1012-1128) that `beep architecture check` (or a new `beep lint role-topology`) validates *existing* slice packages against, not just plan idempotency. Start with the 9 lab files, since fixing the lab fixes every future `add concept`.
- Rename the lab first (it is `acceptedOracle`): `WorkItem.repository.ts`→`WorkItem.ports.ts`; `WorkItem.use-cases.ts`→fold into `WorkItem.service.ts` or record a decision naming the contract/impl split; server `WorkItem.{http,rpc,tools}.ts`→`.{http,rpc,tool}-handlers.ts` and add the use-cases declarations SPEC L114 promised; `tables.ts`→`Tables.ts` (keep `./tables`); config `layer.ts` shim over a `Layer.ts` composer and drop concept `.layer.ts` or add it to config vocabulary; `WorkItem.client.ts`→`WorkItem.service.ts` (+ `.command-client.ts`/`.query-client.ts` when transports exist); `WorkItem.view-model.ts`→client `.form-model.ts`/`.atoms.ts` or a recorded new ui role.
- Record the per-concept `<Concept>/server.ts` subpath either as doctrine (it is 13-file habit across 5 slices) or as forbidden; today it is neither.
