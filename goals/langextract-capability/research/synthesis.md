# LangExtract Capability Synthesis

Status: `accepted-for-implementation`

Research reports complete:

- `reports/repo-reuse-audit.md`
- `reports/nlp-fit-audit.md`
- `reports/effect-v3-reference.md`
- `reports/effect-v4-migration.md`
- `reports/architecture-boundaries.md`
- `reports/extraction-alignment.md`
- `reports/testing-quality.md`

Proposal review inventories:

- `reports/proposal-review-round-1.md`: `0 required findings`

## Accepted Proposal

Build `@beep/langextract` as a provider-neutral foundation capability at
`packages/foundation/capability/langextract`.

The package owns the structured-extraction substrate:

- extraction targets, examples, requests, options, results, and diagnostics;
- prompt/output contracts for LangExtract-style extraction;
- model-response parsing and schema decoding;
- deterministic source alignment;
- typed errors and error translation;
- conversion into `@beep/nlp/Handoff`;
- deterministic fake-model tests.

The package does not own provider runtime concerns:

- no concrete provider SDK imports;
- no provider env/config loaders;
- no live provider smoke tests;
- no CLI, rendering, or visualization workflows;
- no driver placement in V1.

## Boundary Decision

The foundation capability route is valid only under this narrow interpretation:
`@beep/langextract` is repo-owned extraction infrastructure, not a wrapper around
any provider or external LangExtract runtime.

The implementation must include an explicit README architecture-fit section with:

- the specific-home-first proof;
- provider-neutral dependency statement;
- non-goals;
- consumer or platform-capability rationale;
- reuse audit for `@beep/nlp` primitives;
- public subpath table with tests.

The initial consumer proof may be a platform-capability rationale if no consumer
imports the package in the same PR. That rationale must name likely first
consumers and remain visible until real imports replace it.

## Reuse Decisions

### Reuse As-Is

- `@beep/nlp/Core.Document`
- `@beep/nlp/Core.Token`
- `@beep/nlp/Core.CharPosition`
- `@beep/nlp/Handoff.Mention`
- `@beep/nlp/Handoff.Entity`
- `@beep/nlp/Handoff.Relation`

### Extend `@beep/nlp` First

- `@beep/nlp/Handoff.Span`: encode non-negative half-open `[start, end)` span
  invariants and order validation.
- `@beep/nlp/Handoff.Provenance`: encode confidence as finite `[0, 1]`.
- Small generic span helpers if needed by the public handoff contract:
  `length`, `contains`, `overlaps`, `sliceSource`, and `withinSource`.
- `AnnotatedDocument` source identity only if implementation proves the current
  shape is insufficient for LangExtract handoff.

### LangExtract-Local With Rationale

- extraction targets and examples;
- prompt sections and model-output format instructions;
- raw parser state;
- alignment candidates, scores, and traces;
- retry/pass orchestration;
- deterministic fake language-model fixtures unless intentionally exported as a
  test helper.

## Public API Direction

Use a small explicit export surface. Candidate subpaths:

- `@beep/langextract`
- `@beep/langextract/Target`
- `@beep/langextract/Extraction`
- `@beep/langextract/Alignment`
- `@beep/langextract/Service`
- `@beep/langextract/Handoff`

Add `@beep/langextract/Test` only if fake-model helpers are genuinely reusable
outside this package's own tests.

Block `./internal/*` and avoid wildcard canonical exports.

## Service Direction

Use Effect v4 service and layer patterns:

- define `LangExtract` with `Context.Service`;
- consume an injected `effect/ai/LanguageModel.LanguageModel`;
- wire explicit layers with `Layer.effect` or `Layer.succeed`;
- translate AI and schema errors into LangExtract tagged errors;
- keep concrete provider layers in drivers or app composition.

Do not use v3 `Context.Tag`, `Effect.Service`, generated `.Default`, service
`dependencies`, provider adapters, or synchronous boundary decoders.

## Schema And Error Direction

Use schema-first models for all external and public boundaries:

- requests, options, targets, examples, parsed model outputs, results, spans,
  diagnostics, and handoff adapters;
- `S.decodeUnknownEffect`, `S.decodeEffect`, and `S.encodeEffect`;
- JSON string codecs for model text fallbacks;
- closed tagged errors for parse, schema, model, alignment, and handoff failures.

Model output is untrusted. The service must validate parsed data and align spans
against source text before public output.

## Alignment Direction

V1 alignment is deterministic and source-string based:

1. normalize source input into a source document or source text record;
2. chunk text with source offsets;
3. prompt the injected language model;
4. parse and decode model output;
5. align candidates against source text;
6. prefer exact match, then normalized lesser match, then bounded fuzzy match;
7. map aligned candidates to `@beep/nlp/Handoff`;
8. return diagnostics without raw prompts/completions by default.

V1 offset unit: JavaScript string indices, documented as the public character
offset unit for this implementation. If a future Unicode-code-point contract is
needed, it should be a separate compatibility decision.

Streaming is deferred for V1 unless implementation proves it is trivial to expose
schema-backed LangExtract domain events. Raw AI stream parts are not public API.

## Testing Direction

Use deterministic tests only:

- span invariant tests;
- parser tests for fenced JSON, wrapper objects, top-level arrays, invalid JSON,
  and schema-invalid objects;
- alignment tests for exact, lesser, fuzzy, duplicate, overlapping, and unaligned
  candidates;
- service tests with fake `LanguageModel.LanguageModel` layers;
- typed error mapping tests;
- handoff adapter tests;
- property tests where schema-generated data materially helps.

Use `@effect/vitest` and package scripts. Do not use `bun test` as the proof
lane and do not require provider API keys.

## Implementation Order

1. Promote required `@beep/nlp` span/provenance invariants and focused tests.
2. Scaffold `packages/foundation/capability/langextract` with package metadata,
   explicit exports, README, and private internals.
3. Add schema models and typed errors.
4. Add parser and alignment modules with pure deterministic tests.
5. Add service orchestration over injected `LanguageModel`.
6. Add handoff adapter into `@beep/nlp/Handoff`.
7. Add package-level tests, docs, docgen, and export catalog updates.
8. Run focused checks, QRFL, Yeet, PR publish, and monitor.

## Proposal Review Inventory

The proposal-review loop is stored separately under
`reports/proposal-review-round-1.md`.

Current required finding count: `0`.

## Open Decisions

- Which exact first consumer will replace the initial platform-capability
  rationale?
- Whether `AnnotatedDocument` needs source identity promotion in V1 or whether
  the LangExtract result can carry source identity beside the handoff document.
- Whether fake model helpers become a public `Test` subpath or remain internal
  fixtures.
