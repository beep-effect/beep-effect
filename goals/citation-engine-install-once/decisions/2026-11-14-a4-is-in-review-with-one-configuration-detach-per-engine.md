---
title: "A4 is in review with one configuration detach per engine"
date: 2026-11-14
kind: checkpoint
lane: "perf/citation-owned-configuration"
reversal: "Return A4 to in progress if review or hosted CI finds a result or accounting change."
---

A3 merged as #3282. A4 owns configuration once at each caller boundary (`ownCitationConfiguration`, one JSON-codec detach at make, makeDefault and the extractor) and removes every nested detach and stage-level decode. Round 2 hoisted the reference-pattern builder's fixed-pattern authentication to install and typed every leaf helper and parent-side installer. Round 3 derives the default engine's installed configuration from the owned caller configuration with `ownedDerive`, so `makeDefault` no longer re-owns it through `make`. Full-span probe per call is unchanged: 0 installs, 0 detaches, 0 tokenizer builds, 0 evaluator installs, 291 evaluations and 291 child processes over ten calls. Construction: 16 installs, 1 detach (10 at A3), 1 tokenizer build, 26 evaluator installs. Every Citation test file passed one by one in round 2; round 3 reran the files that build the default engine. The full suite and coverage run on hosted CI.
