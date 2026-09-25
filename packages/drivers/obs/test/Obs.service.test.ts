import { $ObsId } from "@beep/identity/packages";
import {
  Obs,
  ObsError,
  ObsHello,
  ObsIdentified,
  ObsProtocol,
  ObsRecordStateChangedEvent,
  StartRecordingRequest,
} from "@beep/obs";
import { it } from "@beep/test-runner";
import { A, O, P, pipe } from "@beep/utils";
import { assert, describe, expect } from "@effect/vitest";
import { Context, Effect, flow, Layer, PubSub, Ref, Stream } from "effect";
import type { ObsEvent, ObsProtocolShape, ObsRequestType } from "@beep/obs";
import type { UnknownRecord } from "@beep/schema";

type PublishEvent = (event: ObsEvent) => Effect.Effect<void>;

type StubHandler = (
  requestData: O.Option<UnknownRecord>,
  publish: PublishEvent
) => Effect.Effect<O.Option<UnknownRecord>, ObsError>;

type RecordedRequest = {
  readonly requestData: O.Option<UnknownRecord>;
  readonly requestType: ObsRequestType;
};

const respondWith =
  (handlers: Partial<Record<ObsRequestType, StubHandler>>) =>
  (requestType: ObsRequestType, requestData: O.Option<UnknownRecord>, publish: PublishEvent) =>
    pipe(
      O.fromUndefinedOr(handlers[requestType]),
      O.match({
        onNone: () => Effect.succeed(O.none<UnknownRecord>()),
        onSome: (handler) => handler(requestData, publish),
      })
    );

type StubResponder = ReturnType<typeof respondWith>;

const makeStubProtocol = Effect.fnUntraced(function* (respond: StubResponder) {
  const events = yield* Effect.acquireRelease(PubSub.sliding<ObsEvent>(64), PubSub.shutdown);
  const calls = yield* Ref.make(A.empty<RecordedRequest>());
  const publish: PublishEvent = (event) => PubSub.publish(events, event).pipe(Effect.asVoid);
  const protocol: ObsProtocolShape = {
    events: Stream.fromPubSub(events),
    hello: ObsHello.make({ obsWebSocketVersion: "5.5.2", rpcVersion: 1 }),
    identified: ObsIdentified.make({ negotiatedRpcVersion: 1 }),
    request: (requestType, requestData) =>
      Ref.update(calls, A.append({ requestData: O.fromUndefinedOr(requestData), requestType })).pipe(
        Effect.andThen(respond(requestType, O.fromUndefinedOr(requestData), publish))
      ),
    subscribeEvents: PubSub.subscribe(events),
  };
  return { calls: Ref.get(calls), protocol };
});

const $I = $ObsId.create("test/Obs.service.test");
class ObsFixture extends Context.Service<ObsFixture, Effect.Success<ReturnType<typeof makeStubProtocol>>>()(
  $I`ObsFixture`
) {}

// Every registration builds a separate fixture; mutable protocol state is never
// shared between cases. The unnamed layer block contains exactly one test.
const makeObsLayer = (handlers: Effect.Effect<Partial<Record<ObsRequestType, StubHandler>>>) => {
  const fixture = Layer.effect(ObsFixture, handlers.pipe(Effect.flatMap(flow(respondWith, makeStubProtocol))));
  const protocol = Layer.effect(
    ObsProtocol,
    Effect.map(ObsFixture, ({ protocol }) => protocol)
  ).pipe(Layer.provideMerge(fixture));
  return Obs.layer.pipe(Layer.provideMerge(protocol));
};

const calledTypes = (calls: ReadonlyArray<RecordedRequest>): ReadonlyArray<ObsRequestType> =>
  A.map(calls, (call) => call.requestType);

describe("Obs", () => {
  it.layer(
    makeObsLayer(
      Effect.succeed({
        GetVersion: () =>
          Effect.succeedSome({
            availableRequests: [],
            obsVersion: "32.1.2",
            obsWebSocketVersion: "5.5.2",
            platform: "ubuntu",
            platformDescription: "CachyOS Linux",
            rpcVersion: 1,
            supportedImageFormats: [],
          }),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "ensureRunning decodes GetVersion and reports the spawn origin",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;

        const result = yield* obs.ensureRunning;
        expect(result.spawned).toBe(false);
        expect(result.obsVersion).toBe("32.1.2");
        expect(result.obsWebSocketVersion).toBe("5.5.2");
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.gen(function* () {
        const inputExists = yield* Ref.make(false);
        return {
          CreateInput: () =>
            Ref.set(inputExists, true).pipe(Effect.as(O.some({ inputUuid: "uuid-1", sceneItemId: 1 }))),
          GetInputSettings: () =>
            Ref.get(inputExists).pipe(
              Effect.flatMap((exists) =>
                exists
                  ? Effect.succeedSome({
                      inputKind: "pipewire-screen-capture-source",
                      inputSettings: { RestoreToken: "portal-token-1", ShowCursor: true },
                    })
                  : Effect.fail(
                      ObsError.make({
                        message: "No source was found by the name of `beep-qa-capture`.",
                        operation: "request",
                        requestStatusCode: O.some(600),
                      })
                    )
              )
            ),
          GetSceneList: () => Effect.succeedSome({ currentProgramSceneName: null, scenes: [] }),
        };
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "ensureQaScene provisions the scene and input when missing and reads back the restore token",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;
        const { calls } = yield* ObsFixture;
        const result = yield* obs.ensureQaScene();
        expect(result.sceneCreated).toBe(true);
        expect(result.inputCreated).toBe(true);
        expect(result.sceneName).toBe("beep-qa");
        expect(result.inputName).toBe("beep-qa-capture");
        assert(O.isSome(result.restoreToken));
        expect(result.restoreToken.value).toBe("portal-token-1");
        const requestTypes = calledTypes(yield* calls);
        expect(A.contains(requestTypes, "CreateScene")).toBe(true);
        expect(A.contains(requestTypes, "CreateInput")).toBe(true);
        expect(A.contains(requestTypes, "SetCurrentProgramScene")).toBe(true);
        expect(A.contains(requestTypes, "GetSceneItemList")).toBe(false);
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        GetInputSettings: () =>
          Effect.succeedSome({
            inputKind: "pipewire-screen-capture-source",
            inputSettings: { RestoreToken: "portal-token-2" },
          }),
        GetSceneItemList: () => Effect.succeedSome({ sceneItems: [{ sceneItemId: 1, sourceName: "beep-qa-capture" }] }),
        GetSceneList: () =>
          Effect.succeedSome({
            currentProgramSceneName: "beep-qa",
            scenes: [{ sceneIndex: 0, sceneName: "beep-qa", sceneUuid: "scene-uuid-1" }],
          }),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "ensureQaScene is idempotent when the scene and input already exist and the input is attached",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;
        const { calls } = yield* ObsFixture;
        const result = yield* obs.ensureQaScene();
        expect(result.sceneCreated).toBe(false);
        expect(result.inputCreated).toBe(false);
        assert(O.isSome(result.restoreToken));
        expect(result.restoreToken.value).toBe("portal-token-2");
        const requestTypes = calledTypes(yield* calls);
        expect(A.contains(requestTypes, "CreateScene")).toBe(false);
        expect(A.contains(requestTypes, "CreateInput")).toBe(false);
        expect(A.contains(requestTypes, "CreateSceneItem")).toBe(false);
        expect(A.contains(requestTypes, "SetCurrentProgramScene")).toBe(true);
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        CreateSceneItem: () => Effect.succeedSome({ sceneItemId: 7 }),
        GetInputSettings: () =>
          Effect.succeedSome({
            inputKind: "pipewire-screen-capture-source",
            inputSettings: { RestoreToken: "portal-token-3" },
          }),
        // The input exists globally (attached to some other scene), so the
        // freshly-considered QA scene's item list does not reference it.
        GetSceneItemList: () =>
          Effect.succeedSome({ sceneItems: [{ sceneItemId: 2, sourceName: "unrelated-source" }] }),
        GetSceneList: () =>
          Effect.succeedSome({
            currentProgramSceneName: "beep-qa",
            scenes: [{ sceneIndex: 0, sceneName: "beep-qa", sceneUuid: "scene-uuid-1" }],
          }),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "ensureQaScene attaches a pre-existing global input that is missing from the QA scene",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;
        const { calls } = yield* ObsFixture;
        const result = yield* obs.ensureQaScene();
        expect(result.inputCreated).toBe(false);
        const recorded = yield* calls;
        expect(A.contains(calledTypes(recorded), "CreateInput")).toBe(false);
        const createSceneItem = A.findFirst(recorded, (call) => call.requestType === "CreateSceneItem");
        assert(O.isSome(createSceneItem));
        assert(O.isSome(createSceneItem.value.requestData));
        expect(createSceneItem.value.requestData.value).toEqual({
          sceneName: "beep-qa",
          sourceName: "beep-qa-capture",
        });
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        StartRecord: (_, publish) =>
          publish(
            ObsRecordStateChangedEvent.make({
              outputActive: true,
              outputPath: O.none(),
              outputState: "OBS_WEBSOCKET_OUTPUT_STARTED",
            })
          ).pipe(Effect.as(O.none<UnknownRecord>())),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "startRecording sets the record directory, awaits STARTED, and anchors the clock",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;
        const { calls } = yield* ObsFixture;
        yield* Effect.log("OBS recording phase: configure directory, send StartRecord, await STARTED");
        const result = yield* obs.startRecording(StartRecordingRequest.make({ recordDirectory: "/tmp/beep-qa-video" }));
        expect(result.recordDirectory).toBe("/tmp/beep-qa-video");
        expect(P.isNumber(result.recordStartEpochMs)).toBe(true);
        const recorded = yield* calls;
        const setDirectory = A.findFirst(recorded, (call) => call.requestType === "SetRecordDirectory");
        assert(O.isSome(setDirectory));
        assert(O.isSome(setDirectory.value.requestData));
        expect(setDirectory.value.requestData.value).toEqual({ recordDirectory: "/tmp/beep-qa-video" });
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        StopRecord: (_, publish) =>
          publish(
            ObsRecordStateChangedEvent.make({
              outputActive: false,
              outputPath: O.some("/tmp/beep-qa-video/from-event.mkv"),
              outputState: "OBS_WEBSOCKET_OUTPUT_STOPPED",
            })
          ).pipe(Effect.as(O.some({ outputPath: "/tmp/beep-qa-video/capture.mkv" }))),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "stopRecording returns the authoritative StopRecord outputPath after awaiting STOPPED",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;

        yield* Effect.log("OBS recording phase: send StopRecord, await STOPPED");
        const result = yield* obs.stopRecording();
        expect(result.outputPath).toBe("/tmp/beep-qa-video/capture.mkv");
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        GetRecordStatus: () =>
          Effect.succeedSome({
            outputActive: true,
            outputBytes: 1024,
            outputDuration: 1500,
            outputPaused: false,
            outputTimecode: "00:00:01.500",
          }),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "recordStatus decodes GetRecordStatus",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;

        const status = yield* obs.recordStatus;
        expect(status.outputActive).toBe(true);
        expect(status.outputPaused).toBe(false);
        expect(status.outputDuration).toBe(1500);
      })
    );
  });

  it.layer(
    makeObsLayer(
      Effect.succeed({
        GetRecordStatus: () => Effect.succeed(O.none<UnknownRecord>()),
      })
    ),
    { timeout: "5 seconds" }
  )((caseIt) => {
    caseIt.effect(
      "recordStatus fails with a typed ObsError when the response carries no data",
      Effect.fnUntraced(function* () {
        const obs = yield* Obs;

        const error = yield* obs.recordStatus.pipe(Effect.flip);
        assert(ObsError.is(error));
        expect(error.operation).toBe("recordStatus");
        assert(O.isSome(error.requestType));
        expect(error.requestType.value).toBe("GetRecordStatus");
      })
    );
  });
});
