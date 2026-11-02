/**
 * TSDocSpecificJSDoc tag metadata catalog: TSDoc-specific tags — release management and documentation structure.
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
export class JSDocAlpha extends S.Opaque<JSDocAlpha & JSDocTagMember<"alpha">, { readonly brand: unique symbol }>()(
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
export class JSDocBeta extends S.Opaque<JSDocBeta & JSDocTagMember<"beta">, { readonly brand: unique symbol }>()(
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
export class JSDocExperimental extends S.Opaque<
  JSDocExperimental & JSDocTagMember<"experimental">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocInternal extends S.Opaque<
  JSDocInternal & JSDocTagMember<"internal">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocSealed extends S.Opaque<JSDocSealed & JSDocTagMember<"sealed">, { readonly brand: unique symbol }>()(
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
export class JSDocVirtual extends S.Opaque<
  JSDocVirtual & JSDocTagMember<"virtual">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocPrivateRemarks extends S.Opaque<
  JSDocPrivateRemarks & JSDocTagMember<"privateRemarks">,
  { readonly brand: unique symbol }
>()(
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
  JSDocPackageDocumentation & JSDocTagMember<"packageDocumentation">,
  { readonly brand: unique symbol }
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
export class JSDocLabel extends S.Opaque<JSDocLabel & JSDocTagMember<"label">, { readonly brand: unique symbol }>()(
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
export class JSDocDecorator extends S.Opaque<
  JSDocDecorator & JSDocTagMember<"decorator">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocEventProperty extends S.Opaque<
  JSDocEventProperty & JSDocTagMember<"eventProperty">,
  { readonly brand: unique symbol }
>()(
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
