import { EdgeVersion } from "@beep/epistemic-domain/entities/EdgeVersion";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import { it } from "@beep/test-runner";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const baseRow = {
  ...productEntityFixtureInput(Epistemic.EdgeVersionId.entityType, 1),
  deletedAt: null,
  deletedByPrincipal: null,
  evidenceScope: null,
  fact: { note: "cited in the office action" },
  logicalKey: "abadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafeabadcafe",
  matterScope: null,
  qualifiers: { statute: "35 USC 103" },
  relation: "supports",
  sourceClaimId: 1,
  sourceEntityRef: null,
  sourceEvidenceId: null,
  sourceKind: "claim",
  sourceObservationRef: null,
  supersedesId: null,
  targetClaimId: null,
  targetEntityRef: null,
  targetEvidenceId: 2,
  targetKind: "evidence",
  targetObservationRef: null,
  version: 1,
};

const preExtractionRows = [
  { ...baseRow, expiredAt: null, recordedAt: 1_000, validFrom: 1_000, validTo: null },
  { ...baseRow, expiredAt: 3_000, recordedAt: 2_000, validFrom: 500, validTo: 1_500 },
];

describe("EdgeVersion row compatibility", () => {
  it.effect("decodes and re-encodes pre-extraction rows to identical JSON", () =>
    Effect.forEach(
      preExtractionRows,
      (row) =>
        Effect.gen(function* () {
          const decoded = yield* S.decodeUnknownEffect(EdgeVersion)(row);
          const encoded = yield* S.encodeEffect(EdgeVersion)(decoded);
          expect(
            encoded,
            "a row written before EdgeVersion composed the @beep/epistemics interval fields"
          ).toStrictEqual(row);
        }),
      { concurrency: 1 }
    )
  );
});
