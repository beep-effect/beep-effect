---
title: "The base-conflict row on a layer is fixed now; the label on a docs-only layer stays"
date: 2026-11-13
lane: "docs/stack-pilot-record"
reversal: "Revert the base-conflict fix PR; or decide the label from the layer's own paths in applyHeavyAdmissionLabel."
---

Slice C left two items for the pilot to justify. No pilot stack exists yet, so both are judged on what the code, the stack test and the repository's rules show. The base-conflict row: the monitor builds it from the run's base, which for a layer is the trunk, so a layer's row reads `base conflict with origin/main` and its remedy `merge origin/main and push`, while GitHub computes the layer's conflict against the parent's branch. Following the row does not clear the conflict and puts main's changes into the layer's diff. The yeet skill calls the row the instruction and AGENTS.md makes it unconditional, so it is fixed in its own small PR before a pilot stack meets it; otherwise the pilot would be measuring a wrong sentence in the tool. The label: a docs-only layer on a code parent gets `ready-for-heavy` because the label step reads the whole range above main. Hosted CI reads the layer's own diff and skips Heavy (`verdict=skip-satisfied`), as it did on the three hand-labelled docs-only layers of the stack test, so the cost is one Heavy Admit run whose jobs skip. The label stays, and is revisited if a pilot row shows a labelled docs-only layer running a Heavy lane or holding on a required Heavy context.
