import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import {
  DefaultVaultFilingContext,
  legalDocumentTaxonomy,
  legalDocumentTaxonomyJsonLd,
  ProjectFiledDocumentPathInput,
  ProjectInboxDocumentPathInput,
  projectFiledDocumentPath,
  projectInboxDocumentPath,
  projectIntakeInboxPath,
} from "@beep/documents-domain/values/Taxonomy";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

describe("@beep/documents-domain taxonomy seed", () => {
  it.effect("keeps the repo-owned JSON-LD seed aligned with folder projection data", () =>
    Effect.gen(function* () {
      expect(legalDocumentTaxonomy.concepts).toHaveLength(25);
      expect(legalDocumentTaxonomyJsonLd["@graph"]).toHaveLength(legalDocumentTaxonomy.concepts.length);

      const projected = yield* projectFiledDocumentPath(
        ProjectFiledDocumentPathInput.make({
          contentDigest: "0123456789abcdef",
          context: DefaultVaultFilingContext,
          originalFileName: "Complaint FINAL.PDF",
          taxonomy: legalDocumentTaxonomy,
          taxonomyConceptId: "pleadings",
        })
      );

      expect(projected.taxonomySegments).toEqual(["01-pleadings"]);
      expect(projected.relativePath).toBe(
        "matters/client-default-default-client/matter-general-general-matter/01-pleadings/complaint-final--0123456789ab.pdf"
      );
    })
  );

  it.effect("projects an intake batch id into the deterministic inbox path", () =>
    Effect.gen(function* () {
      expect(yield* projectIntakeInboxPath("Batch 1")).toBe("00-inbox/batch-1");
    })
  );

  it.effect("projects an unfiled document into the deterministic inbox vault path", () =>
    Effect.gen(function* () {
      const projected = yield* projectInboxDocumentPath(
        ProjectInboxDocumentPathInput.make({
          contentDigest: "0123456789abcdef",
          intakeBatchId: "Batch 42",
          originalFileName: "Scan 001.PDF",
        })
      );

      expect(projected.taxonomySegments).toEqual([]);
      expect(projected.relativePath).toBe("00-inbox/batch-42/scan-001--0123456789ab.pdf");
    })
  );

  it("round-trips the filing outcome union with schema-derived arbitraries", () => {
    const decode = S.decodeUnknownResult(FilingOutcome);
    const encode = S.encodeResult(FilingOutcome);
    const equivalent = S.toEquivalence(FilingOutcome);

    fc.assert(
      fc.property(S.toArbitrary(FilingOutcome), (outcome) => {
        const encoded = Result.getOrThrow(encode(outcome));
        const decoded = Result.getOrThrow(decode(encoded));

        expect(equivalent(decoded, outcome)).toBe(true);
      }),
      fcRuns(10)
    );
  });
});
