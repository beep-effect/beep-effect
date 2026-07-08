import { Drizzle, DrizzleError, DrizzleErrorContext, DrizzleOperation, DrizzleRows } from "@beep/drizzle";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import * as assert from "@effect/vitest/utils";
import { Effect, Layer, pipe } from "effect";
import * as Cause from "effect/Cause";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import type { DrizzleClient } from "@beep/drizzle";

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const makeClient = (execute: DrizzleClient["execute"]): DrizzleClient => {
  let client: DrizzleClient;
  client = {
    execute,
    withTransaction: (use) => use(client),
  };
  return client;
};

const DrizzleErrorContextArbitrary = S.toArbitrary(DrizzleErrorContext);
const DrizzleErrorArbitrary = S.toArbitrary(DrizzleError);
const DrizzleRowsArbitrary = S.toArbitrary(DrizzleRows);

describe("DrizzleError", () => {
  it("constructs the single public tagged driver error", () => {
    const error = DrizzleError.make({
      operation: DrizzleOperation.Enum.execute,
    });

    expect(error).toBeInstanceOf(DrizzleError);
    expect(error._tag).toBe("DrizzleError");
    expect(error.operation).toBe("execute");
    expect(O.isNone(error.cause)).toBe(true);
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("normalizes unknown causes into the optional cause field", () => {
    const cause = new Error("driver failed");
    const error = DrizzleError.fromUnknown("withTransaction", cause);

    expect(error.operation).toBe("withTransaction");
    expect(O.isSome(error.cause)).toBe(true);
    expect(O.getOrThrow(error.cause)).toBe(cause);
  });

  it("captures explicit query context", () => {
    const error = DrizzleError.fromUnknown(
      "execute",
      new Error("driver failed"),
      DrizzleErrorContext.make({
        query: O.some("select * from users where id = $1"),
        params: O.some([1]),
      })
    );

    expect(O.getOrThrow(error.query)).toBe("select * from users where id = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
  });

  it("returns existing DrizzleError values with redacted params", () => {
    const cause = new Error("driver failed");
    const existing = DrizzleError.make({
      operation: "execute",
      cause: O.some(cause),
      query: O.some("select * from accounts where slug = $1"),
      params: O.some(["<redacted>"]),
    });
    const error = DrizzleError.fromUnknown(
      "withTransaction",
      existing,
      DrizzleErrorContext.make({
        query: O.some("select ignored"),
        params: O.some(["ignored"]),
      })
    );

    expect(error).not.toBe(existing);
    expect(error.operation).toBe("execute");
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.getOrThrow(error.query)).toBe("select * from accounts where slug = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
    expect(error.message).toBe(existing.message);
  });

  it("retains safe native Drizzle query object causes while extracting context", () => {
    const cause = {
      _tag: "EffectDrizzleQueryError",
      query: "select 1",
      params: [],
      cause: new Error("driver failed"),
    };
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(O.getOrThrow(error.query)).toBe("select 1");
    expect(O.getOrThrow(error.params)).toEqual([]);
    expect(O.getOrThrow(error.cause)).toBe(cause);

    const plainCause = { message: "plain driver failure" };
    const plainError = DrizzleError.fromUnknown("execute", plainCause);

    expect(O.getOrThrow(plainError.cause)).toBe(plainCause);
  });

  it("does not throw when native query context getters throw", () => {
    const cause = {
      _tag: "EffectDrizzleQueryError",
      get query(): string {
        throw new Error("query getter failed");
      },
      params: ["alpha"],
      cause: new Error("driver failed"),
    };
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(O.isNone(error.query)).toBe(true);
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
    expect(O.getOrThrow(error.cause)).toBe(cause);
  });

  it("uses referential cycle checks for hostile nested cause objects", () => {
    const nestedCause = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("ownKeys failed");
        },
      }
    );
    const cause = { cause: nestedCause };
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(error).toBeInstanceOf(DrizzleError);
    expect(error.operation).toBe("execute");
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("does not throw when proxied Cause values hide their reasons", () => {
    const nativeCause = {
      _tag: "EffectDrizzleQueryError",
      query: "select * from accounts",
      params: [],
    };
    const cause = new Proxy(Cause.fail(nativeCause), {
      get(target, property, receiver) {
        if (property === "reasons") {
          throw new Error("reasons failed");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(error).toBeInstanceOf(DrizzleError);
    expect(error.operation).toBe("execute");
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("does not retain uninspectable raw proxy causes", () => {
    const cause = new Proxy(
      {},
      {
        get() {
          throw new Error("hostile get");
        },
        getOwnPropertyDescriptor() {
          throw new Error("hostile descriptor");
        },
        getPrototypeOf() {
          throw new Error("hostile prototype");
        },
        ownKeys() {
          throw new Error("hostile keys");
        },
      }
    );
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(error).toBeInstanceOf(DrizzleError);
    expect(error.operation).toBe("execute");
    expect(O.isNone(error.cause)).toBe(true);
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("does not throw when Cause reasons hide their payload", () => {
    const nativeCause = {
      _tag: "EffectDrizzleQueryError",
      query: "select * from accounts",
      params: [],
    };
    const reason = O.getOrThrow(A.head(Cause.fail(nativeCause).reasons));
    const hostileReason = new Proxy(reason, {
      get(target, property, receiver) {
        if (property === "defect" || property === "error") {
          throw new Error("reason payload failed");
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const cause = new Proxy(Cause.fail(nativeCause), {
      get(target, property, receiver) {
        if (property === "reasons") {
          return [hostileReason];
        }
        return Reflect.get(target, property, receiver);
      },
    });
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(error).toBeInstanceOf(DrizzleError);
    expect(error.operation).toBe("execute");
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("unwraps Cause failures to capture native Drizzle query context", () => {
    const nativeCause = {
      _tag: "EffectDrizzleQueryError",
      query: "select * from accounts where slug = $1",
      params: ["alpha, beta"],
      cause: new Error("driver failed"),
    };
    const error = DrizzleError.fromUnknown("execute", Cause.fail(nativeCause));

    expect(O.getOrThrow(error.query)).toBe("select * from accounts where slug = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
  });

  it("returns Cause.fail DrizzleError values with redacted params", () => {
    const cause = new Error("driver failed");
    const existing = DrizzleError.make({
      operation: "execute",
      cause: O.some(cause),
      query: O.some("select * from accounts where slug = $1"),
      params: O.some(["<redacted>"]),
    });
    const error = DrizzleError.fromUnknown(
      "withTransaction",
      Cause.fail(existing),
      DrizzleErrorContext.make({
        query: O.some("select ignored"),
        params: O.some(["ignored"]),
      })
    );

    expect(error).not.toBe(existing);
    expect(error.operation).toBe("execute");
    expect(O.getOrThrow(error.cause)).toBe(cause);
    expect(O.getOrThrow(error.query)).toBe("select * from accounts where slug = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
    expect(error.message).toBe(existing.message);
  });

  it("keeps fallback failed-query params as one opaque diagnostic value", () => {
    const cause = new Error("Failed query: select 1 where payload = $1\nparams: alpha, beta, gamma");
    const error = DrizzleError.fromUnknown("execute", cause);

    expect(O.getOrThrow(error.query)).toBe("select 1 where payload = $1");
    expect(O.getOrThrow(error.params)).toEqual(["<redacted>"]);
  });

  it("decodes an omitted cause as none", () => {
    const error = S.decodeUnknownSync(DrizzleError)({
      _tag: "DrizzleError",
      operation: "execute",
    });

    expect(error.operation).toBe("execute");
    expect(O.isNone(error.cause)).toBe(true);
    expect(O.isNone(error.query)).toBe(true);
    expect(O.isNone(error.params)).toBe(true);
  });

  it("keeps context wire shape while decoding to Option fields", () => {
    const context = DrizzleErrorContext.make({
      query: O.some("select * from accounts where id = $1"),
      params: O.some([123]),
    });
    const encoded = Result.getOrThrow(S.encodeResult(DrizzleErrorContext)(context));
    const decoded = Result.getOrThrow(S.decodeUnknownResult(DrizzleErrorContext)(encoded));

    expect(encoded).toEqual({
      query: "select * from accounts where id = $1",
      params: [123],
    });
    expect(Eq.equals(decoded, context)).toBe(true);
    expect(Result.getOrThrow(S.encodeResult(DrizzleErrorContext)(DrizzleErrorContext.make({})))).toEqual({});
  });

  it("keeps normalized error wire shape while enforcing redacted params", () => {
    const error = DrizzleError.make({
      operation: "execute",
      params: O.some(["<redacted>"]),
    });
    const encoded = Result.getOrThrow(error.pipe(S.encodeResult(DrizzleError)));
    const decoded = Result.getOrThrow(S.decodeUnknownResult(DrizzleError)(encoded));

    expect(encoded).toEqual({
      _tag: "DrizzleError",
      operation: "execute",
      params: ["<redacted>"],
    });
    expect(decoded.operation).toBe(error.operation);
    expect(Eq.equals(decoded.params, error.params)).toBe(true);
    expect(() =>
      S.decodeUnknownSync(DrizzleError)({
        _tag: "DrizzleError",
        operation: "execute",
        params: ["raw"],
      })
    ).toThrow();
  });

  it("decodes product-neutral row arrays from the schema value", () => {
    const rows = DrizzleRows.fromUnknown([{ id: 1 }]);

    expect(rows).toEqual([{ id: 1 }]);
  });

  it("round-trips exported schemas with schema-derived arbitraries", () => {
    fc.assert(
      fc.property(DrizzleErrorContextArbitrary, (context) => {
        const decoded = Result.getOrThrow(
          S.encodeResult(DrizzleErrorContext)(context).pipe(Result.flatMap(S.decodeUnknownResult(DrizzleErrorContext)))
        );

        expect(Eq.equals(decoded, context)).toBe(true);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(DrizzleErrorArbitrary, (error) => {
        const decoded = Result.getOrThrow(
          error.pipe(S.encodeResult(DrizzleError), Result.flatMap(S.decodeUnknownResult(DrizzleError)))
        );

        expect(decoded._tag).toBe(error._tag);
        expect(decoded.operation).toBe(error.operation);
        expect(O.isSome(decoded.cause)).toBe(O.isSome(error.cause));
        expect(Eq.equals(decoded.query, error.query)).toBe(true);
        expect(Eq.equals(decoded.params, error.params)).toBe(true);
      }),
      fcRuns(50)
    );

    fc.assert(
      fc.property(DrizzleRowsArbitrary, (rows) => {
        const decoded = Result.getOrThrow(
          S.encodeResult(DrizzleRows)(rows).pipe(Result.flatMap(S.decodeUnknownResult(DrizzleRows)))
        );

        expect(Eq.equals(decoded, rows)).toBe(true);
      }),
      fcRuns(50)
    );
  });
});

describe("Drizzle", () => {
  it.effect(
    "exposes adapter execute failures as DrizzleError",
    Effect.fnUntraced(function* () {
      const cause = new Error("execute failed");
      const client = makeClient(() => Effect.fail(DrizzleError.fromUnknown("execute", cause)));
      const program = Effect.gen(function* () {
        const drizzle = yield* Drizzle;
        return yield* drizzle.execute("select 1", []);
      });
      const error = yield* pipe(program, provideScopedLayer(Drizzle.makeLayer(client)), Effect.flip);

      assert.assertInstanceOf(error, DrizzleError);
      assert.strictEqual(error.operation, "execute");
      assert.strictEqual(O.getOrThrow(error.cause), cause);
    })
  );

  it.effect(
    "provides execute and transaction through Drizzle.makeLayer",
    Effect.fnUntraced(function* () {
      const transactionClient = makeClient((statement, parameters) => Effect.succeed([statement, parameters]));
      const client: DrizzleClient = {
        execute: (statement, parameters) => Effect.succeed([statement, parameters]),
        withTransaction: (use) => use(transactionClient),
      };
      const program = Effect.gen(function* () {
        const drizzle = yield* Drizzle;
        const executed = yield* drizzle.execute("select 1", ["root"]);
        const transacted = yield* drizzle.withTransaction((transaction) => transaction.execute("select 2", ["tx"]));
        return { executed, transacted };
      });
      const result = yield* pipe(program, provideScopedLayer(Drizzle.makeLayer(client)));

      assert.deepStrictEqual(result.executed, ["select 1", ["root"]]);
      assert.deepStrictEqual(result.transacted, ["select 2", ["tx"]]);
    })
  );

  it.effect(
    "preserves callback failures inside transactions",
    Effect.fnUntraced(function* () {
      const expected = DrizzleError.fromUnknown("withTransaction", new Error("callback failed"));
      const client = makeClient((statement) => Effect.succeed([statement]));
      const program = Effect.gen(function* () {
        const drizzle = yield* Drizzle;
        return yield* drizzle.withTransaction(() => Effect.fail(expected));
      });
      const error = yield* pipe(program, provideScopedLayer(Drizzle.makeLayer(client)), Effect.flip);

      assert.strictEqual(error, expected);
    })
  );

  it.effect(
    "preserves adapter failures from transactions",
    Effect.fnUntraced(function* () {
      const expected = DrizzleError.fromUnknown("withTransaction", new Error("adapter failed"));
      const client: DrizzleClient = {
        execute: (statement) => Effect.succeed([statement]),
        withTransaction: () => Effect.fail(expected),
      };
      const program = Effect.gen(function* () {
        const drizzle = yield* Drizzle;
        return yield* drizzle.withTransaction((transaction) => transaction.execute("select 1", []));
      });
      const error = yield* pipe(program, provideScopedLayer(Drizzle.makeLayer(client)), Effect.flip);

      assert.strictEqual(error, expected);
    })
  );

  it.effect(
    "uses explicit Effect-native transaction callbacks",
    Effect.fnUntraced(function* () {
      const client = makeClient((statement) => Effect.succeed([statement]));
      const program = Effect.gen(function* () {
        const drizzle = yield* Drizzle;
        return yield* drizzle.withTransaction((transaction) => transaction.execute("select 1", []));
      });
      const rows = yield* pipe(program, provideScopedLayer(Drizzle.makeLayer(client)));

      assert.deepStrictEqual(rows, ["select 1"]);
    })
  );
});
