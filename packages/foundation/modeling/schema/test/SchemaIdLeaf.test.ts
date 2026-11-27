import { $SchemaId } from "@beep/identity/packages";
import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { CspError } from "@beep/schema/SecureHeaderError";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";

describe("@beep/schema identity leaf", () => {
  it("mints identifiers under the registry's $SchemaId", () => {
    const minted = [LiteralKitKeyCollisionError.identifier, CspError.identifier];

    expect(
      {
        root: $SchemaId.identifier,
        outside: A.filter(minted, (identifier) => !Str.startsWith(`${$SchemaId.identifier}/`)(identifier)),
      },
      "the package exports no internal/* path, so the src/internal/SchemaId.ts leaf is read through identifiers its modules mint"
    ).toStrictEqual({ root: "@beep/schema", outside: [] });
  });

  it("derives the same identifier the registry composer derives for a module segment", () => {
    expect(CspError.identifier, "a leaf whose slug or root drifted from the registry fails here").toBe(
      $SchemaId.create("SecureHeaderError").make("CspError")
    );
  });
});
