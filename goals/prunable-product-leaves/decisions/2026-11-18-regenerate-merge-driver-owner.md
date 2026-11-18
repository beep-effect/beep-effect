---
title: "Seam 4 owns extending merge=regenerate to the remaining generated projections"
date: 2026-11-18
lane: "feat/prunable-seam-1b"
reversal: "Move the merge driver extension to another seam with a new decision file."
---

A trimmed checkout or downstream fork regenerates vitest.aliases.generated.json, standards/root-package.projection.generated.json and the source array in syncpack.config.ts after it prunes, and those regenerated files then conflict with every upstream change to them. The repository's merge=regenerate driver already resolves the projections .gitattributes names by rerunning their generators. Agent call: seam 4 owns extending it to these three, because seam 4 turns the db-admin aggregation into a generated projection of the present slices and must register that projection with the same driver; the four land together with their generator proofs. Seam 1b does not change .gitattributes.
