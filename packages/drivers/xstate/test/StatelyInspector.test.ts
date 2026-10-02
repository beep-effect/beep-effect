import { it } from "@beep/test-runner";
import { inspectActor, StatelyInspector, StatelyInspectorConfig, StatelyInspectorConfigFromEnv } from "@beep/xstate";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { createInspector } from "@statelyai/sdk";
import { createEffectActor, send, waitFor } from "@xstate/effect";
import { ConfigProvider, Effect, Exit, Layer, pipe, Scope } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { Deployments, deploymentsSucceeding, releaseMachine } from "./fixtures/Release.machine.ts";
import type { CreateInspector } from "@beep/xstate";
import type { Transport } from "@statelyai/sdk";
import type { ConfigError } from "effect/Config";

interface RecordedMessage {
  readonly snapshot?: { readonly value?: unknown; readonly status?: unknown };
  readonly type: string;
}

interface Recorder {
  destroyed: number;
  readonly messages: Array<RecordedMessage>;
}

const makeRecordingCreate = (recorder: Recorder): CreateInspector => {
  const transport: Transport = {
    ready: true,
    send: (message) => {
      recorder.messages.push(JSON.parse(JSON.stringify(message)) as RecordedMessage);
    },
    onMessage: () => () => {},
    onReady: (handler) => {
      handler();
      return () => {};
    },
    destroy: () => {},
  };
  return (options) => {
    const inspector = createInspector({ ...options, launch: "none", transport });
    const destroy = inspector.destroy.bind(inspector);
    inspector.destroy = () => {
      recorder.destroyed += 1;
      destroy();
    };
    return inspector;
  };
};

const recorder: Recorder = { messages: [], destroyed: 0 };
const recordingLayer = StatelyInspector.makeLayer(
  StatelyInspectorConfig.make({ enabled: true, name: O.some("release-test") }),
  makeRecordingCreate(recorder)
);

describe("StatelyInspector", () => {
  it.layer(StatelyInspector.layerDisabled, { timeout: "30 seconds" })((it) => {
    it.effect("the disabled layer attaches nothing and exposes no URL", () =>
      Effect.gen(function* () {
        const inspector = yield* StatelyInspector;
        assertNone(inspector.inspectorUrl);
        const actor = yield* createEffectActor(releaseMachine, { input: { release: "v1.0.0" } });
        yield* inspector.attach(actor);
        yield* inspector.ready;
        assertTrue(actor.getSnapshot().matches("awaitingApproval"));
      }).pipe(Effect.provideService(Deployments, deploymentsSucceeding))
    );
  });

  it.layer(recordingLayer, { timeout: "30 seconds" })((it) => {
    it.effect("forwards actor transitions through the SDK transport", () =>
      Effect.gen(function* () {
        const inspector = yield* StatelyInspector;
        // An injected transport replaces the relay, so the SDK derives no inspector URL.
        assertNone(inspector.inspectorUrl);
        yield* inspector.ready;
        const actor = yield* createEffectActor(releaseMachine, { input: { release: "v1.0.0" } });
        yield* inspectActor(actor);
        yield* send(actor, { type: "APPROVE", reviewer: "Ada" });
        yield* waitFor(actor, (snapshot) => snapshot.matches("deployed"), { timeout: "5 seconds" });

        const snapshotValues = pipe(
          recorder.messages,
          A.filter((message) => message.type === "@statelyai.system.actorSnapshot"),
          A.map((message) => message.snapshot?.value)
        );
        expect(snapshotValues).toContain("deploying");
        expect(snapshotValues).toContain("deployed");
        expect(recorder.destroyed).toBe(0);
      }).pipe(Effect.provideService(Deployments, deploymentsSucceeding))
    );
  });

  it.effect("destroys the SDK inspector when the layer scope closes", () =>
    Effect.gen(function* () {
      const scoped: Recorder = { messages: [], destroyed: 0 };
      const layer = StatelyInspector.makeLayer(
        StatelyInspectorConfig.make({ enabled: true }),
        makeRecordingCreate(scoped)
      );
      const scope = yield* Scope.make();
      yield* Layer.build(layer).pipe(Scope.provide(scope));
      expect(scoped.destroyed).toBe(0);
      yield* Scope.close(scope, Exit.void);
      expect(scoped.destroyed).toBe(1);
    })
  );

  it.effect("reads its configuration from STATELY_INSPECT* variables", () =>
    Effect.gen(function* () {
      const provider = ConfigProvider.fromUnknown({
        STATELY_INSPECT: "true",
        STATELY_INSPECT_LAUNCH: "browser",
        STATELY_INSPECT_URL: "wss://inspect.example/relay",
        STATELY_INSPECT_NAME: "release",
      });
      const config = yield* StatelyInspectorConfigFromEnv.parse(provider);
      expect(config.enabled).toBe(true);
      expect(config.launch).toBe("browser");
      pipe(config.relayUrl, O.isSome, assertTrue);
      expect(O.getOrNull(config.name)).toBe("release");

      const defaults = yield* StatelyInspectorConfigFromEnv.parse(ConfigProvider.fromUnknown({}));
      expect(defaults.enabled).toBe(false);
      expect(defaults.launch).toBe("none");
      assertNone(defaults.relayUrl);
    })
  );

  it("the live layer type requires only configuration", () => {
    const layer: Layer.Layer<StatelyInspector, ConfigError> = StatelyInspector.layer;
    expect(layer).toBeDefined();
  });
});
