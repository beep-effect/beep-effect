---
title: A registry from another pseudonym namespace is refused, and a legacy one migrates only on a digest match
date: 2026-11-23
reversal: Merge a populated registry whatever its hashSaltStatus or namespace fingerprint, or migrate every legacy file.
governs:
  - src/identity-registry.ts#mergeAndPersistRegistry
enforcedBy: []
---

A populated registry whose persisted hashSaltStatus or namespace fingerprint
differs from the current run's is refused, not merged: its digests live in a
different pseudonym namespace, so a merge would silently break later joins.
A legacy registry has no fingerprint. It migrates only when its root, worktree
or home-directory digests match a freshly derived identity; those digests are
salt-dependent, so a match proves namespace continuity without persisting the
salt. The temporary file is named per writer, because a stale lock cleared by
hand can leave two writers overlapping on one fixed temporary name.
Rejected: merging across namespaces; migrating unprovable legacy files; one
fixed registry.json.tmp.
Accepted limit: an unprovable legacy file is a hard failure and is rebuilt deliberately.
