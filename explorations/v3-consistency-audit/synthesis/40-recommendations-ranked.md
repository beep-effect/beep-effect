# 40 — Adoption recommendations, ranked by leverage

> Leverage = (navigation choices removed × drift prevented) ÷ migration cost,
> tie-broken by "unblocks other items". Every item names one primary
> mechanism, an implementable sketch anchored in existing CLI code, the
> doctrine decision it depends on (locked in `../DECISIONS.md`; recorded in
> `standards/architecture/DECISIONS.md` by the follow-up, not here), a
> rollout, and a risk. Row ids cite `20`–`25`. Mechanisms:
> `architecture-cli-audit` (a rule in `beep architecture audit`),
> `architecture-cli-scaffold` (generator/manifest change), `ratchet`
> (baseline file + lane), `doctrine-amendment` (prerequisite text change).

## Ranked list

### R1 — The vocabulary becomes schemas, and both the generator and the auditor read them

- **Patterns:** `frs-03`, `frs-06`–`frs-08`, `frs-12`, `frs-18`, `dir:domain-kind-folders-non-domain-tiers`, `dir:root-composer-casing`, `tests:suffix-vocabulary`, `BN-20`, `BN-23`
- **Mechanism:** `doctrine-amendment` → `architecture-cli-scaffold`
- **Leverage:** Highest. Every other item asserts membership in a set; until
  the set is a `LiteralKit` next to `ArchitectureSliceRole`, the auditor and
  the generator each carry their own copy and drift apart (the 2026-04-21
  doctrine vs 2026-05-12 proof gap, `15` §2). Unblocks R2–R12.
- **Sketch:** in `packages/tooling/tool/cli/src/commands/Architecture/Architecture.schemas.ts`
  add `RoleVocabulary = { domain: LiteralKit([...]), "use-cases": …, config: …, server: …, tables: … (+ "converters"), client: …, ui: … }`,
  `DomainKind` (already `ArchitectureDomainKind`), `TestLens = LiteralKit(["test","pglite.test","pg.test","e2e.test","equivalence.test","contract.test","schema-parity.test"])`,
  `LayerNameShape`, `EntryFileRule`, plus (2026-08-30 addenda) `RoleMember` — tier × role → required export names (`domain.model → ["Model"]`, `tables.table → ["Table"]`, `server.repo → /^Repo(\w+)?Live$/`, …) — and `ContractMember = LiteralKit(["Payload", "Success", "Failure", "Contract"])`, `HandlerMember = LiteralKit(["Handler"])` (R6a, R6b). Server suffix check = `RoleVocabulary.server ∪ portNamesDeclaredIn(<slice>/use-cases/**/*.ports.ts)`.
  `add role` (`Architecture.command.ts`) validates `--role` against
  `RoleVocabulary[tier]` instead of accepting any string.
- **Prerequisite decisions (locked):** kind folders every tier; doctrine
  beats proof; entry casing; `.converters`; test grammar; barrel style;
  Layer/error naming. Plus two forks the follow-up must close in
  `standards/architecture/DECISIONS.md`: per-concept `<Concept>/server.ts`
  subpath (15 `server.ts`/`worker.ts` shims across 6 slices, undocumented, `BN-12`/`frs-21`) and the `.processes.ts`
  tier (`12` §surprises).
- **Rollout:** amendments PR first (P0 of `slice-topology-audit`).
- **Risk:** transcription error between text and `LiteralKit`. Mitigate with a
  doc test that renders the vocabularies into the doctrine tables (docgen
  already runs `**Example**` blocks).

### R2 — `beep architecture audit` with a day-one baseline ratchet and a required lane

- **Patterns:** all `codified-but-drifted` / `drifted` rows; `14` §2–3 gap list
- **Mechanism:** `architecture-cli-audit` + `ratchet`
- **Leverage:** Turns every rule below from a doctrine sentence into a
  regression gate. The only way "habit" becomes "law" for parallel agents.
- **Sketch:** new subcommand in `Architecture.command.ts` beside `check`:
  `audit [--slice] [--tier] [--json] [--write-baseline]`. Walk packages via
  `@beep/repo-utils` `resolveWorkspaceDirs` / `resolveWorkspacePackages` (`Workspaces.ts` L120/L303 — the brick Fallow already walks with; the earlier NET-NEW extraction of `Lint/PackageTestImports.ts`'s private `collectPackageSourceRoots` is withdrawn) and `Lint/Lint.command.ts:collectTypeScriptFiles` (symlink-safe,
  excludes `coverage/`/`dist/`); classify tier via
  `Fallow.command.ts:classifyWorkspaceRole` (extend with `use-cases`, `client`,
  `config`). Rules are pure functions `(PackageView) => ReadonlyArray<Finding>`
  keyed by `family/kind/tier`. Report and baseline are `S.Class` schemas:
  `architecture-audit-report/v1`, `architecture-audit-baseline/v1`
  (`counts[package][rule]`, `follow_ups[]`). Exit non-zero only on
  `count > baseline`, computed through `cli/src/internal/ratchet`
  (`diffMembership` L71 / `diffTotals` L241 / `enforceRatchet` L67 — the
  substrate behind `CoverageRegression`, `KnipRatchet`, `JSDocRatchet`,
  `PackageTestTypecheck`, `SchemaFirstScan`, `Goals/Doctor`). Hook:
  `rootRepoLintPolicySteps` (`Quality/Tasks.ts` L2075), `beep:preflight`
  (`package.json`), `ci lane architecture-audit` registered in `CiLane.ts`
  (`CiLaneId` L164-204, `bunRunStep` L679; clone the `knip` lane, its
  `check.yml` job and `GithubChecks.ts` row), yeet `verify` tier; the
  required-context host is DEFERRED (*audit lane host*).
- **Prerequisite decisions (locked):** auditor shape; rollout; audit scope.
- **Rollout:** command + baseline PR (P1), lane PR (P2). Baseline generated
  from `main`; every current drift is a counted `follow_ups` row.
- **Risk:** a second package-role model disagreeing with Fallow. Mitigate by
  importing Fallow's classifier, not re-deriving it.

### R3 — Reconcile the canonical proof (manifest + `architecture-lab`)

- **Patterns:** the nine divergences in `15` §1 (`frs-06`, `frs-07`, `frs-08`,
  `frs-16`, `EL-03`, `dir:root-composer-casing`, `BN-11`), plus `.converters`
  (`CI-11`)
- **Mechanism:** `architecture-cli-scaffold`
- **Leverage:** Every `add concept` copies the manifest verbatim
  (`TemplateRetarget.ts` renames only concept/slice tokens, `15` §3), so this
  is the one change that stops *new* drift. Cost: UNMEASURED ESTIMATE ~35 renames (14 manifest line locations in `AcceptedProofManifest.ts`, `15` §2, plus their fixture and consumer sites; count before the PR).
- **Sketch:** edit `internal/AcceptedProofManifest.ts` paths and the lab
  files: `WorkItem.repository.ts` → `WorkItem.ports.ts` (port errors move to
  `WorkItem.errors.ts` in use-cases), `WorkItem.use-cases.ts` →
  `WorkItem.service.ts`, server `WorkItem.http.ts/.rpc.ts/.tools.ts` →
  `.http-handlers.ts/.rpc-handlers.ts/.tool-handlers.ts` (declarations stay
  in use-cases under the bare names), `tables/src/tables.ts` keeps its name
  (entry rule) and gains `WorkItem.converters.ts` / `Worker.converters.ts`,
  `server/src/Layer.ts` → `layer.ts`, `config/src/aggregates/WorkItem/WorkItem.layer.ts`
  → `WorkItem.config.ts` only (config Layer goes to `layer.ts`), client `WorkItem.client.ts` → `WorkItem.service.ts` (client facade; split into `.command-client.ts`/`.query-client.ts` only when two transports exist), ui `WorkItem.view-model.ts` → admitted as ui `.view-model.ts` (pure `.ts` view projection) — both DEFERRED-with-recommendation in `../DECISIONS.md`, ratified in P0 before this PR. Regenerate
  `test/architecture-operation-plan.test.ts` fixtures; assert v1 plans still
  decode (`architecture-operation-plan/v1` is a replay contract).
- **Prerequisite decisions (locked):** proof vs doctrine; entry casing;
  `.converters`; Layer naming. Deferred with recommendation: client `.service.ts`, ui `.view-model.ts` (`../DECISIONS.md` *deferred rows*).
- **Rollout:** first PR of `canonical-proof-reconciliation`; the CLI's own
  tests then assert the manifest is audit-clean.
- **Risk:** fixture churn in `architecture-operation-plan.test.ts`. Content
  changes, not schema changes — keep v1.

### R4 — Kind folders in every tier (rule + codemod)

- **Patterns:** `dir:domain-kind-folders-non-domain-tiers`, `CI-01`
- **Mechanism:** `architecture-cli-audit` (rule `dir/kind-folder`) + codemod
- **Leverage:** Removes the largest positional branching factor (3 candidate
  parents → 1) and makes every sibling path a substitution of the domain
  path. 21/32 packages already conform.
- **Sketch:** rule: every PascalCase concept folder under `<tier>/src/` has a
  parent ∈ `ArchitectureDomainKind`; every `exports` subpath naming a concept
  is `./<kind>/<Concept>`. Codemod (`ts-morph`, already a writer kind):
  `git mv <tier>/src/<C>` → `<tier>/src/<kind>/<C>` where `kind` is read
  from the slice's `domain/src/<kind>/<C>`; rewrite `package.json#exports`,
  the tier barrel, and consumers; run `beep tsconfig-sync`.
- **Prerequisite decisions (locked):** kind folders. Doctrine: reconcile
  `13`/`09`/`10` examples with the tree.
- **Rollout:** ratcheted; epistemic (4 tiers) and law-practice (2) first.
- **Risk:** public subpath change for consumers outside the slice; the audit's
  `exports ↔ folders` check makes a half-move a finding.

### R5 — Concept folder ↔ file prefix ↔ role vocabulary (the core rule)

- **Patterns:** `frs-01`, `frs-02`, `frs-03`, `frs-19`, `CI-02`,
  `dir:concept-folder-file-prefix-agreement`, `dir:pascalcase-concept-folder`
- **Mechanism:** `architecture-cli-audit` (rules `role/prefix-equals-folder`,
  `role/suffix-in-vocabulary`, `role/required-roles-present`)
- **Leverage:** The pattern v4 already holds at 92.2% with no gate; the
  cheapest large win. Locks the casing decision in mechanically (the only
  PascalCase lint today is scoped to the tooling CLI, `14` §3).
- **Sketch:** for each file under `<tier>/src/<kind>/<Concept>/`: basename
  matches `^<Concept>\.(<role>)\.tsx?$` with `role ∈ RoleVocabulary[tier]`
  (server: ∪ declared port names), or is `index.ts`, or is an admitted
  per-concept entry (`server.ts` — pending the fork decision). Required
  roles: domain `.model` (`frs-04`, 146/152 today); tables `.table` for
  persisted concepts; `index.ts` everywhere (253/254). Off-vocabulary
  singletons (`.gate`, `.fetch`, `.kernel`, `.inspector`, `.workbench`, …)
  become findings with the nearest vocabulary role suggested.
- **Prerequisite decisions (locked):** casing (brief), proof vs doctrine.
- **Rollout:** ratcheted; 34 prefix mismatches and 97 off-vocabulary files
  as baseline rows.
- **Risk:** legitimate new roles blocked. Path: a vocabulary change is a
  one-line `LiteralKit` edit plus a DECISIONS entry — cheap by design.

### R6 — Barrel shape, completeness, and `exports ↔ folders`

- **Patterns:** `BN-01`, `BN-02`, `BN-03`, `BN-07`, `BN-16`
- **Mechanism:** `architecture-cli-audit` (rules `barrel/present`,
  `barrel/namespace-at-kind-tier`, `barrel/complete`, `exports/subpath-per-concept`)
- **Leverage:** Makes `Entities.Membership.Model` and
  `@beep/x-domain/entities/Membership` both derivable; prevents cross-concept
  name collisions; a dangling barrel becomes visible (knip cannot see it,
  `22` §3).
- **Sketch:** reuse `Lint/SchemaTopology.ts`'s export-map and concept-index
  regexes (currently pinned to `packages/foundation/modeling/schema`) as a
  generic walker: `<kind>/index.ts` lines must be
  `export * as <Concept> from "./<Concept>/index.ts"` for every child folder;
  `<tier>/src/index.ts` re-exports every kind; `package.json#exports` has
  `./<kind>/<Concept>` for every concept folder and `./internal/*: null`.
- **Prerequisite decisions (locked):** barrel style. Doctrine: one sentence
  on barrel shape (none exists).
- **Rollout:** ratcheted; 8 flat-only + 1 mixed + 1 named-only barrels (shape rule) and 16 missing kind barrels (29/45 present, `BN-02`, presence rule) as separate baseline rows.
- **Risk:** consumers importing flattened names break on the rewrite; do it
  per slice with the codemod updating import sites.

### R6a — Role-member vocabulary: the namespace carries the concept

- **Patterns:** `BN-20`, `BN-21`, `BN-22`, `CI-08`, `CI-10`, `CI-13`
- **Mechanism:** `doctrine-amendment` → `architecture-cli-audit` (rules
  `member/required` per role file, `member/no-concept-prefix` for `.values`)
  → `architecture-cli-scaffold`
- **Leverage:** By leverage this sits between R1 and R2; it is numbered R6a
  to keep the cross-references above stable. It is what makes R6's namespaces
  an API at all (724 deep named imports vs 115 namespace imports today,
  because `export * as WorkItem` yields `WorkItem.WorkItem`); it removes the
  generator's identifier macro (`TemplateRetarget.ts` L139-184 (path pass) / L186-262 (file-body pass) → path and
  `$I`-key rewriting only); and it is the precondition for any generic
  construct over concepts (v3's `typeof X.Model.select` parity check, `CI-09`;
  wiring tests over `C.RepoLive`). v4 already runs it in `shared`
  (`User.Model` 4/4, 85 sites) and in tables (`Table` 23/32, 81 sites).
- **Sketch:** `RoleMember` next to `RoleVocabulary` in
  `Architecture.schemas.ts` (the table in `../DECISIONS.md` *namespace member
  vocabulary*); the audit reads each role file's `export (class|const|function)`
  names with `ts-morph` (already a CLI dependency) and asserts the required
  members are present and that `.values.ts` exports do not start with the
  concept name; `AcceptedProofManifest` + `architecture-lab` are rewritten to
  the members (`class Model`, `const Table`, `Repo`/`RepoLive`, `Client`) so
  `add concept` emits them, and `TemplateRetarget` drops its
  `replaceAll(sourceConcept, …)` passes.
- **Prerequisite decisions:** *namespace member vocabulary* (locked); the
  member table and three sub-choices (`Repo` vs `Repository`, values bare +
  `Id`, client `Client`) ratified in P0; doctrine example fix
  (`ARCHITECTURE.md` L1778, `04-rich-domain-model.md` L213 →
  `export class Model …`).
- **Rollout:** with R3 for the proof; per slice with R6's codemod — rename the
  symbol, rewrite every deep import site to namespace access
  (`import * as User` / `Entities.User.Model`) in the same PR; baseline rows
  per (slice, role).
- **Risk:** 724 deep-import sites repo-wide (UNMEASURED per slice); member
  names must be collision-free within one tier's concept namespace
  (`Model` vs a value also called `Model`); `_tag` strings are unaffected
  because `$I` keys carry the path (R8).

### R6b — Operation contracts: `<C>.<Op>.Contract` / `.Handler` / `<C>.Rpcs`

- **Patterns:** `BN-23`, `BN-24`, `frs-07` (v3's hollow protocol shells — the caution)
- **Mechanism:** `doctrine-amendment` → `architecture-cli-scaffold`
  (`add role --role rpc --op Get` emits `contracts/Get.contract.ts`,
  `handlers/Get.handler.ts`, the `Rpcs` entry) → `architecture-cli-audit`
  (rules `contract/members`, `contract/handler-pair`: every `<Op>` under
  `use-cases/…/<C>/contracts/` has `server/…/<C>/handlers/<Op>.handler.ts`
  exporting `Handler`, and `<C>.rpc.ts` lists it)
- **Leverage:** One template for every operation; the contract→handler pairing
  is type-level (`Handler = Get.Contract.implement(…)`) instead of the
  hand-typed factories in `WorkItem.http.ts`; `Rpcs`/`Client` are derived,
  not listed; and an unimplemented contract becomes a rule violation — the
  v3 failure the auditor could not see (14/22 knowledge concepts shipped
  3-line empty `rpc/http/tool` shells, `11` §1) becomes visible.
- **Sketch:** effect v4 already carries the primitive —
  `Rpc.make(tag, { payload, success, error })`, `RpcGroup.make(...)`,
  `group.toLayer(...)`, `RpcClient.make(group)`
  (`.repos/effect/packages/effect/src/unstable/rpc/`); a thin `Contract`
  concept module in `@beep/schema` (`Contract.make({ Payload, Success,
  Failure })` → the `Rpc` with the three schemas as statics, `implement` as a
  typed identity helper) replaces v3's `W.Wrapper`. It is a sibling of
  `@beep/schema/Fn` (`Fn.schema.ts` attaches its `input`/`output`/`error`
  triad as statics via `SchemaUtils.withStatics` L441/L456 and ships
  `implement`/`implementEffect`/`implementSync`) — reuse that construction
  over `Rpc.make`, do not fork `Fn` (a function-value schema with
  decode-on-call semantics and no `RpcGroup` integration). One live
  precedent for the member vocabulary exists:
  `packages/drivers/govinfo/src/domain/contracts/Search/Search.contract.ts`
  (`Payload` L46 / `Success` L87 / `Failure` L201 against `HttpApiEndpoint`,
  in a driver `domain/`) — the amendment reconciles it rather than leaving a
  third dialect. File shape per
  `../DECISIONS.md` *operation contracts*: `contracts/` and `handlers/` are
  the two admitted sub-folders inside a concept; `<C>/index.ts` adds
  `export * as <Op>`; the audit forbids any other file there and checks that
  `<Op>` ∉ `RoleMember`.
- **Prerequisite decisions:** *operation contracts* (locked); sub-choices
  (kit home, sub-folders, one group level) ratified in P0; R6a first.
- **Rollout:** proof first (lab `WorkItem` gains `contracts/{Assign,Complete,
  Archive,Reopen}.contract.ts` + handlers, replacing `WorkItem.http.ts`'s
  factories), then the 7 `.rpc.ts` files slice by slice.
- **Risk:** R12 applies verbatim — `add role` must emit a contract *and* a
  handler body, never a shell; the `error` option key vs the `Failure` member
  name is a transcription trap for the template.

### R7 — Entry file = subpath name

- **Patterns:** `dir:root-composer-casing`, `BN-11`, `EL-13`
- **Mechanism:** `architecture-cli-audit` (rule `entry/name-equals-subpath`)
- **Leverage:** One rule with no exception table; checkable directly against
  `package.json#exports`. ~10 renames.
- **Sketch:** for every `exports` key `./<sub>` (excluding `./package.json`,
  wildcards, and `null`), the target is `./src/<sub>.ts` or
  `./src/<sub>/index.ts`; root non-index files under `src/` must be named by
  a subpath. Renames: 6 `Layer.ts` → `layer.ts`, 1 `Tables.ts` + 3 `Schema.ts`
  → `tables.ts`.
- **Prerequisite decisions (locked):** entry casing. Doctrine: amend the
  tree (`Tables.ts`, `Layer.ts`, `Api.ts`, … → lowercase) and the Config role
  table.
- **Rollout:** ratcheted; one PR can clear it.
- **Risk:** `@beep/<slice>-server/layer` consumers — the subpath does not
  change, only the file; low.

### R8 — `$I` presence on schema roles + file-path key

- **Patterns:** `CI-06`, `CI-07`, `CI-08`
- **Mechanism:** `architecture-cli-audit` (rules `identity/present`,
  `identity/key-equals-path`) — or an extension of `lint identity-registry`,
  which already walks composers (`CI-05`)
- **Leverage:** identity ↔ path bijection; the one v3 discipline (100% on
  schema roles) that v4 lost most (61%).
- **Sketch:** for files whose role ∈ `{model, errors, values, commands,
  queries, ports, service, contracts, table}`: exactly one
  `const $I = $<Pkg>Id.create("<key>")` with `key === relative(src, file)`
  minus extension. Composition roles exempt.
- **Prerequisite decisions (locked):** `$I` gate. Doctrine: pick the path
  grammar over the bare/dotted examples.
- **Rollout:** ratcheted; ~70 key fixes + missing anchors; **never bulk** —
  keys are persisted tag strings.
- **Risk:** persisted identifiers (workflow activity names, stored error
  tags). Each rename checks `EntityId`/`annoteError` consumers first.

### R9 — Test lens grammar + twin ratchet

- **Patterns:** `tests:name-twins-src-stem`, `tests:suffix-vocabulary`,
  `tests:shared-helpers-and-test-subpath`, `tests:dir-mirrors-src`
- **Mechanism:** `architecture-cli-audit` (rules `test/lens-in-vocabulary`,
  `test/twin-per-role`) + `ratchet`
- **Leverage:** "tests for X" becomes one glob; the file-level counterpart of
  the LOC coverage ratchet. 0 directory moves.
- **Sketch:** every `<pkg>/test/**/*.test.ts(x)` matches
  `<Concept>.<lens>.test.ts` with `lens ∈ TestLens`; every concept folder
  carrying `.model`/`.service`/`.ports`/`.repo` has ≥1 twin
  `test/**/<Concept>.*.test.ts`; `test/integration/` stays the lane split.
  Package-scoped test helpers live in `test/_shared/` or the `/test` subpath
  (`EL-17`), never both.
- **Prerequisite decisions (locked):** test grammar. Doctrine: a sentence in
  `08-testing`; the `.contract.test.ts` lens exists in text with 0 files —
  the twin ratchet counts any lens.
- **Rollout:** ratcheted; ~75 renames over time; 11 singleton infix shapes fold
  into the 7 lenses or die.
- **Risk:** vitest include globs — verify `vitest.shared.ts` accepts every
  lens spelling before renaming.

### R10 — Layer and error naming

- **Patterns:** `EL-08`, `EL-12`, `EL-13`
- **Mechanism:** `architecture-cli-audit` (rules `layer/name-shape`,
  `error/name-by-tier`)
- **Leverage:** Removes a grep per import for Layer values; makes the
  product-vs-driver error distinction visible in the name. UNMEASURED ESTIMATE ~55 renames (`EL-12`: 37 `…Layer` + 9 bare adapters; `EL-08`: the slice-owned subset of 22 `*Error`).
- **Sketch:** exported `Layer.Layer<…>` values in `.layer.ts` / entry files
  match `<Port>(<Adapter>)?Live | <Port>Test | <Port>InMemory | <Slice>ServerLive`;
  `S.TaggedError` classes in domain/use-cases do **not** end in `Error`,
  in drivers they do. The error rule can live in `lint schema-first` beside
  `SFV4-tagged-error-equivalence` (`EL-05`) if the audit walker is not yet
  wired there.
- **Prerequisite decisions (locked):** Layer naming; error naming.
- **Rollout:** ratcheted per slice; documents (`Layer` 22) and
  ontology/law-practice (`*Error` cluster) first.
- **Risk:** error renames change `$I` tag strings — same persisted-identifier
  caveat as R8.

### R11 — No live Layer exported from `use-cases` (existing decision, new gate)

- **Patterns:** `EL-16`
- **Mechanism:** `architecture-cli-audit` (rule `boundary/no-layer-export-from-use-cases`)
- **Leverage:** A ratified rule (DECISIONS 2026-04-23) with 8 live violations
  and no gate; Fallow cannot see it because `effect` is a permitted
  dependency. Nearly free to add.
- **Sketch:** under `packages/*/use-cases/src/**`, fail any
  `export const \w+ = Layer\.` or `: Layer.Layer<`. Baseline: 8 rows (`law-practice`: `CandorPolicyLive`, `LegalPositionRelatorPolicyLive`, `CandorRecordReaderFromRepository`; `ontology`: `OntologyToolServiceLive`, `SessionUseCasesLayer`, and the three `Session.{validation,sparql,reasoner}` `…Live` values — `EL-16`).
- **Prerequisite decisions:** none (already decided).
- **Rollout:** could ship as the first rule to prove the walker end-to-end.
- **Risk:** the ontology `Session.*` Layers need a server home first.

### R12 — Generator hygiene: never scaffold optional roles empty; emit what the vocabulary requires

- **Patterns:** `frs-07` (v3's hollow shells, `11` §1), `CI-11`, `frs-12`
- **Mechanism:** `architecture-cli-scaffold`
- **Leverage:** Prevents the v3 failure the auditor cannot see (uniform shape,
  empty content). Makes `add concept` emit kind folders in every tier and
  `.converters` for persisted concepts; optional protocol roles only via
  `add role`.
- **Sketch:** split the manifest into `required` (per `--stage`) and
  `optional` proof files; `add concept --stage core` writes only required;
  `add role --role http` writes the declaration *and* its handler with a
  non-empty body (a `TODO` throw is still a body the auditor can see).
  Once symbols are role-named (R6a), `TemplateRetarget.ts` keeps only its
  path passes (L155-159) and the `$I`-key rewrite; the identifier passes
  (L160-162, L170-171) go.
- **Prerequisite decisions:** `.converters`; kind folders.
- **Rollout:** with R3.
- **Risk:** stage semantics in `RoleTopology.ts` (`core|persistence|protocol|client|full`)
  already encode most of this — extend, do not duplicate.

## Pressure test of the brief's leading hypothesis

> "Extend `beep architecture check` (or add a sibling `beep architecture audit`)
> from plan-validation into a topology auditor over existing slices."

| Option | Verdict | Why |
| --- | --- | --- |
| Overload `check --existing` | rejected | `check` implements the `architecture-operation-plan/v1` replay contract (plan idempotency against disk, `Architecture.command.ts:187-198`). Doctrine conformance of an arbitrary package is a different input (a package, not a plan), a different output (findings, not `matching/missing/differing`), and a different exit semantics (ratchet). Two semantics under one name and one v1 contract. |
| Sibling `beep architecture audit` | **adopted** (DECISIONS *auditor shape*) | Same command group ⇒ same `Architecture.schemas.ts` vocabularies for the generator and the auditor; that structural sharing is the whole point (R1). Reuses `Lint` walkers by import. |
| `beep lint slice-topology` | rejected as primary; acceptable host for R10's error rule | Fits the `lint policy` bundle, but separates the auditor from the generator that must agree with it; `schema-topology` shows a walker can live in Lint — the vocabularies still belong in Architecture. |
| Generator-only (fix the manifest, no auditor) | rejected | Cannot see packages scaffolded before the CLI or hand-edited after — exactly the gap the brief named (`14` §2). Also cannot ratchet. |
| Lint rule per pattern (N micro-gates) | rejected | The repo already has fragmented enforcement (`14` §3: 15 lint subcommands, none topology-wide). One auditor with keyed rules and one baseline is what closes the "no single auditor" finding. |

The brief's instinct — one auditor emitting codified/drifted/missing verdicts
over existing slices — is confirmed. Its proposed host was wrong; the
sibling command keeps `check`'s contract intact and shares the vocabulary
with the generator.

## Rows the grill measured but did not resolve

`00-convention-inventory.md` §Decision coverage lists four `drifted` rows no
grill decision chooses a convention for, plus three `v4-only` policy rows.
Each is DEFERRED with a recommended answer in `../DECISIONS.md` (*deferred
rows*) and ratified in `slice-topology-audit` P0. Every row still gets one
terminal mechanism here, so the brief's per-pattern requirement is met even
where the convention itself awaits ratification:

| Row | What is unresolved | Recommended answer | Terminal mechanism |
| --- | --- | --- | --- |
| `dir:package-shell-skeleton` | which package-level files every tier package carries | the shell `create-package` already emits (`package.json`, `tsconfig*.json`, `vitest.config.ts`, `README.md`, `test/.gitkeep`) is the law; extras are free | `architecture-cli-audit` rule `shell/required-files`, fed by `CreatePackage`'s template list |
| `BN-19` | `shared/domain` source vs publish export-map mirror drift (30/31 equal key counts) | source map is truth; publish mirror must be derived | `architecture-cli-audit` rule `exports/source-publish-parity` (after R6's export-map walker) |
| `tests:coverage-ratio-by-tier` | whether non-server tiers get coverage floors | not a topology rule; leave to the coverage ratchet owners | existing `ci lane coverage` ratchet — `not-worth-enforcing` in the audit |
| `tests:typecheck-covers-test-tree` | 15/40 packages typecheck `test/`; 25 blind | every package with tests typechecks them | existing `lint package-test-typecheck` ratchet, surfaced in the audit report (no new rule) |
| `BN-12` | per-concept `<Concept>/server.ts`/`worker.ts` shims (15 files, 6 slices) | admit as a concept-local entry file named for its subpath (`./<kind>/<Concept>/server`) — same rule as R7 | `architecture-cli-audit` rule `entry/name-equals-subpath` (R7) extended to concept folders; R1 vocabulary gains the entry-file class |
| `BN-14` | `.ts`-extension import specifiers (785/785) | codify what is already uniform | one doctrine sentence; `not-worth-enforcing` beyond the existing TS resolver |
| `BN-15` | tier root barrel is a pure re-export file except `VERSION` | codify what is already uniform | `architecture-cli-audit` rule `barrel/root-pure-reexport` folded into R6 |

The 2026-08-30 operator addenda (`BN-20`–`BN-24`) lock their principles; their six sub-choices (`Repo` vs `Repository`, values bare + `Id`, client `Client`, `Contract` kit home, `contracts/` + `handlers/` sub-folders, one group level) are DEFERRED with recommendations in `../DECISIONS.md` and land in the same P0 amendments PR; terminal mechanisms are R6a and R6b.

## Dropped ideas (and why)

- **Mirror `test/` to `src/` directories** — 169 file moves for a small win at
  today's package sizes (largest test dir 14 files); the lens grammar + twin
  ratchet gives the navigability without the moves.
- **Fold `.converters` into `.table.ts`** — hides the only visible row↔model
  codec surface; code already agrees on the separate file 25:2.
- **Always `*Error`** — 60 renames of persisted tag strings to remove a
  distinction the doctrine's examples actually use.
- **Hard gate day one / hand allowlist** — the allowlist is the baseline in a
  worse format; blocks unrelated PRs.
- **Audit drivers/foundation in V1** — 49 driver + 29 foundation packages (`ls -d packages/drivers/*/ | wc -l`, `ls -d packages/foundation/*/*/ | wc -l`) and the tooling
  thresholded topology; a later rule pack under the same report schema.
- **Reintroduce `_check.ts` parity files** — `toPgTable(Model)` makes parity
  structural (`CI-09` vs `CI-10`).
