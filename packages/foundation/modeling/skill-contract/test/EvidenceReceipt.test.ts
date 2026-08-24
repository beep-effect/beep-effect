import { Sha256Hex } from "@beep/schema/Sha256";
import { EvidenceDigest, EvidencePredicateType, EvidenceReceipt, EvidenceSubject } from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const emptySha256 = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const predicateType = EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1");
const Predicate = S.Struct({ checkedPaths: S.Array(S.String), passed: S.Boolean });
const Receipt = EvidenceReceipt(predicateType, Predicate);

describe("@beep/skill-contract EvidenceReceipt", () => {
  it.effect("round-trips an unsigned digest-bound typed receipt with a pinned predicate identity", () =>
    Effect.gen(function* () {
      const receipt = Receipt.make({
        predicate: { checkedPaths: ["frames/drag.png"], passed: true },
        predicateType,
        subject: [
          EvidenceSubject.make({
            digest: EvidenceDigest.make({ sha256: emptySha256 }),
            name: "frames/drag.png",
          }),
        ],
      });
      const encoded = yield* S.encodeUnknownEffect(Receipt)(receipt);
      const decoded = yield* S.decodeEffect(Receipt)(encoded);

      expect(encoded).toEqual({
        predicate: { checkedPaths: ["frames/drag.png"], passed: true },
        predicateType: "https://beep.dev/evidence/artifact-exists/v1",
        subject: [
          {
            digest: { sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
            name: "frames/drag.png",
          },
        ],
      });
      expect(S.toEquivalence(Receipt)(decoded, receipt)).toBe(true);
    })
  );

  it.effect("rejects an unrelated predicate type, empty subjects, and malformed digests", () =>
    Effect.gen(function* () {
      const unrelatedTypeInput: unknown = {
        predicate: { checkedPaths: [], passed: true },
        predicateType: "https://beep.dev/evidence/other/v1",
        subject: [{ digest: { sha256: emptySha256 }, name: "frames/drag.png" }],
      };
      const emptySubjectInput: unknown = {
        predicate: { checkedPaths: [], passed: true },
        predicateType,
        subject: [],
      };
      const malformedDigestInput: unknown = {
        predicate: { checkedPaths: [], passed: false },
        predicateType,
        subject: [{ digest: { sha256: "not-a-digest" }, name: "frames/ghost.png" }],
      };
      const unrelatedType = yield* S.decodeUnknownEffect(Receipt)(unrelatedTypeInput).pipe(Effect.flip);
      const emptySubject = yield* S.decodeUnknownEffect(Receipt)(emptySubjectInput).pipe(Effect.flip);
      const malformedDigest = yield* S.decodeUnknownEffect(Receipt)(malformedDigestInput).pipe(Effect.flip);

      expect(unrelatedType.message).toContain(predicateType);
      expect(S.is(Receipt)(emptySubjectInput)).toBe(false);
      expect(emptySubject.message).toContain('["subject"]');
      expect(malformedDigest.message).toContain("SHA-256 digest must be exactly 64 characters long");
    })
  );

  it("gives every pinned factory instance a distinct schema identity and supports data-last construction", () => {
    const otherType = EvidencePredicateType.make("https://beep.dev/evidence/other/v1");
    const OtherReceipt = EvidenceReceipt(Predicate)(otherType);

    expect(S.resolveAnnotations(Receipt)?.identifier).not.toBe(S.resolveAnnotations(OtherReceipt)?.identifier);
    expect(OtherReceipt.fields.predicateType.literal).toBe(otherType);
  });

  it("round-trips schema-derived arbitrary receipts", () =>
    fc.assert(
      fc.property(S.toArbitrary(Receipt)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(Receipt)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(Receipt)(encoded));

        expect(S.toEquivalence(Receipt)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));
});
