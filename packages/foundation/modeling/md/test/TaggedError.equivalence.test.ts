import { RenderError } from "@beep/md/Md.render";
import { DuplicateFootnoteDefinitionSafetyViolation, ScalarSafetyViolation } from "@beep/md/Md.safe";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("@beep/md tagged-error declared equivalence", () => {
  it("ignores RenderError cause while comparing stable diagnostics", () => {
    expectDeclaredEquivalence(
      RenderError,
      RenderError.make({ adapter: "markdown", cause: { side: "left" }, message: "Render failed" }),
      RenderError.make({ adapter: "markdown", cause: { side: "right" }, message: "Render failed" }),
      RenderError.make({ adapter: "html", cause: { side: "left" }, message: "Render failed" })
    );
  });

  it("compares scalar and duplicate-footnote violations by declared fields", () => {
    expectDeclaredEquivalence(
      ScalarSafetyViolation,
      ScalarSafetyViolation.make({ path: ["children", 0, "value"] }),
      ScalarSafetyViolation.make({ path: ["children", 0, "value"] }),
      ScalarSafetyViolation.make({ path: ["children", 1, "value"] })
    );
    expectDeclaredEquivalence(
      DuplicateFootnoteDefinitionSafetyViolation,
      DuplicateFootnoteDefinitionSafetyViolation.make({ identifier: "note", path: ["children", 1] }),
      DuplicateFootnoteDefinitionSafetyViolation.make({ identifier: "note", path: ["children", 1] }),
      DuplicateFootnoteDefinitionSafetyViolation.make({ identifier: "other", path: ["children", 1] })
    );
  });
});
