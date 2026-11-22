import { fcRuns } from "@beep/fc-runs";
import { it } from "@beep/test-runner";
import { sourceFor, textDigestOf, wellFormedTextWith } from "@beep/text/Arbitrary";
import { CaptureId, CapturePreimage, mintCaptureId } from "@beep/text/Capture";
import { OccurrencePreimage } from "@beep/text/Occurrence";
import { SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "@beep/text/SourceTextIdentity";
import { describe, expect } from "@effect/vitest";
import { assertSuccess } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sha256 } from "./support/generators.ts";
import { citationSource } from "./support/goldens.ts";

const runs = { arbitrary: fcRuns(100) };

const mintSync = CapturePreimage.mintResult(sha256);

const digestOf = textDigestOf(sha256);

const CaptureJson = S.fromJsonString(SourceTextIdentity);

const goldenId = CaptureId.make("sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6");

const captureCase = Arbitrary.flatMap(wellFormedTextWith({ minLength: 1, maxLength: 40 }), ({ text }) =>
  sourceFor(sha256)(text)
);

const saltArbitrary = Arbitrary.map(wellFormedTextWith({ minLength: 1, maxLength: 6 }), ({ text }) => text);

type Fields = Partial<{ -readonly [K in keyof SourceTextIdentity]: SourceTextIdentity[K] }>;

const withFields = (source: SourceTextIdentity, fields: Fields): SourceTextIdentity =>
  SourceTextIdentity.make({ ...source, ...fields });

// Each of the eight preimage fields, changed alone.
const fieldChanges: ReadonlyArray<readonly [string, (source: SourceTextIdentity, salt: string) => SourceTextIdentity]> =
  [
    ["scopeRef", (source, salt) => withFields(source, { scopeRef: `${source.scopeRef}${salt}` })],
    ["sourceRef", (source, salt) => withFields(source, { sourceRef: `${source.sourceRef}${salt}` })],
    [
      "locator",
      (source, salt) =>
        withFields(source, { locator: SourceTextLocator.make(`${source.locator}/${Str.replaceAll("\\", "/")(salt)}`) }),
    ],
    ["sourceDigest", (source, salt) => withFields(source, { sourceDigest: digestOf(`${source.sourceDigest}${salt}`) })],
    ["textDigest", (source, salt) => withFields(source, { textDigest: digestOf(`${source.textDigest}${salt}`) })],
    [
      "extractor name",
      (source, salt) =>
        withFields(source, {
          extractor: SourceTextExtractor.make({ ...source.extractor, name: `${source.extractor.name}${salt}` }),
        }),
    ],
    [
      "extractor version",
      (source, salt) =>
        withFields(source, {
          extractor: SourceTextExtractor.make({ ...source.extractor, version: `${source.extractor.version}${salt}` }),
        }),
    ],
    [
      "normalizationVersion",
      (source, salt) => withFields(source, { normalizationVersion: `${source.normalizationVersion}${salt}` }),
    ],
  ];

describe("@beep/text CaptureId", () => {
  it("accepts only sha256-prefixed capture ids", () => {
    expect(S.is(CaptureId)(goldenId)).toBe(true);
    expect(A.filter(["c7f8616c", `cm1:${Str.slice(7)(goldenId)}`], S.is(CaptureId))).toEqual([]);
  });

  it("encodes the eight fields of a capture in the order of the occurrence preimage", () => {
    assertSuccess(S.encodeResult(CapturePreimage.schema)(citationSource), CapturePreimage.golden.preimage);
    expect(CapturePreimage.golden.preimage).toEqual(A.take(OccurrencePreimage.golden.preimage, 8));
    assertSuccess(S.decodeResult(CapturePreimage.schema)(CapturePreimage.golden.preimage), citationSource);
  });
});

it.layer(Digest.layerWebCrypto, { timeout: "10 seconds" })("@beep/text capture minting", (it) => {
  it.effect(
    "mints the capture golden through the Digest service and the sync twin",
    Effect.fnUntraced(function* () {
      const id = yield* mintCaptureId(citationSource);
      expect(id).toBe(goldenId);
      assertSuccess(mintSync(citationSource), goldenId);
    })
  );

  it.effect(
    "gives equal text bytes in two scopes two capture ids",
    Effect.fnUntraced(function* () {
      const other = withFields(citationSource, { scopeRef: "matter:other" });
      expect(other.textDigest).toBe(citationSource.textDigest);
      const ids = yield* Effect.forEach([citationSource, other], mintCaptureId, { concurrency: 1 });
      expect(HashSet.size(HashSet.fromIterable(ids))).toBe(2);
    })
  );

  it.effect.prop(
    "agrees with the sync twin and survives serialization",
    [captureCase],
    ([source]) =>
      Effect.gen(function* () {
        const id = yield* mintCaptureId(source);
        assertSuccess(mintSync(source), id);
        const reread = yield* S.encodeEffect(CaptureJson)(source).pipe(Effect.flatMap(S.decodeEffect(CaptureJson)));
        const rereadId = yield* mintCaptureId(reread);
        expect(rereadId).toBe(id);
      }),
    runs
  );

  it.effect.prop(
    "changes when any one of the eight fields changes",
    [captureCase, saltArbitrary],
    ([source, salt]) =>
      Effect.gen(function* () {
        const id = yield* mintCaptureId(source);
        for (const [field, change] of fieldChanges) {
          const changed = yield* mintCaptureId(change(source, salt));
          expect(changed, field).not.toBe(id);
        }
      }),
    runs
  );
});
