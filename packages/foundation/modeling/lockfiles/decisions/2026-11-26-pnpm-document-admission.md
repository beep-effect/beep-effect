---
title: A pnpm lockfile document is admitted by its version first and by a non-empty importers map
date: 2026-11-26
reversal: Decode the shape before the version gate, gate on snapshots being present, or return an empty Lockfile for a document with no importers.
governs:
  - src/internal/pnpm.ts#parsePnpm
enforcedBy: []
---

The format-version gate runs before the shape decode. A pre-v9 single-project lockfile has no `importers` map, so decoding first would report a too-old lockfile as malformed and lose the distinction `UnsupportedLockfileVersion` carries.

The gate reads the version only. A dependency-free v9 workspace legitimately has zero `snapshots:` entries; the version is the format's identity, emptiness is a coincidence of content.

pnpm always records at least the root importer `.`, so a document with no importers describes no workspace and fails typed (`noImporters`).

Rejected: a snapshots presence or emptiness guard (rejects valid lockfiles), and an empty Lockfile for a document with no importers (indistinguishable from a workspace with no packages; that shape hid the multi-document framing bug).
