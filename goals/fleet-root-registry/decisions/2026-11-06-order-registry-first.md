---
title: "Run fleet-root-registry before lane-bootstrap, shrunk to one PR"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Swap the order by moving the roots list and registry stubs into lane-bootstrap's SPEC and marking this packet dependent on it."
---

Operator ruling 2026-11-06. fleet-root-registry stays first in the map but its scope shrinks to: per-repository discovery-roots list, thin registry overlay, joined and describe views, undercount explanation. lane-bootstrap starts the moment this merges. Rejected: lane-bootstrap first (it would invent fleet-root and registry stubs this packet then replaces); merging both into one packet (breaks the one-PR appetite and delays drain).
