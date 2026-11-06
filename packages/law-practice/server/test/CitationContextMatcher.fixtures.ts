import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationContextMatch,
  makeCitationContextMatcher,
} from "@beep/law-practice-server/internal/Citation/ContextMatcher";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexSourceFlags } from "@beep/law-practice-server/internal/Citation/RegexEngine";
import { CitationTokenContextInput } from "@beep/law-practice-server/internal/Citation/TokenContext";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { setupCitationRegexRuntime } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationContextMatcher");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Result = S.Struct({
  context: Native,
  match: CitationContextMatch.fields.match,
});
const Request = S.Struct({
  ...CitationTokenContextInput.fields,
  prefix: Native,
  words: S.Array(S.Struct({ kind: CitationTokenContextInput.fields.words.value.fields.kind, data: S.NullOr(Native) })),
});
const Pattern = S.Struct({
  id: S.Natural,
  pattern: Native,
  flags: CitationRegexSourceFlags,
  bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
  cases: S.Array(
    S.Struct({ request: Request, failure: S.NullOr(S.Literal("IndexError")), result: S.NullOr(Result) })
  ).check(S.isBetweenLength(18, 18)),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-context-matches/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("2ab68a752308b5b4a0a1fa8b01ff066223b7f335705ca8b40b866e31c39d0980"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    patterns: S.Array(Pattern).check(S.isBetweenLength(8, 8)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual source match_on_tokens executions with both wrapped native descriptors.",
  })
);
const load = Effect.fn("ContextMatcherTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/context-matches.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("ContextMatcherTest.install")(function* (
  row: typeof Pattern.Type,
  kind: CitationNativeRuntimeKind,
  budget?: number
) {
  const setup = yield* setupCitationRegexRuntime(kind, budget);
  const matcher = yield* makeCitationContextMatcher(
    setup.limits,
    setup.runtime,
    row.pattern,
    row.flags,
    row.bindings
  ).pipe(Effect.provideContext(setup.context));
  return { ...setup, matcher };
});
const assertObservation = Effect.fn("ContextMatcherTest.observation")(function* (
  setup: Effect.Success<ReturnType<typeof install>>,
  observation: (typeof Pattern.Type.cases)[number]
) {
  if (observation.failure !== null) {
    const failure = yield* setup.matcher.search(observation.request).pipe(Effect.flip);
    expect(failure).toMatchObject({ reason: "index-out-of-range" });
  } else {
    const actual = yield* setup.matcher.search(observation.request);
    expect(actual).toEqual(observation.result);
  }
});
/** Replay original matching through owned, acknowledged native children. */
export const replayCitationContextMatches = Effect.fn("ContextMatcherTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  for (const row of corpus.patterns) {
    const setup = yield* install(row, kind);
    const cases = full
      ? row.cases
      : yield* Effect.forEach([0, 2, 5, 10, 12, 16], (index) => Effect.fromOption(A.get(row.cases, index)));
    yield* Effect.forEach(cases, (observation) => assertObservation(setup, observation));
    const calls = full ? 17 : 5;
    const observed = yield* setup.observed.snapshot;
    expect(observed).toEqual({ spawned: calls, confirmed: calls });
    const admission = yield* setup.admission.snapshot;
    expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
  }
});
/** The worker's additional context copy is included before child admission. */
export const assertCitationContextBudget = Effect.fn("ContextMatcherTest.budget")(function* () {
  const corpus = yield* load();
  const row = yield* Effect.fromOption(A.head(corpus.patterns));
  const observation = yield* Effect.fromOption(A.get(row.cases, 1));
  const setup = yield* install(row, "bun", 8);
  const failure = yield* setup.matcher.search(observation.request).pipe(Effect.flip);
  expect(failure).toMatchObject({
    limit: "producedTextUtf16",
  });
  const observed = yield* setup.observed.snapshot;
  expect(observed).toEqual({ spawned: 0, confirmed: 0 });
  const fresh = yield* setup.matcher.search({ ...observation.request, words: [] });
  expect(fresh).toEqual({ context: { width: 1, bytes: new Uint8Array() }, match: null });
  const patternBytes = new Uint8Array(row.pattern.bytes);
  const exact = yield* install({ ...row, pattern: { ...row.pattern, bytes: patternBytes } }, "bun", 9);
  patternBytes.fill(0);
  const actual = yield* exact.matcher.search(observation.request);
  expect(actual).toEqual(observation.result);
  actual.context.bytes.fill(0);
  const repeated = yield* exact.matcher.search(observation.request);
  expect(repeated).toEqual(observation.result);
  const admission = yield* exact.admission.snapshot;
  expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
});
