# Closeout verification (2026-11-08)

Run from DankStation. Environment ids and tailnet names stay in the private handoff. Published
metadata: `latest.json` at `0.1.7-fork.20261108.758`, fork commit `e8bc6f67fd`.

| Host | Installed | Delegated turn (`claude-opus-5-5` medium) | HTTPS from hub | Link | Service |
| --- | --- | --- | --- | --- | --- |
| DankStation (hub) | `0.1.7-fork.20261108.758` | this session | n/a | n/a | desktop app |
| beep-worker | same | ok, 4 CPUs | 200 | reachable, Full access | `active`, timer `active` |
| dankserver | same | ok, 8 CPUs | 200 on 8448 | reachable, Full access | `active`, timer `active` |
| tbk-worker | same | ok, 12 CPUs | 200 | reachable, Full access | `active`, timer `active` |
| tom-pc-1-wsl | same | ok, 4 CPUs | 200 | reachable, Full access | `active`, timer `active` |
| grok-bot | same | ok, 8 CPUs | 200 | reachable when awake, Full access | supervised, no systemd |

tbk-worker's delegated turn was the item its link receipt left open. All links expire 2027-05-07.

## Reboot survival

Each host's boot was read from `uptime -s` and the first `t3code.service` start in that boot's user journal.

| Host | Booted | Service first started | Reading |
| --- | --- | --- | --- |
| beep-worker | 2026-11-07 15:15 local | 7 s later | Survived a real reboot |
| dankserver | 2026-11-07 21:20 UTC | 35 s later | Survived a real reboot |
| tbk-worker | 2026-11-07 22:37 UTC | 19 min later | Not proof: installed in that boot |
| tom-pc-1-wsl | distro 2026-11-07 08:47 local | 4 s later | Distro restart only |

**Not proven:** tbk-worker has not rebooted since install, though the unit is enabled with linger on.
tom-pc-1's Windows last booted 2026-11-01, before this work, so the reboot-and-sign-in path is still
unobserved. That PC is in use, and it was not rebooted for a receipt. grok-bot has no systemd: a true
reboot needs `/workspace/bootstrap/boot.sh` from the Bot terminal, as the runbook says. See `SPEC.md`'s
Exception Ledger.

## Client plane

The operator's 2026-11-08 "Run on" screenshot lists DankStation, beep-worker, dankserver, grok-bot and
tbk-worker, but not tom-pc-1. The agent-plane link to tom-pc-1-wsl is reachable and its delegated turn
passed. The desktop catalog is encrypted, so the reason was not determined here. The acceptance
criterion names Linked environments, which holds. Re-pairing is the runbook's operator step.
