import { DocumentIntakeActionError } from "@beep/documents-use-cases/public";
import { describe, expect, it } from "@effect/vitest";

describe("Document intake errors", () => {
  it("constructs the client-safe intake failure", () => {
    const error = DocumentIntakeActionError.new("Workspace vault is not configured.");

    expect(error._tag).toBe("DocumentIntakeActionError");
    expect(error.message).toBe("Workspace vault is not configured.");
  });
});
