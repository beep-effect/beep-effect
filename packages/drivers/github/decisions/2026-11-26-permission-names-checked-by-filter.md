---
title: Requested permission names are checked by a filter over the whole map, not by a refined key schema
date: 2026-11-26
reversal: Declare RequestedPermissions as S.Record(PermissionName, PermissionLevel) and drop the RequestedPermissionsNameCheck filter.
governs:
  - src/GitHubApp.ts#RequestedPermissions
enforcedBy: []
---

`RequestedPermissions` is `S.Record(S.String, PermissionLevel)` with a filter that reports each key that is not a GitHub permission name at that key's own path.
Reason: `S.Record` does not run a refined key schema against incoming keys, so a `PermissionName` key schema would let a misspelled permission through.
Rejected: `S.Record(PermissionName, PermissionLevel)`, the obvious spelling, which does not reject unknown names.
