/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

/* cspell:ignore Derivability */

const $I = $RepoUtilsId.create("JSDoc/models/ASTDerivability.model");
/**
 * Whether this tag's content can be deterministically derived from the TypeScript AST.
 *
 * **Details**
 *
 * This is the KEY field for the knowledge graph pipeline:
 *   - "full"    → Layer 1 (certainty=1.0): 100% derivable from AST, no human input needed
 *   - "partial" → Layer 2 (certainty=0.85-0.95): Structurally derivable but may need human context
 *   - "none"    → Layer 3 (certainty=0.6-0.85): Requires human authoring or LLM inference
 *
 * **Example** (Assert full derivability)
 *
 * ```ts
 * import { ASTDerivability } from "@beep/repo-utils/JSDoc/models/ASTDerivability.model"
 *
 * const derivability = ASTDerivability.Enum.full
 * console.log(ASTDerivability.is.full(derivability))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ASTDerivability = LiteralKit(["full", "partial", "none"]).pipe(
  $I.annoteSchema("ASTDerivability", {
    description: "Whether this tag's content can be deterministically derived from the TypeScript AST.",
    documentation:
      'Whether this tag\'s content can be deterministically derived from the TypeScript AST.\nThis is the KEY field for the knowledge graph pipeline:\n  - "full"    → Layer 1 (certainty=1.0): 100% derivable from AST, no human input needed\n  - "partial" → Layer 2 (certainty=0.85-0.95): Structurally derivable but may need human context\n  - "none"    → Layer 3 (certainty=0.6-0.85): Requires human authoring or LLM inference',
  })
);

/**
 * JSDoc model export.
 *
 * **Example** (Constrain generic parameter)
 *
 * ```ts
 * import type { ASTDerivability } from "@beep/repo-utils/JSDoc/models/ASTDerivability.model"
 *
 * type Example = ASTDerivability
 * const accept = <A extends Example>(value: A): A => value
 * console.log(accept)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ASTDerivability = typeof ASTDerivability.Type;
