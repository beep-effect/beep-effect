/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Effect } from "effect";
import * as S from "effect/Schema";
import * as Uuid from "uuid";
import { Field, Overridable } from "./Model.variants.ts";
import type * as VariantSchema from "../VariantSchema/index.ts";
/**
 * Interface for a binary UUID v4 field auto-generated on insert.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const BlobId = Model.Uint8Array.pipe(S.brand("BlobId"))
 * const field: Model.UuidV4Insert<"BlobId"> = Model.UuidV4Insert(BlobId)
 *
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface UuidV4Insert<B extends string>
  extends VariantSchema.Field<{
    readonly select: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
    readonly insert: Overridable<S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>>;
    readonly update: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
    readonly json: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>;
  }> {}

/**
 * Schema for `Uint8Array` values, used as the base for binary UUID fields.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.Uint8Array)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const Uint8Array: S.instanceOf<Uint8Array<ArrayBuffer>> = S.Uint8Array as S.instanceOf<
  globalThis.Uint8Array<ArrayBuffer>
>;

/**
 * Wrap a branded `Uint8Array` schema in an `Overridable` that generates a UUID v4 by default.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const BlobId = Model.Uint8Array.pipe(S.brand("BlobId"))
 * const overridable = Model.UuidV4WithGenerate(BlobId)
 *
 * console.log(overridable)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const UuidV4WithGenerate = <B extends string>(
  schema: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>
): Overridable<S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>> =>
  Overridable(schema, {
    defaultValue: Effect.sync(() => Uuid.v4({}, new globalThis.Uint8Array(16))),
  });

/**
 * A field that represents a binary UUID v4 that is generated on inserts.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const BlobId = Model.Uint8Array.pipe(S.brand("BlobId"))
 *
 * class Blob extends Model.Class<Blob>("Blob")({
 *   id: Model.UuidV4Insert(BlobId)
 * }) {}
 *
 * console.log(Blob.fields.id)
 * ```
 *
 * @since 0.0.0
 * @category constructors
 */
export const UuidV4Insert = <const B extends string>(
  schema: S.brand<S.instanceOf<Uint8Array<ArrayBuffer>>, B>
): UuidV4Insert<B> =>
  Field({
    select: schema,
    insert: UuidV4WithGenerate(schema),
    update: schema,
    json: schema,
  });
