import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { NodeRef } from "./NodeRef.ts";
import { ThingFields } from "./Thing.ts";

const $I = $ScratchpadId.create("effected/schema-org/Person");

/**
 * A schema.org `Person` — an author, maintainer or contributor.
 *
 * **Details**
 *
 * Carries only `Thing`-level fields plus the two person-specific ones. The
 * `CreativeWork` vocabulary (`license`, `author`, `datePublished`, …) is
 * deliberately absent: those properties are not `domainIncludes`-legal on
 * `Person`.
 *
 * **Example** (Create a person with a profile URL)
 *
 * ```ts
 * import { Person } from "./index.ts";
 *
 * const alice = Person.make({
 * 	"@id": "https://example.com/#alice",
 * 	name: "Alice Example",
 * 	url: "https://example.com/alice",
 * });
 * ```
 *
 * @public
 */
export class Person extends S.Class<Person>($I`Person`)({
	...ThingFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("Person").annotateKey({ description: "The JSON-LD type discriminator, populated automatically." }),
	/** An email address for the person. Single-valued. */
	email: S.optional(S.String).annotateKey({ description: "An email address for the person. Single-valued." }),
	/** Organizations the person is affiliated with, by reference. Repeatable. */
	affiliation: NodeRef.pipe(S.Array, S.optional).annotateKey({ description: "Organizations the person is affiliated with, by reference. Repeatable." }),
}, $I.annote("Person", { description: "A schema.org `Person` — an author, maintainer or contributor." })) {}
