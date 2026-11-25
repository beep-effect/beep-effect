import {
  ClaimImportLedger,
  ClaimImportLink,
  ClaimReference,
  claimReferenceKey,
  MissingClaimCreationFact,
  makeClaimImport,
} from "@beep/epistemics/ClaimImport.schema";
import { $EpistemicsId } from "@beep/identity/packages";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, strictEqual } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const digest = `sha256:${Str.repeat(64)("a")}`;
const claim = `sha256:${Str.repeat(64)("b")}`;
const Imported = makeClaimImport({
  $I: $EpistemicsId.create("test/ClaimImport"),
  ledger: "kb",
  proposition: S.NonEmptyString,
  review: S.NonEmptyString,
  signals: S.NonEmptyString,
});
const row = {
  version: "legacy-claim-import/v1",
  ledger: "kb",
  oldId: "claim/1",
  payloadDigest: digest,
  proposition: "Synthetic proposition",
  logicalKey: "synthetic-key",
  originalKnowledge: { recordedAt: 1, expiredAt: 5 },
  validTime: { _tag: "Unknown" },
  supportRefs: ["assertion/1"],
  challengeRefs: [],
  review: "Accepted",
  signals: "none",
  missingFacts: ["scope", "generatedBy"],
};

describe("ClaimImport", () => {
  it.effect("keeps imported and native references in separate namespaces", () =>
    Effect.gen(function* () {
      const imported = ClaimReference.cases.Imported.make({ ledger: "kb", oldId: "claim/1" });
      const holds = ClaimReference.cases.Imported.make({ ledger: "holds", oldId: "claim/1" });
      expect(claimReferenceKey(imported)).toBe("imported:kb:claim/1");
      expect(claimReferenceKey(holds)).not.toBe(claimReferenceKey(imported));
      const nativeId = yield* S.decodeUnknownEffect(ClaimImportLink.fields.claim)(claim);
      expect(claimReferenceKey(ClaimReference.cases.Native.make({ claim: nativeId }))).toBe(`native:${claim}`);
      assertTrue(ClaimImportLedger.is.holds("holds"));
      assertTrue(MissingClaimCreationFact.is.assertedBy("assertedBy"));
    })
  );

  it.effect("round-trips a historical row with omitted predecessor and canonical missing facts", () =>
    Effect.gen(function* () {
      const decoded = yield* S.decodeUnknownEffect(Imported)({
        ...row,
        missingFacts: ["scope", "generatedBy", "scope"],
      });
      assertNone(decoded.predecessor);
      expect(HashSet.size(decoded.missingFacts)).toBe(2);
      const encoded = yield* S.encodeEffect(Imported)(decoded);
      expect(encoded).toEqual({ ...row, missingFacts: ["generatedBy", "scope"] });
      const withPredecessor = yield* S.decodeUnknownEffect(Imported)({ ...row, predecessor: "claim/0" });
      assertSome(withPredecessor.predecessor, "claim/0");
    })
  );

  it.effect("refuses an import that claims every creation fact is known", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(S.decodeUnknownEffect(Imported)({ ...row, missingFacts: [] }));
      exit.pipe(Exit.isFailure, assertTrue);
      const foreignLedger = yield* Effect.exit(S.decodeUnknownEffect(Imported)({ ...row, ledger: "holds" }));
      foreignLedger.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("decodes an explicit import-to-core link", () =>
    Effect.gen(function* () {
      const link = yield* S.decodeUnknownEffect(ClaimImportLink)({
        ledger: "holds",
        oldId: "hold@1",
        payloadDigest: digest,
        claim,
      });
      expect(link.oldId).toBe("hold@1");
    })
  );
});

describe("ClaimImport properties", () => {
  const json = S.fromJsonString(ClaimReference);
  const equivalent = S.toEquivalence(ClaimReference);
  it.effect.prop(
    "every generated claim reference survives its JSON codec with the same namespaced key",
    [Arbitrary.schema(ClaimReference)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(json)(value);
        const decoded = yield* S.decodeEffect(json)(encoded);
        assertTrue(equivalent(decoded, value));
        strictEqual(claimReferenceKey(decoded), claimReferenceKey(value));
      }),
    { arbitrary: fcRuns(50) }
  );
});
