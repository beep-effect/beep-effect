---
title: An Opaque schema used as a struct field takes no annotateKey
date: 2026-11-26
reversal: Pipe each governed Opaque field through S.annotateKey and accept the loss of its brand.
governs:
  - src/XlsxDiagnostic.schema.ts#address
  - src/XlsxCell.schema.ts#XlsxCell
  - src/internal/workbookPart.ts#Opened
enforcedBy: []
---

`annotateKey` on an Opaque field rebuilds its inner struct and drops the brand, so an Opaque field (a finding's `address`, a cell's `format`) is used bare and its own schema description says what it is.

`Opened.caps` keeps a key description by annotating `S.toType(Caps)` instead: an opened workbook is built, never decoded or encoded, so its decoded side is all of it and keeps the brand.

`test/XlsxTypes.test.ts` stops type-checking when a decoded field or element comes back as the struct inside its Opaque.

Rejected: `S.annotateKey` on the Opaque field itself, which every other field of these structs uses.
