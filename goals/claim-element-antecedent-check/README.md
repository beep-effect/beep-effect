# Claim Element Antecedent Check

## Status

Lifecycle: `active`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Give every patent claim a span-anchored element tree and run an advisory
§112(b) antecedent-basis and dependency self-check over it. The tree, the pure
decomposer and the checker live in `@beep/law-practice-domain`; the
`ClaimSelfCheck` service lives in `@beep/law-practice-use-cases`. Findings
reach the attorney as `claim-finding` review items, and the checker is
measured on public USPTO claims with a strict structural metric.

## Launch

Use this command for execution-capable sessions:

```text
/goal follow the instructions in goals/claim-element-antecedent-check/GOAL.md
```

`GOAL.md` is the compact launcher. `SPEC.md` remains the normative contract.

## Read This First

1. [`GOAL.md`](./GOAL.md) - compact `/goal` launcher.
2. [`SPEC.md`](./SPEC.md) - normative source of truth.
3. [`PLAN.md`](./PLAN.md) - phases, dependencies, blockers.
4. [`ops/manifest.json`](./ops/manifest.json) - machine-readable routing.
5. [`research/SOURCES.md`](./research/SOURCES.md) - sources this goal needs.
6. [`history/`](./history/) - evidence and closeouts, if present.

Provenance: graduated from
[`explorations/claim-element-graph`](../../explorations/claim-element-graph/README.md)
on 2026-10-14. Read its
[`BRIEF.md`](../../explorations/claim-element-graph/BRIEF.md),
[`DECISIONS.md`](../../explorations/claim-element-graph/DECISIONS.md) and
[`MAP.md`](../../explorations/claim-element-graph/MAP.md) for the shaped pitch,
the rulings and the gated re-entry points.

Sibling goals:

- [`review-verdict-envelope`](../review-verdict-envelope/README.md) - owns
  `ReviewItem` / `VerdictRow`; its P1 schema gates this goal's P3.
- [`patent-document-schema`](../patent-document-schema/README.md) - owns
  `PatentClaim`, which this goal reads and does not change.
- [`epistemic-claim-lifecycle-gate`](../epistemic-claim-lifecycle-gate/README.md) -
  owns `CandidateClaim` and the lifecycle findings enter.
- [`patent-drafting-episode-ledger`](../patent-drafting-episode-ledger/README.md) -
  paused; a later consumer of ordered limitations.

## Current Phase

P2, in progress. P0 and P1 merged in #1764. The deterministic rules, service,
native USPTO adapter and recorded first contract slice are implemented locally.
ODP access works. The source selection is qualified and frozen: 60 positive
families / 538 selected claims and 200 allowed sets / 3,184 source claims.
All 60 families now have semantic-reference drafts covering all 538 selected
claims. Independent semantic criticism, convention decisions and actual attorney
agreement remain incomplete. The P3 read-only tool is implemented and verified.
The first structural measurement triggered the explicit poor-floor stop condition;
further implementation and publication stop at that measurement. Closeout remains incomplete.

## Latest Evidence

- **Poor-floor stop (2026-10-28):** [the first frozen positive replay](history/2026-10-28-positive-evaluation.md) measured **0/538 strict matches**: 186 input failures, eight undecomposed claims, 344 structural mismatches. The 517 current-convention accepted claims also scored zero. The explicit GOAL/SPEC poor-floor condition now stops further implementation and publication pending a new direction. The actual attorney agreement and adjudicated FP interval remain absent; this goal is not complete. The full-corpus scorer self-comparison passes all 538 references.


- **Evaluator and non-US smoke (2026-10-28):** the strict structural scorer
  passes seven regression tests and full server verification. Its
  [pre-prediction protocol](research/EVALUATION-PROTOCOL.md) declares exact
  source-node alignment, typed-edge diagnostics, reporting groups and the full
  denominator. The first positive benchmark replay is recorded above; this earlier protocol evidence predates it. The pinned
  [IPRally smoke](history/2026-10-28-iprally-smoke.md) used one non-US mechanical
  token reconstruction and returned one tree / 61 unreviewed findings. It is
  explicitly non-gold and supplies no accuracy or false-positive estimate.


- **Read-only review tool verified (2026-10-28):** `claim_self_check` is now
  declared in the practice toolkit and served by its actual MCP handler. It
  returns full source quotes, `claim-finding` review items, candidate/evidence
  envelopes and unchecked claims without source fetching or persistence.
  Tests prove generated-item schema round-trip, document-distinct identities,
  verdict projection and real MCP dispatch. Full MCP-kit, use-case and server
  package verification passes. See
  [P3 evidence](history/2026-10-28-p3-read-tool.md). Actual attorney acceptance
  remains open while independent P3 evaluation work continues under root
  `AGENTS.md` Autonomy.


- **Pending human acceptance (2026-10-28):** all 60 reference drafts / 538 claims
  pass integrity, and independent review accepts 57 families / 517 claims.
  Three exhausted-round families retain eight explicit attorney decisions.
  Actual six-family spot-check agreement is not yet recorded. Full package
  verification passes for domain, use-cases, server and the USPTO driver.
  See the [operator gate receipt](history/2026-10-28-operator-attorney-gate.json)
  for evidence, review artifacts and the remaining P3/Yeet/closeout work.


- **Implementation baseline recorded (2026-10-28):** the exact 18 P2 source
  files are hashed in [implementation freeze](research/implementation-freeze.json)
  before positive semantic benchmark predictions. This retains the rules being
  measured while independent source labels continue. The earlier allowed-input
  coverage replay remains separately disclosed; this is not a claim that no
  allowed findings have been produced.


- **Qualified source freeze and label checkpoint (2026-10-28):** all 60
  positive source families passed independent source criticism. Failed source
  versions were retained in the exclusion history and replaced within CPC;
  selection did not use checker output. See
  [source freeze](research/positive-source-freeze.json) and the current
  [review snapshot](research/source-audit-summary.json). Semantic drafts remain
  under bounded review. A source-grounded term/connecting-text convention was
  clarified independently of production rules; affected references are being
  checked consistently. Eight post-round-limit representation decisions (one connective and seven
  lexical heads) are reserved for actual attorney review. The
  [self-contained review packet](history/attorney-review/index.html) now
  contains the frozen six-family, 50-claim spot-check and those seven
  questions, with version-bound export and no prefilled verdicts. A separate
  [one-question addendum](history/attorney-review/addendum.html) retains the
  subsequently identified `each edge` head question without changing the
  original review or agreement denominator. No human agreement or accuracy/FP result is claimed.

- **Historical initial corpus audit (2026-10-28; superseded by source freeze):** all 60 source
  proposals were audited by extractors: 39 eligible proposals (359 selected
  claims), 18 unresolved and 3 ineligible at that checkpoint. Independent source
  review and replacements subsequently qualified all 60 active families.
  Earlier labels copied parser heuristics into references, so 14 family drafts
  are preserved as auxiliary conformance evidence and excluded from semantic
  accuracy. Fresh source-grounded labeling uses
  [semantic-reference/v2](research/LABEL-PROTOCOL.md). The native vertical slice
  remains a tested contract fixture; semantic-reference acceptance is separate.
  The frozen allowed sample contains 200 sets / 3,184 source claims. Latest
  full server package verification passes audit and docgen. No attorney
  agreement, semantic accuracy or false-positive estimate is complete.

- **First slice and source collection:** the final claim-1 tree was accepted
  by independent extractor and critic in two bounded rounds; the public
  replay test checks strict structural equality and both the examiner's
  missing-antecedent phrase and an unsupported possessive span. All four
  full package verifications pass. The expanded source acquisition retrieved
  286 native grant claim sets / 3,960 claims; scope screening, stratification
  and adjudication are still pending, so these are not clean negatives.

- **Native live pipeline (2026-10-28):** `US20200109732A1` produced
  16 normalized claims and 16 trees, no undecomposed claims, and 191 advisory
  findings. Claim 1 includes `missing-antecedent` for the examiner-quoted
  `the foot` at `[356, 364)`. Structural gold review and attorney sampling
  remain separate acceptance gates.

- **Access restored (2026-10-28):** after the operator updated the existing
  secret, both status-only ODP probes returned HTTP 200. The live listing for
  public application `16123456` supplies PDF then XML options for claims and
  the non-final office action. Real parsing and provenance remain to be verified.

- **2026-10-28 resumption:** authenticated USPTO application and document-list
  probes both returned HTTP 403. The XML-option selection repair is implemented
  locally with synthetic regression coverage; this does not satisfy the real
  rejection slice or labelled corpus. See
  [resumption evidence](history/2026-10-28-resumption.md).


- **P0:** `values/ClaimElement/` in `@beep/law-practice-domain`, in four files: `ClaimElement.model.ts`,
  `ClaimElement.edge.model.ts`, `ClaimElement.tree.model.ts` (with coherence checks) and
  `AntecedentFinding.model.ts` (each finding carries its `chain`; candidates are distinct). Tests
  are in `test/ClaimElement.test.ts`.
- **P1:**
  - The `ClaimElementDecomposer` and `AntecedentPolicy` function types.
  - The `ClaimSelfCheck` `Context.Service` (`check`, `checkPublished`, `candidates`), with
    per-claim `undecomposed` failures.
  - The `UsptoClaims` port and the `UsptoClaimsError` / `ClaimSelfCheckError` split.
  - Independent review found 2 P1 and 7 P2 issues. All are applied or recorded in the SPEC
    Decision Log.
  - `package-verify` passes for `@beep/law-practice-domain` and `@beep/law-practice-use-cases`.
    The repo-wide docgen run is left to hosted Docgen on the publish PR.
- **P2a:**
  - `decomposeClaim` and `antecedentPolicy`, following `research/P2-DESIGN.md`. Deviations and
    known limits are in its "P2a as built" section.
  - 22 synthetic rule fixtures, plus failure fixtures, a participle regression test and a
    determinism property test.
- **P2b:**
  - `ClaimSelfCheckLive` (`check`, `checkPublished`, `candidates` with term evidence).
  - `UsptoClaimsLive`, which reads the latest `CLM` document's XML claims, tested over a recorded
    synthetic fixture.
  - Shared claim and term evidence helpers.

## Notes

- Binding order: schema, then `Context.Service` contract, then implementation.
- Findings are advisory. Nothing blocks a draft.
- Fixtures are public USPTO record only. NC-licensed data stays outside the
  repo.
- If the deterministic floor measures badly, the goal stops at the measurement.
