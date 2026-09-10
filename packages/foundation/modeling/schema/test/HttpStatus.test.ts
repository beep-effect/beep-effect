import { fcRuns } from "@beep/fc-runs";
import { HttpStatusCode as RootHttpStatusCode } from "@beep/schema";
import * as HttpStatus from "@beep/schema/HttpStatus";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";

const decodeHttpStatusHttpStatus1XXSync = S.decodeSync(HttpStatus.HttpStatus1XX);
const decodeHttpStatusHttpStatus2XXSync = S.decodeSync(HttpStatus.HttpStatus2XX);
const decodeHttpStatusHttpStatus3XXSync = S.decodeSync(HttpStatus.HttpStatus3XX);
const decodeHttpStatusHttpStatus4XXSync = S.decodeSync(HttpStatus.HttpStatus4XX);
const decodeHttpStatusHttpStatus5XXSync = S.decodeSync(HttpStatus.HttpStatus5XX);
const decodeHttpStatusHttpStatusUnofficialSync = S.decodeSync(HttpStatus.HttpStatusUnofficial);
const decodeHttpStatusSchemaSync = S.decodeSync(HttpStatus.Schema);
const encodeHttpStatusSchemaSync = S.encodeSync(HttpStatus.Schema);

describe("HttpStatus", () => {
  it("accepts the complete standard three-digit status range", () => {
    expect(RootHttpStatusCode).toBe(HttpStatus.HttpStatusCode);
    expect(HttpStatus.HttpStatusCode.decodeUnknownOption(100)).toStrictEqual(O.some(100));
    expect(HttpStatus.HttpStatusCode.decodeUnknownOption(599)).toStrictEqual(O.some(599));
    expect(O.isNone(HttpStatus.HttpStatusCode.decodeUnknownOption(99))).toBe(true);
    expect(O.isNone(HttpStatus.HttpStatusCode.decodeUnknownOption(600))).toBe(true);
  });

  it("decodes and encodes status names through the canonical schema", () => {
    expect(decodeHttpStatusSchemaSync("Ok")).toBe(200);
    expect(encodeHttpStatusSchemaSync(404)).toBe("NotFound");
  });

  it("round-trips every status code derived from the source schema", () => {
    const arbitrary = Arbitrary.schema(HttpStatus.Schema);

    expect(
      Effect.runSync(
        Arbitrary.checkEffect(
          Arbitrary.all([arbitrary]),
          ([code]) => {
            const name = encodeHttpStatusSchemaSync(code);
            expect(typeof name).toBe("string");
            expect(decodeHttpStatusSchemaSync(name)).toBe(code);

            return true;
          },
          fcRuns(50)
        )
      )
    ).toMatchObject({ _tag: "Passed" });
  });

  it("keeps category aggregate schemas wired across role files", () => {
    expect(decodeHttpStatusHttpStatus1XXSync("Continue")).toBe(100);
    expect(decodeHttpStatusHttpStatus2XXSync("Created")).toBe(201);
    expect(decodeHttpStatusHttpStatus3XXSync("TemporaryRedirect")).toBe(307);
    expect(decodeHttpStatusHttpStatus4XXSync("TooManyRequests")).toBe(429);
    expect(decodeHttpStatusHttpStatus5XXSync("ServiceUnavailable")).toBe(503);
    expect(decodeHttpStatusHttpStatusUnofficialSync("ClientClosedRequest")).toBe(499);
  });
});
