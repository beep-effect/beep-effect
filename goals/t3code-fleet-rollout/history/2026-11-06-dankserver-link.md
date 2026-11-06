# 2026-11-06: dankserver exposed through Serve and linked

Sanitized receipt. Tailnet names, addresses and environment ids stay in the
private orchestrator handoff.

## What landed

- Decision file `decisions/2026-11-06-dankserver-t3-reaches-the-tailnet-through-a-serve-route-not-a-wider-bind.md`:
  the worker's T3 service keeps its loopback bind (`T3CODE_HOST=127.0.0.1` in
  the worker-boundary drop-in); the administrator added one tailnet-only
  Tailscale Serve route (HTTPS 8448, proxy to the loopback listener). Port 443
  already fronts other services there and the worker has no Tailscale operator
  rights. No Funnel, no LAN bind, no worker privilege change.
- The worker's server settings file did not exist yet; it was created with
  only the Labs link flag and the service restarted.
- `t3 pair --ttl 15m` on dankserver (orchestration, settings, source-control
  and access scopes); on the hub
  `t3 environment link https://<dankserver>.<tailnet>.ts.net:8448 --pairing-code <code> --access auto`.
  Result: `Linked dankserver (<id>) with auto access, until 2026-12-06`.
- The worker's beep-effect checkout (`main`, origin `beep-effect/beep-effect`)
  was registered with `t3 project add`, so it shares the hub's repository key.

## Evidence

| Check | Result |
| --- | --- |
| Hub probe of the Serve route | `https://<dankserver>.<tailnet>.ts.net:8448/` 200 |
| `t3_environment_links` | beep-worker and dankserver both `reachable`, access `auto` |
| `t3_environment_read` (dankserver) | `0.1.7-fork.20261106.29` (same as the hub's installed build and beep-worker) |
| `orchestrator_capabilities` (dankserver) | Codex and Claude enabled; Cursor, Grok, Muse disabled there |
| Delegated turn (`claude-opus-5-5` medium, read-only) | hostname `dankserver`, user `worker`, `t3 v0.1.7-fork.20261106.29`, `fork-current` = `444921eb71` + version, checkout HEAD `ff57c724e`, 8 CPUs |

Also this day: the fork sync fast-forwarded to upstream `444921eb71`, published
`0.1.7-fork.20261106.29`, and both workers pulled it unattended on their
30-minute timers (beep-worker at its 19:00 tick, dankserver at 19:03 local).
