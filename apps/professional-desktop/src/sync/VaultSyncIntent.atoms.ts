/**
 * Optimistic vault-sync intents: predict locally, persist the queue, replay in order on reconnect.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { $ProfessionalDesktopId } from "@beep/identity/packages";
import { LogRedactedCauseOptions, logRedactedCause } from "@beep/observability/CauseRedaction";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Result from "effect/Result";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";
import { vaultSyncConflictsAtom, vaultSyncRetryConnectionAtoms, vaultSyncStatusAtom } from "./Sync.atoms.ts";
import { VaultSyncIntent, VaultSyncIntentQueue, VaultSyncRefusal } from "./VaultSyncIntent.model.ts";
import { foldIntents, predictIntent, VaultSyncServerState } from "./VaultSyncIntent.prediction.ts";
import { VaultSyncIntentTransport, VaultSyncIntentTransportUnavailable } from "./VaultSyncIntent.transport.ts";
import type * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import type { VaultSyncAction, VaultSyncLink } from "./VaultSyncIntent.model.ts";
import type { VaultSyncPrediction } from "./VaultSyncIntent.prediction.ts";

const $I = $ProfessionalDesktopId.create("sync/VaultSyncIntent.atoms");

/**
 * localStorage key of the persisted intent queue.
 *
 * @category configuration
 * @since 0.0.0
 */
export const VAULT_SYNC_INTENT_QUEUE_KEY = "vault-sync:intent-queue:v1";

/**
 * The transport the intent runtime uses; the shell binds the Api transport once the sidecar
 * session is known.
 *
 * **Example** (Default transport)
 *
 * ```ts
 * import { vaultSyncIntentTransportLayerAtom } from "@/sync/VaultSyncIntent.atoms"
 *
 * console.log(typeof vaultSyncIntentTransportLayerAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncIntentTransportLayerAtom = Atom.make<Layer.Layer<VaultSyncIntentTransport>>(
  VaultSyncIntentTransportUnavailable
).pipe(Atom.keepAlive);

/**
 * Runtime that provides the bound {@link VaultSyncIntentTransport}.
 *
 * @category atoms
 * @since 0.0.0
 */
const vaultSyncIntentRuntime = professionalBrowserRuntime.factory((get) =>
  Layer.merge(Layer.fresh(get(vaultSyncIntentTransportLayerAtom)), SecureRandom.layerWebCrypto)
);

// Built per call: storage is read at call time, so a cleared or swapped localStorage is seen.
// Built per call: storage is read at call time, so a cleared or swapped localStorage is seen.
const storageStore = <Schema extends S.ConstraintCodec<unknown, unknown>>(schema: Schema) =>
  KeyValueStore.toSchemaStore(
    Context.get(
      KeyValueStore.layerStorage(() => globalThis.localStorage).pipe(Layer.build, Effect.scoped, Effect.runSync),
      KeyValueStore.KeyValueStore
    ),
    schema
  );

// Storage is synchronous, so reads and writes are synchronous too: every change is on disk
// before the next one, in order, and nothing is lost between them.
const readStored = <Schema extends S.ConstraintCodec<unknown, unknown>>(
  schema: Schema,
  key: string,
  fallback: () => Schema["Type"]
): Schema["Type"] =>
  storageStore(schema)
    .get(key)
    .pipe(
      Effect.map(O.getOrElse(fallback)),
      // An unreadable or undecodable entry is dropped rather than wedging the panel.
      Effect.orElseSucceed(fallback),
      Effect.runSync
    );

const writeStored = <Schema extends S.ConstraintCodec<unknown, unknown>>(
  schema: Schema,
  key: string,
  value: Schema["Type"]
): void =>
  storageStore(schema)
    .set(key, value)
    .pipe(
      Effect.catchCause((cause) =>
        logRedactedCause(
          cause,
          LogRedactedCauseOptions.make({
            message: "professional desktop vault sync state could not be persisted",
            level: "Warn",
            attributes: { subsystem: "vault_sync" },
          })
        )
      ),
      Effect.runSync
    );

const readStoredQueue = () => readStored(VaultSyncIntentQueue, VAULT_SYNC_INTENT_QUEUE_KEY, A.empty<VaultSyncIntent>);

/**
 * The persisted FIFO of intents not yet answered by the sidecar; it survives reloads.
 *
 * **Details**
 *
 * Reads and writes go straight to `localStorage` through a schema-checked key-value store, so
 * each change is persisted before the next one and a removed intent cannot reappear on reload.
 *
 * **Example** (Queue atom)
 *
 * ```ts
 * import { vaultSyncIntentQueueAtom } from "@/sync/VaultSyncIntent.atoms"
 *
 * console.log(typeof vaultSyncIntentQueueAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncIntentQueueAtom = Atom.writable(readStoredQueue, (ctx, queue: VaultSyncIntentQueue) => {
  writeStored(VaultSyncIntentQueue, VAULT_SYNC_INTENT_QUEUE_KEY, queue);
  ctx.setSelf(queue);
}).pipe(Atom.keepAlive);

/**
 * localStorage key prefix of the last server snapshot, one per workspace.
 *
 * @category configuration
 * @since 0.0.0
 */
const VAULT_SYNC_SNAPSHOT_KEY = "vault-sync:server-snapshot:v1";

const VaultSyncStoredSnapshot = S.NullOr(VaultSyncServerState);

// Path claims are item bookkeeping the panel's commands never read; keep the snapshot small.
const slimSnapshot = (state: VaultSyncServerState) =>
  state.destination._tag === "Registered"
    ? VaultSyncServerState.make({ ...state, destination: { ...state.destination, paths: H.empty() } })
    : state;

/**
 * The last destination state the sidecar reported, persisted so a reload while the sidecar is
 * unreachable still shows the destination and the queued intents' predictions on top of it.
 *
 * **Details**
 *
 * It is a cache, never an authority: every successful read replaces it, and the panel labels a
 * prediction built on it as last known.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncSnapshotAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) => {
  const key = `${VAULT_SYNC_SNAPSHOT_KEY}:${workspaceId}`;
  return Atom.writable(
    () => O.fromNullOr(readStored(VaultSyncStoredSnapshot, key, () => null)),
    (ctx, snapshot: O.Option<VaultSyncServerState>) => {
      const slim = O.map(snapshot, slimSnapshot);
      writeStored(VaultSyncStoredSnapshot, key, O.getOrNull(slim));
      ctx.setSelf(slim);
    }
  ).pipe(Atom.keepAlive);
});

const initialLink = (): VaultSyncLink => (typeof navigator === "undefined" || navigator.onLine ? "online" : "offline");

/**
 * Whether the last vault-sync call reached the sidecar.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncLinkAtom = Atom.make<VaultSyncLink>(initialLink()).pipe(Atom.keepAlive);

/**
 * Refused intents, newest last, until the operator dismisses them.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncRefusalsAtom = Atom.make<ReadonlyArray<VaultSyncRefusal>>(A.empty()).pipe(Atom.keepAlive);

/**
 * An intent the sidecar accepted, kept until a server read shows its effect.
 *
 * **Details**
 *
 * `reads` counts the server reads that did not show it yet; the read bound stops waiting on an
 * effect another actor may already have reversed.
 *
 * @category models
 * @since 0.0.0
 */
class VaultSyncConfirming extends S.Opaque<VaultSyncConfirming, { readonly brand: unique symbol }>()(
  S.Struct({ intent: VaultSyncIntent, reads: S.Int }).pipe(
    $I.annoteSchema("VaultSyncConfirming", {
      description: "An accepted vault-sync intent waiting for a server read that includes its effect.",
    })
  )
) {}

/**
 * How many server reads an accepted intent waits for its effect before the server state wins.
 *
 * @category configuration
 * @since 0.0.0
 */
const VAULT_SYNC_CONFIRM_READS = 10;

const sameDestination = S.toEquivalence(V.DestinationState);

// Views are eventually consistent: an accepted intent is shown once deciding it again against the
// fresh server state changes nothing, i.e. its effect is already in what the server reports.
const reflected = (server: VaultSyncServerState, intent: VaultSyncIntent, now: DateTime.Utc) => {
  const step = predictIntent(server.destination, server.conflicts, intent, now);
  return step.outcome !== "accepted" || sameDestination(step.destination, server.destination);
};

/**
 * Accepted intents whose writes the last server read may not include yet.
 *
 * **Details**
 *
 * They leave the persisted queue the moment the sidecar accepts them, so they are never resent,
 * but the prediction keeps folding them until a server read shows their effect. Without this the
 * panel would flash back to the stale server state between the answer and the projected View.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncConfirmingAtom = Atom.make<ReadonlyArray<VaultSyncConfirming>>(A.empty()).pipe(Atom.keepAlive);

/**
 * The workspace's destination and open conflicts as the sidecar last reported them.
 *
 * **Example** (Server state atom)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncServerStateAtom } from "@/sync/VaultSyncIntent.atoms"
 *
 * console.log(typeof vaultSyncServerStateAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID) === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncServerStateAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  vaultSyncIntentRuntime.atom((get) => {
    // Tracked: an accepted intent re-reads the server until the read shows its effect.
    const confirming = get(vaultSyncConfirmingAtom);
    return Effect.gen(function* () {
      const transport = yield* VaultSyncIntentTransport;
      const registry = yield* AtomRegistry.AtomRegistry;
      // A re-read after one that did not show the effect yet gives the projection a moment.
      if (A.some(confirming, (entry) => entry.reads > 0)) yield* Effect.sleep("150 millis");
      const state = yield* transport.read(workspaceId).pipe(
        Effect.tap((fresh) =>
          Effect.sync(() => {
            registry.set(vaultSyncLinkAtom, "online");
            registry.set(vaultSyncSnapshotAtom(workspaceId), fresh);
          })
        ),
        Effect.tapError((error) =>
          Effect.sync(() => {
            if (error._tag === "VaultSyncUnreachable") registry.set(vaultSyncLinkAtom, "offline");
          })
        )
      );
      if (A.isReadonlyArrayNonEmpty(confirming)) {
        const now = yield* DateTime.now;
        const shown = (intent: VaultSyncIntent) =>
          O.match(state, { onNone: () => true, onSome: (server) => reflected(server, intent, now) });
        registry.set(
          vaultSyncConfirmingAtom,
          A.filterMap(registry.get(vaultSyncConfirmingAtom), (entry) =>
            !A.some(confirming, (seen) => seen.intent.commandId === entry.intent.commandId)
              ? Result.succeed(entry)
              : shown(entry.intent) || entry.reads + 1 >= VAULT_SYNC_CONFIRM_READS
                ? Result.failVoid
                : Result.succeed(VaultSyncConfirming.make({ intent: entry.intent, reads: entry.reads + 1 }))
          )
        );
      }
      return state;
    });
  })
);

/**
 * Server state folded with the intents still queued: what the panel shows before confirmation.
 *
 * **Details**
 *
 * A failed refresh keeps the last server state, so queued intents stay predicted while the sidecar
 * is unreachable. `None` means no destination is registered for the workspace yet.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncPredictionAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  Atom.make((get): O.Option<O.Option<VaultSyncPrediction>> => {
    // Before the first answer after a reload, predict on the last known snapshot.
    const server = O.orElse(AsyncResult.value(get(vaultSyncServerStateAtom(workspaceId))), () =>
      O.map(get(vaultSyncSnapshotAtom(workspaceId)), O.some)
    );
    const confirming = A.map(get(vaultSyncConfirmingAtom), (entry) => entry.intent);
    const queue = A.appendAll(confirming, get(vaultSyncIntentQueueAtom));
    const now = DateTime.nowUnsafe();
    return O.map(
      server,
      O.map((state) => foldIntents(state, queue, now))
    );
  })
);

const removeIntent = (queue: VaultSyncIntentQueue, commandId: string) =>
  A.filter(queue, (intent) => intent.commandId !== commandId);

const appendRefusal = (refusals: ReadonlyArray<VaultSyncRefusal>, refusal: VaultSyncRefusal) =>
  A.append(
    A.filter(refusals, (existing) => existing.commandId !== refusal.commandId),
    refusal
  );

const flushSemaphore = Semaphore.makeUnsafe(1);

// Reads and writes go through the registry service, never a fn's own context: a concurrent fn's
// context is torn down when the fn is triggered again, and its later writes would be dropped.
// The server-state re-read is driven by vaultSyncConfirmingAtom (accepted) or the refusal path.
const refreshLegacyReads = (registry: AtomRegistry.AtomRegistry, workspaceId: WorkspaceIdentity.WorkspaceId) => {
  registry.refresh(vaultSyncStatusAtom(workspaceId));
  registry.refresh(vaultSyncConflictsAtom(workspaceId));
};

type Delivery = { readonly _tag: "accepted" } | { readonly _tag: "refused" } | { readonly _tag: "unreachable" };

const deliverHead = Effect.fn("documents.vault_sync.intent.deliver")(function* (
  transport: VaultSyncIntentTransport["Service"],
  intent: VaultSyncIntent,
  registry: AtomRegistry.AtomRegistry
) {
  yield* Effect.annotateCurrentSpan({
    "documents.vault_sync.command": intent.action.kind,
    "documents.vault_sync.command_id": intent.commandId,
  });
  return yield* transport.send(intent).pipe(
    Effect.as<Delivery>({ _tag: "accepted" }),
    Effect.catchTags({
      VaultSyncRefused: ({ reason }) =>
        Effect.sync(() => {
          registry.set(
            vaultSyncRefusalsAtom,
            appendRefusal(
              registry.get(vaultSyncRefusalsAtom),
              VaultSyncRefusal.make({
                commandId: intent.commandId,
                intentKind: intent.action.kind,
                source: "server",
                reason,
              })
            )
          );
          return { _tag: "refused" } as const;
        }),
      VaultSyncUnreachable: () => Effect.succeed<Delivery>({ _tag: "unreachable" }),
    })
  );
});

/**
 * Replay the queue in order until it is empty or the sidecar stops answering.
 *
 * **Details**
 *
 * One flush runs at a time. Each head intent is resent with its persisted command id, so a replay
 * of a command whose answer was lost returns the first receipt. A refusal removes the intent and
 * records the typed rejection, which reverts its prediction. An unreachable sidecar leaves the
 * intent at the head and marks the link offline.
 *
 * **Example** (Flush atom)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncFlushAtom } from "@/sync/VaultSyncIntent.atoms"
 *
 * console.log(typeof vaultSyncFlushAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID) === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncFlushAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  vaultSyncIntentRuntime.fn<void>()(
    Effect.fnUntraced(function* () {
      const transport = yield* VaultSyncIntentTransport;
      const registry = yield* AtomRegistry.AtomRegistry;
      const drain: Effect.Effect<number> = Effect.suspend(() => {
        const head = A.head(registry.get(vaultSyncIntentQueueAtom));
        if (O.isNone(head)) return Effect.succeed(0);
        const intent = head.value;
        return deliverHead(transport, intent, registry).pipe(
          Effect.flatMap((delivery) => {
            if (delivery._tag === "unreachable") {
              registry.set(vaultSyncLinkAtom, "offline");
              return Effect.succeed(0);
            }
            // Answered: drop it from the persisted queue first, so nothing can resend it.
            registry.set(
              vaultSyncIntentQueueAtom,
              removeIntent(registry.get(vaultSyncIntentQueueAtom), intent.commandId)
            );
            registry.set(vaultSyncLinkAtom, "online");
            if (delivery._tag === "accepted") {
              // Accepted: keep predicting it until a server read shows its effect.
              registry.set(
                vaultSyncConfirmingAtom,
                A.append(registry.get(vaultSyncConfirmingAtom), VaultSyncConfirming.make({ intent, reads: 0 }))
              );
              // An accepted probe re-reads the connection with a forced probe, so the
              // disconnect note reflects Box now rather than the sidecar's cached answer.
              if (intent.action.kind === "probe") registry.set(vaultSyncRetryConnectionAtoms(workspaceId), undefined);
            } else {
              // Refused: the queue no longer predicts it; re-read the authority now.
              registry.refresh(vaultSyncServerStateAtom(workspaceId));
            }
            return Effect.map(drain, (rest) => rest + 1);
          })
        );
      });
      const delivered = yield* flushSemaphore.withPermit(drain);
      if (delivered > 0) refreshLegacyReads(registry, workspaceId);
      return delivered;
    }),
    { concurrent: true }
  )
);

const allocateCommandId = Effect.gen(function* () {
  const random = yield* SecureRandom.SecureRandom;
  const id = yield* random.uuidV7();
  // A RequestToken: the command id doubles as the request id the destination records.
  return `vault-sync_${id}`;
});

/**
 * Predict one operator action, queue it with a fresh command id and start a replay.
 *
 * **Details**
 *
 * The action is decided first against the predicted state with the domain's own decide. A local
 * rejection is shown at once and never queued, because the server would refuse the same command
 * against the same state. An accepted or unpredictable action is persisted before it is sent.
 *
 * **Example** (Submit atom)
 *
 * ```ts
 * import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace"
 * import { vaultSyncSubmitAtom } from "@/sync/VaultSyncIntent.atoms"
 *
 * console.log(typeof vaultSyncSubmitAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID) === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncSubmitAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  vaultSyncIntentRuntime.fn<VaultSyncAction>()(
    Effect.fnUntraced(
      function* (action) {
        const registry = yield* AtomRegistry.AtomRegistry;
        const prediction = O.flatten(registry.get(vaultSyncPredictionAtom(workspaceId)));
        if (O.isNone(prediction)) return yield* Effect.logWarning("vault sync intent has no destination");
        const commandId = yield* allocateCommandId;
        const now = yield* DateTime.now;
        const intent = VaultSyncIntent.make({
          commandId,
          destinationId: prediction.value.server.destinationId,
          queuedAt: DateTime.toEpochMillis(now),
          action,
        });
        const predicted = predictIntent(prediction.value.destination, prediction.value.server.conflicts, intent, now);
        if (predicted.outcome === "rejected" && O.isSome(predicted.rejection)) {
          registry.set(
            vaultSyncRefusalsAtom,
            appendRefusal(
              registry.get(vaultSyncRefusalsAtom),
              VaultSyncRefusal.make({
                commandId,
                intentKind: action.kind,
                source: "predicted",
                reason: predicted.rejection.value,
              })
            )
          );
          return;
        }
        registry.set(vaultSyncIntentQueueAtom, A.append(registry.get(vaultSyncIntentQueueAtom), intent));
        registry.set(vaultSyncFlushAtom(workspaceId), undefined);
      },
      Effect.catchCause((cause) =>
        logRedactedCause(
          cause,
          LogRedactedCauseOptions.make({
            message: "professional desktop vault sync intent submit failed",
            level: "Warn",
            attributes: { subsystem: "vault_sync" },
          })
        )
      )
    ),
    { concurrent: true }
  )
);

/**
 * Dismiss one refusal notice.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncDismissRefusalAtom = Atom.fnSync((commandId: string, get) => {
  get.set(
    vaultSyncRefusalsAtom,
    A.filter(get(vaultSyncRefusalsAtom), (refusal) => refusal.commandId !== commandId)
  );
});

const browserLinkEvents = (onOnline: () => void, onOffline: () => void) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      if (typeof window === "undefined") return;
      window.addEventListener("online", onOnline);
      window.addEventListener("offline", onOffline);
    }),
    () =>
      Effect.sync(() => {
        if (typeof window === "undefined") return;
        window.removeEventListener("online", onOnline);
        window.removeEventListener("offline", onOffline);
      })
  );

/**
 * Mounted by the panel: replays the queue at startup and whenever the browser comes back online.
 *
 * **Details**
 *
 * The browser `offline` event marks the link offline without dropping anything; `online` starts a
 * replay, which confirms the link only when the sidecar actually answers. The replay is driven
 * through the registry, not from an atom read, so a flush is never torn down by its own trigger.
 *
 * @category atoms
 * @since 0.0.0
 */
export const vaultSyncReplayOnReconnectAtom = Atom.family((workspaceId: WorkspaceIdentity.WorkspaceId) =>
  vaultSyncIntentRuntime.atom(
    Effect.fnUntraced(function* () {
      const registry = yield* AtomRegistry.AtomRegistry;
      const flush = vaultSyncFlushAtom(workspaceId);
      const unmount = registry.mount(flush);
      yield* Effect.addFinalizer(() => Effect.sync(unmount));
      const replay = () => registry.set(flush, undefined);
      yield* browserLinkEvents(replay, () => registry.set(vaultSyncLinkAtom, "offline"));
      replay();
    })
  )
);
