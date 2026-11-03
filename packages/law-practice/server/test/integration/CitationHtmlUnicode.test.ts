import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { makeCitationCleanerOperation } from "@beep/law-practice-server/internal/Citation/CleanerOperation";
import { CitationCleanerRuntime } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import {
  CitationPythonUnicodeStorage,
  makeCitationPythonHash,
} from "@beep/law-practice-server/internal/Citation/PythonHash";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import {
  loadCitationUnicodeHistories,
  makeCitationUnicodePipelineHarness,
} from "../CitationUnicodePipeline.fixtures.ts";

const $I = $LawPracticeServerId.create("test/integration/CitationHtmlUnicode");
class ReplayTotals extends S.Opaque<ReplayTotals, { readonly brand: unique symbol }>()(
  S.Struct({ histories: S.Natural, snapshots: S.Natural, failures: S.Natural, children: S.Natural }).pipe(
    $I.annoteSchema("ReplayTotals", {
      description: "Exact source-case and OS-exit totals for one independent bounded replay lane.",
    })
  )
) {}

// This real-worker qualification belongs to the hosted integration task. The
// package unit task excludes test/integration; no environment skip can green it.
it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })(
  "native HTML Unicode histories",
  (it) => {
    it.effect(
      "matches every source history, native hash and reference relation and confirms every child exit",
      () =>
        Effect.gen(function* () {
          const corpus = yield* loadCitationUnicodeHistories();
          const limits = {
            ...(yield* defaultCitationEnginePolicy).limits,
            concurrentOperations: 2,
            cleanDeadline: Duration.seconds(30),
            operationDeadline: Duration.seconds(60),
          };
          const admission = yield* makeCitationOperationAdmission(limits);
          const nativeAdmission = yield* makeCitationNativeProcessAdmission(limits);
          const replay = Effect.fn("HtmlUnicodeTest.replayLane")(function* (rows: typeof corpus.cases) {
            const owned = yield* makeCitationUnicodePipelineHarness(true).pipe(
              Effect.provideService(CitationNativeProcessAdmission, nativeAdmission)
            );
            const operation = yield* makeCitationCleanerOperation(limits).pipe(
              Effect.provideService(CitationOperationAdmission, admission),
              Effect.provideService(CitationCleanerRuntime, owned.runtime)
            );
            const citationResult1 = yield* defaultCitationEnginePolicy;
            const hash = yield* makeCitationPythonHash(citationResult1.limits);
            let histories = 0;
            let snapshots = 0;
            let failures = 0;
            let expectedChildren = 0;
            const verifyReferences = Effect.fn("HtmlUnicodeTest.verifyReferences")(function* (
              row: (typeof rows)[number]
            ) {
              const refs = yield* owned.references;
              expect(refs, row.name).toHaveLength(row.events.length);
              for (let index = 0; index < refs.length; index++) {
                const ref = A.getUnsafe(refs, index);
                const expected = A.getUnsafe(row.events, index);
                const citationResult2 = yield* owned.values.getUnicode(ref);
                const value = yield* Effect.fromOption(citationResult2);
                expect(value.storage.width, row.name).toBe(expected.value.width);
                const citationResult3 = yield* S.decodeEffect(S.Uint8ArrayFromHex)(expected.value.nativeHex);
                expect(value.storage.bytes, row.name).toEqual(citationResult3);
                expect(value.pythonLength, row.name).toBe(expected.value.pythonLength);
                expect(value.utf16Units, row.name).toBe(expected.value.utf16Units);
                const citationResult4 = yield* hash.unicode(value.storage);
                expect(citationResult4, row.name).toBe(expected.value.hash);
                let sameAs = A.empty<number>();
                for (let prior = 0; prior < index; prior++)
                  if (yield* owned.values.same(A.getUnsafe(refs, prior), ref)) sameAs = A.append(sameAs, prior);
                expect(sameAs, row.name).toEqual(expected.sameAs);
                snapshots++;
              }
            });
            for (const row of rows) {
              const first = A.getUnsafe(row.events, 0).value;
              const citationResult5 = yield* S.decodeEffect(S.Uint8ArrayFromHex)(first.nativeHex);
              owned.select(
                CitationPythonUnicodeStorage.make({
                  width: first.width,
                  bytes: citationResult5,
                }),
                row.steps
              );
              if (row.failure === null) yield* operation.run({ text: "", plan: "native-source-history" });
              else {
                const citationResult6 = yield* Effect.flip(operation.run({ text: "", plan: "native-source-history" }));
                expect(citationResult6, row.name).toMatchObject({
                  _tag: "CitationCleanerFailure",
                  reason: "html-parse-error",
                });
                failures++;
              }
              yield* verifyReferences(row);
              expectedChildren += A.filter(
                A.take(row.steps, row.events.length - 1 + (row.failure === null ? 0 : 1)),
                (step) => step === "html"
              ).length;
              const citationResult7 = yield* owned.nativeCounts;
              expect(citationResult7, row.name).toEqual({
                spawned: expectedChildren,
                confirmed: expectedChildren,
              });
              const citationResult8 = yield* owned.lastWork;
              const work = yield* Effect.fromOption(citationResult8);
              const citationResult9 = yield* work.snapshot;
              expect(citationResult9.closed).toBe(true);
              histories++;
            }
            return ReplayTotals.make({ histories, snapshots, failures, children: expectedChildren });
          });
          // Histories have no cross-history identity assertions. Each lane owns
          // its value arena, live registry and sequential worker history. Two
          // lanes bound the qualification to at most two native children.
          const lanes = [
            A.filter(corpus.cases, (_, index) => index % 2 === 0),
            A.filter(corpus.cases, (_, index) => index % 2 === 1),
          ];
          const results = yield* Effect.forEach(lanes, replay, { concurrency: 2 });
          const totals = A.reduce(
            results,
            ReplayTotals.make({ histories: 0, snapshots: 0, failures: 0, children: 0 }),
            (sum, row) =>
              ReplayTotals.make({
                histories: sum.histories + row.histories,
                snapshots: sum.snapshots + row.snapshots,
                failures: sum.failures + row.failures,
                children: sum.children + row.children,
              })
          );
          expect(totals.histories).toBe(2016);
          expect(totals.snapshots).toBe(6412);
          expect(totals.failures).toBe(482);
          expect(totals.children).toBe(1025);
          const citationResult10 = yield* admission.snapshot;
          expect(citationResult10).toEqual({ active: 0, queued: 0, closed: false });
          const citationResult11 = yield* nativeAdmission.snapshot;
          expect(citationResult11).toEqual({
            active: 0,
            regexActive: 0,
            queued: 0,
            quarantined: 0,
            closed: false,
          });
        }),
      { timeout: 1_200_000 }
    );
  }
);
