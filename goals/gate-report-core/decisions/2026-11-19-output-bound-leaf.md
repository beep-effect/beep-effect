---
title: "OutputBound lives in a leaf that does not load the Bun platform"
date: 2026-11-19
lane: "feat/gate-report-services"
reversal: "Import the bound from the step-execution module again and delete the leaf."
---

The output bound and its chunk reducer moved to their own leaf of the repo CLI kit; the step-execution module re-exports them, so no existing import changes. The gate-run library imports the leaf, which cut its cold start from about 0.28 seconds to about 0.15, on a path every package check takes. The check probe takes its build-closure command from the library instead of repeating it, at a measured cost of at most 10 ms.
