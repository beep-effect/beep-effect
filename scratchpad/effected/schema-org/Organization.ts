import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ThingFields } from "./Thing.ts";

const $I = $ScratchpadId.create("effected/schema-org/Organization");

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
export class Organization extends S.Class<Organization>($I`Organization`)({
	...ThingFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("Organization").annotateKey({ description: "The JSON-LD type discriminator, populated automatically." }),
	/** The organization's registered legal name. Single-valued. */
	legalName: S.optional(S.String).annotateKey({ description: "The organization's registered legal name. Single-valued." }),
	/** A URL for the organization's logo. Single-valued. */
	logo: S.optional(S.String).annotateKey({ description: "A URL for the organization's logo. Single-valued." }),
}, $I.annote("Organization", { description: "A schema.org `Organization` — a company, project or team that authors or publishes a work." })) {}
