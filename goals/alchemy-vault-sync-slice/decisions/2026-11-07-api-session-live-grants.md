---
title: "One SessionResolver owns transport identity and live grants"
date: 2026-11-07
reversal: "Replace the resolver adapters while retaining the persisted v1 request codec"
---

Every transport resolves a verified principal through one SessionResolver. HTTP uses host session or bearer verification; sidecar enrollment binds the launch token to the signed-in principal; CLI uses the enrolled local operator; MCP uses the configured client identity. Grants are read live on every command and View delivery, never captured as authority.
