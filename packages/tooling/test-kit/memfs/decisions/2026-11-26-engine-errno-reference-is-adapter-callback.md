---
title: The engine's errno reference is the node adapter's callback call; the handle mutators imitate the Sync calls
date: 2026-11-26
reversal: Pin the engine's recursive makeDirectory cases against mkdirSync, as the handle mkdir cases are.
governs:
  - test/ErrnoParityContract.ts#cases
enforcedBy: []
---

The engine answers what the Effect node adapter answers, and the adapter calls the callback `fs.mkdir`: a dangling link earlier in a recursive makeDirectory path is ENOTDIR there, where `mkdirSync` says ENOENT. A dangling link as the final component is ENOENT and a loop is ELOOP on both.
The handle mutators are node-shaped Sync imitations, so integration/ports.int.test.ts pins handle mkdir against `mkdirSync(p, { recursive: true })` instead.
Rejected: one reference for both, which makes either the engine disagree with the adapter it stands in for or the handle disagree with the Sync call it imitates.
