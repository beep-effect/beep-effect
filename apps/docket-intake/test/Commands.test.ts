/**
 * Command handler proofs: the handlers read the environment, build the wiring
 * they are given, and run the pipeline. The wiring here is the real pipeline
 * over in-memory ports and a scripted `M365` service.
 */

import { it } from "@beep/test-runner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { ConfigProvider, Context, Deferred, Effect, Exit, Fiber, FileSystem, Layer, Ref } from "effect";
import * as A from "effect/Array";
import { makeCommand, makeHandlers } from "@/Commands";
import { fixtureEnv, STATE_DIRECTORY } from "./support/Config.ts";
import { FakeM365, FakeM365Layer } from "./support/FakeM365.ts";
import { FilesLayer, PipelineHarness, PipelineLayer } from "./support/Pipeline.ts";
import type { DocketIntakeStore } from "@beep/law-practice-use-cases/DocketIntake";

type WiringLogShape = {
  /** The listing floor each `intake` wiring was asked for. */
  readonly initialSince: Ref.Ref<ReadonlyArray<string>>;
};

class WiringLog extends Context.Service<WiringLog, WiringLogShape>()(
  "@beep/docket-intake/test/Commands.test/WiringLog"
) {}

const WiringLogLayer = Layer.effect(
  WiringLog,
  Effect.gen(function* () {
    return WiringLog.of({ initialSince: yield* Ref.make<ReadonlyArray<string>>([]) });
  })
);

// The services the fake wiring hands to the handlers are built once per test block, so the test
// body and the handler see the same harness, store and scripted mailbox.
const makeTestHandlers = Effect.gen(function* () {
  const context = yield* Effect.context<DocketIntakeStore | FakeM365 | PipelineHarness | WiringLog>();
  const log = yield* WiringLog;
  return makeHandlers({
    intake: (options) =>
      Layer.unwrap(
        Ref.update(log.initialSince, A.append(options.initialSince)).pipe(
          Effect.as(PipelineLayer.pipe(Layer.provide(Layer.succeedContext(context))))
        )
      ),
    mailbox: () => Layer.merge(FakeM365Layer, BunCrypto.layer).pipe(Layer.provide(Layer.succeedContext(context))),
  });
});

const commandsLayer = (env: Readonly<Record<string, string>>) =>
  Layer.mergeAll(
    PipelineLayer,
    FilesLayer,
    FakeM365Layer,
    WiringLogLayer,
    ConfigProvider.layer(ConfigProvider.fromUnknown(env))
  );

const CommandsLayer = commandsLayer(fixtureEnv);

const { DOCKET_INTAKE_START_AT: _startAt, ...envWithoutStart } = fixtureEnv;

describe("@beep/docket-intake commands", () => {
  it("names the service command", () => {
    const command = makeCommand({
      intake: () => PipelineLayer,
      mailbox: () => Layer.merge(FakeM365Layer, BunCrypto.layer),
    });

    expect(command.name).toBe("docket-intake");
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "poll starts from the configured start time, seeds the cursor and runs one cycle",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const log = yield* WiringLog;
        const fs = yield* FileSystem.FileSystem;

        yield* handlers.poll();

        expect(yield* Ref.get(log.initialSince)).toStrictEqual(["2030-01-01T06:00:00.000Z"]);
        expect(yield* fs.exists(`${STATE_DIRECTORY}/digests/1969-12-30.md`)).toBe(true);
      })
    );
  });

  it.layer(commandsLayer(envWithoutStart), { timeout: "10 seconds" })((it) => {
    it.effect(
      "poll starts from the time of the first run when no start time is configured, and saves it",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const log = yield* WiringLog;
        const harness = yield* PipelineHarness;
        // No mail on this run, so the saved cursor is exactly the seeded one.
        yield* Ref.set(harness.failingListings, 1);

        yield* Effect.exit(handlers.poll());
        const state = yield* Ref.get(harness.state);

        // The test clock stands at the Unix epoch.
        expect(yield* Ref.get(log.initialSince)).toStrictEqual(["1970-01-01T00:00:00.000Z"]);
        assertSome(state.cursor, "1970-01-01T00:00:00.000Z");
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "run keeps polling until it is stopped",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const harness = yield* PipelineHarness;

        const running = yield* Effect.forkChild(handlers.run({ intervalMinutes: 5 }));
        yield* Deferred.await(harness.listed);
        const stopped = yield* Fiber.interrupt(running).pipe(Effect.andThen(Fiber.await(running)));

        expect(Exit.hasInterrupts(stopped)).toBe(true);
        expect(yield* Ref.get(harness.listings)).toBe(1);
      })
    );
  });

  it.layer(CommandsLayer, { timeout: "10 seconds" })((it) => {
    it.effect(
      "smoke checks the mailbox it is wired to, read-only unless asked to write",
      Effect.fnUntraced(function* () {
        const handlers = yield* makeTestHandlers;
        const fake = yield* FakeM365;

        yield* handlers.smoke({ write: false });
        const readOnly = yield* Ref.get(fake.calls);
        yield* handlers.smoke({ write: true });

        expect(readOnly).toStrictEqual(["listMessages", "listCategories"]);
        assertSome(A.last(yield* Ref.get(fake.calls)), "deleteEvent event-1");
      })
    );
  });
});
