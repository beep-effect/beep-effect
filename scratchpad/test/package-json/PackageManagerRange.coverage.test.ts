import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { PackageManagerRange } from "../../effected/package-json/PackageManagerRange.ts";
describe("whitespace package-manager ranges", () => {
  it.effect("a newline-only wildcard range has no single comparator", () => Effect.gen(function* () {
    const value = yield* PackageManagerRange.parse("pnpm@\n");
    assertNone(value.operator);
    assertNone(value.baseVersion);
    assert.strictEqual(value.toString(), "pnpm@\n");
  }));
});
