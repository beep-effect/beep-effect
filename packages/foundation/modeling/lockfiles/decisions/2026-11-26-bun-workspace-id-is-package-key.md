---
title: A bun workspace's instance id is its packages key, falling back to its path
date: 2026-11-26
reversal: Key bun workspace rows by their workspace path, as pnpm does, or drop a workspace whose packages tuple is missing or malformed.
governs:
  - src/internal/bun.ts#toFields
enforcedBy: []
---

bun keys a nested install `<parent-key>/<name>`, and a workspace's nested installs prefix themselves with its `packages` key, the bare package name. The workspace row therefore takes that key as its instance id, so edges walked from it resolve. The workspace path is the id only when the lockfile records no such key.

Workspace ids enter the instance-id set from the `workspaces` map, not from tuples, so a malformed or missing tuple for a workspace never drops the workspace itself; its tuple emits no external row.

Rejected: the path as the id (nested keys never prefix with it, so the workspace's own edges would not resolve), and taking workspace identity from the tuples.
