import * as HttpStatus from "@beep/schema/HttpStatus";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("HttpStatus", () => {
  it("decodes and encodes status names through the canonical schema", () => {
    expect(S.decodeSync(HttpStatus.Schema)("Ok")).toBe(200);
    expect(S.encodeSync(HttpStatus.Schema)(404)).toBe("NotFound");
  });

  it("round-trips every status code derived from the source schema", () => {
    const decode = S.decodeSync(HttpStatus.Schema);
    const encode = S.encodeSync(HttpStatus.Schema);
    const arbitrary = S.toArbitrary(HttpStatus.Schema);

    fc.assert(
      fc.property(arbitrary, (code) => {
        const name = encode(code);
        expect(typeof name).toBe("string");
        expect(decode(name)).toBe(code);
      }),
      { numRuns: 50 }
    );
  });

  it("keeps category aggregate schemas wired across role files", () => {
    expect(S.decodeSync(HttpStatus.HttpStatus1XX)("Continue")).toBe(100);
    expect(S.decodeSync(HttpStatus.HttpStatus2XX)("Created")).toBe(201);
    expect(S.decodeSync(HttpStatus.HttpStatus3XX)("TemporaryRedirect")).toBe(307);
    expect(S.decodeSync(HttpStatus.HttpStatus4XX)("TooManyRequests")).toBe(429);
    expect(S.decodeSync(HttpStatus.HttpStatus5XX)("ServiceUnavailable")).toBe(503);
    expect(S.decodeSync(HttpStatus.HttpStatusUnofficial)("ClientClosedRequest")).toBe(499);
  });
});
