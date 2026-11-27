---
title: The rest catch-all stores every manifest key as own data, and typed fields win on encode
date: 2026-11-26
reversal: Build rest as a plain {} by assignment, look up FIELD_GUARDS in a plain object, and spread typed fields before rest.
governs:
  - src/internal/wire.ts#makeWire
  - src/LenientManifest.ts#FIELD_GUARDS
  - src/LenientManifest.ts#sift
  - src/Person.ts#encodePersonObject
enforcedBy: []
---

`rest` is a null-prototype record, known keys are copied with `R.fromEntries`, and the decoded value is assembled with a spread. `LenientManifest` looks its field guards up in a `HashMap`.
Reason: on a plain object `rest["__proto__"] = v` mutates the prototype instead of storing data, so a manifest with an own `__proto__` key would pollute the record and lose the key on encode. `fromEntries` and spread define own properties, so a declared `__proto__` field survives. A plain-object guard table would match `"toString"` or `"constructor"` on `Object.prototype`.
On encode, typed fields are spread after `rest`. A hand-built instance whose `rest` carries a known key, including a field of an `.extend()`ed subclass, must not shadow the typed member. `makeWire` backs `Package.schema`, `Package.wireFor` and `PackageManifest.schema`.
Rejected: plain-object records, which corrupt `__proto__` keys; `rest` winning on collision.
