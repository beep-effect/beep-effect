---
title: "P4: review item upsert holds unresolved imports; repair is a separate port method"
date: 2026-11-23
lane: "goals/text-knowledge-stack-rebuild-p4-claims"
reversal: "Fold repair into upsert behind an explicit flag."
---

ReviewItemStore.upsert returns the ids it held because their latest stored version is an unresolved legacy import, and never overwrites that import with a generated selector. The new repair method writes an explicit revision that retains the old bytes; writing an item equal to the stored current item is skipped. The docket question publisher logs held ids as a warning.
