/**
 * TypeScriptSpecificJSDoc tag metadata catalog: TypeScript-specific tags.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { JSDocTagDefinition } from "../models/index.ts";
import type { JSDocTagMember } from "../JSDoc.shared.ts";

const $I = $RepoUtilsId.create("JSDoc/JSDocTagDb");

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access overload tag metadata)
 *
 * ```ts
 * import { JSDocOverload } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocOverload.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocOverload extends S.Opaque<
  JSDocOverload & JSDocTagMember<"overload">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("overload", {
    synonyms: [],
    overview: "TypeScript 5.0+: allows documenting individual overload signatures in JSDoc.",
    tagKind: "block",
    specifications: ["typescript", "typedoc"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "Overload signature structure is derivable, but documentation-level overload text/organization is partly semantic.",
    parameters: {
      syntax: "@overload",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["param", "returns", "variation"],
    isDeprecated: false,
    example: "/** @overload\n * @param {string} x\n * @returns {string}\n */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access TypeScript-specific tag metadata)
 *
 * ```ts
 * import { TypeScriptSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TypeScriptSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypeScriptSpecificJSDoc = S.Union([JSDocOverload]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("TypeScriptSpecificJSDoc")
);

/**
 * Runtime type for {@link TypeScriptSpecificJSDoc}.
 *
 * **Example** (Extract TypeScript-specific tag name)
 *
 * ```ts
 * import type { TypeScriptSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: TypeScriptSpecificJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypeScriptSpecificJSDoc = typeof TypeScriptSpecificJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read TypeScript-specific tag metadata)
 *
 * ```ts
 * import { TypeScriptSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TypeScriptSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TypeScriptSpecificJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = TypeScriptSpecificJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TypeScriptSpecificJSDoc.Encoded;
}
