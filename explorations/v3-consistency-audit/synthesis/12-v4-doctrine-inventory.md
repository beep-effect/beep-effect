# 12 — v4 doctrine inventory: namespacing, organization, consistency, enforcement

> **Post-verification note (2026-08-30):** numbers below are the reader's first pass. Verified corrections in `20`–`25` supersede them: tier-correct suffixes ~336 → **335/432** (`frs-03`), `$I` files 380 → **379** (`CI-06`), kind folders 21:9:3 → **20 kind-only + 1 mixed : 8 bare-only : 3 flat** (`20` row 4). §7's enforcement recommendations (leave barrels and test ratios ungated, postpone the vocabulary) are **pre-align hypotheses superseded by `../DECISIONS.md`** (*barrel and namespace style*, *test file grammar*, *proof vs doctrine precedence*).

Scope: every codified convention in `standards/ARCHITECTURE.md` (1958 lines, read in full) and
`standards/architecture/{01,05,07,08,09,10,13,DECISIONS,GLOSSARY,README}.md` about slice
namespacing/organization, with its declared enforcement lane, and a code census of the eight v4
slice roots (`packages/{agents,architecture-lab,documents,epistemic,law-practice,ontology,shared,workspace}`,
40 packages, 948 `src` files incl. 327 `index.ts`, 170 test files) at HEAD `3435c24f94`.
All counts exclude `node_modules`, `dist`, `coverage`, `.turbo`. Home dir written as `~`.

## TL;DR

1. The doctrine names four enforcement lanes (ARCHITECTURE.md L1912-1938) but assigns a lane to only 7 rule areas; **none of the topology rules** (domain-kind folders, `<Concept>.<role>.ts` grammar, role vocabulary, root composers, `index.ts`, test placement) has a declared lane, and the only automation touching slice topology is the `beep architecture` generator (Generated Default) whose `check` validates plan idempotency, not existing packages.
2. The role vocabulary is 41 suffixes across 7 tiers; the code uses 22 of them (19 never appear, incl. every `ui` suffix and every `*-handlers` suffix) plus 42 non-vocabulary suffixes. Only ~336/621 (54%) non-index slice files carry a tier-correct doctrine suffix; 189 (30%) have no role suffix at all.
3. Domain-kind folders in non-domain tiers are the doctrine's largest internal contradiction: `ARCHITECTURE.md` (tree L827-952, grammar L969-978), `01` and `GLOSSARY` require `<domain-kind>/` in every tier, while `13`, `09`, `10` and ARCHITECTURE's own error/machine tables (L1319-1326, L1616-1622) show bare `<Concept>/`. Code splits 21 packages kind-folder : 9 bare-concept : 3 flat.
4. The canonical proof (`architecture-lab`, ratified by DECISIONS 2026-05-12) diverges from the vocabulary it is meant to prove (`.repository.ts` for `.ports.ts`, `.use-cases.ts`, server `WorkItem.http/.rpc/.tools.ts`, `tables.ts`, config `layer.ts`+`WorkItem.layer.ts`, `WorkItem.view-model.ts`) and introduces a concept-local `server.ts` + `./aggregates/<Concept>/server` subpath pattern that no doctrine text mentions — yet 5 slices copy it (13 files).
5. What IS uniform in v4 without any gate: `index.ts` per concept folder (253/254), zero tests under `src` (170/170 under `test/`), `$I` identity anchors (380/621 = 61%), `./internal/*: null` (33/40), and `/public` + `/server` use-cases subpaths (8/8). Recommend enforcement on exactly those plus the domain-kind decision, not on the 19 unused suffixes.

## 1. Method and evidence baseline

| Path | Command | Result |
|---|---|---|
| `standards/ARCHITECTURE.md` | `wc -l` | 1958 lines; headings via `grep -n '^## \|^### '` (L304 Slice Package Topology, L400 Boundary-Sensitive Export Contracts, L681 Canonical File-Role Anchors, L827 Canonical Concept Topology, L954 Domain-Kind Folders, L969 Role Suffixes, L1129 Responsibility Boundaries, L1300 Access/Policy/Error Kinds, L1624 Layer Composition, L1912 Enforcement And Migration Posture) |
| `standards/architecture/*.md` | `wc -l` | 01=115, 05=250, 07=380, 08=362, 09=295, 10=179, 13=161, DECISIONS=1583, GLOSSARY=493, README=133 |
| `packages/<8 slices>/*` | `ls -d <slice>/*/` | 40 packages: domain 8, use-cases 8, server 7 (no `shared/server`), tables 7 (no `ontology/tables`), client 4, ui 3, config 3 |
| slice `src` | `find ... -path '*/src/*' \( -name '*.ts' -o -name '*.tsx' \)` | 948 files; 621 non-`index.ts` |
| slice `test` | `find ... -path '*/test/*' -name '*.test.ts*'` | 170 test files; 0 under `src` |

## 2. Enforcement lanes as declared (ARCHITECTURE.md L1912-1958)

Lanes: `Doctrine`, `Generated Default`, `Review Gate`, `Hard Check` (L1918-1925; GLOSSARY L185-223). Rule areas that actually receive a lane (L1928-1938):

| Rule area | Target lane | Current status (verbatim) | Future automation |
|---|---|---|---|
| Shared promotion records | Review Gate | Docs-only package README requirement | README template checks (`lint:promotion-records` "planned, not implemented", README L100-103, DECISIONS L1580) |
| `foundation/capability` routing | Doctrine + Review Gate | Docs-only negative gate | metadata + dependency checks |
| Package creation gates | Doctrine + Generated Default | Docs-only rule | generator prompts |
| Canonical subpath names and browser roots | Hard Check | Target doctrine with transitional roots allowed | export-map + import-boundary checks |
| App Layer boundaries | Doctrine + Review Gate | Docs-only ownership test | no private reach-through imports |
| Migration posture | Doctrine | Docs-only taxonomy | repo-check reporting |
| Browser capability routing | Doctrine + future Hard Check | Docs-only routing table | browser-root import checks |

Absent from that table: domain-kind folders, concept grammar, role suffixes, root composers, `index.ts`/barrel style, test placement, error placement, `$I` anchors. DECISIONS L168-179 ("Keep Codegen And Linting Downstream") and README L118-124 ("not a lint implementation plan") explain the omission but leave those rules lane-less.

Automation that exists today (verified by `Command.make` ids under `packages/tooling/tool/cli/src/commands/`):

| Group | Subcommand ids found | Touches slice topology? |
|---|---|---|
| `Architecture` | `create slice`, `create package`, `add`, `plan`, `apply`, `check` | Generator only. `check` = "Validate that a canonical architecture operation plan is idempotent" (Architecture.command.ts L186-198); it never scans an existing package. Vocabulary: `ArchitectureDomainKind = ["aggregates","entities","values"]` (Architecture.schemas.ts L33); `entityRoles = [domain,use-cases,server,tables,db-admin]`, `valueRoles = [domain]` (RoleTopology.ts L57-67) |
| `Lint` | `circular`, `deprecated-apis`, `goal-packets`, `judge-rubric`, `reflection-artifacts`, `roadmap-refs`, `schema-topology`, `tooling-schema-first` (+ files `EcosystemPolarity.ts`, `IdentityRegistry.ts`, `PackageTestImports.ts`, `PackageTestTypecheck.ts`, `SchemaCatalog.ts`, `SchemaFirst.ts`) | `schema-topology` is scoped to `@beep/schema` (ARCH L768-771). `pascal-case-file` (Lint.command.ts L279-284) applies to **tooling CLI files only**. `package-test-imports` enforces `@beep/*` aliases in tests. `identity-registry` enforces the package-level `$XxxId` registry, not per-file `$I` paths. No suffix / casing / folder / barrel gate for slices. |
| `Laws` | `effect-fn`, `effect-imports`, `native-runtime`, `frozen-grant-set`, `allowlist-check`, `terse-effect` | Style laws, not topology |
| `Quality` | `fallow`, `jsdoc-*`, `tsgo-rules`, `changeset-graph`, ... | `.fallowrc.jsonc` L432 `"boundary-violation": "error"` with per-package zones generated in `standards/fallow.boundaries.generated.jsonc` (zone per `@beep/*` package `src/**`) = the only live import-boundary check; it derives from workspace deps, not from doctrine arrows |

## 3. Convention inventory

Columns: source (file:lines) · rule (short) · lane per §2 · named automation · code reality.

### 3.1 Slice spine and optional-by-need

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L304-352; 01 L30-45; DECISIONS L654-703 | Spine = domain, use-cases, config, server, client, tables, ui; "vocabulary, not a scaffold mandate"; a package needs a concrete role AND meaningful exports; `config` optional | Doctrine + Generated Default ("Package creation gates": Docs-only) | `beep architecture create slice --stage core..full`; `beep create-package` | 8/8 domain, 8/8 use-cases, 7/8 server, 7/8 tables, 4/8 client, 3/8 ui, 3/8 config. Only `architecture-lab` and `epistemic` carry the full 7-package spine |
| ARCH L340-398; 02 L76-95 | `shared` reduced spine: domain active, config/use-cases/client/server/tables/ui high-bar; `shared/use-cases` contract-only, `/public` `/server` `/test` | Doctrine + Review Gate (promotion records: Docs-only) | none (`lint:promotion-records` planned) | `shared/{domain,tables,use-cases}` exist; `shared/use-cases` has 1 concept (`PromotionGate/`) with `public.ts` + `server.ts`, no `test.ts` |
| ARCH L353-357 | Never create packages for symmetry | Generated Default | generator `--stage` | not measurable statically |

### 3.2 Domain-kind folders

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L954-967; DECISIONS L96-108; GLOSSARY L134-138 | `aggregates/`, `entities/`, `values/` canonical; `policies/`, `services/` escape hatches; "do not hide aggregate roots in `entities/`" | Doctrine (no lane) | generator LiteralKit `["aggregates","entities","values"]` | Domain packages: 8/8 use kind folders. `aggregates` 5/8, `entities` 7/8, `values` 7/8, `policies` 0/8, `services` 0/8. Extras: `law-practice/domain/src/internal/`, `shared/domain/src/{entity,identity}/` |
| ARCH L827-952 tree (quoted below); L969-978 grammar; 01 L64-72; GLOSSARY L90-105 | `<package>/src/<domain-kind>/<Concept>/<Concept>.<role>.ts` — the tree places `entities/Membership/` under **every** tier (use-cases, config, server, tables, client, ui) | Doctrine (no lane) | generator writes kind folders in all roles (proof: `config/src/aggregates/WorkItem/`, `ui/src/aggregates/WorkItem/`) | Non-domain packages (32): 21 use kind folders, 9 use bare `<Concept>/` (`agents/server`, `epistemic/{client,server,ui,use-cases}`, `law-practice/{server,use-cases}`, `shared/use-cases`, `workspace/server` mixed `aggregates/` + `SourceText/`), 3 flat (`agents/client`, `epistemic/config`, `ontology/config`) |

Canonical Concept Topology tree, ARCH L830-941 (abridged to the folder skeleton; every tier repeats `entities/Membership/`):

```txt
packages/iam/
  domain/src/     aggregates/Enrollment/  entities/Membership/{index.ts, .model .values .errors .behavior .policy .access .contracts .events .machine}  values/LocalDate/  Events.ts
  use-cases/src/  entities/Membership/{.commands .queries .access .ports .service .errors .http .rpc .tools .cluster .workflows .processes}  Api.ts Rpc.ts Tools.ts Cluster.ts
  config/src/     entities/Membership/Membership.config.ts  Config.ts PublicConfig.ts ServerConfig.ts Secrets.ts Layer.ts TestLayer.ts
  server/src/     entities/Membership/{.repo .http-handlers .rpc-handlers .tool-handlers .event-handlers .cluster-handlers .workflow-handlers .projections .layer}  Api.ts Rpc.ts Tools.ts Events.ts Cluster.ts Layer.ts
  tables/src/     entities/Membership/{.table .read-model-table}  Tables.ts ReadModels.ts
  client/src/     entities/Membership/{.command-client .query-client .service .atoms .form-model .machine .layer}
  ui/src/         entities/Membership/{.form .fields .table .list .detail .admin}.tsx
```

L943-945: "This topology is a vocabulary, not a requirement to create empty files."

### 3.3 Concept-qualified role grammar (DECISIONS 2026-04-21 L110-125)

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| DECISIONS L110-125; ARCH L969-988; GLOSSARY L90-105 | `<Concept>/<Concept>.<role>.ts`, `.tsx` for React; multi-word roles hyphenated (`event-handlers`) | Doctrine (no lane) | generator only | Inside PascalCase concept dirs: 404 files match `<Dir>.<role>`, 27 have a different prefix (e.g. `Sync/VaultSyncEngine.service.ts`, `Thread/ThreadStore.repo.ts`, `ClaimGate/ClaimGateResult.model.ts`, 13× concept-local `server.ts`), 78 are single-segment. Repo-wide: 432/621 non-index files carry some suffix; 189 carry none (`shared/domain` alone: 73/85 no suffix) |
| ARCH L157-165 | "Role suffixes are canonical when the role exists. The full vocabulary is not required for every concept." | Doctrine | — | consistent with 19 unused suffixes below |

### 3.4 Role suffix vocabulary — complete list per tier, with usage counts

Counts = files with that suffix anywhere in slice `src` (tier in parentheses when misplaced).

| Tier (source) | Suffixes (doctrine) | Used | Never used |
|---|---|---|---|
| domain (ARCH L1012-1027) | `.model` `.values` `.errors` `.behavior` `.policy` `.access` `.contracts` `.events` `.machine` | model 148, values 31(+4 in use-cases), errors 4(dom)/21 total, behavior 9, contracts 2 (both in `agents/use-cases/processes/`) | policy, access, events, machine |
| use-cases (L1029-1043) | `.commands` `.queries` `.access` `.ports` `.service` `.errors` `.http` `.rpc` `.tools` `.cluster` `.workflows` `.processes` `.schedulers` | commands 8, queries 2, ports 12(+1 in server), service 14, errors 16, rpc 7, tools 1 | access, http (only 1, in server), cluster, workflows, processes, schedulers |
| config (L1070-1082) | `.config` + composers `Config.ts` `PublicConfig.ts` `ServerConfig.ts` `Secrets.ts` `Layer.ts` `TestLayer.ts` | config 1 (+2 in server); ServerConfig.ts 2/3, TestLayer.ts 2/3 | Config.ts, PublicConfig.ts, Secrets.ts, Layer.ts (proof uses lowercase `layer.ts`) |
| server (L1095-1108) | `.repo` `.<port-name>` `.http-handlers` `.rpc-handlers` `.tool-handlers` `.event-handlers` `.cluster-handlers` `.workflow-handlers` `.projections` `.layer` | repo 15, rpc-handlers 1, tool-handlers 1, projections 1(+1 in domain), layer 20 | http-handlers, event-handlers, cluster-handlers, workflow-handlers (`.<port-name>` is open-ended: `.file-store`, `.host`, `.gate`, `.fetch` arguably qualify) |
| client (L1110-1120) | `.command-client` `.query-client` `.service` `.atoms` `.form-model` `.machine` `.layer` | atoms 4, service 1, layer 1 | command-client, query-client, form-model, machine |
| tables (L1122-1127) | `.table` `.read-model-table` + `Tables.ts` `ReadModels.ts` | table 32, read-model-table 3, Tables.ts 1/7, ReadModels.ts 1/7 | — (but `.converters` 25 is the dominant non-vocab tables role) |
| ui (L1122-1127) | `.form` `.fields` `.table` `.list` `.detail` `.admin` (`.tsx`) | none (`.fields` appears once, as `.ts` in domain) | all six |

Totals: 41 distinct doctrine suffixes; 22 appear in code, 19 never. 64 distinct suffixes exist in code, so 42 are non-vocabulary ("earned" per L704-708 for CLI, but no slice rule licenses them): `.converters` 25, `.repository` 7, `.use-cases` 4, `.models` 3, `.validation` 2, `.sparql` 2, and 36 singletons (`.kernel`, `.fixture`, `.fixtures`, `.fixture-service`, `.repair-errors`, `.reader`, `.reasoner`, `.worker-protocol`, `.visualizer`, `.visualizer.worker`, `.view-model`, `.workbench`, `.workbench.shared`, `.inspector`, `.explorer`, `.graph`, `.metrics`, `.source`, `.document`, `.changelog`, `.tree`, `.seed`, `.projection`, `.calendar`, `.candidates`, `.pizza-tutorial`, `.client`, `.claims`, `.emails`, `.fts`, `.host`, `.probe`, `.gate`, `.fetch`, `.file-store`, `.rows`, `.repo.internal`, `.schema`, `.schemas`). Tier-correct doctrine suffix: ~336/621 (54%); wrong-tier doctrine suffix ~14 (2%); non-vocab ~80 (13%); no suffix 189 (30%).

Command: `find <8 slices> -path '*/<tier>/src/*' -type f \( -name '*.ts' -o -name '*.tsx' \) -not -name index.ts | awk -F/ '{n=$NF; sub(/\.tsx?$/,"",n); if (n ~ /\./) {sub(/^[^.]*\./,"",n); print n} else print "(none)"}' | sort | uniq -c`.

### 3.5 Package-level composers / root files (ARCH L989-1010, L827-952; 06 L55-63)

| Doctrine root file | Where mandated | Found (packages) |
|---|---|---|
| `Api.ts`, `Rpc.ts`, `Cluster.ts` (use-cases + server) | L933-935, L920-923 | 0 |
| `Tools.ts` | L922, L935 | 2: `law-practice/use-cases/src/Tools.ts`, `law-practice/server/src/Tools.ts` |
| `Events.ts` (domain, server) | L860, L936 | 0 |
| `Layer.ts` (server) | L937, L1652; 05 L32-38; 13 L46 | 6/7 server packages (`agents/server` has none); exported as `./layer` 6/7 |
| `Tables.ts`, `ReadModels.ts` | L945-946, L1003-1004, L1126 | `Tables.ts` 1/7 (law-practice), `ReadModels.ts` 1/7; `tables.ts` 3/7 (agents, architecture-lab, documents); `Schema.ts` 3/7 (epistemic, shared, workspace). Export key `./tables` maps to `tables.ts` in 3 and `Tables.ts` in 1 |
| `Config.ts`, `PublicConfig.ts`, `Secrets.ts` | L1000-1005, L1075-1078 | 0/3 |
| `ServerConfig.ts`, `TestLayer.ts` | L1078, L1080 | 2/3 each (epistemic, ontology; architecture-lab has neither) |
| `Layer.ts` (config) | L1002, L1079 | 0/3 — all three use lowercase `layer.ts` |
| subpath entry files `public.ts` `server.ts` `test.ts` `secrets.ts` `layer.ts` | not in any vocabulary table; implied by L400-447 | use-cases `public.ts` 8/8, `server.ts` 8/8, `test.ts` 2/8; config all five 3/3; server `test.ts` 5/7 |
| other root role files | none | `law-practice/server/src/PracticeKg.{claims,emails,errors,fts,host,projections,queries,rows,schemas,tool-handlers}.ts` (10 root-level concept-named files), `agents/client/src/{Chat.atoms,Chat.layer,ProviderInstance.atoms,ProviderInstance.service,ClientObservability}.ts`, `epistemic/client/src/Protocol.ts`, `epistemic/config/src/Audience.ts`, `ontology/config/src/McpConfig.ts`, `ontology/use-cases/src/worker.ts`, `agents/use-cases/src/proof.ts`, `shared/domain/src/{aggregates,entities,entity,identity,values}.ts` |

Command: `for d in <slice>/<tier>/src; do find $d -maxdepth 1 -type f \( -name '*.ts' -o -name '*.tsx' \) -not -name index.ts; done`.

### 3.6 Barrels, `index.ts`, namespace exports

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L841 (tree), 13 L32-33 | `index.ts` per concept folder ("public exports for the Note aggregate") and a package barrel | Doctrine by example only; no `export * as` vs `export *` rule anywhere (`grep -n -i 'barrel\|namespace\|export \* as' standards/ARCHITECTURE.md standards/architecture/*.md` → only @beep/schema, CLI, and God-Layer hits) | none | 327 `index.ts`; concept dirs with `index.ts` 253/254 (missing: `agents/use-cases/src/processes/ProfessionalRuntime/`); kind aggregators `src/<kind>/index.ts` 29/45 kind dirs; export styles in `index.ts`: `export * from` 641, `export * as` 120, `export {` 30 |
| ARCH L700-711, L727-745, L762-771; 07 L277-300, L345-357 | For non-slice families only: `index.ts` is a "curated public facade"; role files are private; namespace-first concept modules for `@beep/schema` | Hard Check for `@beep/schema` (`beep lint schema-topology`), Doctrine for CLI | `schema-topology` | not applicable to slices |
| 05 L193; ARCH L1676 | Apps must not "re-export slice Layers through a convenience barrel" | Review Gate (Docs-only) | none | not measured (apps out of scope) |

### 3.7 Public surface / export maps

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L400-447, L1045-1068, L1084-1093; DECISIONS L408-433; GLOSSARY L321-325 | use-cases `/public` `/server` `/test`; config `/public` `/server` `/secrets` `/layer` `/test`; drivers `/browser`; "required names when that role exists"; roots and `./*` transitional | **Hard Check** (target; "transitional roots allowed"); future "export-map and import-boundary checks" | none for export maps | use-cases: `./public` 8/8, `./server` 8/8, `./test` 2/8; config: all five 3/3; server `./layer` 6/7, `./test` 5/7; domain `./test` 0/8 (08 L49, L167 import `@beep/iam-domain/test`) |
| ARCH L1948-1951; README L27-31 | package-root or `./*` wildcard exports "Forbidden In New Work" as canonical contract | Doctrine (migration bucket) | none | `./*` root wildcard 2/40 (`shared/domain`, `shared/tables`); kind wildcards `./aggregates/*` etc. 7/40 (`documents/{domain,use-cases,server}`, `agents/tables`, `law-practice/tables`, `ontology/{client,ui}`) |
| implied by 05 L162-167 ("Private = anything not exported through a canonical subpath") | `./internal/*: null` | Doctrine | none | 33/40 package.json declare `"./internal/*": null`; 6 `internal/` src dirs |
| **not in doctrine** | per-concept subpaths `./aggregates/<Concept>`, `./entities/<Concept>`, and per-concept server split `./aggregates/<Concept>/server` → `src/aggregates/<Concept>/server.ts` | — | generator emits it (`architecture-lab/use-cases/src/aggregates/WorkItem/server.ts`) | 13 concept-local `server.ts` + 1 `worker.ts` across agents, architecture-lab, documents, epistemic, ontology, workspace; per-concept exports in 7/8 use-cases packages |

### 3.8 Import ceilings and boundary arrows

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L189-302 (mermaid + "Forbidden by default" L256-272 + client/UI caveats L274-302); 01 L47-61 | domain → shared-domain + foundation primitive/modeling only; use-cases ↛ server/client/ui/tables/drivers; config ↛ use-cases/...; client via `/public` only; tables/ui/drivers ↛ slice config; no slice-to-slice imports (L668-673) | Doctrine; subpath part is Hard Check target | `.fallowrc.jsonc` `boundary-violation: error` with generated per-package zones (workspace-dep derived); `beep lint circular`; TsconfigSync references | not re-measured here (dependency edges are the subject of another synthesis file) |
| ARCH L653-680 | slice consumption of foundation by tier; no `packages/tooling/*/*` imports from slices | Doctrine | fallow zones (partial) | — |

### 3.9 Tests (08-testing)

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| 08 L1-9 | slice tests run with the slice's Layers + test-kit + driver test Layers only; vitest via scripts, never `bun test` | Doctrine / Review Gate | none named | 170 test files; 0 import relative `../src` (`grep -rl 'from "\.\./.*src/'` → 0) |
| 08 L164-181 (Fixture Ownership) | each slice `/test` subpath publishes fixtures; tests import own `/test` through the `@beep/*` alias, never relative into another package's `src/`; cross-slice fixtures → `shared/use-cases/test` | Doctrine; alias rule is a **Hard Check** in practice | `beep lint package-test-imports`, `package-test-typecheck`; CLAUDE.md law | 14 `@beep/<pkg>/test` imports across 8 packages; domain packages publish `./test` 0/8 |
| 08 L184-238 (Contract tests) | `test/<Port>.contract.ts` suite + `.contract.test.ts` per implementation | Doctrine | none | 0 `*.contract*` files; 0 `.error-translation.ts` (09 L75) |
| 08 L240-262, L318-329 | slice-isolation; anti-patterns table (no `process.env`, `TestClock`, no ≥2 slice `Layer.ts`) | Doctrine | none | not measured |
| **not in doctrine** | test directory location, mirroring of `src` concept folders, file naming, src:test ratio | — | — | all 170 under `<pkg>/test/`; dirs flat except `integration/` (architecture-lab, documents, epistemic, workspace server) and ontology `fixtures/`/`browser/`; naming `.test.ts` 127, `.equivalence.test` 14, `.pglite.test` 9, `.atoms.test` 3, `.schema-parity.test` 2, `.pg.test` 2, `.e2e.test` 2, 9 other one-offs; ratio extremes `law-practice/domain` 214:3, `shared/domain` 105:8, `ontology/client` 4:11 |

### 3.10 Errors (ARCH L1300-1329; 09)

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH L1319-1329 table | domain failure `domain/<Concept>.errors.ts`; application failure `use-cases/<Concept>.errors.ts`; driver failure `drivers/<Driver>.errors.ts`; boundary translation in handlers; "do not create `*.errors.ts` to wrap every failure" | Doctrine | none | `.errors.ts`: domain 4, use-cases 16, server 1 (`law-practice/server/src/PracticeKg.errors.ts` — server tier has no `.errors` role) |
| 09 L7-35 taxonomy (5 kinds); L63-71 translation contract; L73-79 naming (`<Concept>.error-translation.ts` for non-trivial translations); L81-87 ports declare only port failures; L276-289 "internal failure dies at the boundary"; DECISIONS L705-739, L777-810 | port failures = server-only classes in `use-cases/<Concept>/<Concept>.errors.ts` exported from `/server`; public action failures from `/public` | Doctrine; proof = Review Gate (`architecture-lab` "executable proof") | none | proof defines port errors in `WorkItem.repository.ts` (L38-176), not `.errors.ts`; `.error-translation.ts` 0; `$I.annoteError` equivalence rule (09 L37-61) is checked by 14 `*.equivalence.test.ts` |
| ARCH L1300-1318; DECISIONS L127-138 | `access` ≠ `policy`; both suffixes | Doctrine | none | `.access` 0, `.policy` 0 |

### 3.11 Layer composition (05; ARCH L1624-1680; DECISIONS L435-455)

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| 05 L30-54; ARCH L1652-1656 | `packages/<slice>/server/src/Layer.ts` composes the slice; use-cases never export live Layers | Doctrine | none | server `Layer.ts` 6/7; use-cases `.layer` 0 ✓; server concept `.layer.ts` 20; config concept `WorkItem.layer.ts` 1 (not a config role); client `.layer` 1 |
| 05 L152-197; ARCH L1658-1680 | scope ladder concept → package → slice → app; `apps/<app>/src/runtime/Layer.ts`; Boundary + Ownership test; "Private = not exported through a canonical subpath" | Doctrine + Review Gate ("App Layer boundaries": Docs-only) | none | apps out of scope |
| 05 L222-250 | app composes `@beep/<slice>-server/layer`; diagnostic: a concept name in an app Layer = reach-through | Review Gate | none | — |

### 3.12 Identity anchors and misc

| Source | Rule | Lane | Automation | Code reality |
|---|---|---|---|---|
| ARCH examples L1350, L1467, L1690, L1717; 05 L66; 09 L30 | `const $I = $<Pkg>Id.create("<kind>/<Concept>/<Concept>.<role>")` per module | Doctrine by example | `beep lint identity-registry` (package registry + composer invariants; not per-file path parity) | 380/621 non-index src files (61%) declare `$I` (`grep -rl 'const \$I = '`) |
| 01 L77-99 | cross-concept escape hatches: ≥2 aggregates / ≥2 concepts' events / ≥2 concept Layers / multi-concept policy | Review Gate (unlabelled) | none | `law-practice/server/src/PracticeKg.*` (10 root role files) and `agents/use-cases/src/processes/` (3 concepts) are the de-facto escape-hatch shapes; neither shape is named in doctrine |
| 13 L1-17; DECISIONS L723-726 | scratchpad / temporary `_internal` lane; product packages never import it | Doctrine | none | — |

## 4. Internal inconsistencies and ambiguities in the doctrine

| # | Where | What conflicts |
|---|---|---|
| A1 | ARCH L827-952 tree, L969-978 grammar, 01 L64-72, GLOSSARY L90-105 **vs** 13 L22-48 (`use-cases/src/Note/`, `server/src/Note/`), 13 L131-141 (`packages/iam/server/src/Membership/`), 09 L12-14 (`use-cases/<Concept>/`), 10 L20 (`server/src/Membership/Membership.processes.ts`), ARCH L1319-1326 + L1616-1622 (`domain/<Concept>.errors.ts`, `use-cases/<Concept>.processes.ts`) | Whether `<domain-kind>/` is required in non-domain tiers. The binding tree says yes in every tier; four companion passages and two ARCHITECTURE tables show bare concept folders. Code: 21 vs 9 vs 3. The generator sides with the tree. **This is the decision the enforcement recommendation must make first.** |
| A2 | ARCH L1040, L1549 (`.processes.ts` in use-cases) **vs** 10 L8-20 ("A process that touches only one slice's events ... belongs in that slice's `server` package", file roles `*.processes.ts`/`*.event-handlers.ts`) | Home tier of `.processes.ts`. Neither suffix is used; `agents` invented a `processes/` **folder** in use-cases instead |
| A3 | ARCH L1032 `.ports.ts`, L1381-1399 example; 13 L149 ("`Context.Tag` declarations" — v3 API) **vs** proof `WorkItem.repository.ts` (7 `.repository.ts` files vs 13 `.ports.ts`); DECISIONS L777-810 makes the proof canonical | Port-file name. Doctrine and proof disagree, and the doctrine ratifies the proof, so both are "canonical". 13's `Context.Tag` contradicts ARCH's `Context.Service` |
| A4 | ARCH L945-946, L1003-1004, L1126 `Tables.ts` **vs** proof `tables.ts` (3 pkgs) and `Schema.ts` (3 pkgs); ARCH L1002/L1079 config `Layer.ts` **vs** proof `layer.ts` (3/3); server `Layer.ts` exported as `./layer` | Root composer casing. The doctrine conflates composer files (`Layer.ts`) with subpath entry files (`layer.ts`); the proof uses lowercase entry files named after subpaths (`public.ts`, `server.ts`, `test.ts`, `secrets.ts`, `layer.ts`) that appear in no vocabulary table |
| A5 | 13 L143-157 "Common role suffixes" (11 rows) **vs** ARCH L1012-1127 (41 suffixes) | 13 omits `.values`, `.access`, `.contracts`, `.events`, `.machine`, all config/client/tables/ui roles; describes `.behavior.ts` as "`Effect.fn` returning typed failures" (ARCH L1019: "pure behavior too large or visible for the model file"); then claims non-matching paths are "a violation of the role topology" enforced by "the hard-check lane in `07-non-slice-families.md`" — 07 has no such lane; its only hard check is `lint schema-topology` for `@beep/schema` |
| A6 | ARCH L400-447 declares subpaths only for use-cases, config, drivers **vs** 13 L47 (`server`: `"." "./layer" "./test"`), 05 L222-240 (`@beep/iam-server/layer`), 08 L120, L207 (`@beep/iam-server/test`, `@beep/iam-domain/test`) | Server and domain subpath contracts are used in examples but never declared in the Boundary-Sensitive Export Contracts section. Code: server `./layer` 6/7, `./test` 5/7, domain `./test` 0/8 |
| A7 | ARCH L1126 ui vocabulary (`.form .fields .table .list .detail .admin`) | 0 uses; `.table.tsx` collides with tables `.table.ts`; the proof's ui role is `WorkItem.view-model.ts` (not in vocabulary); ontology/ui uses 11 earned suffixes; epistemic/ui uses single-segment component files |
| A8 | ARCH L1036-1040 (`.http`/`.rpc`/`.tools` = driver-neutral declarations in use-cases) and L1100-1102 (`.http-handlers`/`.rpc-handlers`/`.tool-handlers` in server) **vs** proof `server/src/aggregates/WorkItem/WorkItem.{http,rpc,tools}.ts` | Use-cases-tier names in the server tier of the canonical proof. Also proof splits `.use-cases.ts` (the `Context.Service` class) from `.service.ts` (`makeWorkItemUseCases` factory + `toWorkItemActionError`), inverting ARCH L1037's meaning of `.service.ts` |
| A9 | proof + 5 slices: concept-local `server.ts` and `./aggregates/<Concept>/server` subpaths | Not mentioned in any doctrine file, yet generated by the factory. Ambiguous whether canonical or transitional |
| A10 | ARCH L954-967 / GLOSSARY L134-138 (5 kind folders) **vs** generator (3) **vs** code (`processes/`, `entity/`, `identity/`, `internal/`, `tools/`, `tree/`, `generated/`, `free-law-project/`) | Folder vocabulary is open in practice; `internal/` is implied by `./internal/*: null` but only defined for `@beep/schema` (L768-769) and the CLI (07 L333-334) |
| A11 | ARCH L1928-1938 | No topology rule has a lane (see §2). "Role suffixes are canonical when the role exists" (L163-165) is unfalsifiable without a lane |
| A12 | 01 L64-71 `config/src/entities/Membership/Membership.config.ts`; ARCH L1070-1082 config vocabulary = `.config` only **vs** proof `config/src/aggregates/WorkItem/WorkItem.layer.ts` | concept-level `.layer.ts` in config is outside the config vocabulary |
| A13 | ARCH L1098 `.<port-name>.ts` | open-ended server role; cannot be linted; makes `.file-store`, `.host`, `.gate`, `.fetch`, `.probe` undecidable |
| A14 | 09 L12 (port failures in `use-cases/<Concept>/<Concept>.errors.ts`) **vs** ARCH L1319-1326 table (no port-failure row) **vs** proof (`WorkItem.repository.ts`) | Three different answers for where port errors live |
| A15 | 08 (no mirroring rule; flat `test/` examples) **vs** `explorations/atlas-synthesis/synthesis/41-v3-knowledge-engine.md` "1:1" test mirroring | v3 mirroring is archaeology, not v4 doctrine; v4 doctrine is silent on test-dir shape |

## 5. Uniformity ledger

Verdict scale: **uniform** ≥ 95% with no gate needed to explain it; **habitual** 60-94% or uniform only inside a subset; **absent** < 60% or never used.

| Convention | Applied N/M | Verdict | Gate today |
|---|---|---|---|
| `index.ts` in every PascalCase concept folder | 253/254 | uniform | none |
| Tests live under `<pkg>/test/`, never `src/` | 170/170 | uniform | none (vitest include) |
| Test files import package source via `@beep/*` only | 170/170 (0 relative `../src`) | uniform | `beep lint package-test-imports` |
| use-cases `./public` + `./server` subpaths | 8/8 | uniform | none |
| config five subpaths | 3/3 | uniform (n=3) | none |
| `./internal/*: null` | 33/40 | habitual | none |
| server `Layer.ts` + `./layer` | 6/7 | habitual | none |
| `$I` identity anchor per module | 380/621 | habitual | `identity-registry` (package-level only) |
| domain packages use kind folders | 8/8 | uniform | generator |
| kind folders in non-domain tiers | 21/32 (9 bare, 3 flat) | habitual, split by slice (`epistemic`, `law-practice`, `agents` bare) | generator |
| `<Concept>.<role>.ts` inside concept dirs | 404/509 | habitual (79%) | none |
| any role suffix on non-index src files | 432/621 | habitual (70%) | none |
| tier-correct doctrine suffix | ~336/621 | absent (54%) | none |
| doctrine suffix vocabulary used at all | 22/41 suffixes | absent for 19 (all ui, all `*-handlers`, `.policy`, `.access`, `.events`, `.machine`, `.cluster`, `.workflows`, `.processes`, `.schedulers`, `.command-client`, `.query-client`, `.form-model`) | none |
| `.ports.ts` (vs `.repository.ts`) | 13/20 | habitual, split by slice | none |
| `.model.ts` for domain entities | 148 (7/8 domain pkgs; `shared/domain` mostly suffix-less) | habitual | schema-first lints (content, not name) |
| root composers named per doctrine (`Tables.ts`, `Config.ts`, ...) | 6 of 13 names ever appear; `Api/Rpc/Events/Cluster/Config/PublicConfig/Secrets` 0 | absent | none |
| tables root composer name | `tables.ts` 3, `Schema.ts` 3, `Tables.ts` 1 (of 7) | absent (three spellings) | none |
| use-cases `./test` subpath | 2/8 | absent | none |
| domain `./test` subpath (08 requires) | 0/8 | absent | none |
| `.contract.ts` suites / `.error-translation.ts` | 0 / 0 | absent | none |
| no `./*` root wildcard | 38/40 | uniform (shared/* are the leftovers) | none |
| no kind-level wildcard exports | 33/40 | habitual | none |
| `export * as` namespace barrels | 120 vs 641 `export * from` | unregulated | none |
| `.errors.ts` in domain/use-cases only | 20/21 | habitual | none |
| `.tsx` role suffix in ui | ontology 11/11 earned suffixes; epistemic 0/3 | split | none |

Cross-check against v3 (archived `~/YeeBois/projects/beep-effect4`, same commands): 347 `index.ts` on 1478 src files; 471 `$I` files; barrel styles `export * as` 473 / `export * from` 467 / `export {` 65; suffix census `(none)` 608 (non-index), `.repo` 78, `.contract` 72, `.errors` 61, `.tool` 42, `.rpc` 42, `.http` 42, `.table` 41, `.model` 39, `.entity` 39, `.value` 26, `.schema` 14, `.schemas` 9. v3 wins on suffix uniformity (~52% of non-index files suffixed vs v4 70% — v4 is actually higher by file share, but v3's suffix set is 16 roles vs v4's 64, i.e. v3 is uniform in *vocabulary size*, v4 in *presence*).

## 6. Surprises vs scout facts

| # | Scout fact | Finding | Command |
|---|---|---|---|
| S1 | "No Api.ts/Rpc.ts/Tools.ts root files anywhere" | **Wrong for Tools.ts**: `packages/law-practice/use-cases/src/Tools.ts` and `packages/law-practice/server/src/Tools.ts` exist. Api/Rpc/Events/Cluster = 0 confirmed | `find <tier>/src -maxdepth 1 -name '*.ts'` |
| S2 | "use-cases public.ts/server.ts/test.ts (all slices)" | `test.ts` only in `agents` and `law-practice` (2/8); `public.ts`/`server.ts` 8/8 confirmed | same |
| S3 | suffix distribution `.model 118, .values 20, .converters 17, .table 16, .layer 15, .errors 11, .service 10, .ports 8, .repo 7, .repository 6, .rpc 5` | All undercounted: `.model` 148, `.values` 35, `.converters` 25, `.table` 32, `.layer` 22, `.errors` 21, `.service` 17, `.ports` 13, `.repo` 15, `.repository` 7, `.rpc` 8 (scope: 8 slice roots incl. `shared`, `src` only, coverage excluded). "659 single-segment" → 516 incl. `index.ts`, 189 excl. | §3.4 command |
| S4 | "Src dirs: 176 PascalCase vs 11 lowercase (entities 57, aggregates 54, values 24, internal 18, tools 6, tree/processes/identity/generated/free-law-project/entity 3 each)" | Those directory counts are **`coverage/` mirror-polluted** (lcov-report copies `src/` trees three times). Excluding `coverage/`: PascalCase 254, lowercase 59 (`entities` 19, `aggregates` 18, `values` 8, `internal` 6, `tools` 2, six singletons) | `find ... -type d -not -path '*/coverage/*'` |
| S5 | "v4 domain-kind folder usage is inconsistent per tier" | Confirmed and quantified: 21 kind-folder / 9 bare-concept / 3 flat non-domain packages; `workspace/server` mixes both (`aggregates/` + `SourceText/`) | `ls -d <pkg>/src/{aggregates,entities,values}/` |
| S6 | architecture-lab divergences | All confirmed; additionally `config/src/aggregates/WorkItem/WorkItem.layer.ts` (no config `.layer` role), `ui/src/aggregates/WorkItem/WorkItem.view-model.ts`, and concept-local `server.ts` in use-cases (copied by 5 other slices, 13 files) | `find packages/architecture-lab -path '*/src/*' -not -path '*/coverage/*'` |
| S7 | "$I identity in 380 v4 slice src files"; "index.ts 327"; barrels 120/641/30 | Confirmed exactly | `grep -rl 'const \$I = '`; `find -name index.ts`; `grep -h '^export \* as'` |
| S8 | "server Layer.ts (6 slices)"; "tables Tables.ts+ReadModels.ts only in law-practice" | Confirmed (6/7; `agents/server` lacks). Added: the other 6 tables packages split 3 `tables.ts` / 3 `Schema.ts` | §3.5 |
| S9 | v3 file counts, `index.ts` 347, `$I` 471, barrels 473/467/65 | Confirmed exactly. But v3 suffix census differs: `.contract` 72 (scout 38), `.errors` 61 (12), `.table` 41 (23), `.value` 26 (15), `.schema` 14 (11), `.schemas` 9 (4), `.service` 4 (2), and `.model` 39 is missing from the scout list; "1163 no role infix" → 608 non-index single-segment (v3 has 1478 src files, 347 index) | same commands in `~/YeeBois/projects/beep-effect4/packages` |
| S10 | Lint gates list of 16 | `Command.make` ids found: `circular`, `deprecated-apis`, `goal-packets`, `judge-rubric`, `reflection-artifacts`, `roadmap-refs`, `schema-topology`, `tooling-schema-first`; the rest exist as files registered elsewhere. The one casing rule in the repo (`pascal-case-file`, Lint.command.ts L279-284) applies to tooling CLI files only. Confirms "no file-role/suffix/casing/barrel gate" | `grep -rho 'Command\.make(\s*"[a-z-]*"' Lint/*.ts` |
| S11 | "test dirs are flat or have integration/" | Confirmed, plus ontology `server/test/fixtures/**` and `client/test/browser/__screenshots__/` | `find <pkg>/test -type d` |
| S12 | scout: `.processes.ts` not mentioned | New: `agents/use-cases/src/processes/{AssistantTurn,Chat,ProfessionalRuntime}/` is a sixth domain-kind folder that no doctrine names, and the doctrine itself disagrees on the tier for `.processes.ts` (A2) | `find agents/use-cases/src/processes -type f` |

## 7. What to enforce (uniformity only; architecture is decided)

Ordered by (already-uniform × cheap to gate):

1. `index.ts` per PascalCase concept folder (253/254) — a 10-line lint; fix the one miss.
2. `./internal/*: null` + no `./*` root wildcard in slice `package.json` (33/40, 38/40) — export-map check, the lane the doctrine already calls Hard Check.
3. Decide A1 once (kind folders in non-domain tiers: yes, matching the tree and the generator) and gate PascalCase concept dirs to live under `aggregates|entities|values` (21/32 today; migrating `epistemic`, `law-practice`, `agents/server`, `shared/use-cases` is a rename, not a redesign).
4. `<Concept>.<role>.ts` prefix rule inside concept dirs (404/509) with an explicit allowlist for the two sanctioned exceptions (`server.ts`/`worker.ts` concept entry files; A9) — do **not** gate the suffix vocabulary itself until the 19-unused/42-earned gap is resolved in doctrine.
5. Root composer casing: pick `tables.ts`-style subpath entry files (what 3/3 config and 3/7 tables already do) or `Tables.ts` (doctrine); one rename either way, then a check that `./<subpath>` targets `src/<subpath>.ts`.
6. Leave barrels (`export * as` vs `export *`), test mirroring, and src:test ratios ungated — the doctrine never claims them and v4 does not practise them.
