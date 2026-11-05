import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationPublicationMetadataConfiguration } from "@beep/law-practice-server/internal/Citation/MetadataComposition";
import {
  CitationPreCaseMetadataInput,
  CitationPreCaseMetadataPatch,
  makeCitationPreCaseMetadata,
} from "@beep/law-practice-server/internal/Citation/PreCaseMetadata";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import {
  assertCitationWorkerCapturedDeadline,
  assertCitationWorkerClosedLifetime,
  assertCitationWorkerCompositionReleased,
  setupCitationRegexRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationPreCaseMetadata");
const Value = S.NullOr(CitationNativeUnicodeHex);
const Input = S.Struct({
  ...CitationPreCaseMetadataInput.fields,
  words: S.Array(S.Struct({ kind: CitationPreCaseMetadataInput.fields.words.value.fields.kind, data: Value })),
  plaintiff: Value,
  defendant: Value,
});
const Patch = S.Struct({
  ...CitationPreCaseMetadataPatch.fields,
  metadata: S.Struct({ pinCite: Value, antecedentGuess: Value, pinCiteSpanStart: S.NullOr(S.Int) }),
});
const Configuration = S.Struct({
  ...CitationPublicationMetadataConfiguration.fields,
  pattern: CitationNativeUnicodeHex,
  yearPattern: CitationNativeUnicodeHex,
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-pre-case-metadata/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("18c2ed6e9f30b4066a27fc92ec02163a4c7396e05f765d66710d370380868a4c"),
    patternSha256: S.tag("d151b7a02a061593bb44bd881eee2dc174fff7f1b5449512f25cc2b98fb315b0"),
    configuration: Configuration,
    cases: S.Array(
      S.Struct({ id: S.Natural, smoke: S.Boolean, request: Input, patch: S.NullOr(Patch), calls: S.Natural })
    ).check(S.isBetweenLength(540, 540)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original pre-case helper skips, native matches and exact source field updates.",
  })
);
const load = Effect.fn("PreCaseMetadataTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/pre-case-metadata.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("6cfd521369b960f677231e9e5c9ca2981c6dc0ca6c0f7e9edf551f01c3dda4bd");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("PreCaseMetadataTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  maximum?: number,
  enclosing = false,
  controlled = false
) {
  const corpus = yield* load();
  const setup = yield* setupCitationRegexRuntime(kind, maximum);
  const limits = controlled === true ? { ...setup.limits, extractDeadline: Duration.millis(997) } : setup.limits;
  const operation = yield* makeCitationOperationAdmission(limits).pipe(Effect.provideContext(setup.context));
  const budget = yield* makeCitationTextBudget(limits);
  const context = Context.add(setup.context, CitationOperationAdmission, operation);
  const provided = enclosing === true ? Context.add(context, CitationTextBudget, budget) : context;
  const configuration = { ...corpus.configuration };
  const metadata = yield* makeCitationPreCaseMetadata(limits, setup.runtime, configuration).pipe(
    Effect.provideContext(provided)
  );
  return { ...setup, corpus, configuration, operation, budget, metadata };
});
/** Compare every early skip locally plus actual backward matching through both runtimes. */
export const replayCitationPreCaseMetadata = Effect.fn("PreCaseMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const rows = full ? setup.corpus.cases : A.filter(setup.corpus.cases, (row) => row.smoke || row.calls === 0);
  let calls = 0;
  for (const row of rows) {
    const result = yield* setup.metadata.apply(row.request);
    expect(O.getOrNull(result.patch), `source pre-case ${row.id}`).toEqual(row.patch);
    if (row.calls === 0) expect(result.reservedUnits).toBe(0);
    calls += row.calls;
  }
  expect(rows).toHaveLength(full ? 540 : 230);
  expect(calls).toBe(full ? 324 : 14);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Exact reservation, immutable installation and skip-before-word decoding. */
export const assertCitationPreCaseBudget = Effect.fn("PreCaseMetadataTest.budget")(function* () {
  const exact = yield* install("bun", 99);
  const row = A.getUnsafe(exact.corpus.cases, 23);
  const first = yield* exact.metadata.apply(row.request);
  expect(O.getOrNull(first.patch)).toEqual(row.patch);
  expect(first.reservedUnits).toBe(99);
  exact.configuration.pattern.bytes.fill(0);
  exact.configuration.yearPattern.bytes.fill(0);
  const again = yield* exact.metadata.apply(row.request);
  expect(O.getOrNull(again.patch)).toEqual(row.patch);
  expect(again.reservedUnits).toBe(99);
  const bounded = yield* install("bun", 98);
  const failure = yield* bounded.metadata.apply(row.request).pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  yield* assertCitationWorkerCompositionReleased(bounded.operation, bounded.admission, bounded.observed.snapshot, 1);
  const enclosing = yield* install("bun", 102, true);
  yield* enclosing.budget.reserve(4);
  const exhausted = yield* enclosing.metadata.apply(row.request).pipe(Effect.flip);
  expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
  const reserved = yield* enclosing.budget.snapshot;
  expect(reserved).toBe(97);
  const skipped = yield* install("bun", 1);
  const result = yield* skipped.metadata.apply({
    plaintiff: { width: 1, bytes: new TextEncoder().encode("KNOWN") },
    defendant: null,
    words: "unread",
    index: -999999,
    spanStart: -1,
  });
  expect(O.getOrNull(result.patch)).toBeNull();
  expect(result.reservedUnits).toBe(0);
  const none = yield* skipped.observed.snapshot;
  expect(none).toEqual({ spawned: 0, confirmed: 0 });
});
/** Installation policy, closed operation and captured deadlines remain authoritative. */
export const assertCitationPreCaseLifetime = Effect.fn("PreCaseMetadataTest.lifetime")(function* () {
  const scope = yield* Scope.make();
  const closed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, scope));
  const row = A.getUnsafe(closed.corpus.cases, 23);
  yield* assertCitationWorkerClosedLifetime(scope, closed.metadata.apply(row.request), closed.observed.snapshot);
  const timed = yield* install("bun", undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(
    timed.metadata.apply({
      ...row.request,
      words: [
        { kind: "Text", data: { width: 1, bytes: new TextEncoder().encode(Str.repeat(65536)("x")) } },
        { kind: "CitationToken", data: { width: 1, bytes: new TextEncoder().encode("1 X 1") } },
      ],
    }),
    timed.timer.trigger
  );
  const observed = yield* timed.observed.snapshot;
  expect(observed).toEqual({ spawned: 0, confirmed: 0 });
});
