/**
 * Typed failures of the parcel service and its source ports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PalantiriId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { ParcelId } from "./Parcel.models.ts";

const $I = $PalantiriId.create("Parcels.errors");

/**
 * **Example** (Construct an unknown-parcel error)
 *
 * ```ts
 * import { UnknownParcel } from "@beep/palantiri/Parcels.errors"
 *
 * const error = UnknownParcel.make({ parcel: "weather" })
 * console.log(error._tag) // "UnknownParcel"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnknownParcel extends S.TaggedError<UnknownParcel, { readonly brand: unique symbol }>($I`UnknownParcel`)(
  "UnknownParcel",
  { parcel: S.String },
  $I.annoteError<UnknownParcel>("UnknownParcel", { description: "A read named a parcel Palantiri does not serve." })
) {}

/**
 * **Details**
 *
 * `detail` is short and non-identifying: it never carries a path, a label or
 * a provider response. `Parcels.read` turns this into `Unknown{unreachable}`
 * rather than failing.
 *
 * **Example** (Construct a source failure)
 *
 * ```ts
 * import { SourceFailed } from "@beep/palantiri/Parcels.errors"
 *
 * const error = SourceFailed.make({ parcel: "account-headroom", detail: "accounts report unavailable" })
 * console.log(error.parcel) // "account-headroom"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SourceFailed extends S.TaggedError<SourceFailed, { readonly brand: unique symbol }>($I`SourceFailed`)(
  "SourceFailed",
  { parcel: ParcelId, detail: S.String },
  $I.annoteError<SourceFailed>("SourceFailed", { description: "A parcel's source port could not produce a reading." })
) {}

/**
 * **Example** (Guard a parcel failure)
 *
 * ```ts
 * import { ParcelError, UnknownParcel } from "@beep/palantiri/Parcels.errors"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ParcelError)(UnknownParcel.make({ parcel: "weather" }))) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export const ParcelError = S.Union([UnknownParcel, SourceFailed]).pipe(
  $I.annoteSchema("ParcelError", { description: "Any parcel service or source failure." })
);

/**
 * @category errors
 * @since 0.0.0
 */
export type ParcelError = typeof ParcelError.Type;
