import { readFile } from "node:fs/promises";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  ConsumerRedactionFixture,
  canaryBuilders,
  consumerRedactionFixtures,
  SecretScrubFixture,
  secretScrubFixtures,
} from "./fixtures/SecretScrub.fixtures.ts";
import { countCanaries } from "./support/CanaryScan.ts";

class FixtureReadError extends S.TaggedError<FixtureReadError>()("FixtureReadError", { message: S.String }) {}

describe("secret scrub P0 fixture integrity", () => {
  it.effect(
    "stores no contiguous canary in its source and requires all expectation fields",
    Effect.fnUntraced(function* () {
      const source = yield* Effect.tryPromise({
        try: () => readFile(new URL("./fixtures/SecretScrub.fixtures.ts", import.meta.url), "utf8"),
        catch: () => new FixtureReadError({ message: "Could not read fixture source" }),
      });
      expect(A.every(canaryBuilders, (build) => !Str.includes(build())(source))).toBe(true);
      expect(A.every(secretScrubFixtures(), S.is(SecretScrubFixture))).toBe(true);
      expect(A.every(consumerRedactionFixtures(), S.is(ConsumerRedactionFixture))).toBe(true);
      expect(A.length(secretScrubFixtures())).toBe(25);
      expect(A.length(consumerRedactionFixtures())).toBe(7);
    })
  );
  it("proves the exact-canary scanner detects runtime values and repeated occurrences", () => {
    const text = A.join(
      A.map(canaryBuilders, (build) => build()),
      " "
    );
    expect(countCanaries(text, canaryBuilders)).toBe(3);
    expect(countCanaries(`${text} ${text}`, canaryBuilders)).toBe(6);
    expect(countCanaries("[REDACTED]", canaryBuilders)).toBe(0);
  });
});
