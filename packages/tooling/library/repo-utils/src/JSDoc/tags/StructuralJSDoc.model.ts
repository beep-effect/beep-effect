/**
 * StructuralJSDoc tag metadata catalog: Structural tags — AST-derivable (Layer 1).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as Match from "effect/Match";
import * as S from "effect/Schema";
import { JSDocTagDefinition } from "../models/index.ts";
import type { JSDocTagMember } from "../JSDoc.shared.ts";

const $I = $RepoUtilsId.create("JSDoc/JSDocTagDb");

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access param tag metadata)
 *
 * ```ts
 * import { JSDocParam } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocParam.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocParam extends S.Opaque<JSDocParam & JSDocTagMember<"param">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("param", {
    synonyms: ["arg", "argument"],
    overview: "Document the parameter to a function. Names, types, optionality, and defaults are all in the AST.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocCore", "typescript", "closure", "typedoc"],
    applicableTo: ["function", "method", "constructor"],
    astDerivable: "partial",
    astDerivableNote:
      "Parameter structure is AST-derivable (name, type, optionality, default), but complete documentation quality still requires human-authored parameter intent/description.",
    parameters: {
      syntax: "@param {Type} name - description",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["returns", "template", "callback"],
    isDeprecated: false,
    example: `/** @param {string} name - The user's display name */`,
  }).pipe(
    $I.annoteSchema("JSDocParam", {
      // description:
    })
  )
) {
  static readonly serializer = S.toCodecJson(this);
}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access returns tag metadata)
 *
 * ```ts
 * import { JSDocReturns } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocReturns.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocReturns extends S.Opaque<
  JSDocReturns & JSDocTagMember<"returns">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("returns", {
    synonyms: ["return"],
    overview: "Document the return value of a function. Return type is in the AST; description is human-authored.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocCore", "typescript", "closure", "typedoc"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "Return type is AST-derivable, but meaningful return semantics and narrative documentation are not deterministic from syntax alone.",
    parameters: {
      syntax: "@returns {Type} description",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["param", "throws", "yields"],
    isDeprecated: false,
    example: `/** @returns {Promise<User>} The resolved user object */`,
  }).pipe(
    $I.annoteSchema("JSDocReturns", {
      // description:
    })
  )
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access throws tag metadata)
 *
 * ```ts
 * import { JSDocThrows } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocThrows.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocThrows extends S.Opaque<JSDocThrows & JSDocTagMember<"throws">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("throws", {
    synonyms: ["exception"],
    overview:
      "Describe what errors could be thrown. With Effect-TS, error types are encoded in the E channel of Effect<A, E, R>.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocDiscretionary", "closure", "typedoc"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "Standard TS: generally not derivable because thrown values are untyped. Effect-TS can often derive candidate errors from Effect<A, E, R>, but this is conditional on resolvable E and still misses defects/opaque channels.",
    parameters: {
      syntax: "@throws {ErrorType} description",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["returns", "param"],
    isDeprecated: false,
    example: `/** @throws {HttpError} When the API request fails\n * @throws {ValidationError} When input is malformed */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access template tag metadata)
 *
 * ```ts
 * import { JSDocTemplate } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTemplate.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocTemplate extends S.Opaque<
  JSDocTemplate & JSDocTagMember<"template">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("template", {
    synonyms: [],
    overview:
      "Declare generic type parameters. Fully in the AST as TypeParameterDeclaration nodes including constraints and defaults.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure", "typedoc"],
    applicableTo: ["function", "method", "class", "interface", "typeAlias"],
    astDerivable: "partial",
    astDerivableNote:
      "Type parameter structure is derivable (name/constraint/default), but type-parameter intent text is documentation-only.",
    parameters: {
      syntax: "@template {Constraint} Name=Default",
      acceptsType: true,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["typeParam", "param"],
    isDeprecated: false,
    example: `/** @template {string} K - Must be a string literal type\n * @template V */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access typeparam tag metadata)
 *
 * ```ts
 * import { JSDocTypeParam } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTypeParam.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocTypeParam extends S.Opaque<
  JSDocTypeParam & JSDocTagMember<"typeParam">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("typeParam", {
    synonyms: [],
    overview: "TSDoc equivalent of @template. Documents a generic type parameter.",
    tagKind: "block",
    specifications: ["tsdocCore", "typedoc"],
    applicableTo: ["function", "method", "class", "interface", "typeAlias"],
    astDerivable: "partial",
    astDerivableNote: "Type parameter structure is derivable, but meaningful descriptive text is not.",
    parameters: {
      syntax: "@typeParam Name - description",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["template", "param"],
    isDeprecated: false,
    example: `/** @typeParam T - The element type of the collection */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access type tag metadata)
 *
 * ```ts
 * import { JSDocType } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocType.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocType extends S.Opaque<JSDocType & JSDocTagMember<"type">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("type", {
    synonyms: [],
    overview: "Document the type of an object/variable. Fully derivable from type annotations or inference.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure"],
    applicableTo: ["variable", "constant", "property", "any"],
    astDerivable: "partial",
    astDerivableNote:
      "Type can be inferred or extracted, but choosing what to document and normalization of human-facing type text is partially semantic.",
    parameters: { syntax: "@type {Type}", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["typedef", "param"],
    isDeprecated: false,
    example: `/** @type {string | number} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access typedef tag metadata)
 *
 * ```ts
 * import { JSDocTypeDef } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTypeDef.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocTypeDef extends S.Opaque<
  JSDocTypeDef & JSDocTagMember<"typedef">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("typedef", {
    synonyms: [],
    overview: "Document a custom type. In .ts-morph files, replaced by type aliases and interfaces.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure"],
    applicableTo: ["typeAlias"],
    astDerivable: "partial",
    astDerivableNote:
      "Alias/interface structure is derivable, but authored typedef intent and naming conventions are not fully deterministic.",
    parameters: { syntax: "@typedef {Type} Name", acceptsType: true, acceptsName: true, acceptsDescription: true },
    relatedTags: ["type", "callback", "property"],
    isDeprecated: false,
    example: `/** @typedef {Object} User\n * @property {string} name\n * @property {number} age */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access callback tag metadata)
 *
 * ```ts
 * import { JSDocCallback } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocCallback.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocCallback extends S.Opaque<
  JSDocCallback & JSDocTagMember<"callback">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("callback", {
    synonyms: [],
    overview: "Document a callback function type. In .ts-morph files, replaced by function type aliases.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript"],
    applicableTo: ["typeAlias"],
    astDerivable: "partial",
    astDerivableNote:
      "Function signature is derivable, but callback documentation intent and naming are not fully deterministic.",
    parameters: { syntax: "@callback Name", acceptsType: false, acceptsName: true, acceptsDescription: true },
    relatedTags: ["typedef", "param", "returns"],
    isDeprecated: false,
    example: `/** @callback Predicate\n * @param {string} value\n * @returns {boolean} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access augments tag metadata)
 *
 * ```ts
 * import { JSDocAugments } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAugments.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAugments extends S.Opaque<
  JSDocAugments & JSDocTagMember<"augments">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("augments", {
    synonyms: ["extends"],
    overview: "Indicate that a symbol inherits from a parent symbol. Heritage clauses are in the AST.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure"],
    applicableTo: ["class", "interface"],
    astDerivable: "full",
    astDerivableNote:
      "Heritage clauses (extends/implements) are explicit AST nodes. Extract via getExtends() / getImplements() on ClassDeclaration.",
    parameters: { syntax: "@augments {ParentClass}", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["implements", "class", "interface"],
    isDeprecated: false,
    example: `/** @augments {Component<Props>} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access implements tag metadata)
 *
 * ```ts
 * import { JSDocImplements } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocImplements.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocImplements extends S.Opaque<
  JSDocImplements & JSDocTagMember<"implements">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("implements", {
    synonyms: [],
    overview: "This symbol implements an interface. Fully in AST heritage clauses.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure"],
    applicableTo: ["class"],
    astDerivable: "full",
    astDerivableNote: "implements clause is an explicit AST node on ClassDeclaration.",
    parameters: {
      syntax: "@implements {InterfaceName}",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["augments", "interface"],
    isDeprecated: false,
    example: `/** @implements {Serializable} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access class tag metadata)
 *
 * ```ts
 * import { JSDocClass } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocClass.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocClass extends S.Opaque<JSDocClass & JSDocTagMember<"class">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("class", {
    synonyms: ["constructor"],
    overview:
      "This function is intended to be called with the 'new' keyword. In .ts-morph files, class declarations are explicit.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure", "typedoc"],
    applicableTo: ["function", "class"],
    astDerivable: "partial",
    astDerivableNote:
      "Class declarations are explicit, but use of class-tag semantics in JSDoc function-style constructors and intent text is only partially derivable.",
    parameters: { syntax: "@class [Name]", acceptsType: false, acceptsName: true, acceptsDescription: true },
    relatedTags: ["constructs", "augments", "implements"],
    isDeprecated: false,
    example: `/** @class */\nfunction Animal(name) { this.name = name; }`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access enum tag metadata)
 *
 * ```ts
 * import { JSDocEnum } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocEnum.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocEnum extends S.Opaque<JSDocEnum & JSDocTagMember<"enum">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("enum", {
    synonyms: [],
    overview: "Document a collection of related properties (JSDoc-style enum). Not the same as TypeScript enum.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure", "typedoc"],
    applicableTo: ["enum", "variable"],
    astDerivable: "partial",
    astDerivableNote: "Enum structure is derivable, but semantic documentation of member meaning is not.",
    parameters: { syntax: "@enum {Type}", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["constant", "readonly"],
    isDeprecated: false,
    example: `/** @enum {number} */\nconst Direction = { Up: 0, Down: 1 };`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access async tag metadata)
 *
 * ```ts
 * import { JSDocAsync } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAsync.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAsync extends S.Opaque<JSDocAsync & JSDocTagMember<"async">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("async", {
    synonyms: [],
    overview: "Indicate that a function is asynchronous. Detectable from the async modifier flag.",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Async on the function node. Trivially extractable.",
    parameters: { syntax: "@async", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["returns", "generator"],
    isDeprecated: false,
    example: `/** @async */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access generator tag metadata)
 *
 * ```ts
 * import { JSDocGenerator } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocGenerator.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocGenerator extends S.Opaque<
  JSDocGenerator & JSDocTagMember<"generator">,
  { readonly brand: unique symbol }
>()(
  JSDocTagDefinition.make("generator", {
    synonyms: [],
    overview: "Indicate that a function is a generator function. Detectable from the asterisk token.",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "full",
    astDerivableNote: "Generator functions have an asteriskToken on the FunctionDeclaration node.",
    parameters: { syntax: "@generator", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["yields", "async"],
    isDeprecated: false,
    example: `/** @generator */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access yields tag metadata)
 *
 * ```ts
 * import { JSDocYields } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocYields.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocYields extends S.Opaque<JSDocYields & JSDocTagMember<"yields">, { readonly brand: unique symbol }>()(
  JSDocTagDefinition.make("yields", {
    synonyms: ["yield"],
    overview: "Document the value yielded by a generator function. Yield type is in the return type signature.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "Yield type can often be derived from generator signatures, but narrative yield semantics are not deterministic.",
    parameters: {
      syntax: "@yields {Type} description",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["generator", "returns"],
    isDeprecated: false,
    example: `/** @yields {number} The next number in the sequence */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access structural tag metadata)
 *
 * ```ts
 * import { StructuralJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = StructuralJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const StructuralJSDoc = S.Union([
  JSDocParam,
  JSDocReturns,
  JSDocThrows,
  JSDocTemplate,
  JSDocTypeParam,
  JSDocType,
  JSDocTypeDef,
  JSDocCallback,
  JSDocAugments,
  JSDocImplements,
  JSDocClass,
  JSDocEnum,
  JSDocAsync,
  JSDocGenerator,
  JSDocYields,
]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("StructuralJSDoc", {
    description: "A Structural JSDoc Tag",
    documentation:
      "STRUCTURAL TAGS — AST-derivable (Layer 1)\n" +
      "These tags can be 100% or mostly derived from the TypeScript AST.",
  })
);

/**
 * Runtime type for {@link StructuralJSDoc}.
 *
 * **Example** (Extract structural tag name)
 *
 * ```ts
 * import type { StructuralJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: StructuralJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type StructuralJSDoc = typeof StructuralJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read structural tag metadata)
 *
 * ```ts
 * import { StructuralJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = StructuralJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace StructuralJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = StructuralJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof StructuralJSDoc.Encoded;
}

/**
 * Matches over structural JSDoc tag variants.
 *
 * **Example** (Access structural matcher name)
 *
 * ```ts
 * import { matchStructuralJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const matcherName = matchStructuralJSDoc.name
 * console.log(matcherName)
 * ```
 *
 * @param value - Structural JSDoc tag metadata.
 * @returns Matched handler result.
 * @category models
 * @since 0.0.0
 */
export const matchStructuralJSDoc = (value: StructuralJSDoc.Type) =>
  Match.value(value).pipe(
    Match.discriminator("_tag")("param", (_jsdoc: JSDocParam) => {}),
    Match.discriminator("_tag")("returns", (_jsdoc: JSDocReturns) => {}),
    Match.discriminator("_tag")("throws", (_jsdoc: JSDocThrows) => {}),
    Match.discriminator("_tag")("template", (_jsdoc: JSDocTemplate) => {}),
    Match.discriminator("_tag")("typeParam", (_jsdoc: JSDocTypeParam) => {}),
    Match.discriminator("_tag")("type", (_jsdoc: JSDocType) => {}),
    Match.discriminator("_tag")("typedef", (_jsdoc: JSDocTypeDef) => {}),
    Match.discriminator("_tag")("callback", (_jsdoc: JSDocCallback) => {}),
    Match.discriminator("_tag")("augments", (_jsdoc: JSDocAugments) => {}),
    Match.discriminator("_tag")("implements", (_jsdoc: JSDocImplements) => {}),
    Match.discriminator("_tag")("class", (_jsdoc: JSDocClass) => {}),
    Match.discriminator("_tag")("enum", (_jsdoc: JSDocEnum) => {}),
    Match.discriminator("_tag")("async", (_jsdoc: JSDocAsync) => {}),
    Match.discriminator("_tag")("generator", (_jsdoc: JSDocGenerator) => {}),
    Match.discriminator("_tag")("yields", (_jsdoc: JSDocYields) => {}),
    Match.exhaustive
  );
