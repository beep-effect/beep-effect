/**
 * RemainingJSDoc tag metadata catalog: Remaining JSDoc tags.
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
export class JSDocAlias extends S.Opaque<JSDocAlias & JSDocTagMember<"alias">, { readonly brand: unique symbol }>()(
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
export class JSDocBorrows extends S.Opaque<
  JSDocBorrows & JSDocTagMember<"borrows">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocClassDesc extends S.Opaque<
  JSDocClassDesc & JSDocTagMember<"classdesc">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocConstructs extends S.Opaque<
  JSDocConstructs & JSDocTagMember<"constructs">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocCopyright extends S.Opaque<
  JSDocCopyright & JSDocTagMember<"copyright">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocLicense extends S.Opaque<
  JSDocLicense & JSDocTagMember<"license">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocExternal extends S.Opaque<
  JSDocExternal & JSDocTagMember<"external">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocFile extends S.Opaque<JSDocFile & JSDocTagMember<"file">, { readonly brand: unique symbol }>()(
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
export class JSDocGlobal extends S.Opaque<JSDocGlobal & JSDocTagMember<"global">, { readonly brand: unique symbol }>()(
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
export class JSDocHideConstructor extends S.Opaque<
  JSDocHideConstructor & JSDocTagMember<"hideconstructor">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocIgnore extends S.Opaque<JSDocIgnore & JSDocTagMember<"ignore">, { readonly brand: unique symbol }>()(
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
export class JSDocInner extends S.Opaque<JSDocInner & JSDocTagMember<"inner">, { readonly brand: unique symbol }>()(
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
export class JSDocInstance extends S.Opaque<
  JSDocInstance & JSDocTagMember<"instance">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocKind extends S.Opaque<JSDocKind & JSDocTagMember<"kind">, { readonly brand: unique symbol }>()(
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
export class JSDocLends extends S.Opaque<JSDocLends & JSDocTagMember<"lends">, { readonly brand: unique symbol }>()(
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
export class JSDocMixin extends S.Opaque<JSDocMixin & JSDocTagMember<"mixin">, { readonly brand: unique symbol }>()(
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
export class JSDocMixes extends S.Opaque<JSDocMixes & JSDocTagMember<"mixes">, { readonly brand: unique symbol }>()(
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
export class JSDocName extends S.Opaque<JSDocName & JSDocTagMember<"name">, { readonly brand: unique symbol }>()(
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
export class JSDocVariation extends S.Opaque<
  JSDocVariation & JSDocTagMember<"variation">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocTutorial extends S.Opaque<
  JSDocTutorial & JSDocTagMember<"tutorial">,
  { readonly brand: unique symbol }
>()(
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
