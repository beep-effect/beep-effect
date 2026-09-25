import { fcRuns } from "@beep/fc-runs";
import { HttpStatusCode as RootHttpStatusCode } from "@beep/schema";
import * as HttpStatus from "@beep/schema/HttpStatus";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeHttpStatusHttpStatus1XXEffect = S.decodeEffect(HttpStatus.HttpStatus1XX);
const decodeHttpStatusHttpStatus2XXEffect = S.decodeEffect(HttpStatus.HttpStatus2XX);
const decodeHttpStatusHttpStatus3XXEffect = S.decodeEffect(HttpStatus.HttpStatus3XX);
const decodeHttpStatusHttpStatus4XXEffect = S.decodeEffect(HttpStatus.HttpStatus4XX);
const decodeHttpStatusHttpStatus5XXEffect = S.decodeEffect(HttpStatus.HttpStatus5XX);
const decodeHttpStatusHttpStatusUnofficialEffect = S.decodeEffect(HttpStatus.HttpStatusUnofficial);
const decodeHttpStatusSchemaEffect = S.decodeEffect(HttpStatus.Schema);
const encodeHttpStatusSchemaEffect = S.encodeEffect(HttpStatus.Schema);

describe("HttpStatus", () => {
  it("accepts the complete standard three-digit status range", () => {
    expect(RootHttpStatusCode).toBe(HttpStatus.HttpStatusCode);
    assertSome<number>(HttpStatus.HttpStatusCode.decodeUnknownOption(100), 100);
    assertSome<number>(HttpStatus.HttpStatusCode.decodeUnknownOption(599), 599);
    pipe(HttpStatus.HttpStatusCode.decodeUnknownOption(99), O.isNone, assertTrue);
    pipe(HttpStatus.HttpStatusCode.decodeUnknownOption(600), O.isNone, assertTrue);
  });

  it.effect(
    "decodes and encodes status names through the canonical schema",
    Effect.fnUntraced(function* () {
      expect(yield* decodeHttpStatusSchemaEffect("Ok")).toBe(200);
      expect(yield* encodeHttpStatusSchemaEffect(404)).toBe("NotFound");
    })
  );

  {
    const arbitrary = Arbitrary.schema(HttpStatus.Schema);
    it.effect.prop(
      "round-trips every status code derived from the source schema",
      [arbitrary],
      Effect.fnUntraced(function* ([code]) {
        const name = yield* encodeHttpStatusSchemaEffect(code);
        expect(typeof name).toBe("string");
        expect(yield* decodeHttpStatusSchemaEffect(name)).toBe(code);

        return true;
      }),
      { arbitrary: fcRuns(50) }
    );
  }

  it.effect(
    "keeps category aggregate schemas wired across role files",
    Effect.fnUntraced(function* () {
      expect(yield* decodeHttpStatusHttpStatus1XXEffect("Continue")).toBe(100);
      expect(yield* decodeHttpStatusHttpStatus2XXEffect("Created")).toBe(201);
      expect(yield* decodeHttpStatusHttpStatus3XXEffect("TemporaryRedirect")).toBe(307);
      expect(yield* decodeHttpStatusHttpStatus4XXEffect("TooManyRequests")).toBe(429);
      expect(yield* decodeHttpStatusHttpStatus5XXEffect("ServiceUnavailable")).toBe(503);
      expect(yield* decodeHttpStatusHttpStatusUnofficialEffect("ClientClosedRequest")).toBe(499);
    })
  );
});
