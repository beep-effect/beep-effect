/**
 * Coordinate values.
 *
 * **Details**
 *
 * {@link Geolocation} is the only usable server value: latitude and longitude
 * are bounded. {@link GeolocationInput} is the released wire and leaves those
 * two numbers unbounded so old clients are not rejected at the boundary.
 * Bounds are applied by converting into {@link Geolocation}, and failure
 * becomes `None` rather than an error.
 *
 * @since 0.0.0
 */
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { optionalText, optionalTimestamp } from "./Kit.ts";
import { atLeastCheck, betweenCheck, finiteBetween, Model, optionalNull, pg } from "./Port.ts";
import { PythonFloat } from "./PythonFloat.ts";

const decodeUnknownFromJsonString = S.decodeEffect(S.fromJsonString(S.Unknown));

const $I = $ScratchpadId.create("beep/Geolocation");

const headerLimit = 4096;

/**
 * How a coordinate was captured.
 *
 * **Details**
 *
 * The same four strings are used by both the bounded value and the released
 * input. The field does not change the other properties.
 *
 * **Example** (Decode a manual capture)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CaptureSource } from "@beep/scratchpad/beep/Geolocation"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(CaptureSource)("manual"))
 * console.log(decoded) // "manual"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CaptureSource = LiteralKit(["current_position", "last_known_position", "manual", "integration"]).pipe(
  $I.annoteSchema("CaptureSource", {
    description: "Where a coordinate came from: current, last known, manual, or an integration.",
  }),
);

/**
 * Decoded capture source.
 *
 * @see {@link CaptureSource} for the runtime literal set.
 * @category type-level
 * @since 0.0.0
 */
export type CaptureSource = typeof CaptureSource.Type;

const captureSourceField = CaptureSource.pipe(optionalNull, pg.text(), pg.columnName("capture_source"));
const accuracyField = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  optionalNull,
  pg.doublePrecision(),
  pg.columnName("accuracy"),
);
const altitudeField = S.Finite.pipe(optionalNull, pg.doublePrecision(), pg.columnName("altitude"));

const sharedGeoFields = {
  googlePlaceId: optionalText("google_place_id"),
  address: optionalText("address"),
  locationType: optionalText("location_type"),
  capturedAt: optionalTimestamp("captured_at"),
  captureSource: captureSourceField,
  accuracy: accuracyField,
  altitude: altitudeField,
};

/**
 * Bounded server coordinate.
 *
 * **Details**
 *
 * Latitude is -90 through 90. Longitude is -180 through 180. Accuracy is
 * missing, null, or a finite number at least zero. Altitude is finite when
 * present and has no range. `capture_source` is the four-value literal or null.
 *
 * **Example** (Decode a bounded point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GeolocationWire } from "@beep/scratchpad/beep/Geolocation"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GeolocationWire)({
 *     latitude: 47.6,
 *     longitude: -122.3,
 *     google_place_id: null,
 *     accuracy: null,
 *   }),
 * )
 * console.log(decoded.latitude) // 47.6
 * console.log(O.isNone(decoded.accuracy)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Geolocation extends Model<Geolocation>("Geolocation")(
  {
    ...sharedGeoFields,
    latitude: finiteBetween("latitude", -90, 90),
    longitude: finiteBetween("longitude", -180, 180),
  },
  $I.annote("Geolocation", {
    description: "Server coordinate. Latitude and longitude are bounded; this is the only cached value.",
  }),
  (columns: {
    readonly latitude: ExtraConfigColumn;
    readonly longitude: ExtraConfigColumn;
    readonly accuracy: ExtraConfigColumn;
  }) => [
    betweenCheck("latitude", -90, 90)(columns.latitude),
    betweenCheck("longitude", -180, 180)(columns.longitude),
    atLeastCheck("accuracy", 0)(columns.accuracy),
  ],
) {}

/**
 * Encoded form of {@link Geolocation}.
 *
 * @see {@link GeolocationWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Geolocation {
  export type Encoded = S.Codec.Encoded<typeof Geolocation>;
}

/**
 * Snake_case codec for {@link Geolocation}.
 *
 * **Example** (Reject a latitude past 90)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GeolocationWire } from "@beep/scratchpad/beep/Geolocation"
 *
 * const failed = Effect.runSyncExit(S.decodeUnknownEffect(GeolocationWire)({ latitude: 91, longitude: 0 }))
 * console.log(failed._tag) // "Failure"
 * ```
 *
 * @see {@link Geolocation} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const GeolocationWire = Geolocation.pipe(
  S.encodeKeys({
    googlePlaceId: "google_place_id",
    locationType: "location_type",
    capturedAt: "captured_at",
    captureSource: "capture_source",
  }),
);

const decodeGeolocationWire = S.decodeUnknownEffect(GeolocationWire);

/**
 * Released coordinate wire, before bounds are applied.
 *
 * **Details**
 *
 * Bounds are enforced before any value is cached, geocoded, or persisted.
 * Keeping this transport shape broad preserves clients released before the
 * bound contract existed, while {@link Geolocation} remains the only usable
 * server-side value. Accuracy and altitude still reject non-finite numbers.
 *
 * **Gotchas**
 *
 * A latitude of 1000 decodes here and becomes `None` in
 * {@link validatedGeolocationOrNone}. Do not persist this shape.
 *
 * **Example** (Accept an out-of-range latitude)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { GeolocationInputWire } from "@beep/scratchpad/beep/Geolocation"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(GeolocationInputWire)({ latitude: 1000, longitude: 0 }))
 * console.log(decoded.latitude) // 1000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GeolocationInput extends Model<GeolocationInput>("GeolocationInput")(
  {
    ...sharedGeoFields,
    // Released clients are not rejected for non-finite coordinates.
    latitude: PythonFloat.pipe(pg.doublePrecision(), pg.columnName("latitude")),
    longitude: PythonFloat.pipe(pg.doublePrecision(), pg.columnName("longitude")),
  },
  $I.annote("GeolocationInput", {
    description: "Released coordinate wire. Latitude and longitude are intentionally unbounded.",
  }),
  (columns: { readonly accuracy: ExtraConfigColumn }) => [
    atLeastCheck("accuracy", 0)(columns.accuracy),
  ],
) {}

/**
 * Encoded form of {@link GeolocationInput}.
 *
 * @see {@link GeolocationInputWire} for snake_case JSON.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GeolocationInput {
  export type Encoded = S.Codec.Encoded<typeof GeolocationInput>;
}

/**
 * Snake_case codec for {@link GeolocationInput}.
 *
 * **Example** (Decode a null accuracy)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GeolocationInputWire } from "@beep/scratchpad/beep/Geolocation"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(GeolocationInputWire)({ latitude: 1, longitude: 2, accuracy: null }),
 * )
 * console.log(O.isNone(decoded.accuracy)) // true
 * ```
 *
 * @see {@link GeolocationInput} for the decoded class.
 * @category codecs
 * @since 0.0.0
 */
export const GeolocationInputWire = GeolocationInput.pipe(
  S.encodeKeys({
    googlePlaceId: "google_place_id",
    locationType: "location_type",
    capturedAt: "captured_at",
    captureSource: "capture_source",
  }),
);

const encodeGeolocationInputWire = S.encodeEffect(GeolocationInputWire);
const decodeGeolocationInputWire = S.decodeUnknownEffect(GeolocationInputWire);

const boundGeolocationInput = Effect.fn("Geolocation.boundInput")(function* (value: GeolocationInput) {
  const encoded = yield* Effect.result(encodeGeolocationInputWire(value));
  if (Result.isFailure(encoded)) return O.none<Geolocation>();
  return yield* Effect.option(decodeGeolocationWire(encoded.success));
});

/**
 * Converts a released coordinate into the bounded server value.
 *
 * **Details**
 *
 * `None` stays `None`. A value that fails the latitude or longitude bounds,
 * or any other {@link Geolocation} check, also becomes `None`. The failure is
 * not logged, so coordinates never land in an error string from this function.
 *
 * **Example** (Drop an out-of-range point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GeolocationInputWire, validatedGeolocationOrNone } from "@beep/scratchpad/beep/Geolocation"
 *
 * const input = Effect.runSync(S.decodeUnknownEffect(GeolocationInputWire)({ latitude: 1000, longitude: 0 }))
 * console.log(O.isNone(validatedGeolocationOrNone(O.some(input)))) // true
 * ```
 *
 * **Example** (Keep an in-range point)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { GeolocationInputWire, validatedGeolocationOrNone } from "@beep/scratchpad/beep/Geolocation"
 *
 * const input = Effect.runSync(S.decodeUnknownEffect(GeolocationInputWire)({ latitude: 38.72, longitude: -9.14 }))
 * const bounded = validatedGeolocationOrNone(O.some(input))
 *
 * console.log(O.getOrNull(O.map(bounded, (point) => point.latitude))) // 38.72
 * ```
 *
 * @see {@link geolocationFromPrivateHeader} for the header parser.
 * @category validators
 * @since 0.0.0
 */
export const validatedGeolocationOrNone = (geolocation: O.Option<GeolocationInput>): O.Option<Geolocation> =>
  Effect.runSync(
    O.match(geolocation, {
      onNone: () => Effect.succeed(O.none<Geolocation>()),
      onSome: (value) => boundGeolocationInput(value),
    }),
  );

/**
 * Parses a bounded coordinate from a private header.
 *
 * **Details**
 *
 * Non-strings, empty strings, and values longer than 4096 characters are
 * absent. JSON failures and schema failures become `None`. A FastAPI header
 * sentinel is not a string, so it is absent too. Coordinates are never logged.
 *
 * **Example** (Parse a bounded header)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { geolocationFromPrivateHeader } from "@beep/scratchpad/beep/Geolocation"
 *
 * const decoded = Effect.runSync(geolocationFromPrivateHeader('{"latitude":1,"longitude":2}'))
 * console.log(O.isSome(decoded)) // true
 * console.log(O.isNone(Effect.runSync(geolocationFromPrivateHeader("")))) // true
 * ```
 *
 * @see {@link validatedGeolocationOrNone} for the bound step.
 * @category decoding
 * @since 0.0.0
 */
export const geolocationFromPrivateHeader = Effect.fn("Geolocation.fromPrivateHeader")(function* (value: unknown) {
  if (!P.isString(value) || Str.isEmpty(value) || value.length > headerLimit) return O.none();
  const parsed = yield* Effect.result(decodeUnknownFromJsonString(value));
  if (Result.isFailure(parsed)) return O.none();
  const input = yield* Effect.result(decodeGeolocationInputWire(parsed.success));
  if (Result.isFailure(input)) return O.none();
  return validatedGeolocationOrNone(O.some(input.success));
});
