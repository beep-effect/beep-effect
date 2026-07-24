/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { ArrayOfStrings } from "@beep/schema";
import { Effect, Result, SchemaGetter } from "effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
/* cspell:ignore Derivability derivability */
import { ApplicableTo } from "./ApplicableTo.model.ts";
import { ASTDerivability } from "./ASTDerivability.model.ts";
import "./JSDocTagAnnotation.model.ts";
import { Specification } from "./Specification.model.ts";
import { TagKind } from "./TagKind.model.ts";
import { TagParameters } from "./TagParameters.model.ts";
import { TagValue } from "./TagValue.model.ts";
import type { TagName } from "./TagValue.model.ts";

const $I = $RepoUtilsId.create("JSDoc/models/JSDocTagDefinition.model");

const defaultIsDeprecated = (): boolean => false;

/**
 * Complete metadata for a single JSDoc/TSDoc tag.
 * Designed as a discriminated union member via `_tag`.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { JSDocTagDefinition } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model"
 *
 * const definition = JSDocTagDefinition.make({
 *   _tag: "param",
 *   synonyms: [],
 *   overview: "Documents a function parameter.",
 *   tagKind: "block",
 *   specifications: ["tsdocCore"],
 *   applicableTo: ["function"],
 *   astDerivable: "partial",
 *   astDerivableNote: "Parameter names are AST-derived; prose is authored.",
 *   parameters: {
 *     syntax: "@param name - description",
 *     acceptsType: false,
 *     acceptsName: true,
 *     acceptsDescription: true,
 *     allowedValues: O.none()
 *   },
 *   relatedTags: ["typeParam"],
 *   isDeprecated: false,
 *   deprecatedNote: O.none(),
 *   example: "@param input - Raw input value."
 * })
 * console.log(definition._tag)
 * ```
 * @category models
 * @since 0.0.0
 */
export class JSDocTagDefinition extends S.Class<JSDocTagDefinition>($I`JSDocTagDefinition`)(
  {
    /** Canonical tag name without the at-sign prefix. Used as discriminant. */
    _tag: S.String.annotateKey({
      description: "Canonical tag name without '@' prefix. Used as discriminant.",
    }),
    /** Alternative names that resolve to this tag without the at-sign prefix. */
    synonyms: ArrayOfStrings.annotateKey({
      description: "Alternative names that resolve to this tag (without '@' prefix)",
    }),
    /** Human-readable description of what this tag does */
    overview: S.String.annotateKey({
      description: "Human-readable description of what this tag does",
    }),
    /** The syntactic kind: block, inline, or modifier */
    tagKind: TagKind.annotateKey({
      description: "The syntactic kind: block, inline, or modifier",
    }),
    /** Which specification(s) define this tag */
    specifications: S.Array(Specification).annotateKey({
      description: "Which specification(s) define this tag",
    }),
    /** What AST node types this tag can attach to */
    applicableTo: S.Array(ApplicableTo).annotateKey({
      description: "What AST node types this tag can attach to",
    }),
    /** Whether content can be derived from the TypeScript AST */
    astDerivable: ASTDerivability.annotateKey({
      description: "Whether content can be derived from the TypeScript AST",
    }),
    /** Explanation of AST derivability (especially for "partial") */
    astDerivableNote: S.String.annotateKey({
      description: "Explanation of AST derivability (especially for 'partial')",
    }),
    /** Structured parameter info */
    parameters: TagParameters.annotateKey({
      description: "Structured parameter info",
    }),
    /** Tags that are semantically related */
    relatedTags: ArrayOfStrings.annotateKey({
      description: "Tags that are semantically related",
    }),
    /** Whether this tag is deprecated in favor of another approach */
    isDeprecated: S.optional(S.Boolean)
      .pipe(
        S.decodeTo(S.toType(S.Boolean), {
          decode: SchemaGetter.withDefault(Effect.sync(defaultIsDeprecated)),
          encode: SchemaGetter.required(),
        })
      )
      .annotateKey({
        description: "Whether this tag is deprecated in favor of another approach",
      }),
    /** If deprecated, what replaces it */
    deprecatedNote: S.OptionFromOptionalKey(S.String).annotateKey({
      description: "If deprecated, what replaces it",
    }),
    /** Compact code example */
    example: S.String,
  },
  $I.annote("JSDocTagDefinition", {
    description: "Complete metadata for a single JSDoc/TSDoc tag",
    documentation: "Designed as a discriminated union member via `_tag`.",
  })
) {}

/**
 * JSDoc model export.
 *
 * @example
 * ```ts
 * import { JSDocTagDefinition } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model"
 *
 * const encoded: JSDocTagDefinition.Encoded = {
 *   _tag: "param",
 *   synonyms: [],
 *   overview: "Documents a function parameter.",
 *   tagKind: "block",
 *   specifications: ["tsdocCore"],
 *   applicableTo: ["function"],
 *   astDerivable: "partial",
 *   astDerivableNote: "Parameter names are AST-derived; prose is authored.",
 *   parameters: {
 *     syntax: "@param name - description",
 *     acceptsType: false,
 *     acceptsName: true,
 *     acceptsDescription: true
 *   },
 *   relatedTags: ["typeParam"],
 *   example: "@param input - Raw input value."
 * }
 * console.log(encoded._tag)
 * ```
 * @category models
 * @since 0.0.0
 */
export declare namespace JSDocTagDefinition {
  /**
   * JSDoc model export.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof JSDocTagDefinition.Encoded;
  /**
   * JSDoc model export.
   *
   * @category models
   * @since 0.0.0
   */
  export interface Instance<Tag extends TagName, Def extends Encoded> extends Encoded {
    _tag: Tag;
    applicableTo: Def["applicableTo"];
    astDerivable: Def["astDerivable"];
    relatedTags: Def["relatedTags"];
    specifications: Def["specifications"];
    synonyms: Def["synonyms"];
    tagKind: Def["tagKind"];
  }
}

/**
 * Asserts that a value matches the encoded JSDoc tag definition shape.
 *
 * @param input - Encoded JSDoc tag definition candidate to refine.
 * @example
 * ```ts
 * import { JSDocTagDefinition, assertJsDoc } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model"
 *
 * const encoded: JSDocTagDefinition.Encoded = {
 *   _tag: "param",
 *   synonyms: [],
 *   overview: "Documents a function parameter.",
 *   tagKind: "block",
 *   specifications: ["tsdocCore"],
 *   applicableTo: ["function"],
 *   astDerivable: "partial",
 *   astDerivableNote: "Parameter names are AST-derived; prose is authored.",
 *   parameters: {
 *     syntax: "@param name - description",
 *     acceptsType: false,
 *     acceptsName: true,
 *     acceptsDescription: true
 *   },
 *   relatedTags: ["typeParam"],
 *   example: "@param input - Raw input value."
 * }
 * assertJsDoc(encoded)
 * console.log(encoded._tag)
 * ```
 * @category models
 * @since 0.0.0
 */
export const assertJsDoc: <const Def extends JSDocTagDefinition.Encoded>(input: Def) => asserts input is Def = (
  input
) => {
  S.asserts(S.toEncoded(JSDocTagDefinition), input);
};

/**
 * Builds a JSDoc tag definition schema for a concrete tag payload.
 *
 * @param _tag - Canonical tag discriminator.
 * @param meta - Tag metadata payload without the discriminator.
 * @returns Specialized schema for the provided tag metadata payload.
 * @example
 * ```ts
 * import { JSDocTagDefinition, make } from "@beep/repo-utils/JSDoc/models/JSDocTagDefinition.model"
 *
 * const meta: Omit<JSDocTagDefinition.Encoded, "_tag"> = {
 *   synonyms: [],
 *   overview: "Documents a function parameter.",
 *   tagKind: "block",
 *   specifications: ["tsdocCore"],
 *   applicableTo: ["function"],
 *   astDerivable: "partial",
 *   astDerivableNote: "Parameter names are AST-derived; prose is authored.",
 *   parameters: {
 *     syntax: "@param name - description",
 *     acceptsType: false,
 *     acceptsName: true,
 *     acceptsDescription: true
 *   },
 *   relatedTags: ["typeParam"],
 *   example: "@param input - Raw input value."
 * }
 * const tagSchema = make("param", meta)
 * console.log(tagSchema.ast.annotations?.jsDocTagMetadata?._tag)
 * ```
 * @category models
 * @since 0.0.0
 */
export const make: {
  <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
    meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
  ): (tag: Tag) => ReturnType<typeof JSDocTagDefinition.mapFields>;
  <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
    _tag: Tag,
    meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
  ): ReturnType<typeof JSDocTagDefinition.mapFields>;
} = dual(
  2,
  <const Tag extends TagName, const Def extends typeof JSDocTagDefinition.Encoded>(
    _tag: Tag,
    meta: Omit<JSDocTagDefinition.Instance<Tag, Def>, "_tag">
  ) => {
    const def = Result.getOrThrow(S.decodeResult(JSDocTagDefinition)({ _tag, ...meta }));
    return JSDocTagDefinition.mapFields((_) => ({
      _tag: S.tag(_tag),
      value: TagValue.cases[_tag],
    })).annotate({ jsDocTagMetadata: def });
  }
);
