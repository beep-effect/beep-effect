import { PandocDecodeError } from "@beep/pandoc-ast/Pandoc.codec";
import { PandocMappingError } from "@beep/pandoc-ast/Pandoc.mapping";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const expectOpaqueCauseIgnored = <Schema extends S.Top>(
  schema: Schema,
  first: Schema["Type"],
  second: Schema["Type"],
  different: Schema["Type"]
): void => {
  const same = S.toEquivalence(schema);

  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("@beep/pandoc-ast tagged-error declared equivalence", () => {
  it("compares decode and mapping errors by message while ignoring cause", () => {
    expectOpaqueCauseIgnored(
      PandocDecodeError,
      PandocDecodeError.make({ cause: { side: "left" }, message: "Decode failed" }),
      PandocDecodeError.make({ cause: { side: "right" }, message: "Decode failed" }),
      PandocDecodeError.make({ cause: { side: "left" }, message: "Wire decode failed" })
    );
    expectOpaqueCauseIgnored(
      PandocMappingError,
      PandocMappingError.make({ cause: { side: "left" }, message: "Mapping failed" }),
      PandocMappingError.make({ cause: { side: "right" }, message: "Mapping failed" }),
      PandocMappingError.make({ cause: { side: "left" }, message: "Projection failed" })
    );
  });
});
