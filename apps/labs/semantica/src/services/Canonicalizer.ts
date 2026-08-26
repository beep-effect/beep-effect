import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { TextAnchor, TextAnchorVerificationReceipt } from "@beep/provenance";
import type { Effect } from "effect";
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
interface CanonicalizerShape {
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
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(Canonicalizer)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Canonicalizer extends Context.Service<Canonicalizer, CanonicalizerShape>()($I`Canonicalizer`) {}
