---
title: "The proposal-fact bound check stays total: a refused fact is out of bounds"
date: 2026-11-13
lane: "refactor/canonical-digest-owner-swaps"
reversal: "Call the epistemics canonicalJson in the check again; a fact with an unpaired surrogate then makes the fact schema throw instead of fail."
---

The contradiction proposal fact schema bounds a fact by the byte length of its canonical JSON. After the epistemics swap that check would throw for a fact the owner refuses: S.is then throws (the guard adapter dies on a failure that is not a schema issue), decode dies instead of failing, and the exported contradiction arbitraries throw while sampling. Five existing test suites failed that way. The check now reads the owner's Result and returns false on a refusal, so such a fact fails decode with the schema's typed error, as any other unbounded fact does. This is not a new check: the bound already meant at most 64 KiB of canonical UTF-8, and a value with no canonical form has no such size. It also guards detection beliefs, whose assertion check reuses the fact schema. Rejected: keeping the throw, since a schema guard that throws is a defect, and a separate well-formedness check on the fact, which would be a new domain check and is out of scope for this slice.
