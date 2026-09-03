# time-to-certainty — P0 baseline (ratified 2026-09-03, decisions.md ruling 8)

Source: `research/economics.md` (2026-09-03), reproducible with `research/scripts/economics.py`
over the frozen fleet corpus (2026-09-03T02:27Z) plus live attempt journals in every checkout and
hosted Check runs since 2026-08-20. Attempt window 2026-08-04T12:22Z to 2026-09-03T06:26Z; 2,742
attempts in the union population, 1,833 in the article-comparable filter. Input receipts (2,115
files with sha256_12) are in `research/economics.json`.

## Proxies

| Id | Proxy | Baseline | Sample | Caveat |
| --- | --- | --- | --- | --- |
| M1 | Red-to-green episode per branch | P50 43.3 min, P95 3.95 h | n=328 episodes | Up from the ontology article's 41 min / 3.1 h on its earlier window; the 24 h comparison censor must not become the target, so an uncut-tail row is retained beside it |
| M2 | First actionable failure | start offset P50 9.7 s, P95 18.9 min; completion P50 8.4 min, P95 30.6 min | n=832 reconstructable failures | 778 red attempts have no reconstructable duration (handler failures, no lane duration) |
| M3 | Lane executions per change across tiers | hosted only: Test Integration 1.26 runs per attempt (max 3); local inner lanes unmeasurable | 250 attempts (hosted) | The pre-push wrapper journals one aggregate row; inner lane executions and tiers are not journaled locally |
| M4 | False-red round trips per gate class | unmeasurable | 0 attempts carry a tree fingerprint | Attempt rows record `head=HEAD`; run state is overwritten after the latest green; needs per-attempt fingerprint and per-lane input digest |
| M5 | Unjournaled terminations | 327 attempts started and never recorded a finish (11.9% of the union population) | 2,742 attempts | A start-without-finish is the closest journal proxy for a severed cord; lease and submitter deaths are not journaled at all |

## Where local wall time goes (directly measured wrapper lanes)

| Wrapper | Attempts | P50 | P95 | Total | Share |
| --- | ---: | ---: | ---: | ---: | ---: |
| pre-push wave | 1,046 | 13.9 min | 29.8 min | 264.1 h | 65.9% |
| PR checks watch (waiting on hosted) | 457 | 4.0 min | 41.3 min | 77.8 h | 19.4% |
| cheap gates | 261 | 1.6 min | 5.4 min | 12.1 h | 3.0% |
| feedback test | 201 | 3.6 min | 6.1 min | 10.4 h | 2.6% |
| merged-preview parity | 15 | 21.6 min | 46.1 min | 5.8 h | 1.4% |
| review-fix proof | 39 | 7.6 min | 20.4 min | 5.5 h | 1.4% |

## Where hosted required-lane time goes

Coverage Regression is the largest hosted pool: P50 10.1 min, P95 15.5 min, 15.1% of required-lane
time across 881 runs. Test Integration shows the highest tier amplification (1.26 runs per attempt,
max 3).

## Which lanes fail first

| Actionable lane | Failed attempts |
| --- | ---: |
| publish head-install preflight | 349 |
| PR checks watch (hosted red) | 237 |
| git commit (hooks) | 207 |
| pre-push wave | 137 |

The most frequent local failure is the cheapest lane in the pipeline (P50 5.5 s): the detached
clean-HEAD install preflight. Its failure classes are not yet classified; if most are refusals of
dirty or unpushed state, they are backpressure working as designed; if they are environment
failures, they are a hygiene class of their own.

## Data quality

Seven attempt journals are at the 50-row ring cap (observed eviction lower bound 0 because the
frozen corpus overlaps the live window). Hosted data starts 2026-08-20. Local per-context P50/P95,
exact tier executions for failed merged previews, failed-unchanged-fingerprint sequences, first
cold-lane cache effects, and fleet queue share could not be measured; each has a named journal
repair in `research/economics.md` section G.

## Ratification

Ratified by the operator on 2026-09-03 (decisions.md ruling 8): the sample window and the M1
recipe with the uncut-tail row kept beside the 24-hour censor. The close-out re-runs the same
script and compares row by row; M3 and M4 gain numbers once A5 journal facts land and are reported
as a second row, never as a replacement of this one.
