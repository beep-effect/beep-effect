# Lint and Test Unit tail attribution — 2026-09-03

## Scope and reading

This report decomposes every successful attempt-one `Lint` and `Test Unit`
job at or above its nearest-rank p90 in both the representative week and the
first complete current-ruleset week. Failed, cancelled, and later attempts
never enter these percentiles. Pickup is `created_at` to `started_at` and is
reported but excluded from job wall time (`started_at` to `completed_at`).

| Week | Lane | Population | p90 | Tail jobs | Cleanup p50/p95 | Setup p50/p95 | Body p50/p95 | Cache-hit p50 | Causes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Representative | Lint | 435 | 20m00s | 46 | 1m21s / 5m34s | 0m40s / 1m00s | 18m12s / 19m15s | 0 | B:7, A:39 |
| Representative | Test Unit | 379 | 22m04s | 38 | 1m20s / 3m31s | 0m39s / 1m02s | 20m49s / 22m29s | 0 | A:37, C:1 |
| Current ruleset | Lint | 477 | 20m10s | 48 | 1m15s / 2m02s | 0m43s / 1m01s | 18m41s / 20m25s | 0 | A:44, B:4 |
| Current ruleset | Test Unit | 388 | 23m16s | 39 | 1m13s / 3m42s | 0m45s / 1m15s | 22m25s / 25m55s | 0 | A:39 |

Cause codes are exclusive dominant-cause classifications:

- **A:** at least 75% Turbo misses plus a changed root/lock input.
- **B:** at least 75% misses without a root input change: an unwarmed/read-only PR head.
- **C:** one package, specifically `@beep/repo-cli#test`, occupies at least 35% of the body.
- **D:** concurrency-two starvation with independently observed idle CPU.
- **E:** cleanup plus setup consumes at least 25% of wall time.
- **F:** residual runner variance or throttling after the preceding tests.

No p90-tail job required D, E, or F to explain it. The Actions jobs/log APIs
carry no CPU-utilization series, so D is not inferred from concurrency two
alone. Every current Test Unit tail and 44/48 current Lint tails are A; the
remaining four Lint tails are B. Current-tail cache-hit p50 is zero in both
lanes. Root changes affected 83/87 current tail jobs; `bun.lock` changed in
29/48 Lint and 29/39 Test Unit tails.

The current Lint p95 spends 19m26s in the body and only 32s in cleanup; even
perfectly deleting cleanup leaves 20m28s. The current Test Unit p95 spends
23m11s in the body and 33s in cleanup. Cleanup is useful margin, not the
primary repair. At the current tail, cleanup p95 is 2m02s for Lint and 3m42s
for Test Unit; setup p95 is 1m01s and 1m15s respectively.

The cleanup logs also provide a live disk census. Across all 48 current Lint
tails and 39 current Test Unit tails, the 145 GiB root volume had 86 GiB
minimum free before cleanup (86 GiB p50, 87 GiB p95/max). Cleanup reclaimed
21 GiB minimum/p50 and 22 GiB p95/max. A guarded skip when pre-clean free space
is at least 64 GiB therefore preserves at least 22 GiB beyond the largest
observed reclaim while recovering 1m15s p50/2m02s p95 for Lint and 1m13s
p50/3m42s p95 for Test Unit. The repair does not rely on that saving to make
the shard critical paths pass; falling back to cleanup below the threshold is
safe.

## Per-package partition evidence

The current tail logs expose 134 task ids per lane. Per-task weights are the
nearest-rank p95 of cold-miss log spans; LPT means deterministic
largest-processing-time-first placement with task id as the tie-breaker.

| Lane | Cold p95-weight sum | Proposed bins | Bin weights | Largest task |
| --- | ---: | ---: | --- | --- |
| Lint | 37m46s | 2 | 67 tasks / 18m52s; 67 tasks / 18m54s | `@beep/repo-cli#lint` 0m22s |
| Test Unit | 55m07s | 3 | 1 tasks / 14m39s; 66 tasks / 20m14s; 67 tasks / 20m14s | `@beep/repo-cli#test` 14m39s |

Lint's two bins are 67 tasks/18m52s and 67 tasks/18m54s of serialized
p95-weighted work; with each shard retaining concurrency two, the lower-bound
body is about 9m27s before DAG/runner margin. Test Unit isolates
`@beep/repo-cli#test` at 14m39s p95, then balances the other 133 tasks into
66-task and 67-task bins of 20m14s serialized work (about 10m07s each at
concurrency two). The repo-cli tail itself is 14m49s max. These weights drive
the two-shard Lint and three-shard Test Unit repair; they are not a claim that
all tasks are perfectly parallel.

## Every p90-tail job: phase decomposition

`Other` is the non-negative wall-time residue (checkout, lane gate, and action
boundary gaps). `Trail` sums every timed step after `Run verification lane`.
The H/M column is Turbo cache hits/misses from the log summary. P95 and Max
mark the exact order-statistic jobs; overlapping weeks intentionally repeat
shared jobs.

### Representative — Lint (p90 20m00s)

| Mark | Job | Run | Head SHA | Wall | Pickup | Cleanup | Setup | Body | Trail | Other | H/M | Cause |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
|  | [98023314375](https://github.com/beep-effect/beep-effect/actions/runs/32917193953/job/98023314375) | [32917193953](https://github.com/beep-effect/beep-effect/actions/runs/32917193953) | `d55066cf4d2f0315006cda991174f9986c650c07` | 20m00s | 0m02s | 1m36s | 0m38s | 17m28s | 0m03s | 0m15s | 0/130 | B |
|  | [98072144965](https://github.com/beep-effect/beep-effect/actions/runs/32934185423/job/98072144965) | [32934185423](https://github.com/beep-effect/beep-effect/actions/runs/32934185423) | `a172f9d7c4d359d6323595d0410ddeed7c392d53` | 20m00s | 1m27s | 1m12s | 0m34s | 17m58s | 0m03s | 0m13s | 1/129 | A |
|  | [98175445645](https://github.com/beep-effect/beep-effect/actions/runs/32968142800/job/98175445645) | [32968142800](https://github.com/beep-effect/beep-effect/actions/runs/32968142800) | `effd57c5a8248c02c8bade4182b8b46b231ad4a2` | 20m00s | 0m02s | 5m58s | 1m00s | 12m39s | 0m03s | 0m20s | 0/131 | A |
|  | [99055963768](https://github.com/beep-effect/beep-effect/actions/runs/33235617433/job/99055963768) | [33235617433](https://github.com/beep-effect/beep-effect/actions/runs/33235617433) | `554901050c36980c4f41b06dbc24e21979761e92` | 20m00s | 0m02s | 0m33s | 0m38s | 18m28s | 0m03s | 0m18s | 0/132 | A |
|  | [98193969211](https://github.com/beep-effect/beep-effect/actions/runs/32973899451/job/98193969211) | [32973899451](https://github.com/beep-effect/beep-effect/actions/runs/32973899451) | `a1722eeb814c78d2bad041d9164efdd724461411` | 20m01s | 0m01s | 1m14s | 0m33s | 17m55s | 0m03s | 0m16s | 0/131 | B |
|  | [97424172414](https://github.com/beep-effect/beep-effect/actions/runs/32724996724/job/97424172414) | [32724996724](https://github.com/beep-effect/beep-effect/actions/runs/32724996724) | `992c6980bb8c79381fefe1765312113cce929e34` | 20m02s | 0m02s | 1m43s | 0m42s | 17m15s | 0m03s | 0m19s | 0/128 | A |
|  | [98064361931](https://github.com/beep-effect/beep-effect/actions/runs/32931453073/job/98064361931) | [32931453073](https://github.com/beep-effect/beep-effect/actions/runs/32931453073) | `29f18746b34d5b25bf17f407fd702356cfae4f34` | 20m05s | 0m02s | 1m13s | 0m35s | 18m02s | 0m02s | 0m13s | 0/130 | A |
|  | [98165712508](https://github.com/beep-effect/beep-effect/actions/runs/32965086775/job/98165712508) | [32965086775](https://github.com/beep-effect/beep-effect/actions/runs/32965086775) | `101c1c4b98483ff2bb6b973d2983bc1be8a4cdd6` | 20m06s | 0m03s | 1m35s | 0m40s | 17m32s | 0m03s | 0m16s | 0/130 | A |
|  | [97461247407](https://github.com/beep-effect/beep-effect/actions/runs/32736739511/job/97461247407) | [32736739511](https://github.com/beep-effect/beep-effect/actions/runs/32736739511) | `f6ee6a8ad4f8fa9a83815ceea4ba15d1ec35ea92` | 20m07s | 0m02s | 4m22s | 0m51s | 14m33s | 0m03s | 0m18s | 0/129 | A |
|  | [98019761540](https://github.com/beep-effect/beep-effect/actions/runs/32916006868/job/98019761540) | [32916006868](https://github.com/beep-effect/beep-effect/actions/runs/32916006868) | `9934ddaee3480950d9ed4dbbe43537caa9fb11a5` | 20m09s | 0m02s | 1m05s | 0m35s | 18m09s | 0m03s | 0m17s | 0/129 | A |
|  | [98153757903](https://github.com/beep-effect/beep-effect/actions/runs/32961202470/job/98153757903) | [32961202470](https://github.com/beep-effect/beep-effect/actions/runs/32961202470) | `8d338759b630af94a6ba32637fa859b00db5716c` | 20m10s | 2m51s | 1m06s | 0m40s | 18m03s | 0m03s | 0m18s | 0/131 | A |
|  | [97923284182](https://github.com/beep-effect/beep-effect/actions/runs/32885002967/job/97923284182) | [32885002967](https://github.com/beep-effect/beep-effect/actions/runs/32885002967) | `97947019b6f906bc4b42c687ad521d554ca0112b` | 20m11s | 0m03s | 1m20s | 0m40s | 17m39s | 0m03s | 0m29s | 0/129 | A |
|  | [98552769361](https://github.com/beep-effect/beep-effect/actions/runs/33082376490/job/98552769361) | [33082376490](https://github.com/beep-effect/beep-effect/actions/runs/33082376490) | `8675818cd9fa14666d047ca53cf9ff4af8364602` | 20m11s | 0m57s | 0m36s | 0m40s | 18m35s | 0m03s | 0m17s | 0/131 | B |
|  | [99101643367](https://github.com/beep-effect/beep-effect/actions/runs/33252939043/job/99101643367) | [33252939043](https://github.com/beep-effect/beep-effect/actions/runs/33252939043) | `e048b41d2962a79e07837d3d450f5e772ffd70d2` | 20m11s | 0m02s | 0m38s | 0m35s | 18m41s | 0m03s | 0m14s | 0/132 | A |
|  | [98017597944](https://github.com/beep-effect/beep-effect/actions/runs/32915279602/job/98017597944) | [32915279602](https://github.com/beep-effect/beep-effect/actions/runs/32915279602) | `a17370d48276fca38bf555f5eeb3e8baa89cf84e` | 20m13s | 1m11s | 1m18s | 0m38s | 17m57s | 0m03s | 0m17s | 0/130 | A |
|  | [99162051534](https://github.com/beep-effect/beep-effect/actions/runs/33275756782/job/99162051534) | [33275756782](https://github.com/beep-effect/beep-effect/actions/runs/33275756782) | `e6ac4836fd7ef25e876cf8591a87327cebe87928` | 20m13s | 0m03s | 0m43s | 0m36s | 18m32s | 0m03s | 0m19s | 0/132 | A |
|  | [98557316227](https://github.com/beep-effect/beep-effect/actions/runs/33083654667/job/98557316227) | [33083654667](https://github.com/beep-effect/beep-effect/actions/runs/33083654667) | `6d9a60bbca40cea0b584dcdae1dc78d17c26744f` | 20m19s | 3m13s | 0m23s | 0m35s | 19m01s | 0m03s | 0m17s | 0/131 | A |
|  | [97673040015](https://github.com/beep-effect/beep-effect/actions/runs/32804912062/job/97673040015) | [32804912062](https://github.com/beep-effect/beep-effect/actions/runs/32804912062) | `8788fb5d9e4a53a13b4b22d7063f15e97f97b1b0` | 20m20s | 0m02s | 1m25s | 0m37s | 17m59s | 0m03s | 0m16s | 0/129 | B |
|  | [97318717289](https://github.com/beep-effect/beep-effect/actions/runs/32688837330/job/97318717289) | [32688837330](https://github.com/beep-effect/beep-effect/actions/runs/32688837330) | `66b5f44807e29a00492a4c7ca568a234e3173c59` | 20m21s | 0m02s | 1m03s | 0m36s | 18m22s | 0m03s | 0m17s | 0/128 | A |
|  | [99143484282](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484282) | [33268807916](https://github.com/beep-effect/beep-effect/actions/runs/33268807916) | `fc984a2a0279915d9093fceebacb251202d20cbc` | 20m21s | 0m04s | 1m07s | 0m48s | 18m05s | 0m03s | 0m18s | 0/132 | A |
|  | [99134858454](https://github.com/beep-effect/beep-effect/actions/runs/33265551233/job/99134858454) | [33265551233](https://github.com/beep-effect/beep-effect/actions/runs/33265551233) | `691166f31878a719ef22233b9009412e99b0d430` | 20m27s | 0m01s | 0m36s | 0m43s | 18m51s | 0m03s | 0m14s | 0/132 | A |
|  | [97959804131](https://github.com/beep-effect/beep-effect/actions/runs/32895678192/job/97959804131) | [32895678192](https://github.com/beep-effect/beep-effect/actions/runs/32895678192) | `49a88ef0b988174a34f1737d2d20ef968fc660b1` | 20m28s | 0m03s | 0m31s | 0m33s | 18m46s | 0m03s | 0m35s | 0/129 | A |
|  | [98424191585](https://github.com/beep-effect/beep-effect/actions/runs/33044160152/job/98424191585) | [33044160152](https://github.com/beep-effect/beep-effect/actions/runs/33044160152) | `4c4deb7fcd9a4e113b5f24fce5edd45099018739` | 20m30s | 0m02s | 1m30s | 0m36s | 18m07s | 0m03s | 0m14s | 0/131 | A |
|  | [98021932749](https://github.com/beep-effect/beep-effect/actions/runs/32916746012/job/98021932749) | [32916746012](https://github.com/beep-effect/beep-effect/actions/runs/32916746012) | `f3c7f3cb37200719df0676112a80b81c63c408b8` | 20m31s | 2m24s | 1m51s | 0m42s | 17m41s | 0m03s | 0m14s | 4/126 | A |
| P95 | [98391009540](https://github.com/beep-effect/beep-effect/actions/runs/33033474771/job/98391009540) | [33033474771](https://github.com/beep-effect/beep-effect/actions/runs/33033474771) | `6484ed8f7a9d9e8261a7afacbeb361168a3a04f7` | 20m31s | 0m02s | 1m27s | 0m37s | 18m02s | 0m03s | 0m22s | 0/131 | A |
|  | [99138613677](https://github.com/beep-effect/beep-effect/actions/runs/33266964280/job/99138613677) | [33266964280](https://github.com/beep-effect/beep-effect/actions/runs/33266964280) | `a870fe08547fb946dd6a21b04b7b5ad3040fc8b0` | 20m41s | 0m02s | 1m15s | 0m33s | 18m36s | 0m02s | 0m15s | 0/132 | A |
|  | [98431101122](https://github.com/beep-effect/beep-effect/actions/runs/33046337346/job/98431101122) | [33046337346](https://github.com/beep-effect/beep-effect/actions/runs/33046337346) | `2aaf579f113dfeb7ca7f0eae8fa11baf7c085131` | 20m42s | 0m02s | 1m44s | 0m39s | 17m57s | 0m03s | 0m19s | 0/131 | A |
|  | [98571873609](https://github.com/beep-effect/beep-effect/actions/runs/33087723363/job/98571873609) | [33087723363](https://github.com/beep-effect/beep-effect/actions/runs/33087723363) | `3ea411f5c6f7e416f1f0b124d92609ab7d9d96cd` | 20m50s | 7m19s | 1m21s | 0m36s | 18m31s | 0m03s | 0m19s | 0/132 | B |
|  | [99043490760](https://github.com/beep-effect/beep-effect/actions/runs/33230919209/job/99043490760) | [33230919209](https://github.com/beep-effect/beep-effect/actions/runs/33230919209) | `5ecc6d97125afcec90aac667661669731b7138fb` | 20m53s | 0m02s | 1m20s | 0m40s | 18m32s | 0m03s | 0m18s | 0/132 | A |
|  | [98401219389](https://github.com/beep-effect/beep-effect/actions/runs/33036833166/job/98401219389) | [33036833166](https://github.com/beep-effect/beep-effect/actions/runs/33036833166) | `cab548b9f6b93b64f88c32746cd87068025514e1` | 20m56s | 0m03s | 1m36s | 0m43s | 18m17s | 0m03s | 0m17s | 0/131 | A |
|  | [98249525428](https://github.com/beep-effect/beep-effect/actions/runs/32991391841/job/98249525428) | [32991391841](https://github.com/beep-effect/beep-effect/actions/runs/32991391841) | `3e0cfd3bc6a09a4eaeb1e8f9176334a6ad14e6a6` | 20m57s | 0m14s | 1m15s | 0m38s | 18m44s | 0m03s | 0m17s | 0/131 | A |
|  | [97264522721](https://github.com/beep-effect/beep-effect/actions/runs/32668069065/job/97264522721) | [32668069065](https://github.com/beep-effect/beep-effect/actions/runs/32668069065) | `c8b621e37355071a985ff8dba1accd74751d0ded` | 21m02s | 0m15s | 1m20s | 0m41s | 18m42s | 0m03s | 0m16s | 0/128 | A |
|  | [97680027364](https://github.com/beep-effect/beep-effect/actions/runs/32807382210/job/97680027364) | [32807382210](https://github.com/beep-effect/beep-effect/actions/runs/32807382210) | `f7afafca32e15d85532bd6a455703cfb867a2ee3` | 21m05s | 0m04s | 1m35s | 0m42s | 18m28s | 0m03s | 0m17s | 0/129 | B |
|  | [98571841364](https://github.com/beep-effect/beep-effect/actions/runs/33087714486/job/98571841364) | [33087714486](https://github.com/beep-effect/beep-effect/actions/runs/33087714486) | `489a66841b143ad77517efddf54c700790352695` | 21m06s | 0m03s | 1m47s | 0m42s | 18m12s | 0m03s | 0m22s | 0/131 | A |
|  | [98604080869](https://github.com/beep-effect/beep-effect/actions/runs/33096904507/job/98604080869) | [33096904507](https://github.com/beep-effect/beep-effect/actions/runs/33096904507) | `74c171122765de6701c8bd989fac32c5d0dc1427` | 21m14s | 0m02s | 2m02s | 0m43s | 18m00s | 0m03s | 0m26s | 0/131 | A |
|  | [97292896891](https://github.com/beep-effect/beep-effect/actions/runs/32679255250/job/97292896891) | [32679255250](https://github.com/beep-effect/beep-effect/actions/runs/32679255250) | `eda0617db8226fc4e0373625d4e28e0f496f9e2b` | 21m15s | 0m26s | 1m25s | 0m40s | 18m50s | 0m03s | 0m17s | 0/128 | A |
|  | [99117188391](https://github.com/beep-effect/beep-effect/actions/runs/33258847437/job/99117188391) | [33258847437](https://github.com/beep-effect/beep-effect/actions/runs/33258847437) | `32184e6c95de814693202c6952ad9f650796186f` | 21m19s | 0m03s | 1m31s | 0m53s | 18m33s | 0m03s | 0m19s | 0/132 | A |
|  | [99125421606](https://github.com/beep-effect/beep-effect/actions/runs/33262001775/job/99125421606) | [33262001775](https://github.com/beep-effect/beep-effect/actions/runs/33262001775) | `f83236007f5a5f0fa4f198e011f168f2c927e2cb` | 21m22s | 0m02s | 1m22s | 0m49s | 18m50s | 0m03s | 0m18s | 0/132 | A |
|  | [98201979451](https://github.com/beep-effect/beep-effect/actions/runs/32976370337/job/98201979451) | [32976370337](https://github.com/beep-effect/beep-effect/actions/runs/32976370337) | `9024a3408471eb3abca8670ba0974cb94298e226` | 21m30s | 1m37s | 2m24s | 0m39s | 18m07s | 0m02s | 0m18s | 0/131 | B |
|  | [97254000676](https://github.com/beep-effect/beep-effect/actions/runs/32663831727/job/97254000676) | [32663831727](https://github.com/beep-effect/beep-effect/actions/runs/32663831727) | `793cda0db4541065becef6fc3dd76a98c2b3846b` | 21m33s | 2m16s | 1m20s | 0m41s | 19m15s | 0m03s | 0m14s | 0/128 | A |
|  | [97239925793](https://github.com/beep-effect/beep-effect/actions/runs/32658089966/job/97239925793) | [32658089966](https://github.com/beep-effect/beep-effect/actions/runs/32658089966) | `7e34172fb77fb319fab7a36808444755fdb1f034` | 21m44s | 0m02s | 1m25s | 0m42s | 19m19s | 0m02s | 0m16s | 0/128 | A |
|  | [98298650113](https://github.com/beep-effect/beep-effect/actions/runs/33005670001/job/98298650113) | [33005670001](https://github.com/beep-effect/beep-effect/actions/runs/33005670001) | `6e97224c4110634063145e96261860fb87006f06` | 21m47s | 0m02s | 0m57s | 0m34s | 19m55s | 0m03s | 0m18s | 0/131 | A |
|  | [99129670376](https://github.com/beep-effect/beep-effect/actions/runs/33263625457/job/99129670376) | [33263625457](https://github.com/beep-effect/beep-effect/actions/runs/33263625457) | `370d04baf17bed1efdf3698179c6c9ee8080f4cc` | 21m56s | 0m04s | 1m26s | 1m07s | 19m01s | 0m04s | 0m18s | 0/132 | A |
|  | [97948085340](https://github.com/beep-effect/beep-effect/actions/runs/32892705132/job/97948085340) | [32892705132](https://github.com/beep-effect/beep-effect/actions/runs/32892705132) | `370afb8f525c0480ad5aa21fc74a2702d8767d02` | 21m58s | 1m05s | 5m34s | 1m05s | 14m58s | 0m03s | 0m18s | 0/129 | A |
|  | [97949922422](https://github.com/beep-effect/beep-effect/actions/runs/32893285458/job/97949922422) | [32893285458](https://github.com/beep-effect/beep-effect/actions/runs/32893285458) | `e39df8ea443fb8db327ca6dee781c129696605d7` | 22m55s | 1m29s | 6m34s | 0m53s | 15m06s | 0m03s | 0m19s | 0/129 | A |
| Max | [98602443641](https://github.com/beep-effect/beep-effect/actions/runs/33096430477/job/98602443641) | [33096430477](https://github.com/beep-effect/beep-effect/actions/runs/33096430477) | `c7b4732aa21b78508a2cc1dce89aa052d39a054b` | 23m41s | 0m02s | 4m12s | 0m35s | 18m38s | 0m03s | 0m13s | 0/132 | A |

### Representative — Test Unit (p90 22m04s)

| Mark | Job | Run | Head SHA | Wall | Pickup | Cleanup | Setup | Body | Trail | Other | H/M | Cause |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
|  | [98165712754](https://github.com/beep-effect/beep-effect/actions/runs/32965086775/job/98165712754) | [32965086775](https://github.com/beep-effect/beep-effect/actions/runs/32965086775) | `101c1c4b98483ff2bb6b973d2983bc1be8a4cdd6` | 22m04s | 0m02s | 0m25s | 0m51s | 20m28s | 0m03s | 0m17s | 0/130 | A |
|  | [98064361935](https://github.com/beep-effect/beep-effect/actions/runs/32931453073/job/98064361935) | [32931453073](https://github.com/beep-effect/beep-effect/actions/runs/32931453073) | `29f18746b34d5b25bf17f407fd702356cfae4f34` | 22m10s | 0m02s | 1m48s | 0m39s | 19m24s | 0m03s | 0m16s | 0/130 | A |
|  | [99112109979](https://github.com/beep-effect/beep-effect/actions/runs/33256898867/job/99112109979) | [33256898867](https://github.com/beep-effect/beep-effect/actions/runs/33256898867) | `ae6eecda91fe2b50440dc62eea6dc87b0c14817d` | 22m11s | 0m19s | 1m20s | 0m50s | 19m43s | 0m03s | 0m15s | 0/132 | A |
|  | [97923284022](https://github.com/beep-effect/beep-effect/actions/runs/32885002967/job/97923284022) | [32885002967](https://github.com/beep-effect/beep-effect/actions/runs/32885002967) | `97947019b6f906bc4b42c687ad521d554ca0112b` | 22m14s | 0m02s | 1m25s | 0m33s | 19m31s | 0m03s | 0m42s | 0/129 | A |
|  | [97900758224](https://github.com/beep-effect/beep-effect/actions/runs/32878072461/job/97900758224) | [32878072461](https://github.com/beep-effect/beep-effect/actions/runs/32878072461) | `07efcc0cc9bdc8990d7f15013d07fe555a5464f8` | 22m16s | 0m02s | 1m30s | 0m37s | 19m28s | 0m03s | 0m38s | 0/129 | A |
|  | [97949922162](https://github.com/beep-effect/beep-effect/actions/runs/32893285458/job/97949922162) | [32893285458](https://github.com/beep-effect/beep-effect/actions/runs/32893285458) | `e39df8ea443fb8db327ca6dee781c129696605d7` | 22m18s | 0m04s | 1m35s | 0m43s | 19m41s | 0m03s | 0m16s | 0/129 | A |
|  | [98571873448](https://github.com/beep-effect/beep-effect/actions/runs/33087723363/job/98571873448) | [33087723363](https://github.com/beep-effect/beep-effect/actions/runs/33087723363) | `3ea411f5c6f7e416f1f0b124d92609ab7d9d96cd` | 22m20s | 1m09s | 1m37s | 0m39s | 19m41s | 0m03s | 0m20s | 0/132 | C |
|  | [97264522707](https://github.com/beep-effect/beep-effect/actions/runs/32668069065/job/97264522707) | [32668069065](https://github.com/beep-effect/beep-effect/actions/runs/32668069065) | `c8b621e37355071a985ff8dba1accd74751d0ded` | 22m24s | 0m14s | 1m11s | 0m54s | 20m00s | 0m02s | 0m17s | 0/128 | A |
|  | [98602443725](https://github.com/beep-effect/beep-effect/actions/runs/33096430477/job/98602443725) | [33096430477](https://github.com/beep-effect/beep-effect/actions/runs/33096430477) | `c7b4732aa21b78508a2cc1dce89aa052d39a054b` | 22m25s | 0m02s | 0m33s | 0m40s | 20m51s | 0m03s | 0m18s | 0/132 | A |
|  | [99125421553](https://github.com/beep-effect/beep-effect/actions/runs/33262001775/job/99125421553) | [33262001775](https://github.com/beep-effect/beep-effect/actions/runs/33262001775) | `f83236007f5a5f0fa4f198e011f168f2c927e2cb` | 22m27s | 0m02s | 0m33s | 0m49s | 20m42s | 0m03s | 0m20s | 0/132 | A |
|  | [97449244603](https://github.com/beep-effect/beep-effect/actions/runs/32732988757/job/97449244603) | [32732988757](https://github.com/beep-effect/beep-effect/actions/runs/32732988757) | `736507c1353b804f186cc5c62c0da63b052e5f2c` | 22m29s | 0m02s | 0m38s | 0m39s | 20m53s | 0m03s | 0m16s | 0/129 | A |
|  | [99166491233](https://github.com/beep-effect/beep-effect/actions/runs/33277422919/job/99166491233) | [33277422919](https://github.com/beep-effect/beep-effect/actions/runs/33277422919) | `0adbfb5753ac27b1cb0e102e6957f572babe1248` | 22m29s | 0m02s | 1m33s | 1m02s | 19m34s | 0m03s | 0m17s | 0/132 | A |
|  | [97947424577](https://github.com/beep-effect/beep-effect/actions/runs/32892496750/job/97947424577) | [32892496750](https://github.com/beep-effect/beep-effect/actions/runs/32892496750) | `9caef13bc236b1ce616183a9b4f5edff33d15641` | 22m31s | 0m04s | 0m37s | 0m40s | 20m53s | 0m03s | 0m18s | 0/129 | A |
|  | [97948085255](https://github.com/beep-effect/beep-effect/actions/runs/32892705132/job/97948085255) | [32892705132](https://github.com/beep-effect/beep-effect/actions/runs/32892705132) | `370afb8f525c0480ad5aa21fc74a2702d8767d02` | 22m31s | 0m02s | 0m54s | 0m31s | 20m50s | 0m03s | 0m13s | 0/129 | A |
|  | [98298650058](https://github.com/beep-effect/beep-effect/actions/runs/33005670001/job/98298650058) | [33005670001](https://github.com/beep-effect/beep-effect/actions/runs/33005670001) | `6e97224c4110634063145e96261860fb87006f06` | 22m31s | 0m02s | 1m37s | 0m38s | 19m59s | 0m03s | 0m14s | 0/131 | A |
|  | [99056589150](https://github.com/beep-effect/beep-effect/actions/runs/33235653788/job/99056589150) | [33235653788](https://github.com/beep-effect/beep-effect/actions/runs/33235653788) | `e0dcd2718a034be69916856501ddb62ca48ed4f8` | 22m31s | 0m02s | 0m57s | 0m58s | 20m17s | 0m03s | 0m16s | 0/132 | A |
|  | [98016709792](https://github.com/beep-effect/beep-effect/actions/runs/32914960586/job/98016709792) | [32914960586](https://github.com/beep-effect/beep-effect/actions/runs/32914960586) | `ca6352faa846866a04b1aa881559d8f9595eaa83` | 22m32s | 0m01s | 1m18s | 0m37s | 20m20s | 0m03s | 0m14s | 0/129 | A |
|  | [99134858557](https://github.com/beep-effect/beep-effect/actions/runs/33265551233/job/99134858557) | [33265551233](https://github.com/beep-effect/beep-effect/actions/runs/33265551233) | `691166f31878a719ef22233b9009412e99b0d430` | 22m40s | 0m02s | 2m57s | 1m22s | 18m01s | 0m03s | 0m17s | 0/132 | A |
|  | [98175445514](https://github.com/beep-effect/beep-effect/actions/runs/32968142800/job/98175445514) | [32968142800](https://github.com/beep-effect/beep-effect/actions/runs/32968142800) | `effd57c5a8248c02c8bade4182b8b46b231ad4a2` | 22m41s | 0m01s | 0m47s | 0m35s | 21m02s | 0m03s | 0m14s | 0/131 | A |
| P95 | [98745268142](https://github.com/beep-effect/beep-effect/actions/runs/33138943530/job/98745268142) | [33138943530](https://github.com/beep-effect/beep-effect/actions/runs/33138943530) | `26b5b8763adda9c78464445b4dfe71db75bf179e` | 22m48s | 0m02s | 1m23s | 0m42s | 20m22s | 0m03s | 0m18s | 0/132 | A |
|  | [98001649758](https://github.com/beep-effect/beep-effect/actions/runs/32909841564/job/98001649758) | [32909841564](https://github.com/beep-effect/beep-effect/actions/runs/32909841564) | `adcb08fb9fcde338f14e078065012193f89e8bc1` | 22m56s | 0m02s | 1m42s | 0m36s | 20m23s | 0m03s | 0m12s | 0/130 | A |
|  | [98249525189](https://github.com/beep-effect/beep-effect/actions/runs/32991391841/job/98249525189) | [32991391841](https://github.com/beep-effect/beep-effect/actions/runs/32991391841) | `3e0cfd3bc6a09a4eaeb1e8f9176334a6ad14e6a6` | 23m00s | 0m12s | 1m00s | 0m33s | 21m08s | 0m02s | 0m17s | 0/131 | A |
|  | [99117188535](https://github.com/beep-effect/beep-effect/actions/runs/33258847437/job/99117188535) | [33258847437](https://github.com/beep-effect/beep-effect/actions/runs/33258847437) | `32184e6c95de814693202c6952ad9f650796186f` | 23m02s | 0m02s | 1m25s | 0m42s | 20m37s | 0m04s | 0m14s | 0/132 | A |
|  | [99129670239](https://github.com/beep-effect/beep-effect/actions/runs/33263625457/job/99129670239) | [33263625457](https://github.com/beep-effect/beep-effect/actions/runs/33263625457) | `370d04baf17bed1efdf3698179c6c9ee8080f4cc` | 23m09s | 0m02s | 0m43s | 0m50s | 21m10s | 0m03s | 0m23s | 0/132 | A |
|  | [99170356732](https://github.com/beep-effect/beep-effect/actions/runs/33278823776/job/99170356732) | [33278823776](https://github.com/beep-effect/beep-effect/actions/runs/33278823776) | `e1d8cc665816199ed680e28d01a531e647e75397` | 23m11s | 0m02s | 0m31s | 0m40s | 21m39s | 0m03s | 0m18s | 0/132 | A |
|  | [98072145058](https://github.com/beep-effect/beep-effect/actions/runs/32934185423/job/98072145058) | [32934185423](https://github.com/beep-effect/beep-effect/actions/runs/32934185423) | `a172f9d7c4d359d6323595d0410ddeed7c392d53` | 23m16s | 1m45s | 1m28s | 0m40s | 20m49s | 0m03s | 0m16s | 0/130 | A |
|  | [98138190376](https://github.com/beep-effect/beep-effect/actions/runs/32956164790/job/98138190376) | [32956164790](https://github.com/beep-effect/beep-effect/actions/runs/32956164790) | `0bf68d27d98ab38c09655652d44e992f3825cd77` | 23m23s | 1m52s | 0m33s | 0m34s | 22m00s | 0m03s | 0m13s | 0/130 | A |
|  | [98391009531](https://github.com/beep-effect/beep-effect/actions/runs/33033474771/job/98391009531) | [33033474771](https://github.com/beep-effect/beep-effect/actions/runs/33033474771) | `6484ed8f7a9d9e8261a7afacbeb361168a3a04f7` | 23m24s | 0m02s | 1m06s | 0m38s | 21m20s | 0m03s | 0m17s | 0/131 | A |
|  | [99106207151](https://github.com/beep-effect/beep-effect/actions/runs/33254674212/job/99106207151) | [33254674212](https://github.com/beep-effect/beep-effect/actions/runs/33254674212) | `672471999b6554ebd61706839fc377f2578ff909` | 23m32s | 0m03s | 1m20s | 0m41s | 21m09s | 0m04s | 0m18s | 0/132 | A |
|  | [97239925741](https://github.com/beep-effect/beep-effect/actions/runs/32658089966/job/97239925741) | [32658089966](https://github.com/beep-effect/beep-effect/actions/runs/32658089966) | `7e34172fb77fb319fab7a36808444755fdb1f034` | 23m35s | 0m02s | 1m15s | 0m33s | 21m32s | 0m03s | 0m12s | 0/128 | A |
|  | [99143484316](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484316) | [33268807916](https://github.com/beep-effect/beep-effect/actions/runs/33268807916) | `fc984a2a0279915d9093fceebacb251202d20cbc` | 24m05s | 0m02s | 1m10s | 0m49s | 21m45s | 0m04s | 0m17s | 0/132 | A |
|  | [98076310731](https://github.com/beep-effect/beep-effect/actions/runs/32935671416/job/98076310731) | [32935671416](https://github.com/beep-effect/beep-effect/actions/runs/32935671416) | `e8a23c527e8b4e4ef38c2e761f213992db17034e` | 24m07s | 1m28s | 1m13s | 0m34s | 22m05s | 0m02s | 0m13s | 0/130 | A |
|  | [98102361795](https://github.com/beep-effect/beep-effect/actions/runs/32944543287/job/98102361795) | [32944543287](https://github.com/beep-effect/beep-effect/actions/runs/32944543287) | `8294eb45a4dc98f62861128a10405ccd22a74a23` | 24m18s | 0m02s | 1m33s | 0m39s | 21m46s | 0m03s | 0m17s | 0/130 | A |
|  | [97254000484](https://github.com/beep-effect/beep-effect/actions/runs/32663831727/job/97254000484) | [32663831727](https://github.com/beep-effect/beep-effect/actions/runs/32663831727) | `793cda0db4541065becef6fc3dd76a98c2b3846b` | 24m20s | 0m37s | 1m26s | 0m33s | 22m03s | 0m03s | 0m15s | 0/128 | A |
|  | [98401219572](https://github.com/beep-effect/beep-effect/actions/runs/33036833166/job/98401219572) | [33036833166](https://github.com/beep-effect/beep-effect/actions/runs/33036833166) | `cab548b9f6b93b64f88c32746cd87068025514e1` | 25m00s | 1m18s | 1m31s | 0m39s | 22m29s | 0m03s | 0m18s | 0/131 | A |
|  | [98571841670](https://github.com/beep-effect/beep-effect/actions/runs/33087714486/job/98571841670) | [33087714486](https://github.com/beep-effect/beep-effect/actions/runs/33087714486) | `489a66841b143ad77517efddf54c700790352695` | 25m06s | 0m02s | 3m31s | 0m40s | 20m36s | 0m03s | 0m16s | 0/131 | A |
|  | [98557316297](https://github.com/beep-effect/beep-effect/actions/runs/33083654667/job/98557316297) | [33083654667](https://github.com/beep-effect/beep-effect/actions/runs/33083654667) | `6d9a60bbca40cea0b584dcdae1dc78d17c26744f` | 26m13s | 2m34s | 3m42s | 0m33s | 21m43s | 0m02s | 0m13s | 0/131 | A |
| Max | [99101643281](https://github.com/beep-effect/beep-effect/actions/runs/33252939043/job/99101643281) | [33252939043](https://github.com/beep-effect/beep-effect/actions/runs/33252939043) | `e048b41d2962a79e07837d3d450f5e772ffd70d2` | 27m13s | 0m02s | 1m33s | 0m35s | 24m47s | 0m03s | 0m15s | 0/132 | A |

### Current ruleset — Lint (p90 20m10s)

| Mark | Job | Run | Head SHA | Wall | Pickup | Cleanup | Setup | Body | Trail | Other | H/M | Cause |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
|  | [98153757903](https://github.com/beep-effect/beep-effect/actions/runs/32961202470/job/98153757903) | [32961202470](https://github.com/beep-effect/beep-effect/actions/runs/32961202470) | `8d338759b630af94a6ba32637fa859b00db5716c` | 20m10s | 2m51s | 1m06s | 0m40s | 18m03s | 0m03s | 0m18s | 0/131 | A |
|  | [98552769361](https://github.com/beep-effect/beep-effect/actions/runs/33082376490/job/98552769361) | [33082376490](https://github.com/beep-effect/beep-effect/actions/runs/33082376490) | `8675818cd9fa14666d047ca53cf9ff4af8364602` | 20m11s | 0m57s | 0m36s | 0m40s | 18m35s | 0m03s | 0m17s | 0/131 | B |
|  | [99101643367](https://github.com/beep-effect/beep-effect/actions/runs/33252939043/job/99101643367) | [33252939043](https://github.com/beep-effect/beep-effect/actions/runs/33252939043) | `e048b41d2962a79e07837d3d450f5e772ffd70d2` | 20m11s | 0m02s | 0m38s | 0m35s | 18m41s | 0m03s | 0m14s | 0/132 | A |
|  | [99193133514](https://github.com/beep-effect/beep-effect/actions/runs/33287499456/job/99193133514) | [33287499456](https://github.com/beep-effect/beep-effect/actions/runs/33287499456) | `9b40e17c250d8e419d937385612be9475975190d` | 20m11s | 0m02s | 1m11s | 0m43s | 17m58s | 0m03s | 0m16s | 0/132 | A |
|  | [99162051534](https://github.com/beep-effect/beep-effect/actions/runs/33275756782/job/99162051534) | [33275756782](https://github.com/beep-effect/beep-effect/actions/runs/33275756782) | `e6ac4836fd7ef25e876cf8591a87327cebe87928` | 20m13s | 0m03s | 0m43s | 0m36s | 18m32s | 0m03s | 0m19s | 0/132 | A |
|  | [98557316227](https://github.com/beep-effect/beep-effect/actions/runs/33083654667/job/98557316227) | [33083654667](https://github.com/beep-effect/beep-effect/actions/runs/33083654667) | `6d9a60bbca40cea0b584dcdae1dc78d17c26744f` | 20m19s | 3m13s | 0m23s | 0m35s | 19m01s | 0m03s | 0m17s | 0/131 | A |
|  | [99371613343](https://github.com/beep-effect/beep-effect/actions/runs/33353658076/job/99371613343) | [33353658076](https://github.com/beep-effect/beep-effect/actions/runs/33353658076) | `7236fb68d90d1f71c6d66e21771855b593ff666c` | 20m20s | 12m32s | 1m14s | 0m50s | 17m59s | 0m03s | 0m14s | 7/126 | A |
|  | [99143484282](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484282) | [33268807916](https://github.com/beep-effect/beep-effect/actions/runs/33268807916) | `fc984a2a0279915d9093fceebacb251202d20cbc` | 20m21s | 0m04s | 1m07s | 0m48s | 18m05s | 0m03s | 0m18s | 0/132 | A |
|  | [99331816539](https://github.com/beep-effect/beep-effect/actions/runs/33339271817/job/99331816539) | [33339271817](https://github.com/beep-effect/beep-effect/actions/runs/33339271817) | `0ef16877e47842ce25b131f44db1025cced22e80` | 20m24s | 0m09s | 1m30s | 0m48s | 17m46s | 0m03s | 0m17s | 7/126 | A |
|  | [99134858454](https://github.com/beep-effect/beep-effect/actions/runs/33265551233/job/99134858454) | [33265551233](https://github.com/beep-effect/beep-effect/actions/runs/33265551233) | `691166f31878a719ef22233b9009412e99b0d430` | 20m27s | 0m01s | 0m36s | 0m43s | 18m51s | 0m03s | 0m14s | 0/132 | A |
|  | [99320406956](https://github.com/beep-effect/beep-effect/actions/runs/33335060621/job/99320406956) | [33335060621](https://github.com/beep-effect/beep-effect/actions/runs/33335060621) | `0ff22cc8e960681d86c804e24c24d3e2f0322bae` | 20m28s | 3m29s | 1m16s | 0m43s | 18m12s | 0m03s | 0m14s | 6/126 | B |
|  | [99448797377](https://github.com/beep-effect/beep-effect/actions/runs/33379631168/job/99448797377) | [33379631168](https://github.com/beep-effect/beep-effect/actions/runs/33379631168) | `c0a5e31255585ec93b4a62ad3487c1f9d758febc` | 20m28s | 0m03s | 0m33s | 0m52s | 18m42s | 0m03s | 0m18s | 7/127 | A |
|  | [98424191585](https://github.com/beep-effect/beep-effect/actions/runs/33044160152/job/98424191585) | [33044160152](https://github.com/beep-effect/beep-effect/actions/runs/33044160152) | `4c4deb7fcd9a4e113b5f24fce5edd45099018739` | 20m30s | 0m02s | 1m30s | 0m36s | 18m07s | 0m03s | 0m14s | 0/131 | A |
|  | [98391009540](https://github.com/beep-effect/beep-effect/actions/runs/33033474771/job/98391009540) | [33033474771](https://github.com/beep-effect/beep-effect/actions/runs/33033474771) | `6484ed8f7a9d9e8261a7afacbeb361168a3a04f7` | 20m31s | 0m02s | 1m27s | 0m37s | 18m02s | 0m03s | 0m22s | 0/131 | A |
|  | [99307637239](https://github.com/beep-effect/beep-effect/actions/runs/33330324462/job/99307637239) | [33330324462](https://github.com/beep-effect/beep-effect/actions/runs/33330324462) | `aa6c8505e99578c85826e705bf2bd5c1722949a7` | 20m34s | 2m56s | 1m09s | 0m42s | 18m26s | 0m03s | 0m14s | 0/132 | A |
|  | [99138613677](https://github.com/beep-effect/beep-effect/actions/runs/33266964280/job/99138613677) | [33266964280](https://github.com/beep-effect/beep-effect/actions/runs/33266964280) | `a870fe08547fb946dd6a21b04b7b5ad3040fc8b0` | 20m41s | 0m02s | 1m15s | 0m33s | 18m36s | 0m02s | 0m15s | 0/132 | A |
|  | [98431101122](https://github.com/beep-effect/beep-effect/actions/runs/33046337346/job/98431101122) | [33046337346](https://github.com/beep-effect/beep-effect/actions/runs/33046337346) | `2aaf579f113dfeb7ca7f0eae8fa11baf7c085131` | 20m42s | 0m02s | 1m44s | 0m39s | 17m57s | 0m03s | 0m19s | 0/131 | A |
|  | [99380835068](https://github.com/beep-effect/beep-effect/actions/runs/33356926390/job/99380835068) | [33356926390](https://github.com/beep-effect/beep-effect/actions/runs/33356926390) | `3ebf2a61ae6500776f537f6362aa8fc748e84886` | 20m49s | 6m37s | 0m33s | 0m44s | 19m14s | 0m03s | 0m15s | 0/133 | A |
|  | [98571873609](https://github.com/beep-effect/beep-effect/actions/runs/33087723363/job/98571873609) | [33087723363](https://github.com/beep-effect/beep-effect/actions/runs/33087723363) | `3ea411f5c6f7e416f1f0b124d92609ab7d9d96cd` | 20m50s | 7m19s | 1m21s | 0m36s | 18m31s | 0m03s | 0m19s | 0/132 | B |
|  | [99043490760](https://github.com/beep-effect/beep-effect/actions/runs/33230919209/job/99043490760) | [33230919209](https://github.com/beep-effect/beep-effect/actions/runs/33230919209) | `5ecc6d97125afcec90aac667661669731b7138fb` | 20m53s | 0m02s | 1m20s | 0m40s | 18m32s | 0m03s | 0m18s | 0/132 | A |
|  | [98401219389](https://github.com/beep-effect/beep-effect/actions/runs/33036833166/job/98401219389) | [33036833166](https://github.com/beep-effect/beep-effect/actions/runs/33036833166) | `cab548b9f6b93b64f88c32746cd87068025514e1` | 20m56s | 0m03s | 1m36s | 0m43s | 18m17s | 0m03s | 0m17s | 0/131 | A |
|  | [99428426749](https://github.com/beep-effect/beep-effect/actions/runs/33373099784/job/99428426749) | [33373099784](https://github.com/beep-effect/beep-effect/actions/runs/33373099784) | `be062cea8e9e2a48bde31c5464094f79fba8cf00` | 20m56s | 5m38s | 0m32s | 0m42s | 19m20s | 0m03s | 0m19s | 3/131 | A |
|  | [98249525428](https://github.com/beep-effect/beep-effect/actions/runs/32991391841/job/98249525428) | [32991391841](https://github.com/beep-effect/beep-effect/actions/runs/32991391841) | `3e0cfd3bc6a09a4eaeb1e8f9176334a6ad14e6a6` | 20m57s | 0m14s | 1m15s | 0m38s | 18m44s | 0m03s | 0m17s | 0/131 | A |
|  | [99289601583](https://github.com/beep-effect/beep-effect/actions/runs/33323538516/job/99289601583) | [33323538516](https://github.com/beep-effect/beep-effect/actions/runs/33323538516) | `9d4da7a6f8edc60d85c7a2b3cf4dc9f782675820` | 21m00s | 0m03s | 1m15s | 0m50s | 18m36s | 0m03s | 0m16s | 0/132 | A |
| P95 | [99417156953](https://github.com/beep-effect/beep-effect/actions/runs/33369478456/job/99417156953) | [33369478456](https://github.com/beep-effect/beep-effect/actions/runs/33369478456) | `019be8a8c21cbdde0dac7d5263f7dd6252f26e9a` | 21m00s | 3m44s | 0m32s | 0m42s | 19m26s | 0m03s | 0m17s | 0/134 | A |
|  | [98571841364](https://github.com/beep-effect/beep-effect/actions/runs/33087714486/job/98571841364) | [33087714486](https://github.com/beep-effect/beep-effect/actions/runs/33087714486) | `489a66841b143ad77517efddf54c700790352695` | 21m06s | 0m03s | 1m47s | 0m42s | 18m12s | 0m03s | 0m22s | 0/131 | A |
|  | [99469751674](https://github.com/beep-effect/beep-effect/actions/runs/33386354937/job/99469751674) | [33386354937](https://github.com/beep-effect/beep-effect/actions/runs/33386354937) | `8c0239711f2d7afec5b3c1e2eeb719a553b4017d` | 21m13s | 0m03s | 0m33s | 0m48s | 19m30s | 0m03s | 0m19s | 3/131 | A |
|  | [98604080869](https://github.com/beep-effect/beep-effect/actions/runs/33096904507/job/98604080869) | [33096904507](https://github.com/beep-effect/beep-effect/actions/runs/33096904507) | `74c171122765de6701c8bd989fac32c5d0dc1427` | 21m14s | 0m02s | 2m02s | 0m43s | 18m00s | 0m03s | 0m26s | 0/131 | A |
|  | [99222826071](https://github.com/beep-effect/beep-effect/actions/runs/33298733552/job/99222826071) | [33298733552](https://github.com/beep-effect/beep-effect/actions/runs/33298733552) | `07f7d3b68f560279afd1058c61825bb70d11f3f8` | 21m15s | 2m47s | 1m26s | 0m53s | 18m39s | 0m03s | 0m14s | 0/132 | A |
|  | [99117188391](https://github.com/beep-effect/beep-effect/actions/runs/33258847437/job/99117188391) | [33258847437](https://github.com/beep-effect/beep-effect/actions/runs/33258847437) | `32184e6c95de814693202c6952ad9f650796186f` | 21m19s | 0m03s | 1m31s | 0m53s | 18m33s | 0m03s | 0m19s | 0/132 | A |
|  | [99125421606](https://github.com/beep-effect/beep-effect/actions/runs/33262001775/job/99125421606) | [33262001775](https://github.com/beep-effect/beep-effect/actions/runs/33262001775) | `f83236007f5a5f0fa4f198e011f168f2c927e2cb` | 21m22s | 0m02s | 1m22s | 0m49s | 18m50s | 0m03s | 0m18s | 0/132 | A |
|  | [99573415906](https://github.com/beep-effect/beep-effect/actions/runs/33417960928/job/99573415906) | [33417960928](https://github.com/beep-effect/beep-effect/actions/runs/33417960928) | `aef50d1ac7c47748f1704add79165d2a4ce9f95b` | 21m25s | 0m02s | 0m31s | 0m50s | 19m39s | 0m03s | 0m22s | 0/134 | A |
|  | [99396734383](https://github.com/beep-effect/beep-effect/actions/runs/33362573151/job/99396734383) | [33362573151](https://github.com/beep-effect/beep-effect/actions/runs/33362573151) | `d0ee14432361ec95dac56a14fccf0a286d115fc9` | 21m28s | 0m02s | 1m09s | 0m50s | 19m07s | 0m03s | 0m19s | 0/133 | A |
|  | [98201979451](https://github.com/beep-effect/beep-effect/actions/runs/32976370337/job/98201979451) | [32976370337](https://github.com/beep-effect/beep-effect/actions/runs/32976370337) | `9024a3408471eb3abca8670ba0974cb94298e226` | 21m30s | 1m37s | 2m24s | 0m39s | 18m07s | 0m02s | 0m18s | 0/131 | B |
|  | [99406215134](https://github.com/beep-effect/beep-effect/actions/runs/33365846272/job/99406215134) | [33365846272](https://github.com/beep-effect/beep-effect/actions/runs/33365846272) | `aac6901e0b02a32183ed2254314ffa3f6e36dac4` | 21m41s | 0m02s | 1m23s | 0m43s | 19m17s | 0m03s | 0m15s | 0/134 | A |
|  | [99375026201](https://github.com/beep-effect/beep-effect/actions/runs/33354875013/job/99375026201) | [33354875013](https://github.com/beep-effect/beep-effect/actions/runs/33354875013) | `d64a57f9d6ae7f2665a88ae74e3aa90cac3299b4` | 21m42s | 7m32s | 1m15s | 0m51s | 19m16s | 0m04s | 0m16s | 0/134 | A |
|  | [98298650113](https://github.com/beep-effect/beep-effect/actions/runs/33005670001/job/98298650113) | [33005670001](https://github.com/beep-effect/beep-effect/actions/runs/33005670001) | `6e97224c4110634063145e96261860fb87006f06` | 21m47s | 0m02s | 0m57s | 0m34s | 19m55s | 0m03s | 0m18s | 0/131 | A |
|  | [99463999658](https://github.com/beep-effect/beep-effect/actions/runs/33384469608/job/99463999658) | [33384469608](https://github.com/beep-effect/beep-effect/actions/runs/33384469608) | `2d7cb36a2664310e4da40c5ed457bb84aeb3e7cd` | 21m47s | 0m02s | 0m32s | 0m49s | 20m03s | 0m03s | 0m20s | 7/127 | A |
|  | [99482764839](https://github.com/beep-effect/beep-effect/actions/runs/33390467908/job/99482764839) | [33390467908](https://github.com/beep-effect/beep-effect/actions/runs/33390467908) | `40a0d47490ddaebcfa55310d9aafc641276b1d1d` | 21m53s | 0m01s | 1m19s | 0m51s | 19m24s | 0m03s | 0m16s | 0/134 | A |
|  | [99129670376](https://github.com/beep-effect/beep-effect/actions/runs/33263625457/job/99129670376) | [33263625457](https://github.com/beep-effect/beep-effect/actions/runs/33263625457) | `370d04baf17bed1efdf3698179c6c9ee8080f4cc` | 21m56s | 0m04s | 1m26s | 1m07s | 19m01s | 0m04s | 0m18s | 0/132 | A |
|  | [99594435625](https://github.com/beep-effect/beep-effect/actions/runs/33424399785/job/99594435625) | [33424399785](https://github.com/beep-effect/beep-effect/actions/runs/33424399785) | `9cd781aadb4f152c08fd3b0b326142e6e66d2a50` | 21m56s | 0m04s | 0m36s | 0m50s | 20m04s | 0m03s | 0m23s | 0/134 | A |
|  | [99389929435](https://github.com/beep-effect/beep-effect/actions/runs/33360179551/job/99389929435) | [33360179551](https://github.com/beep-effect/beep-effect/actions/runs/33360179551) | `49679bf304016953a53cb55d80cc72e30d8a75d2` | 21m59s | 0m03s | 1m27s | 0m55s | 19m16s | 0m03s | 0m18s | 0/134 | A |
|  | [99604319942](https://github.com/beep-effect/beep-effect/actions/runs/33427431712/job/99604319942) | [33427431712](https://github.com/beep-effect/beep-effect/actions/runs/33427431712) | `ebaaec6512ddce42e4150478dcbbbbffdbaa35fd` | 22m10s | 0m03s | 1m04s | 0m46s | 20m00s | 0m03s | 0m17s | 0/134 | A |
|  | [99439166640](https://github.com/beep-effect/beep-effect/actions/runs/33376494482/job/99439166640) | [33376494482](https://github.com/beep-effect/beep-effect/actions/runs/33376494482) | `29a6bf5435bc2a3321cda780fa8240485f3bfeb1` | 22m23s | 0m02s | 1m37s | 1m14s | 19m09s | 0m03s | 0m20s | 7/127 | A |
|  | [99387243066](https://github.com/beep-effect/beep-effect/actions/runs/33359236347/job/99387243066) | [33359236347](https://github.com/beep-effect/beep-effect/actions/runs/33359236347) | `16d64c1713194dba4744e2f5866f7dd7832344c2` | 22m33s | 1m26s | 0m29s | 0m50s | 20m54s | 0m03s | 0m17s | 0/133 | A |
|  | [99557099512](https://github.com/beep-effect/beep-effect/actions/runs/33413028909/job/99557099512) | [33413028909](https://github.com/beep-effect/beep-effect/actions/runs/33413028909) | `f3faa15d03481eb37e15f411adf031b17e8a9e93` | 22m41s | 0m04s | 0m42s | 0m53s | 20m43s | 0m04s | 0m19s | 0/134 | A |
|  | [99543501710](https://github.com/beep-effect/beep-effect/actions/runs/33408867250/job/99543501710) | [33408867250](https://github.com/beep-effect/beep-effect/actions/runs/33408867250) | `e86d4f40fb90f109713a80dcb6543b3f58655256` | 23m23s | 0m04s | 1m34s | 1m01s | 20m25s | 0m03s | 0m20s | 0/134 | A |
| Max | [98602443641](https://github.com/beep-effect/beep-effect/actions/runs/33096430477/job/98602443641) | [33096430477](https://github.com/beep-effect/beep-effect/actions/runs/33096430477) | `c7b4732aa21b78508a2cc1dce89aa052d39a054b` | 23m41s | 0m02s | 4m12s | 0m35s | 18m38s | 0m03s | 0m13s | 0/132 | A |

### Current ruleset — Test Unit (p90 23m16s)

| Mark | Job | Run | Head SHA | Wall | Pickup | Cleanup | Setup | Body | Trail | Other | H/M | Cause |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
|  | [98072145058](https://github.com/beep-effect/beep-effect/actions/runs/32934185423/job/98072145058) | [32934185423](https://github.com/beep-effect/beep-effect/actions/runs/32934185423) | `a172f9d7c4d359d6323595d0410ddeed7c392d53` | 23m16s | 1m45s | 1m28s | 0m40s | 20m49s | 0m03s | 0m16s | 0/130 | A |
|  | [98138190376](https://github.com/beep-effect/beep-effect/actions/runs/32956164790/job/98138190376) | [32956164790](https://github.com/beep-effect/beep-effect/actions/runs/32956164790) | `0bf68d27d98ab38c09655652d44e992f3825cd77` | 23m23s | 1m52s | 0m33s | 0m34s | 22m00s | 0m03s | 0m13s | 0/130 | A |
|  | [98391009531](https://github.com/beep-effect/beep-effect/actions/runs/33033474771/job/98391009531) | [33033474771](https://github.com/beep-effect/beep-effect/actions/runs/33033474771) | `6484ed8f7a9d9e8261a7afacbeb361168a3a04f7` | 23m24s | 0m02s | 1m06s | 0m38s | 21m20s | 0m03s | 0m17s | 0/131 | A |
|  | [99387242998](https://github.com/beep-effect/beep-effect/actions/runs/33359236347/job/99387242998) | [33359236347](https://github.com/beep-effect/beep-effect/actions/runs/33359236347) | `16d64c1713194dba4744e2f5866f7dd7832344c2` | 23m30s | 0m02s | 0m25s | 0m44s | 22m01s | 0m03s | 0m17s | 0/133 | A |
|  | [99396734281](https://github.com/beep-effect/beep-effect/actions/runs/33362573151/job/99396734281) | [33362573151](https://github.com/beep-effect/beep-effect/actions/runs/33362573151) | `d0ee14432361ec95dac56a14fccf0a286d115fc9` | 23m31s | 0m01s | 1m06s | 0m48s | 21m19s | 0m03s | 0m15s | 0/133 | A |
|  | [99398926096](https://github.com/beep-effect/beep-effect/actions/runs/33363349858/job/99398926096) | [33363349858](https://github.com/beep-effect/beep-effect/actions/runs/33363349858) | `3cf349106b544b86b2b08c87c1985bd36dc4678b` | 23m31s | 0m03s | 0m55s | 0m46s | 21m32s | 0m04s | 0m14s | 0/134 | A |
|  | [99106207151](https://github.com/beep-effect/beep-effect/actions/runs/33254674212/job/99106207151) | [33254674212](https://github.com/beep-effect/beep-effect/actions/runs/33254674212) | `672471999b6554ebd61706839fc377f2578ff909` | 23m32s | 0m03s | 1m20s | 0m41s | 21m09s | 0m04s | 0m18s | 0/132 | A |
|  | [99307637186](https://github.com/beep-effect/beep-effect/actions/runs/33330324462/job/99307637186) | [33330324462](https://github.com/beep-effect/beep-effect/actions/runs/33330324462) | `aa6c8505e99578c85826e705bf2bd5c1722949a7` | 23m53s | 0m40s | 1m10s | 0m44s | 21m40s | 0m03s | 0m16s | 0/132 | A |
|  | [99228446275](https://github.com/beep-effect/beep-effect/actions/runs/33299981067/job/99228446275) | [33299981067](https://github.com/beep-effect/beep-effect/actions/runs/33299981067) | `8733d894e05f8f4fdd974263a31c83f4f25d521d` | 23m56s | 1m55s | 0m43s | 0m48s | 22m03s | 0m05s | 0m17s | 0/132 | A |
|  | [99143484316](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484316) | [33268807916](https://github.com/beep-effect/beep-effect/actions/runs/33268807916) | `fc984a2a0279915d9093fceebacb251202d20cbc` | 24m05s | 0m02s | 1m10s | 0m49s | 21m45s | 0m04s | 0m17s | 0/132 | A |
|  | [98076310731](https://github.com/beep-effect/beep-effect/actions/runs/32935671416/job/98076310731) | [32935671416](https://github.com/beep-effect/beep-effect/actions/runs/32935671416) | `e8a23c527e8b4e4ef38c2e761f213992db17034e` | 24m07s | 1m28s | 1m13s | 0m34s | 22m05s | 0m02s | 0m13s | 0/130 | A |
|  | [99221174575](https://github.com/beep-effect/beep-effect/actions/runs/33298107866/job/99221174575) | [33298107866](https://github.com/beep-effect/beep-effect/actions/runs/33298107866) | `66a25fa4029ff233b46c2038844adae6c3706a61` | 24m09s | 13m32s | 1m24s | 0m48s | 21m41s | 0m03s | 0m13s | 0/132 | A |
|  | [99557099544](https://github.com/beep-effect/beep-effect/actions/runs/33413028909/job/99557099544) | [33413028909](https://github.com/beep-effect/beep-effect/actions/runs/33413028909) | `f3faa15d03481eb37e15f411adf031b17e8a9e93` | 24m13s | 0m02s | 0m34s | 0m45s | 22m34s | 0m03s | 0m17s | 0/134 | A |
|  | [99580487217](https://github.com/beep-effect/beep-effect/actions/runs/33420195914/job/99580487217) | [33420195914](https://github.com/beep-effect/beep-effect/actions/runs/33420195914) | `83108fa750f7b2818a8b82c6336a82353c476413` | 24m14s | 0m02s | 0m44s | 0m43s | 22m27s | 0m03s | 0m17s | 0/134 | A |
|  | [98102361795](https://github.com/beep-effect/beep-effect/actions/runs/32944543287/job/98102361795) | [32944543287](https://github.com/beep-effect/beep-effect/actions/runs/32944543287) | `8294eb45a4dc98f62861128a10405ccd22a74a23` | 24m18s | 0m02s | 1m33s | 0m39s | 21m46s | 0m03s | 0m17s | 0/130 | A |
|  | [99371425592](https://github.com/beep-effect/beep-effect/actions/runs/33353590423/job/99371425592) | [33353590423](https://github.com/beep-effect/beep-effect/actions/runs/33353590423) | `d0f6bc7bd72db0eb22bfa7b35c949608bc1b49ce` | 24m22s | 0m59s | 1m40s | 0m56s | 21m26s | 0m03s | 0m17s | 0/133 | A |
|  | [99380835114](https://github.com/beep-effect/beep-effect/actions/runs/33356926390/job/99380835114) | [33356926390](https://github.com/beep-effect/beep-effect/actions/runs/33356926390) | `3ebf2a61ae6500776f537f6362aa8fc748e84886` | 24m23s | 8m34s | 1m37s | 0m57s | 21m28s | 0m03s | 0m18s | 0/133 | A |
|  | [99189209461](https://github.com/beep-effect/beep-effect/actions/runs/33285999259/job/99189209461) | [33285999259](https://github.com/beep-effect/beep-effect/actions/runs/33285999259) | `2343d38ee62046dcc70f8100d452a7a7d20f6f2f` | 24m37s | 2m45s | 0m50s | 0m39s | 22m46s | 0m03s | 0m19s | 0/132 | A |
|  | [99193133462](https://github.com/beep-effect/beep-effect/actions/runs/33287499456/job/99193133462) | [33287499456](https://github.com/beep-effect/beep-effect/actions/runs/33287499456) | `9b40e17c250d8e419d937385612be9475975190d` | 24m44s | 0m02s | 1m19s | 0m43s | 22m25s | 0m03s | 0m14s | 0/132 | A |
| P95 | [99318411626](https://github.com/beep-effect/beep-effect/actions/runs/33334320936/job/99318411626) | [33334320936](https://github.com/beep-effect/beep-effect/actions/runs/33334320936) | `5ec2a09844372de968e7c4fd32bce1273597b4d5` | 24m50s | 1m51s | 0m33s | 0m46s | 23m11s | 0m04s | 0m16s | 0/133 | A |
|  | [98401219572](https://github.com/beep-effect/beep-effect/actions/runs/33036833166/job/98401219572) | [33036833166](https://github.com/beep-effect/beep-effect/actions/runs/33036833166) | `cab548b9f6b93b64f88c32746cd87068025514e1` | 25m00s | 1m18s | 1m31s | 0m39s | 22m29s | 0m03s | 0m18s | 0/131 | A |
|  | [99476855684](https://github.com/beep-effect/beep-effect/actions/runs/33388631137/job/99476855684) | [33388631137](https://github.com/beep-effect/beep-effect/actions/runs/33388631137) | `09ad07d1fceca4e0f595dcdd7a56f422bde0ba3e` | 25m00s | 1m10s | 4m53s | 1m34s | 18m12s | 0m03s | 0m18s | 0/134 | A |
|  | [98571841670](https://github.com/beep-effect/beep-effect/actions/runs/33087714486/job/98571841670) | [33087714486](https://github.com/beep-effect/beep-effect/actions/runs/33087714486) | `489a66841b143ad77517efddf54c700790352695` | 25m06s | 0m02s | 3m31s | 0m40s | 20m36s | 0m03s | 0m16s | 0/131 | A |
|  | [99426473847](https://github.com/beep-effect/beep-effect/actions/runs/33372476586/job/99426473847) | [33372476586](https://github.com/beep-effect/beep-effect/actions/runs/33372476586) | `e76c4db079e62155b1c03e8b77a8b210cac6e1d2` | 25m11s | 9m01s | 1m22s | 0m44s | 22m44s | 0m04s | 0m17s | 0/134 | A |
|  | [99433558650](https://github.com/beep-effect/beep-effect/actions/runs/33374732671/job/99433558650) | [33374732671](https://github.com/beep-effect/beep-effect/actions/runs/33374732671) | `c6d9cf280b1b82ca57b306888eae09de3a6909d7` | 25m18s | 1m28s | 0m47s | 1m15s | 22m53s | 0m04s | 0m19s | 0/134 | A |
|  | [99482764759](https://github.com/beep-effect/beep-effect/actions/runs/33390467908/job/99482764759) | [33390467908](https://github.com/beep-effect/beep-effect/actions/runs/33390467908) | `40a0d47490ddaebcfa55310d9aafc641276b1d1d` | 25m27s | 0m01s | 0m29s | 0m45s | 23m55s | 0m03s | 0m15s | 0/134 | A |
|  | [99604319761](https://github.com/beep-effect/beep-effect/actions/runs/33427431712/job/99604319761) | [33427431712](https://github.com/beep-effect/beep-effect/actions/runs/33427431712) | `ebaaec6512ddce42e4150478dcbbbbffdbaa35fd` | 25m27s | 0m03s | 1m20s | 0m52s | 22m53s | 0m03s | 0m19s | 0/134 | A |
|  | [99389929641](https://github.com/beep-effect/beep-effect/actions/runs/33360179551/job/99389929641) | [33360179551](https://github.com/beep-effect/beep-effect/actions/runs/33360179551) | `49679bf304016953a53cb55d80cc72e30d8a75d2` | 25m37s | 0m03s | 1m22s | 0m47s | 23m06s | 0m03s | 0m19s | 0/134 | A |
|  | [99594435672](https://github.com/beep-effect/beep-effect/actions/runs/33424399785/job/99594435672) | [33424399785](https://github.com/beep-effect/beep-effect/actions/runs/33424399785) | `9cd781aadb4f152c08fd3b0b326142e6e66d2a50` | 25m40s | 0m08s | 2m33s | 1m13s | 21m28s | 0m06s | 0m20s | 0/134 | A |
|  | [99226059818](https://github.com/beep-effect/beep-effect/actions/runs/33299942141/job/99226059818) | [33299942141](https://github.com/beep-effect/beep-effect/actions/runs/33299942141) | `bdef06dab805673149313a79d881f9d787364eca` | 25m57s | 1m28s | 0m45s | 0m43s | 24m12s | 0m03s | 0m14s | 0/132 | A |
|  | [98557316297](https://github.com/beep-effect/beep-effect/actions/runs/33083654667/job/98557316297) | [33083654667](https://github.com/beep-effect/beep-effect/actions/runs/33083654667) | `6d9a60bbca40cea0b584dcdae1dc78d17c26744f` | 26m13s | 2m34s | 3m42s | 0m33s | 21m43s | 0m02s | 0m13s | 0/131 | A |
|  | [99311000237](https://github.com/beep-effect/beep-effect/actions/runs/33331604024/job/99311000237) | [33331604024](https://github.com/beep-effect/beep-effect/actions/runs/33331604024) | `889eb895afd5a131e83ef9c6fd0bde2447bb9063` | 26m44s | 2m35s | 1m28s | 0m47s | 24m08s | 0m05s | 0m16s | 0/132 | A |
|  | [99417157064](https://github.com/beep-effect/beep-effect/actions/runs/33369478456/job/99417157064) | [33369478456](https://github.com/beep-effect/beep-effect/actions/runs/33369478456) | `019be8a8c21cbdde0dac7d5263f7dd6252f26e9a` | 27m02s | 9m58s | 1m04s | 0m39s | 24m57s | 0m03s | 0m19s | 0/134 | A |
|  | [99101643281](https://github.com/beep-effect/beep-effect/actions/runs/33252939043/job/99101643281) | [33252939043](https://github.com/beep-effect/beep-effect/actions/runs/33252939043) | `e048b41d2962a79e07837d3d450f5e772ffd70d2` | 27m13s | 0m02s | 1m33s | 0m35s | 24m47s | 0m03s | 0m15s | 0/132 | A |
|  | [99377678675](https://github.com/beep-effect/beep-effect/actions/runs/33355828011/job/99377678675) | [33355828011](https://github.com/beep-effect/beep-effect/actions/runs/33355828011) | `4ba6ba68e53aa58891f9d8a7f1ae74d2ca051102` | 27m15s | 16m00s | 1m24s | 0m48s | 24m45s | 0m03s | 0m15s | 0/133 | A |
|  | [99424379222](https://github.com/beep-effect/beep-effect/actions/runs/33371782848/job/99424379222) | [33371782848](https://github.com/beep-effect/beep-effect/actions/runs/33371782848) | `7edf9f70330c3d3a326cfc327d40b1f28906b538` | 27m17s | 0m02s | 0m39s | 0m47s | 25m31s | 0m04s | 0m16s | 0/134 | A |
|  | [99439166687](https://github.com/beep-effect/beep-effect/actions/runs/33376494482/job/99439166687) | [33376494482](https://github.com/beep-effect/beep-effect/actions/runs/33376494482) | `29a6bf5435bc2a3321cda780fa8240485f3bfeb1` | 27m42s | 1m36s | 0m42s | 0m48s | 25m49s | 0m04s | 0m19s | 0/134 | A |
|  | [99469751624](https://github.com/beep-effect/beep-effect/actions/runs/33386354937/job/99469751624) | [33386354937](https://github.com/beep-effect/beep-effect/actions/runs/33386354937) | `8c0239711f2d7afec5b3c1e2eeb719a553b4017d` | 28m37s | 0m03s | 1m27s | 0m52s | 25m55s | 0m04s | 0m19s | 0/134 | A |
| Max | [99440363192](https://github.com/beep-effect/beep-effect/actions/runs/33376913238/job/99440363192) | [33376913238](https://github.com/beep-effect/beep-effect/actions/runs/33376913238) | `27318473461ed35e2cba8e623dd70d912fb72b56` | 31m17s | 2m27s | 0m49s | 0m53s | 29m16s | 0m04s | 0m15s | 0/134 | A |

## Representative log subset

Eight deterministic observations per lane/week (p90, p92, p94, p95, p96,
p98, p99, max) were selected before log parsing; ties de-duplicate. All four
sets retain at least eight and include the exact p95 and maximum. Logs were
also parsed for the remaining tails so every cause code above uses the same
cache evidence. Task duration is the greater of the stream prefix's first-to-
last timestamp span and an explicit Vitest/linter duration in that task.

| Week | Lane | Mark | Job | Tasks H/M | Root/lock inputs changed | Five longest tasks |
| --- | --- | --- | --- | ---: | --- | --- |
| Representative | Lint | sample | [98175445645](https://github.com/beep-effect/beep-effect/actions/runs/32968142800/job/98175445645) | 131 0/131 | `bun.lock`, `package.json`, `tsconfig.json`, `tsconfig.packages.json`, `turbo.json` | `@beep/fc-runs#lint` 0m12s MISS; `@beep/repo-cli#lint` 0m12s MISS; `@beep/types#lint` 0m12s MISS; `@beep/agents-client#lint` 0m11s MISS; `@beep/agents-server#lint` 0m11s MISS |
| Representative | Lint | sample | [97923284182](https://github.com/beep-effect/beep-effect/actions/runs/32885002967/job/97923284182) | 129 0/129 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m18s MISS; `@beep/fc-runs#lint` 0m17s MISS; `@beep/types#lint` 0m17s MISS; `@beep/acp#lint` 0m16s MISS; `@beep/api-transport#lint` 0m16s MISS |
| Representative | Lint | sample | [99143484282](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484282) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m20s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/types#lint` 0m18s MISS; `@beep/documents-use-cases#lint` 0m16s MISS; `@beep/epistemic-domain#lint` 0m16s MISS |
| Representative | Lint | P95 | [98391009540](https://github.com/beep-effect/beep-effect/actions/runs/33033474771/job/98391009540) | 131 0/131 | `tsconfig.json` | `@beep/repo-cli#lint` 0m19s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/types#lint` 0m18s MISS; `@beep/agents-server#lint` 0m16s MISS; `@beep/anthropic#lint` 0m16s MISS |
| Representative | Lint | sample | [99043490760](https://github.com/beep-effect/beep-effect/actions/runs/33230919209/job/99043490760) | 132 0/132 | `tsconfig.json`, `turbo.json`, `vitest.setup.ts` | `@beep/repo-cli#lint` 0m19s MISS; `@beep/fc-runs#lint` 0m17s MISS; `@beep/types#lint` 0m17s MISS; `@beep/ai-provider-cli#lint` 0m16s MISS; `@beep/ai-sync#lint` 0m16s MISS |
| Representative | Lint | sample | [99125421606](https://github.com/beep-effect/beep-effect/actions/runs/33262001775/job/99125421606) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m20s MISS; `@beep/fc-runs#lint` 0m19s MISS; `@beep/types#lint` 0m19s MISS; `@beep/ontology-config#lint` 0m17s MISS; `@beep/pacer#lint` 0m17s MISS |
| Representative | Lint | sample | [98298650113](https://github.com/beep-effect/beep-effect/actions/runs/33005670001/job/98298650113) | 131 0/131 | `bun.lock`, `tsconfig.json` | `@beep/repo-cli#lint` 0m20s MISS; `@beep/documents-use-cases#lint` 0m18s MISS; `@beep/editor#lint` 0m18s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/html#lint` 0m18s MISS |
| Representative | Lint | Max | [98602443641](https://github.com/beep-effect/beep-effect/actions/runs/33096430477/job/98602443641) | 132 0/132 | `bun.lock`, `package.json`, `tsconfig.json`, `tsconfig.packages.json` | `@beep/repo-cli#lint` 0m20s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/types#lint` 0m18s MISS; `@beep/colors#lint` 0m17s MISS; `@beep/editor#lint` 0m17s MISS |
| Representative | Test Unit | sample | [98165712754](https://github.com/beep-effect/beep-effect/actions/runs/32965086775/job/98165712754) | 130 0/130 | `bun.lock` | `@beep/repo-cli#test` 9m14s MISS; `@beep/professional-desktop#test` 2m12s MISS; `@beep/law-practice-server#test` 1m06s MISS; `@beep/repo-ai-metrics#test` 0m42s MISS; `@beep/editor#test` 0m41s MISS |
| Representative | Test Unit | sample | [97264522707](https://github.com/beep-effect/beep-effect/actions/runs/32668069065/job/97264522707) | 128 0/128 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 12m54s MISS; `@beep/professional-desktop#test` 1m47s MISS; `@beep/law-practice-server#test` 0m56s MISS; `@beep/repo-ai-metrics#test` 0m49s MISS; `@beep/schema#test` 0m38s MISS |
| Representative | Test Unit | sample | [99056589150](https://github.com/beep-effect/beep-effect/actions/runs/33235653788/job/99056589150) | 132 0/132 | `bun.lock` | `@beep/repo-cli#test` 8m19s MISS; `@beep/professional-desktop#test` 1m57s MISS; `@beep/law-practice-server#test` 1m00s MISS; `@beep/repo-utils#test` 0m46s MISS; `@beep/editor#test` 0m37s MISS |
| Representative | Test Unit | P95 | [98745268142](https://github.com/beep-effect/beep-effect/actions/runs/33138943530/job/98745268142) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 8m47s MISS; `@beep/professional-desktop#test` 1m36s MISS; `@beep/law-practice-server#test` 1m04s MISS; `@beep/editor#test` 0m55s MISS; `@beep/lexical-schema#test` 0m36s MISS |
| Representative | Test Unit | sample | [99117188535](https://github.com/beep-effect/beep-effect/actions/runs/33258847437/job/99117188535) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 11m54s MISS; `@beep/professional-desktop#test` 2m05s MISS; `@beep/law-practice-server#test` 1m00s MISS; `@beep/repo-ai-metrics#test` 0m54s MISS; `@beep/schema#test` 0m40s MISS |
| Representative | Test Unit | sample | [99143484316](https://github.com/beep-effect/beep-effect/actions/runs/33268807916/job/99143484316) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 13m13s MISS; `@beep/professional-desktop#test` 1m50s MISS; `@beep/law-practice-server#test` 1m00s MISS; `@beep/repo-ai-metrics#test` 0m48s MISS; `@beep/repo-utils#test` 0m48s MISS |
| Representative | Test Unit | sample | [98401219572](https://github.com/beep-effect/beep-effect/actions/runs/33036833166/job/98401219572) | 131 0/131 | `tsconfig.json` | `@beep/repo-cli#test` 7m36s MISS; `@beep/professional-desktop#test` 2m24s MISS; `@beep/law-practice-server#test` 1m10s MISS; `@beep/editor#test` 0m50s MISS; `@beep/schema#test` 0m49s MISS |
| Representative | Test Unit | Max | [99101643281](https://github.com/beep-effect/beep-effect/actions/runs/33252939043/job/99101643281) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 8m15s MISS; `@beep/professional-desktop#test` 2m27s MISS; `@beep/law-practice-server#test` 1m09s MISS; `@beep/repo-ai-metrics#test` 0m53s MISS; `@beep/editor#test` 0m47s MISS |
| Current ruleset | Lint | sample | [98153757903](https://github.com/beep-effect/beep-effect/actions/runs/32961202470/job/98153757903) | 131 0/131 | `bun.lock`, `package.json`, `tsconfig.json`, `tsconfig.packages.json`, `turbo.json` | `@beep/repo-cli#lint` 0m19s MISS; `@beep/fc-runs#lint` 0m17s MISS; `@beep/types#lint` 0m17s MISS; `@beep/brand#lint` 0m16s MISS; `@beep/codegen-kit#lint` 0m16s MISS |
| Current ruleset | Lint | sample | [99134858454](https://github.com/beep-effect/beep-effect/actions/runs/33265551233/job/99134858454) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m21s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/types#lint` 0m18s MISS; `@beep/law-practice-domain#lint` 0m17s MISS; `@beep/nlp-processing#lint` 0m17s MISS |
| Current ruleset | Lint | sample | [99043490760](https://github.com/beep-effect/beep-effect/actions/runs/33230919209/job/99043490760) | 132 0/132 | `tsconfig.json`, `turbo.json`, `vitest.setup.ts` | `@beep/repo-cli#lint` 0m19s MISS; `@beep/fc-runs#lint` 0m17s MISS; `@beep/types#lint` 0m17s MISS; `@beep/ai-provider-cli#lint` 0m16s MISS; `@beep/ai-sync#lint` 0m16s MISS |
| Current ruleset | Lint | P95 | [99417156953](https://github.com/beep-effect/beep-effect/actions/runs/33369478456/job/99417156953) | 134 0/134 | `turbo.json` | `@beep/repo-cli#lint` 0m22s MISS; `@beep/todox#lint` 0m19s MISS; `@beep/types#lint` 0m19s MISS; `@beep/codegen-kit#lint` 0m17s MISS; `@beep/colors#lint` 0m17s MISS |
| Current ruleset | Lint | sample | [99222826071](https://github.com/beep-effect/beep-effect/actions/runs/33298733552/job/99222826071) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m22s MISS; `@beep/fc-runs#lint` 0m19s MISS; `@beep/types#lint` 0m19s MISS; `@beep/ontology-config#lint` 0m17s MISS; `@beep/test-utils#lint` 0m17s MISS |
| Current ruleset | Lint | sample | [99482764839](https://github.com/beep-effect/beep-effect/actions/runs/33390467908/job/99482764839) | 134 0/134 | `bun.lock`, `package.json` | `@beep/repo-cli#lint` 0m21s MISS; `@beep/fc-runs#lint` 0m19s MISS; `@beep/todox#lint` 0m19s MISS; `@beep/ontology-config#lint` 0m17s MISS; `@beep/test-utils#lint` 0m17s MISS |
| Current ruleset | Lint | sample | [99439166640](https://github.com/beep-effect/beep-effect/actions/runs/33376494482/job/99439166640) | 134 7/127 | `bun.lock`, `tsconfig.json` | `@beep/repo-cli#lint` 0m22s MISS; `@beep/colors#lint` 0m18s MISS; `@beep/obs#lint` 0m18s MISS; `@beep/agents-tables#lint` 0m17s MISS; `@beep/anthropic#lint` 0m17s MISS |
| Current ruleset | Lint | Max | [98602443641](https://github.com/beep-effect/beep-effect/actions/runs/33096430477/job/98602443641) | 132 0/132 | `bun.lock`, `package.json`, `tsconfig.json`, `tsconfig.packages.json` | `@beep/repo-cli#lint` 0m20s MISS; `@beep/fc-runs#lint` 0m18s MISS; `@beep/types#lint` 0m18s MISS; `@beep/colors#lint` 0m17s MISS; `@beep/editor#lint` 0m17s MISS |
| Current ruleset | Test Unit | sample | [98072145058](https://github.com/beep-effect/beep-effect/actions/runs/32934185423/job/98072145058) | 130 0/130 | `tsconfig.json` | `@beep/repo-cli#test` 11m57s MISS; `@beep/professional-desktop#test` 2m08s MISS; `@beep/law-practice-server#test` 0m55s MISS; `@beep/editor#test` 0m43s MISS; `@beep/observability#test` 0m43s MISS |
| Current ruleset | Test Unit | sample | [99307637186](https://github.com/beep-effect/beep-effect/actions/runs/33330324462/job/99307637186) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 13m22s MISS; `@beep/professional-desktop#test` 1m56s MISS; `@beep/repo-ai-metrics#test` 0m57s MISS; `@beep/law-practice-server#test` 0m50s MISS; `@beep/editor#test` 0m44s MISS |
| Current ruleset | Test Unit | sample | [99371425592](https://github.com/beep-effect/beep-effect/actions/runs/33353590423/job/99371425592) | 133 0/133 | `tsconfig.base.json` | `@beep/repo-cli#test` 14m32s MISS; `@beep/professional-desktop#test` 1m42s MISS; `@beep/law-practice-server#test` 0m52s MISS; `@beep/repo-ai-metrics#test` 0m46s MISS; `@beep/editor#test` 0m44s MISS |
| Current ruleset | Test Unit | P95 | [99318411626](https://github.com/beep-effect/beep-effect/actions/runs/33334320936/job/99318411626) | 133 0/133 | `bun.lock`, `package.json`, `tsconfig.packages.json` | `@beep/repo-cli#test` 11m57s MISS; `@beep/professional-desktop#test` 2m03s MISS; `@beep/law-practice-server#test` 1m00s MISS; `@beep/editor#test` 0m58s MISS; `@beep/repo-utils#test` 0m45s MISS |
| Current ruleset | Test Unit | sample | [99426473847](https://github.com/beep-effect/beep-effect/actions/runs/33372476586/job/99426473847) | 134 0/134 | `turbo.json` | `@beep/repo-cli#test` 10m52s MISS; `@beep/professional-desktop#test` 2m06s MISS; `@beep/law-practice-server#test` 1m07s MISS; `@beep/repo-ai-metrics#test` 0m57s MISS; `@beep/repo-utils#test` 0m47s MISS |
| Current ruleset | Test Unit | sample | [99311000237](https://github.com/beep-effect/beep-effect/actions/runs/33331604024/job/99311000237) | 132 0/132 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 9m49s MISS; `@beep/professional-desktop#test` 2m08s MISS; `@beep/law-practice-server#test` 1m06s MISS; `@beep/repo-ai-metrics#test` 0m55s MISS; `@beep/editor#test` 0m42s MISS |
| Current ruleset | Test Unit | sample | [99424379222](https://github.com/beep-effect/beep-effect/actions/runs/33371782848/job/99424379222) | 134 0/134 | `bun.lock`, `tsconfig.json` | `@beep/repo-cli#test` 9m23s MISS; `@beep/professional-desktop#test` 2m08s MISS; `@beep/law-practice-server#test` 1m00s MISS; `@beep/repo-ai-metrics#test` 0m54s MISS; `@beep/editor#test` 0m47s MISS |
| Current ruleset | Test Unit | Max | [99440363192](https://github.com/beep-effect/beep-effect/actions/runs/33376913238/job/99440363192) | 134 0/134 | `bun.lock`, `package.json` | `@beep/repo-cli#test` 14m39s MISS; `@beep/professional-desktop#test` 2m50s MISS; `@beep/law-practice-server#test` 1m07s MISS; `@beep/observability#test` 1m06s MISS; `@beep/repo-ai-metrics#test` 1m05s MISS |

The selected current Test Unit jobs put `@beep/repo-cli#test` between 9m23s
and 14m39s; across all 39 current tails its p50/p95/max is
11m04s/14m39s/14m49s. Lint has no comparable single package: its selected
longest tasks are only about 18–22 seconds, so its tail is aggregate
concurrency-two cold work rather than a package long pole.

## Test Unit attempt-one failure attribution

Failures remain outside every percentile. Each cluster below is the first
parsed Vitest failing file/assertion for the job; the example links to the
exact failed job. Jobs with an unparsed assertion are clustered by Turbo task.

### Representative — 55 failures

| Failing test/assertion cluster | Jobs | Example |
| --- | ---: | --- |
| `test/quality-tasks.test.ts > quality task adapter > runs every cheap gate through the collected runner when all lanes pass` | 38 | [98163541717](https://github.com/beep-effect/beep-effect/actions/runs/32964375539/job/98163541717) |
| `test/mermaid-race.test.tsx > Mermaid async ownership > keeps same-page diagrams with identical internal IDs isolated` | 3 | [97286043943](https://github.com/beep-effect/beep-effect/actions/runs/32676697075/job/97286043943) |
| `test/quality-tasks.test.ts > quality task adapter > quarantines distinct TS2589 tasks exposed by resumed lane runs` | 3 | [98244009822](https://github.com/beep-effect/beep-effect/actions/runs/32989638524/job/98244009822) |
| `task exit without parsed assertion: @beep/repo-ai-metrics#test` | 2 | [97435196731](https://github.com/beep-effect/beep-effect/actions/runs/32728525154/job/97435196731) |
| `test/goals-bootstrap-plan.test.ts > goals adopt --plan index parity > regenerating the index around a retain-only pilot plan produces the tracked bytes` | 2 | [97978794837](https://github.com/beep-effect/beep-effect/actions/runs/32902321098/job/97978794837) |
| `test/quality-tasks.test.ts > quality task adapter > carries a quarantine package filter into the nested check lane's Turbo invocation` | 2 | [98748996632](https://github.com/beep-effect/beep-effect/actions/runs/33140161447/job/98748996632) |
| `test/yeet-inbox-hook-adapter.test.ts > Yeet inbox harness adapter > fences a live non-owner and CAS-takes over a dead published-PR owner` | 2 | [99138613766](https://github.com/beep-effect/beep-effect/actions/runs/33266964280/job/99138613766) |
| `test/quality-tasks.test.ts > quality task adapter > holds an unchanged package without a comparison base and replaces it after a dirty package change` | 1 | [97543865568](https://github.com/beep-effect/beep-effect/actions/runs/32762346991/job/97543865568) |
| `test/step-capture-lifecycle.test.ts > StepExec capture pipe lifecycle > keeps a cross-process nested StepExec child in the registered outer process group` | 1 | [99118721737](https://github.com/beep-effect/beep-effect/actions/runs/33259435408/job/99118721737) |
| `test/yeet-pr-lease-watcher.test.ts > Yeet PR lease watcher > requires stale live P0 evidence and CAS-transfers a dead owner to a resumed fixer` | 1 | [99127403341](https://github.com/beep-effect/beep-effect/actions/runs/33262751577/job/99127403341) |

### Current ruleset — 63 failures

| Failing test/assertion cluster | Jobs | Example |
| --- | ---: | --- |
| `test/quality-tasks.test.ts > quality task adapter > runs every cheap gate through the collected runner when all lanes pass` | 43 | [98163541717](https://github.com/beep-effect/beep-effect/actions/runs/32964375539/job/98163541717) |
| `test/quality-tasks.test.ts > quality task adapter > quarantines distinct TS2589 tasks exposed by resumed lane runs` | 3 | [98244009822](https://github.com/beep-effect/beep-effect/actions/runs/32989638524/job/98244009822) |
| `test/Libpff.pffexport.test.ts > makePffexportFileProcessingEngine > uses a standard-root env interpreter without an additional runtime bind` | 2 | [99255187085](https://github.com/beep-effect/beep-effect/actions/runs/33310715145/job/99255187085) |
| `test/mermaid-race.test.tsx > Mermaid async ownership > keeps same-page diagrams with identical internal IDs isolated` | 2 | [98134116204](https://github.com/beep-effect/beep-effect/actions/runs/32954837281/job/98134116204) |
| `test/quality-tasks.test.ts > quality task adapter > carries a quarantine package filter into the nested check lane's Turbo invocation` | 2 | [98748996632](https://github.com/beep-effect/beep-effect/actions/runs/33140161447/job/98748996632) |
| `test/yeet-inbox-hook-adapter.test.ts > Yeet inbox harness adapter > fences a live non-owner and CAS-takes over a dead published-PR owner` | 2 | [99138613766](https://github.com/beep-effect/beep-effect/actions/runs/33266964280/job/99138613766) |
| `task exit without parsed assertion: @beep/repo-ai-metrics#test` | 1 | [98163927640](https://github.com/beep-effect/beep-effect/actions/runs/32964501362/job/98163927640) |
| `test/corpus-command.test.ts > corpus restoration preservation > recopies a same-size source that stabilizes after changing in flight` | 1 | [99371149058](https://github.com/beep-effect/beep-effect/actions/runs/33353495059/job/99371149058) |
| `test/Md.test.ts > @beep/md > renders every schema-derived SafeDocument without failing` | 1 | [99448797447](https://github.com/beep-effect/beep-effect/actions/runs/33379631168/job/99448797447) |
| `test/quality-scheduler.test.ts > quality-scheduler > gives publish priority over a newer verify but lets an aged verify keep its place` | 1 | [99296300244](https://github.com/beep-effect/beep-effect/actions/runs/33325423668/job/99296300244) |
| `test/restoration-transformations-coverage.test.ts > restoration transformation semantic helpers > fails closed on genuine legacy fidelity loss and mid-conversion source drift` | 1 | [99250458602](https://github.com/beep-effect/beep-effect/actions/runs/33308961674/job/99250458602) |
| `test/run-turn-reconciliation.test.ts > assistant turn reconciliation > keeps failed prompts non-sendable while receipt evidence is uncertain` | 1 | [99406215092](https://github.com/beep-effect/beep-effect/actions/runs/33365846272/job/99406215092) |
| `test/step-capture-lifecycle.test.ts > StepExec capture pipe lifecycle > keeps a cross-process nested StepExec child in the registered outer process group` | 1 | [99118721737](https://github.com/beep-effect/beep-effect/actions/runs/33259435408/job/99118721737) |
| `test/yeet-pr-lease-watcher.test.ts > Yeet PR lease watcher > requires stale live P0 evidence and CAS-transfers a dead owner to a resumed fixer` | 1 | [99127403341](https://github.com/beep-effect/beep-effect/actions/runs/33262751577/job/99127403341) |
| `test/yeet.test.ts > yeet planner > requires a publish message unless the run is an amend that keeps the existing subject` | 1 | [99214792174](https://github.com/beep-effect/beep-effect/actions/runs/33295657023/job/99214792174) |

The prior 43/44 statement described the partial current-ruleset capture. In
the complete windows, the stale `quality-tasks.test.ts` assertion accounts
for 38/55 representative-week failures and 43/63 current-week failures; the
later current-week jobs add 20 failures across 14 other clusters, including
one `quality-scheduler.test.ts` ordering assertion. The stale assertion was
`expected ... length 15 but got 13`. `origin/main` now carries
`fde3afad1c` (`fix(repo-cli): model main-push quality posture`), and the current
test checks required command membership instead of that brittle fixed count.
The last stale failure was created at `2026-08-30T05:19:48Z`, before the fix.

## Cache and causal conclusion

`cache-warm.yml` does warm exact-main `build`, `check`, `lint`, and `test`
outputs with remote read-write access. That cannot rescue root/lock
invalidations or novel changed PR tasks: PR waves are intentionally
`remote:r`, while trusted pushes write. In the current p90 tail, only four
Lint jobs (4/87 combined lane tails) are B candidates and no Test Unit tail
is; 83/87 are root-invalidated A. Cache warmth is therefore hygiene, not the
p95 repair. The causal repair must shorten a legitimate zero-hit graph.

## Method

The two run/job corpora use the exact REST join documented in
`current-ruleset-week-p95.md`. p90 is nearest-rank `ceil(0.90*n)` over only
successful attempt-one non-negative job spans. `steps[]` supplies cleanup,
setup, lane-body, and trailing timings. Raw logs were fetched independently:

```bash
gh api --allow-escape-sequences \
  repos/beep-effect/beep-effect/actions/jobs/<job-id>/logs > <job-id>.log
```

For PR jobs, `repos/.../commits/<head>/pulls` supplied the base; push jobs use
the first parent. `repos/.../compare/<base>...<head>` supplied changed files.
One historical PR association was no longer retained, so its first parent was
used only for root-input classification; that wave changed goal docs, not a
root input. Raw NDJSON, logs, compares, and reducers remain outside the repo at
`~/.cache/beep/handoffs/ci-lane-economics/raw/`.
