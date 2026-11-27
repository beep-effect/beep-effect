---
title: An in-place env var edit never sends key or type
date: 2026-11-26
reversal: Send the full request body, key and type included, from editFields in src/EnvVar.ts, and edit a weaker stored type in place instead of removing and recreating it.
governs:
  - src/EnvVar.ts#editFields
  - src/EnvVar.ts#writeEnv
enforcedBy: []
---

An in-place edit sends the value always (it cannot be read back, so an edit is how a rotation and an adoption reach Vercel), the targets and branch only when they differ from what is stored, and a declared comment. Vercel refuses any `key` on a sensitive variable, even the identical one ("You cannot change the key of a Sensitive Environment Variable", observed 2026-11-14), and does not convert a type in place. A key change is therefore a create-first replacement, and a variable stored weaker than declared is removed and created again.

Rejected: editing with the full request body, which Vercel refuses for every sensitive variable.
Rejected: converting the storage type with an in-place edit.
