---
title: "Diagnostic parsing is a leaf of its own; a probe finding is a failed item"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Fold the parser back into the type-check adapter and count a probe finding as nothing checked."
---

The TypeScript diagnostic parser moved out of the Yeet issue parser into a leaf of the gate-run library that does not import the report model, so the repo CLI can parse diagnostics without loading the model. The type-check adapter builds on it and emits each diagnostic with its plain key and location; the reducer numbers repeats. An unbuilt-reference probe finding is keyed on the reference it names and counts as one unit checked, so the run reads FAILED with the TS6305 fold line and not as an empty run.
