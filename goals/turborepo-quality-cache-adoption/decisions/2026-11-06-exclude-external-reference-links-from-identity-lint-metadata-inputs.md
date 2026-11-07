---
title: "Exclude external reference links from identity lint metadata inputs"
date: 2026-11-06
lane: "codex/cache-strict-entrypoint-review-20261106"
reversal: "Remove the one .repos input exclusion while retaining the source-bound original refusal and candidate metadata observations."
---

At source 68d37217c6ab10f6b1ca70316ab6544c87d23c38, real-root stable build/check/lint dry runs succeed, while pinned canary lint refuses an external .repos manifest link before strict entrypoint selection is enabled. Only identity lint contributes the observed broad manifest input. Its generated package command is biome check . and the reference tree contains no tracked files.

Add only !$TURBO_ROOT$/.repos/** to identity lint inputs. Keep cache:false, all other inputs/exclusions, dependency graph and profile routing. The same canary dry run now succeeds. Stable retains every observed lint task ID and input path; only the edited identity turbo.json input content hash changes. Record the original refusal, exact client/source/config hashes and all actual metadata in research/real-root-entrypoint-and-reference-inputs-2026-11-06.json.

Twelve candidate-bound root dry runs compare build/check/lint across both pinned clients with strict entrypoint selection absent/true. Both clients remove two build commands from check, so leave that flag absent until execution/caller/value proof is complete. This source repair requires hosted acceptance and a newly bound identity input profile before protected trials. No quality task, feature activation, qualification, credential or production setting changed. No manual local verify, publish, check, tests, docgen or package-quality suite.
