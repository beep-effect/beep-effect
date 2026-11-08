# P0 probe evidence: `beep compute profile` on DankStation

Recorded 2026-11-08 on DankStation (125 GiB installed) from the
`goals/compute-profile-gate-routing` lane, before commit.

## Raw `process.constrainedMemory()` readings

| Runtime | Scope | `process.constrainedMemory()` | `os.totalmem()` | Reading |
| --- | --- | --- | --- | --- |
| Bun | user session (uncapped) | 134351446016 | 134351446016 | equals installed memory, so uncapped |
| Bun | `systemd-run --user --scope -p MemoryHigh=2G` | 2147483648 | 134351446016 | 2 GiB ceiling |
| Node | user session (uncapped) | 18446744073709552000 | 134351446016 | 2^64 sentinel, so uncapped |
| Node | `systemd-run --user --scope -p MemoryHigh=2G` | 2147483648 | 134351446016 | 2 GiB ceiling |

Bun reports installed memory when uncapped and Node reports the 2^64 sentinel.
The probe treats both as "no ceiling", plus `undefined`, `0` and any value at or
above 2^62. Under a `MemoryHigh` scope both runtimes reported the same 2 GiB value
on this host.

## Manual verification

```sh
$ bun run beep compute profile
workstation

$ bun run beep compute profile --json
{"profile":"workstation","source":"probe","ceilingGib":125.1245346069336,"envelopeGib":20,"overrideRequested":null}

$ systemd-run --user --scope -q -p MemoryHigh=2G bun run beep compute profile
worker

$ systemd-run --user --scope -q -p MemoryHigh=2G bun run beep compute profile --json
{"profile":"worker","source":"probe","ceilingGib":2,"envelopeGib":20,"overrideRequested":null}

$ time (bun run beep compute profile --is worker; echo "exit=$?")
exit=1
0.485 total

$ time (bun run beep compute profile --is workstation; echo "exit=$?")
exit=0
0.529 total

$ BEEP_COMPUTE_PROFILE=worker bun run beep compute profile --json
{"profile":"worker","source":"override","ceilingGib":125.1245346069336,"envelopeGib":20,"overrideRequested":"worker"}

$ systemd-run --user --scope -q -p MemoryHigh=2G -E BEEP_COMPUTE_PROFILE=workstation bun run beep compute profile
[beep] BEEP_COMPUTE_PROFILE=workstation ignored: the override may only tighten to worker (probe: worker).
worker

$ BEEP_COMPUTE_PROFILE=bogus bun run beep compute profile; echo "exit=$?"
BEEP_COMPUTE_PROFILE must be one of workstation, worker.
exit=2
```

The `--is` form spends most of its half second on Bun startup and the CLI's lazy
dispatch. It runs no repository scan and no git.

## Not yet measured

The per-gate RSS row for dankserver (D6 evidence) needs a run inside its 7 GiB
worker slice. That run belongs to the P1/P2 lanes that route gates by profile.
