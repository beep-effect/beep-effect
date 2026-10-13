import { assert, describe, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { PackageName } from "../../effected/package-json/PackageName.ts";
describe("raw package-name helpers", () => {
  it.effect("a scope marker without a slash has no scope and stays unscoped verbatim", () => Effect.sync(() => {
    assertNone(PackageName.scope("@scope"));
    assert.strictEqual(PackageName.unscoped("@scope"), "@scope");
    assert.strictEqual(PackageName.isValid("@scope"), false);
  }));
});
