import { Component, Contact, NtiaReport, Sbom, SbomDocument, SbomMetadata, Supplier } from "@beep/sbom";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as O from "effect/Option";
import type { NtiaElementId } from "@beep/sbom";

const root = Component.make({
  type: "library",
  name: "@effected/sbom",
  version: "0.1.0",
  purl: "pkg:npm/%40effected/sbom@0.1.0",
});

const dep = Component.make({ type: "library", name: "dep", version: "1.0.0" });

const compliant = (metadata?: Partial<Parameters<typeof SbomMetadata.make>[0]>) =>
  Sbom.generate({
    root,
    components: [dep],
    metadata: SbomMetadata.make({
      timestamp: "2026-07-25T00:00:00.000Z",
      authors: [Contact.make({ name: "release-bot" })],
      supplier: Supplier.make({ name: "Acme" }),
      ...metadata,
    }),
  });

const elementOf = (document: SbomDocument, id: NtiaElementId) => {
  const found = O.getOrUndefined(A.findFirst(NtiaReport.of(document).elements, (element) => element.id === id));
  assert.isDefined(found, `the report has no ${id} element`);
  return found;
};

const satisfies = (document: SbomDocument, id: NtiaElementId): boolean => elementOf(document, id)?.satisfied === true;

describe("NtiaReport.of — each of the seven elements, by a passing and a failing document differing in that one field", () => {
  it("reports every element exactly once, in the published order", () => {
    const ids = A.map(NtiaReport.of(compliant()).elements, (element) => element.id);
    assert.deepStrictEqual(ids, [
      "supplierName",
      "componentName",
      "componentVersion",
      "uniqueIdentifier",
      "dependencyRelationship",
      "sbomAuthor",
      "timestamp",
    ]);
  });

  it("1. supplier name", () => {
    assert.isTrue(satisfies(compliant(), "supplierName"));
    assert.strictEqual(elementOf(compliant(), "supplierName")?.value, "Acme");
    assert.isFalse(
      satisfies(compliant({ supplier: Supplier.make({ name: "  " }) }), "supplierName"),
      "an empty name is a supplier that identifies nobody"
    );
  });

  it("2. component name", () => {
    assert.isTrue(satisfies(compliant(), "componentName"));
    const nameless = Sbom.generate({ root: Component.make({ type: "library", name: " " }), components: [dep] });
    assert.isFalse(satisfies(nameless, "componentName"));
  });

  it("3. component version", () => {
    assert.isTrue(satisfies(compliant(), "componentVersion"));
    const unversioned = Sbom.generate({ root: Component.make({ type: "library", name: "x" }), components: [dep] });
    assert.isFalse(satisfies(unversioned, "componentVersion"));
  });

  it("4. unique identifier — a purl, not merely a string", () => {
    assert.isTrue(satisfies(compliant(), "uniqueIdentifier"));
    assert.strictEqual(elementOf(compliant(), "uniqueIdentifier")?.value, "pkg:npm/%40effected/sbom@0.1.0");
    const notAPurl = Sbom.generate({
      root: Component.make({ type: "library", name: "x", version: "1.0.0", purl: "https://example.test/x" }),
      components: [dep],
    });
    assert.isFalse(satisfies(notAPurl, "uniqueIdentifier"), "present and non-empty is not a package URL");
  });

  it("5. dependency relationship — a declared subject the components relate to", () => {
    assert.isTrue(satisfies(compliant(), "dependencyRelationship"));
    assert.strictEqual(elementOf(compliant(), "dependencyRelationship")?.value, "1 component");

    const rootless = SbomDocument.make({
      bomFormat: "CycloneDX",
      specVersion: "1.6",
      version: 1,
      components: [dep],
    });
    assert.isFalse(
      satisfies(rootless, "dependencyRelationship"),
      "a component list with no declared subject relates nothing to anything"
    );
  });

  it("5b. a package with no dependencies is still compliant", () => {
    const standalone = Sbom.generate({ root, components: [] });
    assert.isTrue(
      satisfies(standalone, "dependencyRelationship"),
      "an empty list asserts there are no dependencies; it is not a gap"
    );
    assert.strictEqual(elementOf(standalone, "dependencyRelationship")?.value, "0 components");
  });

  it("6. SBOM author — authors, else supplier, else publisher", () => {
    assert.isTrue(satisfies(compliant(), "sbomAuthor"));
    assert.strictEqual(elementOf(compliant(), "sbomAuthor")?.value, "release-bot");

    const bySupplier = Sbom.generate({
      root,
      components: [dep],
      metadata: SbomMetadata.make({ supplier: Supplier.make({ name: "Acme" }) }),
    });
    assert.isTrue(satisfies(bySupplier, "sbomAuthor"), "the supplier stands in when nobody named an author");
    assert.strictEqual(elementOf(bySupplier, "sbomAuthor")?.value, "Acme");

    const byPublisher = Sbom.generate({
      root: Component.make({ type: "library", name: "x", version: "1.0.0", publisher: "Dee" }),
      components: [dep],
    });
    assert.isTrue(satisfies(byPublisher, "sbomAuthor"), "the publisher stands in when there is no supplier either");
    assert.strictEqual(elementOf(byPublisher, "sbomAuthor")?.value, "Dee");

    assert.isFalse(
      satisfies(Sbom.generate({ root, components: [dep] }), "sbomAuthor"),
      "with no author, supplier or publisher the element is unsatisfied"
    );
  });

  it("7. timestamp — one that is actually a date", () => {
    assert.isTrue(satisfies(compliant(), "timestamp"));
    assert.strictEqual(elementOf(compliant(), "timestamp")?.value, "2026-07-25T00:00:00.000Z");
    assert.isFalse(
      satisfies(compliant({ timestamp: "last tuesday" }), "timestamp"),
      "present and non-empty is not the same as being a timestamp"
    );
    assert.isFalse(satisfies(Sbom.generate({ root, components: [dep] }), "timestamp"));
  });

  it("carries no value for an element it could not satisfy", () => {
    const element = elementOf(Sbom.generate({ root, components: [dep] }), "supplierName");
    assert.isFalse(element?.satisfied);
    assert.isUndefined(element?.value);
  });
});

describe("NtiaReport — the derived verdict", () => {
  it("is compliant only when every element is satisfied", () => {
    assert.isTrue(NtiaReport.of(compliant()).compliant);
    assert.isFalse(NtiaReport.of(Sbom.generate({ root, components: [dep] })).compliant);
  });

  it("names what is missing by stable id, never by prose", () => {
    const report = NtiaReport.of(Sbom.generate({ root, components: [dep] }));
    assert.deepStrictEqual(
      report.missing,
      ["supplierName", "sbomAuthor", "timestamp"],
      "a consumer branches on stable ids; rendering display text belongs to the edge"
    );
  });

  it("reports nothing missing for a compliant document", () => {
    assert.lengthOf(NtiaReport.of(compliant()).missing, 0);
  });

  it("is a report, not a failure — a non-compliant document still produces one", () => {
    const report = NtiaReport.of(
      SbomDocument.make({ bomFormat: "CycloneDX", specVersion: "1.6", version: 1, components: [] })
    );
    assert.instanceOf(report, NtiaReport, "compliance is a question, and gating on it belongs to the caller");
    assert.lengthOf(report.elements, 7);
    assert.lengthOf(report.missing, 7);
  });
});
