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
| `@beep/law-practice-domain` | pass | Audit 14.7 s; docgen 9.4 s; opaque-proof declaration emission passes. |
| `@beep/law-practice-use-cases` | pass | Audit 12.9 s; docgen 8.5 s; opaque declaration and test typecheck pass. |
| `@beep/law-practice-server` | pass | Audit 42.2 s; docgen 11.3 s at `4ade6f1aca`; four storage/replay tests and package test typecheck pass. |

Hosted-parity commands remain pending heavy admission at this checkpoint.

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
