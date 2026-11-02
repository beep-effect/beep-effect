/**
 * ClosureSpecificJSDoc tag metadata catalog: Google Closure-specific tags.
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
export class JSDocDefine extends S.Opaque<JSDocDefine & JSDocTagMember<"define">, { readonly brand: unique symbol }>()(
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
export class JSDocDict extends S.Opaque<JSDocDict & JSDocTagMember<"dict">, { readonly brand: unique symbol }>()(
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
export class JSDocImplicitCast extends S.Opaque<
  JSDocImplicitCast & JSDocTagMember<"implicitCast">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocStruct extends S.Opaque<JSDocStruct & JSDocTagMember<"struct">, { readonly brand: unique symbol }>()(
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
export class JSDocUnrestricted extends S.Opaque<
  JSDocUnrestricted & JSDocTagMember<"unrestricted">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocSuppress extends S.Opaque<
  JSDocSuppress & JSDocTagMember<"suppress">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocExterns extends S.Opaque<
  JSDocExterns & JSDocTagMember<"externs">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocNoAlias extends S.Opaque<
  JSDocNoAlias & JSDocTagMember<"noalias">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocNoCompile extends S.Opaque<
  JSDocNoCompile & JSDocTagMember<"nocompile">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocNoSideEffects extends S.Opaque<
  JSDocNoSideEffects & JSDocTagMember<"nosideeffects">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocPolymer extends S.Opaque<
  JSDocPolymer & JSDocTagMember<"polymer">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocPolymerBehavior extends S.Opaque<
  JSDocPolymerBehavior & JSDocTagMember<"polymerBehavior">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocRecord extends S.Opaque<JSDocRecord & JSDocTagMember<"record">, { readonly brand: unique symbol }>()(
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
export class JSDocNoCollapse extends S.Opaque<
  JSDocNoCollapse & JSDocTagMember<"nocollapse">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocNoInline extends S.Opaque<
  JSDocNoInline & JSDocTagMember<"noinline">,
  { readonly brand: unique symbol }
>()(
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
