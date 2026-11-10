---
title: "Split Property Laws into four slices and create them with the test shards"
date: 2026-11-10
lane: "perf/property-laws-under-ten"
reversal: "In check.yml restore the two-slice matrix [repo-cli, rest] with its two filters and put admission back in the shard job's needs; the comma-separated filter and shard options of the lane command can stay unused."
---

Property Laws was the last test verdict over ten minutes on main: +11.2 min on run 42742264509 while Test Unit landed at +9.3 and Test Integration at +8.7. Two causes, both measured over the 21 completed Check runs since PR 3030.

- The slices had no headroom. `repo-cli` ran 5.7 to 7.9 min (median 7.1, 17 runs with its sweep selected) and a full `rest` 8.0 to 9.5 min (four full runs). Hosted runners vary up to 1.44 times the median, so neither fits ten minutes on a slow runner.
- PR 3046 put the Property Laws shards behind Heavy Admission with the non-test lanes, so they were created at +1.5 min on that run.

Changes:

- Four slices instead of two. `repo-cli-1` and `repo-cli-2` are the two Vitest shards of the repo-cli sweep (335 s of Vitest as one). `foundation-drivers` takes the foundation and drivers package directories and `rest` everything else: 835 and 812 of the 1,647 serial seconds the 85 other packages took on run 42742264509. The directory filters are complements, so no package table is needed; a Turbo dry run selects 51, 34 and 1 packages with no overlap and none missing out of 86.
- The lane command takes several Turbo filters separated by commas and a Vitest shard, forwarded behind Turbo's separator.
- The Property Laws shards wait on Change Profile and Test Plan, like the Test Unit and Test Integration shards, and keep the explicit fail-closed condition. The aggregate and its name are unchanged.
- Projection: each slice about 4.5 to 5.5 min on a median runner, under 8.5 min at 1.5 times that. Cost: two more hosted jobs on a full run (72 requested).
