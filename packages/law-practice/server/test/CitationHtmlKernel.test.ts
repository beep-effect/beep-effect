import { fileURLToPath } from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationHtmlInput } from "../src/internal/Citation/HtmlInput.ts";
import { makeCitationClosedHtmlWasi, makeCitationHtmlKernel } from "../src/internal/Citation/HtmlKernel.ts";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type { CitationHtmlCompletionFailure } from "../src/internal/Citation/HtmlCompletion.ts";
import type { CitationHtmlKernelFailure } from "../src/internal/Citation/HtmlKernel.ts";

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
  return yield* (yield* FileSystem.FileSystem).readFile(
    fileURLToPath(new URL("../assets/citation-html/kernel.wasm", import.meta.url))
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
      for (const call of denials) expect(call(0, 1, 2, 3)).toBe(8);
      expect(A.fromIterable(bytes)).toEqual(A.replicate(7, 32));
      expect(host.imports.environ_get()).toBe(0);
      expect(host.imports.environ_sizes_get(0, 4)).toBe(0);
      expect(host.imports.clock_time_get(0, BigInt(1), 8)).toBe(0);
      expect(A.fromIterable(bytes)).toEqual([...A.replicate(0, 16), ...A.replicate(7, 16)]);
    })
  );
  it.effect(
    "matches full source cleaner outcomes with the approved resource exception",
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
        const preparation = yield* makeCitationHtmlInput(limits);
        const kernel = yield* makeCitationHtmlKernel(yield* loadAsset());
        let successes = 0;
        let declarations = 0;
        let parseErrors = 0;
        let resourceErrors = 0;
        for (const row of corpus.cases) {
          const text = yield* Effect.fromOption(HashMap.get(texts, row.text));
          if (row.outcome.kind === "error" && row.outcome.type === "builtins.ValueError") {
            const failed = yield* Effect.flip(preparation.prepare(text));
            expect(failed._tag, row.name).toBe("CitationHtmlInputFailure");
            if (failed._tag === "CitationHtmlInputFailure")
              expect(failed.reason, row.name).toBe("unicode-encoding-declaration");
            declarations++;
            continue;
          }
          const input = yield* preparation.prepare(text);
          const run = kernel.run({ input, outputUtf16: limits.producedTextUtf16 }) satisfies Effect.Effect<
            string,
            CitationSafetyLimitExceeded | CitationHtmlKernelFailure | CitationHtmlCompletionFailure
          >;
          if (A.some(row.diagnostics, (d) => d.resourceLimit)) {
            const failed = yield* Effect.flip(run);
            expect(failed._tag, row.name).toBe("CitationSafetyLimitExceeded");
            if (failed._tag === "CitationSafetyLimitExceeded")
              expect(failed.limit, row.name).toBe("nativeHtmlParserResource");
            resourceErrors++;
          } else if (row.outcome.kind === "error") {
            expect(row.outcome.type, row.name).toBe("lxml.etree.ParserError");
            const failed = yield* Effect.flip(run);
            expect(failed._tag, row.name).toBe("CitationHtmlKernelFailure");
            if (failed._tag === "CitationHtmlKernelFailure") expect(failed.reason, row.name).toBe("parse-error");
            parseErrors++;
          } else {
            expect(yield* run, row.name).toBe(yield* Effect.fromOption(HashMap.get(texts, row.outcome.value)));
            successes++;
          }
        }
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
        const kernel = yield* makeCitationHtmlKernel(yield* loadAsset());
        expect(yield* kernel.run({ input, outputUtf16: 1_000_000 })).toBe(text);
        expect(yield* kernel.run({ input: yield* preparation.prepare("B"), outputUtf16: 1 })).toBe("B");
      }),
    { timeout: 30_000 }
  );
  it.effect("rejects altered assets and enforces exact output ceilings without poisoning later instances", () =>
    Effect.gen(function* () {
      const bytes = yield* loadAsset();
      const changed = new Uint8Array(bytes);
      changed[0] = 1;
      expect((yield* Effect.flip(makeCitationHtmlKernel(changed))).reason).toBe("invalid-asset");
      const kernel = yield* makeCitationHtmlKernel(bytes);
      const prep = yield* makeCitationHtmlInput((yield* defaultCitationEnginePolicy).limits);
      const input = yield* prep.prepare("<p>😀AB</p>");
      const failed = yield* Effect.flip(kernel.run({ input, outputUtf16: 3 }));
      expect(failed._tag).toBe("CitationSafetyLimitExceeded");
      if (failed._tag === "CitationSafetyLimitExceeded") expect(failed.limit).toBe("producedTextUtf16");
      expect(yield* kernel.run({ input, outputUtf16: 4 })).toBe("😀AB");
      expect(
        yield* kernel.run({ input: yield* prep.prepare(""), outputUtf16: 4 }).pipe(
          Effect.flip,
          Effect.map((f) => f._tag)
        )
      ).toBe("CitationHtmlKernelFailure");
      expect(yield* kernel.run({ input, outputUtf16: 4 })).toBe("😀AB");
      expect((yield* Effect.flip(kernel.run({ input, outputUtf16: -1 })))._tag).toBe("CitationHtmlKernelFailure");
    })
  );
});
