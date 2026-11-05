import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import {
  CitationLawMetadataConfiguration,
  CitationLawMetadataInput,
  CitationLawMetadataPatch,
  makeCitationLawMetadata,
} from "@beep/law-practice-server/internal/Citation/LawMetadata";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import {
  assertCitationWorkerCapturedDeadline,
  assertCitationWorkerClosedLifetime,
  assertCitationWorkerCompositionReleased,
  setupCitationRegexRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationLawMetadata");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Configuration = S.Struct({ ...CitationLawMetadataConfiguration.fields, lawPattern: Native, yearPattern: Native });
const Input = S.Struct({
  ...CitationLawMetadataInput.fields,
  words: S.Array(
    S.Struct({
      kind: CitationLawMetadataInput.fields.words.value.fields.kind,
      data: S.NullOr(Native),
    })
  ),
});
const Value = S.NullOr(Native);
const Patch = S.Struct({
  ...CitationLawMetadataPatch.fields,
  metadata: S.Struct({ pinCite: Value, publisher: Value, day: Value, month: Value, parenthetical: Value, year: Value }),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-law-metadata/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("c8f1e6a457b73a17188214e7f7076ade70ce4323670f18e7798ea392c0aeedb4"),
    bindingCorpusSha256: S.tag("4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d"),
    configuration: Configuration,
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        smoke: S.Boolean,
        request: Input,
        patch: Patch,
        calls: S.Array(S.Literals(["law", "parenthetical-year"])),
      })
    ).check(S.isBetweenLength(128, 128)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual add_law_metadata mutations and regex routes under explicitly frozen source calendar state.",
  })
);
/** Digest-bound source law inputs and complete helper state. */
export const loadCitationLawMetadataFixtures = Effect.fn("LawMetadataTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/law-metadata.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("LawMetadataTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  configuration: unknown,
  budget?: number,
  enclosing = false,
  controlled = false
) {
  const setup = yield* setupCitationRegexRuntime(kind, budget);
  const limits = controlled === true ? { ...setup.limits, extractDeadline: Duration.millis(997) } : setup.limits;
  const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(setup.context));
  const owner = yield* makeCitationTextBudget(setup.limits);
  const context = setup.context.pipe(Context.add(CitationOperationAdmission, operation));
  const installed = enclosing === true ? context.pipe(Context.add(CitationTextBudget, owner)) : context;
  const metadata = yield* makeCitationLawMetadata(limits, setup.runtime, configuration).pipe(
    Effect.provideContext(installed)
  );
  return { ...setup, operation, owner, metadata };
});
/** Complete field/state comparisons, with acknowledged source search routes. */
export const replayCitationLawMetadata = Effect.fn("LawMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* loadCitationLawMetadataFixtures();
  const setup = yield* install(kind, corpus.configuration);
  const rows = full ? corpus.cases : A.filter(corpus.cases, (row) => row.smoke);
  for (const row of rows) {
    const actual = yield* setup.metadata.apply(row.request);
    const patch = yield* Effect.fromOption(actual.patch);
    expect(patch, `source law row ${row.id}`).toEqual(row.patch);
    expect(actual.reservedUnits).toBeLessThanOrEqual(setup.limits.producedTextUtf16);
  }
  expect(rows).toHaveLength(full ? 128 : 10);
  const calls = A.reduce(rows, 0, (total, row) => total + row.calls.length);
  expect(calls).toBe(full ? 156 : 13);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Partial allocation failure cannot publish a patch; caller mutation cannot change configuration. */
export const assertCitationLawMetadataBudget = Effect.fn("LawMetadataTest.budget")(function* () {
  const corpus = yield* loadCitationLawMetadataFixtures();
  const row = yield* Effect.fromOption(A.get(corpus.cases, 11));
  const bounded = yield* install("bun", corpus.configuration, 40);
  const failure = yield* bounded.metadata.apply(row.request).pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  const before = yield* bounded.observed.snapshot;
  expect(before).toEqual({ spawned: 1, confirmed: 1 });
  const exact = yield* install("bun", corpus.configuration, 41);
  const actual = yield* exact.metadata.apply(row.request);
  const patch = yield* Effect.fromOption(actual.patch);
  expect(patch).toEqual(row.patch);
  expect(actual.reservedUnits).toBe(41);
  const repeated = yield* exact.metadata.apply(row.request);
  expect(repeated.reservedUnits).toBe(41);
  const outer = yield* install("bun", corpus.configuration, 44, true);
  yield* outer.owner.reserve(4);
  const enclosing = yield* outer.metadata.apply(row.request).pipe(Effect.flip);
  expect(enclosing).toMatchObject({ limit: "producedTextUtf16" });
  const reserved = yield* outer.owner.snapshot;
  expect(reserved).toBe(36);
  const ownedConfig = { ...corpus.configuration, highestValidYear: corpus.configuration.highestValidYear };
  const owned = yield* install("bun", ownedConfig);
  ownedConfig.highestValidYear = 9999;
  corpus.configuration.lawPattern.bytes.fill(0);
  corpus.configuration.yearPattern.bytes.fill(0);
  const afterMutation = yield* owned.metadata.apply(row.request);
  const unchanged = yield* Effect.fromOption(afterMutation.patch);
  expect(unchanged).toEqual(row.patch);
  const future = yield* Effect.fromOption(A.get(corpus.cases, 63));
  const frozenYear = yield* owned.metadata.apply(future.request);
  const futurePatch = yield* Effect.fromOption(frozenYear.patch);
  expect(futurePatch).toEqual(future.patch);
});

/** Closed installation, lifetime and deadline failures precede partial metadata. */
export const assertCitationLawMetadataLifetime = Effect.fn("LawMetadataTest.lifetime")(function* () {
  const corpus = yield* loadCitationLawMetadataFixtures();
  const row = yield* Effect.fromOption(A.get(corpus.cases, 11));
  const invalid = yield* install("bun", {
    ...corpus.configuration,
    lawPattern: { width: 1, bytes: new TextEncoder().encode("X") },
  }).pipe(Effect.flip);
  expect(invalid).toMatchObject({ reason: "invalid-configuration" });
  const scope = yield* Scope.make();
  const closed = yield* install("bun", corpus.configuration).pipe(Effect.provideService(Scope.Scope, scope));
  yield* assertCitationWorkerClosedLifetime(scope, closed.metadata.apply(row.request), closed.observed.snapshot);
  const timed = yield* install("bun", corpus.configuration, undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(
    timed.metadata.apply({
      ...row.request,
      words: [
        { kind: "CitationToken", data: { width: 1, bytes: new TextEncoder().encode("1 X 1") } },
        { kind: "Text", data: { width: 1, bytes: new TextEncoder().encode(Str.repeat(65536)("x")) } },
      ],
    }),
    timed.timer.trigger
  );
  const none = yield* timed.observed.snapshot;
  expect(none).toEqual({ spawned: 0, confirmed: 0 });
});
