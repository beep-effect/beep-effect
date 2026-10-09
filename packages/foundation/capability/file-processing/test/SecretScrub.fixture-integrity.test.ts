import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import {
  ConsumerRedactionFixture,
  canaryBuilders,
  consumerRedactionFixtures,
  SecretScrubFixture,
  secretScrubFixtures,
} from "./fixtures/SecretScrub.fixtures.ts";
import { countCanaries } from "./support/CanaryScan.ts";

describe("secret scrub P0 fixture integrity", () => {
  it("requires every scrub and consumer expectation field", () => {
    expect(A.every(secretScrubFixtures(), S.is(SecretScrubFixture))).toBe(true);
    expect(A.every(consumerRedactionFixtures(), S.is(ConsumerRedactionFixture))).toBe(true);
    expect(A.length(secretScrubFixtures())).toBe(27);
    expect(A.length(consumerRedactionFixtures())).toBe(9);
  });
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
