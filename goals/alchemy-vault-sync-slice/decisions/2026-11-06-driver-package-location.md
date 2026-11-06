---
title: "Driver package is @beep/alchemy-postgres under packages/drivers"
date: 2026-11-06
lane: "goals/alchemy-vault-sync-slice"
reversal: "Move the package with bun run beep create-package into the foundation family and update the import sites; no data involved"
---

The Postgres Platform implementation and its conformance suite live in `packages/drivers/alchemy-postgres` as `@beep/alchemy-postgres`, created with `bun run beep create-package --family drivers`. `standards/ARCHITECTURE.md` lists Postgres, message storage and workflow engines as driver concerns; a repo-owned event-store platform is an external boundary wrapper, not shared-kernel substrate.
