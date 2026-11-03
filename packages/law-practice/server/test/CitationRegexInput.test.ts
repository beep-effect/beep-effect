import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import {
  CitationRegexInputLayout,
  CitationRegexProjection,
  makeCitationRegexInput,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import type {
  CitationPreparedRegexInput,
  CitationRegexInputFailure,
} from "@beep/law-practice-server/internal/Citation/RegexInput";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const $I = $LawPracticeServerId.create("test/CitationRegexInput");
const Storage = S.Struct({ width: S.Literals([1, 2, 4]), nativeHex: S.String }).pipe(
  $I.annoteSchema("Storage", {
    description: "Observed original native bytes and compact width, independent of display projection.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    pythonVersion: S.tag("3.11.15"),
    projectionCases: S.Natural,
    cases: S.Array(
      S.Struct({
        storage: Storage,
        pythonLength: S.Natural,
        utf16Units: S.Natural,
        prefix: S.Array(S.Natural),
        boundaries: S.Array(S.Boolean),
        projectionAmbiguous: S.Boolean,
        text: S.String,
        rawStorage: Storage,
        rawPythonLength: S.Natural,
      })
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Authenticated physical Unicode and projection observations across all short source products.",
  })
);
const preflight = () => Effect.void;
const load = Effect.fn("RegexInputTest.load")(function* () {
  const raw = yield* (yield* FileSystem.FileSystem).readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/regex-input.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "dab2793dc0edefee741b317a2558da9c01d58021a53bcb29b4e18b87d34bf51d"
  );
  return yield* S.decodeEffect(Corpus)(raw);
});

it.effect("rejects incoherent layout and projection data through their own codecs", () =>
  Effect.gen(function* () {
    const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
    const { layout } = yield* input.prepareText("x", preflight);
    for (const forged of [
      { ...layout, mapBytes: layout.mapBytes + 4 },
      { ...layout, width: 4, byteLength: 4 },
      { ...layout, projectionAmbiguous: true },
    ])
      expect(S.is(CitationRegexInputLayout)(forged)).toBe(false);
    expect(S.is(CitationRegexProjection)({ _tag: "Range", startChar: 1, endChar: 1 })).toBe(false);
    expect(S.is(CitationRegexProjection)({ _tag: "Split", startChar: 2, endChar: 1 })).toBe(false);
    expect(S.is(CitationRegexProjection)({ _tag: "Point", offset: 0 })).toBe(true);
  })
);

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer))("native regex input source layouts", (it) => {
  it.effect("preserves all 259 source products, 2395 source projections and canonical raw string interpretations", () =>
    Effect.gen(function* () {
      const corpus = yield* load();
      const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
      let projections = 0;
      let ambiguous = 0;
      for (const row of corpus.cases) {
        const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.storage.nativeHex);
        const prepared = yield* input.prepareUnicode({ width: row.storage.width, bytes }, preflight);
        expect(prepared.layout).toEqual({
          width: row.storage.width,
          byteLength: bytes.length,
          pythonLength: row.pythonLength,
          utf16Units: row.utf16Units,
          mapBytes: 4 * (row.pythonLength + 1),
          projectionAmbiguous: row.projectionAmbiguous,
        });
        expect(prepared.value.text).toBe(row.text);
        expect(prepared.value.storage.bytes).toEqual(bytes);
        expect(prepared.value.storage.bytes).not.toBe(bytes);
        if (row.projectionAmbiguous) ambiguous++;
        for (let start = 0; start <= row.pythonLength; start++)
          for (let end = start; end <= row.pythonLength; end++) {
            const startChar = A.getUnsafe(row.prefix, start);
            const endChar = A.getUnsafe(row.prefix, end);
            const projected = yield* prepared.project({ start, end });
            expect(projected).toEqual(
              !A.getUnsafe(row.boundaries, start) || !A.getUnsafe(row.boundaries, end)
                ? { _tag: "Split", startChar, endChar }
                : start === end
                  ? { _tag: "Point", offset: startChar }
                  : { _tag: "Range", startChar, endChar }
            );
            projections++;
          }
        const raw = yield* input.prepareText(row.text, preflight);
        expect(raw.value.storage.width).toBe(row.rawStorage.width);
        expect(raw.value.storage.bytes).toEqual(yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.rawStorage.nativeHex));
        expect(raw.value.pythonLength).toBe(row.rawPythonLength);
        expect(raw.layout.projectionAmbiguous).toBe(false);
      }
      expect(corpus.cases).toHaveLength(259);
      expect(projections).toBe(2395);
      expect(projections).toBe(corpus.projectionCases);
      expect(ambiguous).toBe(13);
    })
  );
});

it.effect("retains empty and split projections without manufacturing a verified range", () =>
  Effect.gen(function* () {
    const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
    const pair = yield* input.prepareUnicode({ width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) }, preflight);
    expect(yield* pair.project({ start: 0, end: 1 })).toEqual({ _tag: "Split", startChar: 0, endChar: 1 });
    expect(yield* pair.project({ start: 1, end: 1 })).toEqual({ _tag: "Split", startChar: 1, endChar: 1 });
    expect(yield* pair.project({ start: 2, end: 2 })).toEqual({ _tag: "Point", offset: 2 });
    const rejected = yield* convertTextOffsetRange(
      TextOffsetRange.make({ start: S.Natural.make(0), end: S.Natural.make(1), unit: "utf16-code-unit" }),
      pair.value.text
    ).pipe(Effect.flip);
    expect(rejected.reason).toBe("invalid-offset");
    const ordinary = yield* input.prepareText("A😀B", preflight);
    expect(yield* ordinary.project({ start: 1, end: 2 })).toEqual({ _tag: "Range", startChar: 1, endChar: 3 });
    const canonical = yield* convertTextOffsetRange(
      TextOffsetRange.make({ start: S.Natural.make(1), end: S.Natural.make(2), unit: "unicode-code-point" }),
      ordinary.value.text
    );
    expect(yield* ordinary.project({ start: 1, end: 2 })).toEqual({
      _tag: "Range",
      startChar: canonical.startChar,
      endChar: canonical.endChar,
    });
  })
);

it.effect("rejects malformed native layouts and invalid point ranges with closed failures", () =>
  Effect.gen(function* () {
    const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
    for (const storage of [
      { width: 2, bytes: new Uint8Array([65, 0]) },
      { width: 2, bytes: new Uint8Array([1]) },
      { width: 4, bytes: new Uint8Array([0, 0, 17, 0]) },
      { width: 4, bytes: new Uint8Array() },
    ]) {
      let called = false;
      expect(
        yield* input
          .prepareUnicode(storage, () =>
            Effect.sync(() => {
              called = true;
            })
          )
          .pipe(Effect.flip)
      ).toMatchObject({ reason: "invalid-input" });
      expect(called).toBe(false);
    }
    const prepared = yield* input.prepareText("x", preflight);
    for (const range of [
      { start: 2, end: 2 },
      { start: 1, end: 0 },
      { start: -1, end: 0 },
      { start: 0, end: 1.5 },
    ]) {
      expect(yield* prepared.project(range).pipe(Effect.flip)).toMatchObject({ reason: "invalid-range" });
    }
  })
);

it.effect("checks source, intermediate and byte ceilings before trusted transport preflight", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    for (const [policy, value, limit] of [
      [{ ...base, sourceUtf16: 1 }, "xx", "sourceUtf16"],
      [{ ...base, producedTextUtf16: 1 }, "xx", "producedTextUtf16"],
      [{ ...base, processMessageBytes: 1 }, "Ā", "processMessageBytes"],
    ] as const) {
      const input = yield* makeCitationRegexInput(policy);
      let called = false;
      expect(
        yield* input
          .prepareText(value, () =>
            Effect.sync(() => {
              called = true;
            })
          )
          .pipe(Effect.flip)
      ).toMatchObject({ operation: "extract", limit });
      expect(called).toBe(false);
    }
    const exact = yield* makeCitationRegexInput({
      ...base,
      sourceUtf16: 2,
      producedTextUtf16: 2,
      processMessageBytes: 4,
    });
    expect((yield* exact.prepareText("𝟎", preflight)).layout.byteLength).toBe(4);
  })
);

it.effect("preflights before receiving allocation, propagates rejection and owns the completed snapshot", () =>
  Effect.gen(function* () {
    const input = yield* makeCitationRegexInput((yield* defaultCitationEnginePolicy).limits);
    const rejected = yield* input.prepareText("x", () => Effect.fail("transport-rejected")).pipe(Effect.flip);
    expect(rejected).toBe("transport-rejected");
    const source = new Uint8Array([65]);
    const prepared = yield* input.prepareUnicode({ width: 1, bytes: source }, preflight);
    source[0] = 66;
    expect(prepared.value.text).toBe("A");
    expect(prepared.value.storage.bytes).toEqual(new Uint8Array([65]));
    const run: Effect.Effect<CitationPreparedRegexInput, CitationRegexInputFailure | CitationSafetyLimitExceeded> =
      input.prepareText("x", preflight);
    expect((yield* run).value.text).toBe("x");
  })
);

it.effect("captures extract timing independently of clean timing and caller Clock changes", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const input = yield* makeCitationRegexInput({
      ...base,
      cleanDeadline: Duration.millis(1),
      extractDeadline: Duration.millis(20),
    });
    const clock = yield* Clock.Clock;
    const changed: Clock.Clock = { ...clock, sleep: () => Effect.never };
    const timed = yield* input
      .prepareText("x", () => Effect.never)
      .pipe(Effect.provideService(Clock.Clock, changed), Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(20));
    expect(yield* Fiber.join(timed).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "extractDeadline",
    });
  })
);

it.effect("captures policy and gives a shorter total deadline precedence during preflight", () =>
  Effect.gen(function* () {
    const base = (yield* defaultCitationEnginePolicy).limits;
    const policy = {
      ...base,
      sourceUtf16: 1,
      operationDeadline: Duration.millis(5),
      extractDeadline: Duration.millis(20),
    };
    const input = yield* makeCitationRegexInput(policy);
    policy.sourceUtf16 = 2;
    policy.operationDeadline = Duration.seconds(1);
    expect(yield* input.prepareText("xx", preflight).pipe(Effect.flip)).toMatchObject({ limit: "sourceUtf16" });
    const timed = yield* input.prepareText("x", () => Effect.never).pipe(Effect.forkChild);
    yield* TestClock.adjust(Duration.millis(5));
    expect(yield* Fiber.join(timed).pipe(Effect.flip)).toMatchObject({
      operation: "extract",
      limit: "operationDeadline",
    });
  })
);
