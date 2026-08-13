/**
 * Fail-closed adapter from the law-practice candor predicate to the shared
 * candidate-promotion gate.
 *
 * @packageDocumentation
 * @category layers
 * @since 0.0.0
 */

import { CandorGateVerdict, CandorPolicy } from "@beep/law-practice-use-cases/CandorPolicy";
import { PromotionBlockReason, PromotionGate, PromotionGateVerdict } from "@beep/shared-use-cases/PromotionGate";
import { Effect, Layer } from "effect";
import { CandorPromotionSubjectResolver } from "./CandorPromotionGate.ports.ts";
import type { SourceTextResolver } from "@beep/file-processing/SourceText";
import type { CandorRecordReader } from "@beep/law-practice-use-cases/CandorPolicy";
import type * as Crypto from "effect/Crypto";

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
 * @category constructors
 * @since 0.0.0
 */
export const makeCandorPromotionGate = Effect.fn("CandorPromotionGate.make")(function* () {
  const policy = yield* CandorPolicy;
  const resolver = yield* CandorPromotionSubjectResolver;
  const policyContext = yield* Effect.context<CandorRecordReader | Crypto.Crypto | SourceTextResolver>();

  return PromotionGate.of({
    evaluate: Effect.fn("CandorPromotionGate.evaluate")(function* (subject) {
      return yield* resolver.resolve(subject).pipe(
        Effect.flatMap((scope) => policy.evaluate(scope).pipe(Effect.provide(policyContext))),
        Effect.map((verdict) =>
          CandorGateVerdict.isBlocked(verdict)
            ? PromotionGateVerdict.cases.blocked.make({ reason: blockedByCandor })
            : PromotionGateVerdict.cases.clear.make({})
        ),
        Effect.orElseSucceed(() => PromotionGateVerdict.cases.blocked.make({ reason: candorUnavailable }))
      );
    }),
  });
});

/**
 * Layer adapting the derived candor predicate to the shared promotion gate.
 *
 * @category layers
 * @since 0.0.0
 */
export const CandorPromotionGateLive: Layer.Layer<
  PromotionGate,
  never,
  CandorPolicy | CandorPromotionSubjectResolver | CandorRecordReader | Crypto.Crypto | SourceTextResolver
> = Layer.effect(PromotionGate, makeCandorPromotionGate());
