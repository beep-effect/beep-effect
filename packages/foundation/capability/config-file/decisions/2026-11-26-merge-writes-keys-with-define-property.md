---
title: deepMerge writes every key with defineProperty and skips the string __proto__
date: 2026-11-26
reversal: Copy keys with `result[key] = value` or `Object.assign` and drop the `__proto__` filter in `copyableKeys`.
governs:
  - src/internal/deepMerge.ts#mergeRecords
  - src/internal/deepMerge.ts#copyableKeys
  - src/internal/deepMerge.ts#mergeLowerPriorityKey
  - src/internal/deepMerge.ts#defineDataProperty
enforcedBy: []
---

Every key a merge copies, including own `constructor` and `prototype` fields, is created as an own data property with `Object.defineProperty`, and the string `__proto__` key is never copied.
Reason: a bare assignment uses [[Set]] semantics, so an own `__proto__` key on a higher-priority document would reach `Object.prototype`'s inherited accessor and reassign the result's prototype to attacker-controlled data, defeating the prototype the merge installs.
Rejected: `result[key] = value` and `Object.assign`, which are shorter but both invoke the inherited `__proto__` setter.
