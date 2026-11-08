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
  it.effect("captures an installed plan name before resolver-side request mutation", () =>
    Effect.gen(function* () {
      const proof = yield* citationFixtureSourceProof("1 Abbott’s Pr.Rep. 1");
      const selection = { plan: "quotes/v1" };
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.mutatePlan")(() =>
          Effect.sync(() => {
            selection.plan = "different-plan";
            return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
          })
        ),
      });
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const result = yield* adapter.preparePair({
        plain: { source: proof.source, sourceText: proof.sourceText },
        cleanSteps: selection,
      });
      if (result._tag !== "Extract") return yield* Effect.die("expected Extract");
      expect(result.cleanSteps).toEqual({ plan: "quotes/v1" });
      expect(selection.plan).toBe("different-plan");
    })
  );
  it.effect("rejects resolver-side identity mutation instead of changing the authorized expectation", () =>
    Effect.gen(function* () {
      const proof = yield* citationFixtureSourceProof("Alpha");
      const expected = proof.source;
      const limits = (yield* defaultCitationEnginePolicy).limits;
      for (const field of ["root", "nested"]) {
        const resolver = SourceTextResolver.of({
          resolve: Effect.fn("SourceRequestTest.mutateResolverIdentity")((request) =>
            Effect.sync(() => {
              if (field === "root")
                expect(Reflect.set(request.identity, "sourceRef", "citation-test:substituted")).toBe(true);
              else expect(Reflect.set(request.identity.extractor, "version", "substituted")).toBe(true);
              return ResolvedSourceText.make({ identity: request.identity, text: "Alpha" });
            })
          ),
        });
        const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
          Effect.provideService(SourceTextResolver, resolver)
        );
        const failure = yield* adapter
          .prepare({ source: expected, sourceText: "Alpha", role: "plain" })
          .pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "CitationPrerequisiteError",
          operation: "extract",
          dependency: "source-evidence",
        });
        expect(expected.sourceRef).toBe(proof.source.sourceRef);
        expect(expected.extractor.version).toBe(proof.source.extractor.version);
      }
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
  it.effect("snapshots both source slots and named options before either resolver call", () =>
    Effect.gen(function* () {
      const plain = yield* citationFixtureSourceProof("plain");
      const markup = yield* citationFixtureSourceProof("<p>A</p>");
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const steps = ["underscores"];
      const raw = {
        plain: { source: plain.source, sourceText: plain.sourceText },
        markup: { source: markup.source, sourceText: markup.sourceText },
        cleanSteps: steps,
      };
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.resolvePair")((request) =>
          Effect.sync(() => {
            calls++;
            const expected = calls === 1 ? plain : markup;
            expect(request.identity).toEqual(expected.source);
            raw.markup.sourceText = "mutated";
            raw.markup.source = plain.source;
            steps[0] = "html";
            return ResolvedSourceText.make({ identity: expected.source, text: expected.sourceText });
          })
        ),
      });
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const result = yield* adapter.preparePair(raw);
      expect(result._tag).toBe("Extract");
      if (result._tag !== "Extract") return yield* Effect.die("expected paired Extract");
      expect(result.role).toBe("plain");
      expect(result.source.source).toEqual(plain.source);
      expect(result.companion?.source).toEqual(markup.source);
      expect(result.companion?.sourceText).toBe("<p>A</p>");
      expect(result.cleanSteps).toEqual(["underscores"]);
      expect(calls).toBe(2);
    })
  );
  it.effect("leaves markup and options unread on the paired plain shortcut", () =>
    Effect.gen(function* () {
      const plain = yield* citationFixtureSourceProof("eyecite");
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(
          SourceTextResolver,
          fakeResolver(ResolvedSourceText.make({ identity: plain.source, text: plain.sourceText }))
        )
      );
      let reads = 0;
      const result = yield* adapter.preparePair({
        plain: { source: plain.source, sourceText: plain.sourceText },
        get markup() {
          reads++;
          return Symbol("ignored");
        },
        get cleanSteps() {
          reads++;
          return Symbol("ignored");
        },
      });
      expect(result._tag).toBe("Shortcut");
      expect(reads).toBe(0);
    })
  );
  it.effect("preflights both slots before resolving and retains supplied empty-source identity", () =>
    Effect.gen(function* () {
      const empty = yield* citationFixtureSourceProof("");
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, sourceUtf16: 5 };
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceRequestTest.resolveEmptyPair")(() =>
          Effect.sync(() => {
            calls++;
            return ResolvedSourceText.make({ identity: empty.source, text: "" });
          })
        ),
      });
      const adapter = yield* makeCitationSourceRequestAdapter(limits).pipe(
        Effect.provideService(SourceTextResolver, resolver)
      );
      const missing = yield* adapter.preparePair({}).pipe(Effect.flip);
      expect(missing._tag).toBe("CitationInputError");
      const oversized = yield* adapter
        .preparePair({
          plain: { source: empty.source, sourceText: "" },
          markup: { source: empty.source, sourceText: "longer" },
        })
        .pipe(Effect.flip);
      expect(oversized).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
      expect(calls).toBe(0);
      const retained = yield* adapter.preparePair({ markup: { source: empty.source, sourceText: "" } });
      expect(retained._tag).toBe("Extract");
      expect(retained.source.source).toEqual(empty.source);
      expect(retained.source.sourceText).toBe("");
      expect(calls).toBe(1);
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
