---
title: "CI tables in repo-cli source become a fifth seam"
date: 2026-11-17
lane: "feat/prunable-seam-1"
reversal: "Drop seam 5 and restore the CI-configuration non-goal; a fork then edits its own CI tables by hand."
---

Found while building seam 1 (research/2026-11-17-seam-1-surfaces.md). Kept repo-cli source names product packages in its CI tables: the lane partition table (commands/Ci/CiLanePartitions.ts), whose proof fails closed on an assigned package that is absent; the Desktop codegen and IPC steps in commands/Ci/CiLane.ts; the sharded partition sources in commands/Ci/CiPartitions.schemas.ts; and the check-census default targets in commands/Quality/CheckCensusGate.ts. These are not fixtures, so seam 1's skip rule does not fit them: in the full checkout a guard that fails on an absent package is right. A pruned checkout needs the tables derived from, or filtered by, the present workspaces instead. Agent call: they become seam 5, built after seam 4 with the same projection approach. Workflow YAML stays out of scope. Until seam 5 lands, the prune rehearsal fails ten ci-lane and ci-docs-policy tests for this reason alone.
