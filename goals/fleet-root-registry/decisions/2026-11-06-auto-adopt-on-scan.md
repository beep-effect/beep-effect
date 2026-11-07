---
title: "The scan auto-adopts legacy clones and unregistered lanes"
date: 2026-11-06
lane: "@chore/deps-update-11-6-26 (grill session)"
reversal: "Remove the adoption write from the scan and require fleet register for every row."
---

The joined view's scan writes a legacy row for every origin-matched clone under the legacy root that has no row, and an adopted row for every lane without one. Adoption is idempotent, never deletes, and an explicit register wins and survives a rescan. Rejected: explicit register only (37 clones today, view empty until someone types them, new sprawl never recorded); seeding in legacy-drain (the view has nothing to join until then).
