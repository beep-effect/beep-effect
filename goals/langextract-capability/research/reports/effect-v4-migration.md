# Effect v4 Migration Report

Scope: P1 read-only migration lane covering Schema, services/layers, Stream, AI `LanguageModel`, and tests.

Status: completed from Effect v4 upstream sources, local provider drivers, `@beep/nlp`, and the v3 reference.

## Facts

- The repo uses Effect v4 beta dependencies, including `effect` and `@effect/vitest`.
- Effect v4 service definitions use `Context.Service`; v3-style `Context.Tag`, `Effect.Tag`, `Effect.Service`, generated `.Default`, and inline `dependencies` do not match the current service pattern.
- Effect v4 Schema has API changes from v3. Important migrations include `decodeUnknownEffect`, `decodeEffect`, `encodeEffect`, JSON string codecs, array-form unions/tuples, direct `Record(key, value)`, and `TaggedErrorClass`.
- Effect v4 Schema supports schema-backed classes and `Schema.toArbitrary` for generated property tests.
- `effect/ai/LanguageModel` is the provider-neutral AI service surface. Its service exposes `generateText`, `generateObject`, and `streamText`.
- Local provider drivers already build `LanguageModel.LanguageModel` layers from concrete provider clients.
- `Stream` is first-class and already used in local drivers for provider response streaming.
- `@effect/vitest` supports `it.effect`, layer-based tests, and schema-backed property tests through Effect test helpers.
- The v3 reference uses older service, schema, provider, and CLI patterns that should not be copied.

## Evidence

- Effect v4 service migration docs: `.repos/effect-v4/migration/services.md`.
- Effect v4 schema migration docs: `.repos/effect-v4/migration/schema.md` and `.repos/effect-v4/packages/effect/SCHEMA.md`.
- Effect v4 AI language-model service: `.repos/effect-v4/packages/effect/src/ai/LanguageModel.ts`.
- Effect v4 Stream source: `.repos/effect-v4/packages/effect/src/Stream.ts`.
- Effect Vitest source: `.repos/effect-v4/packages/vitest/src/index.ts`.
- Local provider adapters: `packages/drivers/openai-compat/src/OpenAiCompatLanguageModel.service.ts`, `packages/drivers/xai/src/XAiLanguageModel.service.ts`, and `packages/drivers/venice-ai/src/VeniceAiLanguageModel.service.ts`.
- Local NLP service/layer shape: `packages/foundation/capability/nlp/src/NLPService.ts`.
- Reference v3 service/provider patterns: `/home/elpresidank/YeeBois/ontology_research/ontology_ts_repos/effect-langextract/src`.

## Inferences

- `@beep/langextract` should be a small Effect v4 service that requires an injected `LanguageModel.LanguageModel` when orchestration needs model inference.
- AI-specific unstable types should be kept near constructors/layers and not leak through every public model.
- Schema-decoded boundaries are important because model responses are untrusted external input.
- Streaming should be deferred or exposed as schema-backed LangExtract domain events, not raw provider/AI stream parts.
- Tests should prove deterministic behavior with fake language-model layers, not live provider calls.

## Recommendations

1. Define services with `Context.Service` and explicit `Layer.effect` or `Layer.succeed` wiring.
2. Use `S.Class` or repo schema-model helpers for request, option, result, span, extraction, and diagnostic models.
3. Use `TaggedErrorClass` for closed public error types and translate `AiError` and schema errors at the boundary.
4. Use `LanguageModel.generateObject` when practical, with schema decoding of returned data. Support text/JSON fallback only through a typed parser.
5. Use `S.decodeUnknownEffect`, `S.decodeEffect`, `S.encodeEffect`, and JSON string codecs instead of removed v3 Schema APIs.
6. Use `Stream` only for typed LangExtract events if V1 includes streaming.
7. Use `@effect/vitest`, `it.effect`, and schema/property tests through `Schema.toArbitrary` or existing repo wrappers.
8. Use fresh/local layer memoization intentionally in tests that need isolated fake-model state.

## Do Not Do

- Do not copy v3 `Effect.Service`, `.Default`, `DefaultWithoutDependencies`, `Context.Tag`, or service `dependencies` patterns.
- Do not depend on concrete provider packages, provider SDKs, provider env/config loaders, or live model layers from foundation.
- Do not use removed or renamed v3 Schema APIs such as `Schema.Data`, `validate*`, `withDefaults`, `parseJson`, old `decodeUnknown`, variadic `Union`/`Tuple`, or unconstrained `optionalWith` migrations.
- Do not use synchronous decoders or constructor throws for external/model input that belongs in the Effect error channel.
- Do not expose raw AI stream chunks as the public LangExtract stream contract.
- Do not trust model-provided offsets without deterministic validation.

## Open Questions

- Should V1 include streaming extraction events, or defer streaming until the batch API is stable?
- Should extraction prefer `generateObject` only, or include a text/JSON fallback for providers with weaker structured output?
- Should the package require `@beep/nlp` tokenization service, or keep V1 alignment pure and independent of NLP service layers?
