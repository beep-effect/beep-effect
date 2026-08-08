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
 * **Example** (Decode date string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const value: Model.Date = S.decodeUnknownSync(Model.Date)("2024-01-15")
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
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
 * **Example** (Type decoded date value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import * as Model from "@beep/schema/Model"
 *
 * const value: Model.Date = S.decodeUnknownSync(Model.Date)("2024-01-15")
 * console.log(value.toString())
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Date = typeof Date.Type;

/**
 * Overridable date field that defaults to today's UTC date on insert.
 *
 * **Example** (Log DateWithNow schema)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateWithNow)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateWithNow = Overridable(Date, {
  defaultValue: Effect.map(DateTime.now, DateTime.removeTime),
});

/**
 * Overridable datetime field (string-backed) that defaults to `DateTime.now`.
 *
 * **Example** (Log DateTimeWithNow schema)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeWithNow)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeWithNow = Overridable(S.DateTimeUtcFromString, {
  defaultValue: DateTime.now,
});

/**
 * Overridable datetime field (Date-backed) that defaults to `DateTime.now`.
 *
 * **Example** (Log DateTimeFromDateWithNow)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeFromDateWithNow)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeFromDateWithNow = Overridable(S.DateTimeUtcFromDate, {
  defaultValue: DateTime.now,
});

/**
 * Overridable datetime field (number-backed) that defaults to `DateTime.now`.
 *
 * **Example** (Log DateTimeFromNumberWithNow)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * console.log(Model.DateTimeFromNumberWithNow)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeFromNumberWithNow = Overridable(S.DateTimeUtcFromMillis, {
  defaultValue: DateTime.now,
});

/**
 * Interface for a string-backed datetime insert field.
 *
 * **Example** (Type DateTimeInsert field)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsert = Model.DateTimeInsert
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * **Example** (Use DateTimeInsert field)
 *
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
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeInsert: DateTimeInsert = Field({
  select: S.DateTimeUtcFromString,
  insert: DateTimeWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a Date-backed datetime insert field.
 *
 * **Example** (Type DateTimeInsertFromDate)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsertFromDate = Model.DateTimeInsertFromDate
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * **Example** (Use DateTimeInsertFromDate)
 *
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
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeInsertFromDate: DateTimeInsertFromDate = Field({
  select: S.DateTimeUtcFromDate,
  insert: DateTimeFromDateWithNow,
  json: S.DateTimeUtcFromString,
});

/**
 * Interface for a number-backed datetime insert field.
 *
 * **Example** (Type DateTimeInsertFromNumber)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeInsertFromNumber = Model.DateTimeInsertFromNumber
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is omitted from updates and is available for selection.
 *
 * **Example** (Use DateTimeInsertFromNumber)
 *
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
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeInsertFromNumber: DateTimeInsertFromNumber = Field({
  select: S.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  json: S.DateTimeUtcFromMillis,
});

/**
 * Interface for a string-backed datetime update field.
 *
 * **Example** (Type DateTimeUpdate field)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdate = Model.DateTimeUpdate
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * **Example** (Use DateTimeUpdate field)
 *
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
 * @category schemas
 * @since 0.0.0
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
 * **Example** (Type DateTimeUpdateFromDate)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdateFromDate = Model.DateTimeUpdateFromDate
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * **Example** (Use DateTimeUpdateFromDate)
 *
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
 * @category schemas
 * @since 0.0.0
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
 * **Example** (Type DateTimeUpdateFromNumber)
 *
 * ```ts
 * import * as Model from "@beep/schema/Model"
 *
 * const field: Model.DateTimeUpdateFromNumber = Model.DateTimeUpdateFromNumber
 * console.log(field)
 * ```
 *
 * @category models
 * @since 0.0.0
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
 * **Details**
 *
 * It is set to the current `DateTime.Utc` on updates and inserts and is
 * available for selection.
 *
 * **Example** (Use DateTimeUpdateFromNumber)
 *
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
 * @category schemas
 * @since 0.0.0
 */
export const DateTimeUpdateFromNumber: DateTimeUpdateFromNumber = Field({
  select: S.DateTimeUtcFromMillis,
  insert: DateTimeFromNumberWithNow,
  update: DateTimeFromNumberWithNow,
  json: S.DateTimeUtcFromMillis,
});
