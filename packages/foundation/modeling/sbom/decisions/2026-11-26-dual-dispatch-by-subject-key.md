---
title: Data-first dual dispatch recognizes the subject by one key, not a schema guard
date: 2026-11-26
reversal: Replace isDocumentFirst and isPackageFirst with S.is(SbomDocument) and S.is(Package), turning the type-only Package import into a value import.
governs:
  - src/Sbom.ts#isDocumentFirst
  - src/SbomMetadataSource.ts#isPackageFirst
enforcedBy: []
---

The document-first and package-first `dual` members tell a data-first call from
a data-last one by a key the subject always carries and no options record does:
`bomFormat` on an `SbomDocument`, `name` on a manifest.

Rejected: `S.is(SbomDocument)`, which walks the whole document on every call;
`S.is(Package)`, which needs a value import of `@beep/package-json` and drags
its runtime IO into a module that only takes the type.
