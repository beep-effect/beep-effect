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
  CitationSafetyLimitExceeded,
} from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import { assertDefined, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { makeTestCitationDigest } from "./CitationDigest.fixtures.ts";
import { citationFixtureEngineBuild } from "./CitationEngineArtifact.fixtures.ts";
import {
  makeCitationBundledTestRuntime,
  makeCitationNativeSleepClock,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationEngineLimits } from "@beep/law-practice-use-cases/server";

const encodeFailureJson = S.encodeEffect(S.fromJsonString(CitationExtractorFailure));

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
    // Boundary tests replace a field of a fresh copy with a malformed value and
    // observe the spawner themselves, because the Layer refuses to build.
    readonly tamper?: (configuration: CitationExtractorConfiguration) => CitationExtractorConfiguration;
    readonly observed?: Effect.Success<ReturnType<typeof makeCitationObservedSpawner>>;
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
  const observed = options.observed ?? (yield* makeCitationObservedSpawner());
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
      runtime: { ...citationFixtureEngineBuild("bun").runtime, kind: options.wrongRuntime === true ? "node" : "bun" },
      limits,
      vocabularyVersion:
        options.wrongVocabulary === true
          ? CourtReporterArtifactVersion.make("uninstalled-artifact")
          : Result.getOrThrow(CourtReporterArtifact).artifactVersion,
    },
  });
  const context = yield* Layer.build(CitationExtractorLive(options.tamper?.(configuration) ?? configuration)).pipe(
    Effect.provideService(SourceTextResolver, resolver),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  const extractor = Context.get(context, CitationExtractor);
  const input = CitationExtractorInput.make({ source: source.source, sourceText: source.sourceText });
  return { extractor, input, fs, cwd, limits, snapshot: observed.snapshot };
});
const expectPrivateFailure = Effect.fnUntraced(function* (failure: CitationExtractorFailure, cwd: string) {
  const encoded = yield* encodeFailureJson(failure);
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
  it.effect("refuses malformed limits, runtime and installation configuration at the boundary before spawning", () =>
    Effect.gen(function* () {
      const observed = yield* makeCitationObservedSpawner();
      const replaced =
        (field: keyof CitationExtractorConfiguration, malformed: (c: CitationExtractorConfiguration) => unknown) =>
        (configuration: CitationExtractorConfiguration) => {
          const copy = CitationExtractorConfiguration.make({ ...configuration });
          expect(Reflect.set(copy, field, malformed(configuration))).toBe(true);
          return copy;
        };
      for (const tamper of [
        replaced("installation", (c) => ({ ...c.installation, limits: { ...c.installation.limits, sourceUtf16: -1 } })),
        replaced("runtime", (c) => ({ ...c.runtime, kind: "unsupported" })),
        replaced("installation", (c) => ({ ...c.installation, vocabularyVersion: 42 })),
      ]) {
        const failure = yield* fixture("35 U.S.C. 101", { tamper, observed }).pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationInputError", operation: "extract" });
        expect(failure).not.toHaveProperty("cause");
      }
      yield* expectPhysical(observed.snapshot, 0);
    })
  );
  it.effect("keeps installed limits when a caller mutates a returned report", () =>
    Effect.gen(function* () {
      const control = yield* fixture("35 U.S.C. 101");
      const first = yield* control.extractor.extract(control.input);
      const deadline = Duration.toMillis(first.report.limits.extractDeadline);
      const tokens = first.report.limits.tokens;
      expect(Reflect.set(first.report.limits.extractDeadline.value, "millis", 1)).toBe(true);
      expect(Reflect.set(first.report.limits, "tokens", 1)).toBe(true);
      const second = yield* control.extractor.extract(control.input);
      expect(Duration.toMillis(second.report.limits.extractDeadline)).toBe(deadline);
      expect(second.report.limits.tokens).toBe(tokens);
      expect(second.document.mentions).toHaveLength(first.document.mentions.length);
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
        const exit = yield* control.extractor.extract(control.input).pipe(Effect.exit);
        // Effect.fn annotates the Cause with its stack frame, so compare the error, not the whole Cause.
        assertSome(Exit.findErrorOption(exit), CitationSafetyLimitExceeded.make({ operation: "extract", limit }));
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
      assertDefined(first.citation.components.page);
      assertNone(first.citation.components.page);
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
  it.layer(TestClock.layer(), { concurrent: false })("captured supervision", (it) => {
    it.effect("starts the extractor stage deadline after queued admission", () =>
      Effect.gen(function* () {
        const firstEntered = yield* Deferred.make<void>();
        const secondEntered = yield* Deferred.make<void>();
        const calls = yield* Ref.make(0);
        const completed = yield* Ref.make(false);
        const resolver = SourceTextResolver.of({
          resolve: Effect.fn("ExtractorControls.queuedResolve")(function* () {
            const call = yield* Ref.getAndUpdate(calls, (n) => n + 1);
            if (call === 0) {
              yield* Deferred.succeed(firstEntered, undefined);
              return yield* Effect.never;
            }
            yield* Deferred.succeed(secondEntered, undefined);
            yield* Effect.sleep(Duration.millis(9500));
            return yield* SourceTextResolverError.new("source-unavailable", "controlled refusal after work");
          }),
        });
        const control = yield* fixture("deadline probe", {
          resolver,
          limits: {
            concurrentOperations: 1,
            queuedOperations: 1,
            extractDeadline: Duration.seconds(10),
            queueDeadline: Duration.seconds(5),
            operationDeadline: Duration.seconds(30),
          },
        });
        const first = yield* control.extractor.extract(control.input).pipe(Effect.forkChild);
        yield* Deferred.await(firstEntered);
        const second = yield* control.extractor.extract(control.input).pipe(
          Effect.onExit(() => Ref.set(completed, true)),
          Effect.forkChild
        );
        yield* TestClock.adjust(Duration.millis(800));
        yield* Fiber.interrupt(first);
        yield* Deferred.await(secondEntered);
        yield* TestClock.adjust(Duration.millis(9200));
        const finishedAtOuterDeadline = yield* Ref.get(completed);
        expect(finishedAtOuterDeadline).toBe(false);
        yield* TestClock.adjust(Duration.millis(300));
        const failure = yield* Fiber.join(second).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "CitationPrerequisiteError",
          operation: "extract",
          dependency: "source-evidence",
        });
        yield* expectPhysical(control.snapshot, 0);
      })
    );

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
