import { productEntityFixtureInput, systemPrincipal } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";

describe("entity test helpers", () => {
  it("builds deterministic base entity fixture input", () => {
    expect(productEntityFixtureInput("Example", 41)).toEqual({
      createdAt: 41,
      createdByPrincipal: systemPrincipal,
      entityType: "Example",
      id: 41,
      orgId: 1,
      publicId: "example_a41",
      rowVersion: 1,
      schemaVersion: "0.0.0",
      source: "System",
      updatedAt: 42,
      updatedByPrincipal: systemPrincipal,
    });
  });

  it("supports data-last fixture construction", () => {
    expect(productEntityFixtureInput(7)("Widget").entityType).toBe("Widget");
  });
});
