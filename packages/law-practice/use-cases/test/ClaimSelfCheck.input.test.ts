import { ContentDigest } from "@beep/file-processing/Artifact";
import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import { ClaimInputCollection, ClaimInputRecord } from "@beep/law-practice-domain/values/ClaimElement";
import { UsptoClaimInputSet, UsptoClaimSource } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const claimInputSetType = S.toType(UsptoClaimInputSet);
const claimInputSetJson = S.fromJsonString(UsptoClaimInputSet);

const sourceDocumentDigest = ContentDigest.make(`sha256:${Str.repeat(64)("a")}`);
const documentIdentifier = "fixture-document";
const source = UsptoClaimSource.cases.application.make({
  applicationNumber: UsptoNormalizedApplicationNumber.make("16138242"),
});
const failedRecord = ClaimInputRecord.cases.unavailable.make({
  sourceOrdinal: 1,
  numberText: O.none(),
  sourceText: "<claim/>",
  reason: "empty-text",
});

describe("public claim-input acquisition provenance", () => {
  it.effect.prop(
    "preserves arbitrary literal record content in its provenance-bound ledger",
    [Arbitrary.schema(ClaimInputRecord)],
    ([record]) =>
      Effect.gen(function* () {
        const ordered = ClaimInputRecord.match(record, {
          text: (value) => ClaimInputRecord.cases.text.make({ ...value, sourceOrdinal: 1 }),
          unavailable: (value) => ClaimInputRecord.cases.unavailable.make({ ...value, sourceOrdinal: 1 }),
        });
        const input = ClaimInputCollection.make({
          sourceKey: `${documentIdentifier}:${sourceDocumentDigest}`,
          records: [ordered],
        });
        const set = UsptoClaimInputSet.make({ input, documentIdentifier, sourceDocumentDigest, source });
        const encoded = yield* S.encodeEffect(claimInputSetJson)(set);
        const decoded = yield* S.decodeEffect(claimInputSetJson)(encoded);
        assert.deepStrictEqual(decoded, set);
      }),
    { arbitrary: { ...fcRuns(100), seed: "claim-input-provenance-v1" } }
  );

  it.effect("roundtrips an all-unusable source ledger without claiming successful checking", () =>
    Effect.gen(function* () {
      const input = ClaimInputCollection.make({
        sourceKey: `${documentIdentifier}:${sourceDocumentDigest}`,
        records: [failedRecord],
      });
      const set = UsptoClaimInputSet.make({ input, documentIdentifier, sourceDocumentDigest, source });
      const encoded = yield* S.encodeEffect(claimInputSetJson)(set);
      const decoded = yield* S.decodeEffect(claimInputSetJson)(encoded);
      assert.deepStrictEqual(decoded, set);
      assert.strictEqual(decoded.input.records[0].sourceText, "<claim/>");
    })
  );

  it.effect("rejects a source ledger detached from the acquired document version", () =>
    Effect.gen(function* () {
      for (const sourceKey of [
        `another-document:${sourceDocumentDigest}`,
        `${documentIdentifier}:sha256:${Str.repeat(64)("b")}`,
      ]) {
        const input = ClaimInputCollection.make({ sourceKey, records: [failedRecord] });
        const failure = yield* Effect.flip(
          S.decodeUnknownEffect(claimInputSetType)({
            input,
            documentIdentifier,
            sourceDocumentDigest,
            source,
          })
        );
        assert.strictEqual(failure._tag, "SchemaError");
      }
    })
  );
});
