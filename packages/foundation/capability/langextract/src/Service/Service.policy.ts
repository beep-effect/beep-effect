/**
 * Remote-extraction policy instances, layers, and the policy guard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { LangExtractError } from "@beep/langextract/Extraction";
import { thunkEffectSucceed } from "@beep/utils";
import * as O from "@beep/utils/Option";
import { Config, Effect, Layer } from "effect";
import { dual } from "effect/Function";
import { LangExtractRemotePolicy } from "./Service.service.ts";
import type { LangExtractRequest } from "@beep/langextract/Extraction";
import type { LangExtractRemotePolicyShape } from "./Service.service.ts";

/**
 * Policy instance that permits remote LangExtract generation.
 *
 * **Example** (Permit remote extraction request)
 *
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { allowRemoteExtractionPolicy } from "@beep/langextract/Service"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { Effect } from "effect"
 *
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 *
 * Effect.runPromise(allowRemoteExtractionPolicy.allowRemoteExtraction(request)).then(console.log)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowRemoteExtractionPolicy = LangExtractRemotePolicy.of({
  allowRemoteExtraction: Effect.fn("LangExtractRemotePolicy.allowRemoteExtraction.allow")(thunkEffectSucceed(true)),
});

/**
 * Layer that permits remote LangExtract generation.
 *
 * **Example** (Log allow remote layer)
 *
 * ```ts
 * import { allowRemoteExtractionPolicyLayer } from "@beep/langextract/Service"
 *
 * console.log(allowRemoteExtractionPolicyLayer)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const allowRemoteExtractionPolicyLayer = Layer.succeed(LangExtractRemotePolicy, allowRemoteExtractionPolicy);

/**
 * Config-driven policy layer. `BEEP_LANGEXTRACT_ALLOW_REMOTE=true` is required
 * before request text may be sent to the injected language model.
 *
 * **Example** (Log config policy layer)
 *
 * ```ts
 * import { remoteExtractionPolicyFromConfig } from "@beep/langextract/Service"
 *
 * console.log(remoteExtractionPolicyFromConfig)
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const remoteExtractionPolicyFromConfig = Layer.effect(
  LangExtractRemotePolicy,
  Effect.map(Config.boolean("BEEP_LANGEXTRACT_ALLOW_REMOTE").pipe(Config.withDefault(false)), (allowRemote) =>
    LangExtractRemotePolicy.of({
      allowRemoteExtraction: Effect.fn("LangExtractRemotePolicy.allowRemoteExtraction.config")(
        thunkEffectSucceed(allowRemote)
      ),
    })
  )
);

/**
 * Fail closed unless the optional remote policy explicitly allows a request.
 *
 * **Details**
 *
 * Absence of a policy denies extraction: the guard resolves to `false` when
 * the `Option` is `none`, and fails with a sanitized `remote-policy-denied`
 * error rather than letting request text reach a remote provider.
 *
 * **Example** (Deny when no policy is present)
 *
 * ```ts
 * import { LangExtractRequest } from "@beep/langextract/Extraction"
 * import { ensureRemoteExtractionAllowed } from "@beep/langextract/Service"
 * import { ExtractionTarget } from "@beep/langextract/Target"
 * import { DocumentId } from "@beep/nlp/Core"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 *
 * const request = LangExtractRequest.make({
 *   documentId: DocumentId.make("doc-1"),
 *   targets: [ExtractionTarget.make({ kind: "entity", name: "person" })],
 *   text: "Ada Lovelace wrote notes."
 * })
 *
 * Effect.runPromise(Effect.flip(ensureRemoteExtractionAllowed(O.none(), request))).then(
 *   (error) => console.log(error.reason) // "remote-policy-denied"
 * )
 * ```
 *
 * @category policies
 * @since 0.0.0
 */
export const ensureRemoteExtractionAllowed: {
  (policy: O.Option<LangExtractRemotePolicyShape>, request: LangExtractRequest): Effect.Effect<void, LangExtractError>;
  (
    request: LangExtractRequest
  ): (policy: O.Option<LangExtractRemotePolicyShape>) => Effect.Effect<void, LangExtractError>;
} = dual(
  2,
  Effect.fn("LangExtractService.ensureRemoteExtractionAllowed")(function* (
    policy: O.Option<LangExtractRemotePolicyShape>,
    request: LangExtractRequest
  ): Effect.fn.Return<void, LangExtractError> {
    const allowed = yield* policy.pipe(
      O.map((remotePolicy) => remotePolicy.allowRemoteExtraction(request)),
      O.getOrElse(thunkEffectSucceed(false))
    );

    if (!allowed) {
      return yield* LangExtractError.fromReason("remote-policy-denied", {
        details: { documentId: request.documentId },
        message: "Remote LangExtract generation denied by policy.",
      });
    }
  })
);
