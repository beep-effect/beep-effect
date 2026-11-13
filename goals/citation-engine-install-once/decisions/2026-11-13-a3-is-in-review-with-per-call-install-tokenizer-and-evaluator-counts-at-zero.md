---
title: "A3 is in review with per-call install, tokenizer and evaluator counts at zero"
date: 2026-11-13
kind: checkpoint
lane: "perf/citation-hoist-installs"
reversal: "Return A3 to in progress if hosted CI or review finds a result or accounting change."
---

A1 merged as #3253 and A2 as #3265. A3 hoists the stage tree, tokenizer and every regex evaluator call site to engine construction: per call 0 metadata-operation installs, 0 detaches, 0 tokenizer builds and 0 evaluator installs, with 291 evaluations and child processes unchanged; construction counts 16, 10, 1 and 26. Local proof is file by file; the full law-practice audit and integration cohort run on hosted CI. Draft PR only; no ready transition, merge or readiness monitor.
