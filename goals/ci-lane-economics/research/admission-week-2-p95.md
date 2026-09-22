# P3 admission-week p95 census, window 2 — 2026-09-13 to 2026-09-20

## Verdict

**Admission denied. P3 and the manifest stay active.** The first complete
half-open UTC week under the ratified 17-context population,
`2026-09-13T00:00:00Z` through `2026-09-20T00:00:00Z`, was censused on
2026-09-22 with the canonical command and fails the charter on three counts:

- `Test Unit`: **22m02s p95** (effective shard critical path; 16m31s the
  prior window, p50 up from 12m20s to 17m54s).
- `Lint Policy`: **21m59s p95** (10m33s the prior window, p50 up from 8m01s
  to 16m59s).
- Shard-pickup queue tripwire: **7m47s p95** over the 5m00s limit
  (n=1105 shard pickups).

`Check`, which breached the prior window by 19s, now passes at 8m22s p95.
`Lint` clears at 13m20s effective p95. The other thirteen required lanes
pass. The context-set check passed at exactly 17 against ruleset `10240248`
version `49479116`, effective 2026-09-12T01:46:53.354Z.

## Command and reproduction

```sh
bun run beep ci lane-timings --window --workflow check.yml --event all --since 2026-09-13T00:00:00Z --until 2026-09-20T00:00:00Z --markdown
```

- The command ran with the ratified-population table introduced alongside
  this census (version 48600030 at 18 contexts, 49479116 at 17). Before that
  change it failed closed with `must expose exactly 18 required contexts;
  observed 17`, as the 2026-09-12 ledger entry predicted.
- The run used the same retrying `gh api` PATH shim as window 1; three job
  pages needed one retry each on transient TLS errors.
- Only attempt-one successful non-negative spans enter nearest-rank p50/p95.
  Failures, cancellations, reruns, invalid spans, and incomplete shard sets
  are attribution only and are tabulated below.

## Successful attempt-one durations

| Required lane | n | PR | Push | p50 | p95 | Max | P3 state |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Check | 133 | 105 | 28 | 2m24s | 8m22s | 9m20s | Pass |
| Codegen Drift | 215 | 186 | 29 | 0m19s | 3m35s | 9m13s | Pass |
| Commitlint | 210 | 182 | 28 | 1m24s | 2m12s | 2m26s | Pass |
| Docgen | 142 | 114 | 28 | 2m27s | 7m50s | 11m29s | Pass |
| Doctest | 145 | 117 | 28 | 2m23s | 4m40s | 5m20s | Pass |
| JSDoc Ratchet | 182 | 153 | 29 | 8m48s | 9m35s | 11m47s | Pass |
| Knip | 209 | 180 | 29 | 1m50s | 2m28s | 2m55s | Pass |
| Lint | 205 | 176 | 29 | 2m35s | 13m20s | 25m03s | Pass |
| Lint Policy | 96 | 72 | 24 | 16m59s | **21m59s** | 22m22s | **Breach** |
| Nix Shell | 208 | 179 | 29 | 2m09s | 3m06s | 3m56s | Pass |
| Professional Desktop IPC Stdio | 215 | 186 | 29 | 0m23s | 3m49s | 4m42s | Pass |
| Repo Sanity | 193 | 166 | 27 | 3m57s | 5m13s | 10m40s | Pass |
| SAST | 209 | 180 | 29 | 1m45s | 2m40s | 3m13s | Pass |
| Secret Scanning | 210 | 181 | 29 | 1m00s | 1m13s | 4m13s | Pass |
| Security | 207 | 180 | 27 | 0m50s | 1m25s | 2m57s | Pass |
| Test Integration | 152 | 124 | 28 | 2m15s | 3m45s | 4m33s | Pass |
| Test Unit | 164 | 136 | 28 | 17m54s | **22m02s** | 34m17s | **Breach** |

## Attempt-one failures and cancellations

| Required lane | Failures | Cancellations | Invalid spans | Incomplete shard sets |
| --- | ---: | ---: | ---: | ---: |
| Check | 15 | 45 | 0 | 0 |
| Codegen Drift | 0 | 6 | 0 | 0 |
| Commitlint | 1 | 10 | 0 | 0 |
| Docgen | 3 | 48 | 0 | 0 |
| Doctest | 0 | 48 | 0 | 0 |
| JSDoc Ratchet | 7 | 32 | 0 | 0 |
| Knip | 0 | 12 | 0 | 0 |
| Lint | 0 | 16 | 0 | 15 |
| Lint Policy | 32 | 65 | 0 | 0 |
| Nix Shell | 0 | 13 | 0 | 0 |
| Professional Desktop IPC Stdio | 0 | 6 | 0 | 0 |
| Repo Sanity | 9 | 19 | 0 | 0 |
| SAST | 0 | 12 | 0 | 0 |
| Secret Scanning | 0 | 11 | 0 | 0 |
| Security | 4 | 10 | 0 | 0 |
| Test Integration | 0 | 41 | 0 | 0 |
| Test Unit | 8 | 49 | 0 | 15 |

## Later attempts

| Required lane | Success | Failure | Cancelled |
| --- | ---: | ---: | ---: |
| Check | 10 | 0 | 0 |
| Codegen Drift | 10 | 0 | 0 |
| Commitlint | 10 | 0 | 0 |
| Docgen | 8 | 2 | 0 |
| Doctest | 10 | 0 | 0 |
| JSDoc Ratchet | 10 | 0 | 0 |
| Knip | 10 | 0 | 0 |
| Lint | 10 | 0 | 0 |
| Lint Policy | 6 | 3 | 1 |
| Nix Shell | 10 | 0 | 0 |
| Professional Desktop IPC Stdio | 10 | 0 | 0 |
| Repo Sanity | 10 | 0 | 0 |
| SAST | 10 | 0 | 0 |
| Secret Scanning | 10 | 0 | 0 |
| Security | 10 | 0 | 0 |
| Test Integration | 10 | 0 | 0 |
| Test Unit | 8 | 2 | 0 |

Queue tripwire: **Breach** — shard pickup p95 7m47s > 5m00s (n=1105).

## Attribution notes

- `Test Unit` regressed at the median, not only the tail: p50 17m54s against
  12m20s one window earlier, with a 34m17s maximum. The three-shard design
  from `repair-decision.md` projected 16m30s p95; the shard table has not
  been rebalanced since PR #982, so growth in the `@beep/repo-cli` suite (its
  own shard) is the first attribution candidate.
- `Lint Policy` doubled at the median (8m01s to 16m59s) and is the C4 debt the
  package-task migration packet already names as wall-clock work; it has no
  signed repair in this packet.
- `Check` recovered without a repair (p50 13m30s to 2m24s), consistent with
  the prior window's tail being a lane-wide cold-cache episode rather than a
  placement fault.
- The pickup tripwire remains breached on free hosted runners in both windows
  (8m22s, then 7m47s), so shard margins stay thinner than their projections.

## Consequences

- P3 stays `in progress`; `ops/manifest.json` stays `active`.
- The 17-context population is ratified and the census accepts it, so the
  next window needs no population work unless the ruleset changes again.
- Signed repair decisions are owed for `Test Unit` (rebalance or re-shard
  against the current task universe), `Lint Policy`, and the shard-pickup
  queue before the next half-open week is censused.
