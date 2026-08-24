import { Sha256Hex } from "@beep/schema/Sha256";
import { EvidenceDigest, EvidencePredicateType, EvidenceReceipt, EvidenceSubject } from "@beep/skill-contract";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Result } from "effect";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const emptySha256 = Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
const Predicate = S.Struct({ checkedPaths: S.Array(S.String), passed: S.Boolean });
const Receipt = EvidenceReceipt(Predicate);

describe("@beep/skill-contract EvidenceReceipt", () => {
  it.effect("round-trips an unsigned digest-bound typed receipt", () =>
    Effect.gen(function* () {
      const receipt = Receipt.make({
        predicate: { checkedPaths: ["frames/drag.png"], passed: true },
        predicateType: EvidencePredicateType.make("https://beep.dev/evidence/artifact-exists/v1"),
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

  it("round-trips schema-derived arbitrary receipts", () =>
    fc.assert(
      fc.property(S.toArbitrary(Receipt)(fc), (candidate) => {
        const encoded = Result.getOrThrow(S.encodeUnknownResult(Receipt)(candidate));
        const decoded = Result.getOrThrow(S.decodeResult(Receipt)(encoded));

        expect(S.toEquivalence(Receipt)(decoded, candidate)).toBe(true);
      }),
      fcRuns(25)
    ));

  it.effect("rejects an empty subject list and a malformed digest", () =>
    Effect.gen(function* () {
      const emptySubjectInput: unknown = {
        predicate: { checkedPaths: [], passed: true },
        predicateType: "https://beep.dev/evidence/artifact-exists/v1",
        subject: [],
      };
      const malformedDigestInput: unknown = {
        predicate: { checkedPaths: [], passed: false },
        predicateType: "https://beep.dev/evidence/artifact-exists/v1",
        subject: [{ digest: { sha256: "not-a-digest" }, name: "frames/ghost.png" }],
      };
      const emptySubject = yield* S.decodeUnknownEffect(Receipt)(emptySubjectInput).pipe(Effect.flip);
      const malformedDigest = yield* S.decodeUnknownEffect(Receipt)(malformedDigestInput).pipe(Effect.flip);

      expect(S.is(Receipt)(emptySubjectInput)).toBe(false);
      expect(emptySubject.message).toContain('["subject"]');
      expect(malformedDigest.message).toContain("SHA-256 digest must be exactly 64 characters long");
    })
  );
});
