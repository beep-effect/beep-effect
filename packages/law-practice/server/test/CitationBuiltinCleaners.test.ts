import { fileURLToPath } from "node:url";
import { makeCitationBuiltinCleaners } from "@beep/law-practice-server/internal/Citation/BuiltinCleaners";
import {
  CitationCleanerFailure,
  CitationCleanerProduced,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationCleanerValues,
  makeCitationCleanerValues,
} from "@beep/law-practice-server/internal/Citation/CleanerValues";
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
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { CitationCleanerObject } from "@beep/law-practice-server/internal/Citation/CleanerPipeline";

const Row = S.Struct({
  name: S.String,
  cleaner: S.Literals(["html", "inline_whitespace", "all_whitespace", "underscores", "xml"]),
  valueKind: S.Literals([
    "none",
    "zero",
    "integer",
    "list",
    "bytes",
    "bytearray",
    "memoryview",
    "host",
    "text-subclass",
  ]),
  hooks: S.Array(S.String),
  outcome: S.Union([
    S.Struct({ kind: S.tag("success"), text: S.String, type: S.tag("builtins.str") }),
    S.Struct({ kind: S.tag("error"), type: S.tag("builtins.TypeError"), message: S.String }),
  ]).pipe(S.toTaggedUnion("kind")),
});
const CorpusJson = S.fromJsonString(
  S.Struct({
    artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
    nonTextCases: S.Array(Row),
  })
);

const fail = () => CitationCleanerFailure.make({ reason: "callback-failed" });
const TestRuntime = Layer.merge(BunServices.layer, BunCrypto.layer);

it.layer(TestRuntime, { excludeTestServices: true })("captured builtin cleaner invocation", (it) => {
  it.effect(
    "replays all pinned input kinds without coercion and retires every native child",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const raw = yield* fs.readFileString(
          fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-bytes.json", import.meta.url))
        );
        expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
          "179fc43e44d8d6048b0d4eea38a8a8667d505ce60ee23ded6aa43138cd265201"
        );
        const corpus = yield* S.decodeEffect(CorpusJson)(raw);
        expect(corpus.nonTextCases).toHaveLength(45);
        const strings = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value] as const));
        const policy = {
          ...(yield* defaultCitationEnginePolicy).limits,
          cleanDeadline: Duration.seconds(30),
          operationDeadline: Duration.seconds(60),
        };
        const values = yield* makeCitationCleanerValues(policy);
        const real = yield* ChildProcessSpawner;
        let spawned = 0;
        let retired = 0;
        const builtins = yield* makeCitationBuiltinCleaners(policy, {
          executable: process.execPath,
          cwd: yield* fs.makeTempDirectoryScoped({ prefix: "citation-builtins-" }),
          workerFile: fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
        }).pipe(
          Effect.provideService(CitationCleanerValues, values),
          Effect.provideService(ChildProcessSpawner, {
            ...real,
            spawn: (command) =>
              real.spawn(command).pipe(
                Effect.map((handle) => {
                  spawned++;
                  let seen = false;
                  return {
                    ...handle,
                    isRunning: handle.isRunning.pipe(
                      Effect.tap((running) =>
                        Effect.sync(() => {
                          if (!running && !seen) {
                            expect(() => process.kill(handle.pid, 0)).toThrow();
                            seen = true;
                            retired++;
                          }
                        })
                      )
                    ),
                  };
                })
              ),
          })
        );
        let hooks = 0;
        const poison = new Proxy(
          {},
          {
            get: () => {
              hooks++;
              throw new Error("host coercion");
            },
            ownKeys: () => {
              hooks++;
              throw new Error("host keys");
            },
          }
        );
        const emit = yield* values.retainHost({ function: "emit" });
        const builtin = yield* values.retainHost({ function: "builtin" });
        const makePipeline = (value: CitationCleanerObject, name: typeof Row.Type.cleaner, repeat = false) =>
          makeCitationCleanerPipeline(policy).pipe(
            Effect.provideService(
              CitationCleanerRuntime,
              CitationCleanerRuntime.of({
                fromText: values.text,
                assertOwned: values.assertOwned,
                textUnits: Effect.fn("BuiltinTest.textUnits")((ref) =>
                  values.getText(ref).pipe(Effect.map(O.map((text) => Str.length(text.text))))
                ),
                open: Effect.fn("BuiltinTest.open")(() =>
                  Effect.sync(() => {
                    const steps = repeat ? [emit, builtin, builtin] : [emit, builtin];
                    let index = 0;
                    return { next: Effect.sync(() => O.fromUndefinedOr(steps[index++])) };
                  })
                ),
                contains: Effect.fn("BuiltinTest.contains")(() => Effect.succeed(false)),
                get: Effect.fn("BuiltinTest.get")(() => Effect.fail(fail())),
                callable: Effect.fn("BuiltinTest.callable")((step) =>
                  Effect.succeed(step === emit || step === builtin)
                ),
                invoke: Effect.fn("BuiltinTest.invoke")((step, ref, work) =>
                  step === emit
                    ? Effect.gen(function* () {
                        const text = yield* values.getText(value);
                        const units = O.isSome(text) ? Str.length(text.value.text) : 0;
                        return CitationCleanerProduced.make({
                          value,
                          charges: units === 0 ? [] : [yield* work.reserveText(units)],
                        });
                      })
                    : builtins.invoke(name, ref, work)
                ),
              })
            )
          );
        let successes = 0;
        let failures = 0;
        for (const row of corpus.nonTextCases) {
          const bytes = new TextEncoder().encode("<div>A</div>");
          const value = yield* row.valueKind === "bytes"
            ? values.bytes(bytes)
            : row.valueKind === "text-subclass"
              ? values.subclass("<div>A</div>", poison)
              : values.retainHost(
                  row.valueKind === "none"
                    ? null
                    : row.valueKind === "zero"
                      ? 0
                      : row.valueKind === "integer"
                        ? 42
                        : row.valueKind === "list"
                          ? ["A"]
                          : row.valueKind === "host"
                            ? poison
                            : bytes
                );
          const pipeline = yield* makePipeline(value, row.cleaner);
          expect(row.hooks).toEqual([]);
          if (row.outcome.kind === "error") {
            expect(
              yield* Effect.flip(pipeline.run({ text: "x", plan: "captured-input-kind" })),
              row.name
            ).toMatchObject({ _tag: "CitationCleanerFailure", reason: "builtin-input-type" });
            failures++;
          } else {
            const result = yield* pipeline.run({ text: "x", plan: "captured-input-kind" });
            const text = yield* values.getText(result.value).pipe(Effect.flatMap(Effect.fromOption));
            expect(text, row.name).toEqual({
              text: yield* Effect.fromOption(HashMap.get(strings, row.outcome.text)),
              subtype: "plain",
            });
            expect(result.producedTextUtf16, row.name).toBe(
              Str.length(text.text) + (row.valueKind === "text-subclass" ? 12 : 0)
            );
            successes++;
          }
        }
        expect({ successes, failures, hooks, spawned, retired }).toEqual({
          successes: 6,
          failures: 39,
          hooks: 0,
          spawned: 2,
          retired: 2,
        });
        const unchanged = yield* values.text("A");
        const repeated = yield* makePipeline(unchanged, "underscores", true);
        const result = yield* repeated.run({ text: "x", plan: "same-reference-still-charges" });
        expect(yield* values.same(result.value, unchanged)).toBe(true);
        expect(result.producedTextUtf16).toBe(3);
      }),
    { timeout: 60_000 }
  );
});
