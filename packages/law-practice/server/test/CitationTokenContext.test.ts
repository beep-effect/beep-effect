import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationTokenContextInput,
  makeCitationTokenContext,
} from "@beep/law-practice-server/internal/Citation/TokenContext";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenContext");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Word = S.Struct({ kind: CitationTokenContextInput.fields.words.value.fields.kind, data: S.NullOr(Native) });
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-token-context/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    producerSha256: S.tag("28ee79ce711fc16a906f5df7e12ea0515518e0051f6b772bcaf51b8c3f0093ea"),
    python: S.tag("3.11.15"),
    regex: S.tag("2023.12.25"),
    maxMatchChars: S.Literal(300),
    vectors: Word.pipe(S.Array, S.Array),
    prefixes: S.Array(Native),
    cases: S.Array(
      S.Struct({
        vector: S.Natural,
        prefix: S.Natural,
        start: S.Int,
        forward: S.Boolean,
        stringsOnly: S.Boolean,
        search: S.NullOr(S.Struct({ text: Native, pattern: S.String, flags: S.Int })),
        failure: S.NullOr(S.Literals(["IndexError", "TypeError"])),
      })
    ).check(S.isBetweenLength(2976, 2976)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Independent original context construction observations before regex execution.",
  })
);
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(Layer.merge(BunFileSystem.layer, BunCrypto.layerDigest), { excludeTestServices: true })(
  "native token context",
  (it) => {
    it.effect(
      "matches every source context, stopping rule, index error and native Unicode boundary",
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const digest = yield* Digest.Digest;
          const bytes = yield* fs.readFile(
            NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/token-context.json", import.meta.url))
          );
          const hash = yield* digest.digestHex(Digest.sha256, bytes);
          expect(hash).toBe("252231fd5180ba20cfce5ccece24cac7572edcde834e1187467f64671d0181ca");
          const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const context = yield* makeCitationTokenContext(limits);
          const outcomes = yield* Effect.forEach(
            corpus.cases,
            Effect.fn("ContextTest.checkSourceRow")(function* (row) {
              const words = yield* Effect.fromOption(A.get(corpus.vectors, row.vector));
              const prefix = yield* Effect.fromOption(A.get(corpus.prefixes, row.prefix));
              const request = {
                words,
                prefix,
                startIndex: row.start,
                forward: row.forward,
                stringsOnly: row.stringsOnly,
              };
              if (row.search === null) {
                const error = yield* context.plan(request).pipe(Effect.flip);
                expect(error).toMatchObject({ reason: "index-out-of-range" });
                return false;
              }
              const actual = yield* context.plan(request);
              expect(actual.source).toEqual(row.search.text);
              expect(actual.anchor).toBe(row.forward ? "start" : "end");
              expect(row.search.pattern).toBe(row.forward ? "^(?:CONTROL)" : "(?:CONTROL)$");
              expect(row.search.flags).toBe(64);
              return true;
            })
          );
          const successes = A.filter(outcomes, (value) => value).length;
          const failures = outcomes.length - successes;
          expect(successes).toBe(2364);
          expect(failures).toBe(612);
        }),
      { timeout: 60000 }
    );
    it.effect("owns output, rejects invalid words and enforces cumulative receiving allocations", () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const context = yield* makeCitationTokenContext(limits);
        const data = native("word");
        const request = {
          words: [{ kind: "Text", data }],
          prefix: native("P"),
          startIndex: 0,
          forward: true,
          stringsOnly: true,
        };
        const first = yield* context.plan(request);
        data.bytes.fill(0);
        expect(first.source).toEqual(native("Pword"));
        expect(first.contextUnits).toBe(5);
        expect(first.allocatedUnits).toBe(10);
        first.source.bytes.fill(0);
        const fresh = yield* context.plan({ ...request, words: [{ kind: "Text", data: native("word") }] });
        expect(fresh.source).toEqual(native("Pword"));
        const invalid = yield* context.plan({ ...request, words: [{ kind: "Text", data: null }] }).pipe(Effect.flip);
        expect(invalid).toMatchObject({ reason: "invalid-input" });
        const bounded = yield* makeCitationTokenContext({ ...limits, producedTextUtf16: 8 });
        const refused = yield* bounded
          .plan({ ...request, words: [{ kind: "Text", data: native("word") }] })
          .pipe(Effect.flip);
        expect(refused).toMatchObject({ limit: "producedTextUtf16" });
        const empty = yield* bounded.plan({ ...request, words: [], prefix: native("") });
        expect(empty.source).toEqual(native(""));
      })
    );
  }
);
it.effect("retains its captured deadline under a disabled caller Clock", () =>
  Effect.gen(function* () {
    const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
    const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
    const limits = (yield* defaultCitationEnginePolicy).limits;
    const context = yield* makeCitationTokenContext({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
      Effect.provideService(Clock.Clock, timer.clock)
    );
    const pending = yield* context
      .plan({ words: [], prefix: native(Str.repeat(65536)("x")), startIndex: 0, forward: true, stringsOnly: true })
      .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
    yield* timer.trigger;
    const error = yield* Fiber.join(pending).pipe(Effect.flip);
    expect(error).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
  })
);
