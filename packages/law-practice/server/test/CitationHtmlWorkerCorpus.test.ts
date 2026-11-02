import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationHtmlInput } from "../src/internal/Citation/HtmlInput.ts";
import { makeCitationHtmlWorker } from "../src/internal/Citation/HtmlWorker.ts";
import {
  CitationHtmlWorkerJob,
  CitationHtmlWorkerSuccess,
  encodeCitationHtmlJob,
  encodeCitationHtmlReply,
} from "../src/internal/Citation/HtmlWorkerProtocol.ts";

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
  return {
    executable: process.execPath,
    cwd: yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "citation-html-corpus-" }),
    workerFile: fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
  };
});
it.layer(BunServices.layer, { excludeTestServices: true })("HTML worker qualification", (it) => {
  it.effect(
    "preserves every frozen native outcome through the owned process boundary",
    () =>
      Effect.gen(function* () {
        const raw = yield* (yield* FileSystem.FileSystem).readFileString(
          fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-kernel-cases.json", import.meta.url))
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "34a9b3b4667a71c0234f77fb898f6d6de55a85e7306ea66a55144b3ca95d24d0"
        );
        const corpus = yield* S.decodeEffect(CorpusJson)(raw);
        expect(corpus.cases).toHaveLength(1097);
        const texts = HashMap.fromIterable(A.map(corpus.artifacts, (a) => [a.sha256, a.value] as const));

        const limits = (yield* defaultCitationEnginePolicy).limits;
        const real = yield* ChildProcessSpawner;
        let spawned = 0;
        let confirmedExits = 0;
        const worker = yield* makeCitationHtmlWorker({ ...limits, concurrentOperations: 2 }, yield* runtime).pipe(
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
                expect(failed._tag, row.name).toBe("CitationHtmlInputFailure");
                if (failed._tag === "CitationHtmlInputFailure")
                  expect(failed.reason, row.name).toBe("unicode-encoding-declaration");
                return "declaration";
              }
              if (A.some(row.diagnostics, (d) => d.resourceLimit)) {
                const failed = yield* Effect.flip(run);
                expect(failed._tag, row.name).toBe("CitationSafetyLimitExceeded");
                if (failed._tag === "CitationSafetyLimitExceeded")
                  expect(failed.limit, row.name).toBe("nativeHtmlParserResource");
                return "resource";
              }
              if (row.outcome.kind === "error") {
                expect(row.outcome.type, row.name).toBe("lxml.etree.ParserError");
                const failed = yield* Effect.flip(run);
                expect(failed._tag, row.name).toBe("CitationHtmlKernelFailure");
                if (failed._tag === "CitationHtmlKernelFailure") expect(failed.reason, row.name).toBe("parse-error");
                return "parse";
              }
              expect(yield* run, row.name).toBe(yield* Effect.fromOption(HashMap.get(texts, row.outcome.value)));
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
        expect(yield* worker.snapshot).toEqual({ active: 0, queued: 0, processes: 0, quarantined: 0, closed: false });
      }),
    { timeout: 600_000 }
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
        expect(yield* worker.clean(large)).toBe(large);
        const wide = `${Str.repeat(999_998)("A")}😀`;
        expect(yield* worker.clean(wide)).toBe(wide);
        expect(yield* worker.clean("B")).toBe("B");
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
        expect(yield* exactRequest.clean(text)).toBe(text);
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
        expect(yield* exactReply.clean(quotes)).toBe(quotes);
        const shortReply = yield* makeCitationHtmlWorker(
          { ...limits, processMessageBytes: reply.byteLength - 1 },
          paths
        );
        const oversizedReply = yield* Effect.flip(shortReply.clean(quotes));
        expect(oversizedReply._tag).toBe("CitationSafetyLimitExceeded");
        if (oversizedReply._tag === "CitationSafetyLimitExceeded")
          expect(oversizedReply.limit).toBe("processMessageBytes");
        expect(yield* shortReply.clean("B")).toBe("B");
        const exactOutput = yield* makeCitationHtmlWorker({ ...limits, producedTextUtf16: 4 }, paths);
        expect(yield* exactOutput.clean("<p>😀AB</p>")).toBe("😀AB");
        const shortOutput = yield* makeCitationHtmlWorker({ ...limits, producedTextUtf16: 3 }, paths);
        const oversizedOutput = yield* Effect.flip(shortOutput.clean("<p>😀AB</p>"));
        expect(oversizedOutput._tag).toBe("CitationSafetyLimitExceeded");
        if (oversizedOutput._tag === "CitationSafetyLimitExceeded")
          expect(oversizedOutput.limit).toBe("producedTextUtf16");
        expect(yield* shortOutput.clean("B")).toBe("B");
        for (const supervisor of [
          worker,
          small,
          exactRequest,
          shortRequest,
          exactReply,
          shortReply,
          exactOutput,
          shortOutput,
        ]) {
          expect(yield* supervisor.snapshot).toEqual({
            active: 0,
            queued: 0,
            processes: 0,
            quarantined: 0,
            closed: false,
          });
        }
      }),
    { timeout: 120_000 }
  );
});
