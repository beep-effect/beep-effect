import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Package } from "../../effected/package-json/Package.ts";
import { Contact } from "../../effected/sbom/SbomDocument.ts";
import { SbomMetadataSource } from "../../effected/sbom/SbomMetadataSource.ts";

it.effect("projects maintainer contact names with and without an email", () => Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "example", version: "1.0.0", maintainers: [{ name: "No email" }, { name: "Email", email: "dev@example.com" }] });
  assert.deepStrictEqual(SbomMetadataSource.rootComponent(pkg).authors, [Contact.make({ name: "No email" }), Contact.make({ name: "Email", email: "dev@example.com" })]);
}));
