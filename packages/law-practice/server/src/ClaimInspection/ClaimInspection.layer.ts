/**
 * Pinned local lexical inspection composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { ClaimLexicalProviderIdentity } from "@beep/law-practice-domain/values/ClaimElement";
import {
  claimInspectionWithLexicalEvidence,
  unavailableClaimInspectionWithLexicalEvidence,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { WinkEngineLive, WinkIntrinsicNounActivationError, WinkTokenization } from "@beep/wink";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { claimLexicalMembershipWinkLayer } from "./ClaimInspection.intrinsic.ts";
import type { WinkEngineError, WinkTokenizationLive } from "@beep/wink";

/**
 * Inspection over the installed fixed Wink POS/lemma assets; acquisition remains separately supplied.
 * **Example** (Inspect with the complete fixed provider)
 * ```ts
 * import { ClaimInspectionWithLexicalEvidenceLive } from "@beep/law-practice-server"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ClaimInspectionWithLexicalEvidenceLive)) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
const identity = ClaimLexicalProviderIdentity.make({
  provider: "wink-nlp@2.4.0/wink-eng-lite-web-model@1.8.1",
  assetDigest: "6aef503a580a23a6d12d0f781125c4ffd2a0b475faad91e8c420e858cbd42fd0",
});
const initializationFallback = (error: WinkEngineError) =>
  S.is(WinkIntrinsicNounActivationError)(error.cause)
    ? error.cause.pipe(Layer.effectContext)
    : unavailableClaimInspectionWithLexicalEvidence(identity);

/**
 * Compose the fixed identity with a tokenizer layer and preserve typed initialization unavailability as partial coverage.
 *
 * **Example** (Compose the tokenization-only compatibility path)
 * ```ts
 * import { claimInspectionWithTokenizationLayer } from "@beep/law-practice-server/ClaimInspection"
 * import { WinkTokenizationLive } from "@beep/wink"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(claimInspectionWithTokenizationLayer(WinkTokenizationLive))) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const claimInspectionWithTokenizationLayer = (tokenization: typeof WinkTokenizationLive) =>
  claimInspectionWithLexicalEvidence(identity).pipe(
    Layer.provide(tokenization),
    Layer.catchTag("WinkEngineError", initializationFallback)
  );

/**
 * One fixed engine supplying both tokenization and intrinsic membership.
 *
 * **Example** (Select the complete fixed lexical runtime)
 * ```ts
 * import { ClaimInspectionLexicalRuntimeLive } from "@beep/law-practice-server/ClaimInspection"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ClaimInspectionLexicalRuntimeLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimInspectionLexicalRuntimeLive = Layer.merge(
  WinkTokenization,
  claimLexicalMembershipWinkLayer(identity)
).pipe(Layer.provide(WinkEngineLive));
/**
 * Compose the complete lexical context while preserving typed initialization failures.
 *
 * **Example** (Compose both lexical services)
 * ```ts
 * import { ClaimInspectionLexicalRuntimeLive, claimInspectionWithLexicalRuntimeLayer } from "@beep/law-practice-server/ClaimInspection"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(claimInspectionWithLexicalRuntimeLayer(ClaimInspectionLexicalRuntimeLive))) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const claimInspectionWithLexicalRuntimeLayer = (runtime: typeof ClaimInspectionLexicalRuntimeLive) =>
  claimInspectionWithLexicalEvidence(identity).pipe(
    Layer.provide(runtime),
    Layer.catchTag("WinkEngineError", initializationFallback)
  );
/**
 * Production inspection over the same complete fixed lexical runtime used by replay.
 *
 * **Example** (Select the production inspection provider)
 * ```ts
 * import { ClaimInspectionWithLexicalEvidenceLive } from "@beep/law-practice-server/ClaimInspection"
 * import * as Layer from "effect/Layer"
 * console.log(Layer.isLayer(ClaimInspectionWithLexicalEvidenceLive)) // true
 * ```
 * @category layers
 * @since 0.0.0
 */
export const ClaimInspectionWithLexicalEvidenceLive = claimInspectionWithLexicalRuntimeLayer(
  ClaimInspectionLexicalRuntimeLive
);
