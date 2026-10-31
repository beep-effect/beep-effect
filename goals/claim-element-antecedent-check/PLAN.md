# Claim Element Antecedent Check Plan

## Status

Status: `active` (P0–P1 merged; P2 deterministic rules and service exist; ODP access restored on 2026-10-28; native publication XML adapter implemented locally; live qualification and provenance-bound corpus acquisition in progress)

## Binding Sequencing

Schema, then `Context.Service` contract, then implementation, then review items
and evaluation. A phase starts only when the previous phase meets its exit
criteria (`SPEC.md` Acceptance Criteria). Helpers are extracted after P0 and P1
are fixed, never before.

## Phases

| Phase | Status | Goal | Entry criteria | Exit criteria |
| --- | --- | --- | --- | --- |
| P0 Schema | complete | Define `values/ClaimElement/` in `@beep/law-practice-domain`: `ClaimElementTree` keyed by `claimNumber`, `ClaimElement`, `ClaimTerm`, the `ClaimElementEdge` tagged union, and the `AntecedentFinding` tagged union including `pattern-not-covered`. Every element and term carries a `TextAnchor`. | Packet read; `PatentClaim`, `PatentClaimDependencyIssue`, `TextAnchor` inspected. | Schemas compile with `$I` annotations and `LiteralKit` domains; round-trip tests pass; `PatentClaim` unchanged; no service code. |
| P1 Service contract | complete | Declare the `ClaimSelfCheck` `Context.Service` in `@beep/law-practice-use-cases` with typed errors; the decomposer (`ClaimElement.behavior.ts`) and antecedent (`Antecedent.policy.ts`) signatures in domain; the USPTO claims port. | P0 exit met. | Contracts type-check against P0 schemas; no implementation bodies; candidate mapping target (`CandidateClaim` + `Evidence`) named. |
| P2 Deterministic implementation + USPTO adapter + labelled set | in-progress | Implement the pure decomposer and checker, one rule and fixture per determiner edge case; the server-side USPTO adapter over `@beep/uspto`; the `ClaimSelfCheck` Layer; the first vertical slice; the labelled set (~60 families via the extractor/critic loop with ~10% attorney spot-check; ~200 allowed sets). | P1 exit met. | Vertical slice passes strict equality and emits the expected `missing-antecedent`; all rule fixtures pass; labelled fixtures committed (public USPTO only); `package-verify` green for domain, use-cases, server. |
| P3 Review items + evaluation | in-progress (parallel implementation; P2 attorney acceptance open) | Add the practice MCP read tool that returns findings as `claim-finding` `ReviewItem`s; run the evaluation and write the report. | P2 exit met **and** `review-verdict-envelope` P1 schema (`ReviewItem` / `VerdictRow`) merged. | `ReviewItem` fixture round-trips; the `VerdictRow` → `ClaimDisposition` projection test passes once `review-verdict-envelope` P2 (`VerdictProjector`) has merged, and is recorded as pending in Current Blockers until then; report in `history/` gives strict-equality floor, adjudicated FP rate with interval, IPRally smoke result; findings advisory. |
| P4 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | P3 exit met. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P5 Close | pending | Write the closeout reflection and flip packet state. | P4 exit met. | Packet status and evidence are updated; a closeout reflection exists. |

## Dependencies

- **Cross-goal:** P3 needs the `ReviewItem` / `VerdictRow` schema from
  [`goals/review-verdict-envelope`](../review-verdict-envelope/README.md) P1.
- **Cross-goal:** the `VerdictRow` → `ClaimDisposition` projection test needs
  `review-verdict-envelope` P2 (`VerdictProjector`).
  P0–P2 do not depend on it. If P2 finishes first, the goal may publish P0–P2
  and open P3 once that schema merges.
- **Attorney time:** the ~10% label spot-check (P2) and the first findings
  (P3), at most two hours in total. This is not a spend escalation.
- **Review surface:** findings render in the `practice-claude-mod` review queue,
  which the `attorney-review-workspace` amendment owns. This goal only produces
  `ReviewItem`s.
- **Downstream (gated in the exploration's `MAP.md`):** drafting support set,
  office-action element mapping, `Distinction.missing_limitation` element
  reference, LLM decomposition, IPRally interop, Markush.

## Current Blockers

- **Current allowed replay and adjudication preparation (2026-10-31):** [report](history/2026-10-31-allowed-v12-report.md) records 188/200 sets and 2,951/3,184 claims checked, with 233 input-failed claims retained. 20,807 raw findings are unadjudicated. A pre-replay random 30-claim review sample contains 28 checked/two failed claims; [blank review packet](history/allowed-review-v1/index.html) and validated import/interval machinery are ready. No false-positive estimate or human agreement is claimed. The same non-US smoke is rerun; positive 31/538 and all prior labels/results remain intact.

- **Contextual predicate repair with 29-claim retention (2026-10-31):** [comparison](history/2026-10-31-predicate-comparison.md) records **31/538 complete structures (5.76%)**, retaining all 29 baseline passes with two gains and zero losses. Edge F1 is 29.3067% (previously 29.2580%). Frozen labels, sources, scorer and all historical results remain unchanged. 449 structural mismatches and 58 input failures remain. Two new regression tests and all package verifications pass. The goal remains active and human acceptance incomplete.

- **Discourse-role repair with pass retention (2026-10-28):** [the comparison](history/2026-10-28-discourse-comparison.md) records **29/538 complete matches (5.39%)**, retaining all previous 21. Final [paired gate](history/2026-10-28-v10-retention.json) has eight gains and zero losses. Edge F1 is slightly lower at 29.26%; recall improves but precision declines. All old labels/results/scorer remain unchanged. 451 structural mismatches and 58 input failures remain; eight new regressions and all package checks pass. Full goal/human acceptance remain incomplete.


- **Next closest-match repair (2026-10-28):** [the comparison](history/2026-10-28-next-closest-comparison.md) records **21/538 strict matches (3.90%)**, retaining all previous 11, and exact typed-edge F1 **29.31%**. All labels, earlier results and the scorer remain unchanged; the intermediate 19-match source/result is preserved at 007427078c. 459 mismatches and 58 input failures remain. This is development-set remediation; human agreement and full-goal acceptance are still open.


- **Closest-match repair frontier (2026-10-28):** [fixed-reference rerun](history/2026-10-28-closest-comparison.md) improves strict recovery to 11/538 and typed-edge F1 to 25.98%; 469 structural mismatches and 58 normalization failures remain. Explicit aliases, clause boundaries and body/entity dependencies are repaired. Remaining interpretation/convention questions are diagnosed without changing labels or excluding failures; human acceptance and full-goal completion remain unproven.


- **User-directed bounded repair (2026-10-28):** the user authorized fixing gaps and rerunning without changing original results or reference labels. [Final comparison](history/2026-10-28-repair-comparison.md): strict 0/538, 58 input failures, no undecomposed selected claims, typed-edge F1 21.88%. Functional/phrase/ancestor/transition repairs and full package verification are saved locally. The earlier stop was superseded only for this repair; full goal completion, adjudicated FP and human acceptance remain unproven.


- **Poor deterministic floor stop (2026-10-28):** the frozen end-to-end replay returned 0/538 exact claim structures (186 normalization failures, eight undecomposed, 344 mismatches). Per GOAL/SPEC Appetite, stop at this measurement without tuning to the benchmark or expanding scope. [Report and receipts](history/2026-10-28-positive-evaluation.md) retain every selected claim. Human acceptance, adjudicated FP interval, publication and closeout remain unproven; this is not goal completion.


- **Asynchronous human review precedence (2026-10-28):** root `AGENTS.md`
  Autonomy requires operator review to remain asynchronous and not block
  independent implementation. Continue P3 tool/evaluation preparation while
  P2 attorney acceptance remains open; this does not claim P2 exit, attorney
  agreement, adjudicated gold or final benchmark results. The SPEC Decision
  Log retains this sequencing decision and its reversal path.


- **Current P2 checkpoint (2026-10-28):** source qualification is complete for
  all 60 active positive families (538 selected claims); source selection is
  frozen before positive predictions. The 200 allowed sets retain all 3,184
  source claims. Independent semantic references, targeted granularity
  consistency and actual attorney agreement remain incomplete. Older source
  holds below are historical and have been resolved or archived with
  source-qualified replacements. Eight representation decisions reached the three-agent-round bound:
  one reciprocal connector, six count/selector heads and one distributive head. They are explicit
  questions in `history/attorney-review/index.html` and its separate
  `addendum.html`, alongside the frozen
  six-family (50-claim) actual attorney spot-check. No human verdict has been
  recorded.

- **Historical initial corpus qualification (2026-10-28; superseded):** extractor audits
  yield 39 eligible source proposals, 18 unresolved and 3 ineligible. Critic
  review and source-qualified replacements subsequently resolved this source
  inventory; all 60 current source families are now accepted. Fourteen earlier family
  drafts are conformance evidence only, excluded from semantic gold. Fresh
  annotation follows semantic-reference/v2; unsupported parser inputs remain
  measurable coverage failures. Attorney sampling and agreement remain pending.

- **USPTO access restored (2026-10-28).** After the operator updated the existing
  secret, authenticated application and document-list probes returned HTTP 200.
  The public application `16123456` lists XML options after PDF for both `CLM`
  records and its `CTNF` record. Live parsing, rejection provenance and the
  labelled corpus are still in progress; access alone does not satisfy P2.
- **Driver follow-up implemented locally (2026-10-28).** `@beep/uspto` now retains
  all schema-valid download options and their format labels while keeping the
  first URL for existing callers. `UsptoClaimsLive` selects explicitly labelled
  XML even after a PDF; PDF-only records fail before download. Regression
  fixtures remain synthetic. See `history/2026-10-28-resumption.md`.
- **First vertical slice technically verified (2026-10-28):** native
  `US20200109732A1`, original CLM `JSNRXQGZRXEAPX2`, non-final action
  `K56UZ6OLRXEAPX4` mailed 2020-01-09. Two independent bounded labelling
  rounds accept claim 1; strict tree equality and exact examiner phrase
  `the foot` pass. Attorney sampling remains pending for the corpus.
- **Native publication source implemented locally:** ODP application metadata
  supplies individual native XML links. The publication branch resolves those
  links and rejects OCR markers. A bounded download redirect path strips the
  API key outside the API host. Corpus labels and in-force claim versions
  still require qualification.
- **P3 sibling dependency resolved:** `review-verdict-envelope` merged (#1761).
  ReviewItem round-trip and actual generated-item verdict projection now pass.
  Independent P3 implementation proceeds under the asynchronous-review
  precedence above; final P2 acceptance still requires actual attorney evidence.

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- If the deterministic floor measures badly, stop at the measurement and report
  it (appetite rule); do not add LLM decomposition.
- Record every placement or scope call in `SPEC.md`'s Decision Log.

## Verification Commands

```sh
test "$(wc -m < goals/claim-element-antecedent-check/GOAL.md)" -le 4000
jq . goals/claim-element-antecedent-check/ops/manifest.json
rg -n "claim-element-antecedent-check|GOAL.md|agentLaunchers|packetAnchorDocument" goals/claim-element-antecedent-check
git diff --check -- goals/claim-element-antecedent-check
bun run beep goals doctor
bun run beep quality package-verify @beep/law-practice-domain
bun run beep quality package-verify @beep/law-practice-use-cases
bun run beep quality package-verify @beep/law-practice-server
bun run beep lint reflection-artifacts
```
