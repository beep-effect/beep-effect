import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { parseAttributeRun } from "../../../effected/templates/internal/attributes.ts";

describe("attribute run boundary coverage", () => {
  it.effect("refuses incomplete runs instead of accepting a partial record", () => Effect.sync(() => {
    for (const run of ["", 'a="x" ', 'a="x"\t', '9name="x"', '_name="x"', '-name="x"', 'a="unclosed', 'a="', 'a', 'a=x', 'a="x"b="y"', 'a="x" a="y"', 'a="x\ny"', 'a="x\ry"']) {
      assert.strictEqual(parseAttributeRun(run), undefined);
    }
  }));
  it.effect("retains pairs in insertion order across tabs and spaces", () => Effect.sync(() => {
    assert.deepStrictEqual(parseAttributeRun('Z9_-=""\t  a="--- = 😀"'), { "Z9_-": "", a: "--- = 😀" });
  }));
});
