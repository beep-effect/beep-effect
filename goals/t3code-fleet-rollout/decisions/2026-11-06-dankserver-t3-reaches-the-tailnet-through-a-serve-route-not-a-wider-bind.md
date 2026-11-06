---
title: "dankserver T3 reaches the tailnet through a Serve route, not a wider bind"
date: 2026-11-06
lane: "t3code-fleet-p1b"
reversal: "Run tailscale serve --https=8448 --set-path=/ off on dankserver as the administrator; the worker service keeps its loopback bind either way"
---

dankserver's T3 service stays bound to 127.0.0.1:3773 under its worker-boundary drop-in. The administrator adds one tailnet-only Tailscale Serve route (HTTPS 8448, proxy to the loopback listener), because port 443 already fronts other services there and the worker account has no Tailscale operator rights. The hub links over the https .ts.net name on that port. No Funnel, no LAN bind, no worker privilege change.
