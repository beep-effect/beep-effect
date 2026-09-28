import * as WorkPriority from "@beep/architecture-lab-domain/values/WorkPriority";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("WorkPriority value object", () => {
  it("ranks reusable WorkItem priorities", () => {
    expect(WorkPriority.defaultWorkPriority).toBe("normal");
    expect(WorkPriority.rank("low")).toBeLessThan(WorkPriority.rank("high"));
    expect(WorkPriority.compare("high", "normal")).toBeGreaterThan(0);
  });
});
