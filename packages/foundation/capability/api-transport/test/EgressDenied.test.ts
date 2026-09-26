import { EgressDenied } from "@beep/api-transport";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const decodeEgressDenied = S.decodeUnknownEffect(EgressDenied);
const encodeEgressDenied = S.encodeEffect(EgressDenied);

describe("EgressDenied", () => {
  it.effect(
    "constructs reason-free with only its tag",
    Effect.fnUntraced(function* () {
      const denial = EgressDenied.make({});

      expect(denial._tag).toBe("EgressDenied");
      expect(EgressDenied.is(denial)).toBe(true);
      // Field-free by design: a denial reason surfaced to the caller would be a
      // probing channel, so the error's serialized form carries the tag and
      // nothing else.
      const encoded = yield* encodeEgressDenied(denial);
      expect(Object.keys(encoded)).toEqual(["_tag"]);
    })
  );

  it.effect(
    "round-trips through its schema",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeEgressDenied({ _tag: "EgressDenied" });

      expect(EgressDenied.is(decoded)).toBe(true);
      expect(EgressDenied.is({ _tag: "SomethingElse" })).toBe(false);
    })
  );
});
