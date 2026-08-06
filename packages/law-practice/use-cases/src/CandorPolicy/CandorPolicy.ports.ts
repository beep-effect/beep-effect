/**
 * Candor gate ports: the read contract over recorded candor material, and the
 * derived predicate that decides whether filing promotion is blocked.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { CitingApplicationIdentity } from "@beep/law-practice-domain";
import { EffectSchema, Fn } from "@beep/schema";
import { Context } from "effect";
import * as S from "effect/Schema";
import type { SourceTextResolver } from "@beep/file-processing/SourceText";
import type { CandorDisposition, PatentCitationEvent } from "@beep/law-practice-domain";
import type * as Crypto from "effect/Crypto";
import type { CandorRecordReadError } from "./CandorPolicy.errors.ts";
import type { CandorGateVerdict } from "./CandorPolicy.values.ts";

const $I = $LawPracticeUseCasesId.create("CandorPolicy/CandorPolicy.ports");

/**
 * Service shape for reading the recorded candor material of one filing.
 *
 * **When to use**
 *
 * Use as the seam between the derived predicate and wherever citation events
 * and attorney dispositions actually live. The in-memory rung-1 implementation
 * and the durable rung-2 repository satisfy the same shape.
 *
 * **Details**
 *
 * The shape is read-only by construction: there is no update and no delete, so
 * a recorded disposition can only ever be revised by appending a superseding
 * record. Both methods are keyed by one exact citing-application
 * representation; matching across representations is not inferred here, and
 * reconciling them is a named follow-on.
 *
 * **Gotchas**
 *
 * Returning an empty array means "the store answered and there is nothing".
 * A store that cannot answer must fail with `CandorRecordReadError`, because a
 * gate that treats an unreadable store as empty would report "not blocked" for
 * a filing it never actually checked.
 *
 * **Example** (Build a read-only fixture reader)
 *
 * ```ts
 * import { CandorRecordReaderShape } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { Effect } from "effect"
 *
 * const reader = CandorRecordReaderShape.make({
 *   dispositionsForFiling: () => Effect.succeed([]),
 *   eventsForFiling: () => Effect.succeed([]),
 * })
 *
 * console.log(typeof reader.eventsForFiling) // "function"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CandorRecordReaderShape extends S.Class<CandorRecordReaderShape>($I`CandorRecordReaderShape`)(
  {
    dispositionsForFiling: Fn({
      input: CitingApplicationIdentity,
      output: EffectSchema<ReadonlyArray<CandorDisposition>, CandorRecordReadError, never>(),
    }).annotateKey({
      description: "Read every recorded attorney disposition for one exact citing-application representation.",
    }),
    eventsForFiling: Fn({
      input: CitingApplicationIdentity,
      output: EffectSchema<ReadonlyArray<PatentCitationEvent>, CandorRecordReadError, never>(),
    }).annotateKey({
      description: "Read every recorded patent citation event for one exact citing-application representation.",
    }),
  },
  $I.annote("CandorRecordReaderShape", {
    description: "Append-and-read-only service shape over the recorded candor material of one filing.",
  })
) {}

/**
 * Port for reading recorded candor material.
 *
 * **Details**
 *
 * Rung 1 satisfies this with an in-memory fixture layer so the predicate can be
 * proven slice-isolated. Rung 2 satisfies it with a durable repository layer on
 * the execution-ledger precedent without changing this contract.
 *
 * **Example** (Read a filing's events through the port)
 *
 * ```ts
 * import { CandorRecordReader, CandorRecordReaderShape } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const reader = yield* CandorRecordReader
 *   return yield* reader.eventsForFiling(
 *     CitingApplicationIdentity.make({
 *       applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *       kind: "UsptoNormalized",
 *     })
 *   )
 * }).pipe(
 *   Effect.provideService(
 *     CandorRecordReader,
 *     CandorRecordReaderShape.make({
 *       dispositionsForFiling: () => Effect.succeed([]),
 *       eventsForFiling: () => Effect.succeed([]),
 *     })
 *   )
 * )
 *
 * Effect.runPromise(program).then((events) => console.log(events))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CandorRecordReader extends Context.Service<CandorRecordReader, CandorRecordReaderShape>()(
  $I`CandorRecordReader`
) {}

/**
 * Service shape for the derived, fail-closed candor gate.
 *
 * **Details**
 *
 * The requirement channel is deliberately explicit. `CandorRecordReader` is the
 * record seam. `SourceTextResolver` and `Crypto.Crypto` are what re-verifying a
 * persisted anchor costs, and both are satisfied by the caller — the
 * law-practice slice never owns a live layer for either, which is what keeps
 * source custody outside this slice.
 *
 * **Gotchas**
 *
 * `evaluate` recomputes from scratch on every call. There is no cache and no
 * stored closure, because a verdict that outlived the material it was derived
 * from would be exactly the ambient risk this gate replaces.
 *
 * **Example** (Evaluate against a fixture gate)
 *
 * ```ts
 * import { CandorGateVerdict, CandorPolicyShape } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import { Effect } from "effect"
 *
 * const citingApplication = CitingApplicationIdentity.make({
 *   applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *   kind: "UsptoNormalized",
 * })
 * const shape = CandorPolicyShape.make({
 *   evaluate: () => Effect.succeed(CandorGateVerdict.make({ citingApplication, uncovered: [] })),
 * })
 *
 * // Evaluating needs the record seam, the source-text resolver, and Crypto,
 * // so the shape is composed here rather than run.
 * console.log(Effect.isEffect(shape.evaluate(citingApplication))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CandorPolicyShape extends S.Class<CandorPolicyShape>($I`CandorPolicyShape`)(
  {
    evaluate: Fn({
      input: CitingApplicationIdentity,
      output: EffectSchema<
        CandorGateVerdict,
        CandorRecordReadError,
        CandorRecordReader | SourceTextResolver | Crypto.Crypto
      >(),
    }).annotateKey({
      description: "Recompute the candor verdict for one filing from its recorded events and dispositions.",
    }),
  },
  $I.annote("CandorPolicyShape", {
    description: "Service shape for the derived, fail-closed candor gate over one filing.",
  })
) {}

/**
 * Candor gate service tag.
 *
 * **When to use**
 *
 * Use when a filing-promotion decision must not proceed until every current
 * AI-discovered citation event carries an attorney judgment bound to its exact
 * observation version.
 *
 * **Example** (Consume the gate through its tag)
 *
 * ```ts
 * import { CandorGateVerdict, CandorPolicy, CandorPolicyShape } from "@beep/law-practice-use-cases/CandorPolicy"
 * import { CitingApplicationIdentity, UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain"
 * import { Effect } from "effect"
 *
 * const citingApplication = CitingApplicationIdentity.make({
 *   applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
 *   kind: "UsptoNormalized",
 * })
 *
 * const program = Effect.gen(function* () {
 *   const policy = yield* CandorPolicy
 *   const verdict = yield* policy.evaluate(citingApplication)
 *   return CandorGateVerdict.isBlocked(verdict)
 * }).pipe(
 *   Effect.provideService(
 *     CandorPolicy,
 *     CandorPolicyShape.make({
 *       evaluate: () => Effect.succeed(CandorGateVerdict.make({ citingApplication, uncovered: [] })),
 *     })
 *   )
 * )
 *
 * // The gate's own requirements stay in the channel: providing the tag does not
 * // satisfy the record seam, the resolver, or Crypto — the caller does.
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class CandorPolicy extends Context.Service<CandorPolicy, CandorPolicyShape>()($I`CandorPolicy`) {}
