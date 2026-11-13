# 24 h hub baseline, 2026-11-12T21Z to 2026-11-13T21Z

This is the "Baseline recorded" deliverable of `SPEC.md` and the "before" number for
[`github-state-worker`](../../github-state-worker/README.md) and
[`yeet-monitor-app-identity`](../../yeet-monitor-app-identity/README.md).

## Method

- **Window.** 24 complete hours, 2026-11-12T21:00Z to 2026-11-13T21:00Z, on the hub (DankStation). Raw rows cover
  every hour of the window, and the 5-minute `/rate_limit` sampler timer ran throughout.
- **Source.** `bun run beep github ledger report --since 24h --json` on the hub, at `main` 5d1f31b2329, which
  includes the v3 per-window GraphQL accounting (#3247). Rollups are `github-ledger-rollup/v3`, recomputed from raw
  rows.
- **Calibration.** `bun run beep github ledger calibrate` ran once on the hub at about 2026-11-13T21:35Z (6 pairs, 6 GraphQL
  points). The median `|restUsed - graphqlUsed|` drift is 0, so sample-basis `graphql` readings are admitted. Two of the
  six pairs drifted 238 and 255 points. In those pairs the GraphQL `rateLimit` query read the token's second
  concurrent GraphQL window (decision 2026-11-13 "GraphQL windows are reset-scoped instances") while REST reported
  the first.
- **Fleet hosts (A19).** The same report ran once at the end of the window on `tbk-worker` and `dankserver` (each on
  a clean `main` checkout carrying #3247) over the ordinary worker SSH wrappers. `tom-pc-1-wsl` has no ledger, so it
  made no repo-tooling GitHub requests with ledger code in the window. `beep-worker` and `grok-bot` were not
  reached. Any spend there stays in the hub's unattributed remainder and so counts against T3, which makes the bound
  conservative.
- **Units.** `fleetUsed` is the identity's fleet-wide `used` rise in the hour, summed over that hour's window
  instances. `+` marks a lower bound (a window that began before the hour, or a reset crossing). `est` is this
  host's attributed in-process points, and `gh` is the gh-spawn estimate at one point per spawn (calibrated pairs
  stay at nominal). `unattr = fleetUsed - est - gh`. Only one identity, `user:kriegcloud`, spent in the window.

## Totals (24 h, `user:kriegcloud`)

| Resource | fleetUsed | per hour (mean / median / p90 / max) | hub requests | hub est | hub gh spawns | other hosts est+gh | unattributed |
| --- | ---: | --- | ---: | ---: | ---: | ---: | ---: |
| `graphql` (points) | 66,701 | 2,779 / 2,495 / 5,197 / 5,569 | 8,162 | 15,864 | 20,732 | 859 | 30,105 (45%) |
| `core` (requests) | 69,263 | 2,886 / 2,652 / 4,580 / 7,941 | 34,843 | 34,218 | 8,152 | 1,051 | 26,893 (39%) |
| `search` | 3 | 0 / 0 / 0 / 3 | 0 | 0 | 0 | 0 | 3 |

GraphQL is lower-bounded in 4 hours (11-12T21 to 11-13T01) and core in 16. Every other resource, such as
`integration_manifest`, `code_search` or `dependency_snapshots`, used 0. A window's `fleetUsed` above 5,000 in one
hour is possible because one token reads two concurrent GraphQL windows.

## Per command, 24 h (hub)

| Command | GraphQL points (transport) | GraphQL gh spawns | core requests | core gh spawns |
| --- | ---: | ---: | ---: | ---: |
| `yeet monitor` | 13,590 | 20,304 | 21,705 | 7,498 |
| `yeet gate-table` | 1,256 | 0 | 4,454 | 0 |
| `yeet merge-gate` | 372 | 0 | 3,246 | 186 |
| `ci certainty` | 0 | 0 | 1,881 | 0 |
| `yeet open` | 219 | 24 | 1,422 | 143 |
| `ci lane-timings` | 0 | 0 | 1,231 | 0 |
| `yeet ready` | 485 | 494 | 638 | 603 |
| `yeet publish` | 90 | 0 | 558 | 0 |
| `yeet sweep` | 54 | 362 | 479 | 0 |
| `goals completion refresh` | 20 | 0 | 476 | 0 |
| `yeet reply` | 314 | 64 | — | — |
| `yeet gh pr` | 16 | 0 | 301 | 0 |
| `yeet closeout` | 61 | 96 | 45 | 8 |

`yeet monitor` accounts for 93% of the hub's attributed GraphQL points and 67% of its attributed core requests.

## Hourly

`mon` is the number of distinct `yeet monitor` processes with rows in the hour. `hosts` is tbk-worker plus
dankserver GraphQL est+gh. `resid` and `share` are the T3 bound below.

| Hour (Z) | mon | gql fleet | gql req | gql est | gql gh | gql unattr | core fleet | core req | core est | core gh | core unattr | search | hosts | resid | share |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 11-12T21 | 8 | 1204+ | 90 | 167 | 217 | 820 | 1084 | 300 | 271 | 138 | 675 | 0 | 17 | 803 | 67% |
| 11-12T22 | 8 | 1539+ | 165 | 317 | 468 | 754 | 1040 | 643 | 619 | 191 | 230 | 0 | 27 | 727 | 47% |
| 11-12T23 | 17 | 2130+ | 212 | 390 | 569 | 1171 | 1356 | 826 | 800 | 203 | 353 | 0 | 34 | 1137 | 53% |
| 11-13T00 | 17 | 2921 | 343 | 657 | 966 | 1298 | 2581 | 1576 | 1550 | 384 | 647 | 0 | 48 | 1250 | 43% |
| 11-13T01 | 26 | 2477+ | 255 | 475 | 709 | 1293 | 3129 | 2083 | 2056 | 242 | 831 | 0 | 37 | 1256 | 51% |
| 11-13T02 | 18 | 1833 | 277 | 521 | 764 | 548 | 1944 | 958 | 933 | 289 | 722 | 0 | 28 | 520 | 28% |
| 11-13T03 | 22 | 2382 | 379 | 723 | 1035 | 624 | 2723 | 1498 | 1472 | 394 | 857 | 0 | 28 | 596 | 25% |
| 11-13T04 | 26 | 3471 | 547 | 1058 | 1570 | 843 | 4046 | 1870 | 1844 | 580 | 1622 | 0 | 2 | 841 | 24% |
| 11-13T05 | 26 | 3192 | 394 | 739 | 1000 | 1453 | 3405+ | 2053 | 2027 | 452 | 926 | 0 | 43 | 1410 | 44% |
| 11-13T06 | 20 | 4529 | 535 | 1056 | 1422 | 2051 | 4525+ | 2321 | 2293 | 612 | 1620 | 0 | 16 | 2035 | 45% |
| 11-13T07 | 20 | 4360 | 552 | 1096 | 1523 | 1741 | 3982+ | 2029 | 2002 | 577 | 1403 | 0 | 0 | 1741 | 40% |
| 11-13T08 | 20 | 5485 | 697 | 1385 | 1708 | 2392 | 4604+ | 2661 | 2634 | 674 | 1296 | 0 | 0 | 2392 | 44% |
| 11-13T09 | 22 | 5569 | 727 | 1439 | 1781 | 2349 | 4363+ | 2696 | 2670 | 715 | 978 | 0 | 0 | 2349 | 42% |
| 11-13T10 | 24 | 5484 | 752 | 1488 | 1908 | 2088 | 7941+ | 2845 | 2819 | 702 | 4420 | 0 | 0 | 2088 | 38% |
| 11-13T11 | 19 | 4214 | 581 | 1157 | 1456 | 1601 | 4008+ | 2585 | 2559 | 535 | 914 | 0 | 0 | 1601 | 38% |
| 11-13T12 | 12 | 2970 | 387 | 758 | 867 | 1345 | 4496+ | 1512 | 1486 | 306 | 2704 | 0 | 88 | 1257 | 42% |
| 11-13T13 | 10 | 2512 | 253 | 500 | 576 | 1436 | 2071+ | 1176 | 1150 | 208 | 713 | 0 | 122 | 1314 | 52% |
| 11-13T14 | 4 | 1601 | 95 | 183 | 187 | 1231 | 1561+ | 885 | 859 | 87 | 615 | 3 | 114 | 1117 | 70% |
| 11-13T15 | 6 | 1484 | 128 | 247 | 261 | 976 | 941+ | 696 | 672 | 118 | 151 | 0 | 0 | 976 | 66% |
| 11-13T16 | 3 | 882 | 93 | 183 | 247 | 452 | 1683+ | 436 | 409 | 71 | 1203 | 0 | 30 | 422 | 48% |
| 11-13T17 | 7 | 1327 | 138 | 265 | 309 | 753 | 1246+ | 637 | 611 | 131 | 504 | 0 | 120 | 633 | 48% |
| 11-13T18 | 6 | 1286 | 102 | 201 | 242 | 843 | 1249+ | 487 | 461 | 90 | 698 | 0 | 34 | 809 | 63% |
| 11-13T19 | 7 | 847 | 69 | 128 | 134 | 585 | 623+ | 382 | 358 | 55 | 210 | 0 | 0 | 585 | 69% |
| 11-13T20 | 14 | 3002 | 391 | 731 | 813 | 1458 | 4662+ | 1688 | 1663 | 398 | 2601 | 0 | 71 | 1387 | 46% |

## The 430 vs 720-1,440 GraphQL/h conflict

Resolved: the reduction plan's per-monitor figure was too high, and the 430/h sample was consistent with it.

- Over the window, 362 monitor process-hours spent 13,590 transport points plus 20,304 gh-spawn estimates, about
  **94 GraphQL points per monitor process-hour** (roughly 38 transport and 56 gh). This is a lower bound on a
  full-hour monitor, since a process present for part of an hour still counts as one.
- The reduction plan's 720-1,440 GraphQL/h per monitor overstated that rate 8 to 15 times. The 2026-11-09 sample
  (2-3 monitors, about 430 GraphQL/h fleet-wide, read over 10 minutes just after a reset) implies about 190-280
  points/h of monitor spend and 150-240 points/h of everything else. That is below this window's quietest
  unattributed hour (452), which fits a short sample right after a reset, not a wrong monitor rate.
- What the fleet number does show is scale: with 15 monitors per hour on average (peak 26), monitors alone spend
  about 1,400 points/h. Hours with 20 or more monitors (11-13T04 to T10) put the token's GraphQL use at 3,471 to
  5,569 points/h, at or above a single 5,000-point window. That is the load `github-state-worker` removes.

## T3 share bound (A19)

Per hour, `T3 + uncovered <= fleetUsed(hub, graphql) - (hub est + hub gh) - sum over hosts (est + gh)`, floored at 0.
The share is that residual over `fleetUsed`.

- **Residual median 1,194 points/h**: 24% of one 5,000-point window.
- **Share: hourly median 45.6%, p90 66.4%**, over 24 complete hours, ranging from 24% to 70%.
- This is an upper bound, not a T3 measurement. The residual also holds raw agent `gh` and `gh api` calls made
  outside repo tooling, by Claude, Codex and T3 sessions on every host, plus fleet hosts not reached here
  (beep-worker, grok-bot), lower-bound hours, and the gh-spawn estimate's error (one point per spawn understates
  `gh pr view --json` reads that cost more).
- Known in-repo leaks, listed so they are not read as T3 (design section 4.4, "Not covered"). Only the first can
  touch the user bucket:
  - `skills` install REST reads (`Skills.service.ts`), user bucket only when `GITHUB_TOKEN` is set; rare.
  - `skills` git tree read, the App-manifest conversion, the VersionSync Effect/Bun resolvers and the CLDR
    territories sync: all anonymous per-IP.
  - The `reviewer token` App JWT mint: its own bucket, row identity `unresolved`.

The threshold that fires `t3-snapshot-consumer` is recorded in decision 2026-11-13 "T3 share threshold".

## Reproduce

```sh
bun run beep github ledger report --since 24h --json > hub.json   # on the hub, and once per fleet host
bun run beep github ledger calibrate                              # once; 6 GraphQL points
```

The JSON reports contain labels, counts and command names only. They are not committed (3.4 MB for the hub); raw
rows age out after 72 h, and the hourly rollups behind these tables are kept for 35 days.
