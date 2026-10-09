import * as S from "effect/Schema";
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
export class APIReference extends S.Class<APIReference>("APIReference")({
	...TechArticleFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("APIReference"),
	/** The version of the assembly the reference documents. Single-valued. */
	assemblyVersion: S.optional(S.String),
	/** The programming model the API follows. Single-valued. */
	programmingModel: S.optional(S.String),
	/** The platform the API targets. Single-valued. */
	targetPlatform: S.optional(S.String),
	/** The library file that exposes the API. Single-valued. */
	executableLibraryName: S.optional(S.String),
}) {}
