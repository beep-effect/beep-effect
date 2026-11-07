---
title: "Sidecar launch token binds the slice principal"
date: 2026-11-07
reversal: "Add a bearer adapter behind the same port; no caller changes"
---

Operator decision: no login-session or bearer-verification service exists here or elsewhere. The local sidecar launch token is the authenticated HTTP/RPC channel and binds the desktop principal; in-process CLI uses the local operator, remote CLI presents the launch token from the existing handoff, and MCP uses the configured sidecar identity following OntologyMcpTransport. SessionResolver remains the port. A narrow documents-server repository reads active shared membership on each command and View emission. Hosted multi-user bearer/OIDC is a future adapter, not this slice.
