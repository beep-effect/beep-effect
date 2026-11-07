---
title: "F-DOCKER --tools allowlist apply waits for a quiet window"
date: 2026-11-07
lane: "docs/rsc-1862-native-activation"
reversal: "Drop the deferral and apply in any window (accepting a shared-gateway restart under live sessions), or withdraw the proposed allowlist and keep the 47-tool legacy --servers gateway."
---

Refs #1862. The launcher sign-in gate looks met: Docker Hub credentials are present and the catalog resolves. The gateway on 127.0.0.1:8811 is one shared service. Codex, Claude, Grok and Junie bind to it, and about twelve live agent sessions were using it when this was recorded. A restart or a profile or unit change would cut tools out from under every one of them at once.

This lane did only the read-only half. The live MCP tool listing returned 47 tools and 128,947 compact bytes, identical to the baseline. From the observed Claude and Codex invocations and the repo's PR and issue workflows it derived a 19-tool allowlist, about 64.8 KB and 49.7% fewer schema bytes. It also wrote down the backup, apply, validation and rollback commands. The apply (unit drop-in + `daemon-reload` + restart) is deferred to a quiet window with no live gateway clients, chosen by the orchestrator. F-DOCKER therefore does not yet meet its SPEC acceptance, and #1862 stays open for it. Evidence and exact commands: `history/receipts/2026-11-07-native-activation.md`.
