import * as NodeURL from "node:url";
import { makeCitationHtmlInput } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import {
  CitationHtmlWorkerJob,
  CitationHtmlWorkerSuccess,
  encodeCitationHtmlJob,
  encodeCitationHtmlReply,
} from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const CorpusJson = S.fromJsonString(
  S.Struct({
    artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
    cases: S.Array(
      S.Struct({
        name: S.String,
        text: S.String,
        diagnostics: S.Array(S.Struct({ resourceLimit: S.Boolean })),
        outcome: S.Union([
          S.Struct({ kind: S.tag("success"), value: S.String }),
          S.Struct({ kind: S.tag("error"), type: S.String }),
        ]).pipe(S.toTaggedUnion("kind")),
      })
    ),
  })
);

const runtime = Effect.gen(function* () {
  const citationResult1 = yield* FileSystem.FileSystem;
  return {
    kind: "bun",
    executable: process.execPath,
    cwd: yield* citationResult1.makeTempDirectoryScoped({ prefix: "citation-html-corpus-" }),
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
  };
});
const TestRuntime = Layer.merge(BunServices.layer, BunCrypto.layer);

it.layer(TestRuntime, { excludeTestServices: true })("HTML worker qualification", (it) => {
  it.effect("smoke-tests the actual worker entrypoint for parser errors and successful text", () =>
    Effect.gen(function* () {
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const admission = yield* makeCitationNativeProcessAdmission(limits);
      const citationResult2 = yield* runtime;
      const worker = yield* makeCitationHtmlWorker(limits, citationResult2).pipe(
        Effect.provideService(CitationNativeProcessAdmission, admission)
      );
      const citationResult3 = yield* worker.clean("").pipe(Effect.flip);
      expect(citationResult3).toMatchObject({
        _tag: "CitationHtmlKernelFailure",
        reason: "parse-error",
      });
      const citationResult4 = yield* admission.snapshot;
      expect(citationResult4).toEqual({
        active: 0,
        regexActive: 0,
        queued: 0,
        quarantined: 0,
        closed: false,
      });
      const citationResult5 = yield* worker.clean("<p>ok</p>");
      expect(citationResult5).toBe("ok");
      const citationResult6 = yield* admission.snapshot;
      expect(citationResult6).toEqual({
        active: 0,
        regexActive: 0,
        queued: 0,
        quarantined: 0,
        closed: false,
      });
    })
  );
  it.effect(
    "preserves every frozen native outcome through the owned process boundary",
    () =>
      Effect.gen(function* () {
        const citationResult7 = yield* FileSystem.FileSystem;
        const raw = yield* citationResult7.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/html-kernel-cases.json", import.meta.url)
          )
        );
        const citationResult8 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
        expect(citationResult8).toBe("34a9b3b4667a71c0234f77fb898f6d6de55a85e7306ea66a55144b3ca95d24d0");
        const corpus = yield* S.decodeEffect(CorpusJson)(raw);
        expect(corpus.cases).toHaveLength(1097);
        const texts = HashMap.fromIterable(A.map(corpus.artifacts, (a) => [a.sha256, a.value] as const));

        const limits = (yield* defaultCitationEnginePolicy).limits;
        const real = yield* ChildProcessSpawner;
        let spawned = 0;
        let confirmedExits = 0;
        const citationResult9 = yield* runtime;
        const worker = yield* makeCitationHtmlWorker({ ...limits, concurrentOperations: 2 }, citationResult9).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  spawned++;
                  let acknowledged = false;
                  return {
                    ...handle,
                    isRunning: handle.isRunning.pipe(
                      Effect.tap((running) =>
                        Effect.sync(() => {
                          if (!running) {
                            expect(() => process.kill(handle.pid, 0)).toThrow();
                            if (!acknowledged) {
                              acknowledged = true;
                              confirmedExits++;
                            }
                          }
                        })
                      )
                    ),
                  };
                })
              ),
          })
        );
        const outcomes = yield* Effect.forEach(
          corpus.cases,
          (row) =>
            Effect.gen(function* () {
              const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
              const run = worker.clean(text);
              if (row.outcome.kind === "error" && row.outcome.type === "builtins.ValueError") {
                const failed = yield* Effect.flip(run);
                expect(failed, row.name).toMatchObject({
                  _tag: "CitationHtmlInputFailure",
                  reason: "unicode-encoding-declaration",
                });
                return "declaration";
              }
              if (A.some(row.diagnostics, (d) => d.resourceLimit)) {
                const failed = yield* Effect.flip(run);
                expect(failed, row.name).toMatchObject({
                  _tag: "CitationSafetyLimitExceeded",
                  limit: "nativeHtmlParserResource",
                });
                return "resource";
              }
              if (row.outcome.kind === "error") {
                expect(row.outcome.type, row.name).toBe("lxml.etree.ParserError");
                const failed = yield* Effect.flip(run);
                expect(failed, row.name).toMatchObject({ _tag: "CitationHtmlKernelFailure", reason: "parse-error" });
                return "parse";
              }
              const citationResult10 = yield* run;
              const citationResult11 = yield* Effect.fromOption(HashMap.get(texts, row.outcome.value));
              expect(citationResult10, row.name).toBe(citationResult11);
              return "success";
            }),
          { concurrency: 2 }
        );
        expect(A.filter(outcomes, (x) => x === "success")).toHaveLength(840);
        expect(A.filter(outcomes, (x) => x === "declaration")).toHaveLength(238);
        expect(A.filter(outcomes, (x) => x === "parse")).toHaveLength(16);
        expect(A.filter(outcomes, (x) => x === "resource")).toHaveLength(3);
        expect(spawned).toBe(859);
        expect(confirmedExits).toBe(859);
        const citationResult12 = yield* worker.snapshot;
        expect(citationResult12).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
      }),
    // The hosted 1,097-case replay exceeded the previous ten-minute suite watchdog.
    // Per-request clean/operation/cleanup deadlines and every exit assertion remain enforced.
    { timeout: 1_200_000 }
  );
  it.effect(
    "preserves the absolute source ceiling and exact request/reply boundaries without partial output",
    () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const paths = yield* runtime;
        const policy = {
          ...limits,
          sourceUtf16: 1_000_000,
          producedTextUtf16: 1_000_000,
          cleanDeadline: Duration.seconds(30),
          operationDeadline: Duration.seconds(60),
        };
        const worker = yield* makeCitationHtmlWorker(policy, paths);
        const large = Str.repeat(1_000_000)("A");
        const citationResult13 = yield* worker.clean(large);
        expect(citationResult13).toBe(large);
        const wide = `${Str.repeat(999_998)("A")}😀`;
        const citationResult14 = yield* worker.clean(wide);
        expect(citationResult14).toBe(wide);
        const citationResult15 = yield* worker.clean("B");
        expect(citationResult15).toBe("B");
        const small = yield* makeCitationHtmlWorker({ ...limits, sourceUtf16: 10 }, paths);
        const source = yield* Effect.flip(small.clean(Str.repeat(11)("A")));
        expect(source._tag).toBe("CitationSafetyLimitExceeded");
        if (source._tag === "CitationSafetyLimitExceeded") expect(source.limit).toBe("sourceUtf16");
        const preparation = yield* makeCitationHtmlInput(limits);
        const text = Str.repeat(4096)("A");
        const prepared = yield* preparation.prepare(text);
        const request = yield* encodeCitationHtmlJob(
          CitationHtmlWorkerJob.make({ ...prepared, outputUtf16: limits.producedTextUtf16 }),
          32_000_000
        );
        expect(request.byteLength).toBe(5586);
        const exactRequest = yield* makeCitationHtmlWorker(
          { ...limits, processMessageBytes: request.byteLength },
          paths
        );
        const citationResult16 = yield* exactRequest.clean(text);
        expect(citationResult16).toBe(text);
        let spawned = 0;
        const real = yield* ChildProcessSpawner;
        const shortRequest = yield* makeCitationHtmlWorker(
          { ...limits, processMessageBytes: request.byteLength - 1 },
          paths
        ).pipe(
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.tap(() =>
                  Effect.sync(() => {
                    spawned++;
                  })
                )
              ),
          })
        );
        const tooLarge = yield* Effect.flip(shortRequest.clean(text));
        expect(tooLarge._tag).toBe("CitationSafetyLimitExceeded");
        if (tooLarge._tag === "CitationSafetyLimitExceeded") expect(tooLarge.limit).toBe("processMessageBytes");
        expect(spawned).toBe(0);
        const quotes = Str.repeat(4096)('"');
        const reply = yield* encodeCitationHtmlReply(CitationHtmlWorkerSuccess.make({ text: quotes }), 32_000_000);
        expect(reply.byteLength).toBe(8257);
        const exactReply = yield* makeCitationHtmlWorker({ ...limits, processMessageBytes: reply.byteLength }, paths);
        const citationResult17 = yield* exactReply.clean(quotes);
        expect(citationResult17).toBe(quotes);
        const shortReply = yield* makeCitationHtmlWorker(
          { ...limits, processMessageBytes: reply.byteLength - 1 },
          paths
        );
        const oversizedReply = yield* Effect.flip(shortReply.clean(quotes));
        expect(oversizedReply._tag).toBe("CitationSafetyLimitExceeded");
        if (oversizedReply._tag === "CitationSafetyLimitExceeded")
          expect(oversizedReply.limit).toBe("processMessageBytes");
        const citationResult18 = yield* shortReply.clean("B");
        expect(citationResult18).toBe("B");
        const exactOutput = yield* makeCitationHtmlWorker({ ...limits, producedTextUtf16: 4 }, paths);
        const citationResult19 = yield* exactOutput.clean("<p>😀AB</p>");
        expect(citationResult19).toBe("😀AB");
        const shortOutput = yield* makeCitationHtmlWorker({ ...limits, producedTextUtf16: 3 }, paths);
        const oversizedOutput = yield* Effect.flip(shortOutput.clean("<p>😀AB</p>"));
        expect(oversizedOutput._tag).toBe("CitationSafetyLimitExceeded");
        if (oversizedOutput._tag === "CitationSafetyLimitExceeded")
          expect(oversizedOutput.limit).toBe("producedTextUtf16");
        const citationResult20 = yield* shortOutput.clean("B");
        expect(citationResult20).toBe("B");
        yield* Effect.forEach(
          [worker, small, exactRequest, shortRequest, exactReply, shortReply, exactOutput, shortOutput],
          Effect.fnUntraced(function* (supervisor) {
            const citationResult21 = yield* supervisor.snapshot;
            expect(citationResult21).toEqual({
              active: 0,
              queued: 0,
              processes: 0,
              quarantined: 0,
              closed: false,
            });
          }),
          { concurrency: 1, discard: true }
        );
      }),
    { timeout: 120_000 }
  );
});
