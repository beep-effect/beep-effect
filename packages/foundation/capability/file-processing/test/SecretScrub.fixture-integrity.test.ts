import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
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

it.layer(BunFileSystem.layer)("secret scrub P0 fixture integrity", (it) => {
  it.effect(
    "stores no contiguous canary in its source and requires all expectation fields",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(new URL("./fixtures/SecretScrub.fixtures.ts", import.meta.url).pathname);
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
