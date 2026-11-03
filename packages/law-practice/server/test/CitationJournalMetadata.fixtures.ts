import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationJournalMetadataConfiguration,
  CitationJournalMetadataPatch,
  makeCitationJournalMetadata,
} from "@beep/law-practice-server/internal/Citation/JournalMetadata";
import { CitationLawMetadataInput } from "@beep/law-practice-server/internal/Citation/LawMetadata";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Str from "effect/String";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import {
  assertCitationWorkerCapturedDeadline,
  assertCitationWorkerCompositionReleased,
  makeCitationMetadataTestContext,
  setupCitationRegexRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationJournalMetadata");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Value = S.NullOr(Native);
const Input = S.Struct({
  ...CitationLawMetadataInput.fields,
  words: S.Array(S.Struct({ kind: CitationLawMetadataInput.fields.words.value.fields.kind, data: Value })),
});
const Configuration = S.Struct({
  ...CitationJournalMetadataConfiguration.fields,
  journalPattern: Native,
  yearPattern: Native,
});
const Patch = S.Struct({
  ...CitationJournalMetadataPatch.fields,
  metadata: S.Struct({ pinCite: Value, parenthetical: Value, year: Value }),
});
const Ref = S.NullOr(CitationEditionRef);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-journal-metadata/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    currentYear: S.Literal(2026),
    producerSha256: S.tag("b0e9a582bb93ad61956312767d997e731b05bb0af64ad3558d4dec47075ae8f8"),
    lawCorpusSha256: S.tag("098ed3007ff63ca34b63310f822b037fea3ee5fb3c1874351bbeb67c373b6dea"),
    fullLawCorpusSha256: S.tag("e899dae1c175c26a70fc15baa916596b7f63ed5967ef79a028a62083f64d9784"),
    lookaheadCorpusSha256: S.tag("7fd24d7ff71257d1a563cb02aca1275337b08a52e327ce138cbe35c72908a971"),
    configuration: Configuration,
    inputs: S.Array(
      S.Struct({
        request: Input,
        patch: Patch,
        smoke: S.Boolean,
        calls: S.Array(S.Literals(["journal", "parenthetical-year"])),
      })
    ).check(S.isBetweenLength(192, 192)),
    controls: S.Array(
      S.Struct({ exact: S.Array(CitationEditionRef), variation: S.Array(CitationEditionRef), prior: Ref })
    ).check(S.isBetweenLength(6, 6)),
    cases: S.Array(S.Tuple([S.Natural, S.Natural, Ref, S.Array(CitationEditionRef)])).check(
      S.isBetweenLength(1152, 1152)
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual full journal method observations, exact helper patches, calls and edition predicates.",
  })
);
const load = Effect.fn("JournalMetadataTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/journal-metadata.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("0ed802a638ba04073c4410ee826a40e463cd1c22b31cb49b895339f232a5aa6f");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("JournalMetadataTest.install")(function* (
  kind: CitationNativeRuntimeKind,
  budget?: number,
  enclosing = false,
  controlled = false
) {
  const corpus = yield* load();
  const setup = yield* setupCitationRegexRuntime(kind, budget);
  const limits = controlled === true ? { ...setup.limits, extractDeadline: Duration.millis(997) } : setup.limits;
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const reads = A.empty<CitationEditionRef>();
  const observedOwner = CitationFrozenEditions.of({
    ...owner,
    source: Effect.fn("JournalMetadataTest.source")(function* (ref: CitationEditionRef) {
      reads.push(ref);
      return yield* owner.source(ref);
    }),
  });
  const { operation, context: base } = yield* makeCitationMetadataTestContext(setup.context, limits);
  const text = yield* makeCitationTextBudget(limits);
  const context = Context.add(base, CitationFrozenEditions, observedOwner);
  const installed = enclosing === true ? Context.add(context, CitationTextBudget, text) : context;
  const configuration = { ...corpus.configuration };
  const metadata = yield* makeCitationJournalMetadata(limits, setup.runtime, configuration).pipe(
    Effect.provideContext(installed),
    DateTime.withCurrentZoneOffset(0)
  );
  return { ...setup, corpus, configuration, metadata, reads, operation, text };
});
/** Native source updates, superclass choices and ordered reads through actual processes. */
export const replayCitationJournalMetadata = Effect.fn("JournalMetadataTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const setup = yield* install(kind);
  const rows = full
    ? setup.corpus.cases
    : A.filter(
        setup.corpus.cases,
        ([index, control]) =>
          A.getUnsafe(setup.corpus.inputs, index).smoke &&
          (control === ((index - 3) / 4) % 6 || (index === 3 && control === 5))
      );
  let calls = 0;
  for (const [index, control, guess, checks] of rows) {
    const input = A.getUnsafe(setup.corpus.inputs, index);
    const selected = A.getUnsafe(setup.corpus.controls, control);
    setup.reads.length = 0;
    const result = yield* setup.metadata.apply({ ...input.request, ...selected });
    const patch = yield* Effect.fromOption(result.patch);
    expect(patch).toEqual(input.patch);
    expect(result.editionGuess).toBe(guess);
    expect(setup.reads).toEqual(patch.year !== null && patch.year <= 2026 ? checks : []);
    calls += input.calls.length;
  }
  expect(rows).toHaveLength(full ? 1152 : 17);
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, calls);
});
/** Source helper composition retains the exact empty-match budget and fresh owners. */
export const assertCitationJournalMetadataBudget = Effect.fn("JournalMetadataTest.budget")(function* () {
  const bounded = yield* install("bun", 40);
  const input = A.getUnsafe(bounded.corpus.inputs, 11);
  const raw = { ...input.request, ...A.getUnsafe(bounded.corpus.controls, 0) };
  const failure = yield* bounded.metadata.apply(raw).pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  yield* assertCitationWorkerCompositionReleased(bounded.operation, bounded.admission, bounded.observed.snapshot, 1);
  const exact = yield* install("bun", 41);
  const result = yield* exact.metadata.apply(raw);
  expect(result.reservedUnits).toBe(41);
  const patch = yield* Effect.fromOption(result.patch);
  expect(patch).toEqual(input.patch);
  exact.configuration.journalPattern.bytes.fill(0);
  exact.configuration.yearPattern.bytes.fill(0);
  exact.configuration.highestValidYear = 9999;
  const repeated = yield* exact.metadata.apply(raw);
  expect(repeated.reservedUnits).toBe(41);
  const future = A.getUnsafe(exact.corpus.inputs, 63);
  const frozenYear = yield* exact.metadata.apply({ ...future.request, ...A.getUnsafe(exact.corpus.controls, 0) });
  const futurePatch = yield* Effect.fromOption(frozenYear.patch);
  expect(futurePatch).toEqual(future.patch);
  const outer = yield* install("bun", 44, true);
  yield* outer.text.reserve(4);
  const exhausted = yield* outer.metadata.apply(raw).pipe(Effect.flip);
  expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
  const used = yield* outer.text.snapshot;
  expect(used).toBe(36);
});
/** Shared lifetime and deadline control stays effective on the journal entrypoint. */
export const assertCitationJournalMetadataLifetime = Effect.fn("JournalMetadataTest.lifetime")(function* () {
  const scope = yield* Scope.make();
  const closed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, scope));
  const input = A.getUnsafe(closed.corpus.inputs, 11);
  const raw = { ...input.request, ...A.getUnsafe(closed.corpus.controls, 0) };
  yield* Scope.close(scope, Exit.void);
  const failure = yield* closed.metadata.apply(raw).pipe(Effect.flip);
  expect(failure).toMatchObject({ reason: "closed" });
  const none = yield* closed.observed.snapshot;
  expect(none).toEqual({ spawned: 0, confirmed: 0 });
  const timed = yield* install("bun", undefined, false, true);
  yield* assertCitationWorkerCapturedDeadline(
    timed.metadata.apply({
      ...raw,
      words: [{ kind: "Text", data: { width: 1, bytes: new TextEncoder().encode(Str.repeat(65536)("x")) } }],
    }),
    timed.timer.trigger
  );
  const observed = yield* timed.observed.snapshot;
  expect(observed).toEqual({ spawned: 0, confirmed: 0 });
});
