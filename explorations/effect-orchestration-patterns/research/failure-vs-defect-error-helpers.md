# failure-vs-defect-error-helpers

Scope: shape a shared decode→die helper plus `isRetryable`/`isDefect`/`getErrorMessage` predicates over the tagged-error taxonomy, reconcile with law EF-31 and AnthropicTurnKernel repair behavior, decide placement, and name the consuming surfaces (`@beep/nlp-mcp`, `@beep/epistemic-use-cases` ingestion, LLM drivers).

## Findings

### Canonical Effect law (primary sources)

- Effect splits errors into **expected/recoverable/typed failures** (tracked in the error channel via `Effect.fail`) and **defects/unexpected/unrecoverable errors** (NOT in the type channel; runtime-tracked). Terminology is exact: "failures, typed errors or recoverable errors" vs "defects, untyped errors, or unrecoverable errors." [https://effect.website/docs/error-management/two-error-types/]
- `Effect.die(defect: unknown): Effect<never>` and `Effect.dieMessage(message)` create defects; `Effect.orDie` / `Effect.orDieWith(self, f)` convert a typed failure into fiber termination (error channel becomes `never`). Docs: "There is no sensible way to recover from defects." Defect-conversion "should be used only at the boundary between Effect and an external system, to transmit information on a defect for diagnostic or explanatory purposes." [https://effect.website/docs/error-management/unexpected-errors/]
- Defect recovery is deliberately narrow: `Effect.exit` + `Cause` inspection, `Effect.catchAllDefect`, `Effect.catchSomeDefect`. The official docs do NOT classify schema/parse errors as inherently defects — the rule is "if there is business logic to handle the error, use `Effect.fail` and the error channel; otherwise `die`/`orDie`." [https://effect.website/docs/error-management/unexpected-errors/]
- This is exactly what repo law **EF-31** already encodes: `Effect.fail` for expected business/domain failures, `Effect.die`/`orDie` reserved for invariant violations and impossible states, "do not model normal user-facing errors as defects." [/home/elpresidank/YeeBois/projects/beep-effect/standards/effect-first-development.md:730-735]

### The repo is on effect 4.0.0-beta.91 — Cause defect API differs from the published 3.x docs (VERSION GOTCHA)

- Installed/pinned effect is **`4.0.0-beta.91`** (effect-smol line), catalog-pinned. [/home/elpresidank/YeeBois/projects/beep-effect/node_modules/effect/package.json + root package.json]
- The effect.website docs (3.x) reference `Cause.isDie` / `Cause.isDieType(cause)` operating on the whole `Cause`. The vendored beta.91 source instead exposes defect detection at the **`Reason<E>`** level: `Cause.isFailReason`, `Cause.isDieReason: <E>(self: Reason<E>) => self is Die`, `Cause.isInterruptReason`; reasons are tagged `"Fail" | "Die" | "Interrupt"`, and `Die` carries `{ _tag: "Die", defect: unknown }`. [/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Cause.ts:172,198,224,328] — any `isDefect` predicate must be written against beta.91 (`Exit.isFailure` → iterate `cause` reasons → `isDieReason`), NOT copied from the 3.x doc surface. Confirm exact `Exit`/`Cause` traversal helpers against the vendored source before adopting.

### The AiError taxonomy ALREADY ships `isRetryable` — the shared predicate must delegate, not reinvent

- effect-v4 `effect/ai/AiError` defines a tagged `AiError` whose top-level `get isRetryable()` and `get retryAfter()` delegate to the underlying reason, plus `AiError.isAiError(u)`. Each reason owns its own `isRetryable` getter. [/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/ai/AiError.ts:1461,1477]
- The per-reason retryable map (read from source, beta.91):
  - retryable=**true**: `NetworkError`, `RateLimitError`, `InternalProviderError`, `InvalidOutputError`, `StructuredOutputError`, `ToolNotFoundError`, `ToolParameterValidationError`.
  - retryable=**false**: `QuotaExhaustedError`, `AuthenticationError`, `ContentPolicyError`, `InvalidRequestError`, `UnsupportedSchemaError`, `UnknownError`, `InvalidToolResultError`, `ToolResultEncodingError`, `ToolConfigurationError`, `ToolkitRequiredError`, `InvalidUserInputError`. [/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/ai/AiError.ts:100,388,441,496,556,613,670,723,801,879,932,990,1047,1102,1158,1212,1265,1319]
- Both Anthropic plans already consume this verbatim: `while: (error) => AiError.isAiError(error) && error.isRetryable`. [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/anthropic/src/Anthropic.service.ts:107] and [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/anthropic/src/Anthropic.repair.ts:106] — so a net-new repo-wide `isRetryable` for LLM drivers is a thin re-export/compose over `AiError`, scoped to the centralized retry-policy library, NOT a fresh classifier.
- Non-AI drivers carry their own reason-based retryable, which a generic helper should compose rather than replace: m365 uses `isRetryableM365Error = (e) => e.reason === "throttled" || e.reason === "transport"`. [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/m365-mcp/src/M365Handlers.ts:35]

### ADVERSARIAL RECONCILIATION: the imported "schema-validation = DEFECT" seed contradicts how this repo actually handles LLM output

- The seed nuggets (research-squad#2/#7, external `BamlClientService`) prescribe: schema-validation failures are DEFECTS → `Effect.die(new BamlParseError(...))`; `isDefect = (e) => e instanceof BamlParseError`. [/home/elpresidank/YeeBois/projects/beep-effect/explorations/effect-orchestration-patterns/CAPTURE.md:44-45]
- The repo's real LLM-output path does the OPPOSITE for streamed model output. `AnthropicTurnKernel` treats a per-block `decodeSlice` failure as **recoverable**: invalid slices are held for a sequential repair tail, repaired blocks re-emitted in order, and blocks that still cannot be repaired are **dropped and logged (`Effect.logWarning`), never died**. Only a failed repair *call* becomes a typed turn failure. [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:75-111,149-167] and [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/server/src/AssistantTurn/BlockRepair.ts:329-346]
- `BlockRepair` failure path is `Effect.fail` of typed `BlockRepairFailed` (TaggedErrorClass), surfaced as typed `TurnGenerationError` — defect-free, client-safe. [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.repair-errors.ts:29] and [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/use-cases/src/processes/AssistantTurn/AssistantTurn.errors.ts:29]
- Corroborating the source-of-truth: effect-v4 itself marks `InvalidOutputError` (the model returned content failing the output schema) as **`isRetryable: true`**, i.e. a recoverable failure, not a defect. [/home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/ai/AiError.ts:723] — Conclusion: do NOT port the BamlClientService "parse=die" rule onto LLM output. The decode→die helper is for a DIFFERENT category (below).

### The genuine decode→die surface in-repo: re-decoding KNOWN-GOOD internal data

- The legitimate "decode failure IS an invariant violation" sites are converters and projections that re-decode data the program itself just produced. ClaimProjection re-decodes folded counts/total into branded `NonNegativeInt` "from known-good plain numbers" via `S.decodeUnknownSync` (a throw = synchronous die). [/home/elpresidank/YeeBois/projects/beep-effect/packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:60-61]
- Same shape across row converters (`S.decodeUnknownSync(Turn)` / `Thread` / `Message`) and law-practice use-case decoders (`OfficeAction`, `Claim`, `PriorArtReference`, `CandidateClaim`, `Evidence`). [/home/elpresidank/YeeBois/projects/beep-effect/packages/workspace/tables/src/entities/Turn/Turn.converters.ts:46; .../Thread/Thread.converters.ts; .../Message/Message.converters.ts; packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts; .../OfficeActionReview/OfficeActionReview.service.ts]
- A die-at-load invariant guard already exists: `AnthropicStructuredOutput.toCodecAnthropic` THROWS at module load if the schema grows a provider-inexpressible construct — "importing this module doubles as a structural guarantee." [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/server/src/AssistantTurn/AnthropicTurnCodec.ts:1-15,137]
- Helper shape that fits these (effectful variant): `decodeOrDie(schema) = (u) => S.decodeUnknownEffect(schema)(u).pipe(Effect.tapError(logError), Effect.orDie)` — i.e. log-then-`orDie` so the defect carries diagnostics, matching the docs' "transmit information on a defect for diagnostic purposes." Sync callers keep `S.decodeUnknownSync` (throw = die). This generalizes the inline `Effect.logError(...).pipe(Effect.zipRight(Effect.die(...)))` of the seed without the parse-is-defect misclassification.

### Placement decision (recommended)

- Split by dependency surface. `@beep/schema` depends on `effect` core only (no `effect/ai`) and already hosts the error toolkit: `TaggedErrorClass`, `CauseTaggedError`, `StatusCauseError`, `StatusCauseTaggedErrorClass`. [/home/elpresidank/YeeBois/projects/beep-effect/packages/foundation/modeling/schema/src/index.ts:49,326,331,341 + package.json deps: @beep/data,@beep/identity,@beep/utils,effect (no ai)]
  - Put the **generic, AI-free** helpers here: `decodeOrDie`/`decodeOrDieSync`, `isDefect` (Cause/Exit-based, beta.91 `isDieReason`), `getErrorMessage` (extract `.message` from TaggedError / `Cause.pretty` fallback). Today message extraction is duplicated locally (postgres/pglite each define a private message extractor). [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/postgres/src/Postgres.errors.ts; .../pglite/src/Pglite.errors.ts]
  - Keep the **`isRetryable`-over-AiError** predicate with the exploration's net-new centralized retry-policy library (LLM-driver scope), re-exporting `AiError.isAiError(e) && e.isRetryable` and composing driver-specific reason predicates (m365, future gov-data drivers). This avoids coupling foundation `@beep/schema` to the AI module.
- Avoid a brand-new top-level package for the helpers alone; co-locate generic predicates in `@beep/schema` and retryable/Schedule policy in the retry-policy module the exploration is already chartering.

### Consuming surfaces (named)

- **`@beep/nlp-mcp`** streaming batch extraction (`Streaming/Pipeline.ts`, `StreamingHandlers.ts`) — bounded fan-out where one bad doc must not abort the batch; wants `isRetryable` (transient retry) + recoverable-failure-per-item (NOT die). [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/nlp-mcp/src/Streaming/Pipeline.ts]
- **`@beep/epistemic-use-cases` ingestion** (no `@beep/epistemic` package exists; the real aliases are `@beep/epistemic-{domain,use-cases,server,tables}`) — `ClaimProjection` (the canonical decode→die re-decode site) and `ClaimGate.service.ts` decode flows. [/home/elpresidank/YeeBois/projects/beep-effect/packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts; .../ClaimGate/ClaimGate.service.ts]
- **LLM drivers** — `anthropic` (+ `Anthropic.repair`), `openai-compat`, `xai`, `venice-ai`, and the `agents/server` `AnthropicTurnKernel`/`BlockRepair` consumers, all already using `AiError.isRetryable`; they consume the shared retryable + `getErrorMessage` for log/telemetry. [/home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/anthropic/src/Anthropic.service.ts:107]

### Gotcha: retry `while` refinement narrowing is unsound with attempt caps

- Effect's `retry` `while`-refinement type-narrowing is reported unsound when combined with an attempt count (`times`), and a separate request tracks adding refinement support — relevant because the drivers pair `ExecutionPlan.make({ attempts, while })`. Treat the `while` predicate's output-error narrowing as advisory and keep the post-plan error type pinned explicitly (the kernel already casts the post-plan stream type). [https://github.com/Effect-TS/effect-smol/issues/1982] [https://github.com/Effect-TS/effect/issues/6122] and [/home/elpresidank/YeeBois/projects/beep-effect/packages/agents/server/src/AssistantTurn/AnthropicTurnKernel.ts:129-132]

## Sources

- Effect docs — Two Types of Errors: https://effect.website/docs/error-management/two-error-types/
- Effect docs — Unexpected Errors (die/orDie/orDieWith/catchAllDefect/catchSomeDefect): https://effect.website/docs/error-management/unexpected-errors/
- Effect docs — Expected Errors: https://effect.website/docs/error-management/expected-errors/
- Effect docs — Retrying: https://effect.website/docs/error-management/retrying/
- Effect docs — Schedule Combinators (whileInput/recurWhile): https://effect.website/docs/scheduling/schedule-combinators/
- Effect-TS issue — retry `while` refinement unsound with `times` (effect-smol#1982): https://github.com/Effect-TS/effect-smol/issues/1982
- Effect-TS issue — support Refinement narrowing for `while` (effect#6122): https://github.com/Effect-TS/effect/issues/6122
- Vendored effect-v4 AiError taxonomy (per-reason isRetryable): /home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/ai/AiError.ts
- Vendored effect-v4 Cause reasons (isDieReason/Die/Fail): /home/elpresidank/YeeBois/projects/beep-effect/.repos/effect-v4/packages/effect/src/Cause.ts
- Repo law EF-31: /home/elpresidank/YeeBois/projects/beep-effect/standards/effect-first-development.md:730
- Repo error-handling pattern: /home/elpresidank/YeeBois/projects/beep-effect/.patterns/error-handling.md
- AnthropicTurnKernel / BlockRepair / TurnCodec: /home/elpresidank/YeeBois/projects/beep-effect/packages/agents/server/src/AssistantTurn/{AnthropicTurnKernel,BlockRepair,AnthropicTurnCodec}.ts
- Anthropic driver service/repair/errors: /home/elpresidank/YeeBois/projects/beep-effect/packages/drivers/anthropic/src/{Anthropic.service,Anthropic.repair,Anthropic.errors}.ts
- @beep/schema barrel + package.json: /home/elpresidank/YeeBois/projects/beep-effect/packages/foundation/modeling/schema/src/index.ts
- Decode→die precedents: /home/elpresidank/YeeBois/projects/beep-effect/packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts ; packages/workspace/tables/src/entities/*/.../*.converters.ts
- Exploration capture (seed nuggets #2/#7): /home/elpresidank/YeeBois/projects/beep-effect/explorations/effect-orchestration-patterns/CAPTURE.md

## Open / Unverified

- **UNVERIFIED**: exact beta.91 traversal to enumerate `Die` reasons from an `Exit`/`Cause` (whether a public `Cause.defects`/`filterDefects`/`reasons` accessor exists, or callers must fold reasons manually). Confirm against `.repos/effect-v4/packages/effect/src/Cause.ts` before writing `isDefect`. The 3.x `Cause.isDie`/`isDieType` from effect.website do NOT exist as-is in beta.91.
- **UNVERIFIED**: whether `@beep/schema` can host `getErrorMessage` over arbitrary tagged errors without importing the AI module — needs a structural (duck-typed `.message`) extractor + `Cause.pretty` fallback, since AiError-specific extraction would re-introduce the AI dependency. Recommend keeping the AI-aware extractor in the retry-policy/driver layer.
- **UNVERIFIED**: openai-compat/xai/venice retry `while` predicates were inferred to mirror anthropic's `AiError.isRetryable`; only the anthropic and m365 predicates were read directly. Verify the other three drivers before claiming a uniform retryable surface.
- **OPEN (design)**: should `decodeOrDie` log at `logError` (default) or accept a severity, and should it attach the original `ParseError` as the `Die` defect payload (yes, per docs "transmit information on a defect for diagnostic purposes") vs a redacted summary — decide alongside `@beep/observability` `redactString` usage already in BlockRepair.
- **No licensing concern**: all reconciled code is first-party Effect (effect beta.91, MIT) and first-party `@beep/*`. The external `BamlClientService`/`errors.ts` seeds are NOT ported (their parse=defect rule is explicitly rejected here), so no third-party license attaches.
