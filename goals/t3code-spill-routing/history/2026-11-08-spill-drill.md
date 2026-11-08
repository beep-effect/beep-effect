# Spill drill (2026-11-08)

The breach was simulated, because the host was calm. The rule, host check, T3 launch and ledger
entry were real. Environment ids stay in the private handoff.

| Step | Evidence |
| --- | --- |
| Read the signal | `palantiri parcel host-pressure --json` at 2026-11-08T13:43:13Z: `Fresh`; cpu 0.4%, memory 0.5%, io 0.9% (some, avg10); 72.8 of 125.1 GiB available; 0 of 10 admission tokens |
| Simulated breach | cpu `some` avg60 40 (>= 33) and avg300 20 (>= 17); no such load was present |
| Choose a host | `t3_environment_links`: `beep-worker`, first in the order, `reachable` at Full access; it has no one-job limit |
| Launch | `delegate_task` with the `beep-worker` environment id, Claude `claude-opus-5-5` medium, the same pin as without spilling |
| Result | `DRILL HOST=beep-worker T3=v0.1.7-fork.20261108.758 CPUS=4 CPU_PSI=2.23` |
| Ledger | `bun run beep session note --state open --next "Spill drill logged: simulated cpu breach ... chose beep-worker, first in spill order and reachable; launched through T3 delegate_task ..."` wrote the row for this lane |

Not exercised: a real breach, and skipping an unreachable host.
