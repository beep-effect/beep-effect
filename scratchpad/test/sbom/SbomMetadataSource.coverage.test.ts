import { assert, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { Package } from "../../effected/package-json/Package.ts";
import { Contact, Supplier } from "../../effected/sbom/SbomDocument.ts";
import { SbomMetadataSource } from "../../effected/sbom/SbomMetadataSource.ts";

it.effect("projects maintainer contact names with and without an email", () => Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "example", version: "1.0.0", maintainers: [{ name: "No email" }, { name: "Email", email: "dev@example.com" }] });
  assert.deepStrictEqual(SbomMetadataSource.rootComponent(pkg).authors, [Contact.make({ name: "No email" }), Contact.make({ name: "Email", email: "dev@example.com" })]);
}));

// The private constructor prevents typed construction; JavaScript can still
// construct reflectively, without acquiring any instance derivation methods.
it.effect("keeps metadata derivation on the static facade after reflective construction", () => Effect.sync(() => {
  const instance: unknown = Reflect.construct(SbomMetadataSource, []);
  assertTrue(instance instanceof SbomMetadataSource);
  assert.notProperty(instance, "fromPackage");
  assert.notProperty(instance, "rootComponent");
  assert.notProperty(instance, "npmPurl");
  assert.strictEqual(SbomMetadataSource.npmPurl("example", "1.0.0"), "pkg:npm/example@1.0.0");
}));

it.effect.prop("preserves every supplied supplier URL when deriving document metadata", [Arbitrary.schema(S.String.pipe(S.Array))], ([urls]) => Effect.gen(function* () {
  const pkg = yield* Package.decode({ name: "example", version: "1.0.0" });
  const supplier = Supplier.make({ name: "Example", url: urls });
  const metadata = SbomMetadataSource.fromPackage(pkg, { supplier });
  assert.instanceOf(metadata.supplier, Supplier);
  assert.strictEqual(metadata.supplier?.name, supplier.name);
  assert.deepStrictEqual(metadata.supplier?.url, urls);
  assert.deepStrictEqual(supplier.url, urls);
}), { arbitrary: fcRuns(100) });
