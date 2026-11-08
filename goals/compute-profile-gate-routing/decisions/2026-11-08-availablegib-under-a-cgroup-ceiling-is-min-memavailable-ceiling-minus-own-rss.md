---
title: "availableGib under a cgroup ceiling is min(MemAvailable, ceiling minus own RSS)"
date: 2026-11-08
reversal: "Drop the clamp so availableGib is MemAvailable again"
---

Bun and Node expose no cgroup memory.current, and the packet forbids parsing /sys/fs/cgroup by hand. Under a ceiling tighter than MemTotal, MemoryStats.availableGib is min(MemAvailable, ceilingGib - process RSS). Other members of the slice are invisible, so the value is an upper bound; documented on MemoryStatsShape. Uncapped processes are unchanged.
