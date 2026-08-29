import {
  OntologyAssemblyError,
  TaxonomyConceptNotFound,
  TaxonomyManifestParseError,
  TaxonomyManifestReadError,
  UnsupportedDocumentClass,
  VendorAlignmentTargetNotFound,
  VendorSliceConceptMismatch,
  VendorSliceParseError,
  VendorSlicePathEscape,
  VendorSliceReadError,
  VendorSliceUnvetted,
} from "@beep/ontology";
import { IRIReference } from "@beep/rdf";
import { describe, expect, it } from "@effect/vitest";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const expectDeclaredEquivalence = <A>(same: (self: A, that: A) => boolean, first: A, second: A, different: A) => {
  expect(same(first, second)).toBe(true);
  expect(same(first, different)).toBe(false);
};

describe("ontology modeling tagged-error declared equivalence", () => {
  it("compares OntologyAssemblyError by declared fields", () => {
    const same = S.toEquivalence(OntologyAssemblyError);
    const first = OntologyAssemblyError.make({
      reason: "unknownTerm",
      message: "Unknown predicate term.",
      term: O.none(),
      field: O.none(),
      identifier: O.none(),
      subjectIri: O.none(),
      objectIri: O.none(),
    });
    const second = OntologyAssemblyError.make({
      reason: "unknownTerm",
      message: "Unknown predicate term.",
      term: O.none(),
      field: O.none(),
      identifier: O.none(),
      subjectIri: O.none(),
      objectIri: O.none(),
    });
    const different = OntologyAssemblyError.make({
      reason: "unknownTerm",
      message: "Unknown object term.",
      term: O.none(),
      field: O.none(),
      identifier: O.none(),
      subjectIri: O.none(),
      objectIri: O.none(),
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares TaxonomyManifestReadError by declared fields", () => {
    const same = S.toEquivalence(TaxonomyManifestReadError);
    const first = TaxonomyManifestReadError.make({ path: "vendor-manifest.jsonl" });
    const second = TaxonomyManifestReadError.make({ path: "vendor-manifest.jsonl" });
    const different = TaxonomyManifestReadError.make({ path: "missing-manifest.jsonl" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares TaxonomyManifestParseError by declared fields", () => {
    const same = S.toEquivalence(TaxonomyManifestParseError);
    const first = TaxonomyManifestParseError.make({ line: 1, path: "vendor-manifest.jsonl" });
    const second = TaxonomyManifestParseError.make({ line: 1, path: "vendor-manifest.jsonl" });
    const different = TaxonomyManifestParseError.make({ line: 2, path: "vendor-manifest.jsonl" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorSliceUnvetted by declared fields", () => {
    const same = S.toEquivalence(VendorSliceUnvetted);
    const first = VendorSliceUnvetted.make({ id: "folio" });
    const second = VendorSliceUnvetted.make({ id: "folio" });
    const different = VendorSliceUnvetted.make({ id: "fixture" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorSliceReadError by declared fields", () => {
    const same = S.toEquivalence(VendorSliceReadError);
    const first = VendorSliceReadError.make({ id: "folio", path: "folio.jsonld" });
    const second = VendorSliceReadError.make({ id: "folio", path: "folio.jsonld" });
    const different = VendorSliceReadError.make({ id: "folio", path: "missing.jsonld" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorSliceParseError by declared fields", () => {
    const same = S.toEquivalence(VendorSliceParseError);
    const first = VendorSliceParseError.make({ id: "folio", path: "folio.jsonld" });
    const second = VendorSliceParseError.make({ id: "folio", path: "folio.jsonld" });
    const different = VendorSliceParseError.make({ id: "fixture", path: "folio.jsonld" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorSlicePathEscape by declared fields", () => {
    const same = S.toEquivalence(VendorSlicePathEscape);
    const first = VendorSlicePathEscape.make({ id: "folio", path: "../folio.jsonld", vendorRoot: "/vendor" });
    const second = VendorSlicePathEscape.make({ id: "folio", path: "../folio.jsonld", vendorRoot: "/vendor" });
    const different = VendorSlicePathEscape.make({ id: "folio", path: "../folio.jsonld", vendorRoot: "/other" });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorSliceConceptMismatch by declared fields", () => {
    const same = S.toEquivalence(VendorSliceConceptMismatch);
    const expectedConceptIri = IRIReference.make("https://folio.openlegalstandard.org/expected");
    const first = VendorSliceConceptMismatch.make({
      actualConceptIri: IRIReference.make("https://folio.openlegalstandard.org/actual"),
      expectedConceptIri,
      id: "folio",
      path: "folio.jsonld",
    });
    const second = VendorSliceConceptMismatch.make({
      actualConceptIri: IRIReference.make("https://folio.openlegalstandard.org/actual"),
      expectedConceptIri,
      id: "folio",
      path: "folio.jsonld",
    });
    const different = VendorSliceConceptMismatch.make({
      actualConceptIri: expectedConceptIri,
      expectedConceptIri,
      id: "folio",
      path: "folio.jsonld",
    });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares VendorAlignmentTargetNotFound by declared fields", () => {
    const same = S.toEquivalence(VendorAlignmentTargetNotFound);
    const localConceptIri = IRIReference.make("https://ns.beep.sh/missing");
    const first = VendorAlignmentTargetNotFound.make({ id: "folio", localConceptIri });
    const second = VendorAlignmentTargetNotFound.make({ id: "folio", localConceptIri });
    const different = VendorAlignmentTargetNotFound.make({ id: "other", localConceptIri });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares TaxonomyConceptNotFound by declared fields", () => {
    const same = S.toEquivalence(TaxonomyConceptNotFound);
    const first = TaxonomyConceptNotFound.make({ conceptIri: IRIReference.make("https://ns.beep.sh/missing") });
    const second = TaxonomyConceptNotFound.make({ conceptIri: IRIReference.make("https://ns.beep.sh/missing") });
    const different = TaxonomyConceptNotFound.make({ conceptIri: IRIReference.make("https://ns.beep.sh/other") });

    expectDeclaredEquivalence(same, first, second, different);
  });

  it("compares UnsupportedDocumentClass by declared fields", () => {
    const same = S.toEquivalence(UnsupportedDocumentClass);
    const conceptIri = IRIReference.make("https://ns.beep.sh/example");
    const first = UnsupportedDocumentClass.make({ conceptIri, documentClass: "filed" });
    const second = UnsupportedDocumentClass.make({ conceptIri, documentClass: "filed" });
    const different = UnsupportedDocumentClass.make({ conceptIri, documentClass: "received" });

    expectDeclaredEquivalence(same, first, second, different);
  });
});
