# Required-lane placement decision — 2026-08-13

## Decision

**REVISED AFTER P2 ADMISSION.** Keep the current placement for all required
contexts. The proposed `Test Integration` move from `beep-ec2-heavy` to
`ubuntu-24.04` was live-falsified by runner shutdowns on both its attempt-one
job and targeted retry, so the documented rollback restores its existing fleet
placement. De-duplicate `Lint` from `Lint Policy` at the CI lane boundary, and
keep `Coverage Regression` on the fleet while its PR scope and full-run
sharding are implemented. No lane moves onto the fleet.

Signed: **Codex, execution agent, 2026-08-13**

Revised after live admission: **Codex, execution agent, 2026-08-13**

The decision uses the attempt-one cache-warm census in
`cache-warm-lane-census.md`. The source of truth for required contexts is live
ruleset `10240248`; `JSDoc Ratchet` remains visible but is not currently a
required context.

## Placement table

| Required context | Current | Decision | p95 | P2 action |
| --- | --- | --- | ---: | --- |
| Lint | hosted | hosted | 24.3m | Keep the free runner; run only the Turbo package lint graph because required `Lint Policy` already owns the repo-policy battery. |
| Lint Policy | fleet | fleet | 20.6m | Retain. #678 moved the post-change samples to 10.4-10.9m; re-measure instead of buying more capacity. |
| Check | fleet | fleet | 16.0m | Retain; no hosted shadow proves that the memory-heavy graph can safely re-fit. |
| Test Unit | hosted | hosted | 17.6m | Retain. |
| Test Integration | fleet | fleet | 6.8m | Retain. The hosted re-fit hypothesis had strong historical cache evidence but failed live admission twice with runner shutdowns; jobs `94525310886` and `94533388363` falsify it. |
| Docgen | fleet | fleet | 13.4m | Retain; `uses_turbo: false`, so there is no cache-backed re-fit case. |
| Codegen Drift | hosted | hosted | 3.3m | Retain. |
| Repo Sanity | hosted | hosted | 4.1m | Retain. |
| Coverage Regression | fleet | fleet | 29.5m | Keep one fleet placement. Use exact directly changed coverage owners on PRs with an explicit full fallback; prebuild once and run nine stable weighted in-job shards with coverage-only file parallelism. Give the two measured long poles two workers and the seven mixed shards one each. |
| Knip | hosted | hosted | 3.1m | Retain. |
| Commitlint | hosted | hosted | 1.8m | Retain. |
| Secret Scanning | hosted | hosted | 1.0m | Retain. |
| Security | hosted | hosted | 1.8m | Retain. |
| SAST | hosted | hosted | 2.3m | Retain. |
| Nix Shell | hosted | hosted | 1.9m | Retain. |
| Professional Desktop IPC Stdio | hosted | hosted | 1.5m | Retain. |

## Cost gate

- New fleet jobs per wave: **0**.
- Fleet jobs removed per wave: **0**.
- Incremental projected fleet spend: **$0/month** against the pre-packet placement.
- Governing projection: the signed **$100/month** standing projection remains
  the conservative upper bound because this decision adds no fleet work.
- Absolute ceiling: **$200/month** remains a hard stop. No Coverage shard may
  add a VM until its per-wave and monthly projection is recorded here. The
  successor uses nine package queues inside the existing one-job/one-VM
  boundary with an aggregate cap of 11 Vitest workers, so it adds no job, VM,
  or projected monthly spend.

The census measures job wall time rather than controller boot/billing time.
The failed hosted admission creates no standing fleet delta: retaining the
pre-packet placement cannot raise the approved projection.

## Safety and falsification

- The workflow's fork-PR approval, read-only PR cache, trusted-push cache-write
  environment, IAM, egress, and teardown paths are unchanged.
- The failed `Test Integration` experiment kept the same CLI lane, affected
  graph, remote-cache inputs, database setup, and required context name; only
  `runs-on` changed. The rollback restores the original runner label.
- `bun run lint` keeps its existing full local contract. Only
  `beep ci lane lint` stops duplicating checks already enforced by the separate
  required `Lint Policy` context.
- The hosted re-fit rollback has fired: two independent GitHub-hosted runners
  shut down during the verification step, terminating in-flight tasks with
  exit 137.
- Reject the Coverage redesign if a selected package can omit a summary, a
  current true regression turns green, or a full-fallback input selects less
  than the present full package set.
- The five-shard admission was rejected after live job `94583467537` passed in
  22m18s: aggregate five-way coverage contention stretched the isolated
  `@beep/repo-cli` shard to 20m16s. The revised four-shard candidate matches the
  fleet's accepted Turbo concurrency.
- The first four-shard admission was rejected after job `94608048289` failed
  in 24m10s. The three mixed shards passed in 15m30s-16m46s, but unbounded
  Vitest subprocess fan-out starved the sequential `@beep/repo-cli` shard: it
  took 19m13s and failed ten 5-second timeout tests plus one 1-second timing
  assertion. Capping every shard's Vitest pool at two workers repaired those
  failures, but retry job `94625871718` then passed in 23m23s: its 3m38s
  prebuild was followed by four green shards at 15m32s-18m23s. The next
  candidate raised the cap to three workers per shard, but live job
  `94641084512` failed after 23m08s. Three mixed shards passed in
  16m05s-17m16s; the repo-cli shard failed at 18m16s when contention pushed a
  bounded-work assertion over its ceiling. Its config disables file
  parallelism, so the higher cap could not shorten 728.76 seconds of serial
  imports. The next candidate uses five shards, explicitly enables file
  parallelism on the full-coverage path, and restores the two-worker cap.
- Reject or roll back the file-parallel five-shard admission if the existing
  32-GB fleet runner shuts down, exhausts memory, or the complete required job
  remains at or above 20 minutes. The design raises in-job package concurrency,
  not fleet job count.
- The two-worker candidate passed its forced local full-path proof but its live
  retry proved correctness while rejecting timing. The three-worker revision
  then passed a fresh forced local proof with remote cache disabled: all 128
  prebuild tasks in 21.4 seconds, four green shards at 5m43s-6m32s, and all
  124 summaries accepted by the ratchet. The three-worker candidate then failed
  live. Coverage-only repo-cli probes established the new boundary: 90 files
  and 1,514 tests passed at both three workers (141.26s) and two workers
  (200.86s), with identical coverage and no exclusions. After `origin/main`
  advanced twice, the rebased five-shard candidate passed a fresh forced local
  full-path proof on exact base `9c621da122`: a zero-cache 128-task prebuild in
  2m36s, five green zero-cache shards at 3m45s-7m26s, and all 126 baseline
  packages accepted by the ratchet. The live fleet remains the timing and
  admission authority.
- Final PR #707 job `94664247028` passed the five-shard design without test,
  ratchet, shutdown, or OOM failures, but the complete job still took 23m14s.
  Its 3m39s prebuild was followed by green shards at 12m03s, 15m13s, 15m46s,
  18m15s, and 17m39s. That rejects the merged candidate's timing. The successor
  uses the same aggregate worker cap, isolates both live long poles, and
  redistributes the remaining tail from four two-worker queues into six
  one-worker queues. Reject it if the complete hosted job remains at or above
  20 minutes or correctness/resource behavior regresses.
- The successor passed its forced local full path on exact base `93e403dac2`:
  a 55-second, 128-task zero-cache prebuild; eight green zero-cache shards at
  3m21s-5m59s; and all 126 baseline packages accepted by the ratchet. There was
  no test failure, shutdown, or OOM. This accepts local correctness/resource
  behavior; only the live fleet job may accept timing.
- PR #716 run `31777323977`, job `94695402310`, accepted the eight-shard
  candidate's correctness but rejected its timing at 22m18s. The 3m30s
  prebuild was followed by isolated long-pole shards at 11m01s and 13m08s,
  while the six mixed shards controlled the tail at 15m51s-17m27s. No test,
  ratchet, shutdown, or OOM failure occurred. The next candidate adds one
  mixed queue and one bounded worker, yielding nine shards with aggregate
  Vitest fan-out 11; reject it if the complete hosted job remains at or above
  20 minutes or correctness/resource behavior regresses.
- The nine-shard candidate passed its forced local full path on exact base
  `a10825dd01`: a 54-second, 130-package zero-cache prebuild; nine green
  zero-cache shards at 3m09s-6m00s; and all 127 baseline packages accepted by
  the ratchet. The complete path took 6m55s with no test failure, shutdown, or
  OOM. This accepts local correctness/resource behavior; only the live fleet
  job may accept timing.
- PR #719's first nine-shard job `94746974171` failed after 22m26s. Its 3m35s
  zero-cache prebuild passed, seven mixed shards passed in 15m37s-17m30s, and
  no runner shutdown or OOM occurred. The isolated repo-utils and repo-cli
  shards exposed one shared Node coverage `Bun.Glob` shim defect: statically
  rooted patterns still scanned the whole repository and raced teardown of
  temporary Biome directories. Bounding scans to their static roots and
  treating disappearing directories as empty branches made the exact failing
  coverage files pass in 4.74s and 7.79s. Exclude the failed attempt from the
  percentiles and require a fresh full-path proof plus live admission on the
  repaired nine-shard head.
- The repaired nine-shard head passed that forced local full path on exact base
  `a10825dd01`: a 24-second, 128-task zero-cache prebuild; nine green zero-cache
  shards at 31s-6m07s; and all 127 baseline packages accepted by the ratchet.
  The complete summary window took 6m31s. This re-accepts local
  correctness/resource behavior; only the next live fleet job may accept
  timing.

## P2 live admission evidence

| Run / job | Placement | Result | Attribution | Treatment |
| --- | --- | --- | --- | --- |
| `31723283969` / `94525310886` | `ubuntu-24.04` | Failed after 10m25s | GitHub-hosted runner received a shutdown signal; the verification step was cancelled and four in-flight Turbo tasks exited 137. This was not the workflow's 40-minute timeout or a test assertion failure. | Track as an infrastructure failure and exclude from duration percentiles. Targeted retry required. |
| `31723283969` attempt 2 / `94533388363` | `ubuntu-24.04` | Failed after 11m21s | A different GitHub-hosted runner received the same SIGTERM during the verification step after 8m05s of Turbo work. Tests emitted before termination passed; two remaining builds exited 137. | Repeated shutdown falsifies the hosted re-fit and fires the rollback. Exclude from duration percentiles. |
| `31727475076` / `94539333691` | `beep-ec2-heavy` | Passed after 28m23s | Accepted rollback head; Coverage itself ran 227 tasks with zero cache hits in 27m02s and compared all 124 packages. | Confirms correctness and the structural p95 breach; supplies the weights for the in-job shard admission. |
| `31740786046` / `94583467537` | `beep-ec2-heavy` | Passed after 22m18s | Five-shard candidate compared all 124 packages without shutdown/OOM, but four mixed shards took 14m59s-15m54s and isolated `@beep/repo-cli` took 20m16s under five-way contention. | Reject the five-shard timing admission; exclude it from the accepted P3 population and test four shards at the fleet's accepted concurrency. |
| `31748322804` / `94608048289` | `beep-ec2-heavy` | Failed after 24m10s | The prebuild took 3m32s and three shards passed in 15m30s-16m46s. The `@beep/repo-cli` shard took 19m13s and failed contention-sensitive timeouts because each co-resident Vitest process still sized itself from the whole host. | Reject the unbounded four-shard admission; exclude it from duration percentiles and admit the four-shard/two-worker candidate. |
| `31753283207` / `94623544457` | `beep-ec2-heavy` | Failed after 1m26s | The cold prebuild emitted impossible missing-export diagnostics after five successful tasks. A clean detached build of the exact merge ref then passed 128/128 tasks with zero cache hits in 1m03s. | Attribute as a hosted cold-build flake, exclude from duration percentiles, and require a targeted retry. |
| `31753283207` attempt 2 / `94625871718` | `beep-ec2-heavy` | Passed after 23m23s | The two-worker cap eliminated the contention-sensitive failures and compared all 124 packages. The 3m38s prebuild plus four green shards at 15m32s-18m23s still exceeded the charter. | Reject the uniform two-worker timing admission; exclude it from the accepted P3 population and admit the smallest bounded increase, three workers per shard. |
| `31759003628` / `94641084512` | `beep-ec2-heavy` | Failed after 23m08s | The 3m30s prebuild led into three green shards at 16m05s-17m16s. The repo-cli shard failed after 18m16s when a bounded-work assertion measured 1026.30ms against 1000ms; no OOM or runner shutdown occurred. | Reject the uniform three-worker admission and exclude it from duration percentiles. Enable file parallelism only for full coverage, restore two workers, and use five weighted shards to reduce the mixed-shard long poles. |
| `31766791221` / `94664247028` | `beep-ec2-heavy` | Passed after 23m14s | The file-parallel five-shard design passed every test and compared all 126 baseline packages without shutdown/OOM. A 3m39s zero-cache prebuild preceded green shards at 12m03s-18m15s; the complete verification step took 22m00s. | Accept correctness but reject timing. Exclude it from the accepted P3 population; preserve its aggregate worker cap while splitting the three mixed queues into six independently draining queues. |
| `31777323977` / `94695402310` | `beep-ec2-heavy` | Passed after 22m18s | The eight-shard design passed every check and the complete ratchet without shutdown/OOM. Its 3m30s prebuild preceded isolated long-pole shards at 11m01s and 13m08s, but the six mixed queues drained in 15m51s-17m27s and controlled wall time. | Accept correctness but reject timing. Exclude it from the accepted P3 population; split the mixed tail into seven queues with one additional bounded worker. |
| `31794013295` / `94746974171` | `beep-ec2-heavy` | Failed after 22m26s | The 3m35s prebuild passed 128/128 tasks and seven mixed shards passed in 15m37s-17m30s. The repo-utils and repo-cli shards failed because the Node coverage Glob shim repeatedly traversed unrelated repository paths and raced temporary-directory teardown; no runner shutdown or OOM occurred. | Reject correctness and timing, exclude the attempt from duration percentiles, repair the shared test infrastructure, and require a fresh nine-shard admission. |
| `31799253491` / `94763099702` | `beep-ec2-heavy` | Failed after 1m27s | The cold prebuild repeated the impossible `thunk.ts is not a module` cascade before any shard started. The exact merge ref passed 128/128 forced build tasks with zero cache hits in 1m03s; its trace showed `@beep/ontology-config` recursively building Schema -> Data -> Utils beside Turbo's own `@beep/utils` task because of an unused project reference. After that reference was removed, the same forced zero-cache build passed 128/128 tasks in 56.2s without the nested Schema -> Data -> Utils build. | Exclude from duration percentiles, remove the stale project reference so Turbo owns cross-package ordering, and require a fresh live admission. |
