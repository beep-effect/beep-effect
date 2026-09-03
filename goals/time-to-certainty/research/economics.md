# Verification economics — fleet snapshot

Reproduce from a clean repository clone with the committed compact inputs:

```sh
python3 goals/time-to-certainty/research/scripts/economics.py --from-inputs
```

| Method | Value |
| --- | --- |
| Schema | verification-economics/v1 |
| As of | 2026-09-03T06:29:38.367Z |
| Percentiles | true nearest-rank: sorted index ceil(p*n)-1 |
| Episode identity | (checkout, branch); prevents cross-checkout closure |
| Article comparison | verify/repair/publish; lock bounces excluded; <=24h |
| Cache metric | not computed; first-cold-lane records absent (C5) |

## A. Required-context lane economics

| Context | logical attempts | runs | runs/attempt | local inner | preview inferred | hosted matched | hosted n | p50 ms | p95 ms | hosted time share | local p50 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Lint | 426 | 496 | 1.164 | 277 | 13 | 206 | 881 | 267000 | 1231000 | 12.99% | unmeasured |
| Heavy / Lint Policy | 280 | 350 | 1.25 | 131 | 13 | 206 | 881 | 363000 | 432000 | 9.73% | unmeasured |
| Heavy / Check | 426 | 496 | 1.164 | 277 | 13 | 206 | 881 | 383000 | 765000 | 12.27% | unmeasured |
| Test Unit | 252 | 318 | 1.262 | 99 | 13 | 206 | 881 | 495000 | 1410000 | 14.71% | unmeasured |
| Heavy / Test Integration | 250 | 316 | 1.264 | 97 | 13 | 206 | 881 | 137000 | 211000 | 4.16% | unmeasured |
| Heavy / Docgen | 250 | 316 | 1.264 | 97 | 13 | 206 | 881 | 115000 | 439000 | 5.42% | unmeasured |
| Codegen Drift | 213 | 233 | 1.094 | 14 | 13 | 206 | 881 | 107000 | 283000 | 2.89% | unmeasured |
| Repo Sanity | 540 | 620 | 1.148 | 401 | 13 | 206 | 881 | 183000 | 307000 | 5.14% | unmeasured |
| Heavy / Coverage Regression | 206 | 224 | 1.087 | 5 | 13 | 206 | 881 | 603000 | 928000 | 15.14% | unmeasured |
| Knip | 789 | 931 | 1.18 | 712 | 13 | 206 | 881 | 80000 | 122000 | 2.49% | unmeasured |
| Commitlint | 213 | 233 | 1.094 | 14 | 13 | 206 | 881 | 63000 | 107000 | 2.07% | unmeasured |
| Secret Scanning | 538 | 610 | 1.134 | 391 | 13 | 206 | 881 | 54000 | 130000 | 1.89% | unmeasured |
| Security | 538 | 610 | 1.134 | 391 | 13 | 206 | 881 | 28000 | 68000 | 1.23% | unmeasured |
| SAST | 538 | 609 | 1.132 | 390 | 13 | 206 | 881 | 82000 | 141000 | 2.5% | unmeasured |
| Nix Shell | 538 | 609 | 1.132 | 390 | 13 | 206 | 881 | 102000 | 141000 | 3.07% | unmeasured |
| Professional Desktop IPC Stdio | 206 | 224 | 1.087 | 5 | 13 | 206 | 881 | 69000 | 111000 | 1.64% | unmeasured |
| Heavy / Doctest | 90 | 104 | 1.156 | 0 | 13 | 91 | 661 | 82000 | 219000 | 2.65% | unmeasured |

## B. Directly measured local wrapper lanes

| Lane | phase | attempts | p50 ms | p95 ms | total | local time share |
| --- | --- | --- | --- | --- | --- | --- |
| full:01-pre-push / full:pre-push | full | 1046 | 836334 | 1785508 | 264.07h | 65.87% |
| monitor:02-pr-checks-watch / monitor:pr-checks:watch | monitor | 457 | 242618 | 2480280 | 77.75h | 19.39% |
| full:00-cheap-gates / full:cheap-gates | full | 261 | 96764 | 321783 | 12.11h | 3.02% |
| feedback:04-test / feedback:test | feedback | 201 | 217302 | 364671 | 10.42h | 2.6% |
| full:02-ci-parity / full:ci-parity | full | 15 | 1294405 | 2763383 | 5.80h | 1.45% |
| full:01-review-fix / full:review-fix | full | 39 | 458910 | 1223492 | 5.52h | 1.38% |
| prepare:05-docgen / prepare:docgen | prepare | 171 | 36972 | 380668 | 5.31h | 1.32% |
| feedback:00-cheap-gates / feedback:cheap-gates | feedback | 74 | 94274 | 366833 | 3.77h | 0.94% |
| feedback:03-lint / feedback:lint | feedback | 203 | 28129 | 162467 | 3.72h | 0.93% |
| feedback:00-heavy:02-docgen / feedback:docgen | feedback | 74 | 41252 | 250771 | 2.10h | 0.52% |
| feedback:02-check / feedback:check | feedback | 205 | 11617 | 103938 | 1.97h | 0.49% |
| prepare:02-terse-effect / prepare:laws:terse-effect | prepare | 245 | 23209 | 40024 | 1.69h | 0.42% |
| feedback:01-build / feedback:build | feedback | 201 | 14348 | 83706 | 1.33h | 0.33% |
| publish:00-head-install-preflight / publish:head-install-preflight | publish | 631 | 5455 | 12150 | 1.17h | 0.29% |
| publish:00-head-install-preflight / publish:head-install-preflight | prepare | 614 | 5571 | 12202 | 1.11h | 0.28% |
| advisory:01-fallow-feedback / fallow-advisory-feedback | feedback | 1481 | 1863 | 2978 | 49.1m | 0.2% |
| prepare:01-effect-imports / prepare:laws:effect-imports | prepare | 245 | 8774 | 17451 | 40.4m | 0.17% |
| prepare:03-config-sync / prepare:config-sync | prepare | 245 | 7376 | 15025 | 33.7m | 0.14% |
| commit:01-git-commit / commit:git:commit | commit | 398 | 2700 | 4615 | 18.6m | 0.08% |
| publish:01-git-push / publish:git:push | publish | 472 | 1644 | 5491 | 16.0m | 0.07% |
| prepare:04-lint-fix / prepare:lint:fix | prepare | 171 | 3523 | 5558 | 9.6m | 0.04% |
| publish:00-head-install-preflight / publish:head-install-preflight | early-publish | 56 | 7033 | 14192 | 7.3m | 0.03% |
| feedback:00-heavy:01-lint-fix / feedback:lint:fix | feedback | 74 | 3520 | 4093 | 3.9m | 0.02% |
| monitor:01-pr-context / monitor:pr-context | monitor | 460 | 382 | 547 | 3.2m | 0.01% |
| commit:01-git-commit / commit:git:commit:amend | commit | 47 | 2608 | 4373 | 2.0m | 0.01% |
| publish:01-git-push / early-publish:git:push | early-publish | 56 | 1624 | 3281 | 1.7m | 0.01% |

## C. Attempts and first actionable failure

| Population | attempts | success | failure | starts without finish |
| --- | --- | --- | --- | --- |
| union: frozen + live overlay | 2742 | 1132 | 1610 | 327 |
| article-comparable modes/bounce filter | 1833 | 854 | 979 | n/a |

| First-failure measure | n | p50 | p95 | law |
| --- | --- | --- | --- | --- |
| failing outer-lane start offset | 832 | 9.7s | 18.9m | cumulative recorded prior wrappers |
| first actionable failure completion | 832 | 8.4m | 30.6m | offset + failing wrapper duration |
| red attempts not reconstructable | 778 | n/a | n/a | handler/no duration |

| Actionable lane | failed attempts |
| --- | --- |
| publish:00-head-install-preflight | 349 |
| monitor:02-pr-checks-watch | 237 |
| commit:01-git-commit | 207 |
| full:01-pre-push | 137 |
| unlocated | 96 |
| closeout:01-pr-context | 91 |
| quality:lint | 67 |
| quality:build | 65 |
| fallow:audit | 47 |
| full:00-cheap-gates | 38 |
| quality:changeset-status | 35 |
| quality:check | 23 |
| quality:lint-policy | 23 |
| publish:01-git-push | 18 |
| repo-sanity:fallow-boundaries-config | 17 |

## D. Receipt-matched failure proxies

| Proxy class | failed attempts | Unchanged-fingerprint claim |
| --- | --- | --- |
| unclassified | 1116 | not joinable |
| scheduler-lock-bounce | 379 | not joinable |
| stale-workspace-or-projection | 63 | not joinable |
| base-churn | 48 | not joinable |
| scheduler-or-submitter | 4 | not joinable |

| M4 field | Value |
| --- | --- |
| failed unchanged fingerprint -> next green | unmeasurable |
| per-attempt fingerprints | 0 |
| latest state files with fingerprint | 459 |
| reason | attempt rows carry head=HEAD and no diffFingerprint; state.json is one overwritten latest-green snapshot per run directory |

## E. Red-to-green episodes

| Population | n | p50 | p95 | span min | attempt-machine min | lane-machine min | right-censored |
| --- | --- | --- | --- | --- | --- | --- | --- |
| article-comparable: modes verify/repair/publish; lock bounces excluded; <=24h | 328 | 43.3m | 3.95h | 26242.81 | 11353.8 | 11066.43 | 115 |
| uncut tail: same modes/bounce rule; no duration ceiling | 335 | 43.6m | 6.12h | 43440.31 | 11785.91 | 11498.26 | 115 |

| Baseline comparison | article | current | delta | moved |
| --- | --- | --- | --- | --- |
| P50 | 41.3m | 43.3m | 2.0m | up |
| P95 | 3.10h | 3.95h | 51.1m | up |
| Raw finished attempts | 2433 | 2742 | 309 | retained sample delta |

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
| pull_request | 725 | 13.0m | 28.8m | {"cancelled":262,"failure":172,"success":291} |
| main-push | 171 | 16.5m | 35.5m | {"cancelled":12,"failure":73,"success":86} |

| Verification envelope | n | p50 | p95 | Comparability |
| --- | --- | --- | --- | --- |
| local pre-push wrapper | 1046 | 13.9m | 29.8m | local sequential/waved collector |
| local merged-preview wrapper | 15 | 21.6m | 46.1m | merged tree; child timings absent |
| hosted PR Check workflow | 725 | 13.0m | 28.8m | parallel jobs; createdAt -> updatedAt |

## G. Data quality

| Constraint | Measured fact / consequence |
| --- | --- |
| Window | 2026-08-04T12:22:57.623Z -> 2026-09-03T06:26:29.913Z |
| Frozen / live / hosted capture | 2026-09-03T02:27:19.384Z / 2026-09-03T06:29:33.572Z / 2026-09-03T06:29:38.367Z |
| Ring cap | 50 starts per branch journal; 7/295 journals at cap |
| Observed truncation lower bound | 0 attempt IDs evicted across 282 comparable journals |
| Unknown lifetime truncation | exact count unavailable; pre-capture history is absent |
| Unmatched starts | 327 |
| Cap pressure | unmatched starts consume retention slots; exact displaced terminal rows are unknowable |
| Verdict versions | v2=2742; v1/other=0 |
| Inner timings | pre-push inner states have no durationMs; merged-preview ci:local inner states are absent entirely |
| Fingerprint join | attempt rows carry head=HEAD and no diffFingerprint; state.json is one overwritten latest-green snapshot per run directory |
| Clock | all ISO timestamps normalized to UTC; admission epoch milliseconds interpreted as UTC instants |
| Hosted duration | job startedAt -> completedAt; includes job setup, excludes skipped and missing/negative intervals |
| Tier join | 206/725 PR workflows time-matched to publish attempts; 519 unmatched |
| Failed preview allocation | 2 failed merged-preview wrappers have unknown child execution sets |
| Episode tail | 7 >24h closed episodes censored only for article comparison |
| Cache | forbidden by ship-velocity C5; inputs contain no first-cold-lane task accounting |
| Inputs | 3 source files; every path and sha256_12 in economics.json |
