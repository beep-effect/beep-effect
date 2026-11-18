---
title: "catalog-usage reads a pruned workspace's consumption from its bun.lock record"
date: 2026-11-18
lane: "feat/prunable-seam-1b"
reversal: "Stop reading bun.lock workspace records; entries of pruned workspaces are reported until the checkout drops them."
---

A pruned workspace's package.json is gone, so the only record of the catalog: dependencies it consumed is the workspace entry bun.lock keeps under its last-known directory. Measured with bun 1.4.4: after a workspace directory is deleted, a frozen install prints that it skipped one workspace listed in bun.lock but not on disk and exits 0, keeping the entry; a plain install drops it. catalog-usage now reads that record for each pruned workspace (and each workspace an owned entry names by packageName) and counts it as a consumer that excuses an entry, never as a live one: an entry or root override consumed only there is skipped and counted (skipped_pruned), not reported. A record of an undeclared missing workspace is not read, and once a regenerated lockfile drops a record its entries are reported again. A checkout that keeps upstream's bun.lock therefore keeps its root catalog unedited. The prune rehearsal regenerates the lockfile, so its catalog step moves after the reinstall (SPEC.md, Prune rehearsal).
