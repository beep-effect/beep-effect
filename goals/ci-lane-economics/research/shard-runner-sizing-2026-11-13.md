# Shard runner sizing, 2026-11-13

Sizing asked for by the operator before any change to the self-hosted runner cap. Nothing in AWS or in a
workflow was changed to produce it.

## Data

Attempt-one job timings of all 378 `check.yml` runs created from `2026-11-10T04:00Z` to `2026-11-13T06:00Z`,
read from the Actions jobs endpoint (one malformed listing dropped). Peak CI-active branches on those days
were 8, 9 and 17; 2026-11-11 had no runs. A shard is a `Test Unit (…)`, `Test Integration (…)` or
`Property Laws (…)` job.

| Measure | Value |
| --- | ---: |
| Hosted jobs with a complete span | 13,707 |
| Shard jobs | 6,613 |
| Shard body, all three days | 669.2 h |
| Shard body per day (11-10, 11-12, 11-13 to 06:00Z) | 267.0 h, 136.6 h, 265.5 h |
| Shard body p50 / p95 | 6m20s / 8m22s |
| Shard pickup on hosted runners p50 / p95 | 2m27s / 12m33s |
| Hosted body, every job | 833.0 h |
| Peak hosted jobs running at once | 103 |

Spot prices read the same day for the pool's instance types (`r7a`, `r7i`, `r6i` `.2xlarge`; `m7a`, `m7i`,
`m6a`, `m6i` `.4xlarge`), us-east-1, by zone: $0.14 to $0.69 per hour, most zones $0.19 to $0.30. The
account's standard spot quota is 512 vCPU: 64 of the 8-vCPU types.

## Model

Jobs replay in creation order through a first-come queue. A job on the self-hosted pool costs a 90 s VM
boot, its measured hosted body and 30 s of teardown; one job per VM, as the fleet runs today. The hosted
pool is modelled as 60 servers, which reproduces the observed shard pickup (model p95 14m27s against
12m33s measured) although 103 jobs were seen running at once.

Limits: three days of data; bodies were measured on 4-vCPU hosted runners and the pool's VMs have 8 or 16
vCPU, so a shard may run faster there and two shards per VM would roughly halve the VM-hours; spot capacity
for 80 or more simultaneous VMs is untested.

## Every shard on the self-hosted pool

| Runner cap | Pickup p50 | Pickup p95 | Max |
| ---: | ---: | ---: | ---: |
| 16 | 8h45m | 21h00m | 23h04m |
| 32 | 2h09m | 6h25m | 7h08m |
| 48 | 28m44s | 2h01m | 2h15m |
| 64 | 4m32s | 13m35s | 21m54s |
| 96 | 1m30s | 5m10s | 9m52s |

889.6 VM-hours over about 2.3 days of activity. At $0.19 to $0.30 an hour that is about $75 to $115 on a
heavy day: $1,500 to $2,300 a month at twenty such days. The fleet's signed budget is $100 a month projected and a
$200 ceiling (`goals/ci-fleet-endgame/research/runner-endgame-decision-record.md`). A cap of 96 does not fit
the spot quota.

## Overflow only

Shards stay on hosted runners; a shard goes to the self-hosted pool only when its projected hosted wait
exceeds a threshold.

| Threshold | Shards sent | VM-hours | Peak VMs | Shard pickup p95 | Any job, pickup p95 | Max |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| never (today) | 0 | 0 | 0 | 14m27s | 14m23s | 23m25s |
| 10 min | 433 | 52.7 | 78 | 8m21s | 9m03s | 11m34s |
| 5 min | 1,063 | 135.2 | 128 | 4m10s | 4m54s | 7m07s |
| 2 min | 1,810 | 237.7 | 152 | 1m34s | 2m25s | 5m33s |
| 0 | 2,785 | 363.3 | 176 | 1m30s | 1m30s | 2m45s |

At the 10-minute threshold: about $4.40 to $6.90 a heavy day (the same 2.3 days), $130 to $210 a month if
every day were as heavy as these. At 5 minutes: $350 to $550 a month.

### Overflow inside the spot quota

78 VMs of the 8-vCPU types is 624 vCPU, over the 512-vCPU quota, and the Heavy lanes draw on the same pool.
The same 10-minute threshold with a bounded overflow pool; a shard that finds the pool full stays in the
hosted queue:

| Overflow cap | vCPU at 8 per VM | Shards sent | VM-hours | Shard pickup p95 | Any job, pickup p95 | Max |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 32 | 256 | 277 | 40.5 | 8m59s | 9m29s | 13m45s |
| 48 | 384 | 300 | 43.8 | 8m43s | 9m20s | 12m52s |
| 60 | 480 | 336 | 48.4 | 8m34s | 9m14s | 12m02s |
| 64 | 512 | 348 | 49.9 | 8m30s | 9m12s | 11m45s |
| unbounded | 648 at peak | 384 | 54.1 | 8m21s | 9m05s | 11m16s |

(The unbounded row differs slightly from the table above because a shard is sent only when a VM is free at
its creation.) A cap of 48 overflow VMs keeps 128 vCPU, sixteen VMs, for the Heavy lanes and costs 22 s of
pickup p95 against no cap. The count holds only for the 8-vCPU instance types; a 16-vCPU type counts double.

## Reading

Hosted runners supply the 669 hours free and are idle most of the day; the queue is a burst problem. Paying
for every shard buys back the bursts at ten to twenty times the fleet's budget. Paying only for the overflow
costs what the budget already allows. About a quarter of the shard hours is per-job setup (75 to 100 s per
shard), which a hosted job diet reduces at no cost.
