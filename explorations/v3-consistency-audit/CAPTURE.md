# CAPTURE — v3-consistency-audit

> Append-only raw dump. Never tidy, reorganize, or interrogate. New material goes
> under a new dated heading at the bottom.

## 2026-08-29 — the spark (the brief, as given)

Reduce token waste and improve consistency & validation of vertical slices by
leveraging quality semantics, the architecture CLI, and codegen.

"Token waste" here means agent navigation overhead: when a slice's structure is
predictable from the path grammar alone, agents (and humans) spend fewer tokens
exploring, re-reading, and guessing before acting.

### Context (verbatim)

In the v3 codebase there was a high degree of consistency across vertical slices.
Every slice followed the same `packages/<slice>/{domain,tables,server,...}` spine,
the same `{concept}.{role}.ts` suffix taxonomy (`.model`, `.repo`, `.service`,
`.layer`, `.handlers`, `.table`, `.errors`, …), kebab-case directories, and barrel
`index.ts` exports — so any file's purpose and location were predictable from the
path grammar alone.

The v4 architecture is better (hexagonal vertical slices, use-cases/ports
separation, family/kind package grammar), but module consistency, namespacing &
collocation lag v3. Conventions exist on paper but are not uniformly applied or
automatically checked.

### Reference material the brief pointed at

- v3 (archived): repo `effect-v3-main-archive`, local checkout
  the local v3 clone `beep-effect4` (path in `research/SOURCES.md`; HEAD `997a827454`, "archiving main",
  2026-02-22). Focus the v3 `iam` & `knowledge` slices (`beep-effect4/packages/iam`, `beep-effect4/packages/knowledge`). Existing
  archaeology: `explorations/atlas-synthesis/synthesis/40-v3-specs-corpus.md`,
  `41-v3-knowledge-engine.md`, `42-v3-knowledge-domain-and-demo.md`.
- v4 doctrine: `standards/ARCHITECTURE.md`; `standards/architecture/` `01`, `07`,
  `13`, `GLOSSARY.md`, `DECISIONS.md`.
- Architecture CLI: `packages/tooling/tool/cli` → `bun run beep architecture`
  (`create slice|package`, `add concept|role`, `plan|apply|check`; `--stage`,
  `--domain-kind`, `--dry-run`).
- `goals/canonical-slice-factory/` — the factory proof loop
  (`architecture-lab/WorkItem`).

### Prior findings the brief handed over (hypotheses to validate, not conclusions)

- v3 strengths partially lost in v4: path-grammar predictability (held by habit,
  not tooling); near-1:1 test collocation ratio with no v4 ratchet; uniform spine
  everywhere vs v4's optional-by-need rule (philosophically correct, but "is
  `use-cases/` missing by intent or by omission?" is ambiguous).
- v4 strengths v3 never had: directional boundary arrows with import ceilings &
  public-surface rules; the operation-plan CLI (schema-versioned JSON plan with
  `plan`/`apply`/`check` + idempotency); family/kind grammar and a small shared
  kernel.
- Known tensions: casing schism (v3 kebab vs v4 PascalCase concept folders —
  **decided: PascalCase wins, recommend only the gate**); fragmented enforcement
  (many gates, no single "does this existing slice conform?" auditor —
  `beep architecture check` validates *plans*, not *existing packages*);
  barrel/namespace discipline drift (v3's uniform `export * as User from "./user"`
  applied inconsistently in v4 and unchecked).
- Leading recommendation to pressure-test: extend `beep architecture check` (or
  add a sibling `audit`) from plan-validation into a topology auditor over
  existing slices, emitting codified/drifted/missing verdicts. Habits enforced
  socially in v3 (solo author) must become mechanical gates in v4.

### Scope & decided constraints (verbatim intent)

- Analysis & recommendations only. No refactors, no `standards/` edits, no
  overturning `DECISIONS.md`.
- Casing is decided: PascalCase concept folders win. Do not relitigate.
- Evidence discipline: every codified / drifted / missing verdict backed by
  file paths and `rg`/`fd` counts from both repos — never doctrine quotes alone.
- Ship as an explorations packet following `atlas-synthesis` conventions.

> The architecture we have now is better — what is lacking is module
> consistency, namespacing & collocation. Do not treat v3 as an architecture to
> return to: v4's boundaries win; v3 wins on uniformity. Migrate the uniformity,
> not the architecture.

## 2026-08-29 — first-contact scout numbers (raw, before the fan-out)

Measured inline before delegating; several contradict the brief's hypotheses.

- v3 file counts (src / test files): iam domain 233/1, tables 26/1, server 55/1,
  client 629/2, ui 37/1; knowledge domain 281/4, tables 26/1, server 189/52,
  client 1/1 (stub), ui 1/1 (stub).
- v3 role-infix distribution (iam+knowledge src): `.repo` 76, `.tool` 42,
  `.http` 42, `.entity` 39, `.contract` 38, `.table` 23, `.value` 15,
  `.errors` 12, `.schema` 11, `.schemas` 4 … — but **1163 src files carry no
  role infix at all** (`knowledge/server/src/Extraction/EntityExtractor.ts`,
  `iam/client/src/admin/ban-user/*.ts`). So "uniform `{concept}.{role}.ts`" was
  true for the *domain entity folders*, not for the slice as a whole.
- v3 `knowledge/server/src` is PascalCase topical modules (`Embedding/`,
  `Extraction/`, `GraphRAG/`, `Rdf/`, …) with single-segment PascalCase files;
  `test/` mirrors those directories. 52 test files / 189 src = 0.28 by file
  count. The "near-1:1" in `41-v3-knowledge-engine.md` is a *line* ratio
  (~15k test LOC), not a file ratio.
- v3 casing was itself split: PascalCase entity dirs in domain/server, kebab-case
  operation dirs in `iam/client`, kebab-case `tables/*.table.ts` files.
- v3 barrels: 473 `export * as`, 467 `export * from`, 65 `export {` across 347
  `index.ts`. Top-level `domain/src/index.ts` = pure namespace map
  (`export * as Entities from "./entities"` …).
- v3 identity: `const $I = $KnowledgeDomainId.create("entities/Entity")` in 471
  src files; v4 slices: `const $I = ` in 380 src files (convention survived).
- v4: no `iam` or `knowledge` slice under `packages/`. Slices with a `domain/`:
  agents, architecture-lab, documents, epistemic, law-practice, ontology,
  shared, workspace. The doctrine's example path
  the doctrine's `iam/server/src/Membership/Membership.http-handlers.ts` example is hypothetical.
- v4 suffix distribution (slice src): `.model` 118, `.values` 20,
  `.converters` 17, `.table` 16, `.layer` 15, `.errors` 11, `.service` 10,
  `.ports` 8, `.repo` 7, `.commands` 7, `.repository` 6, `.rpc` 5, `.atoms` 4,
  `.use-cases` 3, `.read-model-table` 3, `.models` 3, plus ~30 singleton
  suffixes (`.gate`, `.fetch`, `.kernel`, `.inspector`, `.workbench`, …).
  659 single-segment src files. 327 `index.ts`. Barrels: 120 `export * as`,
  641 `export * from`, 30 `export {`.
- v4 src dir casing: 176 PascalCase vs 11 lowercase names (`entities` 57,
  `aggregates` 54, `values` 24, `internal` 18, `tools` 6, …).
- v4 domain-kind folder use is per-tier inconsistent: epistemic
  `use-cases/server/client/ui`, law-practice `server/use-cases`, agents `server`,
  shared `use-cases` use bare `<Concept>/`; architecture-lab, documents,
  ontology, workspace use `aggregates|entities/`.
- v4 `architecture-lab` (the CLI's own accepted proof) vs doctrine vocabulary:
  `use-cases/…/WorkItem.repository.ts` (doctrine `.ports.ts`),
  `WorkItem.use-cases.ts` (not in vocabulary), `server/…/WorkItem.http.ts`,
  `.rpc.ts`, `.tools.ts` (doctrine `.http-handlers.ts`, `.rpc-handlers.ts`,
  `.tool-handlers.ts`), `tables/src/tables.ts` (doctrine `Tables.ts`),
  `config/src/layer.ts` (doctrine `Layer.ts`). `TemplateRetarget.ts` renames
  `WorkItem` → new concept from this manifest, so every `add concept` copies it.
- v4 tests: 0 under `src/`; `test/` dirs flat or `integration/`; suffixes
  `.test` 126, `.equivalence.test` 14, `.pglite.test` 9, `.pg.test` 2,
  `.e2e.test` 2. `law-practice/domain` 214 src / 3 test files.
- v4 root files: `use-cases/src/{public,server,test}.ts` everywhere; `server/src/
  Layer.ts` in 6 slices; `tables/src/{Tables,ReadModels}.ts` only in
  law-practice; no `Api.ts`/`Rpc.ts`/`Tools.ts` anywhere.
- v4 gates: `beep lint` {circular, deprecated-apis, ecosystem-polarity,
  goal-packets, identity-registry, judge-rubric, package-test-imports,
  package-test-typecheck, policy, reflection-artifacts, roadmap-refs,
  schema-catalog, schema-first, schema-topology (`@beep/schema` only),
  tooling-schema-first}; `beep laws` {effect-fn, effect-imports,
  native-runtime, frozen-grant-set, allowlist-check}; `beep quality` {fallow,
  knip, jsdoc-ratchet, tsgo-rules, terse-effect, config-check, …};
  `beep tsconfig-sync`; `beep architecture check` (plan idempotency only).
  Nothing checks file-role suffixes, casing, barrel completeness, or
  domain-kind placement. Fallow zones are generated from workspace deps
  (`standards/fallow.boundaries.generated.jsonc`).

## 2026-08-30 — operator addendum (verbatim; absolute paths shortened to `~`)

> Did you catch the `Model` & namespacing semantics? Checkout how Instead of
> `User` it's `User.Model`, instead of UserTable it's User.Table, instead of
> UserRepository it's `User.Repo` etc this is one consistency thing I would
> like to include.
>
> This is a pretty common theme & one of the main reasons I wanted to do this.
>
> Reasons:
> - makes boiler plating & code generation easier & more consistent

> Another thing I thought was very clean about the v3 version of "use cases"
> Rpc definitions was the Handler, Wrapper (I would change this to Contract
> now) semantics.
>
> I want to match our current architectures layout & organization but I do
> particularly like the way I namespaced every thing:
> `beep-effect4/packages/iam/domain/src/entities/Account/contracts/index.ts`
> `beep-effect4/packages/iam/server/src/entities/index.ts`
> `beep-effect4/packages/iam/client/src/sign-up/index.ts`
> `beep-effect4/packages/iam/client/src/sign-up/email/index.ts`
>
> More emphasis on the semantics more than the organization, architecture &
> structure.

Scout numbers at capture time (session-measured, Codex verification pending;
`coverage/`, `dist/`, `node_modules/` excluded):

- v3 role members: `.model.ts` → `Model` 39/39; `.repo.ts` → `Repo` /
  `RepoShape` (domain) / `RepoLive` (server) 39 each; `.entity.ts` → `Entity`
  39/39; `.errors.ts` → `Errors` 39; `.contract.ts` → `Contract` 72 /
  `Payload` 72 / `Success` 84 / `Failure` 144 (const+type). Consumer access
  `.Model` 407, `.Contract` 238, `.Repo` 132, `.Entity` 53, `.RepoLive` 39.
  `.table.ts` was the exception (camelCase table names, `.Table` 0).
- v4 role members: domain `.model.ts` 150 — class named after its folder 94,
  `export class Model` 4 (all `packages/shared/domain`); consumer `.Model` 114
  (shared only); tables `export const Table` 23/32, consumer `.Table` 174;
  `.ports.ts` `Repo` 0/13; `.converters.ts` `<C>Row`/`<C>Insert` 28 each.
- v4 consumer import style: deep named `import { X } from
  "@beep/<slice>-domain/<kind>/X"` 881 vs `import * as X` 179 vs kind-barrel
  5; `X.X` self-repeat 2.
- Generator: `Architecture/internal/TemplateRetarget.ts` L146-171 retargets by
  substring rename of `WorkItem`/`work-item`/`work_item`/`ArchitectureLab`
  over file bodies.
- v3 operations: 72 `contracts/<Op>.contract.ts` in 28 `contracts/` dirs;
  `contracts/index.ts` = `export * as <Op>`; `Account.rpc.ts` derives
  `Rpcs` from `<Op>.Contract.Rpc`; client 120 `handler.ts` + 122
  `contract.ts` (`Handler = Contract.Wrapper.implement(…)`, `Wrapper =
  W.Wrapper.make("Email", …)`), 246 `Handler`/`Wrapper` exports; server tier
  barrel `export * as <C>Live` 20/20.
- v4 operations: request/RPC/HTTP declarations in 7 files, all `use-cases`
  `.rpc.ts`, per-op prefixed symbols; `S.TaggedRequest` 0; fixed
  `Payload`/`Success`/`Failure`/`Contract`/`Handler` exports 0; client tier 11
  non-index files, `.command-client.ts`/`.query-client.ts` 0.
