import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import { CitationRegexOperation } from "@beep/law-practice-server/internal/Citation/RegexPolicy";
import { makeCitationSourceEvidence } from "@beep/law-practice-server/internal/Citation/SourceEvidence";
import { CitationEngineFailure } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const FailureJson = S.fromJsonString(CitationEngineFailure);
it.layer(citationTokenizerTestLayer)("operation-neutral canonical source evidence", (it) => {
  it.effect("verifies annotation text without applying the extraction shortcut and captures the resolver", () =>
    Effect.gen(function* () {
      const proof = yield* citationFixtureSourceProof("eyecite");
      const limits = (yield* defaultCitationEnginePolicy).limits;
      const raw = { source: proof.source, sourceText: "eyecite" };
      let calls = 0;
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceEvidenceTest.resolve")(() =>
          Effect.sync(() => {
            calls++;
            raw.sourceText = "changed";
            return ResolvedSourceText.make({ identity: proof.source, text: "eyecite" });
          })
        ),
      });
      const installed = yield* makeCitationSourceEvidence(limits).pipe(
        Effect.provideService(CitationRegexOperation, "annotate"),
        Effect.provideService(SourceTextResolver, resolver)
      );
      const replacement = SourceTextResolver.of({
        resolve: Effect.fn("SourceEvidenceTest.replaced")(() =>
          Effect.fail(SourceTextResolverError.new("source-unavailable", "unused"))
        ),
      });
      const invocation = installed.resolve(raw).pipe(Effect.provideService(SourceTextResolver, replacement));
      const closed: Effect.Effect<VerifiedSourceText, CitationEngineFailure> = invocation;
      const result = yield* closed;
      expect(S.is(VerifiedSourceText)(result)).toBe(true);
      expect(result.sourceText).toBe("eyecite");
      expect(result.source).toEqual(proof.source);
      expect(calls).toBe(1);
    })
  );
  it.effect("retains annotation failure labels, early size admission and source-free refusals", () =>
    Effect.gen(function* () {
      const alpha = yield* citationFixtureSourceProof("Alpha");
      const beta = yield* citationFixtureSourceProof("Beta");
      const defaults = (yield* defaultCitationEnginePolicy).limits;
      let calls = 0;
      let returned = ResolvedSourceText.make({ identity: alpha.source, text: "Alpha" });
      const resolver = SourceTextResolver.of({
        resolve: Effect.fn("SourceEvidenceTest.counted")(() =>
          Effect.sync(() => {
            calls++;
            return returned;
          })
        ),
      });
      const install = (sourceUtf16: number) =>
        makeCitationSourceEvidence({ ...defaults, sourceUtf16 }).pipe(
          Effect.provideService(SourceTextResolver, resolver),
          Effect.provideService(CitationRegexOperation, "annotate")
        );
      const small = yield* install(4);
      const tooLarge = yield* small.resolve({ source: alpha.source, sourceText: "Alpha" }).pipe(Effect.flip);
      expect(tooLarge).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "annotate",
        limit: "sourceUtf16",
      });
      expect(calls).toBe(0);
      const installed = yield* install(5);
      const mismatch = yield* installed.resolve({ source: alpha.source, sourceText: "Beta" }).pipe(Effect.flip);
      expect(mismatch).toMatchObject({ _tag: "CitationInputError", operation: "annotate" });
      returned = ResolvedSourceText.make({ identity: beta.source, text: "Beta" });
      const stale = yield* installed.resolve({ source: alpha.source, sourceText: "Beta" }).pipe(Effect.flip);
      expect(stale).toMatchObject({
        _tag: "CitationPrerequisiteError",
        operation: "annotate",
        dependency: "source-evidence",
      });
      const json = yield* S.encodeEffect(FailureJson)(stale);
      expect(json).not.toContain("Alpha");
      expect(json).not.toContain("Beta");
      expect("cause" in stale).toBe(false);
    })
  );
  it.layer(TestClock.layer())("isolated clock: 98", (it) => {
    it.effect("captures annotation timing while the canonical resolver is pending", () =>
      Effect.gen(function* () {
        const proof = yield* citationFixtureSourceProof("Alpha");
        const defaults = (yield* defaultCitationEnginePolicy).limits;
        const entered = yield* Deferred.make<void>();
        const done = yield* Ref.make(false);
        const resolver = SourceTextResolver.of({
          resolve: Effect.fn("SourceEvidenceTest.block")(() =>
            Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))
          ),
        });
        const installed = yield* makeCitationSourceEvidence({
          ...defaults,
          extractDeadline: Duration.millis(1),
          annotateDeadline: Duration.millis(50),
        }).pipe(
          Effect.provideService(SourceTextResolver, resolver),
          Effect.provideService(CitationRegexOperation, "annotate")
        );
        const pending = yield* installed
          .resolve({ source: proof.source, sourceText: "Alpha" })
          .pipe(
            Effect.provideService(CitationRegexOperation, "extract"),
            Effect.flip,
            Effect.ensuring(Ref.set(done, true)),
            Effect.forkChild
          );
        yield* Deferred.await(entered);
        yield* TestClock.adjust(Duration.millis(1));
        const early = yield* Ref.get(done);
        expect(early).toBe(false);
        yield* TestClock.adjust(Duration.millis(49));
        const error = yield* Fiber.join(pending);
        expect(error).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          operation: "annotate",
          limit: "annotateDeadline",
        });
      })
    );
  });
});
