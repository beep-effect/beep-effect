import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationAnnotationReplacement } from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import {
  CitationAnnotationEntryConfiguration,
  CitationAnnotationOffsetUpdater,
  makeCitationAnnotationEntry,
} from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { CitationHtmlDiscoveryConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { CitationHtmlGeometryPreparationConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlGeometryPreparation";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import { CitationAnnotationReplayReplacement } from "./CitationAnnotationReplay.fixtures.ts";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { readCitationOracleFixture, setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import { makeCitationXmlTestRuntime } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationAnnotationEntry");
const Corpus = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        source: CitationNativeUnicodeHex,
        input: S.Array(CitationAnnotationReplayReplacement),
        result: CitationNativeUnicodeHex,
      })
    ),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original unchecked annotation observations exercised through the admitted operation.",
  })
);
const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
const install = Effect.fn("AnnotationEntryTest.install")(function* (kind: CitationNativeRuntimeKind = "bun") {
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, false);
  const discovery = yield* readCitationHtmlDiscoveryCorpus();
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-entry-diff-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, cwd);
  const xmlRuntime = yield* makeCitationXmlTestRuntime(kind);
  const configuration = CitationAnnotationEntryConfiguration.make({
    geometry: CitationHtmlGeometryPreparationConfiguration.make({
      discovery: CitationHtmlDiscoveryConfiguration.make(discovery.configuration),
      diffRuntime,
    }),
    xmlRuntime,
  });
  return { ...setup, configuration };
});
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("admitted annotation entry", (it) => {
  for (const kind of ["bun", "node"] as const) {
    it.effect(
      `composes original markup modes and retires real workers on ${kind}`,
      () =>
        Effect.gen(function* () {
          const setup = yield* install(kind);
          const entry = yield* makeCitationAnnotationEntry(setup.limits, setup.runtime, setup.configuration).pipe(
            Effect.provideContext(setup.provided)
          );
          const source = word("<i>Foo</i>");
          const balanced = CitationAnnotationReplacement.make({
            start: 0,
            end: 10,
            before: word("<a>"),
            after: word("</a>"),
          });
          const skip = yield* entry.annotate({ mode: "skip", plain: source, replacements: [balanced] });
          expect(skip.text).toEqual(word("<a><i>Foo</i></a>"));
          // Pinned annotation-wrap-composition case 20: an unbalanced interior slice.
          const partial = CitationAnnotationReplacement.make({ start: 1, end: 9, before: word("["), after: word("]") });
          const wrap = yield* entry.annotate({ mode: "wrap", plain: source, replacements: [partial] });
          expect(wrap.text).toEqual(word("<[i>Foo</i]>"));
          const exits = yield* setup.observed.snapshot;
          const admission = yield* setup.operation.snapshot;
          expect(exits).toEqual({ spawned: 3, confirmed: 3 });
          expect(admission).toMatchObject({ active: 0, queued: 0 });
          // Pinned annotation-mapping case 0: sort/map against original HTML.
          const mapped = yield* entry.annotate({
            plain: word("foo 1 U.S. 1 bar"),
            source: word("foo <i>1 U.S. 1</i> bar"),
            replacements: [
              CitationAnnotationReplacement.make({ start: 0, end: 16, before: word("["), after: word("]") }),
            ],
          });
          expect(mapped.text).toEqual(word("[foo <i>1 U.S. 1</i> bar]"));
          const mappedExits = yield* setup.observed.snapshot;
          expect(mappedExits.spawned).toBeGreaterThan(exits.spawned);
          expect(mappedExits.confirmed).toBe(mappedExits.spawned);
        }),
      { timeout: 120000 }
    );
  }
  it.effect("replays all 214 original unchecked outcomes with fresh per-call work ownership", () =>
    Effect.gen(function* () {
      const setup = yield* install();
      const entry = yield* makeCitationAnnotationEntry(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideContext(setup.provided)
      );
      const corpus = yield* readCitationOracleFixture(
        "annotation-assembly",
        "75a32d0456d6ff8e1237a5413f0a007eeb5cb29e6ce6fd7d6e54e0bb67722ecb"
      ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
      for (const row of corpus.cases) {
        const replacements = A.map(row.input, (replacement) =>
          CitationAnnotationReplacement.make({
            ...replacement,
            before: CitationPythonUnicodeStorage.make(replacement.before),
            after: CitationPythonUnicodeStorage.make(replacement.after),
          })
        );
        const request = { plain: row.source, replacements };
        const first = yield* entry.annotate(request);
        const second = yield* entry.annotate(request);
        expect(first.text).toEqual(row.result);
        expect(second).toEqual(first);
      }
      const admission = yield* setup.operation.snapshot;
      const exits = yield* setup.observed.snapshot;
      expect(admission).toMatchObject({ active: 0, queued: 0 });
      expect(exits).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("validates mode before ignored fields and preserves the installed callback and invocation budget", () =>
    Effect.gen(function* () {
      const setup = yield* install();
      let calls = 0;
      const callback = CitationAnnotationAnnotator.of({
        annotate: Effect.fn("AnnotationEntryTest.callback")(function* (_before, _span, _after, work) {
          calls++;
          yield* work.reserve(1);
          return CitationAnnotationCallbackResult.cases.Text.make({ text: word("Z") });
        }),
      });
      const entry = yield* makeCitationAnnotationEntry(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideService(CitationAnnotationAnnotator, callback),
        Effect.provideContext(setup.provided)
      );
      const invalid = yield* entry
        .annotate({
          mode: "invalid",
          get plain() {
            throw new Error("must remain unread");
          },
        })
        .pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "invalid-input" });
      const request = {
        plain: word("abc"),
        replacements: [CitationAnnotationReplacement.make({ start: 1, end: 2, before: word("<"), after: word(">") })],
      };
      const later = CitationAnnotationAnnotator.of({
        annotate: Effect.fn("AnnotationEntryTest.later")(() => Effect.die("later service must remain unused")),
      });
      const first = yield* entry.annotate(request).pipe(Effect.provideService(CitationAnnotationAnnotator, later));
      const second = yield* entry.annotate(request);
      expect(first.text).toEqual(word("aZc"));
      expect(second).toEqual(first);
      expect(calls).toBe(2);
    })
  );
  it.effect("selects empty supplied source without reading plain text or creating map workers", () =>
    Effect.gen(function* () {
      const setup = yield* install();
      const updater = CitationAnnotationOffsetUpdater.of({
        update: Effect.fn("AnnotationEntryTest.update")(() => Effect.succeed(0)),
      });
      const entry = yield* makeCitationAnnotationEntry(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideService(CitationAnnotationOffsetUpdater, updater),
        Effect.provideContext(setup.provided)
      );
      const result = yield* entry.annotate({
        get plain() {
          throw new Error("ignored plain text");
        },
        replacements: [],
      });
      expect(result.text).toEqual(word(""));
      const exits = yield* setup.observed.snapshot;
      expect(exits).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
});
