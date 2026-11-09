# Text-Knowledge Stack Rebuild Spec

## Objective

Rebuild the foundation text-knowledge stack so that every object the vision
names (source text, anchor, annotation, term, claim, activity) has one
denotation, one owner, and lawful arrows to its neighbours. The final state is
observable:

1. Eight layers in a compile-time dependency DAG inside `foundation/modeling`
   plus two capabilities and one cross-cutting agent contract: identity (L0),
   text identity and anchoring (L1), annotation (L2), taxonomy and alignments
   (L3), claims (L4), operations (L5), RDF interchange (L6), agent surface (L7).
   Every edge is legal under `standards/ARCHITECTURE.md` layering (modeling
   depends only on primitive and modeling; capability is unreachable from a
   slice's `domain`).
2. One occurrence identity for text (`OccurrenceId`: scope, text capture,
   unit, range, quote, the `cm1:` preimage generalized) and one `Selector`
   union beside the canonical `TextAnchor`; quotes locate and verify, ranges
   identify; re-anchoring across captures is a recorded `Exact | Widened |
   Unmapped` map and `resolve` returns `Unique | Ambiguous | NotFound`.
3. One standoff annotation model over a text capture (`Annotation<K>`,
   content hash over sorted targets, kind and body; attribution in a separate
   map) that carries both digests, scope, extractor and normalization pins,
   producer, attributes and typed candidates through every handoff that
   exists today (langextract handoff, office-action mapper, docket evidence,
   semantica RDF projection) with declared loss per consumer.
4. Claims restructured around an immutable hashed core with separate records:
   `Stance` (`verbatim | proposed | admitted`), `Challenge`, `Admission`
   (grounding witness and human token bound to actor, action, revision and
   scope), owner-declared `Assessments<K>` coordinates, and the existing five
   typed signals with `Absent{reason}` and no default algebra. The invented
   certainty (`1` at the lab boundary, `0.9` in the office-action spike, the
   passing absent-attachment docket check) is gone and guarded by tests.
5. Term IRIs decoupled from code paths: a `TermBinding` table, a stability
   snapshot that only a deprecation record may change, and a registry that
   expands every namespace the repo speaks (`prov:`, `oa:`, `nif:`, `xsd:`,
   `gufo:` included).
6. Codecs at every boundary, each in an adapter subpath so the base packages
   stay rdf-free: `TextAnchor <-> oa:` selectors, `AnnotationDocument <->
   OA/NIF`, `ClaimCore + records <-> nanopub` named graphs, `fold -> Dataset`
   as the only serialization path; `Dataset` is a set with equality up to
   blank-node isomorphism and a digest on the canonical form; `Literal` is
   `Simple | Typed | LangTagged`.
7. The law catalogue (`research/2026-11-08-rebuild-report.md` section 6) is
   implemented row by row as property tests over production schemas, each
   named after the row and the bug it catches, or recorded as deleted with a
   reason.
8. The doctrine exists: a knowledge-stack chapter under
   `standards/architecture/`, the nine rulings of report section 7 as dated
   `DECISIONS.md` entries with reversal clauses, the glossary entries of
   report section 5, and `packages/foundation/modeling/nlp/THEORY.md`
   rewritten as a narrative that links each structural claim to its test.
9. One complete office-action flow runs end to end on synthetic fixtures with
   law-owned claim structure, per-authority-type assessment profiles and an
   attorney admission bound to actor, action and revision.
10. Package folds and renames (`@beep/annotation`, the `@beep/nlp` fold,
    `@beep/schema-org`, `@beep/ontology` seeds and DTOs, the `@beep/provenance`
    name) are decided by a per-facet consumer census and executed only through
    the retirement procedure; what is declined is recorded with reasons.

## Non-Goals

- Overturning the 2026-10-21 ruling (`standards/architecture/DECISIONS.md`
  "Epistemic Vocabulary Is Foundation; Party Is A Product Slice; Propositions
  Are Slice-Owned"), the `ClaimLifecycle` promotion to `shared/domain`, or the
  verdict law (`standards/architecture/GLOSSARY.md` "Verdict"). This packet
  gives those rulings content; it does not reopen them.
- Legal semantics in foundation. Claim numbers, dependencies, rejections,
  pinpoints, legal roles, Hohfeld positions, docketing vocabularies and MPEP
  source IRIs are law-practice profiles and asset packs, never generic kinds.
- A universal claim state machine. Status is a product of owner-declared
  coordinates; the foundation supplies the shape and the laws, each owner its
  transitions.
- An algebra over the five evidence signals, blended scores, or provenance
  semirings outside a bounded derivation query with a stored provenance term.
- Renaming or folding any package before the census phase, retiring any facet
  without the per-facet procedure, or changing persisted bytes in a
  retirement PR.
- Local-only or on-device architecture language. Hosted providers are
  welcome; the 2026-08-17 revision of the confidentiality rule withdrew the
  local-first framing.
- Corpus or client material in the repository. Fixtures are synthetic or
  public; authorized private material runs only in the operational
  environment.
- OWL authoring with a reasoner (that remains the `packages/ontology/*`
  slice), gUFO typing of every registry term, or NIF and DoCO as internal
  kinds.

## Source Hierarchy

1. The operator's request of 2026-11-08: challenge the text-knowledge stack
   from first principles and rebuild it to be cohesive, semantically accurate,
   architecturally sound, ontologically grounded, composable and theoretically
   modelable, keeping the category-theoretic grounding where it predicts a law.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`schema-first-development`,
   `effect-first-development`, `grill-with-docs`, `yeet`, `closeout`,
   `reflect`).
3. `standards/ARCHITECTURE.md`, `standards/architecture/DECISIONS.md`,
   `standards/architecture/GLOSSARY.md`,
   `standards/architecture/11-evolution-and-deprecation.md`,
   `standards/architecture/08-testing.md`,
   `standards/schema-first-development-prompt.md`.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. `research/2026-11-08-rebuild-report.md` (the design: layers, laws, path,
   refutations), the reader audits and critic reviews beside it, and
   `research/SOURCES.md`.

Higher sources outrank lower sources when they conflict. The report is design
input, not doctrine: where it and a standard disagree, the standard wins and
the disagreement becomes a decision file.

## Target Surfaces

- `packages/foundation/modeling/identity` (L0: registry, `TermBinding`,
  `ContentHash`, `ActivityId`, canonical JSON).
- `packages/foundation/modeling/provenance` (L1: `Selector`, `OccurrenceId`,
  `QuoteKey`, `Resolution`, `Reanchoring`, unit conversion; `TextAnchor` and
  `VerifiedTextAnchor` keep their shapes).
- `packages/foundation/modeling/nlp` (L2 contract landed in `Handoff/` first,
  L5 operations; fold candidate at the census phase) and, if the census
  approves, `@beep/annotation` and `@beep/nlp-processing` created only through
  `bun run beep create-package`.
- `packages/foundation/modeling/epistemics` (L4: immutable core, `Stance`,
  `Challenge`, `Admission`, `Assessments<K>`, `epistemics/rdf` adapter).
- `packages/foundation/modeling/ontology` (L3: SKOS schemes, editions, SSSOM
  `MappingSet`, `fold -> Dataset`, optional gUFO class typing; seeds and DTOs
  move out).
- `packages/foundation/modeling/rdf` (L6: `Dataset` quotient and digest,
  `Literal` cases, `TextAnchor <-> oa:` codec, registry-backed `prov:`, `oa:`,
  `nif:`, `xsd:`; the `rdf -> md` edge removed).
- `packages/foundation/modeling/md`, `pandoc-ast`, `lexical`, `html`: AST
  source maps that import `provenance`.
- `packages/foundation/capability/langextract/src/Handoff` (lossless handoff),
  `apps/labs/semantica/src/layers` (RDF projection and the `1` default),
  `packages/law-practice/use-cases` (`OfficeActionReview` `0.9`, `DocketReview`
  absent-attachment check, `IrToLaw` ports), `packages/law-practice/server`
  citation identity (`cm1:`/`ca1:` as the `OccurrenceId` precedent), the
  law-practice asset pack that receives the legal seeds.
- `packages/tooling/test-kit/test-runner` pinned `test-utils` IRIs (resolved
  through the binding table).
- `standards/architecture/` (new knowledge-stack chapter, `DECISIONS.md`
  entries, `GLOSSARY.md` entries), `docs/PROSE_TO_PROOF_VISION.md` (local-first
  posture, BeepGraph status), `packages/foundation/modeling/nlp/THEORY.md`.

## Constraints

- Effect v4 against the installed `effect` (validate every API in
  `.repos/effect`, never from priors). Schema first: plain data as branded
  `S.Opaque`, finite cases as `S.TaggedUnion`, named literal domains as
  `LiteralKit`, carriers as `effect/HashMap` and `effect/HashSet`, effectful
  functions as `Effect.fn`, recursive codecs as `S.suspend((): S.Codec<D, E>
  => ...)`. The `.schema.ts` file role stays the default; no `.laws.ts` role
  before a law-test discoverability decision.
- Layering: `foundation/modeling` depends only on `foundation/primitive` and
  `foundation/modeling`; `identity` never imports `rdf`; `provenance`,
  `annotation` and `epistemics` stay rdf-free with codecs in adapter subpaths;
  capability packages import modeling, never the reverse.
- Identity: one digest format (`sha256:<64 hex>`) with one brand per domain
  and a versioned domain tag in every preimage; the public authority is
  `https://beep-effect.com/ns/`; persisted encodings (`cm1:`, `ca1:`,
  `SourceTextIdentity`, `VerifiedTextAnchor` receipts) are frozen and any new
  preimage carries a new version tag beside them.
- Upstream first with a facet census before any local construct, and the
  retirement procedure of `standards/architecture/11-evolution-and-deprecation.md`
  (intent judged per facet on the consumed surface; persisted bytes unchanged
  in a retirement PR; incompatible changes in a separate migration goal with
  old-wire codecs). S31: no exception inventory grows.
- Evidence: `Absent{reason}` is information and never coerces to a number;
  no signal has a default; rankings are named, versioned triage policies
  tested on unknowns and ties that never cross an admission gate; an admission
  requires a non-empty grounding witness that verifies against the current
  text digest at admission time plus a human token bound to actor, action,
  revision and scope.
- Matter walls are authorization at every access path (retrieval, anchor
  resolution, graph query, search, cache, draft assembly, provenance
  traversal), never graph names; identical bytes in two matters never grant
  cross-matter access.
- External vocabularies (OA, PROV-O, NIF, DoCO, SKOS, gUFO, LKIF, ELI) enter
  as registry entries with source pin, license and digest, and as adapters;
  internal kinds stay repo-stable.
- Every structural claim in a README or `THEORY.md` links the law test that
  falsifies it; a law without a named bug is deleted, not kept.
- Delivery: at most three concurrently open PRs for this packet; each phase
  lands through Yeet; a breaking public API or wire change ships with a major
  changeset; `bun run beep quality package-verify <pkg>` before every handoff;
  `bun run beep architecture` for any new slice, concept or role file.

## Open Questions (resolved in P0 through `/grill-with-docs`, one decision file each)

1. Does the repaired handoff land inside `@beep/nlp` first and fold into
   `@beep/annotation` at the census, or is the package opened at once? The
   report recommends the former.
2. Are claim statuses `Assessments<K>` coordinates over a census of the seven
   vocabularies, or does the foundation add nothing beyond the slice's single
   lifecycle? The report recommends the coordinates (the warrant profiles need
   them).
3. Do NIF, DoCO and gUFO enter as adapters with repo-stable internal kinds, or
   as the internal kinds themselves? The report recommends adapters.
4. Is `OccurrenceId` the persisted anchor identity for new law-practice
   records, or a foundation generalization that `cm1:` maps onto while
   `cm1:` stays the persisted form? Either way the persisted `cm1:` bytes do
   not change.
5. Decomposition: does this packet carry all seven implementation phases, or
   does P0 bootstrap child packets per layer that `requires` the capabilities
   this packet provides? Decide by the three-PR rule, not by preference.

## Acceptance Criteria

- [ ] P0: five decision files resolve the open questions; the section 4
      schema sketches compile under `tsrs` as a checked module; the law
      catalogue is triaged into named test targets per package; the
      knowledge-stack chapter and the nine `DECISIONS.md` entries are drafted.
- [ ] L0: `TermBinding` and the term-stability snapshot exist; a test renames
      a module and proves no published IRI changes; the registry expands and
      contracts `prov:`, `oa:`, `nif:`, `xsd:` and `gufo:` CURIEs; one
      canonical JSON implementation; the test-runner's pinned IRIs resolve
      through the binding.
- [ ] L1: `Selector`, `OccurrenceId`, `QuoteKey`, `Resolution`, `Reanchoring`
      and unit conversion are exported from `@beep/provenance` with every L1
      law row green, including repeated-boilerplate, NFKC, de-hyphenation and
      split-surrogate fixtures; the `cm1:` preimage is expressed as an
      `OccurrenceId` preimage with persisted bytes unchanged; `TextAnchor <->
      oa:` round-trips in `@beep/rdf`.
- [ ] L2: `makeAnnotationDocument`, `merge`, `restrict` and containment exist
      with every L2 law row green; the langextract handoff carries both
      digests, scope, extractor and normalization pins, producer, attributes
      and typed `RelationCandidate`/`CorefCandidate` records; no consumer
      re-mints ids from array position; `IrToLaw` reads the handoff; the
      semantica projection carries anchor, quote, receipt and signals or
      declares the loss; the OA/NIF adapter round-trips third-party input.
- [ ] L4: `makeClaimCore`, `Stance`, `Challenge`, `Admission` and
      `Assessments<K>` exist with every L4 law row green; the `1` and `0.9`
      defaults are deleted and guarded by regression tests; the docket
      absent-attachment check returns unknown while urgent tentative entries
      stay visible; the status census report names each of the seven
      vocabularies as coordinate, duplicate or projection; the nanopub adapter
      round-trips.
- [ ] L3 and L6: legal seeds and FOLIO DTOs are out of `@beep/ontology` with
      IRIs and approval metadata preserved; `fold -> Dataset` is the only
      serialization path; `Dataset` equality is a quotient with a canonical
      digest and the semantica gold fixture migrates explicitly; `Literal` has
      three cases; `rdf` no longer imports `md`; `MappingSet` has a coherence
      check; every external namespace in the registry carries license and
      digest.
- [ ] L5 and L7: `Operation` with `withActivity` exists, Kleisli laws hold
      under the declared observation, every run emits a `prov:Activity`; MCP
      tool schemas are the Effect schemas and write tools emit `proposed`
      records only; the office-action flow passes end to end on synthetic
      fixtures; the two-matter adversarial fixture passes.
- [ ] Census: a per-facet consumer census report exists in `research/`; each
      fold or rename is landed through the retirement procedure or declined
      with reasons; no package exists that `bun run beep create-package` did
      not create; S31 inventories are unchanged.
- [ ] Doctrine: the knowledge-stack chapter, the nine rulings, the glossary
      entries and the rewritten `THEORY.md` are merged; the vision document
      no longer states the local-first posture as architecture.
- [ ] Every row of the law catalogue is a passing test naming the row or a
      recorded deletion with its reason.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/text-knowledge-stack-rebuild/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/text-knowledge-stack-rebuild/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/text-knowledge-stack-rebuild` | Passes |
| Packet health | `bun run beep goals doctor` and `bun run beep goals decisions check --slug text-knowledge-stack-rebuild` | No blocking finding for this packet |
| Research projection | `bun run beep goals manifest --check` | No drift |
| Fleet lint | `bun run beep explore --check` and `bun run beep lint roadmap-refs` | Clean |
| Touched packages | `bun run beep quality package-verify @beep/<pkg>` for every edited package | Passes |
| Schema laws | `bun run beep lint schema-first`, `bun run beep lint identity-registry`, `bun run beep lint laws --package @beep/<pkg>` | Passes |
| Law catalogue | package test suites: one property test per catalogue row, named by row | Green, or the row is recorded as deleted |
| Regression guards | tests asserting `Absent{reason}` where `1` and `0.9` were returned | Green |
| Office-action flow | the P6 acceptance test over synthetic fixtures | Green |
| Docs | `bun run docgen:local` | Passes |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at close |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.
- A fold or rename is proposed without a per-facet census, or a retirement PR
  would change persisted bytes: that step stops, the packet does not.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each as a decision file.

## Decision log

Record each decision as its own file under `decisions/` (`bun run beep goals
decisions add text-knowledge-stack-rebuild --title "..." --reversal "..."`); the block below is
generated from that directory and never edited by hand.

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug text-knowledge-stack-rebuild`; add a `kind: decision` file there, never edit this block._

### Program shape: one packet, design first, layers bottom-up, folds by census, 2026-11-08

The operator read the reader audits and critic reviews behind the 2026-11-08 rebuild report and asked for a careful redesign and rewrite of the text-knowledge stack as a goal packet, rather than re-scoping the empty explorations/nlp-annotation-family packet. This packet is that program. Its shape follows the report's section 7 path, reordered against the dependency DAG: a design-and-grill phase that resolves the five open questions in SPEC.md, then the layers bottom-up (L0 identity, L1 text, L2 annotation, L4 claims, L3 and L6, L5 and L7), then a per-facet census that decides every fold and rename. The lossy boundaries (handoff, invented confidence, array-order ids, auditless projection) are repaired before any package is renamed, so the product keeps its evidence intact even if the census declines every fold. One packet per path step was considered and deferred to Open Question 5, decided by the three-PR rule in P0.

Lane `goals/text-knowledge-stack-rebuild`

Reverse: Split any phase into a child packet with goals bootstrap --requires foundation/text-knowledge-stack, or reorder phases by a checkpoint; nothing persisted depends on the order.

<!-- beep:decisions:end -->

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
