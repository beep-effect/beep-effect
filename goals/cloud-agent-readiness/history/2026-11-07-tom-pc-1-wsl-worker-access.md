# 2026-11-07: tom-pc-1-wsl gets the fleet's SSH/sudo route and a worker checkout

Sanitized receipt. Tailnet names, addresses, key handles and fingerprints,
pairing tokens and environment ids stay in the private orchestrator handoff.

Recorded on 2026-11-09 from a lane that did the work on 2026-11-07 and never
published it. The packet it was written for, `goals/t3code-fleet-rollout`, has
since been archived, so the receipt lives here with the other worker-host
receipts. Corrections from the 2026-11-09 live state are at the end.

## Why

The 2026-11-06 link left the distro reachable only through the attorney PC's
Windows SSH (`wsl -d t3-agent`), with no sudo path, no workstation wrapper and
no beep-effect checkout. The operator asked for the same arrangement as
dankserver, tbk-ubuntu and tbk-worker: a YubiKey SSH wrapper, touch-to-sudo,
and the host configured as a development worker.

## Access model

tom-pc-1-wsl takes the tbk-worker access model. The distro runs its own
ED25519-SK-only sshd on its tailnet node with tailnet-source `AllowUsers`.
Development and the T3 service run as `agent` (no sudo, no agent forwarding).
Administration uses the separate `agentadmin` account, a distro-only YubiKey
identity in a dedicated workstation agent, and `libpam_rssh` touch-to-sudo,
the same module dankserver and tbk use. Account passwords are locked, so no
password fallback exists.

The decision, with its reversal path, is recorded as
`goals/cloud-agent-readiness/decisions/2026-11-08-tom-pc-1-wsl-takes-the-tbk-worker-access-model-separate-agentadmin-with-touch-to-sudo-agent-without-sudo.md`
and projected into this packet's `SPEC.md` decision log.

## What landed

| Step | Result |
| --- | --- |
| Live read (PC route) | distro `Running`, keep-alive task `Ready`, systemd `running`, `tailscaled` active on the distro's own node, T3 `t3@0.1.7-fork.20261107.2127` active with the pull timer; no sshd, no admin account, no PAM hardware module, `agent` without sudo, no bun/node/mise/gh/op, no checkout |
| PAM module | `libpam_rssh.so` read from dankserver's live module path over the ordinary worker login (SHA-256 `87cd1329…1a88`, the module dankserver and tbk run today; the 2026-10-23 receipt's `fa4cd68d…` digest is the older build), installed under `/lib/x86_64-linux-gnu/security/`, `ldd` fully resolved |
| Workstation identity | new non-resident ED25519-SK key on the existing YubiKey, application `ssh:tom-pc-1-wsl`, no passphrase, authorized only on this distro; its own dedicated `ssh-agent` socket, one key |
| Accounts | `agentadmin` created (group `sudo`); passwords of `agent` and `agentadmin` locked, so a missed touch has no password fallback |
| sudo | `/etc/pam.d/sudo`: `auth sufficient libpam_rssh.so auth_key_file=/etc/security/authorized_keys/${user} cue …` above `common-auth` (the dankserver line); `/etc/security/authorized_keys/agentadmin` root-owned; `sudoers.d/10-ssh-auth-sock` keeps `SSH_AUTH_SOCK` for `agentadmin` only (`visudo -c` OK) |
| sshd | `openssh-server` installed; `05-yubikey-only.conf` (`sk-ssh-ed25519@openssh.com` only, `touch-required`), `70-agent-distro.conf` (`AllowUsers` for both accounts from tailnet IPv4/IPv6 ranges only, no root, no password, no keyboard-interactive, `Match User agentadmin` may forward an agent, `Match User agent` may not and may forward locally to loopback only); keys under `/etc/ssh/authorized_keys/`; `sshd -t` OK, effective `sshd -T` for `agent` confirmed |
| Host key | the distro's ED25519 host key read over the PC route and pinned under alias `tom-pc-1-wsl` in the workstation `known_hosts` (`StrictHostKeyChecking=yes`) |
| Wrapper | `ssh-tom-pc-1-wsl` in the workstation's `.local/bin`, derived from `ssh-tbk-worker`: dedicated agent init under a lock, expected-fingerprint and single-key checks, Plasma touch notification, multiplex reuse detection, `--admin` selects `agentadmin` and forwards the agent. Its versioned copy stays in the operator's private records because it pins the distro's address and key fingerprint |
| Worker side (as `agent`, PC route) | `mise` installed and activated; public clone of `beep-effect/beep-effect` at the same home-relative path as on DankStation; `mise install` from `.bun-version`/`.nvmrc`; `bun install --frozen-lockfile`; `agent-runs.slice` (6 GiB max, 5 GiB high, 256 MiB swap, 300% CPU, 512 tasks: the WSL VM has 4 CPUs / 8 GiB); `t3code.service.d/10-worker-boundary.conf` (`Slice=agent-runs.slice`, `UnsetEnvironment=SSH_AUTH_SOCK OP_*`, explicit PATH); `t3 project add` on the checkout |
| Desktop pairing | `t3 pair --ttl 15m --label dankstation-desktop` in the distro, link rewritten to the distro's Serve address and opened on DankStation for the operator to confirm (client plane; the agent-plane link from 2026-11-06 was still `reachable`) |

## Evidence

| Check | Result |
| --- | --- |
| `ssh-tom-pc-1-wsl 'id; echo ${SSH_AUTH_SOCK:-none}; sudo -n true'` | `uid=1000(agent)`, `none`, `sudo: I'm sorry agent. I'm afraid I can't do that` |
| `ssh-tom-pc-1-wsl --admin -tt 'sudo -k; sudo -n true; sudo id'` | `uid=1001(agentadmin) … 27(sudo)`, forwarded socket present, `sudo -n` refused with "interactive authentication is required", then `[sudo] Touch your YubiKey to authenticate sudo` → `uid=0(root)` |
| `t3_environment_links` | beep-worker, dankserver, tbk-worker, tom-pc-1-wsl all `reachable`, access `auto` |

## Open on 2026-11-07

- No GitHub credential for `agent`: the checkout was the public clone, fetch
  only.
- No 1Password agent credential for `agent` (`op` absent); `BEEP_SECRETS`
  reads are not available on this host.
- The PC's Windows SSH stays the recovery route for a distro whose sshd or
  `tailscaled` is down.

## Corrections from the 2026-11-09 live state

- GitHub push now works through a `gh` login for `agent` (added 2026-11-08).
  The 1Password line still holds.
- All fleet links, tom-pc-1-wsl's included, are Full access since 2026-11-08,
  not `auto`.
- Codex, Grok and Muse are signed in alongside Claude. The rest of the
  2026-11-09 state is in
  `goals/cloud-agent-readiness/history/2026-11-09-tom-pc-1-wsl-fleet-parity.md`.
