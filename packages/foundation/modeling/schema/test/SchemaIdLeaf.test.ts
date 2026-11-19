import { $SchemaId } from "@beep/identity/packages";
import { LiteralKitKeyCollisionError } from "@beep/schema/LiteralKit";
import { CspError } from "@beep/schema/SecureHeaderError";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Str from "effect/String";

// `@beep/schema` modules take `$SchemaId` from the package-local leaf `src/internal/SchemaId.ts`.
// The package exports no `internal/*` path, so this test reads the leaf through identifiers that
// modules built on it mint. Each must sit under the registry composer for the same slug, which
// catches a leaf whose slug or root drifted from the registry without tying the check to one
// module's segment names. `beep lint identity-registry` keeps the leaf's `create` slug equal to
// the package's registry slug.
describe("@beep/schema identity leaf", () => {
  it("mints identifiers under the registry's $SchemaId", () => {
    const minted = [LiteralKitKeyCollisionError.identifier, CspError.identifier];

    expect({
      root: $SchemaId.identifier,
      outside: A.filter(minted, (identifier) => !Str.startsWith(`${$SchemaId.identifier}/`)(identifier)),
    }).toStrictEqual({ root: "@beep/schema", outside: [] });
  });

  it("derives the same identifier the registry composer derives for a module segment", () => {
    expect(CspError.identifier).toBe($SchemaId.create("SecureHeaderError").make("CspError"));
  });
});
