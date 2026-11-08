# 2026-11-07: tbk-worker installed, exposed through Serve and linked

Sanitized receipt. Tailnet names, addresses, pairing tokens and environment
ids stay in the private orchestrator handoff.

## Preconditions met the same day

- The guest's 2026-11-03 protective-stop latch was recovered with a root-only
  receipt and a guarded start, the guest took the kernel and APT fixes of the
  week, and the operator loosened the staking guard after the attestation
  evidence showed no degradation while the VM ran (records in dankstation-ops:
  `chg-tbk-worker-recovery-and-update-20261107`,
  `chg-tbk-worker-guard-loosening-20261107`).

## What landed

| Step | Result |
| --- | --- |
| Readiness read (`ssh-tbk-worker`, no sudo) | No T3; linger on; Tailscale 1.104.5 online, `worker` not operator, MagicDNS off (hub name unresolvable); public installer reachable; beep-effect checkout on `main`, clean |
| Guest admin (`ssh-tbk-worker --admin -tt`) | `tailscale set --operator=worker --accept-dns=true`; hub name resolves; mirror still unreachable (policy) |
| Install as `worker` | Published archive, `SHA256SUMS`, `latest.json`, the pull script and units and the public installer staged over the existing SSH route (141 MB); `SHA256SUMS` verified on the guest; installer run against a loopback copy of the mirror with `T3CODE_VERSION` pinned to the published version; `service.env` then pinned to the real mirror with `T3CODE_HOST=127.0.0.1` |
| Service | `t3 service install`; drop-in `t3code.service.d/10-worker-boundary.conf` (`Slice=agent-runs.slice`, `UnsetEnvironment=SSH_AUTH_SOCK OP_*`, explicit PATH); `settings.json` created with `linkedEnvironmentsEnabled: true`; active in `agent-runs.slice`, loopback 200, `fork-current` written |
| Pull timer | enabled; the first run after the policy change reported `current` |
| Serve | `tailscale serve --bg --https=443 http://127.0.0.1:3773` on the guest's own node (tailnet only, no Funnel) |
| Project | the guest's beep-effect checkout registered with `t3 project add` |
| Tailnet policy | The tagged node had one grant (hub to guest tcp/22). Added hub to guest tcp/443 and guest to hub tcp/<mirror port>; the policy's regression tests were updated in the same save (443 accepted for the hub sources, the guest's ICMP-to-hub drop expectation removed because any grant implies ICMP, mirror port accepted) and stale entries for two nodes the operator deleted that day were removed, since they already failed every save |
| Hub link | `t3 environment link https://<tbk-worker>.<tailnet>.ts.net --pairing-code <code> --access auto` from `$HOME` → `Linked tbk-worker (<id>) with auto access, until 2026-12-07` |
| `t3 environment list` | beep-worker, dankserver, tom-pc-1-wsl, tbk-worker all `reachable`, access `auto` |
| Desktop pairing | `t3 pair --ttl 15m --label dankstation-desktop` on the guest; the app link rewritten to the Serve address and opened on DankStation with `xdg-open` for the operator to confirm |

## Evidence

| Check | Result |
| --- | --- |
| Hub probe of the Serve route after the policy save | 200 (timed out before it) |
| Guest fetch of the mirror's `latest.json` after the policy save | version `0.1.7-fork.20261107.2127`, the hub's installed build |
| `t3 service status` on the guest | `installed · t3@0.1.7-fork.20261107.2127`, no problems |

## Open

- One delegated read-only turn through the link (as the other hosts' receipts
  record) has not been run yet.
- Desktop-app pairing confirmation is the operator's.
- The guest's GitHub token expires 2026-11-22; the link expires 2026-12-07.
- The runbook's "Install the pull on a host" recipe assumes the host can reach
  the mirror before the first install; a tagged node needs its grants first, or
  the loopback-mirror variant used here.
