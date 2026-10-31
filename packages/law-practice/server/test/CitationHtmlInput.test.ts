import { fileURLToPath } from "node:url";
import { makeCitationHtmlInput } from "@beep/law-practice-server/_test/Citation/HtmlInput";
import {
  CitationHtmlWorkerJob,
  encodeCitationHtmlJob,
  preflightCitationHtmlJob,
} from "@beep/law-practice-server/_test/Citation/HtmlWorkerProtocol";
import { citationPythonTextData } from "@beep/law-practice-server/_test/Citation/PythonTextData";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationHtmlInput, CitationHtmlInputFailure } from "@beep/law-practice-server/_test/Citation/HtmlInput";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("bounded citation HTML input", (it) => {
  it.effect("matches every source encoding byte and wrapper decision", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-input.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "66dc28d39e9c82120857af03227dfea59396fb3b7a65202248d52f53fa5a2a8a"
      );
      const corpus = yield* S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            testedCodePoints: S.Natural,
            whitespaceCodePoints: S.Array(S.Natural),
            artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
            cases: S.Array(
              S.Struct({
                name: S.String,
                text: S.String,
                outcome: S.Union([
                  S.Struct({
                    kind: S.tag("prepared"),
                    encoding: S.String,
                    byteLength: S.Natural,
                    bytesSha256: S.String,
                    fullHtml: S.Boolean,
                  }),
                  S.Struct({ kind: S.tag("rejected"), reason: S.tag("unicode-encoding-declaration") }),
                ]).pipe(S.toTaggedUnion("kind")),
              })
            ),
          })
        )
      )(raw);
      expect(corpus.cases).toHaveLength(1075);
      expect(corpus.artifacts).toHaveLength(1071);
      expect(corpus.testedCodePoints).toBe(0x110000);
      expect(corpus.whitespaceCodePoints).toEqual(
        A.map(A.fromIterable(citationPythonTextData.whitespace), (char) =>
          O.getOrElse(Str.codePointAt(char, 0), () => -1)
        )
      );
      const texts = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value] as const));
      const preparation = yield* makeCitationHtmlInput((yield* defaultCitationEnginePolicy).limits);
      for (const row of corpus.cases) {
        const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
        const operation = preparation.prepare(text) satisfies Effect.Effect<
          CitationHtmlInput,
          CitationHtmlInputFailure | CitationSafetyLimitExceeded
        >;
        if (row.outcome.kind === "rejected") {
          const failure = yield* Effect.flip(operation);
          expect(failure._tag, row.name).toBe("CitationHtmlInputFailure");
          if (failure._tag === "CitationHtmlInputFailure") expect(failure.reason, row.name).toBe(row.outcome.reason);
        } else {
          const prepared = yield* operation;
          expect(prepared.encoding, row.name).toBe(row.outcome.encoding);
          expect(prepared.fullHtml, row.name).toBe(row.outcome.fullHtml);
          expect(prepared.bytes.byteLength, row.name).toBe(row.outcome.byteLength);
          expect(yield* S.decodeEffect(Sha256HexFromBytes)(prepared.bytes), row.name).toBe(row.outcome.bytesSha256);
        }
      }
    })
  );
  it.effect("checks source and byte ceilings and returns independently owned buffers", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const preparation = yield* makeCitationHtmlInput({ ...limits, sourceUtf16: 8, processMessageBytes: 4 });
      const exact = yield* preparation.prepare("ĀĀ");
      expect(A.fromIterable(exact.bytes)).toEqual([0, 1, 0, 1]);
      const byteFailure = yield* Effect.flip(preparation.prepare("ĀĀĀ"));
      expect(byteFailure._tag).toBe("CitationSafetyLimitExceeded");
      if (byteFailure._tag === "CitationSafetyLimitExceeded") expect(byteFailure.limit).toBe("processMessageBytes");
      const sourceFailure = yield* Effect.flip(preparation.prepare("123456789"));
      expect(sourceFailure._tag).toBe("CitationSafetyLimitExceeded");
      if (sourceFailure._tag === "CitationSafetyLimitExceeded") expect(sourceFailure.limit).toBe("sourceUtf16");
      const another = yield* preparation.prepare("ĀĀ");
      exact.bytes[0] = 255;
      expect(A.fromIterable(another.bytes)).toEqual([0, 1, 0, 1]);
      expect((yield* Effect.flip(preparation.prepare({ text: "private source" })))._tag).toBe(
        "CitationHtmlInputFailure"
      );
    })
  );
  it.effect("uses its captured clock and interrupts scans without returning partial bytes", () =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      const limits = (yield* defaultCitationEnginePolicy).limits;
      let timers = 0;
      const due: Clock.Clock = {
        ...clock,
        sleep: () =>
          Effect.sync(() => {
            timers++;
          }),
      };
      const prep = yield* makeCitationHtmlInput(limits).pipe(Effect.provideService(Clock.Clock, due));
      const failed = yield* Effect.flip(
        prep
          .prepare(Str.repeat(100_000)("a"))
          .pipe(Effect.provideService(Clock.Clock, { ...clock, sleep: () => Effect.never }))
      );
      expect(timers).toBe(1);
      expect(failed._tag).toBe("CitationSafetyLimitExceeded");
      if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("cleanDeadline");
      const interruptible = yield* makeCitationHtmlInput(limits).pipe(
        Effect.provideService(Clock.Clock, { ...clock, sleep: () => Effect.never })
      );
      const fiber = yield* Effect.forkChild(interruptible.prepare(`<?xml a encoding="${Str.repeat(100_000)("a")}`));
      yield* Effect.yieldNow;
      yield* Fiber.interrupt(fiber);
      expect(Exit.hasInterrupts(yield* Fiber.await(fiber))).toBe(true);
    })
  );
});

it.effect(
  "preflights exact intermediate layout and complete framing before materializing the payload",
  () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const preparation = yield* makeCitationHtmlInput({
        ...limits,
        sourceUtf16: 1,
        processMessageBytes: 32_000_000,
        cleanDeadline: Duration.seconds(30),
      });
      let checked = false;
      const prepared = yield* preparation.prepareStage("AB😀", (layout) =>
        Effect.sync(() => {
          checked = true;
          expect(layout).toEqual({ encoding: "UTF-32LE", fullHtml: false, byteLength: 12 });
        })
      );
      expect(checked).toBe(true);
      expect(prepared.bytes.byteLength).toBe(12);
      expect(yield* Effect.flip(preparation.prepare("AB"))).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        limit: "sourceUtf16",
      });
      const frame = yield* encodeCitationHtmlJob(
        CitationHtmlWorkerJob.make({ ...prepared, outputUtf16: 0 }),
        limits.processMessageBytes
      );
      const exact = yield* preparation.prepareStage("AB😀", (layout) =>
        preflightCitationHtmlJob(layout, 0, frame.byteLength).pipe(Effect.asVoid)
      );
      expect(exact.bytes).toEqual(prepared.bytes);
      expect(
        yield* Effect.flip(
          preparation.prepareStage("AB😀", (layout) =>
            preflightCitationHtmlJob(layout, 0, frame.byteLength - 1).pipe(Effect.asVoid)
          )
        )
      ).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
      // Every ASCII point uses four native bytes when one supplementary point is present.
      // Layout is 31,999,996 bytes; base64 plus framing exceeds the frozen 32 MB channel.
      let oversizedLayout = false;
      expect(
        yield* Effect.flip(
          preparation.prepareStage(`${Str.repeat(7_999_998)("A")}😀`, (layout) => {
            oversizedLayout = true;
            expect(layout.byteLength).toBe(31_999_996);
            return preflightCitationHtmlJob(layout, 0, 32_000_000).pipe(Effect.asVoid);
          })
        )
      ).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "processMessageBytes" });
      expect(oversizedLayout).toBe(true);
    }),
  { timeout: 60_000 }
);
