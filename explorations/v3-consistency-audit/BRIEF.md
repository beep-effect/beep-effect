# BRIEF — v3-consistency-audit

> Shape Up anatomy at fat-marker fidelity. Every element below traces to a
> locked entry in [`DECISIONS.md`](./DECISIONS.md) and a measured row in
> [`synthesis/`](./synthesis/). The architecture does not change; the
> uniformity becomes mechanical.

## Problem

An agent opening a v4 slice cannot derive a file's location, purpose, or
public surface from its path alone. The doctrine writes one grammar
(`<tier>/src/<kind>/<Concept>/<Concept>.<role>.ts`, a 41-suffix vocabulary,
PascalCase composers, `/public` `/server` subpaths), the canonical proof the
CLI replays writes a second one (`WorkItem.repository.ts`, `WorkItem.http.ts`
in `server`, `tables.ts`, `layer.ts`), and the eight live slices write a
third by copying whichever they saw first. Measured on `main` `3435c24f94`:

- Kind folders in non-domain tiers: 21 packages yes (20 kind-only, 1 mixed), 8 bare, 3 flat
  (`synthesis/20`).
- Role suffixes: 67 distinct, 45 off-vocabulary, 43 singletons; 335/432
  suffixed files (77.5%) carry a tier-correct doctrine suffix (`synthesis/21`).
- Kind/tier barrels: 19 namespace-only, 8 flat-only, 1 mixed, 1 named-only; no doctrine sentence
  (`synthesis/22`).
- `$I` anchors on 61% of non-index files; three key grammars in the doctrine
  itself (`synthesis/23`).
- Tests: placement 100%, everything else a per-slice dialect — 17 name
  infix shapes, 11 singletons, 0 mirrored concepts (`synthesis/24`).
- Layer names `Live` 45 / `Layer` 37 / `Test` 4 / bare 9; error names bare 60 /
  `*Error` 22; 8 live Layer/composition values exported from `use-cases` against DECISIONS
  2026-04-23 (`synthesis/25`).
- Enforcement: of 12 slice-consistency conventions, one has a real gate
  (boundary direction, partial), four have narrow or scoped checks, seven have
  none. `beep architecture check` validates plan idempotency and is wired into
  nothing (`synthesis/14`).
- Symbol naming runs two regimes: `shared` exports `User.Model` (4/4) and
  23/32 tables export `Table`, while 94/150 domain model classes and every
  proof symbol are concept-named; consumers bypass the namespaces (724 deep
  named imports vs 115 namespace imports) and the generator retargets by
  substring (`TemplateRetarget.ts` L139-184 (path pass) / L186-262 (file-body pass)) (`synthesis/22` BN-20–22).
- Operations have slots but no members: 7 `.rpc.ts` files with per-op
  prefixed symbols, 0 fixed `Payload`/`Success`/`Failure`/`Contract`/`Handler`
  exports, hand-typed handler factories; v3 held 72 contracts and 120 handler
  pairs on one template (`synthesis/22` BN-23–24).

v3 held its uniformity socially — a single author copying a scaffold (20/20
entity folders identical, `RepoLive` 39/39, `Live` 84%) with zero gates and
its own generator already diverged from the code (`synthesis/10`, `11`). That
does not scale to agents writing slices in parallel. The habit has to become
a gate.

Why now: every `beep architecture add concept` copies the proof's nine
divergences (`synthesis/15`), so drift compounds with each new concept, and
the next slices (`iam`, `knowledge`) are the largest the repo will build.

## Appetite

Two goal packets (DECISIONS *follow-up packaging*, *appetite*):

| Packet | Budget | Shape |
| --- | --- | --- |
| `slice-topology-audit` | ~1 week, one PR train | amendments PR → `beep architecture audit` + baseline PR → ci lane PR |
| `canonical-proof-reconciliation` | ~2–3 weeks, 1 PR per slice | manifest + `architecture-lab` PR first, then eight slice PRs; leftovers live in `follow_ups`, never block |

The budget constrains the solution: the auditor reuses existing walkers and
schemas (no new lint framework), the rule set is closed `LiteralKit`
vocabularies (no heuristics), and every migration is a baseline delta (no
big-bang rename).

The 2026-08-30 addenda (role-member vocabulary, operation contracts) add
symbol renames and `.rpc.ts` → per-op contract conversion to every
reconciliation PR; the budgets above hold — addenda work that does not fit
a slice PR lands in that slice's `follow_ups` rows and never extends the
budget. The per-slice cost is UNMEASURED today (724 deep-import sites
repo-wide) and is measured by the proof PR's audit delta, not re-estimated.

## Solution Sketch

### The grammar, as a schema

One path type for every slice file. Each `∈` is a closed `LiteralKit`; the
auditor asserts membership, nothing fuzzier.

```txt
SliceFile  = packages/<slice>/<tier>/src/<kind>/<Concept>/<Concept>.<role>.ts
  tier     ∈ { domain, use-cases, config, server, tables, client, ui }
  kind     ∈ { aggregates, entities, values }            -- every tier (DECISIONS: kind folders)
  Concept  = PascalCase, equal to its folder name        -- decided casing
  role     ∈ RoleVocabulary[tier]                        -- ARCHITECTURE.md L969-1129
                                                         --   + tables `.converters`
                                                         --   + server `.<port-name>` where
                                                         --     port-name ∈ ports declared in
                                                         --     use-cases/<Concept>.ports.ts
EntryFile  = packages/<slice>/<tier>/src/<subpath>.ts
  subpath  = key of package.json#exports minus "."      -- lowercase, name = subpath
TestFile   = packages/<slice>/<tier>/test/**/<Concept>.<lens>.test.ts
  lens     ∈ { test, pglite.test, pg.test, e2e.test, equivalence.test,
               contract.test, schema-parity.test }
Barrel     : <kind>/index.ts  and  <tier>/src/index.ts  = export * as <Concept> from "./<Concept>/index.ts"
             <Concept>/index.ts                          = export * from "./<Concept>.<role>.ts" …
Identity   : const $I = $<Pkg>Id.create("<kind>/<Concept>/<Concept>.<role>")   -- schema roles only
LayerName  : <Port>[<Adapter>]Live | <Port>Test | <Port>InMemory | <Slice>ServerLive
ErrorName  : domain/use-cases bare tag (MembershipNotFound); drivers *Error
Member     : <Concept>.<role>.ts exports RoleMember[tier][role]   -- Model | Id | Errors | Repo | RepoShape
                                                                  --   | Service | Rpcs | Config | RepoLive | Live
                                                                  --   | Test | RpcsLive | Table | Row | Insert
                                                                  --   | Client | ViewModel   (DECISIONS 2026-08-30)
                                                                  -- the namespace carries the concept:
                                                                  --   User.Model, User.Table, User.Repo
Operation  = <Concept>/contracts/[<Group>/]<Op>.contract.ts      -- use-cases: Payload, Success, Failure,
                                                                  --   Contract = Rpc.make(<Op>, {payload, success, error})
             <Concept>/handlers/[<Group>/]<Op>.handler.ts        -- server: Handler, typed from Contract
             <Concept>/index.ts  += export * as <Op>              -- User.Get.Contract / User.Get.Handler
             <Concept>.rpc.ts    -> Rpcs = RpcGroup.make(<Op>.Contract, …)   -- User.Rpcs
```

What the grammar buys: given any one path, an agent derives every sibling
(`domain/…/Membership.model.ts` ⇒ `tables/…/Membership.table.ts`,
`use-cases/…/Membership.ports.ts`, `server/…/Membership.repo.ts`,
`test/**/Membership.*.test.ts`) and every import site
(`Entities.Membership.Model`, `@beep/iam-domain/entities/Membership`) and
every operation (`Membership.Revoke.Contract` ⇒ `Membership.Revoke.Handler` ⇒
`Membership.Rpcs`) without opening a file.

### The auditor

`beep architecture audit [--slice <name>] [--tier <tier>] [--json] [--write-baseline]`
in the Architecture command group (DECISIONS *auditor shape*):

- **Walks** existing slice packages via the package-discovery and TypeScript
  walkers already in `Lint` (`collectTypeScriptFiles`) and `@beep/repo-utils` (`resolveWorkspaceDirs` /
  `resolveWorkspacePackages`, the brick Fallow already walks with; Fallow's
  private `classifyWorkspaceRole` promoted to an exported `LiteralKit`-typed
  classifier), not the plan.
- **Asserts** one rule per grammar line above, keyed `family/kind/tier` so
  driver and foundation anchors are a later rule pack (DECISIONS *audit
  scope*). Plus one existing-decision rule: no exported `Layer` value under
  `use-cases/src/**` (DECISIONS 2026-04-23).
- **Emits** a schema-versioned report and a baseline, both `S.Class` in
  `Architecture.schemas.ts` next to the operation-plan schemas:

```txt
AuditReport   { schemaVersion: "architecture-audit-report/v1",
                packages: [{ name, slice, tier,
                             findings: [{ rule: RuleId, status: codified | drifted | missing,
                                          path, expected, actual }] }] }
AuditBaseline { schemaVersion: "architecture-audit-baseline/v1",
                counts: { [package]: { [rule]: number } },
                follow_ups: [{ package, rule, owner?, note }] }
```

- **Ratchets** against `standards/architecture.audit-baseline.jsonc`
  (DECISIONS *rollout*) through the shared `cli/src/internal/ratchet`
  substrate (`diffMembership` / `diffTotals` / `enforceRatchet` — the code
  behind the coverage, knip, JSDoc and test-typecheck ratchets): non-zero exit
  only when a package's count for a rule
  exceeds its baseline; `--write-baseline` regenerates after a burn-down PR.
- **Hooks** into `beep lint policy` / `beep:preflight` and a
  `ci lane architecture-audit` registered in `CiLane.ts`'s closed lane
  registry (the `knip` lane is the template); which context is *required*
  is DEFERRED (`audit lane host`).
- **Shares** its vocabularies with the generator: `add role` accepts only
  `RoleVocabulary[tier]` members, `add concept` emits kind folders in every
  tier, and the `AcceptedProofManifest` is itself audited (a proof file
  outside the grammar fails the CLI's own tests).

### The reconciliation

1. `AcceptedProofManifest.ts` + `architecture-lab`: `.repository`→`.ports`,
   `.use-cases`→`.service`, server `.http/.rpc/.tools`→`.*-handlers`, port
   errors → `<C>.errors.ts`, `tables.ts` gains `.converters`, `config/src/…`
   stays lowercase, `Layer.ts`→`layer.ts`, Layer values → `…Live`.
2. One PR per slice, in baseline-count order (epistemic and law-practice
   first: kind folders in every non-domain tier), each PR ending with
   `audit --write-baseline` and a shrinking `follow_ups`.

### Doctrine amendments (P0 of the audit packet)

Recorded as `standards/architecture/DECISIONS.md` entries, then applied to
`ARCHITECTURE.md`, `13`, `09`, `10`, `08`, `05`: kind folders in every tier
(reconcile the `13/09/10` examples with the tree); entry-file rule; tables
`.converters`; test lens grammar + twin rule; barrel shape; `$I` key grammar;
Layer and error naming; per-concept `<Concept>/server.ts` subpath — decide
admit-or-forbid (15 `server.ts`/`worker.ts` shims across 6 slices, undocumented;
DEFERRED `BN-12`, DECISIONS *deferred rows*); `.processes.ts` tier
(ARCHITECTURE says use-cases, `10` says server; agents invented a
`processes/` kind folder).
Added by the 2026-08-30 addenda: the role-member vocabulary (and the
`ARCHITECTURE.md` L1778 / `04-rich-domain-model.md` L213 example fixed to
`export class Model …`); the operation contract quartet + `Handler`
derivation, with `contracts/` and `handlers/` as the two admitted sub-folders
inside a concept and the `Contract` kit home.

## Rabbit Holes

- **Open-ended server suffix.** Doctrine allows `.<port-name>.ts` in
  `server`. Closed vocabulary ∪ *declared* port names (parsed from the
  slice's `use-cases/**/<Concept>.ports.ts`) keeps it checkable; anything else
  is drift. Do not reach for a regex over "looks like a port".
- **Kind-folder moves change public subpaths.** `entities/X` ⇒
  `./entities/X` in `package.json#exports`; the codemod must rewrite exports
  and consumers together (`TsconfigSync` only re-derives aliases). The audit
  checks `exports ↔ folders` so a half-moved package is a finding, not a
  runtime surprise.
- **Concept reclassification** (entity → aggregate) now renames across up to
  seven packages. Accepted cost of one grammar; the codemod should be a
  `beep architecture move concept --kind` follow-up, not hand edits.
- **`shared` has a reduced spine** and `shared/use-cases` is contract-only;
  the walker keys rules by package role so `shared` is not flagged for
  missing tiers.
- **Renaming `$I` keys changes tag strings** that may be persisted (workflow
  activity names, error tags in stored JSON). Ratchet, never bulk-rewrite;
  check `EntityId`/`annoteError` consumers before each rename.
- **The doctrine's `.contract.test.ts` suite has zero files** in either repo;
  adding the lens to the vocabulary does not create the tests. Twin ratchet
  counts any lens.
- **Coverage-directory pollution.** Every count here excludes
  `coverage/`; the walker must too (the scout's first numbers were polluted,
  `synthesis/12` §surprises).
- **A second `Fn`.** `@beep/schema/Fn` already attaches a schema triad as
  statics (`SchemaUtils.withStatics`) with `implement*` helpers; the
  `Contract` kit is a sibling of that construction over `Rpc.make`, not a
  fork of `Fn`. The one live `contracts/` folder (`drivers/govinfo`
  `Search.contract.ts`: `Payload`/`Success`/`Failure` against
  `HttpApiEndpoint`) is reconciled by the amendment, not left as a third
  dialect.

## No-Gos

- No return to v3 architecture: no HTTP/RPC/tool declarations in `domain`,
  no `.entity.ts` cluster kit, no fixed per-entity error kit, no
  contract + `Live` in one file, no `"./*": "./src/*.ts"` wildcard exports or
  shim files, no per-operation client folders (`synthesis/20`–`25`
  `not-worth-porting` rows).
- No casing relitigation (PascalCase concept folders are decided).
- No overloading `beep architecture check`; the `architecture-operation-plan/v1`
  replay contract is untouched.
- No hard gate on day one; no hand-maintained allowlist.
- No non-slice families in the first audit (drivers/foundation/tooling
  anchors are a later rule pack).
- No `standards/` edits inside this exploration packet; amendments are P0 of
  `slice-topology-audit`.
- No mirrored `test/` directories; no new test lenses without a vocabulary
  change.
