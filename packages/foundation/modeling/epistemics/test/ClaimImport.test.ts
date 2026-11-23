import {
  ClaimImportLedger,
  ClaimImportLink,
  ClaimReference,
  claimReferenceKey,
  MissingClaimCreationFact,
  makeClaimImport,
} from "@beep/epistemics/ClaimImport.schema";
import { $EpistemicsId } from "@beep/identity/packages";
import { describe, expect, it } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
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
      decoded.predecessor.pipe(O.isNone, assertTrue);
      expect(HashSet.size(decoded.missingFacts)).toBe(2);
      const encoded = yield* S.encodeEffect(Imported)(decoded);
      expect(encoded).toEqual({ ...row, missingFacts: ["generatedBy", "scope"] });
      const withPredecessor = yield* S.decodeUnknownEffect(Imported)({ ...row, predecessor: "claim/0" });
      expect(withPredecessor.predecessor).toEqual(O.some("claim/0"));
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
