import { $SemanticaId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type { TextAnchor, TextAnchorVerificationReceipt } from "@beep/provenance";
import type * as Effect from "effect/Effect";
import type { SourceDocument } from "@/schema/Document";
import type { AnchorRejected } from "@/schema/Errors";
import type { CanonicalText, ParseOutcome } from "@/schema/Text";

const $I = $SemanticaId.create("services/Canonicalizer");

/**
 * Canonical source identity construction and anchor verification.
 *
 * @category services
 * @since 0.0.0
 */
export interface CanonicalizerShape {
  readonly identify: (
    document: SourceDocument,
    parsed: typeof ParseOutcome.cases.Parsed.Type
  ) => Effect.Effect<CanonicalText>;
  readonly verify: (
    canonical: CanonicalText,
    anchor: TextAnchor
  ) => Effect.Effect<TextAnchorVerificationReceipt, AnchorRejected>;
}

/**
 * App-local canonical text boundary.
 *
 * **Example** (Read the canonicalizer service)
 *
 * ```ts
 * import { Canonicalizer } from "@/services/Canonicalizer"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(Canonicalizer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Canonicalizer extends Context.Service<Canonicalizer, CanonicalizerShape>()($I`Canonicalizer`) {}
