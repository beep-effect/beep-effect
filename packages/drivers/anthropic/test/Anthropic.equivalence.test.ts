import { RepairError } from "@beep/anthropic";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const sameRepairError = S.toEquivalence(RepairError);

describe("Anthropic declared-field equivalence", () => {
  it("treats field-equal RepairError instances as equivalent and field-different ones as distinct", () => {
    const a = RepairError.make({ message: "repair call failed", operation: "generate_tool_json" });
    const b = RepairError.make({ message: "repair call failed", operation: "generate_tool_json" });
    const c = RepairError.make({ message: "repair call failed again", operation: "generate_tool_json" });

    expect(sameRepairError(a, b)).toBe(true);
    expect(sameRepairError(a, c)).toBe(false);
  });
});
