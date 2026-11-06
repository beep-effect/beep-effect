import * as NodeURL from "node:url";
import { makeCitationHtmlInput } from "@beep/law-practice-server/internal/Citation/HtmlInput";
import {
  makeCitationClosedHtmlWasi,
  makeCitationHtmlKernel,
} from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { vi } from "vitest";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import type { CitationHtmlCompletionFailure } from "@beep/law-practice-server/internal/Citation/HtmlCompletion";
import type { CitationHtmlKernelFailure } from "@beep/law-practice-server/internal/Citation/HtmlKernel";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

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

const loadAsset = Effect.fn("HtmlKernelTest.loadAsset")(function* () {
  const citationResult1 = yield* FileSystem.FileSystem;
  return yield* citationResult1.readFile(
    NodeURL.fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url))
  );
});
it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("private HTML kernel", (it) => {
  it.effect("denies every descriptor/path call and supplies only empty environment and fixed time", () =>
    Effect.gen(function* () {
      const host = yield* makeCitationClosedHtmlWasi();
      expect(R.keys(host.imports)).toEqual([
        "environ_get",
        "environ_sizes_get",
        "clock_time_get",
        "fd_close",
        "fd_fdstat_get",
        "fd_fdstat_set_flags",
        "fd_prestat_get",
        "fd_prestat_dir_name",
        "fd_read",
        "fd_seek",
        "fd_write",
        "path_filestat_get",
        "path_open",
        "proc_exit",
      ]);
      expect(host.imports.environ_sizes_get(0, 4)).toBe(21);
      const buffer = new ArrayBuffer(32);
      const bytes = new Uint8Array(buffer).fill(7);
      yield* host.bindMemory({ buffer });
      const denials = [
        host.imports.fd_close,
        host.imports.fd_fdstat_get,
        host.imports.fd_fdstat_set_flags,
        host.imports.fd_prestat_get,
        host.imports.fd_prestat_dir_name,
        host.imports.fd_read,
        host.imports.fd_seek,
        host.imports.fd_write,
        host.imports.path_filestat_get,
        host.imports.path_open,
      ];
      yield* Effect.forEach(
        denials,
        Effect.fnUntraced(function* (call) {
          expect(call(0, 1, 2, 3)).toBe(8);
        }),
        { concurrency: 1, discard: true }
      );
      expect(A.fromIterable(bytes)).toEqual(A.replicate(7, 32));
      expect(host.imports.environ_get()).toBe(0);
      expect(host.imports.proc_exit()).toBeUndefined();
      expect(host.imports.environ_sizes_get(0, 4)).toBe(0);
      expect(host.imports.clock_time_get(0, BigInt(1), 8)).toBe(0);
      expect(A.fromIterable(bytes)).toEqual([...A.replicate(0, 16), ...A.replicate(7, 16)]);
    })
  );
  it.effect(
    "matches full source cleaner outcomes with the approved resource exception",
    () =>
      Effect.gen(function* () {
        const citationResult2 = yield* FileSystem.FileSystem;
        const raw = yield* citationResult2.readFileString(
          NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/html-kernel-cases.json", import.meta.url)
          )
        );
        const citationResult3 = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw));
        expect(citationResult3).toBe("34a9b3b4667a71c0234f77fb898f6d6de55a85e7306ea66a55144b3ca95d24d0");
        const corpus = yield* S.decodeEffect(CorpusJson)(raw);
        expect(corpus.cases).toHaveLength(1097);
        const texts = HashMap.fromIterable(A.map(corpus.artifacts, (a) => [a.sha256, a.value] as const));
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const preparation = yield* makeCitationHtmlInput(limits);
        const citationResult4 = yield* loadAsset();
        const kernel = yield* makeCitationHtmlKernel(citationResult4);
        let successes = 0;
        let declarations = 0;
        let parseErrors = 0;
        let resourceErrors = 0;
        yield* Effect.forEach(
          corpus.cases,
          Effect.fnUntraced(function* (row) {
            const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
            if (row.outcome.kind === "error" && row.outcome.type === "builtins.ValueError") {
              const failed = yield* Effect.flip(preparation.prepare(text));
              expect(failed, row.name).toMatchObject({
                _tag: "CitationHtmlInputFailure",
                reason: "unicode-encoding-declaration",
              });
              declarations++;
              return;
            }
            const input = yield* preparation.prepare(text);
            const run = kernel.run({ input, outputUtf16: limits.producedTextUtf16 }) satisfies Effect.Effect<
              string,
              CitationSafetyLimitExceeded | CitationHtmlKernelFailure | CitationHtmlCompletionFailure
            >;
            if (A.some(row.diagnostics, (d) => d.resourceLimit)) {
              const failed = yield* Effect.flip(run);
              expect(failed, row.name).toMatchObject({
                _tag: "CitationSafetyLimitExceeded",
                limit: "nativeHtmlParserResource",
              });
              resourceErrors++;
            } else if (row.outcome.kind === "error") {
              expect(row.outcome.type, row.name).toBe("lxml.etree.ParserError");
              const failed = yield* Effect.flip(run);
              expect(failed, row.name).toMatchObject({ _tag: "CitationHtmlKernelFailure", reason: "parse-error" });
              parseErrors++;
            } else {
              const citationResult5 = yield* run;
              const citationResult6 = yield* Effect.fromOption(HashMap.get(texts, row.outcome.value));
              expect(citationResult5, row.name).toBe(citationResult6);
              successes++;
            }
          }),
          { concurrency: 1, discard: true }
        );
        expect([successes, declarations, parseErrors, resourceErrors]).toEqual([840, 238, 16, 3]);
      }),
    { timeout: 30_000 }
  );
  it.effect(
    "observes native memory growth at the absolute source ceiling",
    () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const preparation = yield* makeCitationHtmlInput({
          ...limits,
          sourceUtf16: 1_000_000,
          cleanDeadline: Duration.seconds(30),
        });
        const text = Str.repeat(1_000_000)("A");
        const input = yield* preparation.prepare(text);
        const citationResult7 = yield* loadAsset();
        const kernel = yield* makeCitationHtmlKernel(citationResult7);
        const citationResult8 = yield* kernel.run({ input, outputUtf16: 1_000_000 });
        expect(citationResult8).toBe(text);
        const citationResult9 = yield* preparation.prepare("B");
        const citationResult10 = yield* kernel.run({ input: citationResult9, outputUtf16: 1 });
        expect(citationResult10).toBe("B");
      }),
    { timeout: 30_000 }
  );
  it.effect("rejects altered assets and enforces exact output ceilings without poisoning later instances", () =>
    Effect.gen(function* () {
      const bytes = yield* loadAsset();
      const malformed = yield* makeCitationHtmlKernel({}).pipe(Effect.flip);
      expect(malformed).toMatchObject({ reason: "invalid-asset" });
      const changed = new Uint8Array(bytes);
      changed[0] = 1;
      const citationResult11 = yield* Effect.flip(makeCitationHtmlKernel(changed));
      expect(citationResult11.reason).toBe("invalid-asset");
      const kernel = yield* makeCitationHtmlKernel(bytes);
      const citationResult12 = yield* defaultCitationEnginePolicy;
      const prep = yield* makeCitationHtmlInput(citationResult12.limits);
      const input = yield* prep.prepare("<p>😀AB</p>");
      const failed = yield* Effect.flip(kernel.run({ input, outputUtf16: 3 }));
      expect(failed._tag).toBe("CitationSafetyLimitExceeded");
      if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("producedTextUtf16");
      const citationResult13 = yield* kernel.run({ input, outputUtf16: 4 });
      expect(citationResult13).toBe("😀AB");
      const citationResult14 = yield* prep.prepare("");
      const citationResult15 = yield* kernel.run({ input: citationResult14, outputUtf16: 4 }).pipe(
        Effect.flip,
        Effect.map((f) => f._tag)
      );
      expect(citationResult15).toBe("CitationHtmlKernelFailure");
      const citationResult16 = yield* kernel.run({ input, outputUtf16: 4 });
      expect(citationResult16).toBe("😀AB");
      const citationResult17 = yield* Effect.flip(kernel.run({ input, outputUtf16: -1 }));
      expect(citationResult17._tag).toBe("CitationHtmlKernelFailure");
    })
  );

  it.effect("sanitizes invalid digest output and defects during asset and runtime inventory authentication", () =>
    Effect.gen(function* () {
      const bytes = yield* loadAsset();
      const crypto = yield* Digest.Digest;
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const prep = yield* makeCitationHtmlInput(limits);
      const input = yield* prep.prepare("<p>Example</p>");
      for (const broken of [Effect.succeed(new Uint8Array(1)), Effect.die("synthetic-digest-defect")]) {
        for (const successfulReads of [0, 1]) {
          const reads = yield* Ref.make(0);
          const digest = makeTestCitationDigest((algorithm, value) =>
            Ref.getAndUpdate(reads, (count) => count + 1).pipe(
              Effect.flatMap((count) => (count < successfulReads ? crypto.digest(algorithm, value) : broken))
            )
          );
          const failure = yield* makeCitationHtmlKernel(bytes).pipe(
            Effect.flatMap((kernel) => kernel.run({ input, outputUtf16: 100 })),
            Effect.provideService(Digest.Digest, digest),
            Effect.flip
          );
          expect(failure).toMatchObject({ _tag: "CitationHtmlKernelFailure", reason: "invalid-asset" });
          expect("cause" in failure).toBe(false);
        }
      }
    })
  );

  it.effect("fails closed when the host cannot compile or instantiate the authenticated module", () =>
    Effect.gen(function* () {
      const bytes = yield* loadAsset();
      const input = { encoding: "UTF-8", bytes: new TextEncoder().encode("<p>Example</p>"), fullHtml: false };
      const cases = [
        { runtime: {}, reason: "invalid-asset" },
        {
          runtime: {
            Module: class {
              constructor() {
                throw new Error("synthetic compile failure");
              }
            },
            Instance: class {},
          },
          reason: "invalid-asset",
        },
        {
          runtime: {
            Module: class {},
            Instance: class {
              constructor() {
                throw new Error("synthetic instantiate failure");
              }
            },
          },
          reason: "kernel-failed",
        },
        { runtime: { Module: class {}, Instance: class {} }, reason: "kernel-failed" },
        {
          runtime: {
            Module: class {},
            Instance: class {
              readonly exports = {};
            },
          },
          reason: "kernel-failed",
        },
      ];
      for (const row of cases) {
        const failure = yield* Effect.acquireUseRelease(
          Effect.sync(() => vi.stubGlobal("WebAssembly", row.runtime)),
          () =>
            makeCitationHtmlKernel(bytes).pipe(
              Effect.flatMap((kernel) => kernel.run({ input, outputUtf16: 100 })),
              Effect.flip
            ),
          () => Effect.sync(() => vi.unstubAllGlobals())
        );
        expect(failure).toMatchObject({ _tag: "CitationHtmlKernelFailure", reason: row.reason });
        expect("cause" in failure).toBe(false);
      }
    })
  );
});
