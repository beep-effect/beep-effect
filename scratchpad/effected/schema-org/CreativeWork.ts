import { Schema } from "effect";
import { NodeRef } from "./NodeRef.ts";
import { ThingFields } from "./Thing.ts";

/**
 * The fields shared by every `CreativeWork` descendant this package models,
 * spread into `CreativeWork`, `SoftwareSourceCode`, `TechArticle` and
 * `APIReference`.
 *
 * Arity is fixed per property and is always the wire shape: a repeatable
 * property is a `ReadonlyArray` and is always emitted as an array, a
 * single-valued property is a scalar and always emitted as one. In the JSON-LD
 * data model a value and a one-element array of that value are the same thing,
 * so this gives up no expressiveness and buys exactly one representation per
 * property.
 *
 * Where arity is uncertain the property is repeatable: the cost of one pair of
 * brackets at a call site is small next to the breaking change of widening a
 * scalar later.
 *
 * @public
 */
export const CreativeWorkFields = {
	...ThingFields,
	/**
	 * The license(s) the work is offered under, as URLs.
	 *
	 * Repeatable, and this is the property where collapsing would be provably
	 * wrong: `MIT AND Apache-2.0` is a real dual-license. A consumer holding
	 * SPDX identifiers maps them onto the `https://spdx.org/licenses/<id>`
	 * reference URL — this package deliberately does not depend on
	 * `@effected/spdx`, because schema.org's `license` range is
	 * `CreativeWork | URL`, not an SPDX expression.
	 */
	license: Schema.optional(Schema.Array(Schema.String)),
	/** Authors of the work, by reference. Repeatable. */
	author: Schema.optional(Schema.Array(NodeRef)),
	/**
	 * Publishers of the work, by reference. Repeatable — co-publication is
	 * uncommon, but widening a scalar later would be a breaking change.
	 */
	publisher: Schema.optional(Schema.Array(NodeRef)),
	/** Works this one is part of, by reference. Repeatable: "part of" is a many relation. */
	isPartOf: Schema.optional(Schema.Array(NodeRef)),
	/**
	 * The primary entity described by the work, by reference.
	 *
	 * Single-valued, because schema.org defines `mainEntity` as *the primary*
	 * entity.
	 */
	mainEntity: Schema.optional(NodeRef),
	/** Subjects of the work, by reference. Repeatable. */
	about: Schema.optional(Schema.Array(NodeRef)),
	/** Keywords describing the work. Repeatable. */
	keywords: Schema.optional(Schema.Array(Schema.String)),
	/** Publication date, as an ISO 8601 date or date-time string. Single-valued. */
	datePublished: Schema.optional(Schema.String),
	/** Last-modification date, as an ISO 8601 date or date-time string. Single-valued. */
	dateModified: Schema.optional(Schema.String),
	/** The language of the work, as a BCP 47 tag. Single-valued. */
	inLanguage: Schema.optional(Schema.String),
	/**
	 * The version of the work. Single-valued.
	 *
	 * A plain string: schema.org's `version` range is `Number | Text`, so
	 * requiring SemVer here would reject a legal `"2024-11"`.
	 */
	version: Schema.optional(Schema.String),
} as const;

/**
 * A schema.org `CreativeWork` — the general node for a created work, and the
 * base vocabulary the more specific nodes in this package extend.
 *
 * Reach for a more specific class where one fits: `SoftwareSourceCode` for a
 * package's source, `TechArticle` for documentation, `APIReference` for an API
 * surface. `CreativeWork` is what to use when none of those is right.
 *
 * @example
 * ```ts
 * import { CreativeWork } from "./index.ts";
 *
 * const work = CreativeWork.make({
 * 	"@id": "https://example.com/#guide",
 * 	name: "Guide",
 * 	license: ["https://spdx.org/licenses/MIT"],
 * });
 * ```
 *
 * @public
 */
export class CreativeWork extends Schema.Class<CreativeWork>("CreativeWork")({
	...CreativeWorkFields,
	/** The JSON-LD type discriminator, populated automatically. */
	"@type": Schema.tag("CreativeWork"),
}) {}
