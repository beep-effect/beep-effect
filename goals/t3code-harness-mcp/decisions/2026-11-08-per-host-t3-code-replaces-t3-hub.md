---
title: "Each host registers its own t3-code entry, replacing the shared t3-hub"
date: 2026-11-08
lane: "t3code-goals-closeout"
reversal: "Remove each t3-code entry, register t3-hub per the original SPEC, and revoke the grants in T3 Settings"
---

As built on 2026-11-08, every harness on every host has a user-scope entry named t3-code pointing at that host's loopback T3, with a per-harness OAuth token in an Authorization header, instead of one t3-hub entry on the DankStation environment over Tailscale HTTPS. The operator confirmed this state as the fleet's configuration. Calls no longer depend on the hub being up. Sharing T3's injected name means the injected entry replaces the user-scope one, which is the double-load fix the spec asked for. Costs: a bearer token sits in each harness config (mode 600), and a Linked environment is one hop further from an outside session.
