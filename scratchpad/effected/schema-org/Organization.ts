import { Schema } from "effect";
import { ThingFields } from "./Thing.ts";

/**
 * A schema.org `Organization` — a company, project or team that authors or
 * publishes a work.
 *
 * Carries only `Thing`-level fields plus the two organization-specific ones,
 * for the same reason as {@link Person}: the `CreativeWork` vocabulary is not
 * legal here.
 *
 * @example
 * ```ts
 * import { Organization } from "./index.ts";
 *
 * const org = Organization.make({
 * 	"@id": "https://example.com/#org",
 * 	name: "Example Inc",
 * 	legalName: "Example, Incorporated",
 * });
 * ```
 *
 * @public
 */
export class Organization extends Schema.Class<Organization>("Organization")({
	...ThingFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": Schema.tag("Organization"),
	/** The organization's registered legal name. Single-valued. */
	legalName: Schema.optional(Schema.String),
	/** A URL for the organization's logo. Single-valued. */
	logo: Schema.optional(Schema.String),
}) {}
