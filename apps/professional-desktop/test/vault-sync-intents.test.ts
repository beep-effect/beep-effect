import * as Domain from "@alchemy.run/domain";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import {
  VAULT_SYNC_RPC_PATH,
  VaultSyncMembership,
  VaultSyncSessionLive,
  VaultSyncSidecarChannelLive,
} from "@beep/documents-server/aggregates/Sync";
import { VaultSyncApi, VaultSyncModel, VaultSyncPolicies } from "@beep/documents-use-cases/aggregates/VaultSync";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { beforeEach, describe, expect } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  VAULT_SYNC_INTENT_QUEUE_KEY,
  vaultSyncConfirmingAtom,
  vaultSyncFlushAtom,
  vaultSyncIntentQueueAtom,
  vaultSyncIntentTransportLayerAtom,
  vaultSyncLinkAtom,
  vaultSyncPredictionAtom,
  vaultSyncRefusalsAtom,
  vaultSyncReplayOnReconnectAtom,
  vaultSyncServerStateAtom,
  vaultSyncSubmitAtom,
} from "@/sync/VaultSyncIntent.atoms";
import { VaultSyncAction, VaultSyncIntent, VaultSyncIntentQueue } from "@/sync/VaultSyncIntent.model";
import { foldIntents, predictIntent, VaultSyncServerState } from "@/sync/VaultSyncIntent.prediction";
import {
  layerVaultSyncIntentTransport,
  resolveVaultSyncApiUrl,
  VAULT_SYNC_API_PATH,
  VaultSyncIntentTransport,
  VaultSyncUnreachable,
} from "@/sync/VaultSyncIntent.transport";
import { layerDesktopVaultSyncBinding } from "@/sync/VaultSyncSession";

const workspaceId = WorkspaceIdentity.WorkspaceId.make(1);
const destinationId = V.DestinationId.make("documents_sync_destination_adesktopvault");
const now = DateTime.makeUnsafe(0);

const active: V.DestinationState = {
  _tag: "Registered",
  orgId: 1,
  workspaceId: 1,
  name: "Vault",
  provider: "box",
  rootId: null,
  cursor: null,
  cursorError: null,
  paused: false,
  paths: H.empty(),
};

const intentOf = (commandId: string, action: VaultSyncAction) =>
  VaultSyncIntent.make({ commandId, destinationId, queuedAt: 0, action });

const pause = VaultSyncAction.cases.pause.make({});
const resume = VaultSyncAction.cases.resume.make({});
const requestSync = VaultSyncAction.cases["request-sync"].make({});

const server = (destination: V.DestinationState) =>
  VaultSyncServerState.make({ destinationId, destination, conflicts: H.empty() });

// The desktop principal holds an active member grant on organization 1, workspace 1 only.
const membership = Layer.succeed(
  VaultSyncMembership,
  VaultSyncMembership.of({
    read: Effect.fn("test.membership")(function* (_userId, scope) {
      return scope.orgId === 1 && scope.workspaceId === 1
        ? [V.VaultSyncGrant.make({ ...scope, diagnostic: false })]
        : [];
    }),
  })
);

// The vault-sync Api as the sidecar hosts it: the in-memory platform, the sidecar session
// adapter and the live policy. Only the Box side (sagas) is absent.
const hostLayer = VaultSyncSessionLive.pipe(
  Layer.provideMerge(VaultSyncSidecarChannelLive),
  Layer.provideMerge(VaultSyncModel.layer(VaultSyncPolicies).pipe(Layer.provide(Domain.InMemory))),
  Layer.provideMerge(Layer.mergeAll(layerDesktopVaultSyncBinding(Redacted.make("launch-token")), membership))
);

type Switch = {
  readonly online: Ref.Ref<boolean>;
  readonly loseNextAnswer: Ref.Ref<boolean>;
  readonly sent: Ref.Ref<ReadonlyArray<string>>;
};

// The renderer-to-sidecar hop: offline fails every call before it leaves the renderer, and a
// lost answer delivers the command but drops the response, which is an unknown outcome.
const switchable = (inner: VaultSyncIntentTransport["Service"], gate: Switch) =>
  VaultSyncIntentTransport.of({
    read: Effect.fn("test.read")(function* (id) {
      const online = yield* Ref.get(gate.online);
      if (!online) return yield* VaultSyncUnreachable.make({});
      return yield* inner.read(id);
    }),
    send: Effect.fn("test.send")(function* (intent) {
      const online = yield* Ref.get(gate.online);
      if (!online) return yield* VaultSyncUnreachable.make({});
      yield* Ref.update(gate.sent, A.append(intent.commandId));
      yield* inner.send(intent);
      const lost = yield* Ref.getAndSet(gate.loseNextAnswer, false);
      if (lost) return yield* VaultSyncUnreachable.make({});
    }),
  });

const host = Effect.gen(function* () {
  const context = yield* Layer.build(hostLayer);
  const destinations = Context.get(context, V.SyncDestination);
  yield* destinations.send(destinationId, V.RegisterDestination.make({ orgId: 1, workspaceId: 1, name: "Vault" }));
  const transportContext = yield* Layer.build(
    layerVaultSyncIntentTransport.pipe(
      Layer.provide(VaultSyncApi.layerClientInProcess),
      Layer.provide(Layer.succeedContext(context))
    )
  );
  const inner = Context.get(transportContext, VaultSyncIntentTransport);
  // Views project asynchronously: wait until the destination is readable through the Api.
  yield* inner.read(1).pipe(
    Effect.repeat({
      until: (state) => O.exists(state, (value) => value.destination._tag === "Registered"),
      times: 5000,
    })
  );
  const gate: Switch = {
    online: yield* Ref.make(true),
    loseNextAnswer: yield* Ref.make(false),
    sent: yield* Ref.make<ReadonlyArray<string>>([]),
  };
  // Another actor (the CLI, a second window) acting on the server directly.
  const outOfBand = (command: V.PauseDestination | V.ResumeDestination) =>
    destinations.send(destinationId, command).pipe(Effect.asVoid);
  // The aggregate's authoritative state, independent of View projection lag.
  const authority = destinations.state(destinationId).pipe(Effect.asSome);
  // Wait until the Api's Views have projected the aggregate's current paused flag.
  const projected = Effect.flatMap(authority, (state) =>
    inner.read(1).pipe(
      Effect.repeat({
        until: (value) => isPaused(O.map(value, (s) => s.destination)) === isPaused(state),
        times: 5000,
      })
    )
  );
  return { authority, gate, inner, outOfBand, projected, transport: switchable(inner, gate) };
});

const decodeStoredQueue = S.decodeEffect(S.fromJsonString(VaultSyncIntentQueue));

const storedCommandIds = Effect.suspend(() =>
  decodeStoredQueue(globalThis.localStorage.getItem(VAULT_SYNC_INTENT_QUEUE_KEY) ?? "[]")
).pipe(Effect.map(A.map((intent) => intent.commandId)));

const registryFor = (transport: VaultSyncIntentTransport["Service"]) =>
  Effect.acquireRelease(
    Effect.sync(() =>
      AtomRegistry.make({
        initialValues: [[vaultSyncIntentTransportLayerAtom, Layer.succeed(VaultSyncIntentTransport, transport)]],
      })
    ),
    (registry) => Effect.sync(() => registry.dispose())
  );

const waitFor = <A>(
  registry: AtomRegistry.AtomRegistry,
  atom: Parameters<typeof AtomRegistry.toStream<A>>[1],
  until: (value: A) => boolean
) =>
  AtomRegistry.toStream(registry, atom).pipe(
    Stream.filter(until),
    Stream.take(1),
    Stream.runDrain,
    Effect.timeoutOrElse({
      duration: Duration.seconds(5),
      orElse: () => Effect.die("vault sync atom never reached the expected value"),
    })
  );

const loadServerState = (registry: AtomRegistry.AtomRegistry) =>
  AtomRegistry.getResult(registry, vaultSyncServerStateAtom(workspaceId));

const queueOf = (registry: AtomRegistry.AtomRegistry): VaultSyncIntentQueue => registry.get(vaultSyncIntentQueueAtom);

const submit = Effect.fn("test.submit")(function* (registry: AtomRegistry.AtomRegistry, action: VaultSyncAction) {
  const atom = vaultSyncSubmitAtom(workspaceId);
  registry.mount(atom);
  registry.set(atom, action);
  yield* AtomRegistry.getResult(registry, atom);
});

const flush = Effect.fn("test.flush")(function* (registry: AtomRegistry.AtomRegistry) {
  const atom = vaultSyncFlushAtom(workspaceId);
  registry.mount(atom);
  registry.set(atom, undefined);
  return yield* AtomRegistry.getResult(registry, atom);
});

const destinationOf = (registry: AtomRegistry.AtomRegistry) =>
  O.flatten(registry.get(vaultSyncPredictionAtom(workspaceId))).pipe(O.map((prediction) => prediction.destination));

const isPaused = (state: O.Option<V.DestinationState>) =>
  O.exists(state, (value) => value._tag === "Registered" && value.paused);

describe("vault sync intent prediction", () => {
  it("predicts with the destination's own decide and evolve", () => {
    const paused = predictIntent(active, H.empty(), intentOf("c1", pause), now);
    expect(paused.outcome).toBe("accepted");
    expect(paused.destination._tag === "Registered" && paused.destination.paused).toBe(true);

    const refused = predictIntent(paused.destination, H.empty(), intentOf("c2", requestSync), now);
    expect(refused.outcome).toBe("rejected");
    deepStrictEqual(
      O.map(refused.rejection, (rejection) => (rejection._tag === "SyncRuleViolation" ? rejection.rule : null)),
      O.some<V.SyncRule | null>("destination-paused")
    );
    expect(refused.destination).toBe(paused.destination);
  });

  it("folds queued intents in order and reverts an intent by dropping it", () => {
    const queue = [intentOf("c1", pause), intentOf("c2", resume), intentOf("c3", pause)];
    const folded = foldIntents(server(active), queue, now);
    expect(A.map(folded.intents, (entry) => entry.outcome)).toEqual(["accepted", "accepted", "accepted"]);
    expect(folded.destination._tag === "Registered" && folded.destination.paused).toBe(true);

    const reverted = foldIntents(server(active), A.take(queue, 2), now);
    expect(reverted.destination._tag === "Registered" && reverted.destination.paused).toBe(false);
  });

  it("predicts a review of a conflict the server no longer reports as a rejection", () => {
    const review = VaultSyncAction.cases["review-conflict"].make({
      conflictId: V.ConflictId.make("documents_sync_conflict_a1"),
      remoteEventId: "evt-1",
      workspaceId: 1,
      healOperationId: V.OperationId.make("documents_sync_operation_a1"),
    });
    const step = predictIntent(active, H.empty(), intentOf("c1", review), now);
    expect(step.outcome).toBe("rejected");
    expect(step.destination).toBe(active);
  });

  it("ignores intents queued for another destination", () => {
    const foreign = VaultSyncIntent.make({
      commandId: "c1",
      destinationId: V.DestinationId.make("documents_sync_destination_aforeign"),
      queuedAt: 0,
      action: pause,
    });
    expect(foldIntents(server(active), [foreign], now).pending).toEqual([]);
  });

  it("pins the renderer Api path to the sidecar route", () => {
    expect(VAULT_SYNC_API_PATH).toBe(VAULT_SYNC_RPC_PATH);
    expect(resolveVaultSyncApiUrl({ location: { origin: "http://127.0.0.1:1421" } })).toBe(
      "http://127.0.0.1:1421/vault-sync/rpc"
    );
  });
});

// The queue persists to the one jsdom localStorage, so these run one at a time.
describe("vault sync intent queue", { concurrent: false }, () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
  });

  it.effect(
    "replays queued intents in order with their stable command ids on reconnect",
    Effect.fnUntraced(function* () {
      const { authority, gate, transport } = yield* host;
      const registry = yield* registryFor(transport);
      registry.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(registry);
      yield* Ref.set(gate.online, false);

      yield* submit(registry, pause);
      yield* submit(registry, resume);
      yield* submit(registry, pause);
      const queued = A.map(queueOf(registry), (intent) => intent.commandId);
      expect(queued).toHaveLength(3);
      expect(isPaused(destinationOf(registry))).toBe(true);
      const sentOffline = yield* Ref.get(gate.sent);
      expect(sentOffline).toEqual([]);

      // The browser comes back online: the mounted replay atom flushes the queue.
      yield* Ref.set(gate.online, true);
      registry.mount(vaultSyncReplayOnReconnectAtom(workspaceId));
      globalThis.window.dispatchEvent(new Event("online"));
      yield* waitFor(registry, vaultSyncIntentQueueAtom, A.isReadonlyArrayEmpty);

      const sent = yield* Ref.get(gate.sent);
      expect(A.dedupe(sent)).toEqual(queued);
      expect(registry.get(vaultSyncLinkAtom)).toBe("online");
      // Pause, resume, pause applied in that order leaves the destination paused.
      const finalState = yield* authority;
      expect(isPaused(finalState)).toBe(true);
    })
  );

  it.effect(
    "keeps an accepted intent predicted until a server read shows its effect",
    Effect.fnUntraced(function* () {
      const { authority, transport } = yield* host;
      const registry = yield* registryFor(transport);
      registry.mount(vaultSyncIntentQueueAtom);
      registry.mount(vaultSyncPredictionAtom(workspaceId));
      yield* loadServerState(registry);
      const seen: Array<boolean> = [];
      const unsubscribe = registry.subscribe(vaultSyncPredictionAtom(workspaceId), (value) => {
        const destination = O.flatten(value).pipe(O.map((prediction) => prediction.destination));
        if (O.isSome(destination)) seen.push(isPaused(destination));
      });

      yield* submit(registry, pause);
      yield* flush(registry);
      yield* waitFor(registry, vaultSyncConfirmingAtom, A.isReadonlyArrayEmpty);
      unsubscribe();

      // Once predicted paused, the panel never flashes back to the stale active state.
      const firstPaused = seen.indexOf(true);
      expect(firstPaused).toBeGreaterThanOrEqual(0);
      expect(A.drop(seen, firstPaused)).not.toContain(false);
      expect(queueOf(registry)).toEqual([]);
      const server = registry.get(vaultSyncServerStateAtom(workspaceId)).pipe(AsyncResult.value, O.flatten);
      expect(isPaused(O.map(server, (state) => state.destination))).toBe(true);
      const finalState = yield* authority;
      expect(isPaused(finalState)).toBe(true);
    })
  );

  it.effect(
    "resends an intent whose answer was lost and the server dedupes it by command id",
    Effect.fnUntraced(function* () {
      const { authority, gate, outOfBand, transport } = yield* host;
      const registry = yield* registryFor(transport);
      registry.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(registry);

      // The pause commits on the server but its answer never reaches the renderer.
      yield* Ref.set(gate.loseNextAnswer, true);
      yield* submit(registry, pause);
      yield* waitFor(registry, vaultSyncLinkAtom, (link) => link === "offline");
      const [lost] = queueOf(registry);
      expect(lost?.action.kind).toBe("pause");

      // Someone resumes the destination meanwhile; a second decide of the lost pause would
      // pause it again, the deduped replay must not.
      yield* outOfBand(V.ResumeDestination.make({}));
      yield* flush(registry);

      expect(queueOf(registry)).toEqual([]);
      expect(registry.get(vaultSyncRefusalsAtom)).toEqual([]);
      const resent = yield* Ref.get(gate.sent);
      expect(resent).toEqual([lost?.commandId, lost?.commandId]);
      const finalState = yield* authority;
      expect(isPaused(finalState)).toBe(false);
    })
  );

  it.effect(
    "reverts a prediction the server rejects and surfaces the typed rejection",
    Effect.fnUntraced(function* () {
      const { gate, outOfBand, projected, transport } = yield* host;
      const registry = yield* registryFor(transport);
      registry.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(registry);
      yield* Ref.set(gate.online, false);

      yield* submit(registry, requestSync);
      const prediction = O.flatten(registry.get(vaultSyncPredictionAtom(workspaceId)));
      deepStrictEqual(
        O.map(prediction, (value) => A.map(value.intents, (entry) => entry.outcome)),
        O.some(["accepted"])
      );

      // The destination was paused elsewhere while the renderer was offline.
      yield* outOfBand(V.PauseDestination.make({}));
      yield* projected;
      yield* Ref.set(gate.online, true);
      yield* flush(registry);

      expect(queueOf(registry)).toEqual([]);
      const [refusal] = registry.get(vaultSyncRefusalsAtom);
      expect(refusal?.source).toBe("server");
      expect(refusal?.intentKind).toBe("request-sync");
      expect(refusal?.reason._tag === "SyncRuleViolation" && refusal.reason.rule).toBe("destination-paused");
      // The refreshed server state is the authority now: paused, nothing pending.
      yield* waitFor(registry, vaultSyncPredictionAtom(workspaceId), (value) =>
        O.exists(O.flatten(value), (p) => p.destination._tag === "Registered" && p.destination.paused)
      );
      deepStrictEqual(
        O.map(O.flatten(registry.get(vaultSyncPredictionAtom(workspaceId))), (p) => p.pending),
        O.some([])
      );
    })
  );

  it.effect(
    "shows a predicted rejection at once and never queues the intent",
    Effect.fnUntraced(function* () {
      const { gate, outOfBand, projected, transport } = yield* host;
      yield* outOfBand(V.PauseDestination.make({}));
      yield* projected;
      const registry = yield* registryFor(transport);
      registry.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(registry);

      yield* submit(registry, requestSync);

      expect(queueOf(registry)).toEqual([]);
      const sentOffline = yield* Ref.get(gate.sent);
      expect(sentOffline).toEqual([]);
      const [refusal] = registry.get(vaultSyncRefusalsAtom);
      expect(refusal?.source).toBe("predicted");
    })
  );
  it.effect(
    "predicts queued intents on the last known snapshot after a reload with the sidecar unreachable",
    Effect.fnUntraced(function* () {
      const { gate, transport } = yield* host;
      const first = yield* registryFor(transport);
      first.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(first);
      yield* Ref.set(gate.online, false);
      yield* submit(first, pause);
      first.dispose();

      const reloaded = yield* registryFor(transport);
      reloaded.mount(vaultSyncPredictionAtom(workspaceId));
      const server = yield* Effect.flip(loadServerState(reloaded));
      expect(server._tag).toBe("VaultSyncUnreachable");
      // No answer since the reload, yet the destination and the queued pause are both shown.
      expect(isPaused(destinationOf(reloaded))).toBe(true);
      deepStrictEqual(
        O.map(O.flatten(reloaded.get(vaultSyncPredictionAtom(workspaceId))), (p) => A.length(p.pending)),
        O.some(1)
      );
    })
  );

  it.effect(
    "persists a queued intent and restores it after a reload",
    Effect.fnUntraced(function* () {
      const { gate, transport } = yield* host;
      const first = yield* registryFor(transport);
      first.mount(vaultSyncIntentQueueAtom);
      yield* loadServerState(first);
      yield* Ref.set(gate.online, false);

      yield* submit(first, pause);
      yield* waitFor(first, vaultSyncLinkAtom, (link) => link === "offline");
      const queued = queueOf(first);
      expect(A.map(queued, (intent) => intent.action.kind)).toEqual(["pause"]);
      expect(isPaused(destinationOf(first))).toBe(true);
      const stored = yield* storedCommandIds;
      expect(stored).toEqual(A.map(queued, (intent) => intent.commandId));
      first.dispose();

      // A fresh registry is a renderer reload: the queue comes back from storage, same ids.
      const reloaded = yield* registryFor(transport);
      reloaded.mount(vaultSyncIntentQueueAtom);
      expect(A.map(queueOf(reloaded), (intent) => intent.commandId)).toEqual(
        A.map(queued, (intent) => intent.commandId)
      );
    })
  );
});
