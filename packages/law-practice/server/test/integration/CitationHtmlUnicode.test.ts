import { $LawPracticeServerId } from "@beep/identity/packages";
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
import { CitationOperationAdmission, makeCitationOperationAdmission } from "../../src/internal/Citation/Admission.ts";
import { makeCitationCleanerOperation } from "../../src/internal/Citation/CleanerOperation.ts";
import { CitationCleanerRuntime } from "../../src/internal/Citation/CleanerPipeline.ts";
import { CitationPythonUnicodeStorage, makeCitationPythonHash } from "../../src/internal/Citation/PythonHash.ts";
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
          const replay = Effect.fn("HtmlUnicodeTest.replayLane")(function* (rows: typeof corpus.cases) {
            const owned = yield* makeCitationUnicodePipelineHarness(true);
            const operation = yield* makeCitationCleanerOperation(limits).pipe(
              Effect.provideService(CitationOperationAdmission, admission),
              Effect.provideService(CitationCleanerRuntime, owned.runtime)
            );
            const hash = yield* makeCitationPythonHash((yield* defaultCitationEnginePolicy).limits);
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
                const value = yield* Effect.fromOption(yield* owned.values.getUnicode(ref));
                expect(value.storage.width, row.name).toBe(expected.value.width);
                expect(value.storage.bytes, row.name).toEqual(
                  yield* S.decodeEffect(S.Uint8ArrayFromHex)(expected.value.nativeHex)
                );
                expect(value.pythonLength, row.name).toBe(expected.value.pythonLength);
                expect(value.utf16Units, row.name).toBe(expected.value.utf16Units);
                expect(yield* hash.unicode(value.storage), row.name).toBe(expected.value.hash);
                let sameAs = A.empty<number>();
                for (let prior = 0; prior < index; prior++)
                  if (yield* owned.values.same(A.getUnsafe(refs, prior), ref)) sameAs = A.append(sameAs, prior);
                expect(sameAs, row.name).toEqual(expected.sameAs);
                snapshots++;
              }
            });
            for (const row of rows) {
              const first = A.getUnsafe(row.events, 0).value;
              owned.select(
                CitationPythonUnicodeStorage.make({
                  width: first.width,
                  bytes: yield* S.decodeEffect(S.Uint8ArrayFromHex)(first.nativeHex),
                }),
                row.steps
              );
              if (row.failure === null) yield* operation.run({ text: "", plan: "native-source-history" });
              else {
                expect(
                  yield* Effect.flip(operation.run({ text: "", plan: "native-source-history" })),
                  row.name
                ).toMatchObject({ _tag: "CitationCleanerFailure", reason: "html-parse-error" });
                failures++;
              }
              yield* verifyReferences(row);
              expectedChildren += A.filter(
                A.take(row.steps, row.events.length - 1 + (row.failure === null ? 0 : 1)),
                (step) => step === "html"
              ).length;
              expect(yield* owned.nativeCounts, row.name).toEqual({
                spawned: expectedChildren,
                confirmed: expectedChildren,
              });
              const work = yield* Effect.fromOption(yield* owned.lastWork);
              expect((yield* work.snapshot).closed).toBe(true);
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
          expect(yield* admission.snapshot).toEqual({ active: 0, queued: 0, closed: false });
        }),
      { timeout: 1_200_000 }
    );
  }
);
