import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { SectionParseError } from "../../effected/templates/SectionDocument.ts";
describe("SectionParseError optional context", () => {
  it.effect("describes missing identity and pure string location, then attributes the same error", () => Effect.sync(() => {
    const error = SectionParseError.make({ reason: "orphanedEnd", line: 3 });
    assert.strictEqual(error.message, "End marker closes no open section at line 3");
    const attributed = SectionParseError.at("file", error);
    assert.strictEqual(attributed.message, "End marker closes no open section at file:3");
    assert.strictEqual(attributed.key, undefined);
  }));
});
