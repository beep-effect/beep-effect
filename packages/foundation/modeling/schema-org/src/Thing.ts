/**
 * The schema.org `Thing` field set, the root every node schema in this
 * package builds on.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as S from "effect/Schema";

/**
 * The fields every schema.org node in this package carries, spread into each
 * node class rather than inherited.
 *
 * **Details**
 *
 * Reproducing schema.org's `rdfs:subClassOf` chain as TypeScript class
 * inheritance would create a second source of truth for a fact that already
 * lives in the vendored vocabulary — the one the conformance validator reads —
 * and the two would drift the first time schema.org moves a property up a
 * level. Spreading a field record keeps one definition of each field with no
 * heritage chain, and leaves every class's emitted declaration listing its own
 * fields.
 *
 * Every field is an exact optional key (`Schema.optionalKey`, EF-40): absence
 * is spelled by omitting the key, so a caller holding possibly-absent upstream
 * metadata builds the node with `O.getSomesStruct({...})`.
 *
 * **Example** (Construct shared node metadata)
 *
 * ```ts import.meta.vitest name="Construct shared node metadata"
 * import { ThingFields } from "@beep/schema-org/Thing";
 * import * as S from "effect/Schema";
 *
 * const Thing = S.Struct(ThingFields);
 * const node = S.decodeUnknownSync(Thing)({ "@id": "_:pkg" });
 * console.log(node["@id"]) // _:pkg
 * console.log(node.name) // undefined
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ThingFields = {
  /**
   * The node's identifier, and the only required field on any node.
   *
   * **Details**
   *
   * Typed as a plain string: the identifier rule is enforced by
   * `JsonLdDocument.buildResult`, so a malformed `@id` fails typed rather than
   * throwing out of `make`.
   *
   * @since 0.0.0
   */
  "@id": S.String,
  /**
   * The node's name. Single-valued: a node with two names has an authoring bug.
   *
   * @since 0.0.0
   */
  name: S.optionalKey(S.String),
  /**
   * The canonical URL for the node. Single-valued.
   *
   * @since 0.0.0
   */
  url: S.optionalKey(S.String),
  /**
   * A description of the node. Single-valued.
   *
   * @since 0.0.0
   */
  description: S.optionalKey(S.String),
  /**
   * External identifiers for the node. Repeatable.
   *
   * @since 0.0.0
   */
  identifier: S.String.pipe(S.Array, S.optionalKey),
  /**
   * URLs of pages that unambiguously identify the node. Repeatable.
   *
   * @since 0.0.0
   */
  sameAs: S.String.pipe(S.Array, S.optionalKey),
  /**
   * schema.org terms this package does not model as typed fields, flattened
   * into the node's JSON object at serialization.
   *
   * **Details**
   *
   * This is the pressure valve that makes conformance validation worth
   * running: typed fields are correct by construction and proven so by a
   * test, so the catch-all is the one door through which a plausible-looking
   * property that schema.org does not define on this type can enter a graph.
   *
   * A key here that collides with a typed field, with `@id` or with `@type`
   * is caller error and fails at `JsonLdDocument.buildResult`.
   *
   * @since 0.0.0
   */
  additional: S.optionalKey(S.Record(S.String, S.Json)),
} as const;
