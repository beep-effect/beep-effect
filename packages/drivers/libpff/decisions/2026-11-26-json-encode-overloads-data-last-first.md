---
title: The encodeJson type lists its data-last overload first
date: 2026-11-26
reversal: Reorder the call signatures of JsonEncodeEffect in src/Libpff.messages.ts with the (input, options?) signature first.
governs:
  - src/Libpff.messages.ts#JsonEncodeEffect
enforcedBy: []
---

`JsonEncodeEffect` declares `(options?) => (input) => Effect` before `(input, options?) => Effect`.
Reason: TypeScript resolves overloads in order, and with the data-first signature first a call with a lone parse-options argument matches it as the input, hiding the curried form.
The data-last signature's trailing optional `options` mirrors the data-first signature exactly, so both forms accept the same arguments.
Rejected: listing the data-first signature first, the usual order for `dual`, which types `encodeJson(options)` as an encode of `options`.
