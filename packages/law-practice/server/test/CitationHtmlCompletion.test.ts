import { fileURLToPath } from "node:url";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { completeCitationHtml } from "../src/internal/Citation/HtmlCompletion.ts";
import type { CitationHtmlCompletionFailure } from "../src/internal/Citation/HtmlCompletion.ts";

it.layer(Layer.merge(BunCrypto.layer, BunFileSystem.layer))("approved HTML safety completion", (it) => {
  it.effect("changes only the three source native-depth exhaustion outcomes", () =>
    Effect.gen(function* () {
      const raw = yield* (yield* FileSystem.FileSystem).readFileString(
        fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/html-cleaner-audit.json", import.meta.url))
      );
      expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
        "049bbadd90348588e2e7a1c62daf1f5dba0b6865df9f2001b9461b8b80f9cb71"
      );
      const corpus = yield* S.decodeEffect(
        S.fromJsonString(
          S.Struct({
            artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
            cases: S.Array(
              S.Struct({
                name: S.String,
                outcome: S.Union([
                  S.Struct({ kind: S.tag("success"), value: S.String }),
                  S.Struct({ kind: S.tag("error") }),
                ]).pipe(S.toTaggedUnion("kind")),
                diagnostics: S.Array(
                  S.Struct({ domain: S.String, type: S.String, level: S.String, depthLimit: S.Boolean })
                ),
              })
            ),
          })
        )
      )(raw);
      const values = HashMap.fromIterable(A.map(corpus.artifacts, (row) => [row.sha256, row.value] as const));
      let changed = 0;
      let preserved = 0;
      let parsingFailures = 0;
      for (const row of corpus.cases) {
        if (row.outcome.kind === "error") {
          parsingFailures++;
          continue;
        }
        const text = yield* Effect.fromOption(HashMap.get(values, row.outcome.value));
        const result = completeCitationHtml({ text, diagnostics: row.diagnostics }) satisfies Effect.Effect<
          string,
          CitationSafetyLimitExceeded | CitationHtmlCompletionFailure
        >;
        if (A.some(row.diagnostics, (diagnostic) => diagnostic.depthLimit)) {
          const failed = yield* Effect.flip(result);
          expect(failed._tag, row.name).toBe("CitationSafetyLimitExceeded");
          if (failed._tag === "CitationSafetyLimitExceeded") {
            expect(failed.operation).toBe("clean");
            expect(failed.limit).toBe("nativeHtmlParserResource");
          }
          changed++;
        } else {
          expect(yield* result, row.name).toBe(text);
          preserved++;
        }
      }
      expect([changed, preserved, parsingFailures]).toEqual([3, 60, 6]);
    })
  );
  it.effect("withholds partial text before accessing it and emits only closed safety fields", () =>
    Effect.gen(function* () {
      let reads = 0;
      const completion = {
        diagnostics: [{ domain: "PARSER", type: "ERR_INTERNAL_ERROR", level: "FATAL", depthLimit: true }],
        get text() {
          reads++;
          return "private partial document";
        },
        message: "private native error",
        cause: "private source",
      };
      const failed = yield* Effect.flip(completeCitationHtml(completion));
      expect(reads).toBe(0);
      expect(failed._tag).toBe("CitationSafetyLimitExceeded");
      if (failed._tag !== "CitationSafetyLimitExceeded") return yield* Effect.die("expected safety failure");
      const encoded = yield* S.encodeEffect(S.fromJsonString(CitationSafetyLimitExceeded))(failed);
      expect(encoded).not.toContain("private");
      expect(
        yield* S.decodeEffect(
          S.fromJsonString(
            S.Struct({
              _tag: S.tag("CitationSafetyLimitExceeded"),
              operation: S.tag("clean"),
              limit: S.tag("nativeHtmlParserResource"),
            })
          )
        )(encoded)
      ).toEqual({ _tag: "CitationSafetyLimitExceeded", operation: "clean", limit: "nativeHtmlParserResource" });
    })
  );
});
