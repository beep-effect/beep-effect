---
title: Write-capable desktop surfaces mount only behind an authenticated desktop session
date: 2026-11-26
reversal: Mount vault sync, the ontology workbench and contradiction triage over every transport and let each RPC fail on its own.
governs:
  - src/App.tsx#devRpcSessionToken
  - src/App.tsx#DesktopSessionNotice
  - src/App.tsx#DesktopSessionGate
  - src/App.tsx#makePanelRenderers
enforcedBy: []
---

Vault sync, the ontology workbench and contradiction triage are served over HTTP only when the sidecar holds the per-launch session token. Without it, a browser session is chat-only, and these panels render a notice that says what the session is and how to unlock it.
The browser-mode token comes from `VITE_BEEP_DESKTOP_RPC_SESSION_TOKEN` and is read only in a Vite dev build, so a production web build never embeds a token. It lets the agent-run browser smoke reach the full desktop RPC group over HTTP; the desktop shell normally supplies the token through the Tauri `sidecar_transport` probe.
Rejected: mounting the panels anyway. They failed RPC by RPC, with dead buttons, duplicated red errors and a Vault panel that looked unauthenticated with no explanation.
