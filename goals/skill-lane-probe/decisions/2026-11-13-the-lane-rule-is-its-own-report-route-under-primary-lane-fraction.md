---
title: "The lane rule is its own report route under --primary lane-fraction"
date: 2026-11-13
lane: "goals/skill-lane-probe-p1"
reversal: "Remove the lane-fraction choice and the SkillLaneProbe modules; the first probe's report is untouched."
---

`probe report --primary lane-fraction` builds a new skill-lane-probe-report/v1 from new SkillLaneProbeSchemas and SkillLaneProbeStats modules. The first probe's rule, schemas and committed report stay as they are, so its records still reproduce. Secondary rows (pass measures, fired-only, turns, wall time, lane census) are taken from the first probe's builder without its verdict, and the 144-attempt cap is checked on top of its pooling checks.
