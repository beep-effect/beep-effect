import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEditionRef } from "@beep/law-practice-domain/values";
import {
  CitationFrozenEditions,
  makeCitationFrozenEditions,
} from "@beep/law-practice-server/internal/Citation/FrozenEditions";
import {
  CitationResourceCorrectionInput,
  makeCitationResourceCorrection,
} from "@beep/law-practice-server/internal/Citation/ResourceCorrection";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { loadCitationFrozenEditionFixtures } from "./CitationFrozenEditions.fixtures.ts";
import { makeCitationNativeManualClock, makeCitationNativeSleepClock } from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationResourceCorrection");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Value = S.NullOr(Native);
const Request = S.Struct({
  ...CitationResourceCorrectionInput.fields,
  reporter: S.optionalKey(Value),
  page: S.optionalKey(Value),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-resource-correction/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    producerSha256: S.tag("417d1f26aa0e4886f6b50a4d8c4a548ac5f7e9a5bf8169cb307b8d30d05e16f6"),
    cases: S.Array(S.Struct({ request: Request, reporter: Value, missingReporter: S.Boolean, page: Value })).check(
      S.isBetweenLength(396, 396)
    ),
    canonical: S.Array(S.Tuple([CitationEditionRef, Native, Native])).check(S.isBetweenLength(2533, 2533)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original reporter/page source results, missing keys, native words and every canonical edition.",
  })
);
const load = Effect.fn("ResourceCorrectionTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/resource-correction.json", import.meta.url))
  );
  const hash = yield* S.decodeEffect(Sha256HexFromBytes)(bytes);
  expect(hash).toBe("e67abb0daae801a181d254994d79e2a16ee453ddb022348e0cb801e7a6778100");
  const corpus = yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
  const { bundle } = yield* loadCitationFrozenEditionFixtures();
  const owner = yield* makeCitationFrozenEditions(bundle);
  const limits = (yield* defaultCitationEnginePolicy).limits;
  return { corpus, owner, limits };
});
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("source reporter/page correction", (it) => {
  it.effect(
    "matches all 5858 source calls with exact native payloads",
    () =>
      Effect.gen(function* () {
        const { corpus, owner, limits } = yield* load();
        const correction = yield* makeCitationResourceCorrection(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        for (const row of corpus.cases) {
          if (row.missingReporter) {
            const failed = yield* correction.reporter(row.request).pipe(Effect.flip);
            expect(failed).toMatchObject({ reason: "missing-reporter" });
          } else {
            const reporter = yield* correction.reporter(row.request);
            expect(reporter).toEqual(row.reporter);
          }
          const page = yield* correction.page(row.request);
          expect(page).toEqual(row.page);
        }
        for (const [ref, reporter, page] of corpus.canonical) {
          const request = { reporter: native("X"), page: native("1[U][A]"), editionGuess: ref };
          const actualReporter = yield* correction.reporter(request);
          const actualPage = yield* correction.page(request);
          expect(actualReporter).toEqual(reporter);
          expect(actualPage).toEqual(page);
        }
      }),
    { timeout: 60000 }
  );
  it.effect("reserves before output, preserves owned bytes and retains enclosing authority", () =>
    Effect.gen(function* () {
      const { owner, limits } = yield* load();
      const request = { reporter: native("NY Slip Op"), page: native("[U]"), editionGuess: null };
      const bounded = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 15 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner)
      );
      const failure = yield* bounded.page(request).pipe(Effect.flip);
      expect(failure).toMatchObject({ limit: "producedTextUtf16" });
      const exact = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 16 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner)
      );
      const result = yield* exact.page(request);
      expect(result).toEqual(native("(U)"));
      expect(request.page).toEqual(native("[U]"));
      if (result !== null) result.bytes.fill(0);
      const repeated = yield* exact.page(request);
      expect(repeated).toEqual(native("(U)"));
      const budget = yield* makeCitationTextBudget({ ...limits, producedTextUtf16: 17 });
      yield* budget.reserve(2);
      const enclosing = yield* makeCitationResourceCorrection({ ...limits, producedTextUtf16: 17 }).pipe(
        Effect.provideService(CitationFrozenEditions, owner),
        Effect.provideService(CitationTextBudget, budget)
      );
      const caller = yield* makeCitationTextBudget(limits);
      const exhausted = yield* enclosing
        .page(request)
        .pipe(Effect.provideService(CitationTextBudget, caller), Effect.flip);
      expect(exhausted).toMatchObject({ limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(15);
      const uncharged = yield* caller.snapshot;
      expect(uncharged).toBe(0);
    })
  );
  it.effect(
    "uses captured owner and deadlines under caller replacement",
    () =>
      Effect.gen(function* () {
        const { corpus, owner, limits } = yield* load();
        const row = yield* Effect.fromOption(A.head(corpus.canonical));
        const waiting = CitationFrozenEditions.of({
          ...owner,
          source: Effect.fn("ResourceCorrectionTest.wait")(() => Effect.never),
        });
        const installed = yield* makeCitationResourceCorrection(limits).pipe(
          Effect.provideService(CitationFrozenEditions, owner)
        );
        const reporter = yield* installed
          .reporter({ editionGuess: row[0] })
          .pipe(Effect.provideService(CitationFrozenEditions, waiting));
        expect(reporter).toEqual(row[1]);
        const timer = yield* makeCitationNativeManualClock(Duration.millis(997));
        const timed = yield* makeCitationResourceCorrection({ ...limits, extractDeadline: Duration.millis(997) }).pipe(
          Effect.provideService(CitationFrozenEditions, waiting),
          Effect.provideService(Clock.Clock, timer.clock)
        );
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const bypass = yield* timed.page({ reporter: native(""), page: native("[U]"), editionGuess: row[0] });
        expect(bypass).toEqual(native("[U]"));
        const pending = yield* timed
          .reporter({ editionGuess: row[0] })
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* timer.trigger;
        const expired = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(expired).toMatchObject({ limit: "extractDeadline" });
      }),
    { timeout: 60000 }
  );
});
