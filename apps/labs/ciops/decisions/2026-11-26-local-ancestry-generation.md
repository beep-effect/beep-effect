---
title: Generate adoption ancestry from local complete object stores
date: 2026-11-26
reversal: Move ancestry probing to hosted CI and regenerate the pinned adoption table there.
governs:
  - scripts/generate-adoption-table.ts#repoRoot
  - scripts/generate-adoption-table.ts#generate
enforcedBy: []
---

Generate the ancestry table locally with full history, inheriting GIT_ALTERNATE_OBJECT_DIRECTORIES for sibling object stores; consumers read committed path-and-SHA-256 pins without spawning git.
Reason: unpushed lane heads may exist only in their original clone, and shallow history makes merge-base --is-ancestor return 1 even for true ancestors whose objects exist.
Rejected: probing ancestry in hosted CI, whose incomplete objects could silently commit wrong adoption classes into a SHA-pinned table that consumers never re-derive.
Both check and write modes refuse a shallow clone (git rev-parse --is-shallow-repository) before probing; the default compares recomputed bytes and only --write replaces the table.
