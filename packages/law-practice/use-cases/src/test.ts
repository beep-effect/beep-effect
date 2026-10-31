/**
 * Test-only law-practice use-case fixtures.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Port-output schema for the `Effect` a law-practice port method returns,
 * exported for package-local guard and codec tests.
 *
 * **Example** (Guard a port output)
 *
 * ```ts
 * import { EffectOutput } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(EffectOutput<number>())(Effect.succeed(1))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { EffectOutput } from "./internal/effectOutput.ts";
/**
 * In-memory verdict-log store for review-queue tests: an append-only chunk of
 * rows held in a `Ref`, empty on every build of the layer.
 *
 * **Example** (Provide the in-memory store to the review queue)
 *
 * ```ts
 * import { RecordVerdictInput, ReviewQueue, ReviewQueueLive } from "@beep/law-practice-use-cases/ReviewQueue"
 * import { VerdictLogMemory } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* ReviewQueue
 *   yield* queue.recordVerdict(
 *     RecordVerdictInput.make({ itemId: "claim-finding:1", batchId: "sitting-1", verdict: "partly" })
 *   )
 *   console.log((yield* queue.readLog).length) // 1
 * }).pipe(Effect.provide(ReviewQueueLive.pipe(Layer.provide(VerdictLogMemory))))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
/**
 * In-memory answer-log store for question-queue tests: an append-only chunk
 * of rows held in a `Ref`, empty on every build of the layer.
 *
 * **Example** (Provide the in-memory store to the question queue)
 *
 * ```ts
 * import { AnswerLogMemory } from "@beep/law-practice-use-cases/test"
 * import { QuestionQueue, QuestionQueueLive } from "@beep/law-practice-use-cases/QuestionQueue"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * const program = Effect.gen(function* () {
 *   const queue = yield* QuestionQueue
 *   console.log((yield* queue.readLog).length) // 0
 * }).pipe(Effect.provide(QuestionQueueLive.pipe(Layer.provide(AnswerLogMemory))))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
/**
 * In-memory review-item store for review hub and producer tests: the latest
 * version of each item, held in a `Ref`, empty on every build of the layer.
 *
 * **Example** (Provide the in-memory item store)
 *
 * ```ts
 * import { ReviewItemStore } from "@beep/law-practice-use-cases/ReviewItemStore"
 * import { ReviewItemStoreMemory } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   console.log((yield* (yield* ReviewItemStore).list).length) // 0
 * }).pipe(Effect.provide(ReviewItemStoreMemory))
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { AnswerLogMemory, ReviewItemStoreMemory, VerdictLogMemory } from "./internal/logMemory.ts";
/**
 * Decodes a one-page fixture OCR result with fixed engine, digest and timing
 * metadata around the given text.
 *
 * **Example** (Decode a fixture OCR page)
 *
 * ```ts
 * import { fixtureOcrPage } from "@beep/law-practice-use-cases/test"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const page = yield* fixtureOcrPage("Claims 1-3 are rejected.")
 *   console.log(page.pageNumber) // 1
 * })
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { fixtureOcrPage } from "./internal/officeActionFixture.ts";
/**
 * Spike entity input schema exported for package-local schema parity tests.
 *
 * **Example** (Decode entity input schema)
 *
 * ```ts
 * import { EntityInput } from "@beep/law-practice-use-cases/test"
 * import * as S from "effect/Schema"
 *
 * const input = S.decodeUnknownSync(EntityInput)({
 *   createdAt: 1,
 *   createdByPrincipal: { component: "Runtime", kind: "System" },
 *   entityType: "LawPracticeClaim",
 *   id: 2,
 *   orgId: 1,
 *   rowVersion: 1,
 *   schemaVersion: "0.0.0",
 *   source: "System",
 *   updatedAt: 3,
 *   updatedByPrincipal: { component: "Runtime", kind: "System" }
 * })
 *
 * console.log(input.source) // "System"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export { EntityInput } from "./internal/spikeEntity.ts";
/**
 * Fixed office-action review spike candidates.
 *
 * **Example** (Log spike candidates length)
 *
 * ```ts
 * import { OfficeActionReviewSpikeCandidates } from "@beep/law-practice-use-cases/test"
 *
 * console.log(OfficeActionReviewSpikeCandidates.length)
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export { OfficeActionReviewSpikeCandidates } from "./OfficeActionReview/OfficeActionReview.candidates.ts";
