---
title: "P1 model package built"
date: 2026-11-19
kind: checkpoint
lane: "feat/gate-report-core"
reversal: "Remove the gate-report package and its generated registrations."
---

The model package exists with 20 modules and 242 tests in 16 files; every source file has full statement, function and line coverage. Laws 1 to 7 and the model half of law 9 pass as tests, with laws 1 to 3 as properties over the report schema's arbitrary. The widening table, the CTRF and SARIF round trip and all twenty cells are tested. The pure core the plan placed in P3 (reducer, classifiers, counts, signature, folding, dispatch) landed with the schemas, because the law tests need it. Left for the adapter slice: the upstream build-report cases about stack frames, missing results and throwing getters, and the stray-output recorder tests.
