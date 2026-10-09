import { Schema } from "effect";
import { CreativeWorkFields } from "./CreativeWork.ts";

/**
 * The fields shared by `TechArticle` and its descendant `APIReference`.
 *
 * `APIReference` is `rdfs:subClassOf TechArticle` in the vocabulary, so it
 * carries every one of these. They are spread rather than inherited.
 *
 * @public
 */
export const TechArticleFields = {
	...CreativeWorkFields,
	/** The article's headline. Single-valued. */
	headline: Schema.optional(Schema.String),
	/** Sections the article belongs to. Repeatable. */
	articleSection: Schema.optional(Schema.Array(Schema.String)),
	/** Prior knowledge the article assumes. Single-valued. */
	proficiencyLevel: Schema.optional(Schema.String),
	/** Prerequisites the article depends on. Single-valued. */
	dependencies: Schema.optional(Schema.String),
} as const;

/**
 * A schema.org `TechArticle` — a piece of technical documentation.
 *
 * @example
 * ```ts
 * import { NodeRef, TechArticle } from "./index.ts";
 *
 * const doc = TechArticle.make({
 * 	"@id": "https://example.com/docs#intro",
 * 	headline: "Getting started",
 * 	isPartOf: [NodeRef.to("https://example.com/pkg#source")],
 * 	inLanguage: "en",
 * });
 * ```
 *
 * @public
 */
export class TechArticle extends Schema.Class<TechArticle>("TechArticle")({
	...TechArticleFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": Schema.tag("TechArticle"),
}) {}
