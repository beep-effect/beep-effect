---
title: "A4 is in review with construction detaches at 2 and one stop"
date: 2026-11-14
kind: checkpoint
lane: "perf/citation-owned-configuration"
reversal: "Return A4 to in progress if review or hosted CI finds a result or accounting change."
---

A3 merged as #3282. A4 owns configuration once at each caller boundary (`ownCitationConfiguration`, one JSON-codec detach at make, makeDefault and the extractor) and removes every nested detach and stage-level decode. Owner round 2 added two commits: fixed-pattern authentication of the reference-pattern builder runs once per installed call site and is replayed per request (authentication otherwise stays at each installed stage, once per engine), and every leaf helper and parent-side installer takes typed limits, runtime and configuration with no re-decode (`prepareCitationNativeRuntime` deleted). Full-span probe per call is unchanged: 0 installs, 0 detaches, 0 tokenizer builds, 0 evaluator installs, 291 evaluations and 291 child processes over ten calls. Construction: 16 installs, 2 detaches (10 before), 1 tokenizer build, 26 evaluator installs; measured snapshot spans at construction fell from 8 to 3. The target of 1 is not reached: the default engine still owns its caller configuration and its assembled configuration, because the tokenizer catalog is derived by engine computation rather than decoded from sealed text (stop decision with two proposed reshapes). All 233 Citation test files pass one by one; the full suite and coverage run on hosted CI.
