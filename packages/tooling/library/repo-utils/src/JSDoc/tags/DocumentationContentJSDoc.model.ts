/**
 * DocumentationContentJSDoc tag metadata catalog: Documentation content tags — human-authored narrative metadata.
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
export class JSDocDescription extends S.Opaque<
  JSDocDescription & JSDocTagMember<"description">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocSummary extends S.Opaque<
  JSDocSummary & JSDocTagMember<"summary">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocRemarks extends S.Opaque<
  JSDocRemarks & JSDocTagMember<"remarks">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocExample extends S.Opaque<
  JSDocExample & JSDocTagMember<"example">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocDeprecated extends S.Opaque<
  JSDocDeprecated & JSDocTagMember<"deprecated">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocSee extends S.Opaque<JSDocSee & JSDocTagMember<"see">, { readonly brand: unique symbol }>()(
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
export class JSDocSince extends S.Opaque<JSDocSince & JSDocTagMember<"since">, { readonly brand: unique symbol }>()(
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
export class JSDocVersion extends S.Opaque<
  JSDocVersion & JSDocTagMember<"version">,
  { readonly brand: unique symbol }
>()(
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
export class JSDocAuthor extends S.Opaque<JSDocAuthor & JSDocTagMember<"author">, { readonly brand: unique symbol }>()(
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
export class JSDocTodo extends S.Opaque<JSDocTodo & JSDocTagMember<"todo">, { readonly brand: unique symbol }>()(
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
