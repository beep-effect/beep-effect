---
title: the unit lane packs packages into seven LPT bins that start their heaviest packages first
date: 2026-11-26
reversal: Default-place every package and drop the curated bins and their startFirst lists.
governs:
  - src/commands/Ci/CiLanePartitions.ts#CI_LANE_PARTITIONS
enforcedBy: []
---

Seven unit bins come from LPT over per-package Vitest wall seconds, at each package's worst measurement across six green runs: PR #3007's 42607991192, 42615698428, 42626103000, 42637312401 and 42646019844, and main run 42677073526 (hosted package walls swing between runs). Four bins from main run 42554761567 summed 809 / 894 / 1,175 / 700 s and unit-c took 13.9 min; six bins of about 595 s still let unit-a run 10.7 min; seven bins of 582 s ran 5.6-8.5 min on main run 42677073526, except unit-b at 10.2 min, whose 309 s package started 162 s in and then ran alone.

The lane runs two package steps at once in list order, so each bin starts its `startFirst` packages (30 s and over, heaviest first; `CI_UNIT_BIN_START_FIRST_SECONDS`) before the rest. That keeps a body near the larger of its heaviest package and half the serial sum, plus about 180 s of setup, prerequisite builds and upload. The weight is the bin's serial sum, within `CI_UNIT_BIN_SERIAL_BUDGET_SECONDS` (CiPartitions.schemas.ts). Every package that ran, default-placed ones included, is curated; @beep/infra and @beep/storybook kept their bin without a measurement in those runs.

The startFirst lists, with their measured seconds: unit-a law-practice-domain 322 s, alchemy-postgres 51 s, ontology-client 33 s; unit-b repo-ai-metrics 309 s, epistemic-server 59 s, occt 39 s; unit-c markdown 279 s, box-provisioning 75 s, practice-kg-mcp 48 s; unit-d professional-desktop 231 s, repo-cli-kit 77 s, doc-text 62 s, technical-drawing 35 s; unit-e repo-workspaces 203 s, md 87 s, db-admin 66 s, editor 48 s; unit-f documents-server 154 s, duckdb 96 s, glob 76 s, cli-kit 49 s; unit-g test-utils 128 s, lint-rules 115 s, yaml 76 s, ontology-server 55 s, wink 32 s.

Rejected: four bins (unit-c 13.9 min) and six bins (unit-a 10.7 min); list order without startFirst (unit-b 10.2 min above).
