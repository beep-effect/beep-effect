---
title: browser node builtin stubs
date: 2026-11-26
reversal: Let webpack resolve node builtin modules in the browser graph.
governs:
  - next.config.ts#browserConfig
enforcedBy: []
---

The production PWA webpack build strips node: schemes and stubs builtin modules leaked through schema and utility imports; their server-only helpers never execute in the client. Turbopack resolves these natively and ignores the webpack hook.
Rejected: normal webpack resolution, which cannot bundle those node:* imports in the client graph.
