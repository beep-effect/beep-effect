/** Digest-bound extract_pin_cite observations and actual runtime replay.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPublicationMetadataConfiguration } from "@beep/law-practice-server/internal/Citation/MetadataComposition";
import { makeCitationPinCiteCleaner } from "@beep/law-practice-server/internal/Citation/MetadataStrings";
import {
  CitationPinExtractionInput,
  CitationPinExtractionResult,
  makeCitationPinExtraction,
} from "@beep/law-practice-server/internal/Citation/PinExtraction";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import {
  assertCitationMetadataEnclosingRefusal,
  assertCitationMetadataFailure,
  assertCitationMetadataFixtureLifetime,
  assertCitationMetadataRefusal,
  assertCitationWorkerCompositionReleased,
  citationMetadataDeadlineText,
  makeCitationMetadataFixtureInstaller,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationPinExtraction");
const Native = CitationNativeUnicodeHex;
const Value = S.NullOr(Native);
const Input = S.Struct({
  ...CitationPinExtractionInput.fields,
  words: S.Array(S.Struct({ kind: CitationPinExtractionInput.fields.words.value.fields.kind, data: Value })),
  prefix: Native,
});
const Result = S.Struct({
  pinCite: Value,
  pinCiteSpanEnd: CitationPinExtractionResult.fields.pinCiteSpanEnd,
  parenthetical: Value,
});
const Configuration = S.Struct({
  ...CitationPublicationMetadataConfiguration.fields,
  pattern: Native,
  yearPattern: Native,
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-pin-extraction/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("ef8280a91ea82f96b638064629e0fb4dbf4c0b6b615b3d09730574cb19798117"),
    patternSha256: S.tag("3d1b06d98647ef244e02b08aee15ff80a0fb3971528a8a9c97854dd35916bb3d"),
    configuration: Configuration,
    details: S.Array(S.Struct({ source: Value, pinCite: Value, trailingEnd: S.Natural })).check(
      S.isBetweenLength(9, 9)
    ),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        smoke: S.Boolean,
        request: Input,
        result: S.NullOr(Result),
        error: S.NullOr(S.Literals(["index-out-of-range", "invalid-token"])),
        calls: S.Natural,
      })
    ).check(S.isBetweenLength(432, 432)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original pin tuple results, Python indexing failures and shared right-trim length observations.",
  })
);
const load = Effect.fn("PinExtractionTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/pin-extraction.json", import.meta.url))
  );
  const digest = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(digest).toBe("0874170bf716c53337fbb17f75819b2af7ed890b999de4d86b0b585902c82f75");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = makeCitationMetadataFixtureInstaller(makeCitationPinExtraction)(load());
/** Full source replay is hosted; smoke retains source errors and both actual runtimes. */
export const replayCitationPinExtraction = Effect.fn("PinExtractionTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const strings = yield* makeCitationPinCiteCleaner(setup.limits);
  for (const row of setup.corpus.details) {
    const actual = yield* strings.inspectPinCite(row.source);
    expect(actual).toEqual({ pinCite: row.pinCite, trailingEnd: row.trailingEnd });
  }
  const rows = full ? setup.corpus.cases : A.filter(setup.corpus.cases, (row) => row.smoke);
  for (const row of rows) {
    if (row.error !== null) {
      yield* assertCitationMetadataFailure(setup.stage.apply(row.request), { reason: row.error });
    } else {
      const actual = yield* setup.stage.apply(row.request);
      expect({
        pinCite: actual.pinCite,
        pinCiteSpanEnd: actual.pinCiteSpanEnd,
        parenthetical: actual.parenthetical,
      }).toEqual(row.result);
    }
  }
  expect(rows).toHaveLength(full ? 432 : 24);
  const calls = A.reduce(rows, 0, (total, row) => total + row.calls);
  expect(calls).toBe(full ? 453 : 24);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Exact receiving allocation and immutable installation with shared budget authority. */
export const assertCitationPinExtractionBudget = Effect.fn("PinExtractionTest.budget")(function* () {
  const exact = yield* install("bun", 44);
  const row = A.getUnsafe(exact.corpus.cases, 22);
  const actual = yield* exact.stage.apply(row.request);
  expect(actual.reservedUnits).toBe(44);
  expect({
    pinCite: actual.pinCite,
    pinCiteSpanEnd: actual.pinCiteSpanEnd,
    parenthetical: actual.parenthetical,
  }).toEqual(row.result);
  exact.configuration.pattern.bytes.fill(0);
  exact.configuration.yearPattern.bytes.fill(0);
  const repeated = yield* exact.stage.apply(row.request);
  expect(repeated).toEqual(actual);
  const bounded = yield* install("bun", 43);
  yield* assertCitationMetadataRefusal(
    bounded.stage.apply(row.request),
    bounded.operation,
    bounded.admission,
    bounded.observed.snapshot,
    1
  );
  const enclosing = yield* install("bun", 47, true);
  yield* assertCitationMetadataEnclosingRefusal(enclosing.stage.apply(row.request), enclosing.budget, 4, 43);
});
/** Closed lifetime and captured deadline precede native worker creation. */
export const assertCitationPinExtractionLifetime = Effect.fn("PinExtractionTest.lifetime")(function* () {
  yield* assertCitationMetadataFixtureLifetime(install, 22, [
    { kind: "IdToken", data: { width: 1, bytes: new TextEncoder().encode("Id.") } },
    citationMetadataDeadlineText(),
  ]);
});
