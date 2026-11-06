import { Sha256HexFromBytes } from "@beep/schema";
import { decodeXmlTextAs } from "@beep/schema/Xml";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { assert, describe } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const Sample = S.Struct({
  quotas: S.Record(S.String, S.Finite),
  selectedSetCount: S.Finite,
  selectedClaimCount: S.Finite,
  sets: S.Array(
    S.Struct({ patentNumber: S.String, cpcSection: S.String, claimCount: S.Finite, claimsXmlSha256: S.String })
  ),
});
const NumberedClaim = S.Struct({ num: S.String });
const claimsDocument = decodeXmlTextAs(S.Struct({ claims: S.Struct({ claim: S.Unknown }) }));

const allowedSampleJson = S.fromJsonString(Sample);
const numberedClaims = S.Array(NumberedClaim);

describe("Frozen allowed-claim sample", () => {
  it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer), { timeout: "30 seconds" })((it) => {
    it.effect("preserves every selected set, source claim count, CPC quota and XML digest", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const manifestPath = yield* path.fromFileUrl(
          new URL("../../../../goals/claim-element-antecedent-check/research/allowed-sampling.json", import.meta.url)
        );
        const argument = S.decodeEffect(allowedSampleJson);
        const readFileString1 = yield* fs.readFileString(manifestPath);
        const sample = yield* argument(readFileString1);
        assert.strictEqual(sample.selectedSetCount, 200);
        assert.strictEqual(sample.sets.length, sample.selectedSetCount);
        assert.strictEqual(A.dedupe(A.map(sample.sets, ({ patentNumber }) => patentNumber)).length, 200);
        assert.deepStrictEqual(
          R.map(
            A.groupBy(sample.sets, ({ cpcSection }) => cpcSection),
            A.length
          ),
          sample.quotas
        );
        assert.strictEqual(
          A.reduce(sample.sets, 0, (total, row) => total + row.claimCount),
          3184
        );
        assert.strictEqual(sample.selectedClaimCount, 3184);
        for (const row of sample.sets) {
          const filename = yield* path.fromFileUrl(
            new URL(`../../domain/test/fixtures/claim-element/allowed/${row.patentNumber}.claims.xml`, import.meta.url)
          );
          const bytes = yield* fs.readFile(filename);
          const value1 = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
          assert.strictEqual(value1, row.claimsXmlSha256);
          const readFileString2 = yield* fs.readFileString(filename);
          const parsed = yield* claimsDocument(readFileString2);
          const claims = yield* S.decodeUnknownEffect(numberedClaims)(A.ensure(parsed.claims.claim));
          assert.strictEqual(claims.length, row.claimCount);
          assert.strictEqual(A.dedupe(A.map(claims, ({ num }) => num)).length, row.claimCount);
        }
      })
    );
  });
});

const PositiveSample = S.Struct({
  quotas: S.Record(S.String, S.Finite),
  familyCount: S.Finite,
  selectedClaimCount: S.Finite,
  families: S.Array(
    S.Struct({
      familyId: S.String,
      applicationNumber: S.String,
      cpcSection: S.String,
      claimCount: S.Finite,
      claimNumbers: S.Array(S.Finite),
    })
  ),
});
const PositiveSource = S.Struct({ labelClaimNumbers: S.Array(S.Finite) });
const SourceDigest = S.Struct({ claimsXmlSha256: S.String });

// Integrity of source proposals does not certify operative versions or semantic gold.
const positiveSampleJson = S.fromJsonString(PositiveSample);
const positiveSourceJson = S.fromJsonString(PositiveSource);
const sourceDigestJson = S.fromJsonString(SourceDigest);

describe("Positive source sample integrity", () => {
  it.layer(Layer.mergeAll(BunCrypto.layer, BunFileSystem.layer, BunPath.layer), { timeout: "30 seconds" })((it) => {
    it.effect("preserves all sixty source slots, CPC quotas, selected scopes and native XML digests", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const manifestPath = yield* path.fromFileUrl(
          new URL("../../../../goals/claim-element-antecedent-check/research/positive-sampling.json", import.meta.url)
        );
        const argument1 = S.decodeEffect(positiveSampleJson);
        const readFileString3 = yield* fs.readFileString(manifestPath);
        const sample = yield* argument1(readFileString3);
        assert.strictEqual(sample.familyCount, 60);
        assert.strictEqual(sample.families.length, 60);
        assert.strictEqual(A.dedupe(A.map(sample.families, (row) => row.familyId)).length, 60);
        assert.strictEqual(A.dedupe(A.map(sample.families, (row) => row.applicationNumber)).length, 60);
        assert.deepStrictEqual(
          R.map(
            A.groupBy(sample.families, (row) => row.cpcSection),
            A.length
          ),
          sample.quotas
        );
        assert.strictEqual(
          A.reduce(sample.families, 0, (total, row) => total + row.claimCount),
          sample.selectedClaimCount
        );
        for (const row of sample.families) {
          const directory = yield* path.fromFileUrl(
            new URL(`../../domain/test/fixtures/claim-element/positive/${row.familyId}/`, import.meta.url)
          );
          const argument2 = S.decodeEffect(positiveSourceJson);
          const readFileString5 = yield* fs.readFileString(path.join(directory, "claims.json"));
          const source = yield* argument2(readFileString5);
          const argument3 = S.decodeEffect(sourceDigestJson);
          const readFileString6 = yield* fs.readFileString(path.join(directory, "provenance.json"));
          const provenance = yield* argument3(readFileString6);
          assert.deepStrictEqual(source.labelClaimNumbers, row.claimNumbers);
          assert.strictEqual(row.claimCount, row.claimNumbers.length);
          assert.strictEqual(A.dedupe(row.claimNumbers).length, row.claimCount);
          const filename = path.join(directory, "source.claims.xml");
          const argument4 = S.decodeEffect(Sha256HexFromBytes);
          const readFile7 = yield* fs.readFile(filename);
          const value3 = yield* argument4(readFile7);
          assert.strictEqual(value3, provenance.claimsXmlSha256);
          const readFileString4 = yield* fs.readFileString(filename);
          const parsed = yield* claimsDocument(readFileString4);
          const claims = yield* S.decodeUnknownEffect(numberedClaims)(A.ensure(parsed.claims.claim));
          const numbers = A.map(claims, ({ num }) => N.parse(num));
          assertTrue(A.every(numbers, (number) => O.isSome(number)));
          assertTrue(
            A.every(row.claimNumbers, (selected) =>
              A.some(numbers, (actual) => O.isSome(actual) && actual.value === selected)
            )
          );
        }
      })
    );
  });
});
