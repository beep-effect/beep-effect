import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { makeCitationSourceRequestAdapter } from "@beep/law-practice-server/internal/Citation/SourceRequest";
import { CitationEngineFailure } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const FailureJson = S.fromJsonString(CitationEngineFailure);
const encodeFailure = S.encodeEffect(FailureJson);
const fakeResolver = (result: ResolvedSourceText) =>
  SourceTextResolver.of({
    resolve: Effect.fn("SourceRequestTest.resolve")(() => Effect.succeed(result)),
  });
it.layer(citationTokenizerTestLayer)("canonical single-source request adapter", (it) => {
  it.effect("captures identity, raw text and named options before the resolver can mutate caller data", () =>
    Effect.gen(function* () {
      const original = yield* citationFixtureSourceProof("__A__");
      const other = yield* citationFixtureSourceProof("other");
      const steps = ["underscores"];
      const raw = {
        source: original.source,
        sourceText: "__A__",
        role: "plain",
        cleanSteps: steps,
        container: "tuple",
      };
      const limits = (yield* defaultCitationEnginePolicy).limits;
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.mutatingResolve")((request) =>
          Effect.sync(() => {
            calls++;
            expect(request.identity).toEqual(original.source);
            raw.source = other.source;
            raw.sourceText = "changed";
            raw.container = "generator";
            steps[0] = "html";
            return ResolvedSourceText.make({ identity: original.source, text: "__A__" });
          })
        ),
      });
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const invocation = adapter.prepare(raw);
      const closed: Effect.Effect<Effect.Success<typeof invocation>, CitationEngineFailure> = invocation;
      const result = yield* closed;
      expect(result._tag).toBe("Extract");
      if (result._tag !== "Extract") return yield* Effect.die("expected Extract");
      expect(S.is(VerifiedSourceText)(result.source)).toBe(true);
      expect(result.source.source).toEqual(original.source);
      expect(result.source.sourceText).toBe("__A__");
      expect(result.cleanSteps).toEqual(["underscores"]);
      expect(result.container).toBe("tuple");
      expect(result.removeAmbiguous).toBe(false);
      expect(calls).toBe(1);
    })
  );
  it.effect("leaves all shortcut-ignored options unread while independently verifying the source", () =>
    Effect.gen(function* () {
      const source = yield* citationFixtureSourceProof("eyecite");
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(
          SourceTextResolver,
          fakeResolver(ResolvedSourceText.make({ identity: source.source, text: "eyecite" }))
        )
      );
      let ignored = 0;
      const result = yield* adapter.prepare({
        source: source.source,
        sourceText: "eyecite",
        get cleanSteps() {
          ignored++;
          return Symbol("ignored");
        },
        get container() {
          ignored++;
          return Symbol("ignored");
        },
        get removeAmbiguous() {
          ignored++;
          return Symbol("ignored");
        },
      });
      expect(result._tag).toBe("Shortcut");
      expect(result.source.sourceText).toBe("eyecite");
      expect(ignored).toBe(0);
    })
  );
  it.effect("refuses over-limit caller text before resolution and mismatched or oversized resolver output", () =>
    Effect.gen(function* () {
      const source = yield* citationFixtureSourceProof("Alpha");
      const other = yield* citationFixtureSourceProof("Beta");
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 5 };
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.countedResolve")(() =>
          Effect.sync(() => {
            calls++;
            return ResolvedSourceText.make({ identity: source.source, text: "Alpha" });
          })
        ),
      });
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const oversized = yield* adapter.prepare({ source: source.source, sourceText: "longer" }).pipe(Effect.flip);
      expect(oversized).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
      expect(calls).toBe(0);
      const wrongText = yield* adapter.prepare({ source: source.source, sourceText: "Beta" }).pipe(Effect.flip);
      expect(wrongText._tag).toBe("CitationInputError");
      const wrongSource = yield* adapter.prepare({ source: other.source, sourceText: "Beta" }).pipe(Effect.flip);
      expect(wrongSource).toMatchObject({ _tag: "CitationPrerequisiteError", dependency: "source-evidence" });
      const large = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(
          SourceTextResolver,
          fakeResolver(ResolvedSourceText.make({ identity: source.source, text: "longer" }))
        )
      );
      const response = yield* large.prepare({ source: source.source, sourceText: "Alpha" }).pipe(Effect.flip);
      expect(response).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
    })
  );
  it.effect("redacts resolver messages and nested causes into the prerequisite failure", () =>
    Effect.gen(function* () {
      const source = yield* citationFixtureSourceProof("Alpha");
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.failedResolve")(() =>
          Effect.fail(SourceTextResolverError.new("source-unavailable", "private path Alpha", { privateText: "Alpha" }))
        ),
      });
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const failure = yield* adapter.prepare({ source: source.source, sourceText: "Alpha" }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationPrerequisiteError", dependency: "source-evidence" });
      expect("cause" in failure).toBe(false);
      const json = yield* encodeFailure(failure);
      expect(json).not.toContain("Alpha");
      expect(json).not.toContain("private");
    })
  );
  it.layer(TestClock.layer())("captured deadline", (it) => {
    it.effect("interrupts a stalled resolver with a closed safety failure", () =>
      Effect.gen(function* () {
        const source = yield* citationFixtureSourceProof("Alpha");
        const limits = { ...(yield* defaultCitationEnginePolicy).limits, extractDeadline: Duration.millis(5) };
        const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
          Effect.provideService(
            SourceTextResolver,
            SourceTextResolver.of({ resolve: Effect.fn("SourceRequestTest.stalledResolve")(() => Effect.never) })
          )
        );
        const fiber = yield* Effect.forkChild(adapter.prepare({ source: source.source, sourceText: "Alpha" }));
        yield* TestClock.adjust(Duration.millis(6));
        const failure = yield* Fiber.join(fiber).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
      })
    );
  });
});
