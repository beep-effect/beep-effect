import * as Model from "@beep/schema/Model";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, SchemaParser } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("Model optional helpers", () => {
  it("decodes optional nullable JSON keys into Option values and encodes them back", () => {
    const Struct = S.Struct({
      value: Model.optionalOption(S.String),
    });

    expect(S.decodeUnknownSync(Struct)({}).value).toEqual(O.none());
    expect(S.decodeUnknownSync(Struct)({ value: null }).value).toEqual(O.none());
    expect(S.decodeUnknownSync(Struct)({ value: "kept" }).value).toEqual(O.some("kept"));

    expect(S.encodeSync(Struct)({ value: O.none() })).toEqual({});
    expect(S.encodeSync(Struct)({ value: O.some("encoded") })).toEqual({
      value: "encoded",
    });
  });

  it("round-trips Option values derived from the source schema", () => {
    const Struct = S.Struct({
      value: Model.optionalOption(S.String),
    });
    const arbitrary = S.toArbitrary(Struct);
    const decode = S.decodeUnknownSync(Struct);
    const encode = S.encodeSync(Struct);

    fc.assert(
      fc.property(arbitrary, (value) => {
        expect(decode(encode(value))).toEqual(value);
      }),
      { numRuns: 50 }
    );
  });
});

describe("Model projection helpers", () => {
  it("exports the upstream-compatible Overrideable spelling", () => {
    expect(Model.Overrideable).toBe(Model.Overridable);
  });

  it("stores JsonFromString database variants as JSON text", () => {
    const Fields = Model.Struct({
      payload: Model.JsonFromString(
        S.Struct({
          enabled: S.Boolean,
        })
      ),
    });
    const select = Model.extract(Fields, "select");
    const json = Model.extract(Fields, "json");

    expect(S.decodeUnknownSync(select)({ payload: '{"enabled":true}' })).toEqual({
      payload: {
        enabled: true,
      },
    });
    expect(
      S.encodeSync(select)({
        payload: {
          enabled: true,
        },
      })
    ).toEqual({ payload: '{"enabled":true}' });
    expect(
      S.encodeSync(json)({
        payload: {
          enabled: true,
        },
      })
    ).toEqual({
      payload: {
        enabled: true,
      },
    });
  });

  it.effect(
    "uses constructor defaults without making decoders optional",
    Effect.fnUntraced(function* () {
      const Fields = Model.Struct({
        createdAt: Model.DateTimeInsertFromNumber,
      });
      const insert = Model.extract(Fields, "insert");

      const now = yield* DateTime.now;
      const constructed = yield* SchemaParser.makeEffect(insert)({});
      expect(constructed.createdAt).toEqual(now);

      yield* S.encodeEffect(insert)({
        createdAt: Model.Override(now),
      });

      const error = yield* S.decodeUnknownEffect(insert)({}).pipe(Effect.flip);
      expect(error.message).toContain("createdAt");
    })
  );
});
