---
title: Admission cost is pinned by counting through the admission seam and scanning src/Sbom.ts
date: 2026-11-26
reversal: Delete AdmissionCount and constructionsOf and leave Sbom.generate covered by its behavioural tests only.
governs:
  - test/Sbom.admission.test.ts#AdmissionCount
  - test/Sbom.admission.test.ts#constructionsOf
enforcedBy: []
---

`Sbom.generate` admits the whole document through one `SbomDocument.make`, so its
work is affine in components: the root on the metadata plus one node per
dependency. A re-admission (a `Component.make` in the sort, or a document per
component) doubles that slope and fails no behavioural test. Two guards hold it:
a counter swapped onto `admission.admit`, and a raw-text scan of `src/Sbom.ts`
that requires one seam call and no other schema `make`, since the counter only
sees the seam.

Rejected: `vi.spyOn`, which records every call's arguments and result and would
retain each admitted document; wrapping a schema's `make`, which memoizes itself
as a non-configurable own property on first read, so in coverage's shared worker
any earlier test that built a document makes it impossible to wrap.
