/**
 * Internal schema module support.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { DateTime, Effect, SchemaGetter as Getter } from "effect";
import * as S from "effect/Schema";
import { Field, Overridable } from "./Model.variants.ts";
import type * as VariantSchema from "../VariantSchema/index.ts";

const $I = $SchemaId.create("Model");

/**
 * A schema for a `DateTime.Utc` that is serialized as a date string in the
 * format `YYYY-MM-DD`, with time removed.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const value: Model.Date = S.decodeUnknownSync(Model.Date)("2024-01-15")
 * console.log(value)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const Date = S.String.pipe(
  S.decodeTo(S.DateTimeUtc, {
    decode: Getter.dateTimeUtcFromInput().map(DateTime.removeTime),
    encode: Getter.transform(DateTime.formatIsoDate),
  }),
  $I.annoteSchema("Date", {
    description: "A DateTime.Utc serialized as a YYYY-MM-DD date string with time removed.",
  })
);

/**
 * Type for {@link Date}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const value: Model.Date = S.decodeUnknownSync(Model.Date)("2024-01-15")
 * console.log(value.toString())
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type Date = typeof Date.Type;

/**
 * Overridable date field that defaults to today's UTC date on insert.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateWithNow)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateWithNow = Overridable(Date, {
  defaultValue: Effect.map(DateTime.now, DateTime.removeTime),
});

/**
 * Overridable datetime field (string-backed) that defaults to `DateTime.now`.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeWithNow)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeWithNow = Overridable(S.DateTimeUtcFromString, {
  defaultValue: DateTime.now,
});

/**
 * Overridable datetime field (Date-backed) that defaults to `DateTime.now`.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeFromDateWithNow)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeFromDateWithNow = Overridable(S.DateTimeUtcFromDate, {
  defaultValue: DateTime.now,
});

/**
 * Overridable datetime field (number-backed) that defaults to `DateTime.now`.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeFromNumberWithNow)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeFromNumberWithNow = Overridable(S.DateTimeUtcFromMillis, {
  defaultValue: DateTime.now,
});

/**
 * Interface for a string-backed datetime insert field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsert = Model.DateTimeInsert
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeInsert
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromString;
    readonly insert: Overridable<S.DateTimeUtcFromString>;
    readonly json: S.DateTimeUtcFromString;
  }> {}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a string for the database.
 *
 * It is omitted from updates and is available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   createdAt: Model.DateTimeInsert
 * }) {}
 *
 * console.log(Group.fields.createdAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeInsert: DateTimeInsert = Field({
  select: S.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a Date-backed datetime insert field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsertFromDate = Model.DateTimeInsertFromDate
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeInsertFromDate
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromDate;
    readonly insert: Overridable<S.DateTimeUtcFromDate>;
    readonly json: S.DateTimeUtcFromString;
  }> {}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a `Date` for the database.
 *
 * It is omitted from updates and is available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   createdAt: Model.DateTimeInsertFromDate
 * }) {}
 *
 * console.log(Group.fields.createdAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeInsertFromDate: DateTimeInsertFromDate = Field({
  select: S.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a number-backed datetime insert field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsertFromNumber = Model.DateTimeInsertFromNumber
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeInsertFromNumber
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromMillis;
    readonly insert: Overridable<S.DateTimeUtcFromMillis>;
    readonly json: S.DateTimeUtcFromMillis;
  }> {}

/**
 * A field that represents a date-time value that is inserted as the current
 * `DateTime.Utc`. It is serialized as a `number`.
 *
 * It is omitted from updates and is available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   createdAt: Model.DateTimeInsertFromNumber
 * }) {}
 *
 * console.log(Group.fields.createdAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeInsertFromNumber: DateTimeInsertFromNumber = Field({
  select: S.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  json: S.DateTimeUtcFromMillis,
});

/**
 * Interface for a string-backed datetime update field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdate = Model.DateTimeUpdate
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeUpdate
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromString;
    readonly insert: Overridable<S.DateTimeUtcFromString>;
    readonly update: Overridable<S.DateTimeUtcFromString>;
    readonly json: S.DateTimeUtcFromString;
  }> {}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a string for the database.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   updatedAt: Model.DateTimeUpdate
 * }) {}
 *
 * console.log(Group.fields.updatedAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeUpdate: DateTimeUpdate = Field({
  select: S.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  update: DateTimeWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a Date-backed datetime update field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdateFromDate = Model.DateTimeUpdateFromDate
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeUpdateFromDate
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromDate;
    readonly insert: Overridable<S.DateTimeUtcFromDate>;
    readonly update: Overridable<S.DateTimeUtcFromDate>;
    readonly json: S.DateTimeUtcFromString;
  }> {}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a `Date` for the database.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   updatedAt: Model.DateTimeUpdateFromDate
 * }) {}
 *
 * console.log(Group.fields.updatedAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeUpdateFromDate: DateTimeUpdateFromDate = Field({
  select: S.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  update: DateTimeFromDateWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a number-backed datetime update field.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdateFromNumber = Model.DateTimeUpdateFromNumber
 * console.log(field)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export interface DateTimeUpdateFromNumber
  extends VariantSchema.Field<{
    readonly select: S.DateTimeUtcFromMillis;
    readonly insert: Overridable<S.DateTimeUtcFromMillis>;
    readonly update: Overridable<S.DateTimeUtcFromMillis>;
    readonly json: S.DateTimeUtcFromMillis;
  }> {}

/**
 * A field that represents a date-time value that is updated as the current
 * `DateTime.Utc`. It is serialized as a `number`.
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * @example
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * class Group extends Model.Class<Group>("Group")({
 *   updatedAt: Model.DateTimeUpdateFromNumber
 * }) {}
 *
 * console.log(Group.fields.updatedAt)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DateTimeUpdateFromNumber: DateTimeUpdateFromNumber = Field({
  select: S.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  update: DateTimeFromNumberWithNow,
  json: S.DateTimeUtcFromMillis,
});
