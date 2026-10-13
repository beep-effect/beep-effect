import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { SectionRenderError } from "../../effected/templates/SectionDialect.ts";
describe("SectionRenderError messages", () => {
  it.effect("explains every rendering refusal with its key and optional attribute", () => Effect.sync(() => {
    const cases = [
      [SectionRenderError.make({ reason: "markerInContent", key: "tool" }), 'Section "tool" has content containing a managed-section marker'],
      [SectionRenderError.make({ reason: "unknownCommentStyle", key: "tool" }), 'Section "tool" uses a comment style this dialect does not recognize'],
      [SectionRenderError.make({ reason: "duplicateDeclaration", key: "tool" }), 'Section "tool" was declared twice in one call'],
      [SectionRenderError.make({ reason: "invalidAttribute", key: "tool" }), 'Section "tool" declares an attribute with an invalid name or value'],
      [SectionRenderError.make({ reason: "invalidAttribute", key: "tool", attribute: "run" }), 'Section "tool" declares attribute "run" with an invalid name or value'],
    ] as const;
    for (const [error, message] of cases) assert.strictEqual(error.message, message);
  }));
});
