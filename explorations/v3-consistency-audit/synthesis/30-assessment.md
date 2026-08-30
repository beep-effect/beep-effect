# 30 — Assessment: what v3's uniformity really was, what to take, what to leave

> Judgment layer over the verified family tables (`20`–`25`) and the locked
> decisions (`../DECISIONS.md`). Row ids cite the tables; numbers are theirs.
> Lens: agent navigation — how many places an agent must look before it can
> act — weighed against v4's boundaries, which are not on the table.

## TL;DR

1. v3 was not one uniform grammar; it was **three regimes**: a scaffold-stamped
   domain tier (20/20 IAM entity folders share one 11-file shape; Knowledge has 19 persisted seven-role folders and 3 contract-only ones, `10` §2.1, `11` §2.2), a habit-copied server tier (suffix-less topical
   modules, `Live` 84%, `RepoLive` 39/39), and per-tier dialects everywhere
   else (kebab tables, kebab per-operation client folders, `.view/.form` ui).
   What we are porting is the *first* regime's discipline, mechanised.
2. v4 already ported the load-bearing half — PascalCase `<Concept>/<Concept>.<role>.ts`
   is 403/432 (93.3%, `frs-01` / `dir:concept-folder-file-prefix-agreement`; 404/438 = 92.2% counting role modules only, `CI-02`) with **no gate**.
   The drift is lexical (45 off-vocabulary suffixes, 3 spellings for handlers,
   `Live`/`Layer`, bare/`*Error`) and positional (kind folders 21/32, barrels
   19 namespaced / 8 flat / 1 mixed / 1 named-only), not structural. That is cheap to close and cheap to gate.
3. The worst v3 pattern was invisible to a presence check: 14/22 knowledge
   entities carried 3-line empty `rpc/http/tool` shells (`11` §1). A topology
   auditor that counts files would have blessed it. **Required roles are
   asserted; optional roles are never scaffolded empty.**
4. Every v4-only strength (ports/adapters split, `toPgTable` projection,
   `$I.annoteError` gate, explicit subpaths with `./internal/*: null`, coverage
   ratchet, `<Slice>ServerLive` composers) stays. Eighteen rows across the six families are `not-worth-porting` (grouped as D1–D10 in §3) because they cut across those boundaries or the casing decision.
5. Of the brief's nine hypotheses, five held, three held with a correction, one was wrong; the leading recommendation had the right instinct and the wrong host (table at the end).

## 1. What "uniform" meant in v3

| Regime | Where | What made it uniform | How uniform | Evidence |
| --- | --- | --- | --- | --- |
| Scaffold-stamped | `domain/src/entities/<C>/` | `create-slice` emitted the 7-role kit; authors copied the newest folder | 39/39 persisted concepts share the seven-role core; 14/22 knowledge entities hollow inside | `10` §1, `11` §1, `frs-01..07` |
| Habit-copied | `server/src/` (knowledge) | one author, one idiom: `Context.Tag($I\`X\`)` + same-file `<X>Live` | 55/55 Tag, 50/55 same-file Live, 167/189 files without a role suffix | `11` §3, `EL-09`, `EL-11`, `dir:server-topical-modules-no-suffix` |
| Per-tier dialect | tables, client, ui | each tier had its own casing and folder grammar | tables kebab 41/41 `.table.ts`; client kebab `<group>/<op>/{contract,handler,index,mod}.ts` 109/117; ui `.view/.form` + one `.from.tsx` typo shipped | `dir:file-basename-casing`, `dir:client-operation-folder-grammar`, `10` §3 |

Two more facts reframe the brief:

- **Nothing enforced any of it.** v3 had no file-role, casing, or barrel gate
  (`biome.jsonc` has 0 naming rules), and its own generator wrote repos to
  `server/src/db/repos/` while iam kept `server/src/entities/<C>/` — the code
  diverged from the scaffold that seeded it (`10` §2). Uniformity was copy
  discipline by a single author. That is exactly the property that does not
  survive agents writing in parallel.
- **The "near-1:1 test ratio" is a line ratio and a server-only fact.**
  knowledge/server: 52 tests / 189 src = 0.28 by file, 0.64 by LOC; 8/10 tier packages shipped the same 7-line `Dummy.test.ts`
  (`tests:placeholder-dummy-test`, `10` §5). v4's file placement is *more*
  uniform (169/169 under `test/`, gated by the vitest glob) and its LOC floors
  are ratcheted (`tests:coverage-ratchet`). What v3 had that v4 lacks is
  test *navigability* — the twin naming (`tests:name-twins-src-stem`, 40/52)
  and the `_shared/` helper quartet.

## 2. Likes — patterns worth adopting (through the navigation lens)

Each entry: the pattern, why it saves an agent tokens, the v4 status today,
and the decision that carries it. "Branching factor" = number of places an
agent must check before acting, today vs under the grammar.

| # | Pattern (rows) | Why it pays | Today → grammar | v4 status | Decision |
| --- | --- | --- | --- | --- | --- |
| L1 | One concept folder, files prefixed with the folder name (`frs-01`, `CI-01`, `CI-02`, `dir:concept-folder-file-prefix-agreement`) | Given one path, every sibling path is a substitution; no `ls` needed | prefix ≠ folder in 29/432 suffixed files (`frs-01`; 34/438 role modules, `CI-02`) → 0 | codified (93.3%), ungated | *proof vs doctrine* |
| L2 | Same kind folder in every tier (`dir:domain-kind-folders-non-domain-tiers`) | `server/src/<kind>/<C>/` is derivable from `domain/src/<kind>/<C>/`; without it an agent checks 3 candidate parents | 3 parents (`<C>/`, `entities/<C>/`, `aggregates/<C>/`) → 1 | codified-but-drifted, 66% | *kind folders* |
| L3 | Closed per-tier role vocabulary (`frs-03`, `frs-06`, `frs-07`, `frs-08`) | The suffix tells the reader what the file may do (DECISIONS 2026-04-21) only if the set is closed; 67 suffixes / 43 singletons means the suffix tells nothing | ports 2 spellings, handlers 3, facade 2 → 1 each | codified-but-drifted, 77.5% | *proof vs doctrine*, *.converters* |
| L4 | Barrel in every directory + namespace re-export at the kind barrel (`BN-01`, `BN-02`, `BN-03`) | `import { Membership } from "@beep/iam-domain/entities"` and `@beep/iam-domain/entities/Membership` both resolve without opening a file; collisions impossible across concepts | kind/tier barrels 19 namespace-only / 8 flat-only / 1 mixed / 1 named-only → 1 shape | drifted (no doctrine) | *barrel style* |
| L5 | `$I` on every schema-declaring module, keyed by path (`CI-06`, `CI-07`) | identity ↔ path bijection: an error tag or schema id names its file; a file names its ids | 61% presence (379/621), 81% path keys (308/379), 3 doctrine grammars → 100% on schema roles / 1 grammar | drifted — doctrine leaves `$I` optional and shows three key grammars | *`$I` gate* |
| L6 | One `<C>.errors.ts` beside the model (`EL-01`, `frs-05`) | errors for X are in exactly one file per tier; the port file stays a port | 8/20 port-owning concepts conform, 24 port-error classes inline (`EL-03`) → all | codified-but-drifted | *proof vs doctrine* |
| L7 | One spelling for Layer values and error names (`EL-12`, `EL-08`) | `…Live` vs `…Layer` vs bare adapter names (45 / 37 / 9, plus 4 `Test`) forces a grep per import; v3's `Live` 84% / `*Error` 98% was the *habit of one spelling* | Layer 3 spellings → 1; errors 2 → 1 by tier | drifted (no rule) | *Layer naming*, *error naming* |
| L8 | Test named after its src twin, one lens vocabulary, a shared helper home (`tests:name-twins-src-stem`, `tests:suffix-vocabulary`, `tests:shared-helpers-and-test-subpath`) | "tests for X" = one glob; 17 infix shapes / 11 singletons today | 17 shapes → 7 lenses; 56% twins → ratcheted to 100% for schema/service/port/repo roles | drifted | *test grammar* |
| L9 | Root entry files named for what they export (`dir:root-composer-casing`) | `exports` keys and file names coincide; the map is checkable | `tables.ts`/`Tables.ts`/`Schema.ts` 3/1/3 → 1 | codified-but-drifted | *entry casing* |
| L10 | Role-named members under the concept namespace — `User.Model`, `User.Table`, `User.Repo`, `User.RepoLive` (`BN-20`, `BN-21`, `BN-22`, `CI-08`) | every member of a concept is derivable from its name, so a generic construct over concepts becomes writable (v3's `typeof X.Model.select` parity check 20/20, `CI-09`; wiring tests over `C.RepoLive`) and the generator retargets paths, not identifiers (`TemplateRetarget.ts` L139-184 (path pass) / L186-262 (file-body pass) is a substring macro today) | two regimes — `shared` `Model` 4/4 + tables `Table` 23/32 vs 94/150 concept-named classes; 724 deep named imports vs 115 namespace imports → one member table | drifted (the doctrine example shows the concept-named class) | *namespace member vocabulary* (2026-08-30) |
| L11 | Operation = namespace node with `Contract` (`Payload`/`Success`/`Failure`) and `Handler` derived from it — `User.Get.Contract`, `User.Get.Handler`, `User.Rpcs` (`BN-23`, `BN-24`) | contract ⇒ handler ⇒ group are three substitutions on one name; an unimplemented contract is a visible rule violation instead of v3's hollow shell | 7 `.rpc.ts` with per-op prefixed symbols, 0 fixed members, hand-typed handler factories → one template per operation | missing | *operation contracts* (2026-08-30) |

The common thread: every "like" removes a *choice* an agent has to resolve by
reading. None of them changes an import boundary, a package dependency, or a
Layer graph. That is what "migrate the uniformity, not the architecture"
cashes out to.

## 3. Dislikes — v3 patterns not to port, and why

| # | Pattern (rows) | Why it stays in v3 | What v4 does instead |
| --- | --- | --- | --- |
| D1 | Two error homes: `entities/<C>/<C>.errors.ts` (HTTP 404/403 unions) + `errors/<C>.errors.ts` (engine errors), two `S.TaggedError` idioms (`EL-02`, `EL-04`, `EL-06`) | HTTP status baked into domain errors couples domain to transport; two homes means two greps | one home per tier; status assigned at the boundary (`09-errors`); one idiom, gated 82/82 by `$I.annoteError` (`EL-05`) |
| D2 | Fixed per-entity error kit `<C>NotFoundError` + `<C>PermissionDeniedError` + `Errors` union (`EL-07`, 39/39) | wrap-every-failure kits are noise; doctrine says create errors "when callers can make product decisions from the tag" | errors on demand, named for the condition |
| D3 | Contract + `Live` in one file; domain owns repo port tags (`EL-10`, `EL-11`, `frs-06`) | collapses the use-cases/server boundary; the port and its Postgres implementation become one import | port in `use-cases/<C>.ports.ts`, implementation in `server/<C>.repo.ts`, Layer in `<C>.layer.ts` (`EL-13`–`EL-15`) |
| D4 | `"./*": "./src/*.ts"` wildcard exports, root-as-API barrels, shim files (`BN-05`, `BN-06`, `BN-13`) | every file is public; 33 v3 subpaths resolved only through a tsconfig fallback; DECISIONS 2026-04-23 retires the wildcard | explicit subpaths, `./internal/*: null` 33/40, `.ts` specifiers 785/785 (`BN-09`–`BN-14`) |
| D5 | Per-operation client folders with fixed lowercase names, 629 files (`dir:client-operation-folder-grammar`, `BN-17`) | a folder grammar, not an absence of one (`10` §surprises) — but it multiplies files 4× per operation and hides the concept | `<C>.command-client.ts` / `.query-client.ts` / `.service.ts` / `.atoms.ts` per concept |
| D6 | Topical suffix-less server modules (`dir:server-topical-modules-no-suffix`; 167/189 knowledge-server files carry no role suffix, `11` §3) | the file name says nothing about the role; v3's server needed its `AGENTS.md` to explain itself, and that doc was stale (`11` §surprises) | concept folders with role suffixes in every tier |
| D7 | Flat kebab `tables/` + hand-maintained `_check.ts` parity (`dir:tables-flat-kebab-folder`, `CI-09`) | kebab breaks the casing decision; `_check.ts` covered 11/19 models and was referenced by no `.ts` file (`11` §surprises) | `toPgTable(Model)` makes parity structural (`CI-10`, 30/32), converters beside the table (`CI-11`) |
| D8 | `.entity.ts` cluster kit, `.schema(s).ts` roles, and *hollow* protocol scaffolds — 14/22 knowledge concepts shipped empty `rpc/http/tool` shells (`frs-09`, `frs-10`, `frs-14`) | a scaffold that writes every optional role yields uniform shape with empty content; the per-operation *layout* itself is kept (L11; DECISIONS *operation contracts*, 2026-08-30) — what is rejected is generating it hollow | use-cases `contracts/<Op>.contract.ts` + server `handlers/<Op>.handler.ts`, emitted only with a handler body (R12) |
| D9 | `Dummy.test.ts` placeholders (`tests:placeholder-dummy-test`) | a green test that tests nothing is worse than none; it hides the ratio | coverage ratchet + twin ratchet |
| D10 | Scaffold-everything (`add concept` writes every optional role) | this is how v3 got hollow shells; uniform shape, empty content | required roles only; optional roles via `add role`, never empty |

## 4. v4-only strengths to protect (do not regress while gating)

- **Boundary arrows with a partial hard check**: Fallow zones pin 3 direction
  rules (`14` §3). The auditor must not create a second, disagreeing model of
  package roles — reuse `Fallow.command.ts:classifyWorkspaceRole`.
- **Ports/adapters split by package** (`EL-10`, `EL-11`, `EL-13`–`EL-15`):
  every "like" above is a rename inside a tier, never a move across one.
- **Table as projection of the model** (`CI-10`) with converters (`CI-11`):
  admit `.converters` rather than fold it; it is the only place row↔model
  codecs are visible.
- **`$I.annoteError` equivalence gate** (`EL-05`, 82/82): the model for what a
  per-file gate looks like in this repo — extend `lint schema-first`'s
  pattern, do not invent a parallel one.
- **Explicit subpaths, `./internal/*: null`, `.ts` specifiers** (`BN-09`,
  `BN-12`, `BN-14`): the entry-file rule (L9) must be checked *against* the
  export map, not replace it.
- **Coverage ratchet and integration lane grammar** (`tests:coverage-ratchet`,
  `tests:integration-lane-grammar`): the twin ratchet is a second axis, not a
  replacement.
- **`<Slice>ServerLive` root composers** (`EL-13`, 6/6): already uniform beyond
  doctrine; the Layer-naming rule codifies it rather than changing it.

## 5. The brief's hypotheses, graded

| Hypothesis (brief) | Verdict | Evidence |
| --- | --- | --- |
| Path-grammar predictability held by habit, not tooling | **Held** — and v4 inherited the habit without the gate | `frs-01` 93.3%, 0 gates (`14` §3) |
| Near-1:1 test collocation ratio, no v4 ratchet | **Wrong on both halves** — 0.28 by file / 0.64 LOC, server-only; v4 ratchets LOC (`coverage.regression-baseline.jsonc`) | `11` §4, `tests:coverage-ratchet` |
| Uniform spine vs optional-by-need ambiguity | **Held with correction** — the ambiguity that matters is *inside* tiers (kind folders 21/32), not which tiers exist; `shared` is the only reduced spine | `dir:slice-spine-tier-packages`, `dir:domain-kind-folders-non-domain-tiers` |
| Boundary arrows + import ceilings are v4-only | **Held** — partially gated by Fallow zones | `14` §3 |
| Operation-plan CLI is v4-only | **Held, with a sting** — it is a template retargeter over a static manifest that hard-codes 9 off-doctrine names | `14` §1, `15` §3 |
| Family/kind grammar + small shared kernel are v4-only | **Held** | `12`, `BN-09`/`BN-10` |
| Casing schism unresolved | **Resolved before this packet** (DECISIONS 2026-04-21) and already 254 PascalCase / 0 kebab concept dirs; the gap was the gate | `dir:pascalcase-concept-folder`, `frs-19` |
| Fragmented enforcement, no existing-slice auditor | **Held** — 1 real / 4 scoped / 7 absent; `check` is plan-only and unwired | `14` §2–3 |
| Barrel/namespace discipline drifted and unchecked | **Held** — 19 namespace-only / 8 flat-only / 1 mixed / 1 named-only, no doctrine sentence | `BN-02`, `BN-03` |
| Leading recommendation: extend `check` into a topology auditor | **Right instinct, wrong host** — sibling `audit` (see `40` §pressure test) | DECISIONS *auditor shape* |
| Operator addendum (2026-08-30): v3's `User.Model` / `User.Table` / `User.Repo` member semantics are the missing consistency | **Held with correction** — v3 held it for model/repo/entity/errors/contracts (39/39 each) but *not* for tables (camelCase names, `.Table` 0); v4 inverted it (tables `Table` 23/32, models `Model` 4/150); the codegen claim is measured — `TemplateRetarget.ts` L139-184 (path pass) / L186-262 (file-body pass) is a substring macro over `WorkItem` | `BN-20`–`BN-22` |
| Operator addendum (2026-08-30): v3's `Contract`/`Handler` operation semantics are clean and portable onto v4's layout | **Held** — 72 contracts / 120 handler pairs on one template; v4 has the slots and none of the members; effect v4's `Rpc.make` / `RpcGroup.make` / `RpcClient.make` carry it without v3's `Wrapper` kit (a thin `Contract` kit remains) | `BN-23`, `BN-24` |

## 6. What this changes about how the gate must be built

- **Presence is not conformance.** Assert required roles (`.model`, `.errors`
  where errors exist, `.table` for persisted concepts, `index.ts`), assert
  vocabulary membership for everything else, and never scaffold optional
  roles empty. v3's hollow shells are the counter-example.
- **One vocabulary, two consumers.** The generator's manifest and the
  auditor's rules must read the same `LiteralKit`s or they drift apart again
  within a quarter — which is precisely what happened between the doctrine
  (2026-04-21) and the proof (2026-05-12).
- **Ratchet, never bulk.** `$I` keys are persisted tag strings; kind-folder
  moves rewrite public subpaths; Layer renames touch every consumer. Every
  rule launches with a baseline row per package and burns down in the slice
  PRs that already have to touch those files.
