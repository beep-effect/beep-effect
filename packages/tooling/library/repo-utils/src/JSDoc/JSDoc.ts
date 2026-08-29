/**
 * Canonical JSDoc tag metadata catalog.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { Match } from "effect";
import * as S from "effect/Schema";
import { JSDocTagDefinition } from "./models/index.ts";

/* cspell:ignore defaultvalue doctest noalias nocompile nocollapse nosideeffects noinline inlines */

const $I = $RepoUtilsId.create("JSDoc/JSDocTagDb");

type JSDocTagMember<Tag extends string> = JSDocTagDefinition.JSDocTagDefinition & {
  readonly _tag: Tag;
};

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
export class JSDocParam extends S.Opaque<JSDocParam & JSDocTagMember<"param">>()(
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
export class JSDocReturns extends S.Opaque<JSDocReturns & JSDocTagMember<"returns">>()(
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
export class JSDocThrows extends S.Opaque<JSDocThrows & JSDocTagMember<"throws">>()(
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
export class JSDocTemplate extends S.Opaque<JSDocTemplate & JSDocTagMember<"template">>()(
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
export class JSDocTypeParam extends S.Opaque<JSDocTypeParam & JSDocTagMember<"typeParam">>()(
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
export class JSDocType extends S.Opaque<JSDocType & JSDocTagMember<"type">>()(
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
export class JSDocTypeDef extends S.Opaque<JSDocTypeDef & JSDocTagMember<"typedef">>()(
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
export class JSDocCallback extends S.Opaque<JSDocCallback & JSDocTagMember<"callback">>()(
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
export class JSDocAugments extends S.Opaque<JSDocAugments & JSDocTagMember<"augments">>()(
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
export class JSDocImplements extends S.Opaque<JSDocImplements & JSDocTagMember<"implements">>()(
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
export class JSDocClass extends S.Opaque<JSDocClass & JSDocTagMember<"class">>()(
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
export class JSDocEnum extends S.Opaque<JSDocEnum & JSDocTagMember<"enum">>()(
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
export class JSDocAsync extends S.Opaque<JSDocAsync & JSDocTagMember<"async">>()(
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
export class JSDocGenerator extends S.Opaque<JSDocGenerator & JSDocTagMember<"generator">>()(
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
export class JSDocYields extends S.Opaque<JSDocYields & JSDocTagMember<"yields">>()(
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
    Match.discriminatorsExhaustive("_tag")({
      param: (_jsdoc: JSDocParam) => {},
      returns: (_jsdoc: JSDocReturns) => {},
      throws: (_jsdoc: JSDocThrows) => {},
      template: (_jsdoc: JSDocTemplate) => {},
      typeParam: (_jsdoc: JSDocTypeParam) => {},
      type: (_jsdoc: JSDocType) => {},
      typedef: (_jsdoc: JSDocTypeDef) => {},
      callback: (_jsdoc: JSDocCallback) => {},
      augments: (_jsdoc: JSDocAugments) => {},
      implements: (_jsdoc: JSDocImplements) => {},
      class: (_jsdoc: JSDocClass) => {},
      enum: (_jsdoc: JSDocEnum) => {},
      async: (_jsdoc: JSDocAsync) => {},
      generator: (_jsdoc: JSDocGenerator) => {},
      yields: (_jsdoc: JSDocYields) => {},
    })
  );

// Access modifiers — all fully in AST modifier flags

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access access tag metadata)
 *
 * ```ts
 * import { JSDocAccess } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAccess.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAccess extends S.Opaque<JSDocAccess & JSDocTagMember<"access">>()(
  JSDocTagDefinition.make("access", {
    synonyms: [],
    overview: "Specify the access level of this member. Shorthand tags @public/@private/@protected are preferred.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Public/Private/Protected on the declaration node.",
    parameters: {
      syntax: "@access <public|private|protected|package>",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
      allowedValues: ["public", "private", "protected", "package"],
    },
    relatedTags: ["public", "private", "protected", "package"],
    isDeprecated: false,
    example: `/** @access protected */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access public tag metadata)
 *
 * ```ts
 * import { JSDocPublic } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPublic.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPublic extends S.Opaque<JSDocPublic & JSDocTagMember<"public">>()(
  JSDocTagDefinition.make("public", {
    synonyms: [],
    overview: "This symbol is meant to be public.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "tsdocCore", "typescript", "closure", "apiExtractor", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "partial",
    astDerivableNote:
      "Visibility defaults and emitted docs can be inferred structurally, but public API intent is partly policy-driven.",
    parameters: { syntax: "@public", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["access", "private", "protected", "package"],
    isDeprecated: false,
    example: `/** @public */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access private tag metadata)
 *
 * ```ts
 * import { JSDocPrivate } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPrivate.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPrivate extends S.Opaque<JSDocPrivate & JSDocTagMember<"private">>()(
  JSDocTagDefinition.make("private", {
    synonyms: [],
    overview: "This symbol is meant to be private.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "typescript", "closure", "typedoc"],
    applicableTo: ["property", "method", "accessor", "constructor"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Private on the declaration.",
    parameters: { syntax: "@private", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["access", "public", "protected"],
    isDeprecated: false,
    example: `/** @private */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access protected tag metadata)
 *
 * ```ts
 * import { JSDocProtected } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocProtected.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocProtected extends S.Opaque<JSDocProtected & JSDocTagMember<"protected">>()(
  JSDocTagDefinition.make("protected", {
    synonyms: [],
    overview: "This symbol is meant to be protected.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "typescript", "closure", "typedoc"],
    applicableTo: ["property", "method", "accessor", "constructor"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Protected on the declaration.",
    parameters: { syntax: "@protected", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["access", "public", "private"],
    isDeprecated: false,
    example: `/** @protected */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access package tag metadata)
 *
 * ```ts
 * import { JSDocPackage } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPackage.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPackage extends S.Opaque<JSDocPackage & JSDocTagMember<"package">>()(
  JSDocTagDefinition.make("package", {
    synonyms: [],
    overview: "This symbol is meant to be package-private (JSDoc concept, no direct TS equivalent).",
    tagKind: "modifier",
    specifications: ["jsdoc3", "closure"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "No TypeScript equivalent. This is a JSDoc-only concept for documentation purposes.",
    parameters: { syntax: "@package", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["access", "public", "private", "protected"],
    isDeprecated: false,
    example: `/** @package */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access readonly tag metadata)
 *
 * ```ts
 * import { JSDocReadonly } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocReadonly.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocReadonly extends S.Opaque<JSDocReadonly & JSDocTagMember<"readonly">>()(
  JSDocTagDefinition.make("readonly", {
    synonyms: [],
    overview: "This symbol is meant to be read-only.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "tsdocExtended", "typescript", "typedoc"],
    applicableTo: ["property", "accessor", "variable"],
    astDerivable: "partial",
    astDerivableNote:
      "Readonly/const shape is structural, but intent and edge-case semantics across transpiled JS are only partially derivable.",
    parameters: { syntax: "@readonly", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["constant"],
    isDeprecated: false,
    example: `/** @readonly */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access abstract tag metadata)
 *
 * ```ts
 * import { JSDocAbstract } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAbstract.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAbstract extends S.Opaque<JSDocAbstract & JSDocTagMember<"abstract">>()(
  JSDocTagDefinition.make("abstract", {
    synonyms: [],
    overview: "This member must be implemented (or overridden) by the inheritor.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["class", "method", "property"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Abstract on the declaration node.",
    parameters: { syntax: "@abstract", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["override", "implements"],
    isDeprecated: false,
    example: `/** @abstract */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access final tag metadata)
 *
 * ```ts
 * import { JSDocFinal } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocFinal.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocFinal extends S.Opaque<JSDocFinal & JSDocTagMember<"final">>()(
  JSDocTagDefinition.make("final", {
    synonyms: [],
    overview: "Closure: marks a class or member as final and not intended for override/extension.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class", "method", "property"],
    astDerivable: "none",
    astDerivableNote: "Final intent is an annotation policy in Closure and is not inferred from TypeScript syntax.",
    parameters: { syntax: "@final", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["override", "sealed"],
    isDeprecated: false,
    example: `/** @final */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access override tag metadata)
 *
 * ```ts
 * import { JSDocOverride } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocOverride.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocOverride extends S.Opaque<JSDocOverride & JSDocTagMember<"override">>()(
  JSDocTagDefinition.make("override", {
    synonyms: [],
    overview: "Indicate that a symbol overrides its parent. TypeScript 4.3+ has native override keyword.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "tsdocExtended", "typescript", "closure", "typedoc"],
    applicableTo: ["method", "property", "accessor"],
    astDerivable: "full",
    astDerivableNote:
      "ModifierFlags.Override (TS 4.3+). Also detectable by checking if parent class has same-named member.",
    parameters: { syntax: "@override", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["abstract", "sealed", "virtual"],
    isDeprecated: false,
    example: `/** @override */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access static tag metadata)
 *
 * ```ts
 * import { JSDocStatic } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocStatic.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocStatic extends S.Opaque<JSDocStatic & JSDocTagMember<"static">>()(
  JSDocTagDefinition.make("static", {
    synonyms: [],
    overview: "Document a static member.",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["method", "property", "accessor"],
    astDerivable: "full",
    astDerivableNote: "ModifierFlags.Static on the declaration.",
    parameters: { syntax: "@static", acceptsType: false, acceptsName: false, acceptsDescription: false },
    relatedTags: ["instance", "inner"],
    isDeprecated: false,
    example: `/** @static */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access constant tag metadata)
 *
 * ```ts
 * import { JSDocConstant } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocConstant.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocConstant extends S.Opaque<JSDocConstant & JSDocTagMember<"constant">>()(
  JSDocTagDefinition.make("constant", {
    synonyms: ["const"],
    overview: "Document an object as a constant.",
    tagKind: "block",
    specifications: ["jsdoc3", "closure"],
    applicableTo: ["variable", "property"],
    astDerivable: "partial",
    astDerivableNote:
      "Const/readonly modifiers are derivable, but constant-tag intent across runtime mutation boundaries is partially semantic.",
    parameters: { syntax: "@constant [Name]", acceptsType: true, acceptsName: true, acceptsDescription: false },
    relatedTags: ["readonly", "default"],
    isDeprecated: false,
    example: `/** @constant {number} */\nconst MAX = 100;`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access default tag metadata)
 *
 * ```ts
 * import { JSDocDefault } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDefault.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDefault extends S.Opaque<JSDocDefault & JSDocTagMember<"default">>()(
  JSDocTagDefinition.make("default", {
    synonyms: ["defaultvalue"],
    overview: "Document the default value of a symbol.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["property", "parameter", "variable"],
    astDerivable: "partial",
    astDerivableNote: "Initializer expressions are derivable, but chosen human-facing default explanations are not.",
    parameters: { syntax: "@default [value]", acceptsType: false, acceptsName: false, acceptsDescription: true },
    relatedTags: ["constant", "type"],
    isDeprecated: false,
    example: `/** @default 42 */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access defaultvalue tag metadata)
 *
 * ```ts
 * import { JSDocDefaultValue } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDefaultValue.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDefaultValue extends S.Opaque<JSDocDefaultValue & JSDocTagMember<"defaultValue">>()(
  JSDocTagDefinition.make("defaultValue", {
    synonyms: [],
    overview: "TSDoc equivalent of @default. Documents the default value of a property or parameter.",
    tagKind: "block",
    specifications: ["tsdocCore", "typedoc"],
    applicableTo: ["property", "parameter"],
    astDerivable: "partial",
    astDerivableNote:
      "Initializer expressions are derivable, but documentation representation of defaults is not fully deterministic.",
    parameters: { syntax: "@defaultValue value", acceptsType: false, acceptsName: false, acceptsDescription: true },
    relatedTags: ["default", "param"],
    isDeprecated: false,
    example: `/** @defaultValue 42 */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access exports tag metadata)
 *
 * ```ts
 * import { JSDocExports } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExports.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExports extends S.Opaque<JSDocExports & JSDocTagMember<"exports">>()(
  JSDocTagDefinition.make("exports", {
    synonyms: [],
    overview: "Identify the member that is exported by a JavaScript module.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["module"],
    astDerivable: "partial",
    astDerivableNote:
      "Export structure is derivable, but intended exported surface naming and documentation-level grouping are partially semantic.",
    parameters: { syntax: "@exports moduleName", acceptsType: false, acceptsName: true, acceptsDescription: false },
    relatedTags: ["module", "requires"],
    isDeprecated: false,
    example: `/** @exports myModule */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access export tag metadata)
 *
 * ```ts
 * import { JSDocExport } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExport.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExport extends S.Opaque<JSDocExport & JSDocTagMember<"export">>()(
  JSDocTagDefinition.make("export", {
    synonyms: [],
    overview: "Closure: preserve a symbol/property name in compiled output for external use.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class", "function", "method", "property", "variable"],
    astDerivable: "none",
    astDerivableNote: "This is a compiler behavior directive, not a deterministic AST property.",
    parameters: { syntax: "@export", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["exports", "public", "externs"],
    isDeprecated: false,
    example: `/** @export */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access satisfies tag metadata)
 *
 * ```ts
 * import { JSDocSatisfies } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSatisfies.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSatisfies extends S.Opaque<JSDocSatisfies & JSDocTagMember<"satisfies">>()(
  JSDocTagDefinition.make("satisfies", {
    synonyms: [],
    overview: "TypeScript 4.9+ satisfies operator in JSDoc form. Validates a type without widening.",
    tagKind: "block",
    specifications: ["typescript"],
    applicableTo: ["variable", "constant"],
    astDerivable: "full",
    astDerivableNote: "The satisfies expression is an explicit AST node (SatisfiesExpression).",
    parameters: { syntax: "@satisfies {Type}", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["type"],
    isDeprecated: false,
    example: `/** @satisfies {Record<string, unknown>} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access import tag metadata)
 *
 * ```ts
 * import { JSDocImport } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocImport.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocImport extends S.Opaque<JSDocImport & JSDocTagMember<"import">>()(
  JSDocTagDefinition.make("import", {
    synonyms: [],
    overview: "TypeScript-specific: import type declarations in JSDoc for .js files.",
    tagKind: "block",
    specifications: ["typescript", "typedoc"],
    applicableTo: ["file"],
    astDerivable: "full",
    astDerivableNote: "Import declarations are explicit AST nodes. This tag is only needed in .js files.",
    parameters: {
      syntax: "@import {Type} from 'module'",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["type", "typedef"],
    isDeprecated: false,
    example: `/** @import {User} from "./types" */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access this tag metadata)
 *
 * ```ts
 * import { JSDocThis } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocThis.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocThis extends S.Opaque<JSDocThis & JSDocTagMember<"this">>()(
  JSDocTagDefinition.make("this", {
    synonyms: [],
    overview: "What does the 'this' keyword refer to here?",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "closure"],
    applicableTo: ["function", "method"],
    astDerivable: "partial",
    astDerivableNote:
      "In class methods, 'this' is deterministic (the class). In standalone functions, requires explicit annotation or @this tag.",
    parameters: { syntax: "@this {Type}", acceptsType: true, acceptsName: false, acceptsDescription: false },
    relatedTags: ["class"],
    isDeprecated: false,
    example: `/** @this {HTMLElement} */`,
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access modifier tag metadata)
 *
 * ```ts
 * import { AccessModifierJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = AccessModifierJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AccessModifierJSDoc = S.Union([
  JSDocAccess,
  JSDocPublic,
  JSDocPrivate,
  JSDocProtected,
  JSDocPackage,
  JSDocReadonly,
  JSDocAbstract,
  JSDocFinal,
  JSDocOverride,
  JSDocStatic,
  JSDocConstant,
  JSDocDefault,
  JSDocDefaultValue,
  JSDocExports,
  JSDocExport,
  JSDocSatisfies,
  JSDocImport,
  JSDocThis,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("AccessModifierJSDoc"));

/**
 * Runtime type for {@link AccessModifierJSDoc}.
 *
 * **Example** (Extract access modifier tag)
 *
 * ```ts
 * import type { AccessModifierJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: AccessModifierJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type AccessModifierJSDoc = typeof AccessModifierJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read access modifier metadata)
 *
 * ```ts
 * import { AccessModifierJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = AccessModifierJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AccessModifierJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = AccessModifierJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof AccessModifierJSDoc.Encoded;
}
// Documentation content tags — human-authored narrative metadata

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access description tag metadata)
 *
 * ```ts
 * import { JSDocDescription } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDescription.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDescription extends S.Opaque<JSDocDescription & JSDocTagMember<"description">>()(
  JSDocTagDefinition.make("description", {
    synonyms: ["desc"],
    overview: "Describe a symbol. This is the primary human-authored content and the main target for LLM enrichment.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote:
      "Semantic descriptions require human understanding or LLM inference. This is the primary Layer 3 content.",
    parameters: {
      syntax: "@description text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["summary", "remarks", "classdesc"],
    isDeprecated: false,
    example: "/** @description Retrieves the user's profile from the cache or database */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access summary tag metadata)
 *
 * ```ts
 * import { JSDocSummary } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSummary.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSummary extends S.Opaque<JSDocSummary & JSDocTagMember<"summary">>()(
  JSDocTagDefinition.make("summary", {
    synonyms: [],
    overview: "A shorter version of the full description.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Requires human authoring or LLM summarization.",
    parameters: {
      syntax: "@summary text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["description", "remarks"],
    isDeprecated: false,
    example: "/** @summary Get user profile */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access remarks tag metadata)
 *
 * ```ts
 * import { JSDocRemarks } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocRemarks.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocRemarks extends S.Opaque<JSDocRemarks & JSDocTagMember<"remarks">>()(
  JSDocTagDefinition.make("remarks", {
    synonyms: [],
    overview: "TSDoc block for extended discussion. Separates the brief summary from detailed documentation.",
    tagKind: "block",
    specifications: ["tsdocCore", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Semantic content requiring human authoring or LLM generation.",
    parameters: {
      syntax: "@remarks text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["description", "summary"],
    isDeprecated: false,
    example: "/** Summary here.\n * @remarks\n * Extended discussion here. */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access example tag metadata)
 *
 * ```ts
 * import { JSDocExample } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExample.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExample extends S.Opaque<JSDocExample & JSDocTagMember<"example">>()(
  JSDocTagDefinition.make("example", {
    synonyms: [],
    overview: "Provide an example of how to use a documented item.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocCore", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote:
      "Code examples require human authoring or LLM generation. Validation possible via doctest tools (tsdoc-testify).",
    parameters: {
      syntax: "@example [title]\\ncode",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["see", "link"],
    isDeprecated: false,
    example: '/** @example Basic usage\n * ```ts\n * const user = getUser("123");\n * ``` */',
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access deprecated tag metadata)
 *
 * ```ts
 * import { JSDocDeprecated } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDeprecated.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDeprecated extends S.Opaque<JSDocDeprecated & JSDocTagMember<"deprecated">>()(
  JSDocTagDefinition.make("deprecated", {
    synonyms: [],
    overview: "Document that this is no longer the preferred way. Semantic meaning beyond just the flag.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocCore", "typescript", "closure", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote:
      "Deprecation intent and migration guidance are documentation semantics; no deterministic AST signal provides equivalent meaning.",
    parameters: {
      syntax: "@deprecated [reason]",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["since", "version", "see"],
    isDeprecated: false,
    example: "/** @deprecated Use newMethod() instead */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access see tag metadata)
 *
 * ```ts
 * import { JSDocSee } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSee.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSee extends S.Opaque<JSDocSee & JSDocTagMember<"see">>()(
  JSDocTagDefinition.make("see", {
    synonyms: [],
    overview: "Refer to some other documentation for more information.",
    tagKind: "block",
    specifications: ["jsdoc3", "tsdocCore", "typescript", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Cross-reference choices are human-curated documentation structure.",
    parameters: {
      syntax: "@see namepath or URL",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["link", "tutorial"],
    isDeprecated: false,
    example: "/** @see {@link OtherClass} for more details */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access since tag metadata)
 *
 * ```ts
 * import { JSDocSince } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSince.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSince extends S.Opaque<JSDocSince & JSDocTagMember<"since">>()(
  JSDocTagDefinition.make("since", {
    synonyms: [],
    overview: "When was this feature added? Useful for versioned APIs.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote:
      "Version information is not in the AST. Could be derived from git history (first commit introducing the symbol).",
    parameters: {
      syntax: "@since version",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["version", "deprecated"],
    isDeprecated: false,
    example: "/** @since 0.0.0 */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access version tag metadata)
 *
 * ```ts
 * import { JSDocVersion } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocVersion.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocVersion extends S.Opaque<JSDocVersion & JSDocTagMember<"version">>()(
  JSDocTagDefinition.make("version", {
    synonyms: [],
    overview: "Documents the version number of an item.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Version metadata is not in the AST. Typically managed by release tooling.",
    parameters: {
      syntax: "@version semver",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["since", "deprecated"],
    isDeprecated: false,
    example: "/** @version 3.1.0 */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access author tag metadata)
 *
 * ```ts
 * import { JSDocAuthor } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAuthor.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAuthor extends S.Opaque<JSDocAuthor & JSDocTagMember<"author">>()(
  JSDocTagDefinition.make("author", {
    synonyms: [],
    overview: "Identify the author of an item.",
    tagKind: "block",
    specifications: ["jsdoc3", "typescript", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Author information not in AST. Could be derived from git blame.",
    parameters: {
      syntax: "@author Name <email>",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["copyright", "license"],
    isDeprecated: false,
    example: "/** @author Jane Doe <jane@example.com> */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access todo tag metadata)
 *
 * ```ts
 * import { JSDocTodo } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTodo.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocTodo extends S.Opaque<JSDocTodo & JSDocTagMember<"todo">>()(
  JSDocTagDefinition.make("todo", {
    synonyms: [],
    overview: "Document tasks to be completed.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Human-authored work tracking. Not in AST.",
    parameters: {
      syntax: "@todo description",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: [],
    isDeprecated: false,
    example: "/** @todo Add input validation */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access documentation content metadata)
 *
 * ```ts
 * import { DocumentationContentJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = DocumentationContentJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DocumentationContentJSDoc = S.Union([
  JSDocDescription,
  JSDocSummary,
  JSDocRemarks,
  JSDocExample,
  JSDocDeprecated,
  JSDocSee,
  JSDocSince,
  JSDocVersion,
  JSDocAuthor,
  JSDocTodo,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("DocumentationContentJSDoc"));

/**
 * Runtime type for {@link DocumentationContentJSDoc}.
 *
 * **Example** (Extract documentation content tag)
 *
 * ```ts
 * import type { DocumentationContentJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: DocumentationContentJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DocumentationContentJSDoc = typeof DocumentationContentJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read documentation content metadata)
 *
 * ```ts
 * import { DocumentationContentJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = DocumentationContentJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace DocumentationContentJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = DocumentationContentJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof DocumentationContentJSDoc.Encoded;
}

// TSDoc-specific tags — release management and documentation structure

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access alpha tag metadata)
 *
 * ```ts
 * import { JSDocAlpha } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAlpha.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAlpha extends S.Opaque<JSDocAlpha & JSDocTagMember<"alpha">>()(
  JSDocTagDefinition.make("alpha", {
    synonyms: [],
    overview: "API Extractor: indicates an API item is in early development (alpha release stage).",
    tagKind: "modifier",
    specifications: ["tsdocCore", "apiExtractor", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Release stage is a project management decision, not in the AST.",
    parameters: {
      syntax: "@alpha",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["beta", "public", "internal", "experimental"],
    isDeprecated: false,
    example: "/** @alpha */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access beta tag metadata)
 *
 * ```ts
 * import { JSDocBeta } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocBeta.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocBeta extends S.Opaque<JSDocBeta & JSDocTagMember<"beta">>()(
  JSDocTagDefinition.make("beta", {
    synonyms: [],
    overview: "API Extractor: indicates an API item is in preview/experimental stage.",
    tagKind: "modifier",
    specifications: ["tsdocCore", "apiExtractor", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Release stage is a project management decision, not in the AST.",
    parameters: {
      syntax: "@beta",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["alpha", "public", "internal", "experimental"],
    isDeprecated: false,
    example: "/** @beta */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access experimental tag metadata)
 *
 * ```ts
 * import { JSDocExperimental } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExperimental.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExperimental extends S.Opaque<JSDocExperimental & JSDocTagMember<"experimental">>()(
  JSDocTagDefinition.make("experimental", {
    synonyms: [],
    overview: "TSDoc: indicates that an API item is not yet stable.",
    tagKind: "modifier",
    specifications: ["tsdocExtended", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Stability status is a human decision.",
    parameters: {
      syntax: "@experimental",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["alpha", "beta"],
    isDeprecated: false,
    example: "/** @experimental */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access internal tag metadata)
 *
 * ```ts
 * import { JSDocInternal } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInternal.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInternal extends S.Opaque<JSDocInternal & JSDocTagMember<"internal">>()(
  JSDocTagDefinition.make("internal", {
    synonyms: [],
    overview: "Indicates that an API item is meant only for internal usage. Should be prefixed with underscore.",
    tagKind: "modifier",
    specifications: ["tsdocCore", "apiExtractor", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote:
      "Internal visibility is a release/documentation policy decision, not a deterministic AST property.",
    parameters: {
      syntax: "@internal",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["public", "alpha", "beta", "private"],
    isDeprecated: false,
    example: "/** @internal */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access sealed tag metadata)
 *
 * ```ts
 * import { JSDocSealed } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSealed.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSealed extends S.Opaque<JSDocSealed & JSDocTagMember<"sealed">>()(
  JSDocTagDefinition.make("sealed", {
    synonyms: [],
    overview:
      "TSDoc: indicates that a class should not be extended, or an interface should not be implemented by external consumers.",
    tagKind: "modifier",
    specifications: ["tsdocExtended", "typedoc"],
    applicableTo: ["class", "interface"],
    astDerivable: "none",
    astDerivableNote: "Semantic intent not expressible in TypeScript's type system. A human decision.",
    parameters: {
      syntax: "@sealed",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["virtual", "override"],
    isDeprecated: false,
    example: "/** @sealed */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access virtual tag metadata)
 *
 * ```ts
 * import { JSDocVirtual } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocVirtual.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocVirtual extends S.Opaque<JSDocVirtual & JSDocTagMember<"virtual">>()(
  JSDocTagDefinition.make("virtual", {
    synonyms: [],
    overview: "TSDoc: explicitly indicates that subclasses may override this member.",
    tagKind: "modifier",
    specifications: ["tsdocExtended", "typedoc"],
    applicableTo: ["method", "property", "accessor"],
    astDerivable: "none",
    astDerivableNote: "Virtual-tag usage communicates design intent rather than deterministic syntax.",
    parameters: {
      syntax: "@virtual",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["override", "sealed", "abstract"],
    isDeprecated: false,
    example: "/** @virtual */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access privateremarks tag metadata)
 *
 * ```ts
 * import { JSDocPrivateRemarks } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPrivateRemarks.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPrivateRemarks extends S.Opaque<JSDocPrivateRemarks & JSDocTagMember<"privateRemarks">>()(
  JSDocTagDefinition.make("privateRemarks", {
    synonyms: [],
    overview: "TSDoc: documentation content that should be omitted from public-facing documentation.",
    tagKind: "block",
    specifications: ["tsdocCore", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Internal documentation notes are human-authored.",
    parameters: {
      syntax: "@privateRemarks text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["remarks", "internal"],
    isDeprecated: false,
    example: "/** @privateRemarks This implementation needs refactoring */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access packagedocumentation metadata)
 *
 * ```ts
 * import { JSDocPackageDocumentation } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPackageDocumentation.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPackageDocumentation extends S.Opaque<
  JSDocPackageDocumentation & JSDocTagMember<"packageDocumentation">
>()(
  JSDocTagDefinition.make("packageDocumentation", {
    synonyms: [],
    overview: "TSDoc: indicates that a doc comment describes an entire package (placed in the entry point file).",
    tagKind: "modifier",
    specifications: ["tsdocCore", "typedoc"],
    applicableTo: ["file"],
    astDerivable: "partial",
    astDerivableNote: "Can detect if a file is the package entry point from package.json 'main'/'exports' fields.",
    parameters: {
      syntax: "@packageDocumentation",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["module", "file"],
    isDeprecated: false,
    example: "/**\n * My awesome library\n * @packageDocumentation\n */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access label tag metadata)
 *
 * ```ts
 * import { JSDocLabel } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocLabel.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocLabel extends S.Opaque<JSDocLabel & JSDocTagMember<"label">>()(
  JSDocTagDefinition.make("label", {
    synonyms: [],
    overview: "TSDoc: defines a label that can be referenced by {@link} tags using the selector syntax.",
    tagKind: "modifier",
    specifications: ["tsdocExtended"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Labels are human-defined cross-reference anchors.",
    parameters: {
      syntax: "@label NAME",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["link"],
    isDeprecated: false,
    example: "/** {@label IMPORTANT_OVERLOAD} */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access decorator tag metadata)
 *
 * ```ts
 * import { JSDocDecorator } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDecorator.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDecorator extends S.Opaque<JSDocDecorator & JSDocTagMember<"decorator">>()(
  JSDocTagDefinition.make("decorator", {
    synonyms: [],
    overview: "TSDoc: documents an ECMAScript decorator expression.",
    tagKind: "block",
    specifications: ["tsdocExtended"],
    applicableTo: ["class", "method", "property", "accessor", "parameter"],
    astDerivable: "full",
    astDerivableNote:
      "Decorators are explicit AST nodes. The decorator expression and arguments are fully extractable.",
    parameters: {
      syntax: "@decorator expression",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: [],
    isDeprecated: false,
    example: "/** @decorator @sealed */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access eventproperty tag metadata)
 *
 * ```ts
 * import { JSDocEventProperty } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocEventProperty.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocEventProperty extends S.Opaque<JSDocEventProperty & JSDocTagMember<"eventProperty">>()(
  JSDocTagDefinition.make("eventProperty", {
    synonyms: [],
    overview: "TSDoc: indicates that a property returns an event object that event handlers can be attached to.",
    tagKind: "modifier",
    specifications: ["tsdocExtended", "typedoc"],
    applicableTo: ["property"],
    astDerivable: "none",
    astDerivableNote: "Event semantics are a design intent, not derivable from types alone.",
    parameters: {
      syntax: "@eventProperty",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["event", "fires", "listens"],
    isDeprecated: false,
    example: "/** @eventProperty */\npublic readonly onChanged: Event<ChangedArgs>;",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access TSDoc-specific tag metadata)
 *
 * ```ts
 * import { TSDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TSDocSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TSDocSpecificJSDoc = S.Union([
  JSDocAlpha,
  JSDocBeta,
  JSDocExperimental,
  JSDocInternal,
  JSDocSealed,
  JSDocVirtual,
  JSDocPrivateRemarks,
  JSDocPackageDocumentation,
  JSDocLabel,
  JSDocDecorator,
  JSDocEventProperty,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("TSDocSpecificJSDoc"));

/**
 * Runtime type for {@link TSDocSpecificJSDoc}.
 *
 * **Example** (Extract TSDoc-specific tag name)
 *
 * ```ts
 * import type { TSDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: TSDocSpecificJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type TSDocSpecificJSDoc = typeof TSDocSpecificJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read TSDoc-specific tag metadata)
 *
 * ```ts
 * import { TSDocSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = TSDocSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace TSDocSpecificJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = TSDocSpecificJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof TSDocSpecificJSDoc.Encoded;
}

// Inline tags — embedded cross references

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
export class JSDocLink extends S.Opaque<JSDocLink & JSDocTagMember<"link">>()(
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
export class JSDocInheritDoc extends S.Opaque<JSDocInheritDoc & JSDocTagMember<"inheritDoc">>()(
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

// Organizational tags — module/namespace/membership structure

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
export class JSDocModule extends S.Opaque<JSDocModule & JSDocTagMember<"module">>()(
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
export class JSDocNamespace extends S.Opaque<JSDocNamespace & JSDocTagMember<"namespace">>()(
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
export class JSDocMemberOf extends S.Opaque<JSDocMemberOf & JSDocTagMember<"memberof">>()(
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
export class JSDocMember extends S.Opaque<JSDocMember & JSDocTagMember<"member">>()(
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
export class JSDocProperty extends S.Opaque<JSDocProperty & JSDocTagMember<"property">>()(
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
export class JSDocInterface extends S.Opaque<JSDocInterface & JSDocTagMember<"interface">>()(
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
export class JSDocFunction extends S.Opaque<JSDocFunction & JSDocTagMember<"function">>()(
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

// Event and dependency tags

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access fires tag metadata)
 *
 * ```ts
 * import { JSDocFires } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocFires.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocFires extends S.Opaque<JSDocFires & JSDocTagMember<"fires">>()(
  JSDocTagDefinition.make("fires", {
    synonyms: ["emits"],
    overview: "Describe the events this method may fire.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Event emission documentation is not deterministically derivable in general codebases.",
    parameters: {
      syntax: "@fires ClassName#eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["event", "listens"],
    isDeprecated: false,
    example: "/** @fires MyClass#change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access listens tag metadata)
 *
 * ```ts
 * import { JSDocListens } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocListens.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocListens extends S.Opaque<JSDocListens & JSDocTagMember<"listens">>()(
  JSDocTagDefinition.make("listens", {
    synonyms: [],
    overview: "List the events that a symbol listens for.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Event listener documentation is not deterministically derivable in general codebases.",
    parameters: {
      syntax: "@listens eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["event", "fires"],
    isDeprecated: false,
    example: "/** @listens MyClass#event:change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access event tag metadata)
 *
 * ```ts
 * import { JSDocEvent } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocEvent.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocEvent extends S.Opaque<JSDocEvent & JSDocTagMember<"event">>()(
  JSDocTagDefinition.make("event", {
    synonyms: [],
    overview: "Document an event.",
    tagKind: "block",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["event"],
    astDerivable: "none",
    astDerivableNote:
      "Events are typically defined by convention (string constants), not as AST declarations. Some frameworks encode them in types.",
    parameters: {
      syntax: "@event ClassName#eventName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["fires", "listens", "eventProperty"],
    isDeprecated: false,
    example: "/** @event MyClass#change */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access requires tag metadata)
 *
 * ```ts
 * import { JSDocRequires } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocRequires.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocRequires extends S.Opaque<JSDocRequires & JSDocTagMember<"requires">>()(
  JSDocTagDefinition.make("requires", {
    synonyms: [],
    overview: "This file requires a JavaScript module.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["file", "module"],
    astDerivable: "partial",
    astDerivableNote:
      "Dependency edges are derivable, but documentation-level requirement curation is partially semantic.",
    parameters: {
      syntax: "@requires moduleName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["module", "exports"],
    isDeprecated: false,
    example: "/** @requires lodash */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access event dependency metadata)
 *
 * ```ts
 * import { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = EventDependencyJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EventDependencyJSDoc = S.Union([JSDocFires, JSDocListens, JSDocEvent, JSDocRequires]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("EventDependencyJSDoc")
);

/**
 * Runtime type for {@link EventDependencyJSDoc}.
 *
 * **Example** (Extract event dependency tag)
 *
 * ```ts
 * import type { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: EventDependencyJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EventDependencyJSDoc = typeof EventDependencyJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read event dependency metadata)
 *
 * ```ts
 * import { EventDependencyJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = EventDependencyJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace EventDependencyJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = EventDependencyJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof EventDependencyJSDoc.Encoded;
}

// Remaining JSDoc tags

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access alias tag metadata)
 *
 * ```ts
 * import { JSDocAlias } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocAlias.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocAlias extends S.Opaque<JSDocAlias & JSDocTagMember<"alias">>()(
  JSDocTagDefinition.make("alias", {
    synonyms: [],
    overview: "Treat a member as if it had a different name.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Aliasing is a documentation choice, not structural.",
    parameters: {
      syntax: "@alias name",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["name", "memberof"],
    isDeprecated: false,
    example: "/** @alias RealName */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access borrows tag metadata)
 *
 * ```ts
 * import { JSDocBorrows } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocBorrows.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocBorrows extends S.Opaque<JSDocBorrows & JSDocTagMember<"borrows">>()(
  JSDocTagDefinition.make("borrows", {
    synonyms: [],
    overview: "This object uses something from another object.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Borrowing is a documentation-level concept.",
    parameters: {
      syntax: "@borrows other as local",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["mixes", "mixin"],
    isDeprecated: false,
    example: "/** @borrows other.method as myMethod */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access classdesc tag metadata)
 *
 * ```ts
 * import { JSDocClassDesc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocClassDesc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocClassDesc extends S.Opaque<JSDocClassDesc & JSDocTagMember<"classdesc">>()(
  JSDocTagDefinition.make("classdesc", {
    synonyms: [],
    overview: "Use the following text to describe the entire class.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["class"],
    astDerivable: "none",
    astDerivableNote: "Class descriptions are human-authored.",
    parameters: {
      syntax: "@classdesc text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["class", "description"],
    isDeprecated: false,
    example: "/** @classdesc A persistent key-value store */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access constructs tag metadata)
 *
 * ```ts
 * import { JSDocConstructs } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocConstructs.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocConstructs extends S.Opaque<JSDocConstructs & JSDocTagMember<"constructs">>()(
  JSDocTagDefinition.make("constructs", {
    synonyms: [],
    overview: "This function member will be the constructor for the previous class (used with @lends).",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["function"],
    astDerivable: "none",
    astDerivableNote: "Used in object literal patterns with @lends, which is a JSDoc-specific pattern.",
    parameters: {
      syntax: "@constructs [name]",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["class", "lends"],
    isDeprecated: false,
    example: "/** @constructs MyClass */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access copyright tag metadata)
 *
 * ```ts
 * import { JSDocCopyright } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocCopyright.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocCopyright extends S.Opaque<JSDocCopyright & JSDocTagMember<"copyright">>()(
  JSDocTagDefinition.make("copyright", {
    synonyms: [],
    overview: "Document some copyright information.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "Legal metadata, not in AST.",
    parameters: {
      syntax: "@copyright text",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["license", "author"],
    isDeprecated: false,
    example: "/** @copyright 2025 Acme Inc. */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access license tag metadata)
 *
 * ```ts
 * import { JSDocLicense } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocLicense.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocLicense extends S.Opaque<JSDocLicense & JSDocTagMember<"license">>()(
  JSDocTagDefinition.make("license", {
    synonyms: [],
    overview: "Identify the license that applies to this code.",
    tagKind: "block",
    specifications: ["jsdoc3", "closure", "typedoc"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "License metadata not in AST. Could derive from package.json license field.",
    parameters: {
      syntax: "@license identifier",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["copyright", "author"],
    isDeprecated: false,
    example: "/** @license MIT */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access external tag metadata)
 *
 * ```ts
 * import { JSDocExternal } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExternal.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExternal extends S.Opaque<JSDocExternal & JSDocTagMember<"external">>()(
  JSDocTagDefinition.make("external", {
    synonyms: ["host"],
    overview: "Identifies an external class, namespace, or module not in the current codebase.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "partial",
    astDerivableNote: "External dependencies detectable from import declarations pointing to node_modules.",
    parameters: {
      syntax: "@external Name",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: true,
    },
    relatedTags: ["requires", "module"],
    isDeprecated: false,
    example: "/** @external jQuery */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access file tag metadata)
 *
 * ```ts
 * import { JSDocFile } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocFile.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocFile extends S.Opaque<JSDocFile & JSDocTagMember<"file">>()(
  JSDocTagDefinition.make("file", {
    synonyms: ["fileoverview", "overview"],
    overview: "Describe a file. Placed at the top of the file.",
    tagKind: "block",
    specifications: ["jsdoc3", "closure"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "File-level descriptions require human authoring or LLM generation.",
    parameters: {
      syntax: "@file description",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["module", "packageDocumentation", "copyright"],
    isDeprecated: false,
    example: "/** @file Utility functions for string manipulation */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access global tag metadata)
 *
 * ```ts
 * import { JSDocGlobal } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocGlobal.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocGlobal extends S.Opaque<JSDocGlobal & JSDocTagMember<"global">>()(
  JSDocTagDefinition.make("global", {
    synonyms: [],
    overview: "Document a global object.",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["variable", "function", "class"],
    astDerivable: "partial",
    astDerivableNote: "Global scope is structurally detectable, but documentation-level global intent can be semantic.",
    parameters: {
      syntax: "@global",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["inner", "instance", "static"],
    isDeprecated: false,
    example: "/** @global */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access hideconstructor tag metadata)
 *
 * ```ts
 * import { JSDocHideConstructor } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocHideConstructor.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocHideConstructor extends S.Opaque<JSDocHideConstructor & JSDocTagMember<"hideconstructor">>()(
  JSDocTagDefinition.make("hideconstructor", {
    synonyms: [],
    overview: "Indicate that the constructor should not be displayed in documentation.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["class"],
    astDerivable: "none",
    astDerivableNote: "Hide-constructor behavior is a documentation rendering decision.",
    parameters: {
      syntax: "@hideconstructor",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["class", "private"],
    isDeprecated: false,
    example: "/** @hideconstructor */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access ignore tag metadata)
 *
 * ```ts
 * import { JSDocIgnore } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocIgnore.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocIgnore extends S.Opaque<JSDocIgnore & JSDocTagMember<"ignore">>()(
  JSDocTagDefinition.make("ignore", {
    synonyms: [],
    overview: "Omit a symbol from the documentation.",
    tagKind: "modifier",
    specifications: ["jsdoc3", "typedoc"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "A documentation choice, not structural.",
    parameters: {
      syntax: "@ignore",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["internal", "private"],
    isDeprecated: false,
    example: "/** @ignore */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access inner tag metadata)
 *
 * ```ts
 * import { JSDocInner } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInner.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInner extends S.Opaque<JSDocInner & JSDocTagMember<"inner">>()(
  JSDocTagDefinition.make("inner", {
    synonyms: [],
    overview: "Document an inner object (contained within another, not on its prototype).",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "partial",
    astDerivableNote:
      "Inner/member placement is mostly structural but documentation-level classification may be semantic.",
    parameters: {
      syntax: "@inner",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["instance", "static", "global", "memberof"],
    isDeprecated: false,
    example: "/** @inner */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access instance tag metadata)
 *
 * ```ts
 * import { JSDocInstance } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocInstance.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocInstance extends S.Opaque<JSDocInstance & JSDocTagMember<"instance">>()(
  JSDocTagDefinition.make("instance", {
    synonyms: [],
    overview: "Document an instance member (as opposed to static).",
    tagKind: "modifier",
    specifications: ["jsdoc3"],
    applicableTo: ["method", "property"],
    astDerivable: "partial",
    astDerivableNote: "Instance/static shape is structural, but documentation intent is partially semantic.",
    parameters: {
      syntax: "@instance",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["static", "inner", "memberof"],
    isDeprecated: false,
    example: "/** @instance */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access kind tag metadata)
 *
 * ```ts
 * import { JSDocKind } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocKind.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocKind extends S.Opaque<JSDocKind & JSDocTagMember<"kind">>()(
  JSDocTagDefinition.make("kind", {
    synonyms: [],
    overview: "What kind of symbol is this? (class, function, module, etc.)",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "partial",
    astDerivableNote:
      "Syntax kind is structural, but reported documentation kind can involve conventions and presentation policy.",
    parameters: {
      syntax: "@kind kindValue",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
      allowedValues: [
        "class",
        "constant",
        "event",
        "external",
        "file",
        "function",
        "member",
        "mixin",
        "module",
        "namespace",
        "typedef",
      ],
    },
    relatedTags: ["class", "function", "module", "namespace"],
    isDeprecated: false,
    example: "/** @kind function */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access lends tag metadata)
 *
 * ```ts
 * import { JSDocLends } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocLends.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocLends extends S.Opaque<JSDocLends & JSDocTagMember<"lends">>()(
  JSDocTagDefinition.make("lends", {
    synonyms: [],
    overview: "Document properties on an object literal as if they belonged to a symbol with a given name.",
    tagKind: "block",
    specifications: ["jsdoc3", "closure"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "A JSDoc documentation pattern, not structural in TypeScript.",
    parameters: {
      syntax: "@lends namepath",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["constructs", "borrows"],
    isDeprecated: false,
    example: "/** @lends MyClass.prototype */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access mixin tag metadata)
 *
 * ```ts
 * import { JSDocMixin } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocMixin.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMixin extends S.Opaque<JSDocMixin & JSDocTagMember<"mixin">>()(
  JSDocTagDefinition.make("mixin", {
    synonyms: [],
    overview: "Document a mixin object.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["mixin", "variable"],
    astDerivable: "none",
    astDerivableNote:
      "Mixin pattern is a design choice. TypeScript can represent it but doesn't have a mixin AST node.",
    parameters: {
      syntax: "@mixin [name]",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["mixes"],
    isDeprecated: false,
    example: "/** @mixin */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access mixes tag metadata)
 *
 * ```ts
 * import { JSDocMixes } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocMixes.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocMixes extends S.Opaque<JSDocMixes & JSDocTagMember<"mixes">>()(
  JSDocTagDefinition.make("mixes", {
    synonyms: [],
    overview: "This object mixes in all the members from another object.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["class", "variable"],
    astDerivable: "none",
    astDerivableNote: "Mixin application is a design pattern, not a structural relationship in TS.",
    parameters: {
      syntax: "@mixes OtherObject",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["mixin"],
    isDeprecated: false,
    example: "/** @mixes EventEmitter */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access name tag metadata)
 *
 * ```ts
 * import { JSDocName } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocName.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocName extends S.Opaque<JSDocName & JSDocTagMember<"name">>()(
  JSDocTagDefinition.make("name", {
    synonyms: [],
    overview: "Document the name of an object. Overrides the auto-detected name.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "This tag is an explicit documentation override, not a deterministic AST derivation.",
    parameters: {
      syntax: "@name symbolName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["alias"],
    isDeprecated: false,
    example: "/** @name MyRealName */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access variation tag metadata)
 *
 * ```ts
 * import { JSDocVariation } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocVariation.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocVariation extends S.Opaque<JSDocVariation & JSDocTagMember<"variation">>()(
  JSDocTagDefinition.make("variation", {
    synonyms: [],
    overview: "Distinguish different objects with the same name (e.g., overloads).",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Variation numbering is a documentation convention, not deterministic AST output.",
    parameters: {
      syntax: "@variation number",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["name", "alias"],
    isDeprecated: false,
    example: "/** @variation 2 */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access tutorial tag metadata)
 *
 * ```ts
 * import { JSDocTutorial } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTutorial.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocTutorial extends S.Opaque<JSDocTutorial & JSDocTagMember<"tutorial">>()(
  JSDocTagDefinition.make("tutorial", {
    synonyms: [],
    overview: "Insert a link to an included tutorial file. Also exists as inline tag.",
    tagKind: "block",
    specifications: ["jsdoc3"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Tutorial references are documentation infrastructure, not code structure.",
    parameters: {
      syntax: "@tutorial tutorialName",
      acceptsType: false,
      acceptsName: true,
      acceptsDescription: false,
    },
    relatedTags: ["see", "link", "example"],
    isDeprecated: false,
    example: "/** @tutorial getting-started */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access remaining tag metadata)
 *
 * ```ts
 * import { RemainingJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = RemainingJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RemainingJSDoc = S.Union([
  JSDocAlias,
  JSDocBorrows,
  JSDocClassDesc,
  JSDocConstructs,
  JSDocCopyright,
  JSDocLicense,
  JSDocExternal,
  JSDocFile,
  JSDocGlobal,
  JSDocHideConstructor,
  JSDocIgnore,
  JSDocInner,
  JSDocInstance,
  JSDocKind,
  JSDocLends,
  JSDocMixin,
  JSDocMixes,
  JSDocName,
  JSDocVariation,
  JSDocTutorial,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("RemainingJSDoc"));

/**
 * Runtime type for {@link RemainingJSDoc}.
 *
 * **Example** (Extract remaining tag name)
 *
 * ```ts
 * import type { RemainingJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: RemainingJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type RemainingJSDoc = typeof RemainingJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read remaining tag metadata)
 *
 * ```ts
 * import { RemainingJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = RemainingJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RemainingJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = RemainingJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RemainingJSDoc.Encoded;
}

// Google Closure-specific tags

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access define tag metadata)
 *
 * ```ts
 * import { JSDocDefine } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDefine.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDefine extends S.Opaque<JSDocDefine & JSDocTagMember<"define">>()(
  JSDocTagDefinition.make("define", {
    synonyms: [],
    overview: "Closure: compile-time constant controlled by compiler defines.",
    tagKind: "block",
    specifications: ["closure"],
    applicableTo: ["variable", "constant"],
    astDerivable: "partial",
    astDerivableNote: "Const declarations are structural, but define-level semantics are compiler-policy metadata.",
    parameters: {
      syntax: "@define {Type} description",
      acceptsType: true,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["constant", "type"],
    isDeprecated: false,
    example: "/** @define {boolean} */\nconst ENABLE_LOGS = false;",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access dict tag metadata)
 *
 * ```ts
 * import { JSDocDict } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocDict.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocDict extends S.Opaque<JSDocDict & JSDocTagMember<"dict">>()(
  JSDocTagDefinition.make("dict", {
    synonyms: [],
    overview: "Closure: marks an object/class as dictionary-like (bracket access semantics).",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class", "typeAlias", "variable"],
    astDerivable: "none",
    astDerivableNote: "This is a compiler contract and cannot be inferred reliably from general AST shape.",
    parameters: {
      syntax: "@dict",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["struct", "unrestricted"],
    isDeprecated: false,
    example: "/** @dict */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access implicitcast tag metadata)
 *
 * ```ts
 * import { JSDocImplicitCast } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocImplicitCast.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocImplicitCast extends S.Opaque<JSDocImplicitCast & JSDocTagMember<"implicitCast">>()(
  JSDocTagDefinition.make("implicitCast", {
    synonyms: [],
    overview: "Closure: allows assignment with implicit type coercion for selected extern-style properties.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["property", "variable"],
    astDerivable: "none",
    astDerivableNote: "Implicit-cast allowance is compiler annotation policy and not deducible from syntax alone.",
    parameters: {
      syntax: "@implicitCast",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["type", "externs"],
    isDeprecated: false,
    example: "/** @implicitCast */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access struct tag metadata)
 *
 * ```ts
 * import { JSDocStruct } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocStruct.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocStruct extends S.Opaque<JSDocStruct & JSDocTagMember<"struct">>()(
  JSDocTagDefinition.make("struct", {
    synonyms: [],
    overview: "Closure: marks an object/class as fixed-structure (dot-access-only semantics).",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class", "typeAlias", "variable"],
    astDerivable: "none",
    astDerivableNote: "This is a compiler contract and not deterministic from syntax alone.",
    parameters: {
      syntax: "@struct",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["dict", "unrestricted"],
    isDeprecated: false,
    example: "/** @struct */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access unrestricted tag metadata)
 *
 * ```ts
 * import { JSDocUnrestricted } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocUnrestricted.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocUnrestricted extends S.Opaque<JSDocUnrestricted & JSDocTagMember<"unrestricted">>()(
  JSDocTagDefinition.make("unrestricted", {
    synonyms: [],
    overview: "Closure: explicitly marks a class as neither @struct nor @dict.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class"],
    astDerivable: "none",
    astDerivableNote: "Unrestricted is an explicit annotation decision in Closure-style code.",
    parameters: {
      syntax: "@unrestricted",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["dict", "struct"],
    isDeprecated: false,
    example: "/** @unrestricted */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access suppress tag metadata)
 *
 * ```ts
 * import { JSDocSuppress } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocSuppress.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocSuppress extends S.Opaque<JSDocSuppress & JSDocTagMember<"suppress">>()(
  JSDocTagDefinition.make("suppress", {
    synonyms: [],
    overview: "Closure: suppress selected compiler warning groups.",
    tagKind: "block",
    specifications: ["closure"],
    applicableTo: ["any"],
    astDerivable: "none",
    astDerivableNote: "Suppression intent is external policy metadata.",
    parameters: {
      syntax: "@suppress {warningGroup1,warningGroup2}",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: true,
    },
    relatedTags: ["ignore", "internal"],
    isDeprecated: false,
    example: "/** @suppress {checkTypes} */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access externs tag metadata)
 *
 * ```ts
 * import { JSDocExterns } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocExterns.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocExterns extends S.Opaque<JSDocExterns & JSDocTagMember<"externs">>()(
  JSDocTagDefinition.make("externs", {
    synonyms: [],
    overview: "Closure: indicates an externs file definition boundary.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "Externs boundary is documentation/compiler configuration metadata.",
    parameters: {
      syntax: "@externs",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["file", "module"],
    isDeprecated: false,
    example: "/** @externs */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access noalias tag metadata)
 *
 * ```ts
 * import { JSDocNoAlias } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNoAlias.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNoAlias extends S.Opaque<JSDocNoAlias & JSDocTagMember<"noalias">>()(
  JSDocTagDefinition.make("noalias", {
    synonyms: [],
    overview: "Closure: disable aliasing transformations for a file.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "Alias-control behavior is compiler optimization policy metadata.",
    parameters: {
      syntax: "@noalias",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["nocompile", "nocollapse"],
    isDeprecated: false,
    example: "/** @noalias */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access nocompile tag metadata)
 *
 * ```ts
 * import { JSDocNoCompile } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNoCompile.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNoCompile extends S.Opaque<JSDocNoCompile & JSDocTagMember<"nocompile">>()(
  JSDocTagDefinition.make("nocompile", {
    synonyms: [],
    overview: "Closure: parse a file but do not compile it.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["file"],
    astDerivable: "none",
    astDerivableNote: "Compilation inclusion/exclusion is build policy metadata and not AST-derivable.",
    parameters: {
      syntax: "@nocompile",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["externs", "noalias"],
    isDeprecated: false,
    example: "/** @nocompile */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access nosideeffects tag metadata)
 *
 * ```ts
 * import { JSDocNoSideEffects } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNoSideEffects.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNoSideEffects extends S.Opaque<JSDocNoSideEffects & JSDocTagMember<"nosideeffects">>()(
  JSDocTagDefinition.make("nosideeffects", {
    synonyms: [],
    overview: "Closure: indicates calls are free of observable side effects for optimization.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Purity guarantees are semantic and not deterministically inferable in general.",
    parameters: {
      syntax: "@nosideeffects",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["suppress"],
    isDeprecated: false,
    example: "/** @nosideeffects */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access polymer tag metadata)
 *
 * ```ts
 * import { JSDocPolymer } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPolymer.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPolymer extends S.Opaque<JSDocPolymer & JSDocTagMember<"polymer">>()(
  JSDocTagDefinition.make("polymer", {
    synonyms: [],
    overview: "Closure: marks Polymer element declarations.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["class", "mixin"],
    astDerivable: "none",
    astDerivableNote: "Framework-level semantics are not deterministic from AST shape alone.",
    parameters: {
      syntax: "@polymer",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["polymerBehavior"],
    isDeprecated: false,
    example: "/** @polymer */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access polymerbehavior tag metadata)
 *
 * ```ts
 * import { JSDocPolymerBehavior } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocPolymerBehavior.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocPolymerBehavior extends S.Opaque<JSDocPolymerBehavior & JSDocTagMember<"polymerBehavior">>()(
  JSDocTagDefinition.make("polymerBehavior", {
    synonyms: [],
    overview: "Closure: marks Polymer behavior objects.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["mixin", "variable"],
    astDerivable: "none",
    astDerivableNote: "Framework behavior semantics are not deterministically derivable.",
    parameters: {
      syntax: "@polymerBehavior",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["polymer", "mixin"],
    isDeprecated: false,
    example: "/** @polymerBehavior */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access record tag metadata)
 *
 * ```ts
 * import { JSDocRecord } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocRecord.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocRecord extends S.Opaque<JSDocRecord & JSDocTagMember<"record">>()(
  JSDocTagDefinition.make("record", {
    synonyms: [],
    overview: "Closure: structural interface-like contract annotation.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["interface", "typeAlias", "class"],
    astDerivable: "partial",
    astDerivableNote: "Structural shape can be analyzed, but record-tag intent is explicit annotation metadata.",
    parameters: {
      syntax: "@record",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["interface", "typedef"],
    isDeprecated: false,
    example: "/** @record */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access nocollapse tag metadata)
 *
 * ```ts
 * import { JSDocNoCollapse } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNoCollapse.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNoCollapse extends S.Opaque<JSDocNoCollapse & JSDocTagMember<"nocollapse">>()(
  JSDocTagDefinition.make("nocollapse", {
    synonyms: [],
    overview: "Closure: prevents property collapsing during advanced optimization.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["property", "variable", "module"],
    astDerivable: "none",
    astDerivableNote: "Optimization directives are compiler-policy metadata, not syntax-derived semantics.",
    parameters: {
      syntax: "@nocollapse",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["suppress", "externs"],
    isDeprecated: false,
    example: "/** @nocollapse */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access noinline tag metadata)
 *
 * ```ts
 * import { JSDocNoInline } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocNoInline.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class JSDocNoInline extends S.Opaque<JSDocNoInline & JSDocTagMember<"noinline">>()(
  JSDocTagDefinition.make("noinline", {
    synonyms: [],
    overview: "Closure: prevent inlining of the annotated function.",
    tagKind: "modifier",
    specifications: ["closure"],
    applicableTo: ["function", "method"],
    astDerivable: "none",
    astDerivableNote: "Inlining policy is compiler optimization metadata and not structural AST semantics.",
    parameters: {
      syntax: "@noinline",
      acceptsType: false,
      acceptsName: false,
      acceptsDescription: false,
    },
    relatedTags: ["nosideeffects", "nocollapse"],
    isDeprecated: false,
    example: "/** @noinline */",
  })
) {}

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access Closure-specific tag metadata)
 *
 * ```ts
 * import { ClosureSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = ClosureSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClosureSpecificJSDoc = S.Union([
  JSDocDefine,
  JSDocDict,
  JSDocImplicitCast,
  JSDocStruct,
  JSDocUnrestricted,
  JSDocSuppress,
  JSDocExterns,
  JSDocNoAlias,
  JSDocNoCompile,
  JSDocNoSideEffects,
  JSDocPolymer,
  JSDocPolymerBehavior,
  JSDocRecord,
  JSDocNoCollapse,
  JSDocNoInline,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("ClosureSpecificJSDoc"));

/**
 * Runtime type for {@link ClosureSpecificJSDoc}.
 *
 * **Example** (Extract Closure-specific tag name)
 *
 * ```ts
 * import type { ClosureSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: ClosureSpecificJSDoc): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ClosureSpecificJSDoc = typeof ClosureSpecificJSDoc.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read Closure-specific tag metadata)
 *
 * ```ts
 * import { ClosureSpecificJSDoc } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = ClosureSpecificJSDoc.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace ClosureSpecificJSDoc {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = ClosureSpecificJSDoc;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof ClosureSpecificJSDoc.Encoded;
}

// TypeDoc-specific tags

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
export class JSDocCategory extends S.Opaque<JSDocCategory & JSDocTagMember<"category">>()(
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
export class JSDocDocument extends S.Opaque<JSDocDocument & JSDocTagMember<"document">>()(
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
export class JSDocGroup extends S.Opaque<JSDocGroup & JSDocTagMember<"group">>()(
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
export class JSDocHidden extends S.Opaque<JSDocHidden & JSDocTagMember<"hidden">>()(
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
export class JSDocExpand extends S.Opaque<JSDocExpand & JSDocTagMember<"expand">>()(
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
export class JSDocInline extends S.Opaque<JSDocInline & JSDocTagMember<"inline">>()(
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
export class JSDocMergeModuleWith extends S.Opaque<JSDocMergeModuleWith & JSDocTagMember<"mergeModuleWith">>()(
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
export class JSDocPrimaryExport extends S.Opaque<JSDocPrimaryExport & JSDocTagMember<"primaryExport">>()(
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
export class JSDocSortStrategy extends S.Opaque<JSDocSortStrategy & JSDocTagMember<"sortStrategy">>()(
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
export class JSDocUseDeclaredType extends S.Opaque<JSDocUseDeclaredType & JSDocTagMember<"useDeclaredType">>()(
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

// TypeScript-specific tags

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
export class JSDocOverload extends S.Opaque<JSDocOverload & JSDocTagMember<"overload">>()(
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

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Access JSDocTag union metadata)
 *
 * ```ts
 * import { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTag.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const JSDocTag = S.Union([
  StructuralJSDoc,
  AccessModifierJSDoc,
  DocumentationContentJSDoc,
  TSDocSpecificJSDoc,
  InlineJSDoc,
  OrganizationalJSDoc,
  EventDependencyJSDoc,
  RemainingJSDoc,
  ClosureSpecificJSDoc,
  TypeDocSpecificJSDoc,
  TypeScriptSpecificJSDoc,
]).pipe(S.toTaggedUnion("_tag"), $I.annoteSchema("JSDocTag"));

/**
 * Runtime type for {@link JSDocTag}.
 *
 * **Example** (Extract JSDocTag union name)
 *
 * ```ts
 * import type { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const tagName = (tag: JSDocTag): string => tag._tag
 * console.log(typeof tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type JSDocTag = typeof JSDocTag.Type;

/**
 * JSDoc tag metadata export.
 *
 * **Example** (Read JSDocTag union metadata)
 *
 * ```ts
 * import { JSDocTag } from "@beep/repo-utils/JSDoc/JSDoc"
 *
 * const metadata = JSDocTag.ast.annotations?.jsDocTagMetadata
 * console.log(metadata?._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace JSDocTag {
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Type = JSDocTag;
  /**
   * JSDoc tag metadata export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof JSDocTag.Encoded;
}
