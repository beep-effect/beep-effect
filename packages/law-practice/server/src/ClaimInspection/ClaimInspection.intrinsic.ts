/**
 * Local application-port bridge; only this server module imports both slice and vendor driver.
 * @packageDocumentation
 * @since 0.0.0
 */
import {
  ClaimLexicalMembershipResult,
  ClaimLexicalProviderIdentity,
} from "@beep/law-practice-domain/values/ClaimElement";
import { ClaimLexicalMembership, ClaimLexicalMembershipQueryError } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import {
  WinkEngine,
  WinkIntrinsicNounActivationError,
  WinkIntrinsicNounRequest,
  winkIntrinsicNounQueryCost,
} from "@beep/wink";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import type { ClaimLexicalMembershipRequest } from "@beep/law-practice-domain/values/ClaimElement";
import type { WinkIntrinsicNounError, WinkIntrinsicNounResult, WinkIntrinsicNounShape } from "@beep/wink";

const sameProvider = S.toEquivalence(ClaimLexicalProviderIdentity);
const paidProtocolFailure = (request: ClaimLexicalMembershipRequest, cause: unknown) => {
  const workDebit = Num.min(request.remainingWork, winkIntrinsicNounQueryCost(request.rawForm));
  return ClaimLexicalMembershipQueryError.make({
    reason: "invalid-response",
    cause,
    workDebit,
    remainingWork: request.remainingWork - workDebit,
  });
};
const translateError = (request: ClaimLexicalMembershipRequest, error: WinkIntrinsicNounError) => {
  const debit =
    error.reason === "query-failed" || error.reason === "engine-replaced"
      ? winkIntrinsicNounQueryCost(request.rawForm)
      : 0;
  return error.workDebit === debit && error.remainingWork === request.remainingWork - debit
    ? ClaimLexicalMembershipQueryError.make({
        reason: "query-failed",
        cause: error,
        workDebit: error.workDebit,
        remainingWork: error.remainingWork,
      })
    : paidProtocolFailure(request, error);
};
const validWorkRefusal = (
  request: ClaimLexicalMembershipRequest,
  result: Extract<WinkIntrinsicNounResult, { readonly status: "work-limit" }>
): boolean =>
  request.remainingWork < winkIntrinsicNounQueryCost(request.rawForm) &&
  result.workDebit === 0 &&
  result.remainingWork === request.remainingWork;
const validKnownResponse = (
  identity: ClaimLexicalProviderIdentity,
  request: ClaimLexicalMembershipRequest,
  result: Extract<WinkIntrinsicNounResult, { readonly status: "known" }>
): boolean =>
  sameProvider(request.provider, identity) &&
  request.rawForm === request.token.quote &&
  result.rawForm === request.rawForm &&
  result.workDebit === winkIntrinsicNounQueryCost(request.rawForm) &&
  result.remainingWork === request.remainingWork - result.workDebit;
const translateResult = Effect.fn("ClaimInspection.translateIntrinsicResult")(function* (
  identity: ClaimLexicalProviderIdentity,
  request: ClaimLexicalMembershipRequest,
  result: WinkIntrinsicNounResult
) {
  if (result.status === "work-limit") {
    if (!validWorkRefusal(request, result))
      return yield* paidProtocolFailure(request, "inconsistent source-work refusal");
    return ClaimLexicalMembershipResult.cases["work-limit"].make({
      rawForm: request.rawForm,
      provider: identity,
      remainingWork: result.remainingWork,
    });
  }
  // The producer's reservation is paid before these exact-form/identity joins.
  if (!validKnownResponse(identity, request, result))
    return yield* paidProtocolFailure(request, "membership identity/form/debit mismatch");
  return ClaimLexicalMembershipResult.cases.known.make({
    rawForm: result.rawForm,
    baseNoun: result.baseNoun,
    oov: result.oov,
    workDebit: result.workDebit,
    remainingWork: result.remainingWork,
    provider: identity,
  });
});
const bridgedQuery = (identity: ClaimLexicalProviderIdentity, capability: WinkIntrinsicNounShape) =>
  Effect.fn("ClaimInspection.intrinsicQuery")(function* (request: ClaimLexicalMembershipRequest) {
    const result = yield* capability
      .query(WinkIntrinsicNounRequest.make({ rawForm: request.rawForm, remainingWork: request.remainingWork }))
      .pipe(Effect.mapError((error) => translateError(request, error)));
    return yield* translateResult(identity, request, result);
  });
/**
 * Bridge one already-owned fixed engine; no second engine or model layer is provided here.
 *
 * **Example** (Build the bridge for the fixed provider identity)
 *
 * ```ts
 * import { ClaimLexicalProviderIdentity } from "@beep/law-practice-domain/values/ClaimElement"
 * import { claimLexicalMembershipWinkLayer } from "../../src/ClaimInspection/ClaimInspection.intrinsic.ts"
 * import * as Layer from "effect/Layer"
 *
 * const identity = ClaimLexicalProviderIdentity.make({
 *   provider: "wink-nlp@2.4.0/wink-eng-lite-web-model@1.8.1",
 *   assetDigest: "6aef503a580a23a6d12d0f781125c4ffd2a0b475faad91e8c420e858cbd42fd0"
 * })
 * console.log(Layer.isLayer(claimLexicalMembershipWinkLayer(identity))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const claimLexicalMembershipWinkLayer = (identity: ClaimLexicalProviderIdentity) =>
  Layer.effect(
    ClaimLexicalMembership,
    Effect.gen(function* () {
      const engine = yield* WinkEngine;
      const capability = yield* engine.intrinsicNoun;
      if (capability.provider !== identity.provider)
        return yield* WinkIntrinsicNounActivationError.make({
          reason: "version",
          cause: "fixed lexical provider identity mismatch",
        });
      return ClaimLexicalMembership.of({ query: bridgedQuery(identity, capability) });
    })
  );
