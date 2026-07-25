---
"@beep/dock": patch
"@beep/dock-react": patch
"@beep/ontology": patch
"@beep/ontology-client": patch
"@beep/agents-client": patch
"@beep/professional-desktop": patch
---

Security hardening: dock snapshot restores accept an optional renderer allowlist and
strip non-whitelisted component panels; root-split panel moves reject when they would
empty the docked workspace; dock-react resolves renderers by own key only; vendor
taxonomy slice reads enforce realpath containment inside the vendor root; the 3d
betweenness centrality pass is cost-bounded by deterministic source sampling; and the
Tauri webview no longer falls back to an implicit loopback OTLP endpoint.
