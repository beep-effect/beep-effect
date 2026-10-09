import * as S from "effect/Schema";
import { NodeRef } from "./NodeRef.ts";
import { ThingFields } from "./Thing.ts";

/**
 * A schema.org `Person` — an author, maintainer or contributor.
 *
 * Carries only `Thing`-level fields plus the two person-specific ones. The
 * `CreativeWork` vocabulary (`license`, `author`, `datePublished`, …) is
 * deliberately absent: those properties are not `domainIncludes`-legal on
 * `Person`.
 *
 * @example
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
export class Person extends S.Class<Person>("Person")({
	...ThingFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": S.tag("Person"),
	/** An email address for the person. Single-valued. */
	email: S.optional(S.String),
	/** Organizations the person is affiliated with, by reference. Repeatable. */
	affiliation: NodeRef.pipe(S.Array, S.optional),
}) {}
