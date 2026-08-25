# OpenAI Driver (@beep/openai) Spec

## Objective

Ship `@beep/openai`, a new packages/drivers/openai workspace (prose until it
exists), scaffolded through
`bun run beep create-package openai --family drivers --description "Product-neutral Effect driver for OpenAI."`
(never `mkdir`). The package mirrors `@beep/anthropic`'s role files
(`packages/drivers/anthropic/src/Anthropic.config.ts`,
`packages/drivers/anthropic/src/Anthropic.errors.ts`,
`packages/drivers/anthropic/src/Anthropic.service.ts`; the Anthropic-specific
`Anthropic.repair.ts` has no OpenAI counterpart) and composes `@effect/ai-openai`
4.0.0-rc.111 (already a root dependency) behind typed config and errors:

- `OpenAiLive`: `OpenAiClient.layerConfig({ apiKey })` over `FetchHttpClient`,
  the key read from Effect `Config` as a redacted value.
- A Layer factory for `OpenAiLanguageModel` and a Layer factory for
  `OpenAiEmbeddingModel`, each taking a schema-backed options class.
- Env-driven convenience Layers for the default language model and the default
  embedding model, mirroring `AnthropicLanguageModelLive`.

Observable end state: a consumer provides the driver's Layers and obtains
`LanguageModel.LanguageModel`, or `EmbeddingModel.EmbeddingModel` together with
`EmbeddingModel.Dimensions`, from `effect/unstable/ai` without importing
`@effect/ai-openai` itself. No engine code is written anywhere; the driver adds
config, errors, Layer composition, docs, and tests.

Why this packet exists and why it is thin is settled in
[`explorations/semantica-lab/DECISIONS.md`](../../explorations/semantica-lab/DECISIONS.md)
(S3, S3-rev, M3) and summarized in the Decision Log below; do not re-derive it.

## Non-Goals

- Any lab code. `ModelIdentity`, `EmbeddingVector`, `DegradedEmbedding`, the
  provider cache, and dimension-keyed vector tables belong to the consuming
  lab (BRIEF "Service boundaries" and rabbit holes 4-6, 14-15).
- Venice or xAI embeddings. Those providers arrive later as openai-compat
  protocol configs (DECISIONS S3-rev, M3), not as knobs on this driver.
- Local or ONNX embeddings, GPU lanes, model downloads (DECISIONS G6).
- `apiUrl`, `organizationId`, `projectId`, or `transformClient` knobs in M1.
  Base-URL and protocol variation is `@beep/openai-compat`'s role (M3: "no
  `apiUrl` knob (base-URL is openai-compat's role)"). Rejected alternative:
  exposing `OpenAiClient.layerConfig`'s full option set so one driver serves
  every OpenAI-compatible host; rejected because it recreates the protocol
  driver this repo already has and drags the semantica lab's provider
  identity back to a URL.
- A `/embeddings` operation or `EmbeddingModel.make` Layer in
  `@beep/openai-compat` (the S3 plan, superseded by S3-rev: it duplicated
  shipped Effect code).
- Retry or execution plans beyond what `@beep/anthropic` already models; add
  an `ExecutionPlan` only if a consumer needs it and say so in the decision
  log.
- Anthropic embeddings (no such API) and any change to `@beep/anthropic`.

## Source Hierarchy

1. User objective or issue that created this packet.
2. `AGENTS.md`, `CLAUDE.md`, and required skills (`effect-first-development`,
   `schema-first-development`, `jsdoc-annotation-specialist`, `yeet`).
3. Governing architecture standards:
   [`standards/architecture/03-driver-boundaries.md`](../../standards/architecture/03-driver-boundaries.md)
   and
   [`standards/architecture/07-non-slice-families.md`](../../standards/architecture/07-non-slice-families.md).
4. This `SPEC.md`.
5. `PLAN.md`.
6. `GOAL.md`.
7. Supporting `research/`, `ops/`, and `history/` files, and the source
   exploration's `BRIEF.md`, `MAP.md`, `DECISIONS.md`, and
   `research/shared-schema.md`.

Higher sources outrank lower sources when they conflict.

## Target Surfaces

- The new packages/drivers/openai workspace (prose; scaffolded in P1): `src/`,
  `test/`, `docs/`, `package.json`, `tsconfig*.json`, `vitest.config.ts`.
- The generated `@beep/identity` composer registration that
  `bun run beep create-package` writes into
  `packages/foundation/modeling/identity/src/packages.ts` (the `$AnthropicId`
  precedent lives there).
- Repo-level files the scaffold and governance gates touch: root `package.json`
  workspace list if the CLI edits it, synced `tsconfig` references, fallow
  boundary snapshots, lint-policy inventories, and one changeset naming
  `@beep/openai`.
- This packet's files (status, evidence, reflection).

## Constraints

### Driver family law

- Dev-safe driver duties from `03-driver-boundaries.md`: hide the third-party
  API shape, expose small typed services, centralize technical errors, provide
  test layers or fixtures, own technical config, and carry no product
  vocabulary. The driver `.config.ts` owns technical knobs only.
- Flat family shape from `07-non-slice-families.md`: one segment directly under the drivers directory,
  `"beep": { "family": "drivers" }`, no `kind` segment.
- The package exports `.` only (plus the `package.json` subpath export); the
  `internal/*` subpath stays null, matching `@beep/anthropic`.

### Composition facts (verified in the Effect reference checkout)

Cite `.repos/effect/packages/ai/openai/src` (Effect-TS/effect main at
`02a5146d69`) when writing or reviewing the service file:

- `OpenAiEmbeddingModel.layer({ model, config? })` returns
  `Layer<EmbeddingModel, never, OpenAiClient>` and does **not** provide
  `EmbeddingModel.Dimensions`.
- `OpenAiEmbeddingModel.model(model, { dimensions, config? })` returns an
  `AiModel.Model<"openai", EmbeddingModel | EmbeddingModel.Dimensions, OpenAiClient>`,
  which is a `Layer` (it merges `layer(...)` with
  `Layer.succeed(EmbeddingModel.Dimensions, dimensions)`). The driver's
  embedding factory uses this path so the consuming lab can read `Dimensions`
  and key its vector tables.
- `OpenAiLanguageModel.layer({ model, config? })` returns
  `Layer<LanguageModel, never, OpenAiClient>`; it likewise requires
  `OpenAiClient`.
- `OpenAiClient.layerConfig({ apiKey, ... })` returns
  `Layer<OpenAiClient, ConfigError, HttpClient>`; the client posts to
  `/responses` and `/embeddings` under `https://api.openai.com/v1`.
- `EmbeddingModel.Dimensions` is `Context.Service<Dimensions, number>` in
  `effect/unstable/ai/EmbeddingModel`.

### Config

- Key-only: `AI_OPENAI_API_KEY` (redacted), `AI_OPENAI_MODEL`,
  `AI_OPENAI_EMBEDDING_MODEL`, mirroring `AI_ANTHROPIC_API_KEY` /
  `AI_ANTHROPIC_MODEL`. Docs and examples show secrets as `op://` references
  (`op://BEEP_SECRETS/OpenAI/API Key` shaped), never raw values.
- Embedding dimensions is an explicit option on the embedding options class,
  never an env default: the lab freezes its dimension only at C1 with an
  alternate-dimension fixture (BRIEF rabbit hole 6, shared-schema "no DDL
  names a dimension"), so the driver must not bake one in.
- Default model ids are pinned constants chosen at P0 from the reference
  `Model` unions in `OpenAiLanguageModel.ts` and `OpenAiEmbeddingModel.ts`
  (embedding candidates: `text-embedding-3-small`, `text-embedding-3-large`,
  `text-embedding-ada-002`). Record the chosen ids in the decision log.

### Code law

- Schema-first: options are `S.Class` schemas with `SchemaUtils.withKeyDefaults`
  for defaults and `PosInt` for dimensions; any literal domain uses
  `LiteralKit` from `@beep/schema`; identity via the generated `$OpenAiId`
  composer.
- Effect v4 only; validate every API against the reference checkout before
  writing. Generators use `Effect.fn` / `Effect.fnUntraced`; `HashMap` /
  `HashSet` over native collections; no `as`, no `null`, no native helpers.
- Full package ceremony: docgen with titled `**Example** (Title)` sections and
  `**Details**` / `**Gotchas**` prose (`.patterns/jsdoc-documentation.md`),
  JSDoc on every export, coverage, a changeset, and the new-package governance
  gates (`bun run beep tsconfig-sync`, `bun run beep fallow boundaries`,
  `bun run beep lint policy`, jsdoc ratchet, knip).
- Tests: the schema wire-shape, round-trip, and declared-field equivalence
  pattern from `packages/drivers/anthropic/test/Anthropic.test.ts` and
  `packages/drivers/anthropic/test/Anthropic.equivalence.test.ts`; the stubbed
  `HttpClient` pattern from
  `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts`
  (`HttpClient.make` + `HttpClientResponse.fromWeb` behind a `Layer.effect` for
  `HttpClient.HttpClient`) so the client, the embedding Layer, and the language
  model Layer are exercised without network. `bunx --bun vitest run` via the
  package script, never `bun test`.
- No changes to `@beep/anthropic`, `@beep/openai-compat`, or any lab.

## Acceptance Criteria

- [ ] The workspace exists at the scaffolded path with `@beep/openai` as its
      name, `"beep": { "family": "drivers" }`, and the `@beep/anthropic`
      export map shape.
- [ ] `OpenAiLive` has type `Layer<OpenAiClient, ConfigError, never>` and reads
      `AI_OPENAI_API_KEY` as a redacted config at acquisition.
- [ ] A test composes the embedding Layer built through
      `OpenAiEmbeddingModel.model()` over a stubbed `HttpClient` and reads
      `EmbeddingModel.Dimensions` equal to the requested dimensions; a stubbed
      `/embeddings` response round-trips through `embedMany`.
- [ ] A test composes the language model Layer over the same stub and obtains
      `LanguageModel.LanguageModel`.
- [ ] The env-driven Live Layers resolve `AI_OPENAI_MODEL` and
      `AI_OPENAI_EMBEDDING_MODEL` with the pinned defaults as fallback.
- [ ] Every export carries JSDoc with a titled `**Example**`; `bun run docgen:local`
      is green.
- [ ] A changeset naming `@beep/openai` is present.
- [ ] `bun run beep yeet verify` is green, including the new-package governance
      gates.
- [ ] No unrelated refactors or formatting churn.

## Verification Matrix

| Check | Command or evidence | Required result |
| --- | --- | --- |
| Packet launcher size | `test "$(wc -m < goals/openai-driver/GOAL.md)" -le 4000` | Passes |
| Manifest JSON | `jq . goals/openai-driver/ops/manifest.json` | Passes |
| Whitespace | `git diff --check -- goals/openai-driver` | Passes |
| Goals index and doctor | `bun run beep goals index --check` and `bun run beep goals doctor` | Passes |
| Package tests | `bun run --cwd <scaffolded path> test` | Green; Dimensions and LanguageModel tests present |
| Docgen | `bun run docgen:local` | Green |
| Full proof | `bun run beep yeet verify` | Green |
| Completion gate | `bun run beep yeet monitor` | `merge-ready: yes` |
| Reflection | `bun run beep lint reflection-artifacts` | Passes at P4 |

## Stop Conditions

- The reference checkout disagrees with the composition facts above (for
  example `.layer()` starts providing `Dimensions`, or `layerConfig` changes
  shape): stop, record the delta here, then continue.
- The scaffold CLI cannot produce a `drivers` package without manual `mkdir` or
  hand-edits to generated identity files.
- Verification needs a live OpenAI key or paid calls; unit proof must run
  against the stubbed client only.
- The implementation would exceed named scope (protocol knobs, lab schemas,
  engine code, retries beyond precedent).
- The same blocker repeats after reasonable investigation.

## Decision Log

| Id | Decision | Source |
| --- | --- | --- |
| D1 | Embeddings come from the shipped `@effect/ai-openai` `OpenAiEmbeddingModel`, not a hand-written `/embeddings` op in `@beep/openai-compat`. | DECISIONS S3 (superseded), S3-rev |
| D2 | Own packet at template weight; mirror anthropic role files minus `repair.ts`; expose `.model()` for `Dimensions` (`.layer()` yields `EmbeddingModel` only); key-only config `AI_OPENAI_API_KEY` / `AI_OPENAI_MODEL` / `AI_OPENAI_EMBEDDING_MODEL`; no `apiUrl` knob. | DECISIONS M3 |
| D3 | Layer factories return Layers that still require `OpenAiClient`; `OpenAiLive` satisfies it, and the env-driven `*Live` convenience Layers bake `OpenAiLive` in (R = never, E = ConfigError, as `AnthropicLanguageModelLive` does). This is what lets tests provide a stubbed `HttpClient` under `OpenAiClient.layer`. | This packet (S3-rev names the surface; the split is the test requirement) |
| D4 | Dimensions is an explicit `PosInt` option with no env default. | BRIEF rabbit hole 6; shared-schema B4 hazard |
| D5 | The errors module ships only with a live raiser. The boundary's error vocabulary is `Config.ConfigError` (key resolution) and `AiError.AiError` (provider); if P1 finds no driver-owned failure, document that instead of exporting a vacuous tagged error. | This packet; `Anthropic.errors.ts` exists for `repair.ts` only |
| D6 | Default model ids are pinned at P0 from the reference `Model` unions and recorded here. | This packet |

## Exception Ledger

| Exception | Scope | Owner | Rationale | Removal condition |
| --- | --- | --- | --- | --- |
| None | N/A | N/A | N/A | N/A |
