/**
 * Fail-closed adapter from the law-practice candor predicate to the shared
 * candidate-promotion gate.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { CandorGateVerdict, CandorPolicy } from "@beep/law-practice-use-cases/CandorPolicy";
import { PromotionBlockReason, PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate";
import { PromotionGate } from "@beep/shared-use-cases/server";
import { Effect, Layer } from "effect";
import { CandorPromotionSubjectResolver } from "./CandorPromotionGate.ports.ts";
import type { SourceTextResolver } from "@beep/file-processing/SourceText";
import type { CandorRecordReadError, CandorRecordReader } from "@beep/law-practice-use-cases/CandorPolicy";
import type * as Crypto from "effect/Crypto";
import type { CandorPromotionSubjectResolutionError } from "./CandorPromotionGate.ports.ts";

const blockedByCandor = PromotionBlockReason.make("law-practice-candor-policy-blocked");
const candorUnavailable = PromotionBlockReason.make("law-practice-candor-policy-unavailable");

/**
 * Build the shared promotion-gate adapter while capturing all law-owned
 * dependencies behind the cross-slice port.
 *
 * **Details**
 *
 * Resolution failures are intentionally indistinguishable from policy read or
 * verification failures outside this slice: each returns an opaque blocked
 * verdict. The adapter never turns missing evidence into a clear result.
 *
 * **Example** (Inspect the adapter constructor)
 *
 * ```ts
 * import { makeCandorPromotionGate } from "@beep/law-practice-server/CandorPromotionGate"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(makeCandorPromotionGate()))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeCandorPromotionGate = Effect.fn("law-practice.candor_promotion_gate.make")(function* () {
  const policy = yield* CandorPolicy;
  const resolver = yield* CandorPromotionSubjectResolver;
  const policyContext = yield* Effect.context<CandorRecordReader | Crypto.Crypto | SourceTextResolver>();

  return PromotionGate.of({
    evaluate: Effect.fn("law-practice.candor_promotion_gate.evaluate")(function* (request) {
      return yield* resolver.resolve(request).pipe(
        Effect.flatMap((scope) => policy.evaluate(scope).pipe(Effect.provide(policyContext))),
        Effect.flatMap((verdict) =>
          Effect.annotateCurrentSpan({
            "law-practice.candor_promotion_gate.outcome": CandorGateVerdict.isBlocked(verdict) ? "blocked" : "clear",
          }).pipe(
            Effect.as(
              CandorGateVerdict.isBlocked(verdict)
                ? PromotionGateVerdict.cases.blocked.make({ reason: blockedByCandor })
                : PromotionGateVerdict.cases.clear.make({})
            )
          )
        ),
        Effect.tapError((error) =>
          Effect.annotateCurrentSpan({ "law-practice.candor_promotion_gate.outcome": "unavailable" }).pipe(
            Effect.andThen(
              Effect.logWarning("Law-practice promotion gate failed closed").pipe(
                Effect.annotateLogs({ errorReason: error.reason, errorTag: error._tag })
              )
            )
          )
        ),
        Effect.catchTags({
          CandorPromotionSubjectResolutionError: (_: CandorPromotionSubjectResolutionError) =>
            Effect.succeed(PromotionGateVerdict.cases.blocked.make({ reason: candorUnavailable })),
          CandorRecordReadError: (_: CandorRecordReadError) =>
            Effect.succeed(PromotionGateVerdict.cases.blocked.make({ reason: candorUnavailable })),
        })
      );
    }),
  });
});

/**
 * Layer adapting the derived candor predicate to the shared promotion gate.
 *
 * **Example** (Inspect the live adapter layer)
 *
 * ```ts
 * import { CandorPromotionGateLive } from "@beep/law-practice-server/CandorPromotionGate"
 *
 * console.log(CandorPromotionGateLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorPromotionGateLive: Layer.Layer<
  PromotionGate,
  never,
  CandorPolicy | CandorPromotionSubjectResolver | CandorRecordReader | Crypto.Crypto | SourceTextResolver
> = Layer.effect(PromotionGate, makeCandorPromotionGate());
