import { DbAdminMigrationTargets } from "@beep/db-admin";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";

describe("@beep/db-admin", () => {
  it("exports migration targets", () => {
    expect(DbAdminMigrationTargets.length).toBeGreaterThan(0);
  });
});
