import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { TechArticleFields } from "./TechArticle.ts";

const $I = $ScratchpadId.create("effected/schema-org/APIReference");

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
export class APIReference extends S.Class<APIReference>($I`APIReference`)({
	...TechArticleFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("APIReference").annotateKey({ description: "The JSON-LD type discriminator, populated automatically." }),
	/** The version of the assembly the reference documents. Single-valued. */
	assemblyVersion: S.optional(S.String).annotateKey({ description: "The version of the assembly the reference documents. Single-valued." }),
	/** The programming model the API follows. Single-valued. */
	programmingModel: S.optional(S.String).annotateKey({ description: "The programming model the API follows. Single-valued." }),
	/** The platform the API targets. Single-valued. */
	targetPlatform: S.optional(S.String).annotateKey({ description: "The platform the API targets. Single-valued." }),
	/** The library file that exposes the API. Single-valued. */
	executableLibraryName: S.optional(S.String).annotateKey({ description: "The library file that exposes the API. Single-valued." }),
}, $I.annote("APIReference", { description: "A schema.org `APIReference` — documentation of an API surface." })) {}
