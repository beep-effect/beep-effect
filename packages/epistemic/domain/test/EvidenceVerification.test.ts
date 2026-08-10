import {
  EvidenceVerification,
  EvidenceVerificationManifestation,
  evidenceVerificationManifestationKey,
} from "@beep/epistemic-domain";
import * as Epistemic from "@beep/epistemic-domain/identity/Epistemic";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { NonNegativeInt } from "@beep/schema";
import { PosixPath } from "@beep/schema/PosixPath";
import * as SharedEpistemic from "@beep/shared-domain/identity/Epistemic";
import { baseEntityFixtureInput, fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const sourceDigest = SourceTextDigest.make("sha256:3a6eb0790f39ac87c94f3856b2dd2c5d110e6811602261a9a923d3bb23adc8b7");
const textDigest = SourceTextDigest.make("sha256:ed7002b439e9ac845f22357d822bac144473c8d52b3c91e2c8f66e8118f24a6c");

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
    sourceDigest,
    sourceRef: "source:office-action",
    textDigest,
  }),
});

const manifestation = EvidenceVerificationManifestation.make({
  evidenceId: SharedEpistemic.EvidenceId.make(4),
  verifiedAnchor,
});

describe("EvidenceVerification", () => {
  it("round-trips schema-derived manifestations", () => {
    const encode = S.encodeResult(EvidenceVerificationManifestation);
    const decode = S.decodeUnknownResult(EvidenceVerificationManifestation);
    const equivalent = S.toEquivalence(EvidenceVerificationManifestation);

    fc.assert(
      fc.property(S.toArbitrary(EvidenceVerificationManifestation)(fc), (value) =>
        equivalent(Result.getOrThrow(decode(Result.getOrThrow(encode(value)))), value)
      ),
      fcRuns(25)
    );
  });

  it("uses a slice-local BaseEntity identity", () => {
    expect(EvidenceVerification.definition.entityId).toBe(Epistemic.EvidenceVerificationId);
    expect(EvidenceVerification.definition.entityId.tableName).toBe("epistemic_evidence_verification");
    expect(EvidenceVerification.definition.entityId.entityType).toBe("EpistemicEvidenceVerification");
  });

  it("keys one exact evidence and verified-anchor manifestation", () => {
    const first = Result.getOrThrow(evidenceVerificationManifestationKey(manifestation));
    const repeated = Result.getOrThrow(
      evidenceVerificationManifestationKey(
        EvidenceVerificationManifestation.make({
          evidenceId: SharedEpistemic.EvidenceId.make(4),
          verifiedAnchor,
        })
      )
    );
    const otherEvidence = Result.getOrThrow(
      evidenceVerificationManifestationKey(
        EvidenceVerificationManifestation.make({
          evidenceId: SharedEpistemic.EvidenceId.make(5),
          verifiedAnchor,
        })
      )
    );

    expect(repeated).toBe(first);
    expect(otherEvidence).not.toBe(first);
  });

  it("changes the manifestation key when either source identity or anchor changes", () => {
    const original = Result.getOrThrow(evidenceVerificationManifestationKey(manifestation));
    const sourceMutation = TextAnchorVerificationReceipt.make({
      anchor: verifiedAnchor.anchor,
      source: SourceTextIdentity.make({
        ...verifiedAnchor.source,
        sourceRef: "source:amended-office-action",
      }),
    });
    const anchorMutation = TextAnchorVerificationReceipt.make({
      anchor: TextAnchor.make({
        ...verifiedAnchor.anchor,
        quote: "controlling pact",
      }),
      source: verifiedAnchor.source,
    });
    const keyFor = (receipt: TextAnchorVerificationReceipt) =>
      Result.getOrThrow(
        evidenceVerificationManifestationKey(
          EvidenceVerificationManifestation.make({
            evidenceId: manifestation.evidenceId,
            verifiedAnchor: receipt,
          })
        )
      );

    expect(keyFor(sourceMutation)).not.toBe(original);
    expect(keyFor(anchorMutation)).not.toBe(original);
  });

  it("detects a manifestation-key mismatch without mutating the row", () => {
    const manifestationKey = Result.getOrThrow(evidenceVerificationManifestationKey(manifestation));
    const verification = Result.getOrThrow(
      S.decodeUnknownResult(EvidenceVerification)({
        ...baseEntityFixtureInput("EpistemicEvidenceVerification", 7),
        evidenceId: 4,
        manifestationKey,
        verifiedAnchor,
      })
    );
    const tampered = EvidenceVerification.make({
      ...verification,
      manifestationKey: Result.getOrThrow(
        EvidenceVerification.manifestationKeyFor(SharedEpistemic.EvidenceId.make(5), verifiedAnchor)
      ),
    });

    expect(Result.getOrThrow(verification.hasValidManifestationKey())).toBe(true);
    expect(Result.getOrThrow(tampered.hasValidManifestationKey())).toBe(false);
    expect(verification.evidenceId).toBe(4);
    expect(verification.verifiedAnchor.source.textDigest).toBe(textDigest);
  });

  it("preserves the schema-first encoded row shape", () => {
    const manifestationKey = Result.getOrThrow(
      EvidenceVerification.manifestationKeyFor(SharedEpistemic.EvidenceId.make(4), verifiedAnchor)
    );
    const input = {
      ...baseEntityFixtureInput("EpistemicEvidenceVerification", 7),
      evidenceId: 4,
      manifestationKey,
      verifiedAnchor: Result.getOrThrow(S.encodeUnknownResult(TextAnchorVerificationReceipt)(verifiedAnchor)),
    };
    const decoded = Result.getOrThrow(S.decodeUnknownResult(EvidenceVerification)(input));

    expect(Result.getOrThrow(S.encodeUnknownResult(EvidenceVerification)(decoded))).toStrictEqual(input);
  });
});
