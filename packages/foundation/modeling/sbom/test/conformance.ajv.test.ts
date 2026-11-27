import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { Component, Contact, ExternalReference, NtiaReport, Sbom, SbomInput, SbomMetadata, Supplier } from "@beep/sbom";
import { License } from "@beep/spdx";
import { assert, describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { cycloneDxViolations } from "./support/cyclonedx.ts";

const parseJson = S.decodeUnknownResult(S.fromJsonString(S.Unknown));

const emitted = (input: SbomInput.Admitted): unknown => Result.getOrThrow(parseJson(Sbom.toJson(Sbom.generate(input))));

const full: SbomInput.Admitted = {
  root: Component.make({
    type: "library",
    name: "@acme/kit",
    version: "0.1.0",
    purl: "pkg:npm/%40acme/kit@0.1.0",
    bomRef: "@acme/kit@0.1.0",
    description: "supply-chain artifacts",
    licenses: ["MIT"],
    tags: ["sbom", "cyclonedx"],
    publisher: "Acme",
    copyright: "Copyright 2026 Acme",
    authors: [Contact.make({ name: "Dee", email: "dee@example.com", phone: "+1 555 0100" })],
    externalReferences: [
      ExternalReference.make({ type: "vcs", url: "https://github.com/acme/kit" }),
      ExternalReference.make({ type: "issue-tracker", url: "https://github.com/acme/kit/issues" }),
      ExternalReference.make({ type: "website", url: "https://acme.example" }),
      ExternalReference.make({ type: "documentation", url: "https://acme.example/docs" }),
    ],
  }),
  components: [
    Component.make({ type: "library", name: "dep", version: "1.0.0", licenses: ["MIT OR Apache-2.0"] }),
    Component.make({ type: "framework", name: "named", licenses: ["Proprietary", "MIT"] }),
  ],
  metadata: SbomMetadata.make({
    timestamp: "2026-07-25T00:00:00.000Z",
    authors: [Contact.make({ name: "Ray" })],
    supplier: Supplier.make({ name: "Acme", url: ["https://acme.example"], contact: [Contact.make({ name: "Ops" })] }),
  }),
};

const EpochMillisBefore2100 = S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThan(4_102_444_800_000));

const sameComponent = S.toEquivalence(Component);

const isComponentsDocument = S.is(S.Struct({ components: S.Array(S.Record(S.String, S.Unknown)) }));

const validInput = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(SbomInput), Arbitrary.schema(EpochMillisBefore2100)]),
  ([input, millis]): SbomInput.Admitted => ({
    ...input,
    components: A.dedupeWith(input.components, sameComponent),
    ...(input.metadata !== undefined && {
      metadata: { ...input.metadata, timestamp: DateTime.formatIso(DateTime.makeUnsafe(millis)) },
    }),
  })
);

describe("CycloneDX 1.6 conformance — the whole vendored schema", () => {
  it("validates the document exercising every emitted field", () => {
    assert.deepStrictEqual(cycloneDxViolations(emitted(full)), []);
  });

  it.effect.prop(
    "validates every document generated from a valid input",
    [validInput],
    ([input]) =>
      Effect.sync(() => {
        assert.deepStrictEqual(
          cycloneDxViolations(emitted(input)),
          [],
          "a valid input has an RFC 3339 timestamp and no exact duplicate components, where the model is lenient"
        );
      }),
    { arbitrary: fcRuns(200) }
  );

  it("validates every catalog id @beep/spdx knows against the vendored SPDX enumeration", () => {
    const licenses = License.catalog.pipe(HashMap.keys, A.fromIterable);
    assert.isAbove(licenses.length, 0);
    const document = emitted({ root: Component.make({ type: "library", name: "x", licenses }), components: [] });
    assert.deepStrictEqual(
      cycloneDxViolations(document),
      [],
      "license.id refs spdx.SNAPSHOT.schema.json, so a catalog id unknown to that release is invalid"
    );
  });

  it("the SPDX enumeration is live: an id outside it fails", () => {
    const document = emitted(full);
    assertTrue(isComponentsDocument(document));
    const broken = {
      ...document,
      components: A.map(document.components, (component) => ({
        ...component,
        licenses: [{ license: { id: "Not-An-Spdx-Id" } }],
      })),
    };
    assert.include(cycloneDxViolations(broken), "/components/0/licenses/0/license/id enum");
  });

  it("the validator is live: a document without a component name fails", () => {
    const document = emitted(full);
    assertTrue(isComponentsDocument(document));
    const broken = { ...document, components: A.map(document.components, ({ name: _name, ...rest }) => rest) };
    assert.include(
      cycloneDxViolations(broken),
      "/components/0 required",
      "the control: a validator that accepts everything would pass the property"
    );
  });

  it("pins the timestamp gap: an unparseable timestamp emits an invalid document, and NTIA reports it", () => {
    const input: SbomInput.Admitted = {
      ...full,
      metadata: SbomMetadata.make({ ...full.metadata, timestamp: "last tuesday" }),
    };
    assert.include(cycloneDxViolations(emitted(input)), "/metadata/timestamp format");
    assertFalse(
      NtiaReport.of(Sbom.generate(input)).compliant,
      "a timestamp passes through verbatim; NtiaReport is where an unusable one is reported"
    );
    assert.include(NtiaReport.of(Sbom.generate(input)).missing, "timestamp");
  });

  it("pins the duplicate gap: exact duplicate components emit an invalid document", () => {
    const dep = Component.make({ type: "library", name: "dep", version: "1.0.0" });
    assert.include(
      cycloneDxViolations(emitted({ root: full.root, components: [dep, dep] })),
      "/components uniqueItems"
    );
  });

  it("refuses an empty bomRef at construction, as the schema's refType does", () => {
    assert.throws(() => Component.make({ type: "library", name: "x", bomRef: "" }));
    assertFalse(S.is(Component)({ type: "library", name: "x", bomRef: "" }), "the schema refType has minLength: 1");
  });
});
