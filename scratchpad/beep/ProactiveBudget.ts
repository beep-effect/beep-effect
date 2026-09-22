/**
 * Pure budget arithmetic for Chat-first agent-initiated turns.
 *
 * Outstanding reservations count against both limits. A receipt is the only
 * moment that records a consumed turn, including a receipt that arrives after
 * the reservation TTL.
 *
 * @since 0.0.0
 */
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Model,
  NonNegativeInt,
  nonNegativeIntCheck,
  pg,
  StableId,
  stableIdCheck,
  Table,
} from "./Kit.ts";
import { dual } from "@beep/utils";

const $I = $ScratchpadId.create("beep/ProactiveBudget");

const budgetInstantPattern =
  /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?(Z|[+-][0-9]{2}:[0-9]{2})?$/;

const emptyInstants: ReadonlyArray<string> = [];

/**
 * Daily cap on agent-initiated proactive turns, including reservations.
 *
 * **Example** (Read the daily cap)
 *
 * ```ts
 * import { DAILY_PROACTIVE_TURN_LIMIT } from "./ProactiveBudget.ts"
 *
 * console.log(DAILY_PROACTIVE_TURN_LIMIT) // 10
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DAILY_PROACTIVE_TURN_LIMIT = 10;

/**
 * Rolling 30-minute cap on agent-initiated proactive turns, including reservations.
 *
 * **Example** (Read the rolling cap)
 *
 * ```ts
 * import { ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT } from "./ProactiveBudget.ts"
 *
 * console.log(ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT = 2;

/**
 * ISO instant used by proactive budget accounting.
 *
 * **Details**
 *
 * Naive strings are UTC. Aware strings keep their wall-clock date for the
 * daily limit; comparisons use the absolute instant. Python `_as_utc` does not
 * convert an aware value, so this column stays text instead of `timestamptz`.
 *
 * **Example** (Accept a zoned instant)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { BudgetInstant } from "./ProactiveBudget.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(BudgetInstant)("2020-01-02T00:30:00+09:00"))
 * console.log(decoded) // "2020-01-02T00:30:00+09:00"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BudgetInstant = S.String.check(S.isPattern(budgetInstantPattern)).pipe(
  $I.annoteSchema("BudgetInstant", {
    description: "Proactive budget instant. Naive values are UTC; aware values keep their offset.",
  }),
);

/**
 * Decoded proactive budget instant string.
 *
 * @see {@link BudgetInstant} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type BudgetInstant = typeof BudgetInstant.Type;

/**
 * One reserved proactive turn that has not been materialized yet.
 *
 * **Example** (Reserve an intent)
 *
 * ```ts
 * import { ProactiveBudgetReservation } from "./ProactiveBudget.ts"
 *
 * const reservation = ProactiveBudgetReservation.make({
 *   intentId: "intent-1",
 *   expiresAt: "2020-01-03T03:04:05.000Z",
 * })
 * console.log(reservation.intentId) // "intent-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveBudgetReservation extends Model<ProactiveBudgetReservation>("ProactiveBudgetReservation")(
  {
    intentId: StableId.annotateKey({ description: "Agent intent holding the reservation." }).pipe(
      pg.text(),
      pg.columnName("intent_id"),
    ),
    expiresAt: BudgetInstant.annotateKey({ description: "Reservation expiry, one day after it was taken." }).pipe(
      pg.text(),
      pg.columnName("expires_at"),
    ),
  },
  $I.annote("ProactiveBudgetReservation", {
    description: "Unmaterialized proactive turn reservation.",
  }),
  (columns) => [stableIdCheck("intent_id")(columns.intentId)],
) {
}

/**
 * Encoded form of {@link ProactiveBudgetReservation}.
 *
 * @see {@link ProactiveBudgetReservation} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveBudgetReservation {
  export type Encoded = S.Codec.Encoded<typeof ProactiveBudgetReservation>;
}

/**
 * Private server accounting for proactive agent turns only.
 *
 * **Details**
 *
 * Materialized timestamps older than 48 hours are dropped. Reservations expire
 * after one day. At most 64 materializations and 16 reservations are stored.
 * This is the chat-first budget document, declared here so the arithmetic does
 * not depend on another module.
 *
 * **Example** (Start from an empty budget)
 *
 * ```ts
 * import { ProactiveBudgetState } from "./ProactiveBudget.ts"
 *
 * const state = ProactiveBudgetState.make({ accountGeneration: 0 })
 * console.log(state.reservations.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProactiveBudgetState extends Model<ProactiveBudgetState>("ProactiveBudgetState")(
  {
    accountGeneration: NonNegativeInt.annotateKey({
      description: "Account generation this budget belongs to.",
    }).pipe(pg.integer(), pg.columnName("account_generation")),
    materializedAt: S.Array(BudgetInstant)
      .check(S.isMaxLength(64))
      .annotateKey({ description: "Consumed-turn instants inside the 48-hour horizon." })
      .pipe(S.withConstructorDefault(Effect.succeed(emptyInstants)), pg.jsonb(), pg.columnName("materialized_at")),
    reservations: S.Array(ProactiveBudgetReservation)
      .check(S.isMaxLength(16))
      .annotateKey({ description: "Outstanding reservations, at most 16." })
      .pipe(
        S.withConstructorDefault(Effect.succeed(A.empty<ProactiveBudgetReservation>())),
        pg.jsonb(),
        pg.columnName("reservations"),
      ),
  },
  $I.annote("ProactiveBudgetState", {
    description: "Private server accounting for proactive agent turns.",
  }),
  (columns) => [
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    Table.check("materialized_at_max")(
      sql<boolean>`jsonb_typeof(${columns.materializedAt}) = 'array' and jsonb_array_length(${columns.materializedAt}) <= 64`,
    ),
    Table.check("reservations_max")(
      sql<boolean>`jsonb_typeof(${columns.reservations}) = 'array' and jsonb_array_length(${columns.reservations}) <= 16`,
    ),
  ],
) {
}

/**
 * Encoded form of {@link ProactiveBudgetState}.
 *
 * @see {@link ProactiveBudgetState} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveBudgetState {
  export type Encoded = S.Codec.Encoded<typeof ProactiveBudgetState>;
}

/**
 * Raised when a proactive turn would exceed the daily or rolling limit.
 *
 * **Example** (Name the exhaustion)
 *
 * ```ts
 * import { ProactiveBudgetExhausted } from "./ProactiveBudget.ts"
 *
 * const error = ProactiveBudgetExhausted.make({ reason: "proactive turn budget exhausted" })
 * console.log(error.reason) // "proactive turn budget exhausted"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProactiveBudgetExhausted extends S.TaggedError<ProactiveBudgetExhausted>()(
  "ProactiveBudgetExhausted",
  {
    reason: S.String,
  },
  $I.annoteError<ProactiveBudgetExhausted>("ProactiveBudgetExhausted", {
    description: "A proactive turn reservation was refused because the budget is exhausted.",
  }),
) {
}

/**
 * Encoded form of {@link ProactiveBudgetExhausted}.
 *
 * @see {@link ProactiveBudgetExhausted} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ProactiveBudgetExhausted {
  export type Encoded = S.Codec.Encoded<typeof ProactiveBudgetExhausted>;
}

const zoneSuffix = (value: string): O.Option<string> => {
  if (Str.endsWith("Z")(value)) return O.some("Z");
  const matched = /([+-][0-9]{2}:[0-9]{2})$/.exec(value);
  const suffix = matched === null ? undefined : matched[1];
  return suffix === undefined ? O.none() : O.some(suffix);
};

const offsetMillis = (suffix: string): number => {
  const sign = Str.startsWith("+")(suffix) ? 1 : -1;
  const hours = Number(Str.slice(1, 3)(suffix));
  const minutes = Number(Str.slice(4, 6)(suffix));
  return sign * (hours * 60 + minutes) * 60 * 1000;
};

const instantMillis = (value: string): number => DateTime.makeUnsafe(value).pipe(DateTime.toUtc, DateTime.toEpochMillis);

const wallDate = (value: string): string => Str.takeLeft(value, 10);

const formatExpiry = (now: string): string => {
  const next = DateTime.add(DateTime.toUtc(DateTime.makeUnsafe(now)), { hours: 24 });
  const zone = zoneSuffix(now);
  if (O.isNone(zone) || zone.value === "Z") return DateTime.formatIso(next);
  const zoned = DateTime.makeZonedUnsafe(next, { timeZone: DateTime.zoneMakeOffset(offsetMillis(zone.value)) });
  return DateTime.formatIsoOffset(zoned);
};

/**
 * Drop expired reservations and materializations outside the 48-hour horizon.
 *
 * **Details**
 *
 * A reservation stays while its expiry is strictly after `now`. A materialized
 * turn stays while its instant is at least `now` minus 48 hours. The original
 * instant strings are preserved.
 *
 * **Example** (Drop a stale materialization)
 *
 * ```ts
 * import { ProactiveBudgetState, normalizedBudgetState } from "./ProactiveBudget.ts"
 *
 * const state = ProactiveBudgetState.make({
 *   accountGeneration: 0,
 *   materializedAt: ["2020-01-01T00:00:00.000Z"],
 * })
 * const normalized = normalizedBudgetState(state, "2020-01-03T03:04:05.000Z")
 * console.log(normalized.materializedAt.length) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const normalizedBudgetState: {
  (state: ProactiveBudgetState, now: string): ProactiveBudgetState,
  (now: string): (state: ProactiveBudgetState) => ProactiveBudgetState
} = dual(2, (state: ProactiveBudgetState, now: string): ProactiveBudgetState => {
  const nowMillis = instantMillis(now);
  const oldest = nowMillis - 48 * 60 * 60 * 1000;
  return ProactiveBudgetState.make({
    accountGeneration: state.accountGeneration,
    materializedAt: A.filter(state.materializedAt, (value) => instantMillis(value) >= oldest),
    reservations: A.filter(state.reservations, (reservation) => instantMillis(reservation.expiresAt) > nowMillis),
  });
});

/**
 * Report whether one more agent judgment may be evaluated.
 *
 * **Details**
 *
 * Outstanding reservations count against both the daily cap and the rolling
 * 30-minute cap. The daily cap uses each instant's wall-clock date, not the
 * UTC date of an aware offset. Receipts are not written here.
 *
 * **Example** (Allow an empty budget)
 *
 * ```ts
 * import { ProactiveBudgetState, budgetAllows } from "./ProactiveBudget.ts"
 *
 * const allowed = budgetAllows(ProactiveBudgetState.make({ accountGeneration: 0 }), "2020-01-02T03:04:05.000Z")
 * console.log(allowed) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const budgetAllows: {
  (state: ProactiveBudgetState, now: string): boolean,
  (now: string): (state: ProactiveBudgetState) => boolean
} = dual(2, (state: ProactiveBudgetState, now: string): boolean => {
  const normalized = normalizedBudgetState(state, now);
  const today = wallDate(now);
  const nowMillis = instantMillis(now);
  const recentFloor = nowMillis - 30 * 60 * 1000;
  const dailyTurns = A.filter(normalized.materializedAt, (value) => wallDate(value) === today).length;
  const recentTurns = A.filter(normalized.materializedAt, (value) => instantMillis(value) > recentFloor).length;
  const reservedTurns = normalized.reservations.length;
  return (
    dailyTurns + reservedTurns < DAILY_PROACTIVE_TURN_LIMIT &&
    recentTurns + reservedTurns < ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT
  );
});

/**
 * Reserve one budget slot for an agent-tier intent.
 *
 * **Details**
 *
 * The reservation is idempotent per intent id. Expiry is 24 hours after `now`,
 * keeping an aware offset when `now` has one. A second distinct intent is
 * refused when either limit is already reached.
 *
 * **Example** (Reserve once)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { ProactiveBudgetState, reserveBudget } from "./ProactiveBudget.ts"
 *
 * const reserved = Effect.runSync(
 *   reserveBudget(ProactiveBudgetState.make({ accountGeneration: 0 }), "intent-1", "2020-01-02T03:04:05.000Z"),
 * )
 * console.log(reserved.reservations.length) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const reserveBudget = Effect.fn("ProactiveBudget.reserveBudget")(function* (
  state: ProactiveBudgetState,
  intentId: string,
  now: string,
) {
  const normalized = normalizedBudgetState(state, now);
  if (A.some(normalized.reservations, (reservation) => reservation.intentId === intentId)) return normalized;
  if (!budgetAllows(normalized, now)) {
    return yield* ProactiveBudgetExhausted.make({ reason: "proactive turn budget exhausted" });
  }
  return ProactiveBudgetState.make({
    ...normalized,
    reservations: A.append(
      normalized.reservations,
      ProactiveBudgetReservation.make({
        intentId,
        expiresAt: formatExpiry(now),
      }),
    ),
  });
});

/**
 * Convert a reservation into a consumed turn after a kernel receipt.
 *
 * **Details**
 *
 * When the intent is still reserved, that reservation is removed and `now` is
 * appended to the materialized instants. A receipt that arrives after the
 * reservation TTL still counts once: the materialized list grows and the
 * already-empty reservation list is left alone. `now` is stored unchanged.
 *
 * **Example** (Count a late receipt)
 *
 * ```ts
 * import { ProactiveBudgetState, accountMaterialization } from "./ProactiveBudget.ts"
 *
 * const accounted = accountMaterialization(
 *   ProactiveBudgetState.make({ accountGeneration: 0 }),
 *   "intent-1",
 *   "2020-01-02T03:04:05.000Z",
 * )
 * console.log(accounted.materializedAt.length) // 1
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const accountMaterialization: {
  (state: ProactiveBudgetState, intentId: string, now: string): ProactiveBudgetState,
  (intentId: string, now: string): (state: ProactiveBudgetState) => ProactiveBudgetState
} = dual(3, (state: ProactiveBudgetState, intentId: string, now: string): ProactiveBudgetState => {
  const normalized = normalizedBudgetState(state, now);
  const reservations = A.some(normalized.reservations, (reservation) => reservation.intentId === intentId)
    ? A.filter(normalized.reservations, (reservation) => reservation.intentId !== intentId)
    : normalized.reservations;
  return ProactiveBudgetState.make({
    ...normalized,
    reservations,
    materializedAt: A.append(normalized.materializedAt, now),
  });
});
