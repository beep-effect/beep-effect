/**
 * OrganizationalJSDoc tag metadata catalog: Organizational tags — module/namespace/membership structure.
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
 * **Example** (Access module tag metadata)
 *
 * ```ts
 * import { JSDocModule } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocModule.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocModule extends S.Opaque<JSDocModule & JSDocTagMember<"module">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("module", {
    synonyms: [],
    overview: "Document a JavaScript module.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["module", "file"],
    astDerivable: "partial",
    astDerivableNote:
      "Module structure is derivable, but documentation-level naming/grouping conventions are partly semantic.",
    parameters: {
      syntax: "@module [moduleName]",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["exports", "requires", "namespace", "packageDocumentation"],
    isDeprecated: false,
    example: "/** @module utils/string */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access namespace tag metadata)
 *
 * ```ts
 * import { JSDocNamespace } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNamespace.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNamespace extends S.Opaque<
  JSDocNamespace & JSDocTagMember<"namespace">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("namespace", {
    synonyms: [],
    overview: "Document a namespace object.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["namespace", "variable"],
    astDerivable: "partial",
    astDerivableNote:
      "Namespace declarations are structural, but namespace documentation intent/grouping is partly semantic.",
    parameters: {
      syntax: "@namespace [name]",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["module", "memberof"],
    isDeprecated: false,
    example: "/** @namespace MyApp.Utils */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access memberof tag metadata)
 *
 * ```ts
 * import { JSDocMemberOf } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocMemberOf.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMemberOf extends S.Opaque<
  JSDocMemberOf & JSDocTagMember<"memberof">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("memberof", {
    synonyms: [],
    overview: "This symbol belongs to a parent symbol. Establishes containment hierarchy.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "partial",
    astDerivableNote:
      "Parent-child relationships are mostly structural, but chosen membership projection in documentation can be semantic.",
    parameters: {
      syntax: "@memberof ParentName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["member", "inner", "instance", "static"],
    isDeprecated: false,
    example: "/** @memberof MyClass */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access member tag metadata)
 *
 * ```ts
 * import { JSDocMember } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocMember.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMember extends S.Opaque<JSDocMember & JSDocTagMember<"member">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("member", {
    synonyms: ["var"],
    overview: "Document a member (property or variable).",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["property", "variable"],
    astDerivable: "partial",
    astDerivableNote: "Member structure is derivable, but documentation-level member framing is partially semantic.",
    parameters: {
      syntax: "@member {Type} [name]",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["memberof", "property", "type"],
    isDeprecated: false,
    example: "/** @member {string} */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access property tag metadata)
 *
 * ```ts
 * import { JSDocProperty } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocProperty.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocProperty extends S.Opaque<
  JSDocProperty & JSDocTagMember<"property">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("property", {
    synonyms: ["prop"],
    overview: "Document a property of an object (commonly used with @typedef).",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["property"],
    astDerivable: "partial",
    astDerivableNote:
      "Property shape is derivable, but property-documentation semantics remain partially human-authored.",
    parameters: {
      syntax: "@property {Type} name - description",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["member", "typedef", "type"],
    isDeprecated: false,
    example: "/** @property {string} name - The user's name */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access interface tag metadata)
 *
 * ```ts
 * import { JSDocInterface } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInterface.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInterface extends S.Opaque<
  JSDocInterface & JSDocTagMember<"interface">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("interface", {
    synonyms: [],
    overview: "This symbol is an interface that others can implement.",
    tagKind: "block",
    specifications: ["jsdoc3", "closure", "typedoc"],
    applicableTo: ["interface"],
    astDerivable: "full",
    astDerivableNote: "InterfaceDeclaration is an explicit AST node kind.",
    parameters: {
      syntax: "@interface [name]",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["implements", "class"],
    isDeprecated: false,
    example: "/** @interface */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access function tag metadata)
 *
 * ```ts
 * import { JSDocFunction } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocFunction.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocFunction extends S.Opaque<
  JSDocFunction & JSDocTagMember<"function">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("function", {
    synonyms: ["func", "method"],
    overview: "Describe a function or method.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "Function signatures are structural, but documentation-level function semantics are partially human-authored.",
    parameters: {
      syntax: "@function [name]",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["param", "returns", "async"],
    isDeprecated: false,
    example: "/** @function myHelper */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access organizational tag metadata)
 *
 * ```ts
 * import { OrganizationalJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = OrganizationalJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OrganizationalJSDoc = S.Union([
  JSDocModule,
  JSDocNamespace,
  JSDocMemberOf,
  JSDocMember,
  JSDocProperty,
  JSDocInterface,
  JSDocFunction,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("OrganizationalJSDoc"));

/**
 * Runtime type for {@link OrganizationalJSDoc}.
 *
 * **Example** (Extract organizational tag name)
 *
 * ```ts
 * import type { OrganizationalJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: OrganizationalJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OrganizationalJSDoc = typeof OrganizationalJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read organizational tag metadata)
 *
 * ```ts
 * import { OrganizationalJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = OrganizationalJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace OrganizationalJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = OrganizationalJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof OrganizationalJSDoc.Encoded;
}
