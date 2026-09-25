import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Cause from "effect/Cause";
import * as S from "effect/Schema";
import {
  BudgetInstant,
  DAILY_PROACTIVE_TURN_LIMIT,
  ProactiveBudgetExhausted,
  ProactiveBudgetReservation,
  ProactiveBudgetState,
  ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT,
  accountMaterialization,
  budgetAllows,
  normalizedBudgetState,
  reserveBudget,
} from "../../beep/ProactiveBudget.ts";

const isProactiveBudgetExhausted = S.is(ProactiveBudgetExhausted);

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const now = "2020-01-02T12:00:00Z";

const state = (input: { readonly materializedAt?: ReadonlyArray<string>; readonly reservations?: ReadonlyArray<ProactiveBudgetReservation> } = {}) =>
  ProactiveBudgetState.make({
    accountGeneration: 1,
    materializedAt: input.materializedAt ?? [],
    reservations: input.reservations ?? [],
  });

const reservation = (intentId: string, expiresAt: string) => ProactiveBudgetReservation.make({ intentId, expiresAt });

const minutesBefore = (minutes: number): string =>
  DateTime.formatIso(DateTime.subtract(DateTime.makeUnsafe(now), { minutes }));

describe("ProactiveBudget", () => {
  it("exposes the Python limits", () => {
    assert.strictEqual(DAILY_PROACTIVE_TURN_LIMIT, 10);
    assert.strictEqual(ROLLING_30_MINUTE_PROACTIVE_TURN_LIMIT, 2);
  });

  it("decodes budget instants in naive, Z, and offset forms", () => {
    assert.strictEqual(decode(BudgetInstant, "2020-01-02T03:04:05"), "2020-01-02T03:04:05");
    assert.strictEqual(decode(BudgetInstant, "2020-01-02T03:04:05.250Z"), "2020-01-02T03:04:05.250Z");
    assert.strictEqual(decode(BudgetInstant, "2020-01-02T03:04:05+02:00"), "2020-01-02T03:04:05+02:00");
    assert.strictEqual(decodeFails(BudgetInstant, "2020-01-02"), true);
    assert.strictEqual(decodeFails(BudgetInstant, "not a time"), true);
  });

  it("decodes reservations and states with present values and enforces the list caps", () => {
    const decoded = decode(ProactiveBudgetState, {
      accountGeneration: 3,
      materializedAt: ["2020-01-02T11:00:00Z"],
      reservations: [{ intentId: "i1", expiresAt: "2020-01-03T11:00:00Z" }],
    });
    assert.strictEqual(decoded.accountGeneration, 3);
    assert.strictEqual(decoded.reservations[0]?.intentId, "i1");
    assert.strictEqual(decodeFails(ProactiveBudgetState, { accountGeneration: -1, materializedAt: [], reservations: [] }), true);
    assert.strictEqual(
      decodeFails(ProactiveBudgetState, {
        accountGeneration: 0,
        materializedAt: Array.from({ length: 65 }, () => now),
        reservations: [],
      }),
      true,
    );
    assert.strictEqual(
      decodeFails(ProactiveBudgetState, {
        accountGeneration: 0,
        materializedAt: [],
        reservations: Array.from({ length: 17 }, (_, index) => ({ intentId: `i${index}`, expiresAt: now })),
      }),
      true,
    );
    assert.strictEqual(decodeFails(ProactiveBudgetReservation, { intentId: "", expiresAt: now }), true);
    const made = ProactiveBudgetState.make({ accountGeneration: 0 });
    assert.deepStrictEqual(made.materializedAt, []);
    assert.deepStrictEqual(made.reservations, []);
  });

  it("normalizedBudgetState drops expired reservations and stale materializations", () => {
    const input = state({
      materializedAt: ["2019-12-31T11:59:59Z", "2019-12-31T12:00:00Z", "2020-01-02T11:00:00Z"],
      reservations: [reservation("expired", "2020-01-02T12:00:00Z"), reservation("live", "2020-01-02T12:00:01Z")],
    });
    const normalized = normalizedBudgetState(input, now);
    assert.deepStrictEqual(normalized.materializedAt, ["2019-12-31T12:00:00Z", "2020-01-02T11:00:00Z"]);
    assert.deepStrictEqual(
      normalized.reservations.map((entry) => entry.intentId),
      ["live"],
    );
    assert.strictEqual(normalized.accountGeneration, 1);
    const piped = pipe(input, normalizedBudgetState(now));
    assert.deepStrictEqual(piped.materializedAt, normalized.materializedAt);
    const naive = normalizedBudgetState(state({ materializedAt: ["2020-01-02T11:00:00"] }), "2020-01-02T12:00:00");
    assert.deepStrictEqual(naive.materializedAt, ["2020-01-02T11:00:00"]);
  });

  it("budgetAllows counts reservations against both limits", () => {
    assert.strictEqual(budgetAllows(state(), now), true);
    assert.strictEqual(pipe(state(), budgetAllows(now)), true);
    const oneRecent = state({ materializedAt: [minutesBefore(10)] });
    assert.strictEqual(budgetAllows(oneRecent, now), true);
    const twoRecent = state({ materializedAt: [minutesBefore(10), minutesBefore(20)] });
    assert.strictEqual(budgetAllows(twoRecent, now), false);
    const oldToday = state({ materializedAt: Array.from({ length: 9 }, (_, index) => minutesBefore(60 + index)) });
    assert.strictEqual(budgetAllows(oldToday, now), true);
    const tenToday = state({ materializedAt: Array.from({ length: 10 }, (_, index) => minutesBefore(60 + index)) });
    assert.strictEqual(budgetAllows(tenToday, now), false);
    const reservedRecent = state({
      materializedAt: [minutesBefore(10)],
      reservations: [reservation("r1", "2020-01-03T12:00:00Z")],
    });
    assert.strictEqual(budgetAllows(reservedRecent, now), false);
    const reservedDaily = state({
      materializedAt: Array.from({ length: 9 }, (_, index) => minutesBefore(60 + index)),
      reservations: [reservation("r1", "2020-01-03T12:00:00Z")],
    });
    assert.strictEqual(budgetAllows(reservedDaily, now), false);
    const yesterdayOnly = state({ materializedAt: Array.from({ length: 10 }, (_, index) => `2020-01-01T2${index % 3}:0${index}:00Z`) });
    assert.strictEqual(budgetAllows(yesterdayOnly, now), true);
  });

  it("reserveBudget adds a reservation one day out, is idempotent, and fails when exhausted", () => {
    const reserved = Effect.runSync(reserveBudget(state(), "i1", now));
    assert.strictEqual(reserved.reservations.length, 1);
    assert.strictEqual(reserved.reservations[0]?.intentId, "i1");
    assert.strictEqual(reserved.reservations[0]?.expiresAt, "2020-01-03T12:00:00.000Z");
    const again = Effect.runSync(reserveBudget(reserved, "i1", now));
    assert.strictEqual(again.reservations.length, 1);
    const second = Effect.runSync(reserveBudget(reserved, "i2", now));
    assert.strictEqual(second.reservations.length, 2);
    const exit = Effect.runSyncExit(reserveBudget(second, "i3", now));
    assert.strictEqual(Exit.isFailure(exit), true);
    const reason = Exit.match(exit, {
      onFailure: (cause) =>
        cause.pipe(
          Cause.findErrorOption,
          O.filter(isProactiveBudgetExhausted),
          O.map((error) => error.reason),
          O.getOrElse(() => "other"),
        ),
      onSuccess: () => "success",
    });
    assert.strictEqual(reason, "proactive turn budget exhausted");
    const offset = Effect.runSync(reserveBudget(state(), "i1", "2020-01-02T12:00:00+02:00"));
    assert.strictEqual(offset.reservations[0]?.expiresAt, "2020-01-03T12:00:00.000+02:00");
    const naive = Effect.runSync(reserveBudget(state(), "i1", "2020-01-02T12:00:00"));
    assert.strictEqual(naive.reservations[0]?.expiresAt, "2020-01-03T12:00:00.000Z");
  });

  it("accountMaterialization converts a reservation into a consumed turn and counts late receipts", () => {
    const reserved = Effect.runSync(reserveBudget(state(), "i1", now));
    const counted = accountMaterialization(reserved, "i1", now);
    assert.deepStrictEqual(counted.reservations, []);
    assert.deepStrictEqual(counted.materializedAt, [now]);
    const piped = pipe(reserved, accountMaterialization("i1", now));
    assert.deepStrictEqual(piped.materializedAt, [now]);
    const late = accountMaterialization(state({ reservations: [reservation("other", "2020-01-03T12:00:00Z")] }), "missing", now);
    assert.strictEqual(late.reservations.length, 1);
    assert.deepStrictEqual(late.materializedAt, [now]);
  });

  it("derives arbitraries", () => {
    for (const schema of [BudgetInstant, ProactiveBudgetReservation, ProactiveBudgetState]) {
      assert.notStrictEqual(schema.pipe(Arbitrary.schema), undefined);
    }
  });
});
