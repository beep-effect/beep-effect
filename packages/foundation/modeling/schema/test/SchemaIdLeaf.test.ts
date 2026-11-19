import { $SchemaId } from "@beep/identity/packages";
import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { describe, expect, it } from "@effect/vitest";

// `@beep/schema` modules take `$SchemaId` from the package-local leaf `src/internal/SchemaId.ts`
// (internal, so this test reads it through a module that uses it). The identifier it mints must
// equal the one the registry composer for the same slug derives.
describe("@beep/schema identity leaf", () => {
  it("mints the identifiers the registry's $SchemaId derives", () => {
    expect(LiteralKitKeyCollisionError.identifier).toBe(
      $SchemaId.create("LiteralKit/LiteralKit.errors").make("LiteralKitKeyCollisionError")
    );
  });
});
