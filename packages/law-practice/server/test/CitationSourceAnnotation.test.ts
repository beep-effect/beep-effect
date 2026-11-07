import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { CitationAnnotationOffsetUpdater } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { makeCitationAnnotationOperation } from "@beep/law-practice-server/internal/Citation/AnnotationOperation";
import { makeCitationSourceAnnotation } from "@beep/law-practice-server/internal/Citation/SourceAnnotation";
import {
  CitationAnnotationReplacement,
  CitationEngineAnnotationResult,
  CitationPythonUnicodeStorage,
} from "@beep/law-practice-use-cases/server";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { installCitationAnnotationEntryFixture } from "./CitationAnnotationEntry.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";
import type { CitationSourceAnnotationResult } from "@beep/law-practice-server/internal/Citation/SourceAnnotation";
import type { CitationEngineFailure } from "@beep/law-practice-use-cases/server";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("verified raw-source annotation", (it) => {
  it.effect("closes deferred callback join failures after preserving subsequent callback calls", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationAnnotationEntryFixture();
      const proof = yield* citationFixtureSourceProof("abc");
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceAnnotationTest.callbackSource")(() =>
          Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: "abc" }))
        ),
      });
      const callback = CitationAnnotationAnnotator.of({
        annotate: Effect.fn("SourceAnnotationTest.nonText")((_before, span) =>
          Effect.sync(() =>
            ++calls === 1
              ? CitationAnnotationCallbackResult.cases.NonText.make({})
              : CitationAnnotationCallbackResult.cases.Text.make({ text: span })
          )
        ),
      });
      const entry = yield* makeCitationSourceAnnotation(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideService(SourceTextResolver, resolver),
        Effect.provideService(CitationAnnotationAnnotator, callback),
        Effect.provideContext(setup.provided)
      );
      const replacements = [
        CitationAnnotationReplacement.make({ start: 0, end: 1, before: word(""), after: word("") }),
        CitationAnnotationReplacement.make({ start: 1, end: 2, before: word(""), after: word("") }),
      ];
      const result = yield* entry
        .annotate({ plain: { source: proof.source, sourceText: "abc" }, replacements })
        .pipe(Effect.flip);
      expect(result).toMatchObject({ _tag: "CitationAnnotationError", operation: "annotate" });
      expect(calls).toBe(2);
      expect("reason" in result).toBe(false);
      const state = yield* setup.operation.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
  for (const kind of ["bun", "node"] as const) {
    it.effect(
      `verifies both source slots and maps original HTML on ${kind}`,
      () =>
        Effect.gen(function* () {
          const setup = yield* installCitationAnnotationEntryFixture(kind);
          const plain = yield* citationFixtureSourceProof("foo 1 U.S. 1 bar");
          const markup = yield* citationFixtureSourceProof("foo <i>1 U.S. 1</i> bar");
          const request = {
            plain: { source: plain.source, sourceText: plain.sourceText },
            markup: { source: markup.source, sourceText: markup.sourceText },
            replacements: [
              CitationAnnotationReplacement.make({ start: 0, end: 16, before: word("["), after: word("]") }),
            ],
          };
          let calls = 0;
          const resolver = SourceTextResolver.of({
            resolve: Effect.fn("SourceAnnotationTest.pair")((lookup) =>
              Effect.sync(() => {
                const proof = S.toEquivalence(SourceTextIdentity)(lookup.identity, plain.source) ? plain : markup;
                calls++;
                request.markup.sourceText = "changed during plain resolution";
                return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
              })
            ),
          });
          const artifact = Sha256Hex.make(Str.repeat(64)("a"));
          const policy = { ...setup.limits };
          const entry = yield* makeCitationAnnotationOperation(
            policy,
            setup.runtime,
            setup.configuration,
            artifact
          ).pipe(Effect.provideService(SourceTextResolver, resolver), Effect.provideContext(setup.provided));
          expect(Reflect.set(policy, "producedTextUtf16", 1)).toBe(true);
          const invocation = entry.annotate({ ...request, engineArtifact: "ignored", limits: null });
          const closed: Effect.Effect<CitationEngineAnnotationResult, CitationEngineFailure> = invocation;
          const result = yield* closed;
          expect(S.is(CitationEngineAnnotationResult)(result)).toBe(true);
          expect(result.report).toMatchObject({ operation: "annotate", engineArtifact: artifact, extraction: null });
          expect(result.report.limits.producedTextUtf16).toBe(setup.limits.producedTextUtf16);
          expect(result.report.producedTextUtf16).toBeGreaterThan(0);
          expect(result.text).toEqual(word("[foo <i>1 U.S. 1</i> bar]"));
          expect(S.is(VerifiedSourceText)(result.source)).toBe(true);
          expect(result.source.source).toEqual(markup.source);
          expect(result.companion?.source).toEqual(plain.source);
          expect(calls).toBe(2);
          const originalDeadline = Duration.toMillis(result.report.limits.annotateDeadline);
          expect(Reflect.set(result.report.limits.annotateDeadline.value, "millis", 1)).toBe(true);
          const afterReportMutation = yield* entry.annotate({
            plain: { source: plain.source, sourceText: plain.sourceText },
            markup: { source: markup.source, sourceText: markup.sourceText },
            replacements: request.replacements,
          });
          expect(Duration.toMillis(afterReportMutation.report.limits.annotateDeadline)).toBe(originalDeadline);
          expect(afterReportMutation.text).toEqual(result.text);
          const exits = yield* setup.observed.snapshot;
          expect(exits.spawned).toBeGreaterThan(0);
          expect(exits.confirmed).toBe(exits.spawned);
        }),
      { timeout: 120000 }
    );
  }
  it.effect("a supplied updater verifies empty markup without reading the ignored plain slot", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationAnnotationEntryFixture();
      const proof = yield* citationFixtureSourceProof("");
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceAnnotationTest.empty")(() =>
          Effect.succeed(ResolvedSourceText.make({ identity: proof.source, text: "" }))
        ),
      });
      const updater = CitationAnnotationOffsetUpdater.of({
        update: Effect.fn("SourceAnnotationTest.update")(() => Effect.succeed(0)),
      });
      const entry = yield* makeCitationSourceAnnotation(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideService(SourceTextResolver, resolver),
        Effect.provideService(CitationAnnotationOffsetUpdater, updater),
        Effect.provideContext(setup.provided)
      );
      const result = yield* entry.annotate({
        markup: { source: proof.source, sourceText: "" },
        get plain() {
          throw new Error("ignored plain slot");
        },
        replacements: [],
      });
      expect(result.text).toEqual(word(""));
      expect(S.is(VerifiedSourceText)(result.source)).toBe(true);
      expect(result.companion).toBeNull();
    })
  );
  it.effect("admits before resolution, snapshots replacements and returns genuine source evidence", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationAnnotationEntryFixture();
      const proof = yield* citationFixtureSourceProof("abc");
      const before = word("[");
      const replacements = [CitationAnnotationReplacement.make({ start: 1, end: 2, before, after: word("]") })];
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceAnnotationTest.resolve")(function* () {
          const state = yield* setup.operation.snapshot;
          expect(state.active).toBe(1);
          calls++;
          before.bytes[0] = 88;
          replacements.length = 0;
          return ResolvedSourceText.make({ identity: proof.source, text: "abc" });
        }),
      });
      const entry = yield* makeCitationSourceAnnotation(setup.limits, setup.runtime, setup.configuration).pipe(
        Effect.provideService(SourceTextResolver, resolver),
        Effect.provideContext(setup.provided)
      );
      const invocation = entry.annotate({ plain: { source: proof.source, sourceText: "abc" }, replacements });
      const closed: Effect.Effect<CitationSourceAnnotationResult, CitationEngineFailure> = invocation;
      const result = yield* closed;
      expect(result.text).toEqual(word("a[b]c"));
      expect(S.is(VerifiedSourceText)(result.source)).toBe(true);
      expect(result.source.sourceText).toBe("abc");
      expect(result.companion).toBeNull();
      expect(calls).toBe(1);
      const state = yield* setup.operation.snapshot;
      expect(state).toMatchObject({ active: 0, queued: 0 });
    })
  );
  it.effect("rejects mismatched evidence and over-limit text without rendering or native work", () =>
    Effect.gen(function* () {
      const setup = yield* installCitationAnnotationEntryFixture();
      const proof = yield* citationFixtureSourceProof("abc");
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceAnnotationTest.count")(() =>
          Effect.sync(() => {
            calls++;
            return ResolvedSourceText.make({ identity: proof.source, text: "abc" });
          })
        ),
      });
      const entry = yield* makeCitationSourceAnnotation(
        { ...setup.limits, sourceUtf16: 3 },
        setup.runtime,
        setup.configuration
      ).pipe(Effect.provideService(SourceTextResolver, resolver), Effect.provideContext(setup.provided));
      const over = yield* entry
        .annotate({ plain: { source: proof.source, sourceText: "abcd" }, replacements: [] })
        .pipe(Effect.flip);
      expect(over).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "annotate", limit: "sourceUtf16" });
      expect(calls).toBe(0);
      const mismatch = yield* entry
        .annotate({ plain: { source: proof.source, sourceText: "xyz" }, replacements: [] })
        .pipe(Effect.flip);
      expect(mismatch).toMatchObject({ _tag: "CitationInputError", operation: "annotate" });
      expect(calls).toBe(1);
      const exits = yield* setup.observed.snapshot;
      expect(exits).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
});
