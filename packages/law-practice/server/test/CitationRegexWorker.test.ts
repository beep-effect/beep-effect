import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationRegexPatternProfile } from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { makeCitationRegexWorker } from "@beep/law-practice-server/internal/Citation/RegexWorker";
import { CitationRegexMatchMode } from "@beep/law-practice-server/internal/Citation/RegexWorkerProtocol";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import {
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWorkerFixture,
  makeCitationNodeTestRuntime,
  makeCitationObservedSpawner,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationRegexWorker");
const ExpectedMatches = S.Array(S.Array(S.Tuple([S.Int, S.Int])).check(S.isMaxLength(3))).check(S.isMaxLength(2));
const ModeControls = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-regex-mode-controls/v1"),
    scope: S.tag("Synthetic CPython operation-selection controls; no source-family approval."),
    pythonVersion: S.tag("3.11.15"),
    unicodeVersion: S.tag("14.0.0"),
    producerSha256: S.tag("5d22a03ce21756269d96660e4e219e84d02b89b9cb5d42e858d913ab4d13898f"),
    pattern: S.tag("(?P<maybe>a)?(b)"),
    patternSha256: S.tag("b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7"),
    flags: S.tag(0),
    profile: CitationRegexPatternProfile,
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        width: S.Literals([1, 4]),
        sourceWords: S.Uint8ArrayFromBase64,
        sourcePoints: S.Natural,
        modes: S.Record(CitationRegexMatchMode, ExpectedMatches),
      })
    ).check(S.isBetweenLength(5, 5)),
  })
).pipe($I.annoteSchema("ModeControls", { description: "Pinned independent CPython mode/capture observations." }));
const native = (text: string) => ({ width: 1, bytes: new TextEncoder().encode(text) });
const pointWords = (points: ReadonlyArray<number>) => {
  const bytes = new Uint8Array(points.length * 4);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < points.length; index++) view.setUint32(index * 4, points[index] ?? 0, true);
  return { width: 4, bytes };
};
const pattern = native("(?P<maybe>a)?(b)");
const descriptor = {
  patternSha256: "b07d89ba5ecfc4ef7c8c6208e879a81454b1cc89203805eceef7e16b55117bb7",
  flags: 0,
  profile: {
    groups: 2,
    names: { maybe: 1 },
    minimumWidthFloor: 1,
    repeatedCaptures: false,
    nullableMultiRepeat: false,
  },
};
const setup = Effect.fn("RegexWorkerTest.setup")(function* (
  bindings: unknown,
  kind: CitationNativeRuntimeKind = "bun"
) {
  // Distinct from the default one-second cleanup timer: only native execution
  // time is manually controlled in functional tests.
  const limits = { ...(yield* defaultCitationEnginePolicy).limits, regexDeadline: Duration.millis(997) };
  // These cases compare results, not real-time cold-start performance. The
  // entered-child controls below exercise actual deadline firing separately.
  const timer = yield* makeCitationNativeManualClock(limits.regexDeadline);
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const cwd = yield* (yield* FileSystem.FileSystem).makeTempDirectoryScoped({ prefix: "citation-regex-worker-" });
  const runtime =
    kind === "node"
      ? yield* makeCitationNodeTestRuntime(
          NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.node.entry.ts", import.meta.url)),
          cwd
        )
      : {
          kind: "bun",
          executable: process.execPath,
          cwd,
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.entry.ts", import.meta.url)),
        };
  const worker = yield* makeCitationRegexWorker(limits, runtime, bindings).pipe(
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { worker, admission, observed };
});

const controlled = Effect.fn("RegexWorkerTest.controlled")(function* (
  afterKill: Effect.Effect<void> = Effect.void,
  cleanupDeadline = Duration.seconds(2),
  kind: CitationNativeRuntimeKind = "bun"
) {
  const fixture = yield* makeCitationNativeWorkerFixture("busy", "regex", kind);
  const timer = yield* makeCitationNativeManualClock(Duration.millis(800));
  const limits = {
    ...(yield* defaultCitationEnginePolicy).limits,
    regexDeadline: Duration.millis(800),
    cleanupDeadline,
  };
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const spawner = ChildProcessSpawner.of({
    ...observed.spawner,
    spawn: Effect.fn("RegexWorkerTest.spawn")((command) =>
      observed.spawner.spawn(command).pipe(
        Effect.map((handle) => ({
          ...handle,
          kill: (options) => handle.kill(options).pipe(Effect.andThen(afterKill)),
        }))
      )
    ),
  });
  const worker = yield* makeCitationRegexWorker(limits, fixture, [descriptor]).pipe(
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, spawner)
  );
  return { worker, admission, observed, fixture, timer };
});

type CompletedRegex = Effect.Success<
  ReturnType<Effect.Success<ReturnType<typeof makeCitationRegexWorker>>["evaluate"]>
>;
const assertModeCaptures = Effect.fn("RegexWorkerTest.assertModeCaptures")(function* (
  completed: CompletedRegex,
  expected: typeof ExpectedMatches.Type,
  groups: number
) {
  expect(completed.result.matches).toBe(expected.length);
  for (let match = 0; match < expected.length; match++) {
    for (let group = 0; group <= groups; group++) {
      const capture = yield* completed.result.capture(match, group);
      expect(capture._tag === "Range" ? [capture.start, capture.end] : [-1, -1]).toEqual(expected[match]?.[group]);
    }
  }
});

it.layer(Layer.merge(BunServices.layer, BunCrypto.layer), { excludeTestServices: true })("owned native regex", (it) => {
  it.effect("executes real matching and returns native captures only after confirmed retirement", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      const completed = yield* worker.evaluate(pattern, native("b ab"), 0);
      expect(completed.result.matches).toBe(2);
      expect(completed.result.groups).toBe(2);
      expect(yield* completed.result.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 1 });
      expect(yield* completed.result.capture(0, 1)).toEqual({ _tag: "Unmatched" });
      expect(yield* completed.result.capture(1, 1)).toEqual({ _tag: "Range", start: 2, end: 3 });
      expect(yield* completed.source.project({ start: 2, end: 4 })).toEqual({
        _tag: "Range",
        startChar: 2,
        endChar: 4,
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, queued: 0, quarantined: 0 });
    })
  );

  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `matches pinned CPython iteration, search and prefix semantics through real ${kind} children`,
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const crypto = yield* Digest.Digest;
          const file = NodeURL.fileURLToPath(
            new URL("../../use-cases/test/fixtures/eyecite/regex-modes.json", import.meta.url)
          );
          const bytes = yield* fs.readFile(file);
          expect(yield* crypto.digestHex(Digest.sha256, bytes)).toBe(
            "6176aed02afda7ca709db880b438b2a8174e689ef97048a3ee018ccc487ba506"
          );
          const corpus = yield* S.decodeEffect(ModeControls)(new TextDecoder().decode(bytes));
          const { worker, admission, observed } = yield* setup(
            [{ patternSha256: corpus.patternSha256, flags: corpus.flags, profile: corpus.profile }],
            kind
          );
          for (const row of corpus.cases) {
            for (const mode of CitationRegexMatchMode.literals) {
              const expected = row.modes[mode];
              const completed = yield* worker.evaluate(
                native(corpus.pattern),
                { width: row.width, bytes: row.sourceWords },
                corpus.flags,
                expected.length,
                mode
              );
              expect(completed.source.layout.pythonLength).toBe(row.sourcePoints);
              yield* assertModeCaptures(completed, expected, corpus.profile.groups);
            }
          }
          expect(yield* observed.snapshot).toEqual({ spawned: 15, confirmed: 15 });
          expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
        }),
      { timeout: 30_000 }
    );
  }

  it.effect("distinguishes a scalar from literal surrogate words before projecting captures", () =>
    Effect.gen(function* () {
      const scalar = pointWords([0x1d7ce]);
      const pair = { width: 2, bytes: new Uint8Array([0x35, 0xd8, 0xce, 0xdf]) };
      const profile = { groups: 0, names: {}, repeatedCaptures: false, nullableMultiRepeat: false };
      const { worker, admission, observed } = yield* setup([
        {
          flags: 0,
          patternSha256: "e9f8cb189ba1a0fb007b2bae7be8968860b00b0f5a291f55e359a3ba19a96bf7",
          profile: { ...profile, minimumWidthFloor: 1 },
        },
        {
          flags: 0,
          patternSha256: "6b0cc71a808904081ff51cc3266650d2eca776b7050405ddc8a93f1f1278212f",
          profile: { ...profile, minimumWidthFloor: 2 },
        },
      ]);
      const source = pointWords([0x1d7ce, 0xd835, 0xdfce, 48, 0x1d7ce]);
      const scalarResult = yield* worker.evaluate(scalar, source, 0);
      const pairResult = yield* worker.evaluate(pair, source, 0);
      expect(scalarResult.result.matches).toBe(2);
      expect(pairResult.result.matches).toBe(1);
      expect(yield* scalarResult.result.capture(0, 0)).toEqual({ _tag: "Range", start: 0, end: 1 });
      expect(yield* scalarResult.result.capture(1, 0)).toEqual({ _tag: "Range", start: 4, end: 5 });
      expect(yield* pairResult.result.capture(0, 0)).toEqual({ _tag: "Range", start: 1, end: 3 });
      expect(yield* pairResult.source.project({ start: 1, end: 3 })).toEqual({
        _tag: "Range",
        startChar: 2,
        endChar: 4,
      });
      expect(yield* scalarResult.source.project({ start: 4, end: 5 })).toEqual({
        _tag: "Range",
        startChar: 5,
        endChar: 7,
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 2, confirmed: 2 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("allows zero remaining matches only for a complete no-match result", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      expect((yield* worker.evaluate(pattern, native("zzz"), 0, 0)).result.matches).toBe(0);
      expect(yield* worker.evaluate(pattern, native("b"), 0, 0).pipe(Effect.flip)).toMatchObject({
        _tag: "CitationSafetyLimitExceeded",
        operation: "extract",
        limit: "patternMatches",
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 2, confirmed: 2 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );

  it.effect("rejects uninstalled native patterns before spawning and returns their reservation", () =>
    Effect.gen(function* () {
      const { worker, admission, observed } = yield* setup([descriptor]);
      expect(yield* worker.evaluate(native("c"), native("c"), 0).pipe(Effect.flip)).toMatchObject({
        _tag: "CitationRegexDescriptorFailure",
        reason: "unknown-pattern",
      });
      expect(yield* observed.snapshot).toEqual({ spawned: 0, confirmed: 0 });
      expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
    })
  );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(`enforces its captured regex deadline while ${kind} native work leaves the parent responsive`, () =>
      Effect.gen(function* () {
        const { worker, admission, observed, fixture, timer } = yield* controlled(
          Effect.void,
          Duration.seconds(2),
          kind
        );
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const pending = yield* worker
          .evaluate(pattern, native("private input"), 0)
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        let responsive = false;
        yield* Effect.sync(() => {
          responsive = true;
        }).pipe(Effect.forkChild, Effect.flatMap(Fiber.join));
        expect(responsive).toBe(true);
        yield* timer.trigger;
        const failed = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(failed).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "regexDeadline" });
        expect(yield* worker.snapshot).toMatchObject({ processes: 0, quarantined: 0 });
        expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
        expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      })
    );

    it.effect(`retires an entered ${kind} native child before acknowledging caller interruption`, () =>
      Effect.gen(function* () {
        const { worker, admission, observed, fixture } = yield* controlled(Effect.void, Duration.seconds(2), kind);
        const pending = yield* Effect.forkChild(worker.evaluate(pattern, native("private input"), 0));
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        yield* Fiber.interrupt(pending);
        expect(Exit.hasInterrupts(yield* Fiber.await(pending))).toBe(true);
        expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
        expect(yield* worker.snapshot).toMatchObject({ processes: 0, quarantined: 0 });
        expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      })
    );

    it.effect(`quarantines ${kind} total and regex capacity until late exit acknowledgement`, () =>
      Effect.gen(function* () {
        const acknowledged = yield* Deferred.make<void>();
        const { worker, admission, observed, fixture, timer } = yield* controlled(
          Deferred.await(acknowledged),
          Duration.millis(25),
          kind
        );
        const pending = yield* Effect.forkChild(worker.evaluate(pattern, native("private input"), 0));
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        yield* timer.trigger;
        expect(yield* Fiber.join(pending).pipe(Effect.flip)).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          limit: "cleanupDeadline",
        });
        expect(yield* worker.snapshot).toMatchObject({ processes: 1, quarantined: 1 });
        expect(yield* admission.snapshot).toMatchObject({ active: 1, regexActive: 1, quarantined: 1 });
        expect(yield* worker.evaluate(pattern, native("replacement"), 0).pipe(Effect.flip)).toMatchObject({
          reason: "quarantined",
        });
        expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 0 });
        yield* Deferred.succeed(acknowledged, undefined);
        yield* waitForCitationNativeTest(worker.snapshot.pipe(Effect.map((state) => state.processes === 0)));
        expect(yield* observed.snapshot).toEqual({ spawned: 1, confirmed: 1 });
        expect(yield* admission.snapshot).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      })
    );
  }
});
