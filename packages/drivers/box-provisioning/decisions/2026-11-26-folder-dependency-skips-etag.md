---
title: Folder dependency revalidation compares identity fields, not the etag
date: 2026-11-26
reversal: Add an etag equality check to validateFolderDependency in src/BoxProvisioningApplier.ts.
governs:
  - src/BoxProvisioningApplier.ts#validateFolderDependency
enforcedBy: []
---

Before a dependent write, `validateFolderDependency` re-reads the parent folder and compares only its provider id, parent provider id and Box-equivalent name.
Reason: those fields stay stable across child and collaboration writes. Whether Box moves a folder's etag when its child membership changes is unverified, so an etag change cannot tell external drift apart from the reconciler's own earlier dependent write.
Rejected: comparing the reviewed etag as well, which could refuse a valid apply as drift after the reconciler's own child write.
Accepted limit: a folder's own action precondition still checks its etag, so only dependents skip it.
