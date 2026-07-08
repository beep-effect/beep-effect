import { Did } from "@beep/schema/Did";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const DidArbitrary = S.toArbitrary(Did);
const decodeDid = S.decodeUnknownEffect(Did);

const invalidDidExamples = [
  "",
  "did:",
  "did::abc",
  "DID:example:abc",
  "did:Example:abc",
  "did:exa-mple:abc",
  "did:example:",
  "did:example:abc:",
  "did:example:abc/def",
  "did:example:abc?service=agent",
  "did:example:abc#key-1",
  "did:example:abc%2",
  "did:example:abc%zz",
  "did:example:abc def",
  " did:example:abc",
  "did:example:abc ",
];

describe("Did", () => {
  it.effect("accepts W3C DID Core syntax examples", () =>
    Effect.gen(function* () {
      expect(yield* decodeDid("did:example:123456789abcdefghi")).toBe("did:example:123456789abcdefghi");
      expect(yield* decodeDid("did:plc:ewvi7nxzyoun6zhxrhs64oiz")).toBe("did:plc:ewvi7nxzyoun6zhxrhs64oiz");
      expect(yield* decodeDid("did:web:example.com")).toBe("did:web:example.com");
      expect(yield* decodeDid("did:example:abc%2Fdef")).toBe("did:example:abc%2Fdef");
      expect(yield* decodeDid("did:example:abc:def")).toBe("did:example:abc:def");
    })
  );

  it.effect("rejects malformed DID strings and DID URL components", () =>
    Effect.forEach(
      invalidDidExamples,
      (candidate) =>
        Effect.gen(function* () {
          const error = yield* Effect.flip(decodeDid(candidate));

          expect(error.message).toContain("DID must match W3C DID Core syntax");
        }),
      { discard: true }
    )
  );

  it("derives schema arbitrary values that remain valid DID Core identifiers", () => {
    const isDid = S.is(Did);

    fc.assert(
      fc.property(DidArbitrary, (did) => {
        expect(isDid(did)).toBe(true);
        expect(did).toMatch(/^did:[a-z0-9]+:/u);
        expect(did).not.toMatch(/[/?#\s]/u);
      }),
      { numRuns: 100 }
    );
  });
});
