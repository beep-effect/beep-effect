/**
 * Experimental Box resource reference value-object schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BoxId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $BoxId.create("values/Resource/Resource.model");

/**
 * Experimental value object for compact Box resource references embedded in payloads.
 *
 * **Details**
 *
 * This experimental domain class currently declares an empty schema shape; generated Box SDK payload schemas remain the field-level source for API data until fields are promoted here.
 *
 * **Example** (Round-trip empty Resource payload)
 *
 * ```ts
 * import { Resource } from "@beep/box/experimental/domain/values/Resource/Resource.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = S.decodeUnknownSync(Resource)({});
 * const encoded: Resource.Encoded = S.encodeSync(Resource)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class Resource extends S.Class<Resource>($I`Resource`)(
  {},
  $I.annote("Resource", {
    description: "Experimental value object for compact Box resource references embedded in payloads.",
  })
) {}

/**
 * Type-level companion namespace for {@link Resource} encoded payloads.
 *
 * **Example** (Make and encode Resource)
 *
 * ```ts
 * import { Resource } from "@beep/box/experimental/domain/values/Resource/Resource.model";
 * import * as S from "effect/Schema";
 *
 * const decoded = Resource.make({});
 * const encoded: Resource.Encoded = S.encodeSync(Resource)(decoded);
 *
 * console.log(JSON.stringify(encoded));
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Resource {
  /**
   * Encoded payload accepted by the {@link Resource} value-object schema.
   *
   * **Example** (Encode Resource to Encoded)
   *
   * ```ts
   * import { Resource } from "@beep/box/experimental/domain/values/Resource/Resource.model";
   * import * as S from "effect/Schema";
   *
   * const encoded: Resource.Encoded = S.encodeSync(Resource)(Resource.make({}));
   *
   * console.log(JSON.stringify(encoded));
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Resource.Encoded;
}
