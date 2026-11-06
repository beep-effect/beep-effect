# Research library ontology core Spec

## Objective

Make the research library ontology-first. Replace the anonymous `S.Struct`
catalog models in `commands/Research/Library/Library.schemas.ts` with named
`S.Class` models carrying `$I.annoteSchema` ontology annotations aligned to
PROV-O, CiTO, FaBiO, SKOS and DCAT; make `Library.service.ts` the
`Context.Service` contract and live layer the command topology requires;
generate the Turtle T-Box and SHACL shapes from those models through the
`@beep/ontology` fold; validate the catalog projection with `@beep/shacl`;
serve the library views from SPARQL over `@beep/oxigraph`. Graduated from
[explorations/research-library-ontology](../../explorations/research-library-ontology/README.md)
(brief, decisions and map there are the design record).

## Non-Goals

- No ontology authored by hand in Turtle or LinkML; no Python ontology
  toolchain in the repo.
- No storage switch: the file library (`objects/`, `intakes/`, `catalog/`)
  stays the source of truth; oxigraph is a query projection rebuilt from it.
- No promotion of the library model into `packages/epistemic`; that is a
  gated candidate in the exploration's `MAP.md`.
- No new acquisition routes (Firecrawl, Box, VidBee, alphaXiv) and no hop-2
  acquisition: `research-library-routes`.
- No new intake: `research-intake-2026-11`.
- No edits to retained originals, captures or historical correction receipts.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards
   (`standards/architecture/07-non-slice-families.md` §Repo CLI Command
   Topology; `04-rich-domain-model.md`; `.patterns/jsdoc-documentation.md`).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, then the
   exploration packet's `BRIEF.md`, `DECISIONS.md` and `MAP.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- `packages/tooling/tool/cli/src/commands/Research/Library/*` (models,
  service, render, verify, status, index facade).
- `packages/tooling/tool/cli/test/Research/*` (replay fixtures, SHACL
  conformance, hash-equality render tests).
- a `Dcat` vocabulary module in `@beep/rdf` beside its `Vocab` siblings (new vocabulary; the
  only foundation change).
- `docs/runbooks/research-library.md` (ontology render, verify, SPARQL views).
- The out-of-repo library root: new `ontology/` directory with generated
  `research-library.ttl` and `research-library.shacl.ttl`, and a versioned
  catalog migration receipt. No repo file points at the operator's home
  directory by absolute or home-relative path.

## Constraints

- Design order is schema → `Context.Service` contract → implementation.
  Models first: `Source`, `SourceVersion`, `Capture`, `Artifact`,
  `Occurrence`, `Finding`, `Derivation` (with `hopDepth`), `ModelRun`,
  `AccessClass`, plus the existing `LiteralKit` vocabularies.
- Alignment lives in annotations: every class and property names its IRI and
  external alignment (`prov:Entity`, `prov:Activity`, `prov:SoftwareAgent`,
  `cito:*`, `fabio:*`, `skos:Concept`, `dcat:Dataset`/`dcat:Distribution`).
  IRIs mint through `@beep/identity`; never hand-rolled namespaces.
- Phase vs kind: capture dispositions (`readable`, `incomplete`,
  `tool-blocked`, ...) are phases of a capture; `hopDepth` is a property of
  the derivation edge; neither becomes an OWL class. Run the
  `ontology-foundational-auditor` skill on the model set before the first
  T-Box is emitted and record its verdicts as a decision file.
- The topic scheme is SKOS: one `skos:Concept` per `goals/<slug>` and
  `explorations/<slug>`; relevance is a `skos:related` edge from a finding to a
  concept. Concepts are derived from the packet manifests, never typed by hand.
- The catalog change is a versioned migration: declare the validator contract
  version, replay both existing intakes (`2026-10-06`, `2026-10-14`) through
  the new models, and require a hash-equal `index.md` re-render before any
  state mutation. Whole-library migration and selected-source acquisition
  remain separate commands.
- `Library.service.ts` holds the `Context.Service` contract, constructor and
  default live layer; root/config resolution moves to an earned
  `Library.paths.ts` role. The `index.ts` facade exports named public
  models, errors and the service contract; no star re-export of internals.
- `accessClass` is a schema field on `Source` and `Artifact`; `render`
  excludes `private` by default and `status` reports the partition
  separately.
- Use `effect/HashMap`, `effect/HashSet` and their mutable forms; no native
  `Map`/`Set`. `Effect.fn`/`Effect.fnUntraced` for every generator function.
  JSDoc per `.patterns/jsdoc-documentation.md`.
- Run `bun run beep yeet verify --tier cheap-gates` during the work, not only
  at publish (October lesson: Fallow, jsdoc hook and test policy surfaced late).

## Acceptance Criteria

- [ ] `Library.schemas.ts` exports named `S.Class` models for Source,
      SourceVersion, Capture, Artifact, Occurrence, Finding, Derivation,
      ModelRun and AccessClass, each with `$I.annoteSchema` ontology
      annotations naming IRI and alignment; no anonymous exported `S.Struct`
      remains in the catalog contract.
- [ ] `Library.service.ts` is the `Context.Service` contract and live layer;
      `bun run beep architecture` and the command-topology lint report no
      role drift for the group; `index.ts` has no star re-export.
- [ ] a new `ontology render` subcommand under `beep research library` writes
      `ontology/research-library.ttl` and `ontology/research-library.shacl.ttl`
      through `@beep/ontology` `fold` and `toTurtle`; `@beep/n3` parses both.
- [ ] `bun run beep research library verify` validates the catalog projection
      against the generated shapes with `@beep/shacl` and reports zero
      violations on both existing intakes.
- [ ] Replaying intake `2026-10-06` through the new models re-renders
      `index.md` hash-equal to the pre-migration render; the migration receipt
      records validator contract version, before/after catalog hashes.
- [ ] `research library status` and `render` read their coverage, routing and
      per-report views from SPARQL over `@beep/oxigraph` loaded from the
      catalog projection; the hand-maintained view code is deleted.
- [ ] The foundational-auditor verdicts (phase vs kind, rigidity of Source vs
      SourceVersion) are recorded as a decision file and reflected in the
      T-Box.
- [ ] A `Dcat` vocabulary module exists in `@beep/rdf` with the same shape and tests as
      its siblings.
- [ ] Runbook updated; no absolute or home-relative operator paths in repo
      files (`bun run beep knowledge refs --tree HEAD --check` passes for
      this packet's files).
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/research-library-ontology-core/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/research-library-ontology-core/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/research-library-ontology-core` | Passes |
| Package proof | `bun run beep quality package-verify @beep/repo-cli` and `@beep/rdf` | Passes |
| Cheap gates | `bun run beep yeet verify --tier cheap-gates` | Passes |
| Replay | library tests: migration replay of both intakes, hash-equal render | Passes |
| SHACL | library tests: generated shapes validate the catalog projection | Zero violations |
| Topology | `bun run beep architecture` on the Research group | No role drift |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add research-library-ontology-core --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug research-library-ontology-core`; add a `kind: decision` file there, never edit this block._

### Command-topology verification uses the architecture standard, not a dedicated lint, 2026-11-06

No command-topology lint exists in @beep/repo-cli. The no-role-drift criterion is checked against standards/architecture/07 §Repo CLI Command Topology: the command, schemas, errors and service roles, earned paths/render/ontology/projection/views roles, and an index.ts facade without export *. bun run beep architecture plan/check is the tool-backed part.

Lane `feat/research-library-ontology-core`

Reverse: Wire a topology lint later and re-run it on the group

### DCAT enters through the identity CoreVocab registry, then is generated into @beep/rdf, 2026-11-06

Every @beep/rdf Vocab sibling is pinned by VocabDrift.test.ts against an identity registry, and its terms file is generated by sync-data-to-ts --target vocab-terms. Giving Dcat the same shape and tests means adding a dcat entry to CoreVocab and to the VocabTerms target. This also lets fold resolve dcat: CURIEs. It is the one foundation change beyond the @beep/rdf module, and it is additive.

Lane `feat/research-library-ontology-core`

Reverse: Remove the dcat CoreVocab entry, the VocabTerms prefix and the generated and hand-authored Dcat modules

### Dispositions are capture phases and hop depth is an edge property, 2026-11-06

readable/incomplete/tool-blocked/unavailable and the review categories are phases of a Capture, not OWL classes; Derivation.hopDepth is a property of the wasDerivedFrom edge; cutoff and caps are policy values. The ontology-foundational-auditor skill runs on the model set before the first T-Box emission and its verdicts land as a decision file.

Lane `explore/research-library-ontology`

Reverse: Reclassify in the models and regenerate the T-Box; the foundational-auditor verdict file records why it was wrong

### Effect S.Class is the ontology source; Turtle and SHACL are generated, 2026-11-06

Named S.Class models with $I.annoteSchema annotations in Library.schemas.ts are hand-authored; the T-Box and shapes are projected through the @beep/ontology fold (fold -> AssembledOntology -> toTurtle) with IRIs minted by @beep/identity. LinkML (no installed tooling, interface-only TS generation) and hand-authored Turtle (two drifting sources) were rejected. Exploration decision 2026-11-06, T-Box source of truth.

Lane `explore/research-library-ontology`

Reverse: Delete the generated ontology/ files and the render subcommand; the S.Class models remain valid catalog schemas without annotations

### Foundational-auditor verdicts: phases stay vocabularies, SourceVersion is a dependent snapshot, ModelRun is an activity, 2026-11-06

Primary-seat verdicts are in research/FOUNDATIONAL-AUDIT.md and the independent adversary seat is in research/FOUNDATIONAL-AUDIT-REVIEW.md. Capture status, effective categories, access class, source kind, ownership and qualification status are controlled vocabularies (SKOS concepts plus sh:in), never OWL classes. Source and SourceVersion are both rigid kinds. SourceVersion depends on one Source through prov:specializationOf and is never a subclass of it. Occurrence and Derivation are reified relators. hopDepth is an edge property measured from an intakeId anchor. ModelRun is a prov:Activity associated with a prov:SoftwareAgent model pin; the first design called it a SoftwareAgent, which merged specification and execution. Artifact drops the dcat:Distribution alignment. The option DTOs have no domain referent and stay out of the fold. Steward ratification is an agent decision under the 2026-10-06 autonomy charter.

Lane `feat/research-library-ontology-core`

Reverse: Reclassify in Library.schemas.ts and Library.ontology.ts and regenerate the T-Box; record why in a superseding decision

### Library export names keep the Library prefix; ontology class names are the bare SPEC names, 2026-11-06

The @beep/repo-cli/commands/Research facade already re-exports LibrarySource, LibraryCapture and the rest, and around 8k lines of Library code import them. Renaming the exports would be churn with no ontology value. The ontology identity comes from $I.class("Source") and its siblings, so the class IRIs are .../Library.schemas/Source etc. The one rename is LibraryVersion to LibrarySourceVersion, because SourceVersion is the named SPEC model and the old name was ambiguous.

Lane `feat/research-library-ontology-core`

Reverse: Rename the exports to the bare names in one mechanical pass; the class IRIs do not change

### Library models are branded S.Opaque classes, not S.Class, under schema-first D1, 2026-11-06

The SPEC asked for named S.Class models. The repo's schema-first lint (rule schema-first-inventory, D1) requires plain-data models to be branded S.Opaque over S.Struct, and repo standards outrank packet prose (GOAL.md and the SPEC source hierarchy). The models stay named exported classes (class LibrarySource extends S.Opaque<...>()(S.Struct({...}))). Their ontology identity comes from .annotate($I.class("Source")), the same form packages/foundation/modeling/ontology/test/Fold.test.ts folds, so the T-Box, the SHACL shapes and the S.Class acceptance intent (named, annotated, no anonymous exported S.Struct) are unchanged.

Lane `feat/research-library-ontology-core`

Reverse: Convert back to S.Class if D1 adopts an exception for ontology-bearing models; the fold output stays identical

### Library models stay in tooling; epistemic promotion is gated, 2026-11-06

The research library keeps its domain model inside commands/Research/Library; a versioned Turtle T-Box in the library root is the shareable artifact. Promotion to the epistemic slice fails the specific-home-first gate with one consumer. Build location stays in @beep/repo-cli; beep-cli-composition moves the group later.

Lane `explore/research-library-ontology`

Reverse: Move the models to packages/epistemic/domain behind a promotion record once a second consumer exists; the CLI imports them

### repo-cli gains workspace dependencies on ontology, semantic-web, shacl, oxigraph and n3, 2026-11-06

The render, verify and SPARQL views need fold/toTurtle (@beep/ontology), the service contracts (@beep/semantic-web) and the three live drivers. They are workspace dependencies only: there are no new external packages, and the lockfile changes only for workspace links.

Lane `feat/research-library-ontology-core`

Reverse: Drop the five workspace dependencies together with the ontology render, SHACL verify and SPARQL view code

### SHACL shapes are derived from the AssembledOntology inside the Library group, 2026-11-06

@beep/ontology exposes fold, toTurtle, toJsonLd and toMarkdown, but no SHACL projection. The Library group derives NodeShapes from assembled classes and predicates (targetClass, min/maxCount, datatype, class, sh:in for LiteralKit members). It emits @beep/semantic-web ShaclNodeShape values and serializes them to Turtle with N3TurtleCodec, so the shapes stay generated from the same S.Class source. Promoting the projection into @beep/ontology waits for a second consumer.

Lane `feat/research-library-ontology-core`

Reverse: Move libraryShapes into @beep/ontology as toShacl when a second consumer appears; regenerated files must stay byte-equal

### The catalog schema becomes v2 through an explicit migrate command, 2026-11-06

accessClass, findings, derivations and modelRuns change the persisted contract. LibraryCatalog.schema accepts v1 and v2, and the new fields decode with defaults, so v1 files stay readable. beep research library migrate writes v2 only after a hash-equal index.md re-render. It backs up the pre-migration catalog under catalog/history/ and writes a LibraryMigrationReceipt. Whole-library migration stays separate from selected-source acquisition (October lesson).

Lane `feat/research-library-ontology-core`

Reverse: Restore the backed-up catalog/history/<sha>.json over catalog/library.json; v1 still decodes

### The library root default moves to XDG data home; the operator path lives in the environment, 2026-11-06

SPEC forbids absolute or home-relative operator paths in repo files, and the old default hard-coded one in Library.service.ts, the flag help and the runbook. The resolution order is now --library, BEEP_RESEARCH_LIBRARY, XDG_DATA_HOME/beep/research-library, then HOME/.local/share/beep/research-library. The operator keeps the existing library by exporting BEEP_RESEARCH_LIBRARY.

Lane `feat/research-library-ontology-core`

Reverse: Restore the previous fallback in Library.paths.ts

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
