/**
 * The schema.org `APIReference` node: a {@link TechArticle} that documents a
 * programmatic interface.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaOrgId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { TechArticleFields } from "./TechArticle.ts";

const $I = $SchemaOrgId.create("APIReference");

/**
 * **Details**
 *
 * `APIReference` is `rdfs:subClassOf TechArticle` in the vocabulary, so every
 * `TechArticle` field is legal here and is spread in.
 *
 * **Example** (Create an API reference with version metadata)
 *
 * ```ts
 * import { APIReference } from "@beep/schema-org/APIReference";
 *
 * const api = APIReference.make({
 * 	"@id": "https://example.com/api#v2",
 * 	name: "example API",
 * 	assemblyVersion: "2.0.0",
 * 	programmingModel: "ESM",
 * });
 *
 * console.log(api.assemblyVersion); // 2.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class APIReference extends S.Opaque<APIReference, { readonly brand: unique symbol }>()(
  S.Struct({
    ...TechArticleFields,
    /** The JSON-LD type discriminator, populated automatically. */
    "@type": S.tag("APIReference").pipe(
      $I.annoteKey("APIReference.@type", { description: "The JSON-LD type discriminator, populated automatically." })
    ),
    /** The version of the assembly the reference documents. Single-valued. */
    assemblyVersion: S.optionalKey(S.String).pipe(
      $I.annoteKey("APIReference.assemblyVersion", {
        description: "The version of the assembly the reference documents. Single-valued.",
      })
    ),
    /** The programming model the API follows. Single-valued. */
    programmingModel: S.optionalKey(S.String).pipe(
      $I.annoteKey("APIReference.programmingModel", {
        description: "The programming model the API follows. Single-valued.",
      })
    ),
    /** The platform the API targets. Single-valued. */
    targetPlatform: S.optionalKey(S.String).pipe(
      $I.annoteKey("APIReference.targetPlatform", { description: "The platform the API targets. Single-valued." })
    ),
    /** The library file that exposes the API. Single-valued. */
    executableLibraryName: S.optionalKey(S.String).pipe(
      $I.annoteKey("APIReference.executableLibraryName", {
        description: "The library file that exposes the API. Single-valued.",
      })
    ),
  }).pipe(
    $I.annoteSchema("APIReference", { description: "A schema.org `APIReference` — documentation of an API surface." })
  )
) {}
