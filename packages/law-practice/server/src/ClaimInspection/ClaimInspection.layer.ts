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
import { WinkTokenizationLive } from "@beep/wink";
import * as Layer from "effect/Layer";

/**
 * Inspection over the installed fixed Wink POS/lemma assets; acquisition remains separately supplied.
 * @example
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
/**
 * Compose the fixed identity with a tokenizer layer and preserve typed initialization unavailability as partial coverage.
 *
 * @category layers
 * @since 0.0.0
 */
export const claimInspectionWithTokenizationLayer = (tokenization: typeof WinkTokenizationLive) =>
  claimInspectionWithLexicalEvidence(identity).pipe(
    Layer.provide(tokenization),
    Layer.catchTag("WinkEngineError", () => unavailableClaimInspectionWithLexicalEvidence(identity))
  );

/**
 * Runtime inspection provider using the installed pinned Wink POS/lemma model.
 *
 * @category layers
 * @since 0.0.0
 */
export const ClaimInspectionWithLexicalEvidenceLive = claimInspectionWithTokenizationLayer(WinkTokenizationLive);
