# 10 — v3 IAM slice convention inventory

Source: `~/YeeBois/projects/beep-effect4/packages/iam` (v3, archived 2026-02-22, HEAD `997a827454`).
All counts below were produced with `find`/`rg`/`awk`/`sed` on that checkout on 2026-08-29; every
command was run from `~/YeeBois/projects/beep-effect4/packages/iam` unless a path says otherwise.
`node_modules`, `dist`, `coverage`, `.turbo` were excluded everywhere (none exist under `src/`).

## TL;DR

1. The domain tier is machine-uniform: 20 entity folders, each with exactly the same 7 role files (`.model/.entity/.errors/.http/.rpc/.tool/.repo`) plus `contracts/{Get,Delete,index}.ts` — 20/20 on every axis, only formatting noise between them; 4/20 add a `schemas/` folder.
2. Uniformity is habit, not enforcement: v3 has no file-role, casing, or barrel gate (biome.jsonc has 0 naming rules), and its own `create-slice` scaffold puts repos at `server/src/db/repos/` while iam keeps them at `server/src/entities/<C>/` — iam diverged from the generator that seeded it. The only compile-enforced link is `tables/src/_check.ts` (model ↔ table shape).
3. Each tier speaks its own casing dialect: domain/server = PascalCase concept dirs and files; tables = kebab-case files; client = kebab-case folder grammar with 4 fixed lowercase filenames (`contract/handler/index/mod.ts`, 109/117 leaf folders); ui = kebab-case with `.view/.form` suffixes (and one `.from.tsx` typo).
4. The server tier is thinner than the scout assumed: no `rpc/`, no HTTP handlers, no root `Layer.ts` — only `adapters/better-auth`, `db/`, and 20 `<C>.repo.ts` `RepoLive` layers; the server entity set overlaps the domain set only 16/20 (4 OAuth* domain repos have no live layer; 4 shared-domain entities get iam repos).
5. Tests are effectively absent: 6 test files / 980 src files (0.6%), 390 / 33,589 LOC (1.2%); 5 of the 6 are the identical 7-line `Dummy.test.ts` placeholder.

## 1. Package spine

| path | command | result |
| --- | --- | --- |
| `packages/iam/{domain,tables,server,client,ui}` | `ls` each tier | 5/5 tiers carry the identical skeleton: `AGENTS.md ai-context.md CLAUDE.md docgen.json LICENSE package.json README.md reset.d.ts src test tsconfig.json tsconfig.build.json tsconfig.src.json tsconfig.test.json` |
| `*/package.json` | `grep '"name"'; awk '/"exports"/,/^  \}/'` | names `@beep/iam-{domain,tables,server,client,ui}`; exports map identical 5/5: `".": "./src/index.ts"`, `"./package.json"`, `"./*": "./src/*.ts"` |
| `~/…/beep-effect4/tsconfig.base.jsonc` | `rg -n '"@beep/iam-[a-z]+(/\*)?"' -A1` | every tier has `@beep/iam-X` → `src/index` and `@beep/iam-X/*` → `src/*` (L250–281) |
| src files per tier | `find <t>/src -type f \( -name '*.ts' -o -name '*.tsx' \) \| wc -l` | domain 233, tables 26, server 55, client 629, ui 37 (total 980) |
| src LOC per tier | `find … -exec cat {} + \| wc -l` | domain 4,270; tables 1,172; server 2,089; client 24,836; ui 1,222 |

Consequence of `"./*": "./src/*.ts"`: a subpath import of a *directory* needs a same-named sibling file. That is the whole reason `domain/src/entities.ts` (`export * from "./entities/index";`) and `server/src/db.ts` (`export * from "./db/index";`) exist. It is **not** applied uniformly: `@beep/iam-server/db/Db` (imported by `server/src/adapters/better-auth/Options.ts`) and `@beep/iam-client/_internal` (imported by every client `contract.ts`) have no `src/db/Db.ts` / `src/_internal.ts` shim (`test -f` → NO for both) and resolve only through the tsconfig `paths` directory-index fallback.

| importer census (v3 repo-wide, `rg -l … packages apps`) | count |
| --- | --- |
| `@beep/iam-domain/entities` | 13 files |
| `from "@beep/iam-domain"` (root) | 30 files |
| `@beep/iam-server/db` | 32 files |
| `@beep/iam-server/entities` | 0 files |

## 2. Directory grammar per tier

### 2.1 domain

```
domain/src/
  index.ts            -> export * as Entities from "./entities";        (1 line; values NOT exported)
  entities.ts         -> export * from "./entities/index";              (subpath shim)
  entities/index.ts   -> 20 x `export * as <C> from "./<C>"` + `export { Team, Organization, User, Session }` re-exported from @beep/shared-domain/entities
  entities/<C>/       -> 20 PascalCase concept folders (grammar below)
  values/index.ts     -> 0 bytes (`wc -c` = 0), never exported
```

| path | command | result |
| --- | --- | --- |
| `domain/src/entities/*/` | `find $d -type f` per folder | 20 folders; every one contains `<C>.model.ts <C>.entity.ts <C>.errors.ts <C>.http.ts <C>.rpc.ts <C>.tool.ts <C>.repo.ts contracts/Delete.contract.ts contracts/Get.contract.ts contracts/index.ts index.ts` |
| `domain/src/entities/*/schemas/` | `find entities -type d -name schemas \| wc -l` | 4/20 (DeviceCode, Invitation, Member, Passkey); 5 `*.schema.ts` files total |
| `domain/src/entities/*/contracts/` | `find entities -type d -name contracts \| wc -l` | 20/20; each has exactly Get + Delete (no Create/Update/List anywhere) |
| `domain/src` dirs | `find . -type d` | only `entities`, `values`, 20 concept dirs, 20 `contracts`, 4 `schemas`; **no `errors/` dir** (`test -d errors` → NO) |
| `domain/src/values/index.ts` | `wc -c` | 0 bytes; scaffold residue |

File-count reconciliation: 20 × 11 + 9 schema-folder files + 4 root files = 233 (matches).

### 2.2 tables

```
tables/src/
  index.ts          -> export * as IamDbSchema from "./schema";
  schema.ts         -> export * from "./relations"; export * from "./tables";
  schema-object.ts  -> hand-maintained `Schema = { account, accountRelations, … }` object (94 lines, includes shared organization/session/team/user/file)
  relations.ts      -> 21 drizzle `relations(...)` (306 lines)
  _check.ts         -> 40 compile-time `typeof X.Model.{select,insert}.Encoded = {} as Infer{Select,Insert}Model<typeof tables.x>` (160 lines)
  tables/index.ts   -> 25 x `export * from` (20 local + 5 re-exports from @beep/shared-tables/tables/*.table)
  tables/<kebab>.table.ts x 20
```

| path | command | result |
| --- | --- | --- |
| `tables/src/tables/*.table.ts` | `ls tables \| grep -cE '^[a-z][a-z0-9-]*\.table\.ts$'` | 20/20 kebab-case; the only non-matching entry is `index.ts` |
| same | `rg -o '(OrgTable\|Table)\.make\(' … \| sort \| uniq -c` | `OrgTable.make(` 9, `Table.make(` 11 → 20/20 use a shared factory keyed by `IamEntityIds.<C>Id` |
| same | derived camel vs `export const` name | 1 mismatch: `device-codes.table.ts` exports `deviceCode` (expected `deviceCodes`) |
| `tables/src/relations.ts` | per-table `rg -q "^export const <name>Relations"` | 17/20 iam tables have a relations block; `jwks`, `rateLimit`, `verification` do not |
| `tables/src/_check.ts` | `rg -o 'typeof (\w+)\.Model\.select' \| sort -u` | 20 entities checked = 19/20 iam (**ScimProvider missing**) + `User` (shared) |
| `tables/src` | `rg -l '\$I = '` | 0 files use `$I` |

### 2.3 server

```
server/src/
  index.ts                     -> export * from "./adapters"; export * from "./db";   (entities NOT exported)
  db.ts                        -> export * from "./db/index";                           (subpath shim)
  db/index.ts                  -> export * from "./Db"; export * as IamRepos from "./repositories";
  db/Db/index.ts               -> export * as IamDb from "./Db";
  db/Db/Db.ts                  -> class Db extends Context.Tag($I`Db`); export const layer = Layer.scoped(Db, …)
  db/repositories.ts           -> type Repos = union of 20 Entities.<C>.Repo; export const layer = Layer.mergeAll(20 x <C>Live.RepoLive)
  entities/index.ts            -> 20 x `export * as <C>Live from "./<C>"`
  entities/<C>/{index.ts,<C>.repo.ts} x 20
  adapters/index.ts            -> export * as Auth from "./better-auth";
  adapters/better-auth/{BetterAuthBridge,Emails,Options,Service,types,utils,index}.ts + tmp.txt (0 bytes, stray)
```

| path | command | result |
| --- | --- | --- |
| `server/src` | `find . -type f \| sort` | 55 files; **no `rpc/`, no `http/`, no `Layer.ts`, no `Api.ts`** |
| `server/src/entities/*/` | shape census | 20/20 folders are exactly `{index.ts, <C>.repo.ts}` |
| server vs domain entity sets | compare `ls entities` | overlap 16/20: server **omits** OAuthAccessToken, OAuthClient, OAuthConsent, OAuthRefreshToken (their domain `Repo` tags have no `RepoLive`) and **adds** Organization, Session, Team, User (owned by `@beep/shared-domain`) |
| `server/src/entities/*/*.repo.ts` | `rg -n '^export const RepoLive'` | 20/20 export `RepoLive: Layer.Layer<Entities.<C>.Repo, never, DbClient.SliceDbRequirements> = Layer.effect(Entities.<C>.Repo, DbRepo.make(IamEntityIds.<C>Id, Entities.<C>.Model)).pipe(Layer.provide(IamDb.layer))` |
| `server/src` non-entity layers | `rg -n '^export const layer'` | 3/3 (`db/Db/Db.ts`, `db/repositories.ts`, `adapters/better-auth/Service.ts`) use lowercase `layer` |
| `server/src` `$I` | `rg -l '\$I = \$IamServerId.create'` | 3 files (`db/Db/Db.ts`, `adapters/better-auth/Emails.ts`, `…/Service.ts`); path == file path 1/3 (`"db/Db"` for `db/Db/Db.ts`; `"adapters/better-auth/Auth"` for `Service.ts`) |

### 2.4 client

```
client/src/
  index.ts            -> 13 x `export { X } from "./x"` + 7 x `export * as X from "./x"` + `export * from "./adapters"`  (mixed styles in one file)
  adapters/better-auth/{client,errors,types,index}.ts
  _internal/          -> 20 files: *.schemas.ts (9), *.helpers.ts (2), common.{atom,types,utils}.ts, errors.ts, runtime.ts, captcha-middleware.ts, wrap-iam-method.ts, index.ts
  <group>/            -> 21 kebab-case groups (admin, anonymous, api-key, connections, core, device, email-verification, jwt, multi-session, one-time-token, organization, passkey, password, phone-number, sign-in, sign-up, sso, two-factor, username) + auth-callback.ts
  <group>/{index.ts, layer.ts, mod.ts}[, service.ts][, atoms.ts][, form.ts]
  <group>/[<subgroup>/]<operation>/{contract.ts, handler.ts, index.ts, mod.ts}
```

| path | command | result |
| --- | --- | --- |
| leaf operation folders | census of dirs with no subdirs (excluding `_internal/adapters/core`) | 117 leaves: **109** = `contract.ts handler.ts index.ts mod.ts`; 3 = `index layer mod` (sub-group shells); 2 = `contract index mod` (no handler); 1 = `contract handler mod` (no index); 2 = `_common` schema dirs |
| group-level dirs | census of non-leaf dirs | 24/24 have `index.ts layer.ts mod.ts`; 15/24 add `service.ts`; 8 add `atoms.ts`; 3 add `form.ts` |
| basenames | `find . -type f \| awk -F/ '{print $NF}' \| sort \| uniq -c` | index 155, mod 150, contract 122, handler 120, layer 28, service 15, atoms 8, form 3, errors 2, then 20 singletons |
| `index.ts` → `mod.ts` | `grep -l 'from "./mod.ts"'` | 149/155 index files are the one-liner `export * as <Pascal> from "./mod.ts"`; the 6 exceptions are root, `_internal`, `adapters` (×2), and the two `_common` dirs |
| `contract.ts` | `rg --files-without-match 'W\.Wrapper\.make' -g contract.ts` | 119/122 export a `W.Wrapper.make(...)`; exceptions `connections/account-info`, `organization/add-team-member`, `multi-session/list-sessions` |
| `handler.ts` | same for `Wrapper\.implement` | 119/120; exception `connections/account-info` |
| `layer.ts` exports | `grep -hE '^export (const\|class)'` | `layer` 27, `Group` 19, plus 9 named `<X>Group` (`OrganizationGroup`, `ApiKeyGroup`, …) |
| `service.ts` exports | same | `class Service` 11, `runtime` 10, and trailing-underscore aliases (`List_` 3, `Create_` 2, `Update_`, `Delete_`, …) next to un-suffixed re-exports |
| imports use explicit `.ts` extensions | e.g. `organization/mod.ts` | `export * as Access from "./access/mod.ts"` — client-only habit; domain/server/tables use extension-less specifiers |
| `_internal` vs `_common` suffix | basename census | `_internal/*.schemas.ts` (plural, 9 files) vs `organization/_common/*.schema.ts` and `two-factor/_common/user.schema.ts` (singular, 5 files) |
| dir casing | census | kebab-case 83 + single-word lowercase 69 + `_prefixed` 3; **0 PascalCase dirs** |

### 2.5 ui

| path | command | result |
| --- | --- | --- |
| `ui/src` | `find . -type f \| sort` | 37 files: `_common/` (4), `_components/` (+`social-icons/`, 16), `sign-in/{email,passkey,social}`, `sign-up/{email,social}`, `types/` |
| `ui/src/index.ts` | `cat` | `export * from "./sign-in"; export * from "./sign-up";` — `_common`, `_components`, `types` are not exported |
| suffixes | census | `.view.tsx` 2 (`sign-in.view.tsx`, `sign-up.view.tsx`), `.form.tsx` 2, **`.from.tsx` 1** (`sign-in/social/sign-in-social.from.tsx`, a typo that its `index.ts` faithfully re-exports), unsuffixed `sign-in/email/{email.ts,form.tsx}`, `sign-up/email/form.tsx` |
| casing | census | files kebab 21 + lowercase 5; dirs kebab 3 + lowercase 6 + `_prefixed` 2; `$I` 0 |

## 3. File-role suffix set and uniformity

Command: `find <t>/src -type f \( -name '*.ts' -o -name '*.tsx' \) | awk -F/ '{n=$NF; sub(/\.tsx?$/,"",n); c=split(n,a,"."); print (c>=2?a[c]:"<single>")}' | sort | uniq -c`

| suffix | domain | tables | server | client | ui | total | concept coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `.contract` | 40 | | | | | 40 | 20/20 entities × {Get, Delete} |
| `.repo` | 20 | | 20 | | | 40 | domain 20/20 (Context.Tag), server 20/20 (`RepoLive`) — but server set ≠ domain set (16 overlap) |
| `.model` | 20 | | | | | 20 | 20/20 |
| `.entity` | 20 | | | | | 20 | 20/20 |
| `.errors` | 20 | | | | | 20 | 20/20 |
| `.http` | 20 | | | | | 20 | 20/20 |
| `.rpc` | 20 | | | | | 20 | 20/20 |
| `.tool` | 20 | | | | | 20 | 20/20 |
| `.table` | | 20 | | | | 20 | 20/20 (kebab-case file names) |
| `.schema` | 5 | | | 5 | | 10 | domain 4/20 concepts; client 2 `_common` dirs |
| `.schemas` | | | | 9 | | 9 | client `_internal` only |
| `.view` | | | | | 2 | 2 | ui |
| `.form` | | | | | 2 | 2 | ui (+1 `.from` typo) |
| `.helpers` | | | | 2 | | 2 | client `_internal` |
| `.utils` / `.types` / `.atom` / `.from` | | | | 1/1/1 | 0/0/0/1 | 4 | singletons |
| single-segment | 48 | 6 | 35 | 610 | 32 | 731 | see note |

Single-segment note: of the 731, 241 are `index.ts` (domain 47, tables 2, server 26, client 155, ui 11). The remaining 490 are dominated by the client's fixed vocabulary (`mod` 150, `contract` 122, `handler` 120, `layer` 28, `service` 15, `atoms` 8, `form` 3 = 446) — i.e. the client encodes the role in the *filename* rather than in a suffix. Only ~44 files are genuinely free-form (server adapters, tables root, ui components).

Per-role structural uniformity in domain (command: per-entity `sed "s/$C/<C>/g" … | md5sum`, then `diff` against Member):

| role file | present | distinct normalized variants | nature of variance |
| --- | ---: | ---: | --- |
| `index.ts` | 20/20 | 5 | line ordering (`Contracts` first vs last) and the extra `export * from "./schemas"` in 4 |
| `<C>.entity.ts` | 20/20 | 2 | trailing newline only; all `ClusterEntity.fromRpcGroup("Entity", Rpcs).annotateRpcs(ClusterSchema.Persisted, true)` |
| `<C>.http.ts` | 20/20 | 3 | one-line vs multi-line chain (Jwks); all `HttpApiGroup.make("<kebab-plural>")…prefix("/<kebab-plural>")` (20 distinct group names, 20 distinct prefixes) |
| `<C>.rpc.ts` | 20/20 | 2 | trailing newline |
| `<C>.tool.ts` | 20/20 | 2 | trailing newline |
| `<C>.repo.ts` | 20/20 | 3 | trailing newline; all `Context.Tag($I\`Repo\`)<Repo, DbRepo.DbRepoSuccess<typeof Model>>` |
| `contracts/index.ts` | 20/20 | 2 | trailing newline |
| `contracts/Get.contract.ts` | 20/20 | 3 | Payload written inline vs multi-line; all `S.TaggedRequest` + static `Rpc`/`Tool`/`Http` triple (40/40 across Get+Delete) |
| `contracts/Delete.contract.ts` | 20/20 | 7 | one-line vs multi-line `Failure` union (13 multi-line, 7 one-line); error names differ only by concept |
| `<C>.model.ts` | 20/20 | n/a (fields differ) | 20/20 `M.Class<Model>($I\`<C>Model\`)(makeFields(IamEntityIds.<C>Id, …))` with `static readonly utils = modelKit(Model)`; 20 distinct `IamEntityIds.<C>Id` |
| `<C>.errors.ts` | 20/20 | n/a | 20/20 contain exactly 2 `S.TaggedError` classes: `<C>NotFoundError` (404) + `<C>PermissionDeniedError` (403), both via `$I.annotationsHttp`, plus `export const Errors = S.Union(…)` (20/20) |
| `schemas/*.schema.ts` | 5 files | — | `BS.StringLiteralKit` 5/5; `$I` 1/5; `schemaId: Symbol.for(...)` 3/5 — the one place inside domain where a convention is only habitual |

## 4. Barrel (`index.ts`) style per level

Command: `find <t>/src -name index.ts -exec cat {} + | grep -c '^export \* as '` (and `'^export \* from '`, `'^export \{'`).

| tier | index.ts files | `export * as X from` | `export * from` | `export {` named | pattern |
| --- | ---: | ---: | ---: | ---: | --- |
| domain | 47 | 122 | 108 | 1 | concept dirs are namespaced (`export * as Member`), role files flattened (`export * from "./Member.model"`), except `errors` → `export * as MemberErrors`, `rpc` → `export * as Rpcs`, `contracts` → `export * as Contracts`; the single `export {` re-exports shared entities |
| tables | 2 | 1 | 25 | 0 | `index.ts` namespaces once (`IamDbSchema`); `tables/index.ts` flattens all 25 |
| server | 26 | 23 | 27 | 0 | `entities/index.ts` namespaces as `<C>Live`; `db/Db/index.ts` as `IamDb`; `db/index.ts` as `IamRepos`; per-entity index flattens |
| client | 155 | 155 | 23 | 19 | 149/155 are the one-liner `export * as <Pascal> from "./mod.ts"`; real composition lives in `mod.ts` (145 `export * from`, ~100 named `export {`, ~60 `export * as`); root `index.ts` mixes 13 named + 7 namespaced + 1 star |
| ui | 11 | 1 | 20 | 5 | flattening `export * from "./x.tsx"`; `social-icons/index.ts` uses named exports; `sign-in/email/index.ts` alone namespaces (`Email`) |
| **iam total (index.ts only)** | 241 | 302 | 203 | 25 | |
| **iam total (all src files)** | — | 402 | 353 | 211 | non-index `export {` come from client `mod.ts` |

## 5. Concept collocation: how `Member` is spread across tiers and what links it

| hop | path | link token | evidence |
| --- | --- | --- | --- |
| id + table name | `~/…/beep-effect4/packages/shared/domain/src/entity-ids/iam/ids.ts` | `const make = EntityId.builder("iam"); export const AccountId = make("account", { brand: "AccountId", actions: [...] })` | table name lives on the EntityId (`Ids.MemberId.tableName` is consumed by `entity-ids/iam/table-name.ts`) |
| model | `domain/src/entities/Member/Member.model.ts` | `makeFields(IamEntityIds.MemberId, {...})`; `$I = $IamDomainId.create("entities/Member/Member.model")` | 20/20 |
| repo contract | `domain/src/entities/Member/Member.repo.ts` | `Context.Tag($I\`Repo\`)<Repo, DbRepo.DbRepoSuccess<typeof Member.Model>>` | 20/20 |
| transport contracts | `domain/src/entities/Member/contracts/Get.contract.ts` | `Success = { data: Member.Model.json }`, `Failure = MemberErrors.MemberNotFoundError`, static `Rpc/Tool/Http` | 40/40 |
| group surfaces | `Member.http.ts` / `Member.rpc.ts` / `Member.tool.ts` / `Member.entity.ts` | all built from `contracts` (`Get.Contract.Http`, `.Rpc`, `.Tool`; `Entity = ClusterEntity.fromRpcGroup("Entity", Rpcs)`) | 20/20 |
| table | `tables/src/tables/member.table.ts` | `OrgTable.make(IamEntityIds.MemberId)({...})`; enums via `Member.makeMemberRolePgEnum("member_role_enum")` imported from `@beep/iam-domain/entities` | `OrgTable.ts` L174/L217 derive `_org_fk` and RLS policy names from `entityId.tableName` |
| model ↔ table proof | `tables/src/_check.ts` | `typeof Member.Model.select.Encoded = {} as InferSelectModel<typeof tables.member>` (+ insert) | 19/20 iam entities (ScimProvider missing) |
| live repo | `server/src/entities/Member/Member.repo.ts` | `DbRepo.make(IamEntityIds.MemberId, Entities.Member.Model)` → `RepoLive` for `Entities.Member.Repo`, provided `IamDb.layer` | 20/20 server folders |
| composition | `server/src/db/repositories.ts` | `type Repos = Entities.Member.Repo \| …` (20) and `Layer.mergeAll(Live.MemberLive.RepoLive, …)` | hand-maintained list |
| client | `client/src/organization/…` | **no link**: client contracts are `W.Wrapper.make` shapes over Better Auth responses using `_internal/*.schemas.ts`, not the domain `Model` | `Common.Team`, `Common.IamError` |

So the concept is glued by (a) `IamEntityIds.<C>Id` at 4 sites (model, table, server repo, contract payload), (b) the `Entities.<C>` namespace exported from `domain/src/entities/index.ts`, and (c) `_check.ts`. The `$I` strings are documentation/identity only — nothing resolves by them.

## 6. `$I` identity convention

Command: `rg -l '\$I = \$\w+\.create\(' <t>/src | wc -l`; path fidelity via `awk` comparing the `create("…")` argument with the file path minus `src/` and extension.

| tier | files with `$I` | namespace | argument == file path | argument == containing dir | notes |
| --- | ---: | --- | ---: | ---: | --- |
| domain | 101 / 233 | `$IamDomainId` | 100 | 0 | carriers: model 20, errors 20, repo 20, contract 40, schema 1; the 1 mismatch is `DeviceCodeStatus.schema.ts` → `"entities/DeviceCode/schemas/DeviceCodeStatus"` (drops `.schema`) |
| tables | 0 / 26 | — | — | — | |
| server | 3 / 55 | `$IamServerId` | 1 | 1 | `Service.ts` uses `"adapters/better-auth/Auth"` (neither file nor dir) |
| client | 151 / 629 | `$IamClientId` | 33 | 118 | `contract.ts` uses the **directory** (117/121, e.g. `"organization/create-team"`), `service.ts` uses the **file path** (11/11), `_internal` schemas are mixed (7 file-path, 9 other) |
| ui | 0 / 37 | — | — | — | |
| **iam total** | 255 src (257 incl. test) | | | | scout's 471 for iam+knowledge reproduces as 257 + 217 = 474 |

Two competing `$I` grammars coexist inside one slice: domain = "path to file", client = "path to operation folder". The v3 `create-slice` scaffold itself emits the folder form (`$I.create("entities/Placeholder")`, `file-generator.ts` L569), so domain's file-path form is a later hand refinement.

## 7. Error conventions

| path | command | result |
| --- | --- | --- |
| `domain/src/entities/*/*.errors.ts` | `grep -c 'extends S.TaggedError'` per file | 20/20 files, exactly 2 classes each (40 total) |
| same | `rg -o 'export class (\w+Error)'` | 20 × `<C>NotFoundError` + 20 × `<C>PermissionDeniedError`; no other error kinds in the slice |
| same | `rg -c annotationsHttp` | 20/20 use `$I.annotationsHttp(name, { status, description })` (404 / 403) |
| same | `rg -l '^export const Errors = S\.Union'` | 20/20 |
| `domain/src/errors/` | `test -d` | **absent** — iam does not duplicate errors at slice root |
| `~/…/beep-effect4/packages/knowledge/domain/src/errors/` (contrast) | `ls *.errors.ts \| wc -l` | knowledge has 22 root-level + 19 per-entity `.errors.ts`; iam has 0 + 20 |
| client | basename census | `_internal/errors.ts` (IamError) and `adapters/better-auth/errors.ts` — single-segment, no `.errors` suffix |

## 8. Layer conventions (server)

| where | symbol | count | shape |
| --- | --- | ---: | --- |
| `server/src/entities/<C>/<C>.repo.ts` | `export const RepoLive` | 20/20 | `Layer.Layer<Entities.<C>.Repo, never, DbClient.SliceDbRequirements> = Layer.effect(Tag, DbRepo.make(...)).pipe(Layer.provide(IamDb.layer))` |
| `server/src/db/Db/Db.ts` | `export const layer` | 1 | `Layer.scoped(Db, serviceEffect)` |
| `server/src/db/repositories.ts` | `export const layer: RepoLayer` | 1 | `Layer.mergeAll(20 × <C>Live.RepoLive)` |
| `server/src/adapters/better-auth/Service.ts` | `export const layer` | 1 | `Layer.effect(Service, AuthEffect).pipe(Layer.provide(AuthEmailService.Default))` |
| `server/src/entities/index.ts` | `export * as <C>Live` | 20 | namespace carries the `Live` suffix, not the file |
| client `layer.ts` | `export const layer` 27, `Group` 19 | 28 files | client "layers" are `@beep/wrap` groups, not Effect Layers |

No root `Layer.ts`, no `Api.ts`, no `Rpc.ts`, no `Tools.ts`, no handlers: the domain's `Http`/`Rpcs`/`Toolkit`/`Entity` groups have no server implementation in this slice (`rg -l 'Entities\.\w+\.Http\|Rpcs\.toLayer\|Toolkit' server/src` → 0 hits).

## 9. Tests

| tier | src files | test files | test paths | src LOC | test LOC |
| --- | ---: | ---: | --- | ---: | ---: |
| domain | 233 | 1 | `test/Dummy.test.ts` | 4,270 | 7 |
| tables | 26 | 1 | `test/Dummy.test.ts` | 1,172 | 7 |
| server | 55 | 1 | `test/Dummy.test.ts` | 2,089 | 7 |
| client | 629 | 2 | `test/Dummy.test.ts`, `test/_internal/transformation.test.ts` | 24,836 | 362 |
| ui | 37 | 1 | `test/Dummy.test.ts` | 1,222 | 7 |
| **total** | 980 | 6 | | 33,589 | 390 |

All tests live under `<tier>/test/` (0 under `src/`, `find */src -name '*.test.*'` → 0). The five `Dummy.test.ts` are byte-identical 7-line `bun:test` placeholders (`expect(true).toBe(true)`). The one real test mirrors its source folder (`test/_internal/` ↔ `src/_internal/`) and imports via `@beep/shared-domain` / `@beep/testkit`.

## 10. Enforcement

| check | command | result |
| --- | --- | --- |
| root lint config | `ls -a ~/…/beep-effect4 \| grep -iE 'biome\|eslint\|dependency-cruiser\|knip'` | `biome.jsonc`, `knip.config.ts` only; no eslint, no dependency-cruiser |
| biome naming rules | `rg -n -i 'naming\|filename' biome.jsonc` | 0 hits |
| root lint scripts | `rg -n '"(lint\|check\|lint:[a-z-]+)":' package.json` | `lint` = syncpack + turbo `lint lint:circular`; nothing structural |
| tooling that references role suffixes | `rg -l '\.(model\|repo\|table)\.ts' tooling` | only `tooling/cli/src/commands/create-slice/utils/file-generator.ts` (a generator, not a checker) |
| `create-slice` scaffold inventory | `rg -o '^ \* Generates (.*)$'` | domain: `index.ts`, `entities.ts` shim, `values/index.ts`, `entities/index.ts`, `entities/Placeholder/{index,Placeholder.model}.ts`; tables: `schema.ts`, `tables/index.ts`, `tables/placeholder.table.ts`, `relations.ts`, `_check.ts`; server: `db/{index,Db/index,Db/Db,repos/index,repos/_common,repos/Placeholder.repo,repositories}.ts`; `test/Dummy.test.ts`; entity-ids `{ids,any-id,table-name,index}.ts`; `tsconfig.slices/{slice}.json` |
| scaffold vs iam drift | compare | scaffold emits **one** role file (`.model.ts`) per entity and repos under `server/src/db/repos/`; iam has 7 role files per entity and repos under `server/src/entities/<C>/`. The 20/20 uniformity was propagated by hand/copy, not by the generator |
| compile-enforced links | `tables/src/_check.ts` | the only mechanical consistency gate (model ↔ table, 19/20 + User) |
| other CLI commands | `ls tooling/cli/src/commands` | `agents-validate`, `context-freshness`, `docgen`, `find-missing-docs`, `tsconfig-sync`, `verify`, … — none inspect file roles, casing, or barrels |

## 11. Casing schism inside v3 iam (fact, not a recommendation)

Command: per-tier `find … | awk` classifying names as PascalCase / kebab-case / single-word lowercase / `_prefixed`.

| tier | directories | file basenames (first segment, `index.ts` excluded) |
| --- | --- | --- |
| domain | PascalCase 20 (concepts), lowercase 26 (`entities`, `values`, `contracts`×20, `schemas`×4) | PascalCase 185, lowercase 1 (`entities.ts`) |
| tables | lowercase 1 (`tables`) | kebab 14, lowercase 9, `_check` 1 — **kebab-case file for a PascalCase concept** |
| server | PascalCase 21, kebab 1 (`better-auth`), lowercase 3 | PascalCase 25, lowercase 4 (`db.ts`, `types.ts`, `utils.ts`, `tmp.txt`) |
| client | kebab 83, lowercase 69, `_prefixed` 3, **PascalCase 0** | lowercase 468, kebab 6, **PascalCase 0** |
| ui | kebab 3, lowercase 6, `_prefixed` 2 | kebab 21, lowercase 5 |

Three dialects coexist: PascalCase concept folders + `<Concept>.<role>.ts` (domain/server), kebab `<concept>.table.ts` (tables), and kebab `<group>/<operation>/{contract,handler,index,mod}.ts` (client/ui). The `export * as` barrels re-PascalCase the kebab client folders (`export * as CreateTeam from "./mod.ts"`), so the public namespace is PascalCase everywhere even though the filesystem is not.

## 12. Uniformity ledger

| convention | applied N/M | verdict |
| --- | --- | --- |
| Tier package skeleton (13 files) | 5/5 tiers | uniform |
| `exports` map `"./*": "./src/*.ts"` | 5/5 | uniform |
| Directory subpath shim file (`entities.ts`, `db.ts`) | 2 of ≥4 directory subpaths in use | habitual |
| Domain `entities/<C>/` PascalCase folder | 20/20 | uniform |
| 7 role files per entity (`.model/.entity/.errors/.http/.rpc/.tool/.repo`) | 20/20 each (140/140) | uniform |
| `contracts/{Get,Delete,index}.ts` per entity | 20/20 | uniform |
| `schemas/` per entity | 4/20 | optional-by-need |
| `schemas/*.schema.ts` carry `$I` | 1/5 | absent |
| `$I = $IamDomainId.create("<file path>")` on model/errors/repo/contract | 100/101 path-faithful | uniform |
| `M.Class` + `makeFields(IamEntityIds.<C>Id)` + `modelKit` | 20/20 | uniform |
| Errors: exactly `<C>NotFoundError` + `<C>PermissionDeniedError` + `Errors` union + `annotationsHttp` | 20/20 | uniform |
| No root `domain/src/errors/` duplication | 0 root files vs 20 per-entity | uniform (opposite of knowledge) |
| Domain entity `index.ts` line set | 20/20 (5 formatting variants) | uniform |
| Domain barrel: namespace concepts, flatten roles, namespace `Errors/Rpcs/Contracts` | 20/20 | uniform |
| `values/` exported from domain root | 0/1 (empty file) | absent |
| Table files kebab-case `<concept>.table.ts` | 20/20 | uniform |
| Table export name = camel(file) | 19/20 | habitual (`device-codes` → `deviceCode`) |
| Table built via `OrgTable.make`/`Table.make(IamEntityIds.<C>Id)` | 20/20 | uniform |
| `<name>Relations` per table | 17/20 | habitual |
| `_check.ts` select+insert pair per entity | 19/20 iam (+User) | habitual |
| `schema-object.ts` entry per table/relation | hand-maintained (26 tables incl. shared) | habitual |
| Server `entities/<C>/{index.ts,<C>.repo.ts}` | 20/20 | uniform |
| Server entity set == domain entity set | 16/20 | habitual |
| Server `RepoLive` name + `Layer.effect(...).pipe(Layer.provide(IamDb.layer))` | 20/20 | uniform |
| Server non-repo layers named lowercase `layer` | 3/3 | uniform |
| Server `$I` path == file path | 1/3 | absent |
| Server exposes rpc/http/tool handlers for domain groups | 0/20 | absent |
| Client group folder `{index,layer,mod}.ts` | 24/24 | uniform |
| Client group `service.ts` | 15/24 | habitual |
| Client leaf op `{contract,handler,index,mod}.ts` | 109/117 | uniform-with-exceptions |
| Client `index.ts` = `export * as X from "./mod.ts"` | 149/155 | uniform |
| Client `contract.ts` exports `W.Wrapper.make` | 119/122 | uniform-with-exceptions |
| Client `handler.ts` = `Wrapper.implement(...)` | 119/120 | uniform-with-exceptions |
| Client `$I` = operation directory (contract) | 117/121 | uniform |
| Client `$I` = file path (service) | 11/11 | uniform (but a different rule than contract) |
| Client `.schemas` (plural) vs `.schema` (singular) | 9 vs 5 | schism |
| Client explicit `.ts` import extensions | mod/index/handler files | habitual (client-only) |
| Root client `index.ts` single export style | 13 named / 7 namespaced / 1 star | absent |
| UI `.view.tsx` / `.form.tsx` suffixes | 2 + 2 of 7 leaf components (1 `.from` typo, 3 unsuffixed) | habitual |
| Tests under `<tier>/test/` | 6/6 | uniform |
| Real tests present | 1/5 tiers | absent |
| Structural lint/gate for any of the above | 0 | absent (only `_check.ts` is compile-enforced) |

## 13. Surprises vs scout facts

1. **Server has no `rpc/`, no HTTP handlers, no `Layer.ts`.** The scout's "server: entities/<Concept>/<Concept>.repo.ts + rpc/<op>.ts" does not hold for iam (`find server/src -type f` → 55 files, all under `adapters/`, `db/`, `entities/`, plus `index.ts`/`db.ts`). The domain's `Http`/`Rpcs`/`Toolkit`/`Entity` groups are unimplemented in this slice; the server's only behaviour is the Better Auth adapter.
2. **iam does not duplicate errors at `domain/src/errors/`.** `test -d domain/src/errors` → NO; 0 root error files vs 20 per-entity. Knowledge does (22 root + 19 per-entity). The scout's "Domain errors also duplicated" is a knowledge-only fact.
3. **Server entity set ≠ domain entity set.** 16/20 overlap: the four OAuth* domain concepts have `Repo` tags but no `RepoLive`; Organization/Session/Team/User (owned by `@beep/shared-domain`) get iam `RepoLive` layers and appear in `entities/index.ts`, `repositories.ts`, `_check.ts` (User) and `schema-object.ts`.
4. **iam diverged from its own scaffold.** `create-slice` emits repos at `server/src/db/repos/<C>.repo.ts` and only a `.model.ts` per entity with folder-level `$I.create("entities/Placeholder")`; iam has `server/src/entities/<C>/`, 7 role files, and file-level `$I`. The 20/20 uniformity is copy discipline, not generator output.
5. **Client single-segment files are a grammar, not an absence.** The scout's "1163 src files have NO role infix" reads as chaos; in iam 446 of the 490 non-index single-segment files are the fixed client vocabulary (`mod/contract/handler/layer/service/atoms/form`), applied 109/117 on leaf folders and 24/24 on groups.
6. **Two `$I` grammars in one slice.** Domain = file path (100/101); client `contract.ts` = operation directory (117/121) while client `service.ts` = file path (11/11). The scout counted 471 `$I` files across iam+knowledge; iam alone is 257 (255 src) and knowledge 217, so the aggregate reproduces (474).
7. **Barrel counts.** Scout: 473 `export * as` / 467 `export * from` / 65 `export {` for iam+knowledge. iam alone is 302 / 203 / 25 counting `index.ts` only, but 402 / 353 / 211 across all src files — the `export {` figure explodes once client `mod.ts` files (the real barrels; `index.ts` is a one-line alias) are included. Any barrel census must decide whether `mod.ts` counts as a barrel.
8. **Scaffold residue and typos survive with no gate:** `domain/src/values/index.ts` is 0 bytes and unexported; `server/src/adapters/better-auth/tmp.txt` is a 0-byte stray; `ui/src/sign-in/social/sign-in-social.from.tsx` (`.from`, not `.form`); `device-codes.table.ts` exports `deviceCode`; `ScimProvider` is missing from `_check.ts`; `jwks`/`rateLimit`/`verification` lack relations. All five tiers ship an identical 7-line `Dummy.test.ts`.
9. **Subpath shims are not a convention.** Only `domain/src/entities.ts` and `server/src/db.ts` exist; `@beep/iam-server/db/Db` and `@beep/iam-client/_internal` (used by 121 client contracts) resolve through tsconfig `paths` directory-index fallback with no shim file.
10. **The one compile-enforced consistency mechanism in v3 is `tables/src/_check.ts`** (`typeof <C>.Model.select.Encoded = {} as InferSelectModel<typeof tables.<c>>`). Nothing else — not biome, not knip, not the CLI — checks file roles, casing, barrels, or $I paths.
