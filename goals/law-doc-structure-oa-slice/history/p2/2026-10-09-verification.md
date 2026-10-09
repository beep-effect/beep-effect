# Implemented office-action slice verification — 2026-10-09

The measured rule is `uspto-oa-finality-ssp@1`. Candidate schema version is `1`.
Confidence is a branded 0.95 non-calibrated prior; it is not an admission score.
The workflow emits exactly two ordered verified evidence inputs or one typed
abstention. Integrity failures use the consumed provenance error contract.

## Retained-inventory floors

An independent measurement script ran the implemented extraction workflow over
all 34 reconciled fixtures, hashing and verifying each raw source first. Every
emitted member satisfied the exact raw half-open UTF-16 slice check.

The pair count vector is `[16, 16, 18, 0, 0, 34]` in the fixed column order
`eligible, emitted, abstained, invalid, contradicted-by-label, correct`.
There are 32 emitted candidates. Positive precision, eligible-pair recall and
exact closed-outcome rate are each 1.0. The seen and held-out groups pass their
floors. The 22 group vectors, including empty structural diagnostics, are in
[`2026-10-09-floor-vectors.json`](2026-10-09-floor-vectors.json).

Public-form-language: `[16, 16, 16, 0, 0, 32]`; OCR-derived and layout-derived:
`[0, 0, 1, 0, 0, 1]` each. Precision is undefined for modalities with no eligible
pairs; their required quality closures pass. There is no real-OA performance
claim. Decision Log Run 2 (g) governs the retained-inventory substitute.

The oracle-upstream evaluation lane uses the pure rule with independently
reconciled labels; the full-pipeline lane uses source verification and the
span-preserving candidate adapter. All 34 are additionally exercised through
the complete workflow. Raw structural truth stays separate from candidate
recognition and from future-model shadow observations.

## Focused evidence

- Domain rule tests: UTF-16, supplementary Unicode, page straddle, all five
  closures, flattened checkbox loss, historical attachments and explicit v2.
- Use-case tests: all fixtures, direct GroundedExtraction-array consumption,
  inverted upstream ranges, zero-width adapter anchors, same-width wrong quotes,
  atomic partial/duplicate refusal, digest/version/scope drift, typed OCR
  diagnostics overriding a declared positive modality, and schema metadata
  coherence. Every recognized anchor is checked against its raw slice.
- Server tests: serialized receipt round trip, separate Layer restart, immutable
  v1 replay after a v2 abstention, linked failed and successful re-anchor attempts,
  duplicate ids, incomplete lines, broken predecessor chains and keyed lookup.
  A cross-scope failure is retained under its expected scope and a linked
  recovery succeeds; typed OCR diagnostics survive persistence and replay.
  The test consumer receives two evidence inputs and has no approval/admission
  state; abstentions are never delivered.
- Independent local disk writer and fresh-process replay both passed. The first
  process persisted structural receipts; the second decoded and reverified them
  into exactly two candidates. Private logs are retained in the lane ledger.

## Package and hosted-parity gates

The three package-verifies and hosted-parity results are recorded below when
terminal. Their result logs remain in the private ledger. They are distinct
from the focused proof and from exact-head hosted CI.

| Package | Result | Evidence |
| --- | --- | --- |
| `@beep/law-practice-domain` | pass | Audit 18.4 s; docgen 18.4 s; source unchanged since this proof. |
| `@beep/law-practice-use-cases` | pass | Final audit 13.0 s; docgen 8.8 s; test typecheck passes. |
| `@beep/law-practice-server` | pass | Final audit 42.7 s; docgen 12.2 s; test typecheck passes. |

Tested implementation head: `1f1d5ac6641ac3e90fbf0ff026b367e30488e9b7`.
Private terminal results are retained for archive at lane retirement.

| Hosted-parity gate | Terminal result |
| --- | --- |
| `quality test-tsgo` | pass; 331 files checked, 148 packages covered by their own check scripts. |
| `docgen:local` | Initial global-input preflight required full proof; `docgen:local --full` passes metadata, generation, example typecheck and aggregation. Decision (l). |
| `ci lane jsdoc-ratchet` | pass; zero legacy non-generated findings. |
| `CI=true knowledge refs --check` | pass; zero live gated observations. |
| `ci lane fallow --base origin/main` | pass after the two introduced complexity repairs; audit and health both exit 0. Two local-fixture duplication observations are advisory; Decision (j). |
| Scoped coverage | all three commands pass; canonical tool comparison judges three packages with zero failures. |

All baseline file identities remain present and pass: domain 223, use-cases 42,
server 32. Package totals exceed the unchanged baseline. Percentage columns are
lines, statements, branches, functions:

| Package | Percentages |
| --- | --- |
| Domain | 89.60, 89.60, 87.17, 84.59 |
| Use-cases | 96.85, 96.69, 90.79, 95.40 |
| Server | 99.45, 99.34, 94.35, 98.84 |

Every newly added source file reaches 100% across all four metrics under the
canonical zero-unit convention. No baseline or coverage suppression was changed.
The final test-canon scan introduces zero findings. The fixtures still prove all
34 complete outcomes and every emitted raw slice.

These local proofs are distinct from hosted required checks on the published
head and the final PR review window, which P3 drives through Yeet.

## Attributed hosted policy red

Wave 1 PR #1573 passes publication cheap gates. Hosted Repo Sanity rejects its
private use-cases changeset, while publication requires that same private product
workspace note. The orchestrator standing ruling resolves release notes without changesets for
private packages. This lane removed its four notes, retained handoff release
notes, and merged the shared release-policy and CI repair from main at
`c830ab88f1`. No gate or package privacy was changed by this slice.

The obsolete P0 Heavy Admit workflow was cancelled after confirming its immutable
fixture-only head. Wave 2 requires implementation-head verification; cancelled
old-head jobs are neither successes nor final-head failures. Decision Log (i)
records the reason and reversal.
