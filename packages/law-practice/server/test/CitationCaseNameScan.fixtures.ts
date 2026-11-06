/** Actual initialized source scan states and existing runtime fixture owners.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationCaseNameScanConfiguration,
  CitationCaseNameScanInput,
  CitationCaseNameScanState,
  makeCitationCaseNameScan,
} from "@beep/law-practice-server/internal/Citation/CaseNameScan";
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
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationCaseNameScan");
const Value = S.NullOr(CitationNativeUnicodeHex);
const Input = S.Struct({
  ...CitationCaseNameScanInput.fields,
  words: S.Array(
    S.Struct({
      kind: CitationCaseNameScanInput.fields.words.value.fields.kind,
      data: Value,
      groups: S.Record(S.String, Value),
    })
  ),
});
const State = S.Struct({ ...CitationCaseNameScanState.fields, candidateCaseName: Value, preCiteYear: Value });
const Configuration = S.Struct({
  ...CitationCaseNameScanConfiguration.fields,
  patterns: S.Struct({
    year: CitationNativeUnicodeHex,
    connectorSpace: CitationNativeUnicodeHex,
    capitalized: CitationNativeUnicodeHex,
    connectorBoundary: CitationNativeUnicodeHex,
    trailingDigits: CitationNativeUnicodeHex,
  }),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-case-name-scan/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("fe4ef0ed1dffbe13a40f6319c44e99cf7374c07b1664be2c9945f4ca1fe08be7"),
    configuration: Configuration,
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        smoke: S.Boolean,
        request: Input,
        state: State,
        error: S.NullOr(S.Literals(["IndexError", "KeyError", "TypeError"])),
        calls: S.Array(S.Struct({ pattern: S.String, mode: S.String, source: CitationNativeUnicodeHex })),
      })
    ).check(S.isBetweenLength(64, 64)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Complete initialized source states/errors and every real regex invocation, not reconstructed expected state.",
  })
);
const load = Effect.fn("CaseNameScanTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/case-name-scan.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("9731078b964f5daa0c075b630a5fa236efe06cb297c123f45f39a637bbac9553");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("CaseNameScanTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  maximum?: number,
  enclosing = false,
  controlled = false
) {
  const corpus = yield* load();
  const setup = yield* setupCitationMetadataRuntime(kind, maximum, enclosing, controlled, 8192);
  const configuration = { ...corpus.configuration, patterns: { ...corpus.configuration.patterns } };
  const scanner = yield* makeCitationCaseNameScan(setup.limits, setup.runtime, configuration).pipe(
    Effect.provideContext(setup.provided)
  );
  return { ...setup, corpus, configuration, stage: { apply: scanner.scan } };
});
const sourceError = (error: "IndexError" | "KeyError" | "TypeError", row: (typeof Corpus.Type.cases)[number]) =>
  error === "KeyError"
    ? "missing-stop-word"
    : error === "TypeError"
      ? "invalid-token-length"
      : row.request.index > row.request.words.length
        ? "index-out-of-range"
        : "empty-word";
const assertScanRow = Effect.fn("CaseNameScanTest.row")(function* (
  stage: Effect.Success<ReturnType<typeof install>>["stage"],
  row: (typeof Corpus.Type.cases)[number]
) {
  if (row.error !== null)
    return yield* assertCitationMetadataFailure(stage.apply(row.request), {
      _tag: "CitationCaseNameScanFailure",
      reason: sourceError(row.error, row),
    });
  const result = yield* stage.apply(row.request);
  expect(result.state, `source initialized scan ${row.id}`).toEqual(row.state);
});
// Canonical controls retain connectors, digit rejection, combining marks, v/plaintiff boundaries,
// punctuation, native years/parentheses, special token branches and scalar/surrogate distinctions.
const smokeBoundaryRows = [
  5, 6, 9, 13, 14, 18, 19, 20, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 37, 38, 52, 53, 54, 55, 56, 57, 58,
];
/** Smoke includes source branch controls, failures and no-call paths; full original replay is hosted. */
export const replayCitationCaseNameScan = Effect.fn("CaseNameScanTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const rows = A.filter(
    setup.corpus.cases,
    (row) => full || row.smoke || A.contains(smokeBoundaryRows, row.id) || row.error !== null || row.calls.length === 0
  );
  yield* Effect.forEach(rows, (row) => assertScanRow(setup.stage, row), { discard: true });
  expect(rows).toHaveLength(full ? 64 : 54);
  const calls = A.reduce(rows, 0, (sum, row) => sum + row.calls.length);
  expect(calls).toBe(full ? 313 : 198);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});

/** Exact invocation reservations precede native allocation and preserve installed patterns. */
export const assertCitationCaseNameScanBudget = Effect.fn("CaseNameScanTest.budget")(function* () {
  const exact = yield* install("bun", 22);
  const row = A.getUnsafe(exact.corpus.cases, 4);
  const accepted = yield* exact.stage.apply(row.request);
  expect(accepted.state).toEqual(row.state);
  expect(accepted.reservedUnits).toBe(22);
  exact.configuration.patterns.year.bytes.fill(0);
  exact.configuration.patterns.trailingDigits.bytes.fill(0);
  const repeated = yield* exact.stage.apply(row.request);
  expect(repeated).toEqual(accepted);
  const tight = yield* install("bun", 21);
  yield* assertCitationMetadataRefusal(
    tight.stage.apply(row.request),
    tight.operation,
    tight.admission,
    tight.observed.snapshot,
    3
  );
  const enclosing = yield* install("bun", 25, true);
  yield* assertCitationMetadataEnclosingRefusal(enclosing.stage.apply(row.request), enclosing.budget, 4, 23);
});
/** Closed parent lifetime and captured timing refuse before creating a child. */
export const assertCitationCaseNameScanLifetime = Effect.fn("CaseNameScanTest.lifetime")(function* () {
  yield* assertCitationMetadataFixtureLifetime(install, 4, [
    { ...citationMetadataDeadlineText(), groups: {} },
    { kind: "CitationToken", data: { width: 1, bytes: new TextEncoder().encode("1 X 1") }, groups: {} },
  ]);
});
/** The existing default ceiling still refuses expanded boundary patterns. */
export const assertCitationCaseNameScanDefaultPolicy = Effect.fn("CaseNameScanTest.defaultPolicy")(function* () {
  const corpus = yield* load();
  const setup = yield* setupCitationMetadataRuntime("bun");
  for (const configuration of [
    null,
    {
      ...corpus.configuration,
      patterns: { ...corpus.configuration.patterns, year: { width: 1, bytes: new Uint8Array([88]) } },
    },
  ]) {
    const rejected = yield* makeCitationCaseNameScan(setup.limits, setup.runtime, configuration).pipe(
      Effect.provideContext(setup.provided),
      Effect.flip
    );
    expect(rejected).toMatchObject({ reason: "invalid-configuration" });
  }
  const scanner = yield* makeCitationCaseNameScan(setup.limits, setup.runtime, corpus.configuration).pipe(
    Effect.provideContext(setup.provided)
  );
  const failure = yield* scanner.scan(A.getUnsafe(corpus.cases, 4).request).pipe(Effect.flip);
  expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 4);
});
