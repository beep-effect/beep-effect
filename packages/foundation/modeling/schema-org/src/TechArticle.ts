/**
 * The schema.org `TechArticle` node and the field set that its
 * `APIReference` subtype extends.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CreativeWorkFields } from "./CreativeWork.ts";

const $I = $SchemaOrgId.create("TechArticle");

/**
 * The fields shared by `TechArticle` and its descendant `APIReference`.
 *
 * **Details**
 *
 * `APIReference` is `rdfs:subClassOf TechArticle` in the vocabulary, so it
 * carries every one of these. They are spread rather than inherited.
 *
 * **Example** (Compose the technical article fields)
 *
 * ```ts
 * import { TechArticleFields } from "@beep/schema-org/TechArticle";
 * import * as S from "effect/Schema";
 *
 * const Article = S.Struct(TechArticleFields);
 * const article = S.decodeUnknownSync(Article)({ "@id": "_:intro", headline: "Getting started" });
 * console.log(article.headline) // Getting started
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TechArticleFields = {
  ...CreativeWorkFields,
  /**
   * The article's headline. Single-valued.
   *
   * @since 0.0.0
   */
  headline: S.optionalKey(S.String),
  /**
   * Sections the article belongs to. Repeatable.
   *
   * @since 0.0.0
   */
  articleSection: S.String.pipe(S.Array, S.optionalKey),
  /**
   * Prior knowledge the article assumes. Single-valued.
   *
   * @since 0.0.0
   */
  proficiencyLevel: S.optionalKey(S.String),
  /**
   * Prerequisites the article depends on. Single-valued.
   *
   * @since 0.0.0
   */
  dependencies: S.optionalKey(S.String),
} as const;

/**
 * **Example** (Link a technical article to package source code)
 *
 * ```ts
 * import { NodeRef } from "@beep/schema-org/NodeRef";
 * import { TechArticle } from "@beep/schema-org/TechArticle";
 *
 * const doc = TechArticle.make({
 * 	"@id": "https://example.com/docs#intro",
 * 	headline: "Getting started",
 * 	isPartOf: [NodeRef.to("https://example.com/pkg#source")],
 * 	inLanguage: "en",
 * });
 *
 * console.log(doc.isPartOf?.[0]?.["@id"]) // https://example.com/pkg#source
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class TechArticle extends S.Opaque<TechArticle, { readonly brand: unique symbol }>()(
  S.Struct({
    ...TechArticleFields,
    /**
     * The JSON-LD type discriminator, populated automatically.
     *
     * @since 0.0.0
     */
    "@type": S.tag("TechArticle").pipe(
      $I.annoteKey("TechArticle.@type", { description: "The JSON-LD type discriminator, populated automatically." })
    ),
  }).pipe(
    $I.annoteSchema("TechArticle", { description: "A schema.org `TechArticle` — a piece of technical documentation." })
  )
) {}
