---
title: "Permutation test mechanics: shared draws, six-decimal ties, fixed draw order"
date: 2026-11-13
lane: "goals/skill-lane-probe-p1"
reversal: "Change the mechanics in a new dated rule before the scored run starts."
---

The Decision Rule fixes the statistic, seed, count and p-value formula; these are the choices it leaves open. Every relabeling shuffles every counted task once, in task-id order, by Fisher-Yates over the task's C runs then its B runs, using effect/Random seeded with 20261113 (ISAAC, pure JavaScript, so Node and Bun draw the same sequence; a pinned test checks it). The four family statistics read the same draws as the overall statistic. A draw counts when the rounded absolute statistic is at least the rounded observed one, following the six-decimal rounding rule of the first probe's analysis rule, so tied relabelings of discrete scores count as ties and not as float noise.
