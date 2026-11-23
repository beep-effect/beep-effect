---
title: "P3: the handoff run is an activity minted at start from operation:Extract, an Engine pin from Effect's model names, the prompt digest and the capture id"
date: 2026-11-22
lane: "goals/text-knowledge-stack-rebuild-p3-annotation"
reversal: "Add a langextract service that carries a version-bearing ActivityPin, provided by each host, by a decision file"
---

`GENERATED_BY` is deleted. The run's `ActivityStart` is:

- `operation`: the registry term `operation:Extract`.
- `pin`: `ActivityPin.Engine { engine, edition }`, read from Effect's own model services `Model.ProviderName` and `Model.ModelName` (`effect/ai/Model.ts:69`, `:86`).
- `promptDigest`: the SHA-256 of the prompt's UTF-8 bytes, through `Digest.digestHex`.
- `used`: the `CaptureId` of `request.source`.
- `started`: a clock read before the prompt.

`activity.id = mintActivityId(start)`.

Every model built with `Model.make` (`:135`) provides the two model names together with its `LanguageModel`, so no langextract service is added. The upstream `AnthropicLanguageModel.model` is `Model.make("anthropic", model, layer(...))` (`.repos/effect/packages/ai/anthropic/src/AnthropicLanguageModel.ts:704-708`), and `@beep/anthropic` builds its layer with it instead of `.layer`.

The pin is `Engine` rather than `Model` because a requester knows the provider and the model id it asked for, not the snapshot behind an alias. `ActivityPin.Model`'s `version` would therefore be invented.

`LangExtractService.layer` requires `LanguageModel`, the two names and `Digest`. These sites provide them:

- the law-practice server (`LawPracticeServerLive`'s requirement grows by the two names, and its hosts get them from `AnthropicLanguageModelLive`);
- semantica (the names come from its `ActiveModelIdentity`);
- the lejeune provider smoke (through `AnthropicLanguageModelLive`);
- the tests, which wrap their stub models in `Model.make`.

Checked on this base: `startExtraction` under `Model.make("test-provider", "stub-model", Layer.empty)` gives the pin `{"_tag":"Engine","engine":"test-provider","edition":"stub-model"}`, and `AnthropicLanguageModel.model(...)` type-checks as `Layer<LanguageModel | ProviderName | ModelName, never, AnthropicClient>`.

Every generation of the run has `at = Some(t)` for one clock read after alignment. Generated therefore never precedes started (the L5-3 order holds for the handoff), and one run has one time, so a run cannot conflict with itself.
