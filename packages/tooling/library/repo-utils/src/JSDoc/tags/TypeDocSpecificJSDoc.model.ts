/**
 * TypeDocSpecificJSDoc tag metadata catalog: TypeDoc-specific tags.
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
 * **Example** (Access category tag metadata)
 *
 * ```ts
 * import { JSDocCategory } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocCategory.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocCategory extends S.Opaque<
  JSDocCategory & JSDocTagMember<"category">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("category", {
    synonyms: [],
    overview: "TypeDoc: assigns an API item to a documentation category.",
    tagKind: "block",
    specifications: ["typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Category organization is documentation information architecture.",
    parameters: {
      syntax: "@category CategoryName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["group", "module"],
    isDeprecated: false,
    example: "/** @category Networking */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access document tag metadata)
 *
 * ```ts
 * import { JSDocDocument } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDocument.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDocument extends S.Opaque<
  JSDocDocument & JSDocTagMember<"document">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("document", {
    synonyms: [],
    overview: "TypeDoc: emits a symbol as a standalone documentation page.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["module", "namespace", "class", "interface", "typeAlias"],
    astDerivable: "none",
    astDerivableNote: "Documentation page emission is a render-time policy choice.",
    parameters: {
      syntax: "@document",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["module", "primaryExport", "group"],
    isDeprecated: false,
    example: "/** @document */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access group tag metadata)
 *
 * ```ts
 * import { JSDocGroup } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocGroup.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocGroup extends S.Opaque<JSDocGroup & JSDocTagMember<"group">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("group", {
    synonyms: [],
    overview: "TypeDoc: groups related items within generated docs.",
    tagKind: "block",
    specifications: ["typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Group labels are documentation organization metadata.",
    parameters: {
      syntax: "@group GroupName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["category"],
    isDeprecated: false,
    example: "/** @group Auth Flows */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access hidden tag metadata)
 *
 * ```ts
 * import { JSDocHidden } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocHidden.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocHidden extends S.Opaque<JSDocHidden & JSDocTagMember<"hidden">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("hidden", {
    synonyms: [],
    overview: "TypeDoc: hides a declaration from generated docs.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Visibility in rendered docs is a documentation configuration choice.",
    parameters: {
      syntax: "@hidden",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["ignore", "internal"],
    isDeprecated: false,
    example: "/** @hidden */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access expand tag metadata)
 *
 * ```ts
 * import { JSDocExpand } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExpand.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExpand extends S.Opaque<JSDocExpand & JSDocTagMember<"expand">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("expand", {
    synonyms: [],
    overview: "TypeDoc: expands referenced type information in rendered output.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Render-time expansion behavior is a documentation presentation option.",
    parameters: {
      syntax: "@expand",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["inline", "useDeclaredType"],
    isDeprecated: false,
    example: "/** @expand */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access inline TypeDoc metadata)
 *
 * ```ts
 * import { JSDocInline } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInline.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInline extends S.Opaque<JSDocInline & JSDocTagMember<"inline">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("inline", {
    synonyms: [],
    overview: "TypeDoc: inlines target type information in rendered docs.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Inline render behavior is documentation presentation metadata.",
    parameters: {
      syntax: "@inline",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["expand", "useDeclaredType"],
    isDeprecated: false,
    example: "/** @inline */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access mergemodulewith tag metadata)
 *
 * ```ts
 * import { JSDocMergeModuleWith } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocMergeModuleWith.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMergeModuleWith extends S.Opaque<
  JSDocMergeModuleWith & JSDocTagMember<"mergeModuleWith">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("mergeModuleWith", {
    synonyms: [],
    overview: "TypeDoc: merge declarations into a named module reflection in generated docs.",
    tagKind: "block",
    specifications: ["typedoc"],
    applicableTo: ["module", "namespace", "file"],
    astDerivable: "none",
    astDerivableNote: "Module merge behavior is a documentation organization policy.",
    parameters: {
      syntax: "@mergeModuleWith ModuleName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["module", "group", "document"],
    isDeprecated: false,
    example: "/** @mergeModuleWith my-package */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access primaryexport tag metadata)
 *
 * ```ts
 * import { JSDocPrimaryExport } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPrimaryExport.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPrimaryExport extends S.Opaque<
  JSDocPrimaryExport & JSDocTagMember<"primaryExport">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("primaryExport", {
    synonyms: [],
    overview: "TypeDoc: mark a declaration as the primary export in module documentation.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["class", "function", "interface", "typeAlias", "variable"],
    astDerivable: "none",
    astDerivableNote: "Primary export status is a documentation presentation decision.",
    parameters: {
      syntax: "@primaryExport",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["export", "module", "document"],
    isDeprecated: false,
    example: "/** @primaryExport */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access sortstrategy tag metadata)
 *
 * ```ts
 * import { JSDocSortStrategy } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSortStrategy.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSortStrategy extends S.Opaque<
  JSDocSortStrategy & JSDocTagMember<"sortStrategy">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("sortStrategy", {
    synonyms: [],
    overview: "TypeDoc: override reflection sort strategy for a declaration subtree.",
    tagKind: "block",
    specifications: ["typedoc"],
    applicableTo: ["module", "namespace", "class", "interface", "any"],
    astDerivable: "none",
    astDerivableNote: "Sort order is documentation presentation metadata.",
    parameters: {
      syntax: "@sortStrategy strategyName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["group", "category"],
    isDeprecated: false,
    example: "/** @sortStrategy alphabetical */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access usedeclaredtype tag metadata)
 *
 * ```ts
 * import { JSDocUseDeclaredType } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocUseDeclaredType.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocUseDeclaredType extends S.Opaque<
  JSDocUseDeclaredType & JSDocTagMember<"useDeclaredType">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("useDeclaredType", {
    synonyms: [],
    overview: "TypeDoc: prefers declared type for rendering over inferred expansion.",
    tagKind: "modifier",
    specifications: ["typedoc"],
    applicableTo: ["property", "variable", "parameter", "typeAlias", "any"],
    astDerivable: "none",
    astDerivableNote: "Declared-type rendering preference is documentation presentation metadata.",
    parameters: {
      syntax: "@useDeclaredType",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["inline", "expand", "type"],
    isDeprecated: false,
    example: "/** @useDeclaredType */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access TypeDoc-specific tag metadata)
 *
 * ```ts
 * import { TypeDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TypeDocSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TypeDocSpecificJSDoc = S.Union([
  JSDocCategory,
  JSDocDocument,
  JSDocGroup,
  JSDocHidden,
  JSDocExpand,
  JSDocInline,
  JSDocMergeModuleWith,
  JSDocPrimaryExport,
  JSDocSortStrategy,
  JSDocUseDeclaredType,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("TypeDocSpecificJSDoc"));

/**
 * Runtime type for {@link TypeDocSpecificJSDoc}.
 *
 * **Example** (Extract TypeDoc-specific tag name)
 *
 * ```ts
 * import type { TypeDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: TypeDocSpecificJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TypeDocSpecificJSDoc = typeof TypeDocSpecificJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read TypeDoc-specific tag metadata)
 *
 * ```ts
 * import { TypeDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TypeDocSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TypeDocSpecificJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = TypeDocSpecificJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TypeDocSpecificJSDoc.Encoded;
}
