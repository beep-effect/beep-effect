import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { CitationAnnotationReplacement } from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import { CitationAnnotationOffsetUpdater } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { makeCitationSourceAnnotation } from "@beep/law-practice-server/internal/Citation/SourceAnnotation";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { installCitationAnnotationEntryFixture } from "./CitationAnnotationEntry.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const word = (text: string) => CitationPythonUnicodeStorage.make({ width: 1, bytes: new TextEncoder().encode(text) });
it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("verified raw-source annotation", (it) => {
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
            resolve: Effect.fn("SourceAnnotationTest.pair")(() =>
              Effect.sync(() => {
                const proof = calls++ === 0 ? plain : markup;
                request.markup.sourceText = "changed during plain resolution";
                return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
              })
            ),
          });
          const entry = yield* makeCitationSourceAnnotation(setup.limits, setup.runtime, setup.configuration).pipe(
            Effect.provideService(SourceTextResolver, resolver),
            Effect.provideContext(setup.provided)
          );
          const result = yield* entry.annotate(request);
          expect(result.text).toEqual(word("[foo <i>1 U.S. 1</i> bar]"));
          expect(S.is(VerifiedSourceText)(result.source)).toBe(true);
          expect(result.source.source).toEqual(markup.source);
          expect(result.companion?.source).toEqual(plain.source);
          expect(calls).toBe(2);
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
      const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
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
