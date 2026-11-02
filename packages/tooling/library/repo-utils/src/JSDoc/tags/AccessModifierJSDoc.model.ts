/**
 * AccessModifierJSDoc tag metadata catalog: Access modifiers — all fully in AST modifier flags.
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
export class JSDocAccess extends S.Opaque<JSDocAccess & JSDocTagMember<"access">, { readonly brand: unique symbol }>()(
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
export class JSDocPublic extends S.Opaque<JSDocPublic & JSDocTagMember<"public">, { readonly brand: unique symbol }>()(
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
export class JSDocPrivate extends S.Opaque<
  JSDocPrivate & JSDocTagMember<"private">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocProtected extends S.Opaque<
  JSDocProtected & JSDocTagMember<"protected">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocPackage extends S.Opaque<
  JSDocPackage & JSDocTagMember<"package">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocReadonly extends S.Opaque<
  JSDocReadonly & JSDocTagMember<"readonly">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocAbstract extends S.Opaque<
  JSDocAbstract & JSDocTagMember<"abstract">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocFinal extends S.Opaque<JSDocFinal & JSDocTagMember<"final">, { readonly brand: unique symbol }>()(
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
export class JSDocOverride extends S.Opaque<
  JSDocOverride & JSDocTagMember<"override">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocStatic extends S.Opaque<JSDocStatic & JSDocTagMember<"static">, { readonly brand: unique symbol }>()(
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
export class JSDocConstant extends S.Opaque<
  JSDocConstant & JSDocTagMember<"constant">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocDefault extends S.Opaque<
  JSDocDefault & JSDocTagMember<"default">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocDefaultValue extends S.Opaque<
  JSDocDefaultValue & JSDocTagMember<"defaultValue">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocExports extends S.Opaque<
  JSDocExports & JSDocTagMember<"exports">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocExport extends S.Opaque<JSDocExport & JSDocTagMember<"export">, { readonly brand: unique symbol }>()(
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
export class JSDocSatisfies extends S.Opaque<
  JSDocSatisfies & JSDocTagMember<"satisfies">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocImport extends S.Opaque<JSDocImport & JSDocTagMember<"import">, { readonly brand: unique symbol }>()(
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
export class JSDocThis extends S.Opaque<JSDocThis & JSDocTagMember<"this">, { readonly brand: unique symbol }>()(
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
