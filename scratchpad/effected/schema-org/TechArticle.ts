import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CreativeWorkFields } from "./CreativeWork.ts";

const $I = $ScratchpadId.create("effected/schema-org/TechArticle");

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
	headline: S.optional(S.String),
	/** Sections the article belongs to. Repeatable. */
	articleSection: S.String.pipe(S.Array, S.optional),
	/** Prior knowledge the article assumes. Single-valued. */
	proficiencyLevel: S.optional(S.String),
	/** Prerequisites the article depends on. Single-valued. */
	dependencies: S.optional(S.String),
} as const;

/**
 * A schema.org `TechArticle` — a piece of technical documentation.
 *
 * **Example** (Link a technical article to package source code)
 *
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
export class TechArticle extends S.Class<TechArticle>($I`TechArticle`)({
	...TechArticleFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("TechArticle").annotateKey({ description: "The JSON-LD type discriminator, populated automatically." }),
}, $I.annote("TechArticle", { description: "A schema.org `TechArticle` — a piece of technical documentation." })) {}
