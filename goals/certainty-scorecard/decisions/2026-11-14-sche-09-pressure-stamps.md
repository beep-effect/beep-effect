---
title: "SCHE-09 slice 2: admitted and released rows carry an optional capacity and host-pressure stamp behind a pressure protocol key"
date: 2026-11-14
lane: "feat/certainty-admission-pressure-fields"
reversal: "Run bun run beep quality scheduler protocol --pressure off to stop the stamps at once; revert the slice-5b PR to remove the key; rows already stamped keep decoding on every revision, which ignores the key."
---

PLAN slice 5b. Admitted rows and v3 released rows gain one optional key, `pressure` (`AdmissionPressureStamp` in `QualityScheduler.schemas.ts`): `capacityTokens`, `activeTokens` (every live lease, the row's own included), `queuedTokens` and `queuedTickets` (the other tickets still waiting), `memAvailableGib`, `psiCpuSome10`, `psiMemorySome10` and `psiIoSome10` (the `some avg10` share of `/proc/pressure/{cpu,memory,io}`, parsed with the host-pressure parcel's `parsePressureFile`), and `unadmittedSliceGib` (`agent-runs.slice` `memory.current` minus the `memory.current` of each live lease owner's cgroup in the slice). The three PSI fields and the slice field are optional and left out when the host cannot give them. The PLAN row names capacity and host pressure; the slice 5 decision (`sche-09-admission-archive`) lists the lever's fields as capacity tokens, MemAvailable, PSI some10 and unadmitted slice memory, so every one of them is stamped.

The facts live on the journal rows, not in unit observations. No unit-observation schema or store exists (SCHE-08 shipped `unit`, `weightSource` and `owner`, not observations), and a separate observation log would mean a second write per transition, a second reader and a join by nonce, where the rows already carry the nonce, pid, attempt and unit. Ontology run-3 ruling 9 parked journal capacity stamps because they fed a re-parked family; SCHE-01, SCHE-02, SCHE-04 and SCHE-07 now read them, and the reopen evidence (40.2 of 97.6 long-wait minutes with one 3-token lease held) cannot be attributed without capacity at admit. The stamp therefore reopens ruling 9 behind its own gate, which stays off until someone turns it on.

How each writer stamps:
- The admitted row has one writer, `promotionAdmissionEvent`, which copies the promotion transition's stamp. `stageSelfLease` reads the stamp once the overshoot check has passed (a rolled-back attempt reads nothing), from the scan, capacity and memory reading the admission was checked against, and persists it on the `lease-published` transition. Recovery of that transition journals the same stamp; a promotion recovered from `prepared` has no reading from its admission instant and journals no stamp.
- The v3 released row has one writer, the release in `runAdmitted`, which reads a fresh read-only scan just before journaling, while its own lease still counts as active. A scan that fails leaves the row unstamped.
- Enqueued, withdrawn, eviction and routing rows are not stamped, and nothing writes v1 releases.

No admission decision reads the stamp: every read is best effort and returns `None` instead of failing. The capacity figures come from the function the scheduler already used, extracted as `capacityTokensFor` and shared by the promotion tick, the lease check, status and the release stamp. Admission order, weights and caps are unchanged.

The gate is a new additive `pressure` key (`off` or `on`, default `off`) on the `yeet-admission-protocol/v2` marker, flipped with `bun run beep quality scheduler protocol --pressure on|off`, rather than the `units` key. The SCHE-08 gate decision puts behind `units` the work kinds and unit variants a pre-SCHE-08 reader quarantines. The stamp needs no reader census: every revision since the journal's first commit (#878) decodes these rows ignoring unknown keys, and its locked rewrite keeps each row's raw line. The stamp does add reads on the promotion path, so it gets its own switch. The mechanics match `units`: an older writer that rewrites the marker drops the key and turns the stamps off, and `writeAdmissionProtocol` changes one gate and keeps the others. As with `units`, once any gate is flipped the marker records `"pressure":"off"` alongside it.

Compatibility evidence, in `packages/tooling/tool/cli/test/quality-scheduler-admission-pressure.test.ts`:
- With every gate off, the lease, ticket, enqueued, admitted, released and withdrawn rows and a published promotion transition match the bytes captured from origin/main's encoder at 653c2cdef18 before any code changed. With only the units gate on, the lease and the enqueued, admitted and released rows match origin/main's units-on bytes.
- With the gate on, the admitted and released rows are origin/main's bytes plus one trailing key.
- Rows without the key decode it as `None` and re-encode byte for byte. A stamp shape this revision cannot decode reads as `None`, and the row still decodes.
- origin/main's reader, slice 3's reader (#3308) and a pre-SCHE-08 reader, each built as #3308 built its pre-unit reader (the row schemas without the keys that revision lacked), decode a stamped row exactly as the unstamped row; a property test checks any stamp.
- A locked rewrite run with each older reader keeps stamped rows byte for byte, both in the journal and in the archive segment it trims them to.
- `quality scheduler history --json` carries the stamps and the text output counts the stamped rows. The ciops lab replays the frozen journal 41 of 41 with a stamp on every admitted and released row. `beep ci certainty` and `yeet economics` fold no admission rows, so they have nothing to read or ignore.

Overhead, from `goals/certainty-scorecard/ops/admission-stamp-overhead.ts`: one sequential run per mode of 100 admissions after 10 warm-ups, on the real filesystem, over a 600-row journal. The host was busy (load average 13 to 20 on 64 cores), so the spread is wide.
- Before (origin/main code): promotion p50 64.7 ms, p95 172.6 ms; release p50 16.0 ms, p95 33.7 ms.
- After, gate off: promotion p50 50.7 ms, p95 60.2 ms; release p50 13.2 ms, p95 17.8 ms. Gate-off code does no extra work, so the gap from the before run is host noise.
- After, gate on: promotion p50 55.9 ms, p95 152.8 ms (max 915.6 ms); release p50 16.4 ms, p95 38.3 ms.

Against gate off on the same code, the stamp added about 5 ms to the promotion p50 and 3 ms to the release p50. A stamp is about 165 bytes on each admitted and released row. The measured journal grew from 174,863 to 211,327 bytes with 220 of its 599 rows stamped, so a fully stamped 600-row journal is about 240 KB (+38%), read and decoded by every locked rewrite.

Rejected:
- Unit observations: no schema or store, and a second write per transition.
- Stamping enqueued rows: the slice names admitted and released rows, and the wait start is already `enqueuedAtMillis`.
- Writing behind `units`: it would wait on a reader census the stamp does not need.
- Writing unconditionally: no byte-identical off state and no overhead switch.
- Whole PSI readings (avg60, avg300, totals, `full` lines): about three times the bytes.
- Stamping the lease file: it is rewritten every heartbeat.
- A time-join with the PSI recorder: that is MEAS-08, PLAN slice 16, and stays planned.
