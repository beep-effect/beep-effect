# OA Evidence Consumer Conformance

## Status and source hierarchy

Admitted ready on 2026-10-06; lifecycle **paused**, implementation not started.
This fixture-only child belongs to `goals/agentic-professional-runtime`; it does
not replace that initiative or discharge its installed-KG/P8 handoff dependency.
Resume after the owning runtime session records the P0 consumer mapping and
fixture scope. This is a named execution checkpoint, not claimed owner consent.

Order: AGENTS.md and required skills; architecture/doctrine; this SPEC; PLAN;
GOAL; supporting research. Provenance:
[research-corpus-synthesis](../../explorations/research-corpus-synthesis/README.md),
[independent admission](../../explorations/research-corpus-synthesis/research/ADMISSION-REVIEW.md).

## Outcome and value

Prove at the existing office-action candidate consumer that three independent decisions remain distinct: the cited text exists in the identified source version; that text supports the stated proposition; and a current authorized human decision permits promotion. Deliver a deterministic public fixture suite and the smallest composed consumer boundary that prevents an exact but irrelevant quote from acquiring authority. A verified quote is valuable evidence of source correspondence, but cannot establish proposition support or attorney judgment by itself.

The concrete current seam is `makeOfficeActionReview(...).review` in `packages/law-practice/use-cases/src/OfficeActionReview/OfficeActionReview.service.ts:260-282`. It extracts a candidate/evidence pair, calls `deps.gate.evaluate(candidate,[evidence])`, advances the lifecycle, and folds a projection. Its comment says a well-formed span admits it. The proposed change must exercise this actual consumer route rather than create a disconnected verification demo. Preserve any intentionally structural `shape_valid` stage: it may record existence without being renamed or presented as semantic/human acceptance.

## Existing capability inventory

Fresh source inspection at worktree HEAD `2208622aa8d0a5765769e3950c44ec9e81be9ceb` informs this draft; admission must recheck the selected execution head.

| Existing capability | Concrete reuse | Boundary |
| --- | --- | --- |
| `goals/citation-verified-span-substrate`, completed-retained; `VerifiedSpan.behavior.ts` | Exact raw-slice location, source/matter scope, supported normalization and reconstruction; persisted attempts and re-anchor history | No fuzzy correspondence; no proposition-support decision |
| `goals/patent-citation-candor-gate` and successor closeout, completed-retained; `CandorPolicy.service.ts` | Re-resolve source and anchor; current observation/digest, unambiguous lineage, active User-authored Rule56 disposition | No computed legal judgment; current contract/fixture proof does not establish production protection |
| Existing OfficeActionReview and injected file-processing/LangExtract/IrToLaw/gate/transition | Consumer integration and reproducible extraction fixture seam | Existing structural projection is not evidence of semantic support or filing eligibility |
| Existing `ClaimEvidenceReview` service/behavior | Portable retained human evidence review and current/stale basis classification; inspect and reuse before adding any new support receipt shape | A current review still needs an explicitly scoped proposition and exact evidence basis |

The sole potentially new behavior is the consumer conformance composition and its narrowly scoped support decision contract if existing review contracts cannot express it. Search live schemas and barrels first. Do not introduce a parallel VerifiedSpan, candor evaluator, source resolver, or generic legal-reasoning engine.

## First vertical slice

Use one small, redistributable public patent/OA reference set with committed provenance, license/public-record status, and immutable bytes, plus clearly labeled synthetic candidate propositions. Prefer the existing public/synthetic fixture mechanism; exclude private client records and workstation batch inputs. Build an in-process deterministic consumer fixture with injected extraction output. Each test invokes the composed OfficeActionReview consumer and records the same three results and final projection/authority state.

1. Existence: source identity, version/digest, matter scope, locator and exact quote verify through the existing span/source contracts. A positive result means only correspondence.
2. Support: a separate explicit evidence-review decision binds the candidate proposition to its exact basis. The first slice uses independently authored fixture expectations and recorded reviewer decisions, not model confidence or substring presence as a semantic oracle. An authentic quote about feature A does not support an assertion about feature B. Absent, ambiguous or stale support leaves a candidate unpromoted.
3. Human promotion: invoke the existing shared candidate-acceptance/candor boundary for every current citation event. Require the appropriate current authorized human record, including Rule56 disposition where the patent citation contract requires it. Passing support does not mint that judgment.

## Acceptance matrix

| Public fixture case | Required observed consumer outcome |
| --- | --- |
| Correct exact span, supported proposition, current human evidence review and all applicable candor dispositions | Explicit support and human gates pass; only the permitted consumer authority transition occurs |
| Fabricated locator/quote or wrong source/version | Existence fails with typed receipt; no authoritative promotion |
| Quote occurs twice with unresolved location | Ambiguity is retained; no inferred first-match admission |
| Exact quote is true but unrelated to proposed proposition | Existence passes; support fails/pends; no authoritative promotion |
| Supported proposition but no human record or non-User judgment | Human gate fails; no authoritative promotion |
| Source digest, proposition, current citation observation or disposition changes after review | Prior review becomes stale; retry retains correction/history and requires fresh applicable authority |
| Valid quotation from another matter | Scope fails; no promotion or cross-matter evidence substitution |
| One undisposed event among multiple current citation events | Quantified candor gate blocks; no subset-based success |

Tests must assert consumer outputs and invocation boundaries, including that a downstream promotion is not reached after a failed prerequisite. Retain distinct receipts rather than collapse failures into a single `verified` boolean. Keep a positive public fixture alongside every negative family to detect a permanently blocked implementation.

## Scope, dependencies and appetite

Hard dependency: coordinate consumer ownership and lifecycle meaning with active `goals/agentic-professional-runtime`; inherit its source hierarchy, law-only scope and privilege boundary. This proposal is a narrow consumer conformance goal, not a replacement runtime initiative. Completed span/candor packets are reuse prerequisites and evidence, not active blockers to reopen.

Conditional dependency: `goals/practice-kg-mcp` P8 is required only if the selected slice claims installed matter lookup, production KG-backed source resolution, or runbook handoff acceptance. P8 is currently in-progress. The deterministic public in-process first slice requires no installed KG/matter lookup and must not wait for P8 or claim its acceptance. P6/P7 are completed capabilities, not new implementation tasks.

Effort bound: three implementation days plus one bounded independent review/verification wave. Day1 fixes the exact consumer/authority mapping and fixture basis; Day2 composes existing checks and negative/positive cases; Day3 completes package proof and reviewer receipts. If semantic support cannot fit existing review primitives within this bound, retain candidates as pending and narrow the goal to consumer conformance; do not add automated entailment or expand to production deployment. P3 hosted proof/merge and P4 reflection closeout use the standard goal template rather than being omitted from the calendar estimate.

Allowed surfaces: OfficeActionReview consumer/composition and focused tests in `@beep/law-practice-use-cases`, existing acceptance/review adapters only where composition requires them, public fixture provenance, and future goal packet evidence. Any shared schema change requires schema-first and compatibility review. Required proof: meaningful focused consumer tests, touched-package `beep quality package-verify`, applicable architecture/schema/docs checks, independent admission and execution review, then canonical Yeet hosted readiness and retained closeout reflection.

## No-gos and interpretation limits

No actual USPTO filing, legal advice, automated Rule56/materiality judgment, production candidate-acceptance claim, client/private evidence, paid API, live provider requirement, broad OA section101/103/112 expansion, KG migration, ontology replacement, law-practice service rewrite, or resetting completed packets. Report secondary case/news motivations as motivations; an unread order or paywalled excerpt cannot support a legal holding. A fixture verifies the composed behavior for its stated cases, not lawyer accuracy or production safety.


## Required admission refinements

- Preserve OfficeActionReview's structural `shape_valid` transition. A structurally
  valid candidate may exist without semantic or human acceptance. The fixture must
  show that downstream authoritative acceptance is withheld independently.
- P0 names the actual shared acceptance invocation and adapter exercised. Include
  the existing `CandorPromotionGate` server composition test if required; do not
  invent or claim a production composition root. If the existing route cannot be
  composed within the appetite, keep candidates pending and narrow the proof.
- `ClaimEvidenceReview` is portable human evidence review, not an authorization
  token. A fixture User principal is not authentication proof. Semantic support,
  review currency, applicable Rule56 disposition and invocation authority remain
  distinct. No model confidence or substring match creates any of them.
- Select one bounded public/synthetic source set in P0, retain original bytes and
  provenance, and obtain independent expected support decisions. An unread legal
  order, generated summary or incomplete article is not fixture legal authority.
- Completed span, candor and authority packets remain completed-retained.
  Substrate contract changes require a specific demonstrated consumer gap and
  schema-first/compatibility review within the fixed appetite.

## Decision log

| Decision | Reason | Reversal |
| --- | --- | --- |
| D1: fixture-only child, ready/paused | Independent review found a concrete consumer composition seam; runtime owner retains execution authority. | Park or fold into the runtime with explicit provenance; do not erase evidence. |
| D2: three distinct outcomes | Existing correspondence and candor primitives do not prove proposition support or production authority. | Change only after a reviewed consumer contract demonstrates equivalent distinctions. |
| D3: P8 conditional | In-process synthetic fixture does not use installed KG; product handoff still does. | Add the dependency before any installed lookup or production claim. |

## Completion and evidence

All eight positive/negative families must exercise the named consumer seam and
publish distinct outcomes. Required touched-package checks, independent review,
Yeet hosted readiness, merge and a same-PR retained reflection are completion
gates. Current evidence is admission only; no test, runtime improvement, legal
accuracy or production protection is claimed. Newly graduated implementation is
outside the corpus-synthesis task.
