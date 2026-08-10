import { Evidence } from "@beep/epistemic-domain/entities/Evidence";
import { EvidenceVerification as EvidenceVerificationModel } from "@beep/epistemic-domain/entities/EvidenceVerification";
import { EvidenceVerificationManifestation } from "@beep/epistemic-domain/values/EvidenceVerification";
import { DbSchema, Entities } from "@beep/epistemic-tables";
import * as EvidenceVerification from "@beep/epistemic-tables/entities/EvidenceVerification";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as Epistemic from "@beep/shared-domain/identity/Epistemic";
import * as SharedIdentity from "@beep/shared-domain/identity/Shared";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { getColumns } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { DateTime, Result } from "effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const digest = SourceTextDigest.make("sha256:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7");
const verifiedAnchor = TextAnchorVerificationReceipt.make({
  anchor: TextAnchor.make({
    endChar: NonNegativeInt.make(16),
    quote: "controlling fact",
    startChar: NonNegativeInt.make(0),
  }),
  source: SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    locator: PosixPath.make("sources/office-action.txt"),
    normalizationVersion: "1",
    scopeRef: "matter:example",
    sourceDigest: digest,
    sourceRef: "source:office-action",
    textDigest: digest,
  }),
});
const evidenceId = Epistemic.EvidenceId.make(4);
const manifestationKey = Result.getOrThrow(EvidenceVerificationModel.manifestationKeyFor(evidenceId, verifiedAnchor));
const sourceMutatedAnchor = TextAnchorVerificationReceipt.make({
  anchor: verifiedAnchor.anchor,
  source: SourceTextIdentity.make({
    ...verifiedAnchor.source,
    sourceRef: "source:amended-office-action",
  }),
});
const quoteMutatedAnchor = TextAnchorVerificationReceipt.make({
  anchor: TextAnchor.make({
    ...verifiedAnchor.anchor,
    quote: "controlling pact",
  }),
  source: verifiedAnchor.source,
});

const input = {
  ...baseEntityFixtureInput("EpistemicEvidenceVerification", 7),
  evidenceId,
  manifestationKey,
  verifiedAnchor: Result.getOrThrow(S.encodeUnknownResult(TextAnchorVerificationReceipt)(verifiedAnchor)),
};
const evidenceFor = (id: Epistemic.EvidenceId, anchor: TextAnchor) =>
  Result.getOrThrow(
    S.decodeUnknownResult(Evidence)({
      ...baseEntityFixtureInput("EpistemicEvidence", id),
      artifactFixtureKey: `artifact:evidence-verification-${id}`,
      createdAt: 0,
      id,
      span: {
        ...anchor,
        confidence: 0.95,
      },
      spanFixtureKey: `span:evidence-verification-${id}`,
      updatedAt: 0,
    })
  );
const evidence = evidenceFor(evidenceId, verifiedAnchor.anchor);

describe("EvidenceVerificationTable", () => {
  it("projects the immutable sidecar column shape", () => {
    expect(EvidenceVerification.Table.entitySchema).toBe(EvidenceVerificationModel);
    expect(EvidenceVerification.Table.definition.tableName).toBe("epistemic_evidence_verification");
    expect(getTableConfig(EvidenceVerification.Table).name).toBe("epistemic_evidence_verification");
    expect(R.map(getColumns(EvidenceVerification.Table), (column) => column.name)).toStrictEqual({
      createdAt: "created_at",
      createdByPrincipal: "created_by_principal",
      entityType: "entity_type",
      evidenceId: "evidence_id",
      id: "id",
      manifestationKey: "manifestation_key",
      orgId: "org_id",
      publicId: "public_id",
      rowVersion: "row_version",
      schemaVersion: "schema_version",
      source: "source",
      updatedAt: "updated_at",
      updatedByPrincipal: "updated_by_principal",
      verifiedAnchor: "verified_anchor",
    });

    const columns = getColumns(EvidenceVerification.Table);
    expect(columns.evidenceId.columnType).toBe("PgInteger");
    expect(columns.evidenceId.notNull).toBe(true);
    expect(columns.manifestationKey.columnType).toBe("PgText");
    expect(columns.manifestationKey.notNull).toBe(true);
    expect(columns.verifiedAnchor.columnType).toBe("PgJsonb");
    expect(columns.verifiedAnchor.notNull).toBe(true);
  });

  it("publishes the table through both aggregates", () => {
    expect(DbSchema.evidenceVerification).toBe(EvidenceVerification.Table);
    expect(Entities.EvidenceVerification.Table).toBe(EvidenceVerification.Table);
  });

  it("round-trips schema-derived manifestations through the sealed row converters", () => {
    fc.assert(
      fc.property(S.toArbitrary(EvidenceVerificationManifestation)(fc), (manifestation) => {
        const verification = Result.getOrThrow(
          S.decodeUnknownResult(EvidenceVerificationModel)({
            ...baseEntityFixtureInput("EpistemicEvidenceVerification", 7),
            evidenceId: manifestation.evidenceId,
            manifestationKey: Result.getOrThrow(
              EvidenceVerificationModel.manifestationKeyFor(manifestation.evidenceId, manifestation.verifiedAnchor)
            ),
            verifiedAnchor: Result.getOrThrow(
              S.encodeUnknownResult(TextAnchorVerificationReceipt)(manifestation.verifiedAnchor)
            ),
          })
        );
        const insert = Result.getOrThrow(
          EvidenceVerification.toEvidenceVerificationInsert(
            verification,
            evidenceFor(manifestation.evidenceId, manifestation.verifiedAnchor.anchor)
          )
        );
        const decoded = Result.getOrThrow(
          EvidenceVerification.fromEvidenceVerificationRow({
            ...insert,
            id: verification.id,
          })
        );

        expect(Result.getOrThrow(S.encodeUnknownResult(EvidenceVerificationModel)(decoded))).toStrictEqual(
          Result.getOrThrow(S.encodeUnknownResult(EvidenceVerificationModel)(verification))
        );
      }),
      fcRuns(25)
    );
  });

  it("round-trips rows through schema-derived converters", () => {
    const verification = Result.getOrThrow(S.decodeUnknownResult(EvidenceVerificationModel)(input));
    const insert = Result.getOrThrow(EvidenceVerification.toEvidenceVerificationInsert(verification, evidence));
    const tamperedVerification = EvidenceVerificationModel.make({
      ...verification,
      manifestationKey: EvidenceVerificationModel.manifestationKeyFor(
        Epistemic.EvidenceId.make(5),
        verifiedAnchor
      ).pipe(Result.getOrThrow),
    });

    expect("id" in insert).toBe(false);
    expect(insert.evidenceId).toBe(4);
    expect(insert.manifestationKey).toBe(manifestationKey);
    expect(insert.verifiedAnchor).toStrictEqual(input.verifiedAnchor);

    const decoded = Result.getOrThrow(EvidenceVerification.fromEvidenceVerificationRow({ ...insert, id: 7 }));
    expect(decoded.id).toBe(7);
    expect(Result.getOrThrow(decoded.hasValidManifestationKey())).toBe(true);
    expect(decoded.verifiedAnchor.anchor.quote).toBe("controlling fact");
    expect(Result.isFailure(EvidenceVerification.toEvidenceVerificationInsert(tamperedVerification, evidence))).toBe(
      true
    );
    expect(
      Result.isFailure(
        EvidenceVerification.fromEvidenceVerificationRow({
          ...insert,
          id: 7,
          manifestationKey: tamperedVerification.manifestationKey,
        })
      )
    ).toBe(true);

    for (const mutatedAnchor of [sourceMutatedAnchor, quoteMutatedAnchor]) {
      expect(
        Result.isFailure(
          EvidenceVerification.toEvidenceVerificationInsert(
            EvidenceVerificationModel.make({
              ...verification,
              verifiedAnchor: mutatedAnchor,
            }),
            evidence
          )
        )
      ).toBe(true);
      expect(
        Result.isFailure(
          EvidenceVerification.fromEvidenceVerificationRow({
            ...insert,
            id: 7,
            verifiedAnchor: Result.getOrThrow(S.encodeUnknownResult(TextAnchorVerificationReceipt)(mutatedAnchor)),
          })
        )
      ).toBe(true);
    }

    expect(
      Result.isFailure(
        EvidenceVerification.fromEvidenceVerificationRow({
          ...insert,
          id: 7,
          verifiedAnchor: {},
        })
      )
    ).toBe(true);

    const mismatchedAnchorVerification = EvidenceVerificationModel.make({
      ...verification,
      manifestationKey: Result.getOrThrow(
        EvidenceVerificationModel.manifestationKeyFor(evidenceId, quoteMutatedAnchor)
      ),
      verifiedAnchor: quoteMutatedAnchor,
    });
    expect(
      Result.isFailure(EvidenceVerification.toEvidenceVerificationInsert(mismatchedAnchorVerification, evidence))
    ).toBe(true);

    const otherEvidenceId = Epistemic.EvidenceId.make(5);
    const mismatchedEvidenceVerification = EvidenceVerificationModel.make({
      ...verification,
      evidenceId: otherEvidenceId,
      manifestationKey: Result.getOrThrow(
        EvidenceVerificationModel.manifestationKeyFor(otherEvidenceId, verifiedAnchor)
      ),
    });
    expect(
      Result.isFailure(EvidenceVerification.toEvidenceVerificationInsert(mismatchedEvidenceVerification, evidence))
    ).toBe(true);

    const mismatchedOrganizationVerification = EvidenceVerificationModel.make({
      ...verification,
      orgId: SharedIdentity.OrganizationId.make(2),
    });
    expect(
      Result.isFailure(EvidenceVerification.toEvidenceVerificationInsert(mismatchedOrganizationVerification, evidence))
    ).toBe(true);
  });

  it("uses the manifestation schema as the digest input contract", () => {
    const manifestation = EvidenceVerificationManifestation.make({ evidenceId, verifiedAnchor });
    expect(manifestation.evidenceId).toBe(4);
    expect(Result.getOrThrow(EvidenceVerificationModel.manifestationKeyFor(evidenceId, verifiedAnchor))).toBe(
      manifestationKey
    );
  });

  it("rejects a verification created before its referenced evidence", () => {
    const verification = Result.getOrThrow(S.decodeUnknownResult(EvidenceVerificationModel)(input));
    const futureEvidence = Evidence.make({
      ...evidence,
      createdAt: DateTime.makeUnsafe(DateTime.toEpochMillis(verification.createdAt) + 1),
    });

    expect(Result.isFailure(EvidenceVerification.toEvidenceVerificationInsert(verification, futureEvidence))).toBe(
      true
    );
  });
});
