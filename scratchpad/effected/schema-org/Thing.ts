import * as S from "effect/Schema";

/**
 * The fields every schema.org node in this package carries, spread into each
 * node class rather than inherited.
 *
 * Reproducing schema.org's `rdfs:subClassOf` chain as TypeScript class
 * inheritance would create a second source of truth for a fact that already
 * lives in the vendored vocabulary — the one the conformance validator reads —
 * and the two would drift the first time schema.org moves a property up a
 * level. Spreading a field record keeps one definition of each field with no
 * heritage chain, and leaves every class's emitted declaration listing its own
 * fields.
 *
 * Every field is `Schema.optional` rather than `Schema.optionalKey`, so it
 * accepts an explicit `undefined`: node fields usually come from
 * possibly-absent upstream metadata, and passing that straight through avoids a
 * wall of conditional spreads at each call site.
 *
 * @public
 */
export const ThingFields = {
	/**
	 * The node's identifier, and the only required field on any node.
	 *
	 * Typed as a plain string: the identifier rule is enforced by
	 * `JsonLdDocument.buildResult`, so a malformed `@id` fails typed rather than
	 * throwing out of `make`.
	 */
	"@id": S.String,
	/** The node's name. Single-valued: a node with two names has an authoring bug. */
	name: S.optional(S.String),
	/** The canonical URL for the node. Single-valued. */
	url: S.optional(S.String),
	/** A description of the node. Single-valued. */
	description: S.optional(S.String),
	/** External identifiers for the node. Repeatable. */
	identifier: S.String.pipe(S.Array, S.optional),
	/** URLs of pages that unambiguously identify the node. Repeatable. */
	sameAs: S.String.pipe(S.Array, S.optional),
	/**
	 * schema.org terms this package does not model as typed fields, flattened
	 * into the node's JSON object at serialization.
	 *
	 * This is the pressure valve that makes conformance validation worth
	 * running: typed fields are correct by construction and proven so by a
	 * test, so the catch-all is the one door through which a plausible-looking
	 * property that schema.org does not define on this type can enter a graph.
	 *
	 * A key here that collides with a typed field, with `@id` or with `@type`
	 * is caller error and fails at `JsonLdDocument.buildResult`.
	 */
	additional: S.optional(S.Record(S.String, S.Json)),
} as const;
