# OpenAI Driver (@beep/openai): Sources and Provenance

- **Source exploration:**
  [`explorations/semantica-lab`](../../../explorations/semantica-lab/README.md)
- **Primary ledger:**
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md)
  (§4 "Embeddings (S3-rev, one row; M3)" is this packet's row).
- **Decision authority:**
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md)
  (Current law table "Embeddings" row; S3, S3-rev, M3).
- **Carry-forward date:** 2026-08-24

The exploration ledger remains primary. This file is the pointer set an
implementing agent needs; it does not duplicate the exploration's research.

## 1. Mined source corpus

| Source | Title | Upstream | Location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `brief-embeddings` | BRIEF "Service boundaries" `EmbeddingModel` row; rabbit holes 4, 6, 14, 15 | this repo | [`BRIEF.md`](../../../explorations/semantica-lab/BRIEF.md) | why the Layer lives in a driver, not the lab or the agents slice; dimension freeze; degraded states | constraint source |
| `map-openai-driver` | MAP candidate row `openai-driver`; Capability Check `EmbeddingModel` row; Sequencing step 3; Disposition 1 | this repo | [`MAP.md`](../../../explorations/semantica-lab/MAP.md) | packet mission, template weight, parallel-with-C0 delivery | mission source |
| `decisions-s3` | S3 → S3-rev → M3 | this repo | [`DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md) | shipped Effect Layer over a hand-written op; `.model()` for `Dimensions`; key-only config | decision source |
| `shared-schema-v1.3` | `EmbeddingVector` / `ModelIdentity` family; B4 dimension hazard | this repo | [`shared-schema.md`](../../../explorations/semantica-lab/research/shared-schema.md) | what the lab owns around the driver's `EmbedResponse` | boundary source |
| `workload-contract-v1.3` | "Models (G6)" section | this repo | [`workload-contract.md`](../../../explorations/semantica-lab/research/workload-contract.md) | hosted embeddings through the driver; local lanes parked | boundary source |

## 2. Upstream repositories and licenses

| Repo | License | Port discipline | What this packet takes |
| --- | --- | --- | --- |
| [Effect-TS/effect](https://github.com/Effect-TS/effect) main at `dd99ab007e3352761187dae330d52f65feeff7c0`, local reference checkout `.repos/effect` (provisioned by `scripts/setup-agent-memory.sh`) | MIT | reuse as dependency; read for API truth, never from training priors | `.repos/effect/packages/ai/openai/src/OpenAiEmbeddingModel.ts` (`model()` merges `layer()` with `Layer.succeed(EmbeddingModel.Dimensions, dimensions)`; `layer()` yields `EmbeddingModel` only; `Model` union of embedding ids), `.repos/effect/packages/ai/openai/src/OpenAiLanguageModel.ts` (`layer()` requires `OpenAiClient`; `Model` union), `.repos/effect/packages/ai/openai/src/OpenAiClient.ts` (`layerConfig` options: `apiKey`, `apiUrl`, `organizationId`, `projectId`, `transformClient`; `POST /responses`, `POST /embeddings`), `.repos/effect/packages/effect/src/unstable/ai/EmbeddingModel.ts` (`Dimensions` service, `make({ embedMany })`), `.repos/effect/packages/effect/src/unstable/ai/Model.ts` (`AiModel.Model` extends `Layer`) |
| npm `@effect/ai-openai` 4.0.0-rc.112 | MIT | root dependency already declared in the repo `package.json` (`"@effect/ai-openai": "4.0.0-rc.112"`, beside `@effect/ai-anthropic`) | the package the driver wraps; the new workspace declares it through the catalog like `@beep/anthropic` declares `@effect/ai-anthropic` |
| OpenAI OpenAPI spec (`openai/openai-openapi`, cited in the exploration ledger §3 under S3) | reference only | wire-format reference for `/embeddings` | nothing vendored; the Effect client already encodes it |

## 3. External research sources

- The exploration ledger §3 "S3 embeddings" entry: Effect-TS/effect main
  `EmbeddingModel.ts` and `OpenAiEmbeddingModel.ts`, and the OpenAI
  `POST /embeddings` wire format. No further external sources were mined for
  this packet.

## 4. In-repo capability references

| Capability | Path | Disposition |
| --- | --- | --- |
| `@beep/anthropic` role files | `packages/drivers/anthropic/src/Anthropic.config.ts`, `packages/drivers/anthropic/src/Anthropic.service.ts`, `packages/drivers/anthropic/src/Anthropic.errors.ts`, `packages/drivers/anthropic/src/index.ts` | mirror: env constants, `S.Class` options with `withKeyDefaults`, `*Live` from `layerConfig` + `FetchHttpClient`, `make*Layer` factories, `Layer.unwrap` over `Config` for env-driven defaults; `Anthropic.repair.ts` is not mirrored |
| `@beep/anthropic` tests | `packages/drivers/anthropic/test/Anthropic.test.ts`, `packages/drivers/anthropic/test/Anthropic.equivalence.test.ts` | mirror: wire-shape pins, arbitrary-driven round-trips, declared-field equivalence |
| Stubbed `HttpClient` test layer | `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts` (`makeHttpClientLayer`: `HttpClient.make` + `HttpClientResponse.fromWeb`), also `packages/drivers/xai/test/XAi.service.test.ts` | reuse the pattern so both model Layers are exercised without network |
| `@beep/openai-compat` | `packages/drivers/openai-compat/src/OpenAiCompatClient.service.ts` (`/chat/completions`; default `apiUrl` `https://api.openai.com/v1`; no `@effect/ai` dependency; no embeddings) | contrast only; explains why this driver is separate (M3) and where base-URL variation lives |
| `@beep/identity` composers | `packages/foundation/modeling/identity/src/packages.ts` (`$AnthropicId` precedent) | the scaffold registers `$OpenaiId`; verified at P1 |
| `@beep/schema` | `PosInt`, `SchemaUtils.withKeyDefaults`, `LiteralKit` | reuse for options schemas |
| Driver family law | [`standards/architecture/03-driver-boundaries.md`](../../../standards/architecture/03-driver-boundaries.md), [`standards/architecture/07-non-slice-families.md`](../../../standards/architecture/07-non-slice-families.md) | binding |
| JSDoc law | `.patterns/jsdoc-documentation.md` | binding for every export |
| Scaffold | `bun run beep create-package openai --family drivers --description "Product-neutral Effect driver for OpenAI."` | the only way to create the workspace |
| Thin-driver packet precedent | [`goals/pretext-driver`](../../pretext-driver/README.md) | template-weight shape |
| Exploration-born packet precedent | [`goals/configurable-full-document-editor`](../../configurable-full-document-editor/README.md) | manifest field set |

## 5. Cross-links and provenance

- Primary exploration ledger:
  [`explorations/semantica-lab/research/SOURCES.md`](../../../explorations/semantica-lab/research/SOURCES.md).
- Binding decisions:
  [`explorations/semantica-lab/DECISIONS.md`](../../../explorations/semantica-lab/DECISIONS.md).
- Sibling packet: `semantica-canary` (the consuming lab; it depends on this
  packet before its C1 stage, not before C0).
- This packet's decision log: [`SPEC.md`](../SPEC.md#decision-log).
- Roadmap placement: [`docs/ROADMAP.md`](../../../docs/ROADMAP.md) lists this
  packet as the enabling driver of the lab canary under the slot-free clause
  (DECISIONS M6).
