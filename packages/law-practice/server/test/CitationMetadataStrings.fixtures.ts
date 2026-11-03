import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationMetadataStrings } from "@beep/law-practice-server/internal/Citation/MetadataStrings";
import { CitationRegexPatternDescriptor } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { LiteralKit, Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { setupCitationRegexRuntime } from "./CitationRegexWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationMetadataStrings");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Row = S.Struct({
  id: S.Natural,
  smoke: S.Boolean,
  source: S.NullOr(Native),
  pin: S.NullOr(Native),
  parenthetical: S.NullOr(Native),
  yearSearch: S.Boolean,
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-metadata-strings/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("078d4f0a68603358e7a1e33baa3c24a4508520935df90a5ed65f8dddf82723d5"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    bindingCorpusSha256: S.tag("4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d"),
    yearPattern: Native,
    bindings: S.Array(CitationRegexPatternDescriptor).check(S.isBetweenLength(2, 2)),
    cases: S.Array(Row).check(S.isBetweenLength(997, 997)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description:
      "Original string helper executions, delegated year matching and retained source-bound YEAR_REGEX descriptors.",
  })
);
/** Load and authenticate the original metadata string corpus. */
export const loadCitationMetadataStrings = Effect.fn("MetadataStringsTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/metadata-strings.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("56475991c824e6202938aa0ebde016f2e9682be9f5a0d37f3d9bb5b8eee138a1");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
const install = Effect.fn("MetadataStringsTest.install")(function* (
  corpus: typeof Corpus.Type,
  kind: CitationNativeRuntimeKind,
  budget?: number,
  controlledDeadline = false
) {
  const setup = yield* setupCitationRegexRuntime(kind, budget);
  const limits =
    controlledDeadline === true ? { ...setup.limits, extractDeadline: Duration.millis(997) } : setup.limits;
  const helpers = yield* makeCitationMetadataStrings(limits, setup.runtime, corpus.yearPattern, corpus.bindings).pipe(
    Effect.provideContext(setup.context)
  );
  return { ...setup, helpers };
});
/** Original string helper results compared through the existing native worker. */
export const replayCitationMetadataStrings = Effect.fn("MetadataStringsTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* loadCitationMetadataStrings();
  const setup = yield* install(corpus, kind);
  for (const row of corpus.cases) {
    const pin = yield* setup.helpers.cleanPinCite(row.source);
    expect(pin).toEqual(row.pin);
  }
  const selected = full ? corpus.cases : A.filter(corpus.cases, (row) => row.smoke);
  for (const row of selected) {
    const actual = yield* setup.helpers.parenthetical(row.source);
    expect(actual, `source row ${row.id}`).toEqual(row.parenthetical);
  }
  expect(A.filter(selected, (row) => row.yearSearch)).toHaveLength(full ? 989 : 25);
  const observed = yield* setup.observed.snapshot;
  const calls = full ? 989 : 25;
  expect(observed).toEqual({ spawned: calls, confirmed: calls });
  const admission = yield* setup.admission.snapshot;
  expect(admission).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
/** Additional retained copy refusal precedes matching; early source return is distinct. */
export const assertCitationMetadataStringBudget = Effect.fn("MetadataStringsTest.budget")(function* () {
  const corpus = yield* loadCitationMetadataStrings();
  const refused = yield* install(corpus, "bun", 11);
  const failure = yield* refused.helpers.parenthetical(native("abc")).pipe(Effect.flip);
  expect(failure).toMatchObject({ limit: "producedTextUtf16" });
  const before = yield* refused.observed.snapshot;
  expect(before).toEqual({ spawned: 0, confirmed: 0 });
  const early = yield* refused.helpers.parenthetical(native("2020)"));
  expect(early).toEqual(native("2020"));
  const pin = yield* refused.helpers.cleanPinCite(native(" ,a, "));
  expect(pin).toEqual(native("a"));
  const invalid = yield* refused.helpers.cleanPinCite({ width: 2, bytes: new Uint8Array([1]) }).pipe(Effect.flip);
  expect(invalid).toMatchObject({ reason: "invalid-input" });
  const exact = yield* install(corpus, "bun", 12);
  const actual = yield* exact.helpers.parenthetical(native("abc"));
  expect(actual).toEqual(native("abc"));
  if (actual !== null) actual.bytes.fill(0);
  const fresh = yield* exact.helpers.parenthetical(native("abc"));
  expect(fresh).toEqual(native("abc"));
  const empty = yield* refused.helpers.cleanPinCite(native(" , "));
  expect(empty).toEqual(native(""));
  const after = yield* exact.observed.snapshot;
  expect(after).toEqual({ spawned: 2, confirmed: 2 });
});

/** Both helper operations retain installation timing independently of caller services. */
export const assertCitationMetadataStringsDeadline = Effect.fn("MetadataStringsTest.deadline")(function* () {
  const corpus = yield* loadCitationMetadataStrings();
  const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
  for (const method of LiteralKit(["cleanPinCite", "parenthetical"]).literals) {
    const setup = yield* install(corpus, "bun", undefined, true);
    const pending = yield* setup.helpers[method](native(Str.repeat(65536)("x"))).pipe(
      Effect.provideService(Clock.Clock, disabled),
      Effect.forkChild
    );
    yield* setup.timer.trigger;
    const failure = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
    const observed = yield* setup.observed.snapshot;
    expect(observed).toEqual({ spawned: 0, confirmed: 0 });
  }
});
