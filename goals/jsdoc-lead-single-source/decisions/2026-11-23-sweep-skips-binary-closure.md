---
title: "Sweep waves skip both P5 cutover fences, file by file: the CI binary closure and the runner handler graphs"
date: 2026-11-23
lane: "goals/jsdoc-lead-single-source-w3"
reversal: "Sweep the fenced files in wave 5, on the orchestrator's slot, once it says in writing that the P5 fence has lifted"
---

The P5 cutover has two fences. Both are file fences, not package fences, and the sweep waves leave
every file behind either one untouched:

- **CI binary closure** (`beep ci binary-closure --list`): any byte change starts a binary build and
  release cycle that the CI goals driver sequences.
- **Runner handler graphs**: Alchemy hashes each runner Lambda's zip including its source map, whose
  `sourcesContent` embeds every loaded module's full text, so a JSDoc-only edit in a handler-graph
  file changes the code hash. The fenced files are the five identity sources
  `HandlerBundles.test.ts` pins (`Authority.ts`, `Id.ts`, `Root.ts`, `internal/Segment.ts`,
  `internal/schemaStatics.ts`), ci-runners `src/internal/lambda/**` and everything it imports, the
  alchemy-github-runners handler graphs, and any `@beep/schema`, `@beep/data` or `@beep/utils`
  module those graphs load. When a file is in doubt, a HandlerBundles-style before/after build that
  compares map sources decides.

Wave 3 swept 653 files in foundation, drivers and six repo-cli files, then reverted the 64 that are
closure source: drivers/github-actions (3), capability cli-kit (22), runtime-env (10), walker (1),
modeling github-commands (1), github-reporting (1), identity `Iri.ts` (1), markdown (12), utils
(12) and primitive/data (1). The CI goals driver ruled in writing that identity `Registry.ts` and
repo-cli `Ci/*` and `Identity/*` are behind neither fence, so wave 3 keeps them. Wave 4 (tooling)
applies both checks. The fenced files join wave 5 with identity `Term.ts`. Wave 5 runs only on the
orchestrator's slot, after tksr C's cumulative pin (#3500) merges, and its release gets the driver's
read.
