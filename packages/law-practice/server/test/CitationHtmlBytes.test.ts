import * as NodeURL from "node:url";
import { makeCitationHtmlInput } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import { makeCitationHtmlKernel } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import { makeCitationHtmlWorker } from "@beep/law-practice-server/internal/Citation/HtmlWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import { citationHtmlWorkerTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import type { CitationHtmlCompletionFailure } from "@beep/law-practice-server/internal/Citation/HtmlCompletion";
import type { CitationHtmlInputFailure } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import type { CitationHtmlKernelFailure } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import type { CitationHtmlWorkerFailure } from "@beep/law-practice-server/internal/Citation/HtmlWorkerProtocol";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

type NativeFailure =
  | CitationHtmlInputFailure
  | CitationHtmlKernelFailure
  | CitationHtmlCompletionFailure
  | CitationHtmlWorkerFailure
  | CitationSafetyLimitExceeded;

const Outcome = S.Union([
  S.Struct({ kind: S.tag("success"), text: S.String, type: S.tag("builtins.str") }),
  S.Struct({ kind: S.tag("error"), message: S.String, type: S.String }),
]).pipe(S.toTaggedUnion("kind"));
const Case = S.Struct({
  name: S.String,
  hex: S.String,
  fullHtml: S.Boolean,
  outcome: Outcome,
  diagnostics: S.Array(S.Struct({ resourceLimit: S.Boolean })),
});
const CorpusJson = S.fromJsonString(
  S.Struct({
    producerSha256: S.String,
    artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
    cases: S.Array(Case),
    nonTextCases: S.Array(S.Struct({ name: S.String, outcome: Outcome, hooks: S.Array(S.String) })),
  })
);

const load = Effect.fn("HtmlBytesTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const raw = yield* fs.readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-bytes.json", import.meta.url))
  );
  const citationResult1 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
  expect(citationResult1).toBe("179fc43e44d8d6048b0d4eea38a8a8667d505ce60ee23ded6aa43138cd265201");
  const data = yield* S.decodeEffect(CorpusJson)(raw);
  expect(data.cases).toHaveLength(589);
  expect(data.artifacts).toHaveLength(488);
  expect(data.nonTextCases).toHaveLength(45);
  expect(A.filter(data.nonTextCases, (r) => r.outcome.kind === "success")).toHaveLength(6);
  expect(A.every(data.nonTextCases, (r) => r.hooks.length === 0)).toBe(true);
  const citationResult2 = yield* fs.readFile(
    NodeURL.fileURLToPath(
      new URL("../../../../goals/citation-extraction-engine/ops/probe-html-bytes.py", import.meta.url)
    )
  );
  const citationResult3 = yield* S.decodeEffect(Sha256HexFromBytes)(citationResult2);
  expect(citationResult3).toBe(data.producerSha256);
  return { data, strings: HashMap.fromIterable(A.map(data.artifacts, (r) => [r.sha256, r.value] as const)) };
});
const verify = Effect.fn("HtmlBytesTest.verify")(function* (
  row: typeof Case.Type,
  run: Effect.Effect<string, NativeFailure>,
  strings: HashMap.HashMap<string, string>
) {
  if (A.some(row.diagnostics, (d) => d.resourceLimit)) {
    const citationResult4 = yield* Effect.flip(run);
    expect(citationResult4, row.name).toMatchObject({
      _tag: "CitationSafetyLimitExceeded",
      limit: "nativeHtmlParserResource",
    });
    return "resource";
  }
  if (row.outcome.kind === "success") {
    const citationResult5 = yield* run.pipe(
      Effect.tapError(() => Effect.logError(`Unexpected byte failure: ${row.name}`))
    );
    const citationResult6 = yield* Effect.fromOption(HashMap.get(strings, row.outcome.text));
    expect(citationResult5, row.name).toBe(citationResult6);
    return "success";
  }
  const citationResult7 = yield* Effect.flip(run);
  expect(citationResult7, row.name).toMatchObject({
    _tag: "CitationHtmlKernelFailure",
    reason: row.outcome.type === "builtins.UnicodeDecodeError" ? "unicode-decode-error" : "parse-error",
  });
  return row.outcome.type;
});
it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })(
  "pinned native HTML bytes",
  (it) => {
    it.effect(
      "matches every byte classifier and complete source result/error without Unicode coercion",
      () =>
        Effect.gen(function* () {
          const { data, strings } = yield* load();
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const prep = yield* makeCitationHtmlInput(limits);
          const fs = yield* FileSystem.FileSystem;
          const citationResult8 = yield* fs.readFile(
            NodeURL.fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url))
          );
          const kernel = yield* makeCitationHtmlKernel(citationResult8);
          for (const row of data.cases) {
            const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.hex);
            const input = yield* prep.prepareBytes(bytes, () => Effect.void);
            expect(input.encoding).toBe("AUTO");
            expect(input.fullHtml, row.name).toBe(row.fullHtml);
            expect(input.bytes, row.name).toEqual(bytes);
            yield* verify(row, kernel.run({ input, outputUtf16: limits.producedTextUtf16 }), strings);
          }
        }),
      { timeout: 60_000 }
    );
    it.effect(
      "preserves all byte outcomes across owned workers and independently confirms every child exit",
      () =>
        Effect.gen(function* () {
          const { data, strings } = yield* load();
          const limits = (yield* defaultCitationEnginePolicy).limits;
          const fs = yield* FileSystem.FileSystem;
          const real = yield* ChildProcessSpawner;
          let spawned = 0;
          let exits = 0;
          const citationResult9 = yield* fs.makeTempDirectoryScoped({ prefix: "citation-html-bytes-" });
          const workerRuntime = yield* citationHtmlWorkerTestRuntime();
          const worker = yield* makeCitationHtmlWorker(
            { ...limits, concurrentOperations: 2 },
            { ...workerRuntime, cwd: citationResult9 }
          ).pipe(
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
                            if (!running && !acknowledged) {
                              expect(() => process.kill(handle.pid, 0)).toThrow();
                              acknowledged = true;
                              exits++;
                            }
                          })
                        )
                      ),
                    };
                  })
                ),
            })
          );
          const results = yield* Effect.forEach(
            data.cases,
            (row) =>
              Effect.gen(function* () {
                const bytes = yield* S.decodeEffect(S.Uint8ArrayFromHex)(row.hex);
                return yield* verify(row, worker.cleanBytes(bytes), strings);
              }),
            { concurrency: 2 }
          );
          expect(A.filter(results, (r) => r === "success")).toHaveLength(564);
          expect(A.filter(results, (r) => r === "resource")).toHaveLength(1);
          expect(A.filter(results, (r) => r === "builtins.UnicodeDecodeError")).toHaveLength(20);
          expect(A.filter(results, (r) => r === "lxml.etree.ParserError")).toHaveLength(4);
          expect(spawned).toBe(589);
          expect(exits).toBe(589);
          const citationResult10 = yield* worker.snapshot;
          expect(citationResult10).toMatchObject({ active: 0, queued: 0, processes: 0, quarantined: 0 });
        }),
      { timeout: 600_000 }
    );
  }
);
