/**
 * InlineJSDoc tag metadata catalog: Inline tags — embedded cross references.
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
 * **Example** (Access link tag metadata)
 *
 * ```ts
 * import { JSDocLink } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocLink.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocLink extends S.Opaque<JSDocLink & JSDocTagMember<"link">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("link", {
    synonyms: ["linkcode", "linkplain"],
    overview:
      "Link to another item in the documentation or an external URL. {@linkcode} renders as code, {@linkplain} as plain text.",
    tagKind: "inline",
    specifications: ["jsdoc3", "tsdocCore", "typescript"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Link placement and target choice are documentation-structure decisions.",
    parameters: {
      syntax: "{@link NameOrURL | display text}",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["see", "tutorial"],
    isDeprecated: false,
    example: "/** See {@link MyClass.myMethod | the method docs} for details */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access inheritDoc tag metadata)
 *
 * ```ts
 * import { JSDocInheritDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInheritDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInheritDoc extends S.Opaque<
  JSDocInheritDoc & JSDocTagMember<"inheritDoc">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("inheritDoc", {
    synonyms: ["inheritdoc"],
    overview: "Indicate that a symbol should inherit its parent's documentation. TSDoc uses inline form {@inheritDoc}.",
    tagKind: "inline",
    specifications: ["jsdoc3", "tsdocCore", "closure"],
    applicableTo: ["method", "property", "accessor"],
    astDerivable: "partial",
    astDerivableNote:
      "Can detect when a method overrides a parent method (heritage clause analysis). Could auto-suggest {@inheritDoc} for overrides with no custom docs.",
    parameters: {
      syntax: "{@inheritDoc [reference]}",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["override", "augments"],
    isDeprecated: false,
    example: "/** {@inheritDoc BaseClass.method} */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access inline tag metadata)
 *
 * ```ts
 * import { InlineJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = InlineJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const InlineJSDoc = S.Union([JSDocLink, JSDocInheritDoc]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("InlineJSDoc")
);

/**
 * Runtime type for {@link InlineJSDoc}.
 *
 * **Example** (Extract inline tag name)
 *
 * ```ts
 * import type { InlineJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: InlineJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type InlineJSDoc = typeof InlineJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read inline tag metadata)
 *
 * ```ts
 * import { InlineJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = InlineJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace InlineJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = InlineJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof InlineJSDoc.Encoded;
}
