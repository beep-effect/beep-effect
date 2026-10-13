import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { PackageJsonFormat, PackageJsonModifyError, PackageJsonSyntaxError } from "../../effected/package-json/PackageJsonFormat.ts";
describe("formatter diagnostic coverage", () => {
  it.effect("reports both syntax reasons and modification paths", () => Effect.gen(function* () {
    assert.strictEqual(PackageJsonSyntaxError.make({ reason: "not-an-object" }).message, "package.json text is not a JSON object");
    assert.strictEqual(PackageJsonSyntaxError.make({ reason: "invalid-json" }).message, "package.json text is not valid JSON");
    
    // A scalar on the navigation path, rather than a missing container, is invalid.
    const invalid = yield* Effect.flip(PackageJsonFormat.modify('{"x":1}', ["x", "bad"], 1));
    assert.instanceOf(invalid, PackageJsonModifyError);
    assert.strictEqual(invalid.message, "Failed to modify package.json at path [x, bad]");
    assert.strictEqual(PackageJsonModifyError.make({ path: ["x", 0], cause: "container mismatch" }).message, "Failed to modify package.json at path [x, 0]");
    assert.strictEqual(Reflect.construct(PackageJsonFormat, []).constructor, PackageJsonFormat);
  }));
});
