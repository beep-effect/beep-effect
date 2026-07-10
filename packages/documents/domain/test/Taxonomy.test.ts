import {
  DefaultVaultFilingContext,
  legalDocumentTaxonomy,
  legalDocumentTaxonomyJsonLd,
  ProjectFiledDocumentPathInput,
  projectFiledDocumentPath,
  projectIntakeInboxPath,
} from "@beep/documents-domain/values/Taxonomy";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

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
});
