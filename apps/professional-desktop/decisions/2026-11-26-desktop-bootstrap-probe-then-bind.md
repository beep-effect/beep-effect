---
title: The shell bootstraps through one transport probe, then binds protocol layers in the app registry
date: 2026-11-26
reversal: Mount the shell before the probe resolves and let each query atom retry or poll until the sidecar answers.
governs:
  - src/App.tsx#readSidecarTransport
  - src/App.tsx#protocolLayerBindingAtom
  - src/App.tsx#desktopBootstrapAtom
  - src/App.tsx#TransportGate
  - src/App.tsx#makePanelRenderers
enforcedBy: []
---

The shell renders nothing that queries the sidecar until one probe says which transport it speaks. In a Tauri webview the probe invokes the Rust `sidecar_transport` command, which in a packaged build resolves only after the bundled sidecar reports its complete RPC runtime live, so the probe is also the cold-start gate. A rejected invoke or a decode failure is the probe's failure and renders the unavailable state.
Once the probe resolves, a mounted binding atom points the chat, ontology and epistemic protocol layers at IPC or HTTP. The chat layer already defaults to HTTP, so it is only rewritten after the transport is confirmed. An IPC sidecar serves no HTTP, so vault-sync intents bind to `VaultSyncIntentTransportUnavailable` and stay queued instead of failing silently.
The bindings write the same registry the panel content reads; there is one registry for the app. The dock adapter portals panels into its graph's private registry, so `wrapInAppRegistry` hands each surface the app registry back; without it a surface silently builds detached copies of its atoms inside the graph registry.
Rejected: a useState/useEffect probe (React would own transport state outside the registry); a second registry for transport state (panels would read protocol atoms the bindings never wrote); letting query atoms run before the probe (they race a cold sidecar).
