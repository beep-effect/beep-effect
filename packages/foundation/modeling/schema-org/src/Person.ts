/**
 * The schema.org `Person` node, used as an author, contributor or maintainer
 * of a creative work.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { NodeRef } from "./NodeRef.ts";
import { ThingFields } from "./Thing.ts";

const $I = $SchemaOrgId.create("Person");

/**
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
 * import { Person } from "@beep/schema-org/Person";
 *
 * const alice = Person.make({
 * 	"@id": "https://example.com/#alice",
 * 	name: "Alice Example",
 * 	url: "https://example.com/alice",
 * });
 *
 * console.log(alice.url) // https://example.com/alice
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Person extends S.Opaque<Person, { readonly brand: unique symbol }>()(
  S.Struct({
    ...ThingFields,
    /**
     * The JSON-LD type discriminator, populated automatically.
     *
     * @since 0.0.0
     */
    "@type": S.tag("Person").pipe(
      $I.annoteKey("Person.@type", { description: "The JSON-LD type discriminator, populated automatically." })
    ),
    /**
     * An email address for the person. Single-valued.
     *
     * @since 0.0.0
     */
    email: S.optionalKey(S.String).pipe(
      $I.annoteKey("Person.email", { description: "An email address for the person. Single-valued." })
    ),
    /**
     * Organizations the person is affiliated with, by reference. Repeatable.
     *
     * @since 0.0.0
     */
    affiliation: NodeRef.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Person.affiliation", {
        description: "Organizations the person is affiliated with, by reference. Repeatable.",
      })
    ),
  }).pipe($I.annoteSchema("Person", { description: "A schema.org `Person` — an author, maintainer or contributor." }))
) {}
