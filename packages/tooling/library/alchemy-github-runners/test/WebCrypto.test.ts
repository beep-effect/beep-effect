import { constantTimeEqual, hmacSha256Hex } from "@beep/alchemy-github-runners/WebCrypto";
import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("hmacSha256Hex", () => {
  it.effect("matches the RFC 4231 test case 2 vector", () =>
    Effect.gen(function* () {
      const mac = yield* hmacSha256Hex("Jefe", "what do ya want for nothing?");
      expect(mac).toBe("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843");
    })
  );
});

describe("constantTimeEqual", () => {
  it("compares equal, unequal and different-length strings", () => {
    expect([
      constantTimeEqual("sha256=ab", "sha256=ab"),
      constantTimeEqual("sha256=ab", "sha256=ac"),
      constantTimeEqual("sha256=ab", "sha256=abc"),
    ]).toStrictEqual([true, false, false]);
  });
});
