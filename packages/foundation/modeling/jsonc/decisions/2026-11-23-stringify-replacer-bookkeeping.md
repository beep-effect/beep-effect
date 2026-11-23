---
title: stringifyResult classifies failures from in-place replacer bookkeeping
date: 2026-11-23
reversal: Replace the ancestor stack with an immutable copy per visit and test every visited value for a bigint inside the replacer, accepting the per-visit cost.
governs:
  - src/Jsonc.ts#Jsonc
enforcedBy: []
---

`Jsonc.stringifyResult` keeps two pieces of mutable replacer state: the open containers from the root down to the current holder, popped in place, and the value the replacer handed back last.

Reason: the engine refuses a bigint, primitive or boxed, the moment the replacer returns one, so after a failure the last returned value is the one to test. Popping in place makes each visit cost only the cycle scan the engine also makes.

Rejected: testing every visited value for a bigint, which costs a caught throw per object, and copying the whole ancestor stack per visit.
