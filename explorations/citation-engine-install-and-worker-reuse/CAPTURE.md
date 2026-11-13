# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-12

Operator-approved lane, relayed by the orchestrator session. Topic: citation
engine per-request installation and regex worker reuse in
`packages/law-practice/server/src/internal/Citation`. Take it from capture
through research, align and shape, design the schemas and services first, then
graduate it into goal packets. Implementation follows in those goals.

### Why (main red episode ep81)

`test/CitationCanonicalFullSpan.test.ts` ("recomputes all thirteen original
full-span equalities on bun") hit its 180 s TestHang watchdog on hosted CI three
times on 2026-11-12/13. #3203 restructures that test into per-call tests on one
shared install, which guards it. The cost itself is in the production engine, so
it's still there, and the sibling serial replays (PinSpan, PageCorrection,
ParsedEquality, ExtractionLoop) carry the same latent risk.

### Measured baseline

An Opus child measured this locally at host load 60-120, using an Effect
`Tracer` span recorder plus a `node:inspector` CPU profile inside the fixture
(bun's `--cpu-prof` doesn't capture vitest forks). Bun cohort, 10
`engine.extract` calls, 85-126 s in total:

- **Worker spawns, about 55 s (the largest cost).** Each call spawns a fresh
  one-job regex worker for every pattern it evaluates: 291 spawns at about
  130 ms each. The worker is a one-job RPC server by contract, and the parent
  owns the deadline and the kill (RegexWorkerProgram, RegexWorkerProtocol v2).
  Pooling or batching needs a protocol v3 with a per-job deadline inside a
  long-lived process, which changes the isolation contract.
- **Per-request stage install.** `makeCitationMetadataOperation`
  (MetadataComposition.ts) captures the enclosing `CitationTextBudget` and the
  Scope at install time, and parents install their children inside each
  request's `run`. That is 21 stage types and 53 install call sites
  (DocumentExtraction, TokenizedExtraction, ExtractionEntry, SemanticExtraction,
  CaseName*, Html*, StopWords and others). Moving installation to engine time
  means binding budget, Scope and admission at run time, which changes the
  budget-sharing semantics.
- **Schema encode/decode detach copies, about 15 s for 82 detaches, plus about
  5 s of decode.** Every install re-decodes and detaches its input at every
  nesting level. ownSemanticExtraction detaches a subtree, then
  ownDocumentExtraction detaches it again. Do NOT fix this with an
  identity-keyed memo on module-global WeakMap/WeakSet state: that breaks the
  laws "service composition over global state" and "effect/HashMap & HashSet,
  never native Map/Set", and it breaks the engine's independently-owned copy
  design.
- **Tokenizer rebuild per request, about 13 s.** `makeCitationTokenizer` and
  `prepareTokenizerConfiguration` copy every extractor's bytes and rebuild the
  Aho-Corasick ordering and selection (6,805 bindings) each time. This depends
  on fixing the per-request stage install.
- **Main thread about 40 s busy on Effect/Schema work.** Three parallel engines
  gave only 1.4x.

### What to produce

1. A design, schema-first: an `effect/Schema` model for run-time
   budget/scope/admission binding, then `Context.Service` contracts. Covers
   install-once-per-engine for the stage tree and tokenizer, a detach strategy
   that keeps ownership semantics without global state, and RegexWorkerProtocol
   v3 (a long-lived worker with a per-job deadline, and how isolation and kill
   guarantees survive).
2. A slicing plan that lands it in reviewable PRs: tokenizer/stage install
   first, then detach, then worker v3. Each slice gets measured before/after
   numbers on the same fixture.
3. Validation that runs the large citation suite on its own compute window. The
   host is shared and was overloaded tonight, so run heavy suites on a remote
   worker (dankserver or beep-worker, through the remote-development-agents
   skill) or keep them package-scoped.

### Constraints

- Effect v4 only; validate APIs against the Effect reference checkout. Write no
  code until the design is reviewed.
- Use `/grill-with-docs` on the direction-setting decisions before graduating.
- The public repo must contain no secrets and no absolute home paths.
