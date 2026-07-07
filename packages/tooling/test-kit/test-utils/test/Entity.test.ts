import { baseEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";

describe("entity test helpers", () => {
  it("builds deterministic base entity fixture input", () => {
    expect(baseEntityFixtureInput("Example", 41)).toEqual({
      createdAt: 41,
      createdByPrincipal: systemPrincipal,
      entityType: "Example",
      id: 41,
      orgId: 1,
      rowVersion: 1,
      schemaVersion: "0.0.0",
      source: "System",
      updatedAt: 42,
      updatedByPrincipal: systemPrincipal,
    });
  });

  it("supports data-last fixture construction", () => {
    expect(baseEntityFixtureInput(7)("Widget").entityType).toBe("Widget");
  });
});
