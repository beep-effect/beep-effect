# Brief

<!--
Stage 3. The shaped pitch (Shape Up anatomy). Fat-marker fidelity: concrete
enough to evaluate and decompose, rough enough to leave design latitude to
the implementing goal packets. The exploration is shaped when the human says
this file matches the picture in their head.
-->

## Problem

One `engine.extract` call on the bun cohort costs 8 to 13 seconds on a loaded
host. Ten calls took 85 to 126 seconds, which is why the full-span replay hit
its 180 second watchdog three times on hosted CI (main red episode ep81). PR
#3203 restructures that test; the cost is in the production engine and four
sibling replays carry the same risk.

The source read ([`RESEARCH.md`](./RESEARCH.md)) puts the cost in three
places, all of them work the engine repeats that does not depend on the
request:

1. Every regex evaluation spawns a child process: 291 spawns for ten calls at
   about 130 ms each. Most of that is the child loading its modules.
2. Every request reinstalls the stage tree below the top-level stage: 14
   metadata operations, the tokenizer (6,805 extractors, two tries, recipes)
   and the extraction loop. Helpers construct a regex worker object per call,
   often per token.
3. Every install decodes and detaches its configuration again: 8 round trips
   per request, 7 of them over the tokenizer subtree, plus SHA-256
   fingerprints of fixed patterns.

The per-request install is not an accident. It is how the request's text
budget, Scope and admission reach a stage: each stage captures them from
Context when it is installed. Fixing the cost means replacing that binding
mechanism, and replacing one process per evaluation means restating the
isolation contract.

## Appetite

Two goals, seven reviewable PRs, no change to extraction results. Each PR is
sized for one reviewer sitting and carries before and after counts from the
same fixture. If the invocation binding cannot land as a behavior-neutral PR
of its own, stop and reshape; that slice is the load-bearing one.

## Solution Sketch

Full contracts are in
[`research/design-2026-11-12.md`](./research/design-2026-11-12.md), revised
after an adversarial review
([`research/design-review-2026-11-12.md`](./research/design-review-2026-11-12.md)).
In short:

```text
engine construction (once)
  own(configuration)  --one detach, fingerprints-->  CitationOwned<Config>
  install stage tree, tokenizer, regex evaluators   (take Owned, never copy)

per request
  openCitationInvocation(policy)
    admission permit -> Scope -> text budget -> lazy native lane + regex session
    provide CitationInvocation
      stage.run(request)                 R = CitationInvocation
        evaluator.evaluate(...)          reserves on invocation.budget
          invocation.regex.evaluate(job) one child at a time in the lane
    Scope closes: occupant retired (SIGKILL, confirmed), lane released
```

- **`CitationInvocation`** is one request-scoped `Context.Service` holding the
  policy, the text budget, the Scope, the native lane and the regex session. Only
  `openCitationInvocation` constructs it, so holding one proves admission and
  the pass-through nested admission goes away. Public engine methods keep
  `R = never`.
- **`CitationOwned<A>`** is a brand minted by one boundary module after a
  single detach. Installers accept it and do not copy. Ownership is a type,
  with no identity memo and no global state.
- **Regex protocol v3** keeps a child process that the parent kills with
  SIGKILL, because Bun cannot stop a worker thread inside `RegExp.exec`. The
  process lives in the request's lane and serves its jobs one at a time. Each job
  carries its descriptor and a sequence number and runs under a parent timer.
  A deadline, an interruption mid-job or any protocol deviation kills the
  process through the existing retirement path and fails the request, as a
  regex deadline does today. The session never respawns.
- **Measurement** gates on counts (spawns, installs, detaches, tokenizer
  builds), which do not move with host load, and reports wall time beside
  them from a remote worker.

Expected counts per ten plain-text calls: regex processes 291 to 10;
per-request installs 14 to 0; per-request detaches 8 to 0; tokenizer builds
10 to 1. A markup request starts one more regex process each time Diff or Xml
work interleaves.

## Rabbit Holes

- **Native capacity is counted per process today.** A request-lived regex
  worker holding its own lease would starve the same request's Diff and Xml
  processes, which share the total ceiling. The design changes the unit: each
  admitted operation gets one lane of native capacity with at most one child
  alive in it. A Diff or Xml job retires the idle regex worker first, with
  confirmation, and the worker restarts lazily. The limits schema gains one
  cross-field check, regex processes at least equal to operations.
- **Hidden captures.** Anything that reads a request value at install time
  binds to the engine once installs are hoisted. Budget lookups go through
  `Effect.serviceOption`, which the compiler cannot track, so a hoisted stage
  would silently stop charging the budget; nested admission captures would
  take a second permit. The design lists eleven budget sites and fourteen
  admission sites, deletes the optional lookups, and installs the tree in a
  Context without the admission so a missed one fails at construction.
- **Child stdio is single-use today.** The stdin sink ends the pipe after one
  frame, the reader demands an exact frame count and then EOF, and the worker
  reads to EOF before it starts. v3 replaces the regex transport: a pipe that
  stays open, one reader per process, a looping worker. The frame bound and
  the structural JSON ceilings stay, widened for the per-job descriptor.
- **Startup time versus a one second regex deadline.** Startup gets its own
  timer so a job's bound does not depend on spawn time under load.
- **Tests that assert the old behavior.** Fixtures count spawns and compare
  them with confirmed retirements. Those assertions change with v3 and are
  rewritten in the same PR, not deleted.
- **JavaScriptCore's silent match limit.** JSC returns no-match after 100
  million steps. This predates the lane and v3 does not change it; it is
  recorded so nobody attributes it to the session.

## No-Gos

- No change to extraction output, to the public `CitationEngine` service
  shape, or to any limit value. The one policy change is the cross-field
  check, shipped as policy v2.
- No worker threads and no in-process regex evaluation.
- No engine-lived worker pool. It is a gated follow-on.
- No identity-keyed memo, `WeakMap`, `WeakSet` or module-level cache.
- No use of the stock `RpcClient.makeProtocolWorker` pool as the lease
  authority.
- No session model for the Diff, Markup or Recognizer workers.
- No new regex engine and no change to the pattern translator.
- No cross-job cache inside the worker in these goals.
