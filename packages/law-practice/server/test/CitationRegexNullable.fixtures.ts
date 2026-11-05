import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationRegexPatternProfile } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationRegexMatchMode } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { LiteralKit } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { setupCitationRegexWorker } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationRegexNullable");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Matches = S.Tuple([S.Int, S.Int]).pipe(S.Array, S.Array);
const SingleMode = LiteralKit(["search", "match"]);
const Modes = S.Record(CitationRegexMatchMode, Matches);
const Pattern = S.Struct({
  pattern: Native,
  patternSha256: S.String,
  flags: S.tag(0),
  profile: CitationRegexPatternProfile,
  cases: S.Array(S.Struct({ source: Native, engines: S.Struct({ re: Modes, regex: Modes }) })).check(
    S.isBetweenLength(7, 7)
  ),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-nullable/v1"),
    python: S.tag("3.11.15"),
    unicode: S.tag("14.0.0"),
    regex: S.tag("2023.12.25"),
    producerSha256: S.tag("799a16c68a8a8ce254b9cc100a2f404788ae8b3329eed14945bb5688edd5f952"),
    patterns: S.Array(Pattern).check(S.isBetweenLength(8, 8)),
  })
).pipe($I.annoteSchema("Corpus", { description: "Independent nullable controls from both pinned Python engines." }));
const load = Effect.fn("NullableTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-nullable.json", import.meta.url))
  );
  const hash = yield* digest.digestHex(Digest.sha256, bytes);
  expect(hash).toBe("ffffdf0f2964c5f0d7c250d19aa00ab9dc71a1e2669fd05afb089479018e27b1");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
type Setup = Effect.Success<ReturnType<typeof setupCitationRegexWorker>>;
const checkCase = Effect.fn("NullableTest.checkCase")(function* (
  setup: Setup,
  pattern: typeof Pattern.Type,
  row: (typeof Pattern.Type.cases)[number]
) {
  expect(row.engines.re).toEqual(row.engines.regex);
  for (const mode of SingleMode.literals) {
    const expected = row.engines.re[mode];
    const completed = yield* setup.worker.evaluate(pattern.pattern, row.source, pattern.flags, expected.length, mode);
    expect(completed.result.matches).toBe(expected.length);
    yield* Effect.forEach(expected, (captures, match) =>
      Effect.forEach(
        captures,
        Effect.fn("NullableTest.checkCapture")(function* ([start, end], group) {
          const actual = yield* completed.result.capture(match, group);
          expect(actual).toEqual(start < 0 ? { _tag: "Unmatched" } : { _tag: "Range", start, end });
        })
      )
    );
  }
});
/** Replay complete controls on hosted CI, or a small actual-child smoke locally. */
export const replayCitationRegexNullable = Effect.fn("NullableTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* load();
  const patterns = full
    ? corpus.patterns
    : A.filter(corpus.patterns, (_, index) => index === 1 || index === 4 || index === 7);
  const setup = yield* setupCitationRegexWorker(
    A.map(patterns, ({ patternSha256, flags, profile }) => ({ patternSha256, flags, profile })),
    kind
  );
  for (const pattern of patterns) {
    const rows = full ? pattern.cases : A.filter(pattern.cases, (_, index) => index === 0 || index === 3);
    for (const row of rows) yield* checkCase(setup, pattern, row);
  }
  const control = yield* Effect.fromOption(A.head(patterns));
  const source = yield* Effect.fromOption(A.head(control.cases));
  const rejected = yield* setup.worker.evaluate(control.pattern, source.source, 0, 1, "finditer").pipe(Effect.flip);
  expect(rejected).toMatchObject({ reason: "unsupported-profile" });
  const zero = yield* setup.worker.evaluate(control.pattern, source.source, 0, 0, "search").pipe(Effect.flip);
  expect(zero).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternMatches" });
  const fresh = yield* setup.worker.evaluate(control.pattern, source.source, 0, 1, "match");
  expect(fresh.result.matches).toBe(1);
  const expected = full ? 115 : 15;
  const observed = yield* setup.observed.snapshot;
  expect(observed).toEqual({ spawned: expected, confirmed: expected });
  const admission = yield* setup.admission.snapshot;
  expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
});
