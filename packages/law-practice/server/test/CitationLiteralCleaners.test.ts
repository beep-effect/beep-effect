import * as NodeURL from "node:url";
import { CitationCleanerWorkSnapshot } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationLiteralCleaner,
  makeCitationLiteralCleaners,
} from "@beep/law-practice-server/internal/Citation/LiteralCleaners";
import { citationPythonTextData } from "@beep/law-practice-server/internal/Citation/PythonTextData";
import { encodeCitationRuntimeString } from "@beep/law-practice-server/internal/Citation/RuntimeHashEncoding";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationCleanerWork } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import type { CitationLiteralCleanerFailure } from "@beep/law-practice-server/internal/Citation/LiteralCleaners";

const Corpus = S.fromJsonString(
  S.Struct({
    testedCodePoints: S.Natural,
    classifiers: S.Struct({
      inline_whitespace: S.Array(S.Natural),
      all_whitespace: S.Array(S.Natural),
      underscores: S.Array(S.Natural),
      xml: S.Array(S.Natural),
    }),
    artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
    cases: S.Array(S.Struct({ name: S.String, cleaner: CitationLiteralCleaner, text: S.String, expected: S.String })),
  })
);
const load = Effect.fn("LiteralCleanerTest.load")(function* () {
  const citationResult1 = yield* FileSystem.FileSystem;
  const raw = yield* citationResult1.readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/literal-cleaners.json", import.meta.url))
  );
  const citationResult2 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  expect(citationResult2).toBe("242701dc5547bc00fa441117925f934e45c4505f1515e4c51ab0e8380dd199e8");
  return yield* S.decodeEffect(Corpus)(raw);
});
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("literal citation cleaners", (it) => {
  it.effect(
    "matches all 440 source vectors and exhaustive Unicode classifier facts",
    () =>
      Effect.gen(function* () {
        const corpus = yield* load();
        expect(corpus.testedCodePoints).toBe(1114112);
        expect(corpus.classifiers.inline_whitespace).toEqual([9, 32]);
        const points = A.map(A.fromIterable(citationPythonTextData.whitespace), (char) =>
          O.getOrElse(Str.codePointAt(char, 0), () => -1)
        );
        expect(corpus.classifiers.all_whitespace).toEqual(A.sort([...points, 8203], Num.Order));
        expect(corpus.classifiers.underscores).toEqual([]);
        expect(corpus.classifiers.xml).toEqual([]);
        expect(corpus.artifacts).toHaveLength(135);
        yield* Effect.forEach(
          corpus.artifacts,
          Effect.fnUntraced(function* (artifact) {
            const citationResult3 = yield* encodeCitationRuntimeString(artifact.value);
            const citationResult4 = yield* S.decodeEffect(Sha256HexFromBytes)(
              new TextEncoder().encode(citationResult3)
            );
            expect(citationResult4).toBe(artifact.sha256);
          }),
          { concurrency: 1, discard: true }
        );
        const texts = HashMap.fromIterable(
          A.map(corpus.artifacts, (artifact) => [artifact.sha256, artifact.value] as const)
        );
        expect(corpus.cases).toHaveLength(440);
        const citationResult5 = yield* defaultCitationEnginePolicy;
        const cleaners = yield* makeCitationLiteralCleaners(citationResult5.limits);
        yield* Effect.forEach(
          corpus.cases,
          Effect.fnUntraced(function* (row) {
            const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
            const expected = yield* Effect.fromOption(HashMap.get(texts, row.expected));
            const evaluated = cleaners.apply({ cleaner: row.cleaner, text }) satisfies Effect.Effect<
              string,
              CitationLiteralCleanerFailure
            >;
            const citationResult6 = yield* evaluated;
            expect(citationResult6, row.name).toBe(expected);
          }),
          { concurrency: 1, discard: true }
        );
      }),
    { timeout: 30_000 }
  );

  it.effect(
    "matches every committed non-HTML literal cleaner observation",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const citationResult7 = yield* defaultCitationEnginePolicy;
        const cleaners = yield* makeCitationLiteralCleaners(citationResult7.limits);
        const Rows = S.Struct({ operation: S.String, payload: S.String });
        const operationsText = yield* fs.readFileString(
          NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url))
        );
        const citationResult8 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(operationsText));
        expect(citationResult8).toBe("ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1");
        const operationRows = (yield* S.decodeEffect(S.fromJsonString(S.Struct({ cases: S.Array(Rows) })))(
          operationsText
        )).cases;
        const supplementalText = yield* fs.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/supplemental-extraction.json", import.meta.url)
          )
        );
        const citationResult9 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(supplementalText));
        expect(citationResult9).toBe("4f462b83f10b124db4768743b0131b30954a085a0c93197be7232e0de0f0abc9");
        const supplemental = yield* S.decodeEffect(S.fromJsonString(S.Struct({ textCases: S.Array(Rows) })))(
          supplementalText
        );
        let checked = 0;
        const Payload = S.fromJsonString(
          S.Struct({
            input: S.Struct({ text: S.String, steps: S.Array(S.Json) }),
            outcome: S.Union([
              S.Struct({ kind: S.tag("success"), value: S.String }),
              S.Struct({ kind: S.tag("failure") }),
            ]).pipe(S.toTaggedUnion("kind")),
          })
        );
        for (const row of [...operationRows, ...supplemental.textCases]) {
          if (row.operation !== "clean_text") continue;
          const payload = yield* S.decodeEffect(Payload)(row.payload);
          if (!A.every(payload.input.steps, S.is(CitationLiteralCleaner))) continue;
          if (payload.outcome.kind !== "success") return yield* Effect.die("unexpected literal source failure");
          let text = payload.input.text;
          yield* Effect.forEach(
            payload.input.steps,
            Effect.fnUntraced(function* (cleaner) {
              text = yield* cleaners.apply({ cleaner, text });
            }),
            { concurrency: 1, discard: true }
          );
          expect(text).toBe(payload.outcome.value);
          checked++;
        }
        expect(checked).toBe(10);
      }),
    { timeout: 30_000 }
  );

  it.effect("captures ceilings and isolates output budgets across concurrent evaluations", () =>
    Effect.gen(function* () {
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 4, producedTextUtf16: 3 };
      const cleaners = yield* makeCitationLiteralCleaners(limits);
      Reflect.set(limits, "sourceUtf16", 1000);
      Reflect.set(limits, "producedTextUtf16", 1000);
      const citationResult10 = yield* cleaners.apply({ cleaner: "xml", text: "abc" });
      expect(citationResult10).toBe("abc");
      const citationResult11 = yield* Effect.flip(cleaners.apply({ cleaner: "xml", text: "abcd" }));
      expect(citationResult11.reason).toBe("limit-exceeded");
      const citationResult12 = yield* Effect.flip(cleaners.apply({ cleaner: "underscores", text: "_____" }));
      expect(citationResult12.reason).toBe("limit-exceeded");
      const citationResult13 = yield* Effect.all(
        [
          cleaners.apply({ cleaner: "underscores", text: "__ab" }),
          cleaners.apply({ cleaner: "underscores", text: "__ab" }),
        ],
        { concurrency: 2 }
      );
      expect(citationResult13).toEqual(["ab", "ab"]);
      const citationResult14 = yield* Effect.flip(cleaners.apply({ cleaner: "html", text: "a" }));
      expect(citationResult14.reason).toBe("invalid-input");
    })
  );

  it.effect("honors the captured deadline clock and permits interruption between scan blocks", () =>
    Effect.gen(function* () {
      const clock = yield* Clock.Clock;
      let timers = 0;
      const due: Clock.Clock = {
        ...clock,
        sleep: () =>
          Effect.sync(() => {
            timers++;
          }),
      };
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const cleaners = yield* makeCitationLiteralCleaners(limits).pipe(Effect.provideService(Clock.Clock, due));
      const text = Str.repeat(100_000)("a");
      const failed = yield* Effect.flip(
        cleaners
          .apply({ cleaner: "all_whitespace", text })
          .pipe(Effect.provideService(Clock.Clock, { ...clock, sleep: () => Effect.never }))
      );
      expect(failed.reason).toBe("deadline-exceeded");
      expect(timers).toBe(1);
      const interruptible = yield* makeCitationLiteralCleaners(limits).pipe(
        Effect.provideService(Clock.Clock, { ...clock, sleep: () => Effect.never })
      );
      const fiber = yield* Effect.forkChild(interruptible.apply({ cleaner: "underscores", text }));
      yield* Fiber.interrupt(fiber);
      const citationResult15 = yield* Fiber.await(fiber);
      expect(Exit.hasInterrupts(citationResult15)).toBe(true);
    })
  );
});

it.effect("rejects malformed policy with a closed failure before installing operations", () =>
  Effect.gen(function* () {
    for (const policy of [null, {}, { sourceUtf16: 0 }]) {
      const failure = yield* makeCitationLiteralCleaners(policy).pipe(Effect.flip);
      expect(failure).toMatchObject({ reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);

it.effect("rejects malformed literal requests before scanning or reserving text", () =>
  Effect.gen(function* () {
    const policy = yield* defaultCitationEnginePolicy;
    const cleaners = yield* makeCitationLiteralCleaners(policy.limits);
    for (const input of [null, {}, { cleaner: "xml", text: 17 }, { cleaner: "html", text: "private source" }]) {
      const failure = yield* Effect.flip(cleaners.apply(input));
      expect(failure).toMatchObject({ _tag: "CitationLiteralCleanerFailure", reason: "invalid-input" });
      expect("cause" in failure).toBe(false);
    }
  })
);

it.effect("translates stage and native preparation failures and preserves reservation failures", () =>
  Effect.gen(function* () {
    const clock = yield* Clock.Clock;
    const limits = { ...(yield* defaultCitationEnginePolicy).limits, producedTextUtf16: 3 };
    const reservationFailure = CitationSafetyLimitExceeded.make({ operation: "clean", limit: "producedTextUtf16" });
    const work: CitationCleanerWork = {
      nested: constant(Effect.die("unexpected nested cleaner")),
      reserveText: constant(Effect.fail(reservationFailure)),
      snapshot: Effect.succeed(CitationCleanerWorkSnapshot.make({ producedTextUtf16: 0, closed: false })),
      withTextCapacity: constant(Effect.die("unexpected capacity loan")),
    };
    const cleaners = yield* makeCitationLiteralCleaners(limits);
    const stageLimit = yield* Effect.flip(cleaners.stage({ cleaner: "xml", text: "abcd" }, work));
    expect(stageLimit).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "producedTextUtf16",
    });
    const failedReservation = yield* Effect.flip(cleaners.stage({ cleaner: "xml", text: "a" }, work));
    expect(failedReservation).toBe(reservationFailure);
    const invalidStage = yield* Effect.flip(cleaners.stage({ cleaner: "xml", text: null }, work));
    expect(invalidStage).toMatchObject({
      _tag: "CitationLiteralCleanerFailure",
      reason: "invalid-input",
    });
    for (const { cleaner, storage, limit } of [
      { cleaner: "html", storage: { width: 1, bytes: new Uint8Array([65]) }, limit: false },
      { cleaner: "xml", storage: { width: 2, bytes: new Uint8Array([65]) }, limit: false },
      { cleaner: "xml", storage: { width: 1, bytes: new Uint8Array([65, 66, 67, 68]) }, limit: true },
    ]) {
      const failure = yield* Effect.flip(cleaners.stageUnicode(cleaner, storage, work));
      expect(failure).toMatchObject(
        limit
          ? { _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" }
          : { _tag: "CitationLiteralCleanerFailure", reason: "invalid-input" }
      );
    }
    const timed = yield* makeCitationLiteralCleaners({ ...limits, producedTextUtf16: 200_000 }).pipe(
      Effect.provideService(Clock.Clock, { ...clock, sleep: constant(Effect.void) })
    );
    const deadlineStage = yield* Effect.flip(
      timed.stage({ cleaner: "underscores", text: Str.repeat(100_000)("_") }, work)
    );
    expect(deadlineStage).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "cleanDeadline",
    });
    const deadlineNative = yield* Effect.flip(
      timed.stageUnicode("xml", { width: 1, bytes: new Uint8Array(100_000) }, work)
    );
    expect(deadlineNative).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "cleanDeadline",
    });
  })
);
