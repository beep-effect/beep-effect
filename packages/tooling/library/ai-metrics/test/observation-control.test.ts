import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Ref from "effect/Ref";
import * as TestClock from "effect/testing/TestClock";
import type { ObservationControl } from "@beep/repo-ai-metrics/observation-control";

const policy = ObservationControlPolicy.make({ maxActive: 2, drainTimeoutMillis: 1000 });
const untilPaused = Effect.fn("ObservationControlTest.untilPaused")(function* (control: ObservationControl) {
  while ((yield* control.status).accepting) yield* Effect.yieldNow;
});

it.effect("starts paused, caps active work without queuing and drains exactly the admitted generation", () =>
  Effect.gen(function* () {
    const control = yield* makeObservationControl(policy);
    const calls = yield* Ref.make(0);
    expect((yield* control.run(Ref.update(calls, (n) => n + 1)).pipe(Effect.flip)).reason).toBe("paused");
    expect(yield* Ref.get(calls)).toBe(0);
    yield* control.resume;
    const started1 = yield* Deferred.make<void>();
    const started2 = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const first = yield* control
      .run(Deferred.succeed(started1, undefined).pipe(Effect.andThen(Deferred.await(release))))
      .pipe(Effect.forkChild);
    const second = yield* control
      .run(Deferred.succeed(started2, undefined).pipe(Effect.andThen(Deferred.await(release))))
      .pipe(Effect.forkChild);
    yield* Deferred.await(started1);
    yield* Deferred.await(started2);
    expect((yield* control.run(Ref.update(calls, (n) => n + 1)).pipe(Effect.flip)).reason).toBe("busy");
    expect(yield* control.status).toMatchObject({ active: 2, accepting: true });
    const pausing = yield* control.pause.pipe(Effect.forkChild);
    yield* untilPaused(control);
    expect((yield* control.resume.pipe(Effect.flip)).reason).toBe("busy");
    expect((yield* control.pause.pipe(Effect.flip)).reason).toBe("busy");
    expect((yield* control.run(Ref.update(calls, (n) => n + 1)).pipe(Effect.flip)).reason).toBe("paused");
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(first);
    yield* Fiber.join(second);
    expect(yield* Fiber.join(pausing)).toMatchObject({ accepting: false, active: 0, maintenance: false });
    expect(yield* Ref.get(calls)).toBe(0);
    yield* control.resume;
    yield* control.run(Ref.update(calls, (n) => n + 1));
    expect(yield* Ref.get(calls)).toBe(1);
  }).pipe(Effect.scoped)
);

it.effect("keeps admission closed after drain timeout and refuses resume until accepted work finishes", () =>
  Effect.gen(function* () {
    const control = yield* makeObservationControl(policy);
    yield* control.resume;
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const running = yield* control
      .run(Deferred.succeed(started, undefined).pipe(Effect.andThen(Deferred.await(release))))
      .pipe(Effect.forkChild);
    yield* Deferred.await(started);
    const pausing = yield* control.pause.pipe(Effect.forkChild);
    yield* untilPaused(control);
    yield* TestClock.adjust("1 second");
    expect((yield* Fiber.join(pausing).pipe(Effect.flip)).reason).toBe("deadline");
    expect(yield* control.status).toMatchObject({ accepting: false, active: 1 });
    expect((yield* control.resume.pipe(Effect.flip)).reason).toBe("busy");
    expect((yield* control.maintain(Effect.void).pipe(Effect.flip)).reason).toBe("busy");
    yield* Deferred.succeed(release, undefined);
    yield* Fiber.join(running);
    expect(yield* control.pause).toMatchObject({ active: 0, accepting: false });
    expect(yield* control.resume).toMatchObject({ accepting: true });
  }).pipe(Effect.scoped)
);

it.effect("releases activity after failures and interruption without reopening admission", () =>
  Effect.gen(function* () {
    const control = yield* makeObservationControl(policy);
    yield* control.resume;
    expect(yield* control.run(Effect.fail("synthetic-failure")).pipe(Effect.flip)).toBe("synthetic-failure");
    const started = yield* Deferred.make<void>();
    const running = yield* control
      .run(Deferred.succeed(started, undefined).pipe(Effect.andThen(Effect.never)))
      .pipe(Effect.forkChild);
    yield* Deferred.await(started);
    const pausing = yield* control.pause.pipe(Effect.forkChild);
    yield* untilPaused(control);
    yield* Fiber.interrupt(pausing);
    expect(yield* control.status).toMatchObject({ accepting: false, active: 1 });
    yield* Fiber.interrupt(running);
    expect(yield* control.pause).toMatchObject({ accepting: false, active: 0 });
    yield* control.resume;
    expect(yield* control.run(Effect.succeed("next-generation"))).toBe("next-generation");
  }).pipe(Effect.scoped)
);

it.effect("serializes maintenance, refuses admission and resume, and stays paused after maintenance failure", () =>
  Effect.gen(function* () {
    const control = yield* makeObservationControl(policy);
    yield* control.resume;
    expect((yield* control.maintain(Effect.void).pipe(Effect.flip)).reason).toBe("busy");
    yield* control.pause;
    const started = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const maintenance = yield* control
      .maintain(
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.andThen(Effect.fail("synthetic-failure"))
        )
      )
      .pipe(Effect.forkChild);
    yield* Deferred.await(started);
    expect(yield* control.status).toMatchObject({ accepting: false, active: 0, maintenance: true });
    expect((yield* control.resume.pipe(Effect.flip)).reason).toBe("busy");
    expect((yield* control.maintain(Effect.void).pipe(Effect.flip)).reason).toBe("busy");
    expect((yield* control.run(Effect.void).pipe(Effect.flip)).reason).toBe("paused");
    yield* Deferred.succeed(release, undefined);
    expect(yield* Fiber.join(maintenance).pipe(Effect.flip)).toBe("synthetic-failure");
    expect(yield* control.status).toMatchObject({ accepting: false, active: 0, maintenance: false });
    expect(yield* control.maintain(Effect.succeed("restored"))).toBe("restored");
    expect(yield* control.status).toMatchObject({ accepting: false });
  }).pipe(Effect.scoped)
);

it.effect("permanently closes a controller when its owning scope is released", () =>
  Effect.gen(function* () {
    const control = yield* Effect.scoped(
      Effect.gen(function* () {
        const owned = yield* makeObservationControl(policy);
        yield* owned.resume;
        return owned;
      })
    );
    expect(yield* control.status).toMatchObject({ accepting: false, active: 0, closed: true });
    expect((yield* control.resume.pipe(Effect.flip)).reason).toBe("closed");
    expect((yield* control.run(Effect.void).pipe(Effect.flip)).reason).toBe("closed");
    expect((yield* control.maintain(Effect.void).pipe(Effect.flip)).reason).toBe("closed");
    expect((yield* control.pause.pipe(Effect.flip)).reason).toBe("closed");
  })
);

it.effect("keeps pause exclusive through scanner suspension and leaves admission closed on suspension failure", () =>
  Effect.gen(function* () {
    const control = yield* makeObservationControl(policy);
    yield* control.resume;
    const suspending = yield* Deferred.make<void>();
    const release = yield* Deferred.make<void>();
    const pause = yield* control
      .pauseWith(
        Deferred.succeed(suspending, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.andThen(Effect.fail("synthetic-suspension-failure"))
        )
      )
      .pipe(Effect.forkChild);
    yield* Deferred.await(suspending);
    expect(yield* control.status).toMatchObject({ accepting: false, active: 0 });
    expect(yield* control.resume.pipe(Effect.flip)).toMatchObject({ reason: "busy" });
    expect(yield* control.maintain(Effect.void).pipe(Effect.flip)).toMatchObject({ reason: "busy" });
    expect(yield* control.run(Effect.void).pipe(Effect.flip)).toMatchObject({ reason: "paused" });
    yield* Deferred.succeed(release, undefined);
    expect(yield* Fiber.join(pause).pipe(Effect.flip)).toBe("synthetic-suspension-failure");
    expect(yield* control.status).toMatchObject({ accepting: false, active: 0 });
    expect(yield* control.pauseWith(Effect.void)).toMatchObject({ accepting: false, active: 0 });
    expect(yield* control.resume).toMatchObject({ accepting: true });
  }).pipe(Effect.scoped)
);
