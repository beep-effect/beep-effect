/**
 * JSDoc metadata models.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import { DateTime } from "effect";
import * as S from "effect/Schema";

const $I = $RepoUtilsId.create("JSDoc/models/CanonicalJSDocSourceMetadata.model");

/**
 * Metadata for a canonical documentation source used in tag catalogs.
 *
 * **Example** (Build source metadata)
 *
 * ```ts
 * import { DateTime } from "effect"
 * import { CanonicalJSDocSourceMetadata } from "@beep/repo-utils/JSDoc/models/CanonicalJSDocSourceMetadata.model"
 *
 * const source = CanonicalJSDocSourceMetadata.make({
 *   name: "TSDoc",
 *   url: new URL("https://tsdoc.org/"),
 *   retrievedAt: DateTime.makeUnsafe("2026-01-01T00:00:00.000Z")
 * })
 * console.log(source.url.hostname)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalJSDocSourceMetadata extends S.Class<CanonicalJSDocSourceMetadata>(
  $I`CanonicalJSDocSourceMetadata`
)(
  {
    name: S.String,
    url: S.URLFromString,
    retrievedAt: S.DateTimeUtcFromString,
  },
  $I.annote("CanonicalJSDocSourceMetadata", {
    description: "Metadata for a canonical JSDoc source.",
  })
) {}

/**
 * Runtime codec companion types for {@link CanonicalJSDocSourceMetadata}.
 *
 * **Example** (Declare encoded metadata)
 *
 * ```ts
 * import { CanonicalJSDocSourceMetadata } from "@beep/repo-utils/JSDoc/models/CanonicalJSDocSourceMetadata.model"
 *
 * const encoded: CanonicalJSDocSourceMetadata.Encoded = {
 *   name: "JSDoc",
 *   url: "https://jsdoc.app/",
 *   retrievedAt: "2026-01-01T00:00:00.000Z"
 * }
 * console.log(encoded.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace CanonicalJSDocSourceMetadata {
  /**
   * Encoded wire shape for {@link CanonicalJSDocSourceMetadata}.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof CanonicalJSDocSourceMetadata.Encoded;
}

/**
 * Constructs a model instance from its encoded wire representation.
 *
 * **Example** (Decode wire representation)
 *
 * ```ts
 * import { make } from "@beep/repo-utils/JSDoc/models/CanonicalJSDocSourceMetadata.model"
 *
 * const source = make({
 *   name: "JSDoc",
 *   url: "https://jsdoc.app/",
 *   retrievedAt: "2026-01-01T00:00:00.000Z"
 * })
 * console.log(source.url.hostname)
 * ```
 *
 * @param input - Serialized source metadata payload.
 * @returns A decoded schema instance with strongly typed fields.
 * @category models
 * @since 0.0.0
 */
export const make = (input: CanonicalJSDocSourceMetadata.Encoded) =>
  CanonicalJSDocSourceMetadata.make({
    name: input.name,
    url: new URL(input.url),
    retrievedAt: DateTime.makeUnsafe(input.retrievedAt),
  });
