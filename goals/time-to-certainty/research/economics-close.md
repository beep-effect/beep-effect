# Verification economics — P4 close snapshot

Reproduce from a clean repository clone with the committed compact inputs:

```sh
python3 goals/time-to-certainty/research/scripts/economics.py --run close --from-inputs
```

Embedded replay verifies both compact inputs, `economics-close.json` and the baseline `economics.json` against HEAD, then checks the input bytes against `inputs/close/RECEIPTS.json`; use `--allow-input-drift` only for non-ratified output.

Validate an available frozen corpus before replaying it:

```sh
python3 goals/time-to-certainty/research/scripts/economics.py --run close --from-inputs --corpus <dir>
```

Corpus path, digest, manifest, or compact-fact drift fails closed before either output is written.
Use `--allow-corpus-drift` only for exploratory output: JSON gets
`corpusValidation: "drifted"`, and Markdown gets a visible non-ratified banner.

| Method | Value |
| --- | --- |
| Schema | verification-economics/v1 |
| As of | 2026-09-28T12:57:53.988Z |
| Percentiles | true nearest-rank: sorted index ceil(p*n)-1 |
| Episode identity | (checkout, branch); prevents cross-checkout closure |
| Article comparison | verify/repair/publish; lock bounces excluded; <=24h |
| Cache metric | not computed; first-cold-lane records absent (C5) |

## A. Required-context lane economics

| Context | logical attempts | runs | runs/attempt | local inner | preview inferred | hosted matched | hosted n | p50 ms | p95 ms | hosted time share | local p50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lint | 461 | 495 | 1.074 | 380 | 31 | 84 | 1062 | 3000 | 4000 | 0.09% | unmeasured |
| Heavy / Check | 411 | 437 | 1.063 | 357 | 31 | 49 | 710 | 212000 | 3032000 | 12.97% | unmeasured |
| Test Unit | 256 | 285 | 1.113 | 170 | 31 | 84 | 1061 | 3000 | 4000 | 0.1% | unmeasured |
| Heavy / Test Integration | 244 | 273 | 1.119 | 193 | 31 | 49 | 711 | 209000 | 2838000 | 12.16% | unmeasured |
| Heavy / Docgen | 249 | 281 | 1.129 | 201 | 31 | 49 | 710 | 296000 | 2986000 | 13.26% | unmeasured |
| Codegen Drift | 213 | 255 | 1.197 | 140 | 31 | 84 | 1062 | 136000 | 342000 | 4.02% | unmeasured |
| Repo Sanity | 601 | 653 | 1.087 | 538 | 31 | 84 | 1062 | 257000 | 381000 | 7.64% | unmeasured |
| Knip | 930 | 1021 | 1.098 | 906 | 31 | 84 | 1062 | 121000 | 182000 | 4.04% | unmeasured |
| Commitlint | 216 | 257 | 1.19 | 142 | 31 | 84 | 1062 | 92000 | 168000 | 3.43% | unmeasured |
| Secret Scanning | 537 | 554 | 1.032 | 439 | 31 | 84 | 1062 | 66000 | 243000 | 2.89% | unmeasured |
| Security | 537 | 554 | 1.032 | 439 | 31 | 84 | 1062 | 53000 | 147000 | 2.32% | unmeasured |
| SAST | 536 | 552 | 1.03 | 437 | 31 | 84 | 1062 | 115000 | 273000 | 4.12% | unmeasured |
| Nix Shell | 536 | 552 | 1.03 | 437 | 31 | 84 | 1062 | 131000 | 214000 | 4.43% | unmeasured |
| Professional Desktop IPC Stdio | 192 | 232 | 1.208 | 117 | 31 | 84 | 1062 | 35000 | 245000 | 2.63% | unmeasured |
| Heavy / Doctest | 136 | 156 | 1.147 | 76 | 31 | 49 | 711 | 250000 | 2838000 | 11.96% | unmeasured |
| JSDoc Ratchet | 109 | 115 | 1.055 | 0 | 31 | 84 | 1062 | 541000 | 594000 | 13.94% | unmeasured |

## B. Directly measured local wrapper lanes

| Lane | phase | attempts | p50 ms | p95 ms | total | local time share |
| --- | --- | --- | --- | --- | --- | --- |
| full:01-pre-push / full:pre-push | full | 1232 | 873353 | 2019059 | 332.84h | 63.55% |
| monitor:02-pr-checks-watch / monitor:pr-checks:watch | monitor | 542 | 11158 | 2048540 | 82.92h | 15.83% |
| full:00-cheap-gates / full:cheap-gates | full | 614 | 149865 | 579244 | 34.76h | 6.64% |
| full:02-ci-parity / full:ci-parity | full | 38 | 1337573 | 3345791 | 17.37h | 3.32% |
| feedback:04-test / feedback:test | feedback | 245 | 225038 | 432964 | 14.35h | 2.74% |
| feedback:00-cheap-gates / feedback:cheap-gates | feedback | 121 | 226773 | 600928 | 8.40h | 1.6% |
| full:01-review-fix / full:review-fix | full | 40 | 458910 | 1223492 | 5.90h | 1.13% |
| prepare:05-docgen / prepare:docgen | prepare | 174 | 36972 | 380668 | 5.46h | 1.04% |
| feedback:03-lint / feedback:lint | feedback | 246 | 22841 | 166947 | 4.45h | 0.85% |
| feedback:00-heavy:02-docgen / feedback:docgen | feedback | 121 | 82703 | 274405 | 3.82h | 0.73% |
| feedback:02-check / feedback:check | feedback | 249 | 11601 | 117784 | 2.50h | 0.48% |
| prepare:02-terse-effect / prepare:laws:terse-effect | prepare | 297 | 23124 | 40022 | 2.03h | 0.39% |
| feedback:01-build / feedback:build | feedback | 245 | 14474 | 83706 | 1.62h | 0.31% |
| publish:00-head-install-preflight / publish:head-install-preflight | prepare | 743 | 6351 | 15212 | 1.55h | 0.3% |
| publish:00-head-install-preflight / publish:head-install-preflight | publish | 698 | 5985 | 13676 | 1.38h | 0.26% |
| advisory:01-fallow-feedback / fallow-advisory-feedback | feedback | 1976 | 1848 | 2967 | 1.09h | 0.21% |
| prepare:01-effect-imports / prepare:laws:effect-imports | prepare | 297 | 8328 | 16545 | 42.6m | 0.14% |
| prepare:03-config-sync / prepare:config-sync | prepare | 297 | 7468 | 15025 | 41.2m | 0.13% |
| publish:00-head-install-preflight / publish:head-install-preflight | early-publish | 204 | 9770 | 20703 | 38.5m | 0.12% |
| commit:01-git-commit / commit:git:commit | commit | 538 | 2892 | 5005 | 26.3m | 0.08% |
| publish:01-git-push / publish:git:push | publish | 505 | 1644 | 5160 | 17.1m | 0.05% |
| prepare:04-lint-fix / prepare:lint:fix | prepare | 174 | 3523 | 5558 | 9.7m | 0.03% |
| publish:01-git-push / early-publish:git:push | early-publish | 204 | 1653 | 4138 | 7.0m | 0.02% |
| feedback:00-heavy:01-lint-fix / feedback:lint:fix | feedback | 121 | 3675 | 5103 | 6.9m | 0.02% |
| monitor:01-pr-context / monitor:pr-context | monitor | 547 | 386 | 550 | 3.8m | 0.01% |
| commit:01-git-commit / commit:git:commit:amend | commit | 52 | 2691 | 4406 | 2.4m | 0.01% |
| prepare:04-goals-index / prepare:goals:index | prepare | 15 | 1802 | 4250 | 33.4s | 0.0% |
| prepare:05-explore-atlas / prepare:explore:atlas | prepare | 15 | 1758 | 3353 | 29.4s | 0.0% |

## B2. Directly measured local inner lanes (separate population)

3921 timed inner executions across 139 attempts, 59.87h in total, 62.29% of those attempts' elapsed time. Shares are within this population and are never added to section B. Top 15 of 62 rows; `economics-close.json` has all of them.

| Inner lane | phase | attempts | p50 ms | p95 ms | total | inner time share |
| --- | --- | --- | --- | --- | --- | --- |
| quality:lint-policy | full | 99 | 212719 | 709309 | 8.85h | 14.79% |
| quality:jsdoc-ratchet | full | 107 | 280502 | 333781 | 8.42h | 14.07% |
| quality:coverage | full | 66 | 438618 | 726431 | 7.23h | 12.08% |
| quality:test-unit | full | 68 | 16025 | 811899 | 4.90h | 8.18% |
| quality:check | full | 73 | 125897 | 541365 | 4.36h | 7.28% |
| quality:check:tsgo-tests | full | 33 | 444980 | 626764 | 3.76h | 6.28% |
| quality:docgen | full | 101 | 7020 | 329756 | 2.88h | 4.8% |
| lint-policy / ci:local:lint-policy | full | 18 | 235058 | 678339 | 1.76h | 2.93% |
| quality:lint | full | 96 | 5403 | 283567 | 1.61h | 2.7% |
| check / ci:local:check | full | 19 | 205530 | 717041 | 1.58h | 2.65% |
| coverage / ci:local:coverage | full | 18 | 400436 | 771302 | 1.52h | 2.54% |
| jsdoc-ratchet / ci:local:jsdoc-ratchet | full | 19 | 276212 | 329395 | 1.47h | 2.46% |
| quality:doctest | full | 76 | 39643 | 128639 | 1.30h | 2.17% |
| quality:build | full | 116 | 20379 | 83990 | 58.6m | 1.63% |
| quality:test-integration | full | 93 | 19786 | 113522 | 56.6m | 1.58% |

## C. Attempts and first actionable failure

| Population | attempts | success | failure | starts without finish |
| --- | --- | --- | --- | --- |
| union: frozen + live overlay | 4254 | 1373 | 2174 | 97 |
| article-comparable modes/bounce filter | 3055 | 986 | 1410 | n/a |

| First-failure measure | n | p50 | p95 | law |
| --- | --- | --- | --- | --- |
| failing outer-lane start offset | 1205 | 11.4s | 18.2m | cumulative recorded prior wrappers |
| first actionable failure completion | 1205 | 7.5m | 34.3m | offset + failing wrapper duration |
| red attempts not reconstructable | 1676 | n/a | n/a | handler/no duration |

| Actionable lane | failed attempts |
| --- | --- |
| unlocated | 806 |
| publish:00-head-install-preflight | 370 |
| monitor:02-pr-checks-watch | 305 |
| commit:01-git-commit | 296 |
| full:00-cheap-gates | 157 |
| full:01-pre-push | 152 |
| closeout:01-pr-context | 151 |
| quality:lint | 70 |
| quality:build | 67 |
| quality:lint-policy | 53 |
| fallow:audit | 48 |
| quality:changeset-status | 38 |
| quality:check | 24 |
| quality:coverage | 23 |
| publish:01-git-push | 21 |

## D. Receipt-matched failure proxies

| Proxy class | failed attempts | Unchanged-fingerprint claim |
| --- | --- | --- |
| unclassified | 2303 | not joinable |
| scheduler-lock-bounce | 397 | not joinable |
| stale-workspace-or-projection | 89 | not joinable |
| base-churn | 81 | not joinable |
| scheduler-or-submitter | 11 | not joinable |

| M4 field | Value |
| --- | --- |
| failed unchanged fingerprint -> next green | measured |
| per-attempt fingerprints | 1060 |
| latest state files with fingerprint | 517 |
| reason | measured only over attempts whose journal rows carry diffFingerprint (A5 and later); pre-A5 rows carry head=HEAD and stay outside the proxy |

## E. Red-to-green episodes

| Population | n | p50 | p95 | span min | attempt-machine min | lane-machine min | right-censored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| article-comparable: modes verify/repair/publish; lock bounces and left-censored episodes excluded; <=24h | 440 | 42.3m | 4.33h | 36692.49 | 16123.71 | 14147.62 | 261 |
| uncut tail: same modes/bounce/censor rule; no duration ceiling | 452 | 43.5m | 7.21h | 75833.4 | 17167.59 | 14941.01 | 261 |

| Baseline comparison | article | current | delta | moved |
| --- | --- | --- | --- | --- |
| P50 | 41.3m | 42.3m | 59.2s | up |
| P95 | 3.10h | 4.33h | 1.23h | up |
| Raw finished attempts | 2433 | 4254 | 1821 | retained sample delta |

## F. Admission and hosted envelopes

| Admission measure | Value |
| --- | --- |
| admitted / released / open | 14 / 12 / 2 |
| wait p50 / p95 | 5ms / 27.2m |
| closed wait / service | 30.1s / 2.16h |
| queue share | 0.39% |
| scope | frozen admission journals only |

| Hosted Check event | runs | p50 | p95 | outcome mix |
| --- | --- | --- | --- | --- |
| pull_request | 977 | 17.7m | 1.96h | {"cancelled":586,"failure":156,"success":234,"unknown":1} |
| main-push | 157 | 36.8m | 2.21h | {"cancelled":61,"failure":76,"success":19,"unknown":1} |

| Verification envelope | n | p50 | p95 | Comparability |
| --- | --- | --- | --- | --- |
| local pre-push wrapper | 1232 | 14.6m | 33.7m | local sequential/waved collector |
| local merged-preview wrapper | 38 | 22.3m | 55.8m | merged tree; child timings absent |
| hosted PR Check workflow | 977 | 17.7m | 1.96h | parallel jobs; createdAt -> updatedAt |

## G. Data quality

| Constraint | Measured fact / consequence |
| --- | --- |
| Window | 2026-08-04T12:22:57.623Z -> 2026-09-28T12:56:00.841Z |
| Frozen / live / hosted capture | 2026-09-03T02:27:19.384Z / 2026-09-28T12:57:53.988Z / 2026-09-28T12:38:17.454Z |
| Ring cap | 50 starts per branch journal; 9/465 journals at cap |
| Observed truncation lower bound | 0 attempt IDs evicted across 269 comparable journals |
| Unknown lifetime truncation | exact count unavailable; pre-capture history is absent |
| Unmatched starts | 97 |
| Cap pressure | unmatched starts consume retention slots; exact displaced terminal rows are unknowable |
| Verdict versions | v2=3547; v1/other=707 |
| Inner timings | post-A5 verdicts list inner lanes with durationMs and parentLaneId after their wrappers; wrapper and inner lanes are separate populations (ruling 74) and are never summed; pre-A5 verdicts carry wrappers only |
| Fingerprint join | measured only over attempts whose journal rows carry diffFingerprint (A5 and later); pre-A5 rows carry head=HEAD and stay outside the proxy |
| Clock | all ISO timestamps normalized to UTC; admission epoch milliseconds interpreted as UTC instants |
| Hosted duration | job startedAt -> completedAt; includes job setup, excludes skipped and missing/negative intervals |
| Tier join | 86/977 PR workflows time-matched to publish attempts; 891 unmatched |
| Failed preview allocation | 7 failed merged-preview wrappers have unknown child execution sets |
| Episode tail | 12 >24h closed episodes censored only for article comparison |
| Cache | forbidden by ship-velocity C5; inputs contain no first-cold-lane task accounting |
| Inputs | 3 replay files and 795 frozen corpus receipts; every path and sha256_12 in economics-close.json |

## Close versus P0 baseline

Ruling 8 rows, same script and recipe. P0 baseline: `goals/time-to-certainty/research/economics.json` (live capture 2026-09-03T06:29:33.572Z). Close: the union population of this report. Post-P0: the same recipe over the 1130 finished attempts that started after 2026-09-03T06:29:33.572Z. `n/a` in the baseline column means the P0 report does not carry the row.

| Id | Measure | P0 baseline | Close (union) | Close (post-P0 attempts) |
| --- | --- | --- | --- | --- |
| M1 | M1 P50 comparable <=24h | 43.3m | 42.3m | 1.02h |
| M1 | M1 P95 comparable <=24h | 3.95h | 4.33h | 10.21h |
| M1 | M1 closed episodes (<=24h) | 328 | 440 | 58 |
| M1 | M1 right-censored streaks (<=24h) | 115 | 261 | 129 |
| M1 | M1 right-censored red attempts (<=24h) | 313 | 1012 | 614 |
| M1 | M1 P50 uncut | 43.6m | 43.5m | 1.11h |
| M1 | M1 P95 uncut | 6.12h | 7.21h | 13.50h |
| M2 | M2 start offset P50 | 9.7s | 11.4s | 20.5s |
| M2 | M2 start offset P95 | 18.9m | 18.2m | 10.8m |
| M2 | M2 completion P50 | 8.4m | 7.5m | 4.9m |
| M2 | M2 completion P95 | 30.6m | 34.3m | 57.1m |
| M2 | M2 reconstructable failures | 832 | 1205 | 335 |
| M3 | M3 Test Integration runs per attempt | 1.264 | 1.119 | 1.184 |
| M3 | M3 Test Integration max runs in one attempt | 3 | 3 | 3 |
| M3 | M3 Docgen runs per attempt | 1.264 | 1.129 | 1.199 |
| M3 | M3 Docgen max runs in one attempt | 3 | 3 | 3 |
| M4 | M4 classification | unmeasurable | measured | measured |
| M4 | M4 failed unchanged fingerprint then green | n/a | 16 | 16 |
| M4 | M4 attempts with diff fingerprint | 0 | 1060 | 1060 |
| M5 | M5 starts without finish | 327 | 97 | 23 |
| M5 | M5 starts | 3069 | 4350 | 1152 |
| M5 | M5 starts without finish pct | 10.65% | 2.23% | 2.0% |
| M5 | M5 journaled terminations | n/a | 707 | 446 |
| M5 | M5 sweep-stamped terminations | n/a | 280 | 19 |
| M5 | M5 starts without an attempt-written terminal row | 327 | 377 | 42 |

M1 union: 440 closed episodes against 261 right-censored streaks (1012 red attempts). M1 post-P0: 58 closed episodes against 129 right-censored streaks (614 red attempts), so its closed-episode percentiles are a lower-bound sample (long streaks are still open).

M4 method: ruling 75 fingerprint-repeat proxy over the M1 comparable sequence per (checkout, branch): verdict-bearing red followed by green on the same diffFingerprint; the ack-resolution join is absent. M3 local runs come from verdict inner lanes and hosted runs from the Check runs created on or after 2026-09-14, so the union and post-P0 columns share one hosted join.

| M5 journaled termination reason | attempts (union) |
| --- | --- |
| interrupted | 410 |
| legacy-unowned-start | 275 |
| lease-eviction | 8 |
| owner-dead | 5 |
| unrecorded-failure | 5 |
| queued-submitter-death | 4 |
