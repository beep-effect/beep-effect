---
title: "A1 Identity label: the bucket owner, with a host-scoped alias map"
date: 2026-11-10
reversal: "Drop the alias map and key windows on raw labels."
---

The identity label names the bucket owner: `user:<login>`, `app:<id>/<inst>[/jwt]`, `anonymous` or `unresolved`, with `token:` plus a 12-hex SHA-256 prefix as a degraded label. A host-scoped `aliases.json` maps token hashes to logins. It is seeded at no cost from gh-cli and configured logins, otherwise by one `GET /user` per new token lineage (nominal cost 1). Aliases apply at record time and at read time, so one bucket keeps one label.

Resolves SPEC ambiguity A1 in the P0 design (`research/2026-11-10-design.md`, "SPEC ambiguities resolved here").
