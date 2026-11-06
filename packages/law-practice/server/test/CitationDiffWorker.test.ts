import { makeCitationDiffWorker } from "@beep/law-practice-server/internal/Citation/DiffWorker";
import {
  CitationNativeProcessAdmission,
  makeCitationNativeProcessAdmission,
} from "@beep/law-practice-server/internal/Citation/NativeAdmission";
import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import { makeCitationDiffWorkerFixture, replayCitationDiffWorker } from "./CitationDiffWorker.fixtures.ts";
import {
  makeCitationNativeAcknowledgementSpawner,
  makeCitationNativeManualClock,
  makeCitationNativeSleepClock,
  makeCitationNativeWorkerFixture,
  waitForCitationNativeTest,
} from "./CitationNativeSpawner.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const before = { width: 1, bytes: new Uint8Array([97]) };
const after = { width: 1, bytes: new Uint8Array() };
const controlled = Effect.fn("DiffWorkerTest.controlled")(function* (
  kind: CitationNativeRuntimeKind,
  afterKill: Effect.Effect<void> = Effect.void,
  cleanupDeadline = Duration.seconds(2)
) {
  const fixture = yield* makeCitationNativeWorkerFixture("busy", "diff", kind);
  const timer = yield* makeCitationNativeManualClock(Duration.millis(800));
  const limits = {
    ...(yield* defaultCitationEnginePolicy).limits,
    extractDeadline: Duration.millis(800),
    cleanupDeadline,
  };
  const admission = yield* makeCitationNativeProcessAdmission(limits);
  const observed = yield* makeCitationNativeAcknowledgementSpawner(afterKill);
  const worker = yield* makeCitationDiffWorker(limits, fixture).pipe(
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(CitationNativeProcessAdmission, admission),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { fixture, timer, worker, admission, observed };
});

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("owned default-diff worker", (it) => {
  it.effect("refuses combined input and captured text capacity before spawning or receiving copies", () =>
    Effect.gen(function* () {
      const fixture = yield* makeCitationNativeWorkerFixture("busy", "diff", "bun");
      const limits = { ...(yield* defaultCitationEnginePolicy).limits, diffInputUtf16: 1, producedTextUtf16: 2 };
      const budget = yield* makeCitationTextBudget(limits);
      const observed = yield* makeCitationNativeAcknowledgementSpawner(Effect.void);
      const worker = yield* makeCitationDiffWorker(limits, fixture).pipe(
        Effect.provideService(CitationTextBudget, budget),
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const combined = yield* worker.evaluate(before, before).pipe(Effect.flip);
      expect(combined).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffInputUtf16" });
      const invalid = yield* worker.evaluate({ width: 2, bytes: new Uint8Array([97, 0]) }, after).pipe(Effect.flip);
      expect(invalid).toMatchObject({ reason: "invalid-input" });
      const unused = yield* budget.snapshot;
      expect(unused).toBe(0);
      yield* budget.reserve(2);
      const replacement = yield* makeCitationTextBudget(limits);
      const refused = yield* worker
        .evaluate(before, after)
        .pipe(Effect.provideService(CitationTextBudget, replacement), Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const counts = yield* observed.snapshot;
      expect(counts).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  for (const kind of CitationNativeRuntimeKind.literals)
    it.effect(
      `preserves source edits through actual ${kind} children and confirms every exit`,
      () => replayCitationDiffWorker(kind, false),
      { timeout: 60000 }
    );
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(`returns the closed ${kind} native step refusal only after confirmed retirement`, () =>
      Effect.gen(function* () {
        const limits = (yield* defaultCitationEnginePolicy).limits;
        const { worker, observed } = yield* makeCitationDiffWorkerFixture(kind, limits);
        const refused = yield* worker.evaluate(before, after, 0).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "diffSteps" });
        const empty = yield* worker.evaluate(after, after, 0);
        expect(empty).toEqual([]);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 2, confirmed: 2 });
      })
    );
    it.effect(`keeps the parent responsive and enforces the captured deadline during ${kind} native work`, () =>
      Effect.gen(function* () {
        const { fixture, timer, worker, observed, admission } = yield* controlled(kind);
        const disabled = yield* makeCitationNativeSleepClock(() => Effect.never);
        const pending = yield* worker
          .evaluate(before, after)
          .pipe(Effect.provideService(Clock.Clock, disabled), Effect.forkChild);
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        let responsive = false;
        yield* Effect.sync(() => {
          responsive = true;
        }).pipe(Effect.forkChild, Effect.flatMap(Fiber.join));
        expect(responsive).toBe(true);
        yield* timer.trigger;
        const refused = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "extractDeadline" });
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
        const state = yield* admission.snapshot;
        expect(state).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      })
    );
    it.effect(`confirms physical ${kind} retirement before caller cancellation completes`, () =>
      Effect.gen(function* () {
        const { fixture, worker, observed } = yield* controlled(kind);
        const pending = yield* Effect.forkChild(worker.evaluate(before, after));
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        yield* Fiber.interrupt(pending);
        const outcome = yield* Fiber.await(pending);
        expect(Exit.hasInterrupts(outcome)).toBe(true);
        const counts = yield* observed.snapshot;
        expect(counts).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
    it.effect(`quarantines ${kind} capacity until independent late exit acknowledgement`, () =>
      Effect.gen(function* () {
        const acknowledged = yield* Deferred.make<void>();
        const { fixture, timer, worker, admission, observed } = yield* controlled(
          kind,
          Deferred.await(acknowledged),
          Duration.millis(25)
        );
        const pending = yield* Effect.forkChild(worker.evaluate(before, after));
        yield* waitForCitationNativeTest(fixture.fs.exists(fixture.marker));
        yield* timer.trigger;
        const refused = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "cleanupDeadline" });
        const held = yield* admission.snapshot;
        expect(held).toMatchObject({ active: 1, regexActive: 0, quarantined: 1 });
        const blocked = yield* worker.evaluate(before, after).pipe(Effect.flip);
        expect(blocked).toMatchObject({ reason: "quarantined" });
        yield* Deferred.succeed(acknowledged, undefined);
        yield* waitForCitationNativeTest(Effect.map(observed.snapshot, (counts) => counts.confirmed === 1));
        yield* worker.reap();
        const released = yield* admission.snapshot;
        expect(released).toMatchObject({ active: 0, regexActive: 0, quarantined: 0 });
      })
    );
  }
});
