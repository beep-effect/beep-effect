import {
  PackageJsonFormat,
  PackageJsonModifyError,
  PackageJsonSyntaxError,
} from "@beep/package-json/PackageJsonFormat";
import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

describe("formatter diagnostic coverage", () => {
  it.effect("reports both syntax reasons and modification paths", () =>
    Effect.gen(function* () {
      assert.strictEqual(
        PackageJsonSyntaxError.make({ reason: "not-an-object" }).message,
        "package.json text is not a JSON object"
      );
      assert.strictEqual(
        PackageJsonSyntaxError.make({ reason: "invalid-json" }).message,
        "package.json text is not valid JSON"
      );

      const scalarOnNavigationPath = yield* Effect.flip(PackageJsonFormat.modify('{"x":1}', ["x", "bad"], 1));
      assert.instanceOf(scalarOnNavigationPath, PackageJsonModifyError);
      assert.strictEqual(scalarOnNavigationPath.message, "Failed to modify package.json at path [x, bad]");
      assert.strictEqual(
        PackageJsonModifyError.make({ path: ["x", 0], cause: "container mismatch" }).message,
        "Failed to modify package.json at path [x, 0]"
      );
      assert.strictEqual(Reflect.construct(PackageJsonFormat, []).constructor, PackageJsonFormat);
    })
  );
});
