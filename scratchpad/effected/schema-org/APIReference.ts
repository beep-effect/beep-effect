import { Schema } from "effect";
import { TechArticleFields } from "./TechArticle.ts";

/**
 * A schema.org `APIReference` — documentation of an API surface.
 *
 * `APIReference` is `rdfs:subClassOf TechArticle` in the vocabulary, so every
 * `TechArticle` field is legal here and is spread in.
 *
 * @example
 * ```ts
 * import { APIReference } from "./index.ts";
 *
 * const api = APIReference.make({
 * 	"@id": "https://example.com/api#v2",
 * 	name: "example API",
 * 	assemblyVersion: "2.0.0",
 * 	programmingModel: "ESM",
 * });
 * ```
 *
 * @public
 */
export class APIReference extends Schema.Class<APIReference>("APIReference")({
	...TechArticleFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": Schema.tag("APIReference"),
	/** The version of the assembly the reference documents. Single-valued. */
	assemblyVersion: Schema.optional(Schema.String),
	/** The programming model the API follows. Single-valued. */
	programmingModel: Schema.optional(Schema.String),
	/** The platform the API targets. Single-valued. */
	targetPlatform: Schema.optional(Schema.String),
	/** The library file that exposes the API. Single-valued. */
	executableLibraryName: Schema.optional(Schema.String),
}) {}
