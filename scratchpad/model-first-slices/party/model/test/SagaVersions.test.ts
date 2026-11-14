import * as Domain from "@alchemy.run/domain";
import * as InMemory from "@alchemy.run/domain/InMemory";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Activity from "effect/workflow/Activity";
import * as DurableDeferred from "effect/workflow/DurableDeferred";

// D35 probe: an incompatible change to a saga's activity results is a new saga version, a
// second saga under a new name. Runs in flight finish on the version they started, new runs
// start on the new one. This model stands in for the review saga.
const Go = DurableDeferred.make("go", { success: S.Struct({}) });

class WorkV1 extends Domain.Saga("WorkV1", { key: S.String, input: {}, result: { version: S.Int, prepared: S.Boolean } }) {}
class WorkV2 extends Domain.Saga("WorkV2", { key: S.String, input: {}, result: { version: S.Int, prepared: S.String } }) {}

// V1 stored a boolean for "prepare"; V2 stores a string: an incompatible result change.
const WorkV1Live = WorkV1.toLayer(
  Effect.succeed(
    Effect.fn(function* () {
      const prepared = yield* Activity.make({ name: "prepare", success: S.Boolean, execute: Effect.succeed(true) });
      yield* DurableDeferred.await(Go);
      return { version: 1, prepared };
    }),
  ),
);
const WorkV2Live = WorkV2.toLayer(
  Effect.succeed(
    Effect.fn(function* () {
      const prepared = yield* Activity.make({ name: "prepare", success: S.String, execute: Effect.succeed("ready") });
      yield* DurableDeferred.await(Go);
      return { version: 2, prepared };
    }),
  ),
);

class Before extends Domain.Model("Work", { aggregates: [], sagas: [WorkV1] }) {}
class After extends Domain.Model("Work", { aggregates: [], sagas: [WorkV1, WorkV2] }) {}

const waitRunning = (status: Effect.Effect<{ readonly _tag: string }>) =>
  status.pipe(Effect.repeat({ schedule: Schedule.spaced("20 millis"), until: (s) => s._tag === "Running", times: 100 }));

it.live("a run in flight finishes on the saga version it started, while new runs start on the next version", () =>
  Effect.gen(function* () {
    const platform = InMemory.make();
    // Deploy 1: only V1. A run starts and waits. Each deploy is built in a scope of its own.
    yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(Before.layer(WorkV1Live).pipe(Layer.provide(platform.layer)));
        yield* Effect.gen(function* () {
          const v1 = yield* WorkV1;
          const run = yield* v1.start("job_1", {});
          yield* waitRunning(run.status);
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    // Deploy 2: V1 kept beside V2. The old run resumes on V1; a new run starts on V2.
    const [old, fresh] = yield* Effect.scoped(
      Effect.gen(function* () {
        const deployment = yield* Layer.build(After.layer(Layer.merge(WorkV1Live, WorkV2Live)).pipe(Layer.provide(platform.layer)));
        return yield* Effect.gen(function* () {
          const v1 = yield* WorkV1;
          const v2 = yield* WorkV2;
          const next = yield* v2.start("job_2", {});
          yield* waitRunning(next.status);
          yield* v1.get("job_1").signal(Go, {});
          yield* next.signal(Go, {});
          return yield* Effect.all([v1.get("job_1").result, next.result]);
        }).pipe(Effect.provideContext(deployment));
      }),
    );
    expect(old).toEqual({ version: 1, prepared: true });
    expect(fresh).toEqual({ version: 2, prepared: "ready" });
  }),
);
