# Claim Element Antecedent Check Spec

_Date: 2026-10-14. Graduated from
[`explorations/claim-element-graph`](../../explorations/claim-element-graph/README.md)._

## Objective

A patent claim stops being an opaque `body` string. The practice gets a
span-anchored claim-element tree, a pure deterministic decomposer, and an
advisory §112(b) antecedent-basis and dependency checker, measured on public
USPTO claims. Observably:

1. `@beep/law-practice-domain` exports a `ClaimElementTree` value keyed by
   `claimNumber`, separate from `PatentClaim`. Every element and every term
   carries a char-exact `TextAnchor` into the claim text.
2. A pure decomposer turns normalized `PatentClaim` values into
   `ClaimElementTree`s. A pure antecedent policy turns those trees, read against
   the document's claim dependency graph, into typed `AntecedentFinding`s. Each finding cites the rule that fired and always carries
   the referring-term span. Introducing-term spans appear only for finding kinds
   that have candidates:
   - `missing-antecedent` has none;
   - `ambiguous-antecedent` has two or more;
   - `antecedent-outside-chain` has the non-ancestor introduction;
   - `number-mismatch` has the introduction;
   - `pattern-not-covered` carries the referring span only. A pattern the rules do not cover yields a `pattern-not-covered`
   finding; it never passes silently.
3. A `ClaimSelfCheck` `Context.Service` in `@beep/law-practice-use-cases` runs
   decompose, then check, over a document. It maps findings into epistemic
   `CandidateClaim` + `Evidence`, the way `PatentClaimCandidate` maps whole
   claims today.
4. Public USPTO claims reach `PatentClaim` through one adapter over
   `@beep/uspto` documents. They are labelled into a committed fixture set:
   about 60 element-labelled claim families and about 200 allowed claim sets.
5. A practice MCP **read** tool exposes findings as `claim-finding`
   `ReviewItem`s for the shared review queue. An evaluation report gives the
   strict structural-equality floor and the false-positive rate on allowed
   claims. Findings stay advisory.

The first vertical slice is one public US claim family with a known §112(b)
antecedent rejection. It travels from the USPTO adapter through `PatentClaim`
to a `ClaimElementTree`, the checker emits a `missing-antecedent` finding whose
span matches the examiner's recited phrase, and a strict-equality test compares
the tree to its hand-labelled fixture
([MAP.md](../../explorations/claim-element-graph/MAP.md) §First Vertical Slice).

## Non-Goals

From the brief's no-gos
([BRIEF.md](../../explorations/claim-element-graph/BRIEF.md) §No-Gos):

- No change to `PatentClaim`'s shape. No `shared/*` promotion of element types.
- No LLM decomposition. The driver port may be named; no LLM implementation
  ships.
- No model training or distillation, and no prior-art retrieval or ranking.
- No chemical or Markush handling, no IPRally adapter, no DOCX parsing.
- No blocking gate. Findings stay advisory until the false-positive rate is
  measured.
- No NC-licensed data (PANORAMA, PatClaimEval) in the repo or in any shipped
  artifact.
- No means-plus-function (§112(f)) analysis and no claim construction.
- No new practice MCP write tool. Verdicts travel through the shared review
  queue and the `VerdictRow` log.
- None of the gated `MAP.md` rows: drafting support set, office-action element
  mapping, `Distinction.missing_limitation` element reference, IPRally interop.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills.
3. Governing architecture/package standards.
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

| Surface | Path | Role | HAVE / NET-NEW |
| --- | --- | --- | --- |
| Element value schemas (`ClaimElementTree`, `ClaimElement`, `ClaimTerm`, `ClaimElementEdge`, `AntecedentFinding`) | `packages/law-practice/domain/src/values/ClaimElement/{ClaimElement,ClaimElement.edge,ClaimElement.tree,AntecedentFinding}.model.ts` (+ `index.ts`, barrel export in `values/index.ts`, `./values/ClaimElement` package export) | `.model.ts` | NET-NEW |
| Pure decomposer | `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.behavior.ts` | `.behavior.ts` | NET-NEW |
| Pure antecedent checker | `packages/law-practice/domain/src/values/ClaimElement/Antecedent.policy.ts` | `.policy.ts` | NET-NEW |
| Input claims | `packages/law-practice/domain/src/values/PatentDocument/` (`PatentClaim`, `PatentDocument.normalizer.ts`, `PatentClaimDependencyIssue` pattern) | read-only | HAVE |
| Span primitive | `@beep/provenance` `packages/foundation/modeling/provenance/src/TextAnchor.ts` | reuse | HAVE |
| `ClaimSelfCheck` service | `packages/law-practice/use-cases/src/ClaimSelfCheck/ClaimSelfCheck.service.ts` (+ `.ports.ts`) | `.service.ts` / `.ports.ts` | NET-NEW |
| Candidate mapping | `packages/law-practice/use-cases/src/PatentClaimCandidate/PatentClaimCandidate.ts` | extend or mirror at element granularity | HAVE |
| USPTO claims port | `packages/law-practice/use-cases/src/ClaimSelfCheck/` (port) | `.ports.ts` | NET-NEW |
| USPTO claims adapter | `packages/law-practice/server/src/` over `@beep/uspto` `getDocuments` / `downloadDocument` | server adapter | NET-NEW |
| Practice MCP read tool | `packages/law-practice/use-cases/src/PracticeKg.tools.ts` beside `KgCandidateClaimsTool` | read tool | NET-NEW tool |
| Epistemic targets | `@beep/epistemic-domain` `CandidateClaim`, `Evidence`, `ClaimDisposition` | reuse | HAVE |
| Review envelope | `ReviewItem` / `VerdictRow` (P1) and `VerdictProjector` (P2) from `goals/review-verdict-envelope` | reuse the schema after its P1; the projection after its P2 | sibling goal |
| Labelled fixtures + tests | `packages/law-practice/domain/test/` and `packages/law-practice/use-cases/test/` | tests, public USPTO fixtures | NET-NEW |
| Evaluation report | `goals/claim-element-antecedent-check/history/` | derived metrics only | NET-NEW |

## Constraints

- **Binding order.** P0 schema, then P1 `Context.Service` contract, then P2
  implementation, then P3 review items and evaluation. Helpers are extracted
  only after the schema and contract are fixed.
- **Repo laws.** Effect v4 only, checked against the reference checkout. Every
  module comes from `effect/<Module>`. `LiteralKit` for literal unions
  (`kind`, `determiner`, `producer`). Tagged unions for `ClaimElementEdge` and
  `AntecedentFinding`. `S.Class` schemas with `$I` annotations. No exported
  `interface`/`type` data models. `effect/HashMap` / `effect/HashSet`, never
  native `Map`/`Set`. Generators use `Effect.fn` / `Effect.fnUntraced`. JSDoc
  follows `.patterns/jsdoc-documentation.md`.
- **Placement.** Domain imports only foundation primitives. The USPTO adapter is
  a use-cases port implemented in `@beep/law-practice-server` (ports point
  inward, drivers stay in server; `standards/ARCHITECTURE.md` Core Principle 2).
- **Claim text quality.** Prefer full-text XML for granted patents and published
  applications, and use `<claim-text>` nesting when present. Exclude OCR-only
  claims from the labelled set; do not repair them.
- **Allowed is not antecedent-clean.** Examiners miss antecedent issues. A
  checker hit on an allowed claim counts as a false positive only after
  adjudication on a sample.
- **Determiner edge cases are rules with fixtures.** "a plurality of X" followed
  by "each X" or "the X"; "at least one"; ordinals ("first", "second"); "said"
  vs "the"; generic terms reused with a new meaning. Each is one rule with one
  fixture, not open-ended NLP. Anything unhandled becomes `pattern-not-covered`.
- **Cross-claim scope.** Antecedents resolve only through the dependency chain,
  never sibling claims. A multiple dependent claim has several chains, and each
  must resolve.
- **Read-only practice MCP.** Findings leave through a read tool as
  `claim-finding` `ReviewItem`s. Verdicts are `VerdictRow`s that the
  `review-verdict-envelope` projector maps to `ClaimDisposition`
  (`right` → `active`, `wrong` → `rejected` with the note as reason).
- **Epistemic federation.** Authority is single-owner; projections never write
  centrally. `ClaimLifecycle` is unchanged.
- **Public repo.** Fixtures are public USPTO record only. No client data, no
  attorney or client names, no machine paths. NC data stays in the external
  research library; the repo holds only derived metrics and stable source IDs.
- **Licenses.** FLAN-Graph, IPRally and FiNE-Patents are MIT (port with
  attribution). PEDANTIC is reference-only until a LICENSE file exists. ToC and
  PANORAMA are reference-only.
- **Lawyer-facing text.** Findings read in plain lawyer language and quote the
  claim text.
- **Appetite.** About five agent-days plus at most two attorney hours. If the
  deterministic floor measures badly, stop at the measurement and report it; do
  not expand scope.

## Acceptance Criteria

- [x] **P0 schema.** `values/ClaimElement/` defines `ClaimElementTree`
      (`claimNumber`, `producer` ∈ rule | llm | human, non-empty `elements`,
      `edges`), `ClaimElement` (ordinal `path`, `anchor: TextAnchor`, `kind` ∈
      preamble-subject | limitation | sub-limitation | functional-relation,
      `terms`), `ClaimTerm` (`anchor`, `determiner` ∈ a | an | the | said |
      at-least-one | plurality-of | bare, normalized `head`), the
      `ClaimElementEdge` tagged union (`part-of`, `depends-on-element`,
      `antecedent`, `functional`), and the `AntecedentFinding` tagged union
      (`missing-antecedent`, `ambiguous-antecedent`, `antecedent-outside-chain`,
      `number-mismatch`, `pattern-not-covered`), each case carrying the rule id
      and spans. `PatentClaim` is byte-identical. Schema round-trip tests pass.
- [x] **P1 contract.** `ClaimSelfCheck` is a `Context.Service` with typed
      errors; the decomposer and antecedent-policy signatures and the USPTO
      claims port type-check against P0 schemas, with no implementation bodies.
- [ ] **P2 implementation.** The decomposer and checker are pure and
      deterministic (same input, same output). Each determiner edge case has a
      rule and a fixture. Multiple dependent claims resolve per chain. The USPTO
      adapter yields `PatentClaim`s for XML-sourced claims and excludes OCR-only
      ones.
- [x] **First vertical slice.** The public claim family with a known §112(b)
      antecedent rejection yields a `missing-antecedent` finding whose span
      matches the examiner's recited phrase, and its tree passes strict
      equality against the hand-labelled fixture. The fixture records its
      provenance:
      - the public office action (USPTO document identifier or link);
      - the claim number;
      - the rejection's mail date;
      - the claim text in force at the rejection.
- [ ] **Labelled set.** About 60 independent-claim families (~500 claims) are
      element-labelled by a bounded extractor/critic agent loop with a
      confidence threshold; unresolved items are flagged. About 10% are
      spot-checked by the attorney, and the agreement is recorded. About 200
      allowed claim sets (~3,000 claims) are fetched. Positives are claims that
      drew real §112(b) rejections. Each records the public office action, the
      claim number, the rejection's mail date and the claim text in force at
      the rejection. Negatives are allowed claims. Both are stratified across
      CPC sections, and all are committed as public USPTO fixtures. If
      `@beep/uspto` cannot supply that office-action evidence, a separate
      public office-action source (for example the ODP office-action APIs named
      in `explorations/uspto-patent-driver-depth`) must be bound first. Until
      then the slice and the set do not count as complete.
- [ ] **P3 review items.** A practice MCP read tool returns findings as
      `claim-finding` `ReviewItem`s, in plain lawyer language with the claim
      text quoted. A fixture `ReviewItem` round-trips through the
      `review-verdict-envelope` P1 schema. Once its P2 `VerdictProjector`
      merges, a `claim-finding` `VerdictRow` projects to a `ClaimDisposition`
      projection (`right` → `active`, `wrong` → `rejected`). Until then the
      projection test is recorded as pending in `PLAN.md` Current Blockers.
- [ ] **P3 evaluation.** A report in `history/` gives: strict structural
      equality (one node mapping, typed edges, exact spans) as the primary
      metric, overall and per rule; typed-edge F1 as a diagnostic only; the
      false-positive rate on allowed claims with its interval, after an
      adjudicated sample; and an IPRally training-sample smoke-test result
      labelled non-US and non-gold.
- [ ] No finding blocks a draft or a pipeline; nothing wires the checker into a
      gate.
- [ ] No NC-licensed data file is in the diff; only derived metrics and source
      IDs.
- [ ] No unrelated refactors or formatting churn.
- [ ] A closeout reflection exists under `history/reflections/`.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/claim-element-antecedent-check/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/claim-element-antecedent-check/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/claim-element-antecedent-check` | Passes |
| Packet doctor | `bun run beep goals doctor` | No finding names this packet |
| P0 schema | `cd packages/law-practice/domain && bunx --bun vitest run test/ClaimElement.test.ts` | Round-trip and tagged-union cases pass |
| P2 decomposer + checker | `cd packages/law-practice/domain && bunx --bun vitest run test/ClaimElement.rules.test.ts` | Rule fixtures, vertical slice, strict equality pass |
| P1/P3 service + tool | `cd packages/law-practice/use-cases && bunx --bun vitest run test/ClaimSelfCheck.test.ts` | Service, candidate mapping, `ReviewItem` round-trip pass |
| Domain handoff | `bun run beep quality package-verify @beep/law-practice-domain` | Passes |
| Use-cases handoff | `bun run beep quality package-verify @beep/law-practice-use-cases` | Passes |
| Public native slice | `cd packages/law-practice/server && bunx --bun vitest run test/ClaimSelfCheck.public.test.ts` | Native publication, independently labelled claim-1 tree and exact examiner phrase pass |
| Server handoff | `bun run beep quality package-verify @beep/law-practice-server` | Passes |
| PatentClaim unchanged | `git diff origin/main -- packages/law-practice/domain/src/values/PatentDocument/PatentDocument.model.ts` | Empty |
| Evaluation report | `history/` evaluation file | Strict-equality floor and FP rate present |
| Reflection present | `bun run beep lint reflection-artifacts` | Passes |

## Stop Conditions

- Required source files are missing or materially contradictory.
- Any spend: purchases, paid services, quota top-ups or plan changes need the
  operator.
- The same blocker repeats after reasonable investigation.

Scope growth, destructive side effects and policy calls are not stops: decide
them and record each in the Decision Log.

## Decision Log

Seeded from
[`explorations/claim-element-graph/DECISIONS.md`](../../explorations/claim-element-graph/DECISIONS.md)
(align and shape rulings, 2026-10-14). Rationale and rejected options live
there.

| Date | Decision | Reason | How to reverse |
| --- | --- | --- | --- |
| 2026-10-14 | element-placement: a separate `ClaimElementTree` value in `@beep/law-practice-domain`, keyed by `claimNumber`, with `TextAnchor` spans; `PatentClaim` unchanged; pure `.behavior.ts` / `.policy.ts` role files. | Keeps the completed `patent-document-schema` shape stable; only law-practice consumes elements, so promotion fails its gate. | Promote to `shared/*` when a second slice consumes elements, through the promotion gate. |
| 2026-10-14 | extraction-order: deterministic rules first; an LLM pass later behind a driver port, proposing candidates only. | Failures sit in structure and category assignment; rules are reproducible and free per claim. | Open the gated LLM decomposition row in `MAP.md`. |
| 2026-10-14 | primary-metric: strict structural equality under one node mapping, typed edges, exact spans; IoU only when comparing with IPRally data. | Lenient scoring passed 541 of 566 disagreements in MarkushGlyph; IoU ignores edge type. | Change the report's primary column; fixtures stay valid. |
| 2026-10-14 | first-consumer: a deterministic §112(b) antecedent and dependency self-check on the practice's drafts. | Targets the 55% miss class ACE measured; needs no external data. | Retarget to the drafting support set row in `MAP.md`. |
| 2026-10-14 | nc-licensed-data: PANORAMA and PatClaimEval for internal evaluation only, never in the repo. | Only large expert-validated US per-claim set; license is non-commercial. | Drop NC data from evaluation. |
| 2026-10-14 | markush-scope: deferred; mechanical, electrical and software claims only. | Current practice work does not need it; cost is large. | Open the gated Markush row in `MAP.md`. |
| 2026-10-14 | labelled-set-source: public USPTO claims via `@beep/uspto`, stratified by CPC; positives drew real §112(b) rejections, negatives are allowed claims; fixtures may be committed. | Public record keeps client data out; the driver exists. | Add practice filings later through the corpus pipeline. |
| 2026-10-14 | labelled-set-size: ~60 families (~500 claims) element-labelled; ~200 allowed sets (~3,000 claims) for FP. | ~3,000 negatives pin a ~1% FP rate to about ±0.4%. | Resize the set; fixtures are additive. |
| 2026-10-14 | labeller: bounded extractor/critic agent loop with confidence threshold; attorney spot-checks ~10%. | Follows the 2026-10-06 docket-intake ruling. | Raise the spot-check share. |
| 2026-10-14 | finding-severity: advisory typed diagnostics with span and rule; nothing blocks. | FP rate is unknown until measured; verdicts become the FP data. | A later goal may gate once the FP rate is measured. |
| 2026-10-14 | finding-surface: a new tool in the practice MCP toolkit beside `KgCandidateClaimsTool`, plain lawyer language. | The attorney already works in Claude Code with these tools. | Remove the tool export. |
| 2026-10-14 | verdict-storage: each finding is a `CandidateClaim`; confirm → `ClaimDisposition` `active`, dismiss → `rejected` with reason. | Reuses existing epistemic machinery; no shared-kernel change. | Move verdicts to a dedicated table (not planned). |
| 2026-10-14 | first-slice-inputs: normalized `PatentClaim`; drafts via the existing normalizer; one USPTO adapter. | Decomposer stays format-independent; DOCX belongs to `docx-roundtrip-interop`. | Add another adapter. |
| 2026-10-14 | iprally-interop: no adapter; their training sample is a non-US smoke test only. | Their JSON drops edge types; labels are teacher output, not gold. | Open the gated IPRally row in `MAP.md`. |
| 2026-10-14 | shape-review: findings leave as `claim-finding` `ReviewItem`s, judged in the `practice-claude-mod` review queue; verdicts are `VerdictRow`s projected to `ClaimDisposition`. | Keeps the practice MCP read-only; one review surface for all producers. | Revisit in `attorney-review-workspace`. |
| 2026-10-14 | graduation-shape: one goal, P0 schema, P1 contract, P2 implementation + adapter, P3 review items + evaluation. | P0 schema churn would break a parallel evaluation goal. | Split P3 into its own goal. |
| 2026-10-14 | Packet: the USPTO claims adapter is a use-cases port implemented in `@beep/law-practice-server`, which already depends on `@beep/uspto`. | `standards/ARCHITECTURE.md` Core Principle 2 (ports point inward): drivers stay in server. | Move the port if a driver-free source appears. |
| 2026-10-14 | Every `AntecedentFinding` carries the referring-term span. Introducing-term spans are present only for kinds with candidates; `missing-antecedent` and `pattern-not-covered` have none. | A missing antecedent has no introduction to point at; requiring one made the finding unrepresentable (PR #1712 review). | Require both spans and drop `missing-antecedent` (not recommended). |
| 2026-10-14 | Positive fixtures record office-action provenance: the public office action, claim number, rejection mail date, and the claim text in force at the rejection. If `@beep/uspto` cannot supply it, a separate public office-action source is bound first. | A positive is only evidence if it traces to the rejection it claims (PR #1712 review). | Accept positives without provenance as weak labels only. |
| 2026-10-14 | `ClaimElementPath` starts with the claim number (`1`, `1.b`, `1.b.ii`), giving one document-wide address. | No separate `claimNumber` field that could disagree with the path; cross-claim edges stay simple. | Add an explicit `claimNumber` and make paths claim-relative. |
| 2026-10-14 | The four chain-resolved finding kinds carry `chain`: the claim numbers from the referring claim to its root, strictly decreasing and starting at the referring claim. | Each chain of a multiple dependent claim must resolve on its own; without `chain`, two findings for the same term on different chains look identical. | Drop `chain`. |
| 2026-10-14 | The `functional` edge carries `element`, the functional-relation element it is read from. Its connecting-text parts carry a `TextAnchor`, not free text. | Links the relation to an element, and keeps every span char-exact for strict equality. | Drop `element` and use free text parts. |
| 2026-10-14 | Rule ids are a branded kebab-case string, not a closed `LiteralKit`. | P2 adds one rule per determiner fixture, and findings from retired or renamed rules must still decode as review evidence. | Use a `LiteralKit` of rule ids. |
| 2026-10-14 | The schema is split into four files: `ClaimElement.model.ts`, `ClaimElement.edge.model.ts`, `ClaimElement.tree.model.ts`, `AntecedentFinding.model.ts`. `ClaimElementTree` checks coherence: every in-claim endpoint and term reference names a real element or term; part-of nests under its parent; depends-on points to an earlier claim; antecedents introduce in this claim or an earlier one; terms lie inside their element. | Avoids a circular import between the edge and element files and follows the `MailTagging.*.model.ts` pattern. Coherence is what strict structural equality relies on. | Merge the files and relax the checks. |
| 2026-10-14 | P1: `AntecedentPolicy` takes `(trees, claims: PatentClaims)`, not trees alone. | Chain resolution needs each claim's dependency references; the trees carry no dependency edges, and re-deriving them from paths would duplicate `PatentClaim`. | Add `depends-on-claim` edges to `ClaimElementTree` and drop the `claims` argument. |
| 2026-10-14 | P1: `ClaimElementDecomposer` takes `(claim, claims)`: the claim plus the whole set as context. | Cross-claim terms ("the sensor of claim 1") must anchor against earlier claims while the decomposer stays pure and per-claim. | Pass only the ancestor chain, or decompose the whole set in one call. |
| 2026-10-14 | P1: the decomposer and the policy are exported function types in `.behavior.ts` and `.policy.ts`, not `Context.Service`s or stub bodies; `ClaimSelfCheck` is the one service. | They are pure functions over values; P2 supplies the implementations and the service Layer binds them. A stub body would be a silent pass. | Wrap them in services if a second implementation (the gated LLM pass) needs swapping. |
| 2026-10-14 | P1: errors split into `UsptoClaimsError` (port failure) and `ClaimSelfCheckError` (action failure, closed reason `LiteralKit`); `cause` is kept for diagnostics only and is never matched on. | Callers branch on the reason, not on driver internals; the port's failure stays server-side. | Merge them into one error with a widened reason set. |
| 2026-10-14 | P1: the port DTOs (`UsptoClaimSource`, `UsptoClaimSet`), the action input and report, and `ClaimFindingCandidate` live in `ClaimSelfCheck.schemas.ts`. | Follows the package's `DocketIntake` and `DocumentIdentification` precedent; the review noted that `CandorPolicy` and others use `.values.ts`, so the package has no single convention. | Move the input and report to `.queries.ts` and the port DTOs beside the port in `.ports.ts`. |
| 2026-10-14 | P1: the `UsptoClaims` port speaks domain identifiers only (`UsptoNormalizedApplicationNumber`, `PatentNumber`, `PatentClaims`); `@beep/law-practice-use-cases` gains no `@beep/uspto` dependency. | Ports point inward; the server adapter maps `@beep/uspto` records. | Add the dependency if a second use case needs raw USPTO records. |
| 2026-10-14 | P1: `ClaimSelfCheckReport` lists per-claim failures in `undecomposed`; `decomposition-failed` fails the call only when no claim decomposes. The policy reports a chain through an undecomposed claim, or a tree whose claim is not in the set, as `pattern-not-covered`. | One unsegmentable claim must not discard its siblings' findings or bias the FP measurement; nothing passes silently. | Return all-or-nothing and fail on the first undecomposed claim. |
| 2026-10-14 | P1: `checkPublished` returns `PublishedClaimSelfCheckReport` (`claimSet` + `report`). | Fixtures and eval rows must record the public document and the claim text in force; the claim set carries `documentIdentifier`. | Remove `checkPublished`; callers compose `UsptoClaims.claims` and `check`. |
| 2026-10-14 | P1: `./ClaimSelfCheck` is a concept subpath export, like the package's 11 sibling concepts; the port is also on `/server`. | The architecture standard allows concept subpaths during migration; this keeps one convention in the package. | Drop the subpath, re-run tsconfig-sync, and point the JSDoc examples at `/server`. |
| 2026-10-14 | P0–P1 (schema and contract) ship as their own PR before P2; P2–P3 and the closeout follow in a second PR. | The contract is final and reviewable alone, while P2's labelled set takes hours of agent and attorney time. Landing it early settles the shared domain barrel and generated files with `review-verdict-envelope` (#1761). | Hold the contract PR and fold it into the P2 PR. |
| 2026-10-14 | P2 splits into P2a (pure decomposer + policy + synthetic rule fixtures), P2b (Layer, USPTO adapter, vertical slice) and P2c (labelled set); the rules are fixed in `research/P2-DESIGN.md`. | P2a needs no data access and can run as a bounded lane; P2b and P2c need the USPTO API and the agent labelling loop. | Merge the lanes back into one P2 change. |
| 2026-10-14 | P2 antecedent matching is exact on the normalized head, then a single-word number variant (`number-mismatch`), then ordinal or one-modifier variants (`ambiguous-antecedent` when two or more), then outside the chain, else `missing-antecedent`. | Deterministic and explainable per rule; the labelled set measures the FP rate of each rule separately. | Replace a rule once its measured FP rate is too high; findings keep their rule id. |
| 2026-10-14 | P2 decomposer emits `part-of` for every non-root element, `depends-on-element` root-to-root per claim reference, and `antecedent` edges only inside one claim; no `functional-relation` elements or `functional` edges in P2. | Keeps trees complete for structure and lets the policy own cross-claim resolution; functional relations need a parser the rules do not have. | Emit cross-claim `antecedent` edges from a shared resolver; add functional relations in a later goal. |
| 2026-10-14 | P2 skips the idioms `the same`, `the like`, `the art`, `the other`, `the following` and `the case` as non-referential, and a limitation ending in `:` absorbs the remaining body segments as sub-limitations (`colon-sublist`). | These are the most common non-referential uses and nested-list shapes in US claims; flat claim text carries no other nesting signal. | Drop an idiom from the list, or read nesting from the source XML in the adapter. |
| 2026-10-14 | P2 ships in two PRs: P2a + P2b on synthetic and recorded fixtures now; P2c (labelled set) and the live vertical slice after the USPTO ODP key is regenerated. | The key returns 403 and only the operator can regenerate it; the rules and the Layer do not need data. | Hold P2a/P2b until the key works. |
| 2026-10-14 | `UsptoClaimsLive` fails the `publication` source as `unavailable` (ppubs or bulk XML is the follow-up) and reads `application` claims only from a `CLM` XML download. | The P1 error set has no `unsupported` reason; OCR-only claims are never repaired. | Add a ppubs or bulk-XML reader for publications. |
| 2026-10-14 | `ClaimSelfCheck.candidates` returns `ClaimSelfCheckCandidates { candidates, undecomposed }` instead of a bare candidate list (review of #1802). | Dropping `undecomposed` made an undecomposable claim look clean, a silent pass the policy forbids. No candidates means a clean document only when `undecomposed` is empty too. | Raise each undecomposed claim as a review candidate with its own finding kind. |
| 2026-10-28 | Preserve all USPTO download options and their format labels in an optional `downloadOptions` field; retain the first `downloadUrl` for existing callers. The claims adapter selects explicitly labelled XML and rejects PDF-only documents before download. | Removes the recorded P2b driver blocker without changing `PatentClaim` or silently reading OCR. The source key still returns 403. | Remove the optional field and revert the adapter selection together; existing first-URL callers remain compatible. |
| 2026-10-28 | Bind ODP office-action text retrieval (`oa_actions/v1/records`) as the separate positive-provenance source; use native individual `APPXML-SPLT` / `PTGRXML-SPLT` links from application metadata for publication claims. | Live file-wrapper XML is TAR-wrapped, namespaced and OCR-derived in the sampled records. Native publication XML is directly available without OCR or weekly bulk downloads. Publication text must still be bound to the version in force at rejection. | Remove the optional native-document metadata fields and publication adapter branch; retained public source IDs remain auditable. |
| 2026-10-28 | Follow only bounded HTTPS redirects to `data-documents.uspto.gov` or `data.uspto.gov` for downloads, rebuilding requests and stripping the API key outside the configured API host. | Live ODP file-wrapper and native-publication downloads redirect to these document hosts. Default fetch follows redirects and can propagate custom headers; explicit handling preserves the credential boundary. | Remove redirect support and fail downloads on redirect status. |
| 2026-10-28 | Preserve `its` / `their` phrases as `bare` terms and emit `pattern-not-covered` under `unsupported-determiner`; do not resolve possessives. | The first real office action criticizes `its forward part`, which the determiner-only scan silently omitted. Explicit abstention satisfies the coverage invariant without adding pronoun inference. | Remove these two scan surfaces and the bare-term abstention after a measured replacement rule is approved. |
| 2026-10-28 | Freeze 200 native allowed-claim sets (3,184 claims) before predictions, using CPC A/B/E/F/G/H quotas 30/25/10/20/55/60 and stable SHA-256 ordering within strata. Exclude non-utility identifiers, missing strata, primary chemical/biological classes and explicit chemical/Markush claim patterns before checking. | Keeps selection independent of checker success. The report will describe this stratified public benchmark, not estimate all-USPTO prevalence. All selected normalization/decomposition failures stay in the results. | Re-sample only with a recorded new sample version and rerun the whole benchmark; retain this frozen sample and its hashes. |
| 2026-10-28 | Strip a leading printed claim number followed by either a period or colon in the USPTO adapter and reference text canonicalization. | Independent corpus extraction found native publication claim text numbered `1:`. Removing this numbering preserves source wording and aligns anchors; it does not invent an unsupported legal transition. The frozen source sample stays unchanged. | Revert the prefix pattern and re-anchor affected reference labels; preserve both coverage snapshots. |
| 2026-10-28 | Semantic references follow source grammar and the P0 schema independently of P2 parser heuristics. Preserve 14 earlier family drafts as auxiliary conformance evidence; unsupported input transitions do not by themselves make gold unresolved. | Independent review found that five-token/stop-word cuts were being copied into reference answers, invalidating recovery-floor measurement. P2 implementation remains fixed; real omissions must lower measured recovery. | Retain a separately named conformance benchmark; never substitute it for the independent semantic evaluation. |
| 2026-10-28 | Positive sample slots are source proposals until numbered rejection and in-force native wording qualify. Replace failed sources within their CPC stratum by stable source-only ranking, preserve every exclusion/old fixture and never inspect predictions for selection. | The first inventory/date-only proposal contained conflicting versions, merged claim numbers and formula loss. Retaining them as accepted positives would violate provenance; metadata success does not imply source fidelity. | Restore the prior source proposal as explicitly unqualified; retain replacement/audit receipts and rerun the benchmark if sample membership changes after predictions. |
| 2026-10-28 | Clarify semantic gold granularity: retain determiner-bearing abstract NPs; relative/reciprocal linking language remains anchored functional text when participants are explicit, while substantive bare/possessive entity mentions remain terms. Audit prior references for consistency and preserve review receipts. | Independent schema/protocol review found no universal compulsory pronoun-node rule. A fixed source-grounded convention avoids scoring arbitrary representational variation without copying parser heuristics. | Revise the declared convention, re-audit all affected references and rerun the whole semantic benchmark; preserve prior gold and comparison results. |
| 2026-10-28 | Clarify gold lexical heads: omit outer grammatical/pronominal determiners even when encoded as bare; retain lexical genitives and meaningful counts/selectors not represented by a supported determiner tag. Source anchors remain complete. | P0 explicitly says head noun phrase without its determiner; bare is an encoding accommodation, not a whole-quote rule. Independent review distinguishes lexical ownership/count information from grammatical openings without consulting production behavior. | Revise the declared convention, preserve prior receipts, audit affected heads and rerun the semantic benchmark. |
| 2026-10-28 | Preserve byte-exact positive reference fixtures and retained labelling/source-exclusion receipts through the existing hashed-qualification-evidence formatter override. JSON parsing, lint and schema/source-span tests stay enabled. | Critic receipts and the prepared attorney packet bind exact file SHA-256 values; cosmetic rewriting would break the review chain without changing semantic content. A read-only formatter check found 207 differences after new receipts were added. | Remove the narrow path entries only after retaining old reviewed bytes and explicitly versioning/rebinding every affected receipt and attorney packet; do not silently rewrite accepted history. |
| 2026-10-28 | Continue independent P3 implementation and evaluation preparation while actual attorney adjudication remains pending; P2 acceptance and final completion remain unproven until the mandated human evidence arrives. | Root AGENTS.md Autonomy outranks packet prose and explicitly requires asynchronous operator review without blocking progress. The merged review-verdict schemas and verified P2 implementation permit the read-only tool and evaluation machinery to proceed; no human verdict or final metric is fabricated. | Restore serial execution after all human verdicts arrive; retain pre-adjudication references, original agreement and versioned evaluation inputs. |
| 2026-10-28 | Exclude verbatim USPTO claim fixtures and their source-anchored reference receipts from spelling correction, using the existing typos policy for source-faithful corpora. Authored code and documentation remain checked. | The pre-commit spelling checker rejected native words such as incudes and determinated; correcting them would change public claim wording, source digests and exact spans. The existing Semantica gold-corpus rule establishes the same boundary. | Remove these narrow fixture paths only when spelling tools can distinguish source quotations from authored prose without changing the evidence. |
| 2026-10-28 | Add a closed-world, read-only `claim_self_check` tool to the practice toolkit. It accepts normalized document/provenance, returns claim-finding review items plus candidate/evidence envelopes and undecomposed claims, and performs no source fetch or persistence. Box source references are emitted only for an actual supplied file identifier. | Reuses the P1 service and ReviewItem/VerdictProjector contracts while preserving unchecked coverage and exact source quotations. A locally composed unavailable public-source port keeps the existing credential-free KG host independent of USPTO access. | Remove the tool from the toolkit and its handler; existing self-check and public-fetch service APIs remain unchanged. |
| 2026-10-28 | Derive review-item identities from each candidate's digest-scoped public identifier, while retaining the candidate row id in claimId. | Reused entity seeds can assign equal spike row ids to different documents. Stable public identifiers prevent review items from colliding across those documents; the new test proves the distinction. | Adopt a later persisted review-id allocator with a recorded migration and preserve existing verdict keys. |
| 2026-10-28 | Configure MCP JSON-schema reference allocation to keep scalar, union and template fragments inline while retaining structured/recursive references. | The installed upstream converter fails with Invalid TemplateLiteral part Reference on annotated domain identifier fragments. Its documented referencePolicy hook fixes metadata generation without weakening codecs or changing domain models. The targeted template-input/output regression and actual claim tool dispatch pass. | Remove the policy when the upstream pattern compiler resolves named fragment references; retain regression coverage. |
| 2026-10-28 | Declare strict-source-map/v1 structural scoring before positive predictions: one family-wide exact claim/kind/span node alignment, exact ordered terms and typed directed edge multiset; ignore producer and ordinal spelling, preserve functional-part order. Abort measurement on duplicate source identities or missing reference endpoints. | All frozen reference identities are unique and family-closed, so source anchors force one mapping without per-edge choices. Synthetic tests reject changed spans, heads, donor claims and functional order; edge F1 remains diagnostic. Every selected failure stays in the 538-claim denominator. | Implement and validate general graph isomorphism if actual predictions violate the declared uniqueness precondition; retain this protocol, reference baseline and previous results rather than dropping cases. |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |

| 2026-10-28 | Invoke the explicit poor-floor stop after the first frozen positive replay: 0/538 exact structures, including 186 input failures and eight undecomposed; preserve all labels, rules and denominators. | The normative Appetite requires stopping at a poor measurement rather than tuning or expanding scope. All 538 reference self-comparisons pass, so zero recovery is not an always-false scorer. Actual human agreement remains pending and no full-goal completion is claimed. | A subsequent authorized direction can propose a new design with a fresh held-out evaluation; retain this first result and original freezes. |

| 2026-10-28 | At the user's explicit request, repair decomposition/normalization gaps and rerun the same immutable 538 references. Retain original 0/538, intermediate runs, source hashes and unchanged strict scoring. | The user superseded the earlier stop for this bounded repair. Functional source parts, full phrases, conservative ancestor links and canonical transition aliases improve coverage; final strict recovery remains 0/538. This is development-set measurement after feedback, with human acceptance still absent. PatentClaim shape is unchanged. | Restore implementation commit 8ee7429e2f and the original runner/freeze. Keep all measurements and labels intact. |

| 2026-10-28 | At the user's further request, inspect nearest exact mismatches and repair recurring source structures without changing labels, prior results or the scorer. Preserve a 10/538 checkpoint and an 11/538 final run. | Explicit aliases, coordinated clauses and source-located dependencies explain the prior zero; owner-node span mismatches can invalidate otherwise identical-looking edges. Preserve unresolved dependency/element-kind convention questions rather than add patent-specific exceptions. Ten new regressions and all package verifications pass. | Restore source commit 66d2e73a56, or the intermediate checkpoint 11e26d0acb. Keep all measurements and reference versions. |

| 2026-10-28 | Continue the user-requested closest-match repair with source grammar for defining transitions, wrappers, action/modifier context, material descriptions and coordinated names. Preserve the 19-match trial and final 21/538 result with all former labels/results. | Ten synthetic regressions and cardinality/context counterexamples distinguish recurring grammar errors from unresolved dependency conventions. All previous 11 complete matches are retained. Legal warnings remain separate from structural mention identity. | Restore c057a15cd2 for the 11-match baseline or 007427078c for the intermediate trial. Keep every result and annotation version. |

| 2026-10-28 | Keep the 21-claim passing set as an explicit paired retention gate while repairing inherited-subject, designated-name and grammatical-role gaps. Retain a regressing 25-match trial and the final 29/538 run. | The user explicitly required pass retention and immutable references/results. Body-only canonicalization restores four root-link regressions; eight gains remain. Edge F1 slightly declines, so report the tradeoff without changing scoring or claiming universal improvement. Eight source regressions and package verification pass. | Restore 474f9c436d for the 21-match baseline or 828e34b258 for the trial, retaining every measurement and label. |

| 2026-10-31 | Continue the explicitly requested worktree repair with all 29 baseline passing claims retained. Repair contextual purpose participles, embedding predicates and response idioms; preserve measured v11 checkpoint and formatter-clean v12 (31/538). | Same 538 frozen labels and unchanged scorer; two new strict matches, zero losses. All previous measurements remain intact. Synthetic nominal controls prevent treating every used/response occurrence as a predicate/connector. Human acceptance and full-goal gates remain open. | Restore eec7f5f2d1 for the 29-match implementation, retaining every result, label and source freeze. |

| 2026-10-31 | Add a version-bound replay of the unchanged 200 allowed sets and declare a random 30-claim adjudication sample before that replay. Keep all missing outcomes and blank attorney judgments. | P3 requires adjudicated false-positive evidence, not raw finding counts. Current replay checks 188 sets/2,951 claims; two selected review claims remain input failures. The claim-level erroneous-alert estimand, pending bounds and conditional interval plan avoid resolved-only denominators. This shares the existing two-hour attorney budget and does not create extra human time. | Retain current source/sample/results/packets; remove the new runner or supersede review with an explicitly versioned implementation, sample and receipt. Never rewrite old labels or verdicts. |

| 2026-10-31 | Canonicalize a source comma as the existing wherein transition only as a fallback for an explicit numbered dependent reference followed by supported predication; preserve complete source text and PatentClaim shape. Version current implementation/replay/review as v13/v2 with all 31 passes and prior artifacts retained. | Eight allowed sets/157 claims become readable, including both previously failed review claims. All 188 earlier successful allowed reports and all positive per-claim scores are unchanged. This removes an input obstacle to adjudication without fabricating human outcomes or changing the random sample. | Restore runtime source at 8cfcf0eb6e; keep v12/v13 measurements and both review packets. Any revised convention requires another explicit source/review version. |

| 2026-10-31 | Require explicit actual-attorney task-submission confirmation before allowed-answer summaries emit adjudicated rates/intervals; otherwise authority is unconfirmed and metrics remain null. Enforce sample/question ownership and denominator integrity. | The operator reports attorney review unavailable. A version-bound answer file alone does not authenticate human review. Keep the immutable existing interface usable and require a separate anonymous authority assertion only after genuine submission; reject preview/synthetic/non-attorney promotion. | Restore the analysis tools at 56a68c4455 if replaced by a stronger provenance mechanism; retain all old packets, measurements and this authority distinction. |

| 2026-10-31 | Check in read-only validators for the original reference spot-check and addendum instead of relying on ignored scratch scripts. Preserve all packet/source hashes and the 50-claim denominator; separate actual submission authority from file validation. | The required human evidence must remain importable in a fresh checkout. Partial/uncertain results cannot become agreement or vanish from the denominator, and convention decisions cannot change it. The operator reports attorney review unavailable, so actual acceptance remains unfulfilled. | Restore the earlier scratch validators from retained history if a replacement is needed; retain every original packet/export/result and this authority boundary. |
