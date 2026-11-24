/**
 * The schema.org `CreativeWork` node and the shared field set that its
 * subtypes extend.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { NodeRef } from "./NodeRef.ts";
import { ThingFields } from "./Thing.ts";

const $I = $SchemaOrgId.create("CreativeWork");

/**
 * The fields shared by every `CreativeWork` descendant this package models,
 * spread into `CreativeWork`, `SoftwareSourceCode`, `TechArticle` and
 * `APIReference`.
 *
 * **Details**
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

 * **Example** (Compose a schema from shared work fields)
 *
 * ```ts
 * import { CreativeWorkFields } from "@beep/schema-org/CreativeWork";
 * import * as S from "effect/Schema";
 *
 * const WorkFields = S.Struct(CreativeWorkFields);
 * const work = S.decodeUnknownSync(WorkFields)({
 *   "@id": "https://example.com/#guide",
 *   license: ["https://spdx.org/licenses/MIT"],
 * });
 * console.log(work.license?.[0]); // https://spdx.org/licenses/MIT
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const CreativeWorkFields = {
  ...ThingFields,
  /**
   * The license(s) the work is offered under, as URLs.
   *
   * **Details**
   *
   * Repeatable, and this is the property where collapsing would be provably
   * wrong: `MIT AND Apache-2.0` is a real dual-license. A consumer holding
   * SPDX identifiers maps them onto the `https://spdx.org/licenses/<id>`
   * reference URL — this package deliberately does not depend on
   * `@beep/spdx`, because schema.org's `license` range is
   * `CreativeWork | URL`, not an SPDX expression.
   */
  license: S.String.pipe(S.Array, S.optionalKey),
  /** Authors of the work, by reference. Repeatable. */
  author: NodeRef.pipe(S.Array, S.optionalKey),
  /**
   * Publishers of the work, by reference. Repeatable — co-publication is
   * uncommon, but widening a scalar later would be a breaking change.
   */
  publisher: NodeRef.pipe(S.Array, S.optionalKey),
  /** Works this one is part of, by reference. Repeatable: "part of" is a many relation. */
  isPartOf: NodeRef.pipe(S.Array, S.optionalKey),
  /**
   * The primary entity described by the work, by reference.
   *
   * **Details**
   *
   * Single-valued, because schema.org defines `mainEntity` as *the primary*
   * entity.
   */
  mainEntity: S.optionalKey(NodeRef),
  /** Subjects of the work, by reference. Repeatable. */
  about: NodeRef.pipe(S.Array, S.optionalKey),
  /** Keywords describing the work. Repeatable. */
  keywords: S.String.pipe(S.Array, S.optionalKey),
  /** Publication date, as an ISO 8601 date or date-time string. Single-valued. */
  datePublished: S.optionalKey(S.String),
  /** Last-modification date, as an ISO 8601 date or date-time string. Single-valued. */
  dateModified: S.optionalKey(S.String),
  /** The language of the work, as a BCP 47 tag. Single-valued. */
  inLanguage: S.optionalKey(S.String),
  /**
   * The version of the work. Single-valued.
   *
   * **Details**
   *
   * A plain string: schema.org's `version` range is `Number | Text`, so
   * requiring SemVer here would reject a legal `"2024-11"`.
   */
  version: S.optionalKey(S.String),
} as const;

/**
 * **Details**
 *
 * Reach for a more specific class where one fits: `SoftwareSourceCode` for a
 * package's source, `TechArticle` for documentation, `APIReference` for an API
 * surface. `CreativeWork` is what to use when none of those is right.
 *
 * **Example** (Create a licensed creative work)
 *
 * ```ts
 * import { CreativeWork } from "@beep/schema-org/CreativeWork";
 *
 * const work = CreativeWork.make({
 * 	"@id": "https://example.com/#guide",
 * 	name: "Guide",
 * 	license: ["https://spdx.org/licenses/MIT"],
 * });
 * console.log(work["@type"]); // CreativeWork
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class CreativeWork extends S.Opaque<CreativeWork, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CreativeWorkFields,
    /** The JSON-LD type discriminator, populated automatically. */
    "@type": S.tag("CreativeWork").pipe(
      $I.annoteKey("CreativeWork.@type", { description: "The JSON-LD type discriminator, populated automatically." })
    ),
  }).pipe(
    $I.annoteSchema("CreativeWork", {
      description:
        "A schema.org `CreativeWork` — the general node for a created work, and the base vocabulary the more specific nodes in this package extend.",
    })
  )
) {}
