import * as NodeURL from "node:url";
import { ResolvedSourceText, SourceTextResolver, SourceTextResolverError } from "@beep/file-processing/SourceText";
import {
  CourtReporterArtifact,
  CourtReporterArtifactVersion,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationExtractorConfiguration, CitationExtractorLive } from "@beep/law-practice-server/layer";
import {
  CitationExtractor,
  CitationExtractorFailure,
  CitationExtractorInput,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import {
  makeCitationBundledTestRuntime,
  makeCitationNativeSleepClock,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const refusedResolver = SourceTextResolver.of({
  resolve: Effect.fn("ExtractorControls.resolve")(() =>
    Effect.fail(SourceTextResolverError.new("source-unavailable", "PRIVATE-RESOLVER-SENTINEL"))
  ),
});
const fixture = Effect.fnUntraced(function* (
  text: string,
  options: {
    readonly limits?: Partial<CitationEngineLimits>;
    readonly entry?: URL;
    readonly resolver?: SourceTextResolver["Service"];
    readonly wrongRuntime?: boolean;
    readonly wrongVocabulary?: boolean;
  } = {}
) {
  const source = yield* citationFixtureSourceProof(text);
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-extractor-controls-" });
  const runtime = yield* makeCitationBundledTestRuntime(
    "bun",
    NodeURL.fileURLToPath(
      options.entry ?? new URL("../src/internal/Citation/RecognizerWorker.entry.ts", import.meta.url)
    ),
    cwd
  );
  const observed = yield* makeCitationObservedSpawner();
  const limits = { ...(yield* defaultCitationEnginePolicy).limits, ...options.limits };
  const implementation = yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode("extractor-controls"));
  const resolver =
    options.resolver ??
    SourceTextResolver.of({
      resolve: Effect.fn("ExtractorControls.resolve")(() =>
        Effect.succeed(ResolvedSourceText.make({ identity: source.source, text: source.sourceText }))
      ),
    });
  const configuration = CitationExtractorConfiguration.make({
    runtime,
    installation: {
      implementation,
      runtime: { kind: options.wrongRuntime === true ? "node" : "bun", version: Bun.version },
      limits,
      vocabularyVersion:
        options.wrongVocabulary === true
          ? CourtReporterArtifactVersion.make("uninstalled-artifact")
          : Result.getOrThrow(CourtReporterArtifact).artifactVersion,
    },
  });
  const context = yield* Layer.build(CitationExtractorLive(configuration)).pipe(
    Effect.provideService(SourceTextResolver, resolver),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  const extractor = Context.get(context, CitationExtractor);
  const input = CitationExtractorInput.make({ source: source.source, sourceText: source.sourceText });
  return { extractor, input, fs, cwd, limits, snapshot: observed.snapshot };
});
const expectPrivateFailure = Effect.fnUntraced(function* (failure: CitationExtractorFailure, cwd: string) {
  const encoded = yield* S.encodeEffect(S.fromJsonString(CitationExtractorFailure))(failure);
  expect(encoded).not.toContain("PRIVATE");
  expect(encoded).not.toContain(cwd);
  expect(encoded).not.toContain("35 U.S.C.");
});
const expectPhysical = Effect.fnUntraced(function* (
  snapshot: Effect.Effect<{ readonly spawned: number; readonly confirmed: number }>,
  count: number
) {
  const physical = yield* snapshot;
  expect(physical).toEqual({ spawned: count, confirmed: count });
});
const testLayer = Layer.mergeAll(BunServices.layer, BunCrypto.layer, BunCrypto.layerDigest);
it.layer(testLayer, { excludeTestServices: true })("public extractor refusal controls", (it) => {
  it.effect("refuses inconsistent runtime and vocabulary installations before exposing a service", () =>
    Effect.gen(function* () {
      for (const options of [{ wrongRuntime: true }, { wrongVocabulary: true }]) {
        const failure = yield* fixture("35 U.S.C. 101", options).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
        expect(failure).not.toHaveProperty("cause");
      }
    })
  );
  it.effect("redacts a resolver defect and preserves resolver interruption before spawning", () =>
    Effect.gen(function* () {
      const defective = yield* fixture("35 U.S.C. 101", {
        resolver: SourceTextResolver.of({
          resolve: Effect.fn("ExtractorControls.defect")(() => Effect.die("PRIVATE-RESOLVER-DEFECT")),
        }),
      });
      const failure = yield* defective.extractor.extract(defective.input).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognitionError", reason: "transport-failed" });
      yield* expectPrivateFailure(failure, defective.cwd);
      yield* expectPhysical(defective.snapshot, 0);
      const interrupted = yield* fixture("35 U.S.C. 101", {
        resolver: SourceTextResolver.of({ resolve: Effect.fn("ExtractorControls.interrupt")(() => Effect.interrupt) }),
      });
      const exit = yield* interrupted.extractor.extract(interrupted.input).pipe(Effect.exit);
      expect(Exit.hasInterrupts(exit)).toBe(true);
      yield* expectPhysical(interrupted.snapshot, 0);
    })
  );
  it.effect("refuses caller text mismatch before parser spawn", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101");
      const failure = yield* control.extractor
        .extract(CitationExtractorInput.make({ ...control.input, sourceText: "PRIVATE-MISMATCH" }))
        .pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
      yield* expectPhysical(control.snapshot, 0);
      yield* expectPrivateFailure(failure, control.cwd);
    })
  );
  it.effect("refuses unavailable canonical source evidence before parser spawn", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101", { resolver: refusedResolver });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "CitationPrerequisiteError",
        operation: "extract",
        dependency: "source-evidence",
      });
      yield* expectPhysical(control.snapshot, 0);
      yield* expectPrivateFailure(failure, control.cwd);
    })
  );
  for (const limit of ["candidates", "mentions", "authorities", "producedTextUtf16"] as const) {
    it.effect(`${limit} exhaustion refuses the complete public result after physical retirement`, () =>
      Effect.gen(function* () {
        const control = yield* fixture("35 U.S.C. 101; 35 U.S.C. 102", { limits: { [limit]: 1 } });
        const outcome = yield* control.extractor.extract(control.input).pipe(Effect.result);
        expect(Result.isFailure(outcome)).toBe(true);
        const failure = outcome.pipe(Result.getFailure, O.getOrThrow);
        expect(failure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", operation: "extract", limit });
        yield* expectPhysical(control.snapshot, 1);
      })
    );
  }
  it.effect("refuses aggregate evidence even when every original-source quote fits individually", () =>
    Effect.gen(function* () {
      const text = "35 U.S.C. 101";
      // Every verified slice is bounded by the original source, so each fits this
      // ceiling. The primary plus component slices together exceed it.
      const control = yield* fixture(text, { limits: { producedTextUtf16: Str.length(text) } });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "producedTextUtf16",
      });
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("keeps a blank-page case and the rest of the document as verified occurrences", () =>
    Effect.gen(function* () {
      const control = yield* fixture("Foo v. Bar, 123 U.S. ___ (2020). 35 U.S.C. 101.");
      const result = yield* control.extractor.extract(control.input);
      expect(result.document.mentions).toHaveLength(2);
      const first = O.getOrThrow(O.fromUndefinedOr(result.document.mentions[0]));
      expect(first.citation.type).toBe("case");
      expect(first.citation.components.page).toEqual(O.none());
      expect(result.report.outsideProfile).toBe(0);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("does not link Id past an intervening outside-profile citation", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101; 42 U.S.C. 1983; Id.");
      const result = yield* control.extractor.extract(control.input);
      expect(result.document.mentions).toHaveLength(2);
      expect(result.report.outsideProfile).toBe(1);
      expect(result.document.resolutions[1]?.status).toBe("Unresolved");
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  for (const [text, expected] of [
    ["42 U.S.C. 1983; 35 U.S.C. 101; Id.", ["Resolved", "Resolved"]],
    ["35 U.S.C. 101; Id.; 42 U.S.C. 1983", ["Resolved", "Resolved"]],
    ["35 U.S.C. 101; 42 U.S.C. 1983; Id.; Id.", ["Resolved", "Unresolved", "Unresolved"]],
    ["35 U.S.C. 101; 42 U.S.C. 1983; 35 U.S.C. 102; Id.", ["Resolved", "Resolved", "Resolved"]],
  ] as const) {
    it.effect(`retains source-order predecessor semantics: ${text}`, () =>
      Effect.gen(function* () {
        const control = yield* fixture(text);
        const result = yield* control.extractor.extract(control.input);
        expect(A.map(result.document.resolutions, (value) => value.status)).toEqual(expected);
        expect(result.report.outsideProfile).toBe(1);
        yield* expectPhysical(control.snapshot, 1);
      })
    );
  }
  it.effect("maps a typed child parser failure to a closed public refusal after retirement", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101", {
        entry: new URL("./CitationRecognizerFailure.entry.ts", import.meta.url),
      });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognitionError", reason: "parser-failed" });
      yield* expectPrivateFailure(failure, control.cwd);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("refuses a schema-valid child observation outside the canonical source after physical retirement", () =>
    Effect.gen(function* () {
      const control = yield* fixture("Id.", {
        entry: new URL("./CitationRecognizerFailure.entry.ts", import.meta.url),
      });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognitionError", reason: "invalid-observation" });
      expect(failure).not.toHaveProperty("cause");
      expect(failure).not.toHaveProperty("input");
      yield* expectPrivateFailure(failure, control.cwd);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("preserves a backend source-limit refusal for an admitted request without publishing a result", () =>
    Effect.gen(function* () {
      const control = yield* fixture("PRIVATE-BACKEND-SOURCE-LIMIT", {
        entry: new URL("./CitationRecognizerFailure.entry.ts", import.meta.url),
      });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "sourceUtf16",
      });
      expect(failure).not.toHaveProperty("document");
      expect(failure).not.toHaveProperty("report");
      expect(failure).not.toHaveProperty("cause");
      yield* expectPrivateFailure(failure, control.cwd);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("maps a real late worker diagnostic to a source-free public refusal after retirement", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101", {
        entry: new URL("./CitationRecognizerLateWarning.entry.ts", import.meta.url),
      });
      const failure = yield* control.extractor.extract(control.input).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognitionError", reason: "transport-failed" });
      yield* expectPrivateFailure(failure, control.cwd);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.effect("captures source resolution and Digest at construction and exposes a closed extraction", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101");
      const closed: Effect.Effect<
        Effect.Success<ReturnType<typeof control.extractor.extract>>,
        CitationExtractorFailure
      > = control.extractor.extract(control.input);
      const digest = makeTestCitationDigest(
        Effect.fn("ExtractorControls.refusedDigest")(() => Effect.die("caller Digest used"))
      );
      const output = yield* closed.pipe(
        Effect.provideService(SourceTextResolver, refusedResolver),
        Effect.provideService(Digest.Digest, digest)
      );
      expect(output.report.recognizedMentions).toBe(1);
      expect(output.document.mentions).toHaveLength(1);
      yield* expectPhysical(control.snapshot, 1);
    })
  );
  it.layer(TestClock.layer())("captured supervision", (it) => {
    it.effect("uses the captured Clock and returns capacity after deadline and cancellation", () =>
      Effect.gen(function* () {
        const control = yield* fixture("35 U.S.C. 101", {
          entry: new URL("./CitationRecognizerBlocked.entry.ts", import.meta.url),
          limits: { concurrentOperations: 1, concurrentRegexProcesses: 1 },
        });
        const path = yield* Path.Path;
        const marker = path.join(control.cwd, "started");
        const callerClock = yield* makeCitationNativeSleepClock(() => Effect.never);
        const invoke = control.extractor.extract(control.input).pipe(Effect.provideService(Clock.Clock, callerClock));
        const started = Effect.repeat(control.fs.exists(marker), { until: (ready) => ready });
        const first = yield* invoke.pipe(Effect.forkChild);
        yield* started;
        yield* TestClock.adjust(control.limits.extractDeadline);
        const failure = yield* Fiber.join(first).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          operation: "extract",
          limit: "extractDeadline",
        });
        yield* expectPhysical(control.snapshot, 1);
        yield* control.fs.remove(marker);
        const second = yield* invoke.pipe(Effect.forkChild);
        yield* started;
        yield* Fiber.interrupt(second);
        yield* expectPhysical(control.snapshot, 2);
        yield* control.fs.remove(marker);
        const third = yield* invoke.pipe(Effect.forkChild);
        yield* started;
        yield* Fiber.interrupt(third);
        yield* expectPhysical(control.snapshot, 3);
      })
    );
  });
});
