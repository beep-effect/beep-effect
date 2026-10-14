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
   `ClaimElementTree`s. A pure antecedent policy turns those trees into typed
   `AntecedentFinding`s. Each finding cites the rule that fired and always carries
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
| Element value schemas (`ClaimElementTree`, `ClaimElement`, `ClaimTerm`, `ClaimElementEdge`, `AntecedentFinding`) | `packages/law-practice/domain/src/values/ClaimElement/ClaimElement.model.ts` (+ `index.ts`, barrel export in `values/index.ts`) | `.model.ts` | NET-NEW |
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

- [ ] **P0 schema.** `values/ClaimElement/` defines `ClaimElementTree`
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
- [ ] **P1 contract.** `ClaimSelfCheck` is a `Context.Service` with typed
      errors; the decomposer and antecedent-policy signatures and the USPTO
      claims port type-check against P0 schemas, with no implementation bodies.
- [ ] **P2 implementation.** The decomposer and checker are pure and
      deterministic (same input, same output). Each determiner edge case has a
      rule and a fixture. Multiple dependent claims resolve per chain. The USPTO
      adapter yields `PatentClaim`s for XML-sourced claims and excludes OCR-only
      ones.
- [ ] **First vertical slice.** The public claim family with a known §112(b)
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
| P2 decomposer + checker | `cd packages/law-practice/domain && bunx --bun vitest run test/ClaimElement.behavior.test.ts test/Antecedent.policy.test.ts` | Rule fixtures, vertical slice, strict equality pass |
| P1/P3 service + tool | `cd packages/law-practice/use-cases && bunx --bun vitest run test/ClaimSelfCheck.test.ts` | Service, candidate mapping, `ReviewItem` round-trip pass |
| Domain handoff | `bun run beep quality package-verify @beep/law-practice-domain` | Passes |
| Use-cases handoff | `bun run beep quality package-verify @beep/law-practice-use-cases` | Passes |
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

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
