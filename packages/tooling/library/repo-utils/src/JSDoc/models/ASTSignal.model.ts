/**
 * AST signal taxonomy model definitions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("JSDoc/models/ASTSignal.model");

/**
 * **Example** (Build signal with confidence)
 *
 * ```ts
 * import { ASTSignal } from "@beep/repo-utils/JSDoc/models/ASTSignal.model"
 *
 * const signal = ASTSignal.make({
 *   signal: "Function declaration",
 *   confidence: 0.95,
 *   detection: "Node.isFunctionDeclaration(node)"
 * })
 * console.log(signal.confidence)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ASTSignal extends S.Opaque<ASTSignal, { readonly brand: unique symbol }>()(
  S.Struct({
    /** What to look for in the AST (human-readable) */
    signal: S.NonEmptyString.annotateKey({
      description: "What to look for in the AST (human-readable)",
    }),
    /**
     * How confident this signal alone is (0.0 to 1.0).
     * When combined signals exceed 0.85, classification
     * can skip LLM inference entirely.
     */
    confidence: S.Finite.check(S.makeFilterGroup([S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1)])).annotateKey({
      description:
        "How confident this signal alone is (0.0 to 1.0). When combined signals exceed 0.85, classification can skip LLM inference entirely.",
    }),
    /**
     * How to detect this programmatically via ts-morph.
     * Should be specific enough to translate directly to code.
     */
    detection: S.NonEmptyString.annotateKey({
      description:
        "How to detect this programmatically via ts-morph. Should be specific enough to translate directly to code.",
    }),
  }).pipe(
    $I.annoteSchema("ASTSignal", {
      description: "Deterministic heuristic for auto-classifying code elements\nfrom the AST without LLM inference.",
    })
  )
) {}
