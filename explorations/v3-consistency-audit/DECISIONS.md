# DECISIONS — v3-consistency-audit

> One branch-closing question per entry, recommended answer first. Logged with
> Question / Answer / Rationale. The first four entries were decided by the
> operator in the brief itself and are recorded here so no later session
> reopens them; the rest are packet-shaping decisions made while building it.

## 2026-08-29 — casing

**Question:** v3 kebab-case files/dirs or v4 PascalCase concept folders?

**Answer:** PascalCase concept folders (`<Concept>/<Concept>.<role>.ts`) win.
Decided in the brief; this packet recommends only the enforcement mechanism.

**Rationale:** Already the active decision in
`standards/architecture/DECISIONS.md` (2026-04-21 "Use Concept-Qualified Role
Suffixes") and the majority practice in v4 (176 PascalCase src dirs vs 11
lowercase, the lowercase ones being domain-kind folders). v3 itself was split
(PascalCase entity dirs, kebab client operation dirs, kebab table files), so
there is no uniform v3 casing to return to. Not relitigated.

## 2026-08-29 — scope

**Question:** Does this packet change code or doctrine?

**Answer:** No. Analysis and recommendations only: no refactors, no
`standards/` edits, no `DECISIONS.md` changes. Where a recommendation needs a
doctrine amendment, it is recorded as a *prerequisite question* for a
follow-up, not decided here.

**Rationale:** The brief fixes this. Implementation is a follow-up goal packet;
this packet's job is to make that packet's SPEC trivially seedable.

## 2026-08-29 — v3 as source of uniformity, not architecture

**Question:** Which parts of v3 are on the table?

**Answer:** Only the uniformity patterns (grammar, suffixes, barrels,
collocation, test placement, error/Layer conventions). v4's boundaries
(domain ← config ← use-cases ← server; ports/adapters; family/kind grammar;
public-surface rules) win unconditionally. Any v3 pattern that conflicts with
a v4 boundary is tagged `not-worth-porting` in the inventory.

**Rationale:** Operator's closing constraint: "Migrate the uniformity, not the
architecture."

## 2026-08-29 — evidence discipline

**Question:** What counts as evidence for a codified / drifted / missing verdict?

**Answer:** A file path plus the `rg`/`fd`/`find` command and its count or
excerpt, from the relevant checkout (`~/YeeBois/projects/beep-effect4` for v3,
this repo for v4). Doctrine quotes alone never establish a verdict; they
establish the *codified* half only when paired with a code count.

**Rationale:** The brief's prior findings were hypotheses; the first scout pass
already falsified two of them (the "near-1:1 test ratio" is a line ratio, not a
file ratio; v3's `{concept}.{role}.ts` grammar covered domain entity folders but
not the 1163 single-segment src files elsewhere). Numbers, not vibes.

## 2026-08-29 — packet-layout

**Question:** Flat canonical packet or a `synthesis/` subdirectory?

**Answer:** Hybrid, same as `atlas-synthesis`: canonical skeleton (`README`,
`ops/manifest.json`, `CAPTURE`, `DECISIONS`, `RESEARCH` as index) plus
`synthesis/NN-*.md` artifacts numbered by band — `00` centerpiece, `10`–`15`
inventories, `20`–`25` per-family cross-check tables, `30`–`32` assessment
lenses, `40` ranked recommendations, `90` completeness critique.

**Rationale:** ~20 artifacts; one `RESEARCH.md` would be unnavigable. The
`atlas-synthesis` precedent already documented this drift from the flat
template.

## 2026-08-29 — status thresholds

**Question:** When is a doctrine-named pattern "codified" vs "codified-but-drifted"?

**Answer:** `codified` = doctrine names it AND ≥90% of the measurable v4 sites
follow it. `codified-but-drifted` = doctrine names it, <90% follow (the table
records the %). `drifted` = no doctrine, code inconsistent. `missing` = neither.
`v4-only` = v4 has it, v3 did not. `not-worth-porting` = v3 pattern that
conflicts with v4 boundaries or the casing decision.

**Rationale:** A fixed threshold lets two verifiers disagree about numbers, not
about labels. 90% is the point at which a gate can launch as a ratchet with a
short baseline rather than a hard check that fails everywhere.

## 2026-08-29 — build method

**Question:** How is the analysis produced and checked?

**Answer:** One multi-phase workflow (ultracode on): 6 parallel inventory
readers → 6 pattern-family cross-check tables, each adversarially verified by
two lenses (evidence recount, doctrine reading) with a fixer applying held
refutations → 3-lens assessment panel (token economy, enforcement mechanics,
migration cost) → synthesized ranked recommendations, 3 refuters (feasibility
vs CLI code, scope/decision conflicts, duplication/value) and a fixer →
consolidated inventory table + completeness critic. Every agent wrote to
`synthesis/` and returned structured data; the packet's top-level files are
authored by the orchestrating session from those outputs.

**Rationale:** The brief asked for thoroughness and evidence; adversarial
verification is the cheapest way to keep a fan-out honest. Agents were
read-only outside `synthesis/` and forbidden from running `bun`/`turbo`.

---

> Entries below are the **align grill** (2026-08-29, `/grilling`), run after
> the inventories and family tables landed. Each answer is a *recommendation
> this packet carries into the follow-up goal packets*; the doctrine
> amendments they imply are prerequisites for that packet, not edits made
> here. Evidence cites point at `synthesis/20`–`25`.

## 2026-08-29 — domain-kind folders in non-domain tiers

**Question:** Are `aggregates/ | entities/ | values/` folders required in every
tier, only in `domain` + `tables`, or optional per tier?

**Answer:** Always, in every tier. One grammar:
`packages/<slice>/<tier>/src/<kind>/<Concept>/<Concept>.<role>.ts`.

**Rationale:** The doctrine tree (ARCHITECTURE.md L827-952) and DECISIONS
2026-04-21 already say so; the generator emits it; code is 20 kind-only + 1 mixed : 8 bare-only : 3 flat packages (21/32 = 66%), uniform in domain 8/8 and tables 7/7.
With one grammar an agent derives every sibling path from the domain path by
substituting tier and role. Rejected: *domain + tables only* (matches
`13-onboarding`'s examples and epistemic/law-practice, but moves ~20 packages
and changes the generator); *optional per tier* (cheapest, leaves the path
grammar unpredictable across tiers). Cost accepted: ~12 packages move to kind
folders plus export-map subpath renames; the `13`/`09`/`10` examples need
amending to match the tree (prerequisite doctrine edit). Evidence:
`synthesis/20-family-directory-grammar.md` (DG rows), `13-v4-slices-census.md` §3.

## 2026-08-29 — proof vs doctrine precedence

**Question:** When `architecture-lab` / `AcceptedProofManifest.ts` and the
role vocabulary disagree, which moves?

**Answer:** Doctrine wins; fix the proof first, then codemod the followers.
Concretely: use-cases ports are `<C>.ports.ts` (not `.repository.ts`), the
facade is `<C>.service.ts` (not `.use-cases.ts`), server handlers are
`<C>.http-handlers.ts` / `.rpc-handlers.ts` / `.tool-handlers.ts` (bare
`.http/.rpc/.tools` are the use-cases *declaration* names), and port errors
live in `use-cases/<C>.errors.ts` (09 L12), not inside the ports file.

**Rationale:** The vocabulary is the constitution (DECISIONS 2026-04-21) and
has the majority wherever anyone has written it (`.ports` 12-13 vs
`.repository` 7; `.service` 14 vs `.use-cases` 4). The lab landed 2026-05-12,
three weeks after the vocabulary decision, with no recorded decision for any
of its 9 divergences (`synthesis/15`). Because `add concept` retargets the
manifest verbatim, every new concept copies the drift — so the manifest is
the first thing to fix. Rejected: *proof wins* (zero moves, but loses the
declaration-vs-handler naming distinction); *per-role majority* (mixed result,
one DECISIONS entry per role). Cost accepted: ~35 renames + export-map edits.

## 2026-08-29 — root entry-file casing

**Question:** PascalCase composers (`Layer.ts`, `Tables.ts`, `Config.ts`) with
lowercase boundary entrypoints (`public.ts`, `server.ts`), or one rule?

**Answer:** One rule: a root entry file is named exactly after its export
subpath, lowercase — `layer.ts` ↔ `./layer`, `tables.ts` ↔ `./tables`,
`public.ts` ↔ `./public`, `test.ts` ↔ `./test`.

**Rationale:** Mechanically checkable against `package.json#exports` with no
exception table. Code already does this for use-cases (`public.ts`/`server.ts`
8/8) and config (`layer/secrets/public/server/test.ts` 3/3, beside two PascalCase
`ServerConfig.ts`/`TestLayer.ts` composers); the split is
only in tables (`tables.ts` 3 / `Tables.ts` 1 / `Schema.ts` 3) and server
`Layer.ts` (6/7 PascalCase). Rejected: *keep doctrine's PascalCase composers*
(two rules to teach; renames 9 files anyway); *leave both* (entry files stay
unpredictable). Cost accepted: rename 6 `Layer.ts` + 1 `Tables.ts` +
3 `Schema.ts`; amend the doctrine tree and the Config/Tables role tables.
Evidence: `synthesis/20` root-composer rows, `22-family-barrel-namespace.md`.

## 2026-08-29 — auditor shape

**Question:** Extend `beep architecture check`, add a sibling `audit`, or add
a `beep lint slice-topology` rule?

**Answer:** A sibling `beep architecture audit` command. It walks
`packages/<slice>/<tier>/src` for existing packages, asserts the vocabulary as
`LiteralKit` schemas colocated with `ArchitectureSliceRole` /
`ArchitecturePlanStage` in `Architecture.schemas.ts`, emits a schema-versioned
report (per slice × tier × rule: codified / drifted / missing, with paths), and
exits non-zero only on ratchet regression. `check` keeps its plan-only
`architecture-operation-plan/v1` replay contract. The command is bundled into
`lint policy` / `beep:preflight` and gets its own `ci lane`.

**Rationale:** The generator and the auditor must share one vocabulary or
they drift apart again; keeping both in the Architecture group makes that
structural. `check` already has a v1 replay contract — overloading it with
doctrine conformance is two semantics under one name. Rejected: *`check
--existing`* (two semantics, one contract); *`lint slice-topology`* (fits the
lint bundle, but separates the auditor from the generator; the walkers it
would reuse — `Lint.command.ts:collectTypeScriptFiles`,
`PackageTestImports.collectPackageSourceRoots` — can be imported from Lint
either way; the 2026-08-30 capability gate replaced the latter with
`@beep/repo-utils` `resolveWorkspaceDirs`, which Fallow already uses).
Evidence: `synthesis/14-v4-enforcement-tooling.md` §1-2, §5.

## 2026-08-29 — rollout posture

**Question:** Hard gate, advisory-then-hard, or baseline ratchet?

**Answer:** Baseline ratchet from day one: commit
`standards/architecture.audit-baseline.jsonc` with the current per-package
drift counts per rule; the lane fails only on regression; a `follow_ups`
list burns the baseline down as the proof fix and codemods land.

**Rationale:** Every rule fails somewhere today (kind folders 21/32, suffix
vocabulary 335/432, `.repository` 7, entry casing ~10 files, use-cases
exporting live Layers 8 values). The ratchet is the repo's established
pattern (`coverage.regression-baseline.jsonc`, the Fallow advisory→ratchet
packets) and lets migrations land in any order without a red `main`.
Rejected: *advisory then hard* (nothing stops new drift during the window);
*hard with allowlist* (the allowlist is the baseline in a worse format and
blocks unrelated PRs).

## 2026-08-29 — `.converters.ts`

**Question:** Admit `<Concept>.converters.ts` into the tables vocabulary,
fold it into `.table.ts`, or allowlist it?

**Answer:** Admit it: recommend a doctrine amendment adding `.converters.ts`
(model ↔ row codecs) to the Tables role table, and have the generator emit it
for persisted concepts.

**Rationale:** 25 files across 5/7 tables packages, consumed by 15/15
`.repo.ts`; the code already agrees and only the doctrine is silent. Folding
into `.table.ts` (the proof's inline style) merges 25 files and changes repo
imports for no navigational gain; an allowlist institutionalises an exception
table. Cost accepted: the 2 proof tables gain a converters file; the doctrine
Tables row and the manifest are amended. Evidence:
`synthesis/23-family-collocation-identity.md`, `13-v4-slices-census.md` §4.

## 2026-08-29 — test file grammar

**Question:** Mirror `src/` under `test/` (v3 knowledge/server habit), keep
flat `test/` with a name grammar, or rely on the coverage ratchet only?

**Answer:** Flat `test/` plus a closed lens grammar plus a twin ratchet. Name
rule `<Concept>.<lens>.test.ts` with a `LiteralKit` of lenses (`test`,
`pglite.test`, `pg.test`, `e2e.test`, `equivalence.test`, `contract.test`,
`schema-parity.test`; new lenses are a vocabulary change, not a filename).
Audit rule: every concept folder carrying a `.model` / `.service` / `.ports` /
`.repo` role has at least one twin `test/**/<Concept>.*.test.ts`, ratcheted
per package. `test/integration/` stays as the lane split.

**Rationale:** Placement is already 100% (169/169 under `test/`, vitest
include glob); what is missing is navigability. The lens grammar makes
"tests for X" a single glob; the twin ratchet is the file-level counterpart
of the existing LOC coverage ratchet. Mirroring directories moves all 169
files for a small win while the largest v4 test dir holds 14 files (v3's was
52). Rejected: *mirror src* (169 moves, small gain today); *coverage only*
(discovery stays a grep; 17 infix shapes, 11 singletons, keep multiplying). Cost
accepted: ~75 renames over time; a doctrine sentence in `08-testing`.
Evidence: `synthesis/24-family-tests.md`.

## 2026-08-29 — barrel and namespace style

**Question:** Namespace re-exports at kind/tier barrels, flat `export *`
everywhere, or completeness-only?

**Answer:** Namespace at kind and tier barrels, flat only inside a concept.
`<kind>/index.ts` and `<tier>/src/index.ts` re-export concepts as
`export * as <Concept> from "./<Concept>/index.ts"`; `<Concept>/index.ts` may
flatten its own role files. The audit checks both shape (namespace at
kind/tier) and completeness (every `<Concept>/` re-exported from its kind
barrel, every kind from the tier barrel).

**Rationale:** Matches the 19-package majority and v3's one real barrel law
(84/84 kind barrels namespaced). Flat re-export is collision-prone (epistemic
has `entities/Contradiction` and `values/Contradiction`) and hides the owning
concept at the import site; namespaces give the `Entities.Membership.Model` /
`@beep/x-domain/entities/Membership` duality. Rejected: *flat everywhere*
(collisions surface late; audit could only check completeness);
*completeness only* (import sites stay inconsistent). Cost accepted: 8 flat-only +
1 mixed + 1 named-only barrels rewrite; consumers of flattened names update; one doctrine
sentence on barrel shape (none exists today). Evidence:
`synthesis/22-family-barrel-namespace.md`.

## 2026-08-29 — `$I` identity gate

**Question:** Gate `$I` presence and key grammar per file, presence only, or
keep only the composer-registry lint?

**Answer:** Presence on schema-defining roles plus a file-path key. Every
`.model` / `.errors` / `.values` / `.commands` / `.queries` / `.ports` /
`.service` / `.contracts` / `.table` file declares
`const $I = $<Pkg>Id.create("<kind>/<Concept>/<Concept>.<role>")` whose key
equals the src-relative path without extension. Composition roles
(`.layer`, `*-handlers`, `index.ts`, entry files) are exempt.

**Rationale:** v3 held this at 100% on schema roles by habit; v4 is at 61%
overall (90% domain, 3% tables) with the file-path key already the 81%
majority. A derivable key makes identity navigable from the path and the
path from the identity. Rejected: *presence only* (keys stay non-derivable);
*no per-file gate* (a habit, not a law). Cost accepted: ~70 key fixes plus
missing anchors, ratcheted; the doctrine must pick the file-path grammar
over the bare and dotted examples it currently shows. Evidence:
`synthesis/23-family-collocation-identity.md`.

## 2026-08-29 — Layer value naming

**Question:** One Layer suffix (`Live`), one suffix regardless of kind
(`Layer`), or leave the per-slice dialects?

**Answer:** `<Port>Live` for live Layers (`<Port><Adapter>Live` when several
live adapters exist, e.g. `ClaimDispositionRepositoryDrizzleLive`),
`<Port>Test` / `<Port>InMemory` for test doubles, `<Slice>ServerLive` at the
root. The audit checks exported `Layer.Layer<…>` names in `.layer.ts` files
and root entry files.

**Rationale:** Code is `Live` 45 / `Layer` 37 / `Test` 4 / bare adapter 9 (47% `Live`),
with each slice on its own dialect (epistemic Live 9 : Layer 0; documents
Live 5 : Layer 22); the doctrine's own examples use four spellings; the root
composers are already `<Slice>ServerLive` 6/6 and v3 was 84% `Live`. The
suffix carries the live-vs-test signal at the import site. Rejected:
*`<X>Layer` everywhere* (loses that signal, 45+ renames); *leave* (dialects
persist). Cost accepted: ~40 renames; the doctrine examples in
`ARCHITECTURE.md`, `05`, `08` normalise to one spelling. Evidence:
`synthesis/25-family-errors-layers.md` EL-12, EL-13.

## 2026-08-29 — error class naming

**Question:** Bare product errors with `*Error` reserved for driver/infra,
always `*Error` (v3's 98% habit), or leave?

**Answer:** Bare product errors; `*Error` only for driver and adapter failure
wrappers. Domain and use-cases errors are bare tags naming the condition
(`MembershipNotFound`, `MembershipAlreadyRevoked`); driver/infra errors end in
`Error` (`DrizzleError`, `PostgresError`). The audit checks by tier.

**Rationale:** This is the split the doctrine already shows by example
(`09` L11-13 vs `ARCHITECTURE.md` L1375) without stating it; code is 60 bare
/ 22 `*Error`, and the `*Error` slice names cluster in ontology, law-practice
and agents where the driver spelling leaked in. Rejected: *always `*Error`*
(60 renames, every `$I` tag string changes); *leave* (per-slice dialect).
Cost accepted: ~15 renames in slices; one sentence in `09-errors`. Evidence:
`synthesis/25-family-errors-layers.md` EL-08.

## 2026-08-29 — audit scope

**Question:** Slices only, slices + drivers, or every family in the first
`beep architecture audit`?

**Answer:** Slices first, family-aware design. V1 walks the 8 slices / 40
packages; the rule set and the report schema are keyed by family/kind so the
driver and foundation anchors (`ARCHITECTURE.md` L681-711) are a later rule
pack, not a rewrite.

**Rationale:** Keeps the first packet small enough for one PR train and lets
the baseline start where the grammar is closed. Rejected: *slices + drivers*
(~45 more packages, larger day-one baseline); *everything* (tooling's
thresholded role topology is the hardest to express as closed rules).
Evidence: `synthesis/14-v4-enforcement-tooling.md` §5.

## 2026-08-29 — follow-up packaging and sequencing

**Question:** One goal packet or several, and in what order, for (a) the
doctrine amendments, (b) the auditor + baseline + lane, (c) proof
reconciliation + codemods?

**Answer:** Two goal packets, auditor first. `slice-topology-audit`: P0 lands
the doctrine amendments implied by this grill (the `LiteralKit` vocabularies
must match the text), P1 the `beep architecture audit` command, the baseline
file and the ci lane. `canonical-proof-reconciliation`: `AcceptedProofManifest`
+ `architecture-lab` renames first, then one codemod PR per slice, each
proving itself by a baseline delta.

**Rationale:** Measuring instrument first; migrations then prove themselves
instead of being asserted. Rejected: *reconciliation first* (stops `add
concept` propagating drift sooner, but with no mechanical proof until the
auditor exists); *one packet* (one long branch train, harder closeout).

## 2026-08-29 — packet depth for this session

**Question:** Stop at `align`, carry through `decompose`, or graduate today?

**Answer:** Carry through `shape` (BRIEF.md) and `decompose` (MAP.md naming
the two goal packets with capability cites); stop before `graduate`. No
`goals/` scaffolding in this session.

**Rationale:** BRIEF + MAP are still analysis and make the follow-up packets
seedable with `/explore`; graduation is a separate act the operator takes
after reading the ranked recommendations. Rejected: *stop at align* (leaves
shaping to a cold session); *graduate today* (outside the brief's scope).

## 2026-08-29 — remaining fan-out budget

**Question:** The Fable session limit killed 20/31 workflow agents (all
verifiers, the assessment panel, synthesis, refuters, consolidation, critic).
Resume on Fable later, skip verification, or route to Codex?

**Answer:** Codex (`codex exec`, effort medium) verifies and corrects each
family table through both lenses (evidence recount + doctrine reading),
writes the consolidated `00` table and the `90` completeness critique; the
orchestrating Fable session writes `30-assessment.md` and
`40-recommendations-ranked.md` itself from the locked decisions.

**Rationale:** Verification and consolidation are mechanical recounts — the
right pool per the routing doctrine; the assessment and ranking are judgment
work the grill already settled, so a 3-lens panel would re-derive it.
Rejected: *resume after the limit reset* (burns the scarce pool, delays hours);
*skip verification* (weakens the evidence discipline the brief demanded).

## 2026-08-29 — appetite

**Question:** How much time do the two goal packets deserve?

**Answer:** `slice-topology-audit`: one PR train, about one week
(amendments PR → command + baseline PR → lane PR).
`canonical-proof-reconciliation`: the manifest/lab PR first, then one PR per
slice, about two to three weeks; unfinished slices stay in the baseline's
`follow_ups`, never a blocker.

**Rationale:** The auditor is one new command in an existing group reusing
existing walkers and schemas; reconciliation is ~35 proof renames plus
per-slice codemods (~12 packages for kind folders, ~10 entry files, ~40 Layer
names, ~15 error names, ~75 test renames, ~10 barrels), all ratchet-tracked so
partial landings are fine. Rejected: *both tight, ~1 week each* (green
instrument fastest, but the drift baseline stays large); *one ~6-week train*
(cleanest end state, longest exposure to the `main` merge treadmill).

---

## 2026-08-30 — namespace member vocabulary (operator addendum)

**Question:** Do role files export concept-named symbols (`class WorkItem`,
`workItemTable`, `WorkItemRepositoryLayer`) or fixed role-named members that
the concept namespace qualifies (`WorkItem.Model`, `WorkItem.Table`,
`WorkItem.Repo`, `WorkItem.RepoLive`)?

**Answer (operator):** Fixed role-named members; the namespace carries the
concept. Verbatim: "Instead of `User` it's `User.Model`, instead of
`UserTable` it's `User.Table`, instead of `UserRepository` it's `User.Repo`"
— because it "makes boiler plating & code generation easier & more
consistent". Locked as a principle. The member table is the recommended
vocabulary and is ratified with the P0 amendments:

| Tier / role file | Required member(s) | v3 | v4 today |
| --- | --- | --- | --- |
| domain `<C>.model.ts` | `Model` | 39/39 | 4/150 (`shared` only); 94 concept-named |
| domain `<C>.values.ts` | `Id`; other values bare (`Status`, `Title`) | 69/104 bare | 139/201 bare; proof 0/3 |
| domain `<C>.errors.ts` | `Errors` (union); classes keep the *error class naming* form | 39/39 | 0 (`<C>DomainError`) |
| use-cases `<C>.ports.ts` | `Repo`, `RepoShape` for the persistence port; other ports product-named | 39/39 (v3 domain) | 0/13 |
| use-cases `<C>.service.ts` | `Service`, `ServiceShape` | — | 0 (`<C>UseCases`) |
| use-cases `<C>.rpc.ts` / `.http.ts` / `.tools.ts` | `Rpcs` / `Api` / `Tools` | `Rpcs` 39 | `<C>Rpcs` 7 |
| config `<C>.config.ts` | `Config` (+ `PublicConfig`, `SecretConfig`, `ServerConfig`) | — | `<C>Config…` |
| server `<C>.repo.ts` | `RepoLive`, `Repo<Adapter>Live`, `RepoTest` | 39/39 | 0 |
| server `<C>.layer.ts` | `Live`, `Test` | — | `<C>ServerLayer` |
| server `<C>.rpc-handlers.ts` (`.http-handlers`, `.tool-handlers`) | `RpcsLive` / `ApiLive` / `ToolsLive`, composed from `<Op>.Handler` | — | `make<C>HttpHandlers` |
| tables `<C>.table.ts` | `Table` | 0 (camelCase) | 23/32 |
| tables `<C>.converters.ts` | `Row`, `Insert`, `toRow`, `fromRow` | — | `<C>Row` 28 |
| client `<C>.service.ts` | `Client` | — | `<C>Client` 1 |
| ui `<C>.view-model.ts` | `ViewModel` | — | — |

**Rationale:** The namespace is only an API when the members are role-named;
today `export * as WorkItem` yields `WorkItem.WorkItem`, so consumers bypass
it (724 deep named imports vs 115 namespace imports vs 4 kind-barrel
imports). v4 already runs two regimes: `shared` exports `User.Model`,
`Organization.Model`, `Membership.Model`, `LocalDate.Model` (4/4, 85 access
sites) and 23/32 tables export `Table` (81 sites), while 94/150 model classes
and every proof symbol are concept-named. The codegen argument is measured:
`Architecture/internal/TemplateRetarget.ts` L139-184 (path pass) / L186-262 (file-body pass) retargets by
substring-renaming `WorkItem` / `work-item` / `work_item` / `ArchitectureLab`
in file bodies — a string macro that role-named symbols make unnecessary
(only paths and `$I` keys vary); v3's generic parity check
`typeof X.Model.select` 20/20 (CI-09) was possible only because `Model` was
fixed. The repo already decided this principle for one family:
`standards/architecture/DECISIONS.md` 2026-05-22 canonises namespace-first
`@beep/schema` concept modules with role members `Schema`, `Input`,
`FromInput`, `Object`, `Unit`. Interplay with earlier decisions: completes
*barrel and namespace style*; leaves *`$I` identity gate* unchanged (key =
path, the annotation carries the concept — `shared` does
`$I.annote("Model")` under `entities/User/User.model`); *Layer value naming*
keeps its `Live`/`Test` suffix rule with the `<Port>` prefix moving into the
namespace (`ClaimDisposition.RepoDrizzleLive`); *error class naming* is
unchanged for classes, `Errors` is added as the union member. Not ported from
v3: the `AccountErrors` and `<C>Live` namespace prefixes
(`Account.AccountErrors`, `AccountLive.RepoLive`) — that is v3's
inconsistency, not its pattern. Rejected: *keep concept-named symbols*
(namespaces stay redundant, the generator stays a string macro). Cost
accepted: symbol renames in 8 slices with the 724 deep-import sites rewritten
by codemod (UNMEASURED per slice), proof rewrite, doctrine example fix
(`ARCHITECTURE.md` L1778, `04-rich-domain-model.md` L213). Evidence:
`synthesis/22-family-barrel-namespace.md` BN-20–BN-22.

## 2026-08-30 — operation contracts: `Contract` and `Handler` (operator addendum)

**Question:** Port v3's per-operation contract semantics into v4's
use-cases/server/client layout, and with what shape?

**Answer (operator):** Yes — the semantics, on v4's layout. Verbatim target:

```txt
User.Get.Contract          -- export const Contract = Rpc.make("Get", { payload: Payload, success: Success, error: Failure })
User.Get.Contract.Payload  -- Payload / Success / Failure reachable from the Contract
User.Get.Contract.Success
User.Get.Contract.Failure
User.Get.Handler           -- the implementation, typed from the Contract
User.Repo
User.Model
User.Rpcs                  -- RpcGroup.make(Get.Contract, Delete.Contract, …)
```

"Wrapper" is renamed `Contract`. Every operation is a namespace node directly
under the concept (`User.Get`, not `User.Contracts.Get`); the node mirrors
across tiers like the concept itself: `Contract` (+ `Payload`, `Success`,
`Failure`) in `use-cases`, `Handler` in `server`, the client derived from
`Rpcs`. v3's feature-tree client folders (`sign-up/email/`) and `<C>Live`
server namespaces are not ported.

Recommended file shape (ratify in P0; the audit and the generator need one):

```txt
use-cases/src/<kind>/User/contracts/Get.contract.ts   → Payload, Success, Failure, Contract
use-cases/src/<kind>/User/User.rpc.ts                 → Rpcs = RpcGroup.make(Get.Contract, …)
use-cases/src/<kind>/User/index.ts                    → export * as Get from "./contracts/Get.contract.ts"; export * from "./User.rpc.ts"; …
server/src/<kind>/User/handlers/Get.handler.ts        → Handler = Get.Contract.implement(Effect.fn("User.Get")(function* (payload) { … }))
server/src/<kind>/User/User.rpc-handlers.ts           → RpcsLive = Rpcs.toLayer(Effect.succeed({ Get: Get.Handler, … }))
server/src/<kind>/User/index.ts                       → export * as Get from "./handlers/Get.handler.ts"; …
client/src/<kind>/User/User.service.ts                → Client = RpcClient.make(Rpcs)
```

`contracts/` and `handlers/` become the two admitted sub-folders inside a
concept folder (a named exception to *barrel and namespace style*'s "flat
only inside a concept"); the only files allowed there are
`<Op>.contract.ts` / `<Op>.handler.ts`; one optional group level
(`contracts/SignUp/Email.contract.ts` → `User.SignUp.Email`). Operation names
are PascalCase verbs and must not collide with the role-member vocabulary.

**Rationale:** v3 held this on one template: 72 `<Op>.contract.ts` in 28
`contracts/` dirs (`Contract` 72 / `Payload` 72 / `Success` 84 / `Failure` 144 exports,
const + type — one quartet per file), `Rpcs` derived from `<Op>.Contract.Rpc`,
120 client `handler.ts`/`contract.ts` file pairs (`Handler` 119 / `Wrapper`
121 exports). v4 has the slots (DECISIONS 2026-04-21 puts protocol declarations in
`use-cases`; roles `.rpc/.http/.tools`, `*-handlers`, `.command-client`) but
no member law: 7 `.rpc.ts` files export per-op *prefixed* symbols
(`GetWorkspaceVaultRpc`, `GetVaultSyncStatusPayload`), fixed
`Payload`/`Success`/`Failure`/`Contract`/`Handler` exports are 0, and handlers
are hand-typed factories (`makeWorkItemHttpHandlers`). Effect v4 supplies the
primitive: `Rpc.make(tag, { payload, success, error, defect, stream })`
exposes `payloadSchema` / `successSchema` / `errorSchema`; `RpcGroup.make`,
`.toLayer`, `RpcClient.make` (`.repos/effect/packages/effect/src/unstable/rpc/`).
The option key is `error`, not `failure`: `Failure` is the member name,
`error: Failure` the wiring. Codegen: `add role --role rpc --op Get` emits one
contract file, one handler file and one `Rpcs` entry from invariant symbols.
Rejected: *keyed handler object only* (no `User.Get.Handler` node; the pair
cannot be audited per operation); *v3's file tree* (contradicts kind folders
and tier packages). Cost accepted: a small `Contract` kit (v3's `W.Wrapper`
has no v4 port) — `Contract.make` returning the `Rpc` with `Payload`,
`Success`, `Failure` statics and `implement` as a typed identity helper —
proposed as a `@beep/schema` concept module per DECISIONS 2026-05-22;
conversion of the 7 `.rpc.ts` files; two sub-folders in the audit grammar.
Evidence: `synthesis/22-family-barrel-namespace.md` BN-23–BN-24.

## 2026-08-30 — deferred rows (DEFERRED, with recommendations)

**Question:** The consolidated table (`synthesis/00` §Decision coverage) and
the completeness critique (`synthesis/90` B1, B3) found seven measured rows
whose convention no grill decision chooses, plus two proof files with no
doctrine role; the 2026-08-30 addenda added six member/contract sub-choices
and the same day's capability gate one lane-host choice. Decide now or defer?

**Answer:** DEFERRED to `slice-topology-audit` P0, each with the recommended
answer recorded here so the follow-up ratifies rather than re-derives:

| Item | Recommended answer |
| --- | --- |
| `dir:package-shell-skeleton` | the shell `create-package` emits is the law; audit rule `shell/required-files` |
| `BN-19` | source export map is truth, publish mirror derived; rule `exports/source-publish-parity` |
| `tests:coverage-ratio-by-tier` | not a topology rule; stays with the coverage ratchet |
| `tests:typecheck-covers-test-tree` | every package with tests typechecks them; surface `lint package-test-typecheck` in the audit report |
| `BN-12` (`<Concept>/server.ts` / `worker.ts` shims, 15 files, 6 slices) | admit as concept-local entry files named for their subpath (R7's rule extended) |
| `BN-14` (`.ts` specifiers) | codify; no new gate |
| `BN-15` (root barrel pure re-export) | codify; fold into the barrel rule |
| lab `WorkItem.client.ts` | → client `WorkItem.service.ts` (facade; split into `.command-client`/`.query-client` only with two transports) |
| lab `WorkItem.view-model.ts` | → admit ui `.view-model.ts` as the one pure-`.ts` ui role (view projections) |
| member vocabulary: `Repo` vs `Repository` | `Repo` (v3 39/39 and the operator's wording) |
| member vocabulary: values | `Id` fixed; other values bare inside the namespace; the proof's `WorkItemId` / `WorkItemStatus` / `WorkItemTitle` renamed |
| member vocabulary: client member | `Client`, derived from `Rpcs` (the lab's `WorkItemClient` → `Client`) |
| contracts: kit home | `Contract` concept module in `@beep/schema` (`make`, `implement`), built as a sibling of `@beep/schema/Fn` (`SchemaUtils.withStatics` + `implement*`) over `Rpc.make`; inline `Rpc.make` + sibling exports only if a kit is judged premature; reconciles `drivers/govinfo` `contracts/Search` (the one live `Payload`/`Success`/`Failure` folder, against `HttpApiEndpoint`) |
| contracts: sub-folders | admit `contracts/` and `handlers/` inside a concept; `<Op>.contract.ts` / `<Op>.handler.ts` only |
| contracts: group level | one optional level (`contracts/<Group>/<Op>.contract.ts` → `<C>.<Group>.<Op>`) |
| audit lane host (capability gate 2026-08-30) | land the audit as a `rootRepoLintPolicySteps` step in P1 (it rides the already-required `Heavy / Lint Policy` context; zero YAML or ruleset change; yeet `verify` inherits it); register the dedicated `ci lane architecture-audit` in P2 for local ergonomics and promote it to its own required context only if the step's runtime exceeds the lint-policy budget — *auditor shape* still holds (bundled into `lint policy` and given a lane); this only sequences which context gates |

*(Rows from `member vocabulary:` through `audit lane host` were ratified later the same day — see the next entry; the first nine remain DEFERRED.)*

**Rationale:** These are measurement rows and sub-choices the brief did not ask to decide and
that the operator was not asked about in the grill; they gate no
recommendation in `synthesis/40` (each still has a terminal mechanism there)
but they do gate two R3 renames, so they are ratified before the manifest
PR. Deferring with a recommendation keeps the resume point honest without
inventing operator decisions.

---

## 2026-08-30 — sub-choices ratified, brief accepted, graduation (operator)

**Question:** Lock the seven deferred sub-choices now or ratify them in
`slice-topology-audit` P0? Does `BRIEF.md` match the picture in the
operator's head — graduate now, graduate the audit alone, or hold?

**Answer:** All seven locked with their recommended answers, and both goals
graduate now:

| Sub-choice | Decided |
| --- | --- |
| `Repo` vs `Repository` | `Repo` (`RepoShape`, `RepoLive`, `Repo<Adapter>Live`, `RepoTest`) |
| values | `Id` fixed; every other value bare inside the namespace (`User.Status`, not `UserStatus`) |
| client member | `Client`, derived from `Rpcs` |
| `Contract` kit home | `@beep/schema` concept module `Contract` (`make`, `implement`), built as a sibling of `@beep/schema/Fn` (`SchemaUtils.withStatics` + `implement*`) over `Rpc.make`; reconciles `drivers/govinfo` `contracts/Search` |
| sub-folders | `contracts/` and `handlers/` are the only sub-folders admitted inside a concept; `<Op>.contract.ts` / `<Op>.handler.ts` only |
| group level | one optional level: `contracts/<Group>/<Op>.contract.ts` → `<C>.<Group>.<Op>` |
| audit lane host | the `rootRepoLintPolicySteps` step is the required context first; `ci lane architecture-audit` is registered for local ergonomics and promoted to its own required context only if runtime exceeds the lint-policy budget |

Brief accepted as written (appetite reworded as a budget the same day).
Graduated into `goals/slice-topology-audit` (provides
`architecture/slice-audit`) and `goals/canonical-proof-reconciliation`
(requires it; provides `architecture/proof-reconciled`), scaffolded from
`beep goals bootstrap --plan --json` payloads with `SPEC.md` seeded from
this file, `BRIEF.md` and `MAP.md` by back-link.

**Rationale:** Every sub-choice had one recommended answer with evidence and
no measured counter-case; deferring them to P0 would only have moved the same
question to a session with less context. Rejected: *`Repository`* (v4's
current spelling, but v3 39/39, the operator's wording, and shorter `RepoLive`
pairs); *concept-prefixed values* (redundant under the namespace, and the
generator's substring macro depends on it); *`Rpc` as the client member*
(the client is a facade over `Rpcs`, not an rpc); *fork `Fn`* (a
function-value schema with decode-on-call semantics and no `RpcGroup`
integration — reuse its construction, not its type); *one flat `<C>.rpc.ts`
with prefixed symbols* (today's shape; it is what makes 0 fixed members);
*unbounded contract nesting* (v3's `sign-up/email/` tree is the not-ported
part); *dedicated required lane first* (runtime unmeasured; the lint-policy
step already rides the required `Heavy / Lint Policy` context with no YAML
or ruleset change — *auditor shape* still gives the audit its lane).
*Graduate the audit alone* was rejected because the reconciliation packet's
`requires` edge already sequences it; holding it in `MAP.md` would only
hide the dependency. Nine DEFERRED measurement rows remain for P0.

---

**Frontier after graduation:** no blocking questions; nine DEFERRED
measurement rows (`dir:package-shell-skeleton`, `BN-19`,
`tests:coverage-ratio-by-tier`, `tests:typecheck-covers-test-tree`, `BN-12`,
`BN-14`, `BN-15`, lab `WorkItem.client.ts`, lab `WorkItem.view-model.ts`)
ratify in `slice-topology-audit` P0 with the recommended answers above.
Manifest `openQuestions` lists them with the `DEFERRED` prefix.
