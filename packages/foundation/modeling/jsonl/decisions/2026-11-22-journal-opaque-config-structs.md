---
title: Journal configuration is S.Opaque over a struct, not S.Class
date: 2026-11-22
reversal: Declare AppendOptions and JournalConfig with S.Class.
governs:
  - src/Journal.ts#AppendOptions
  - src/Journal.ts#JournalConfig
enforcedBy: []
---

Configuration stays plain data at the service-construction boundary. Call sites pass the encoded shape, a plain object literal, to `append` options and to the layer, and a decoded value is still a plain object carrying only a nominal brand.
Rejected: `S.Class`, which decodes configuration into class instances and makes plain data a second-class input at the boundary.
