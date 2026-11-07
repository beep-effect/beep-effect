import { VaultSyncActionError } from "@beep/documents-use-cases/public";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";
import {
  DesktopSyncClient,
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncPanelStateAtoms,
} from "@/sync/Sync.atoms";
import {
  enqueueIntent,
  reviewQueued,
  triggerQueued,
  VaultSyncIntent,
  vaultSyncIntentQueueAtom,
  withoutIntent,
} from "@/sync/VaultSyncIntents";

const workspace = WorkspaceIdentity.WorkspaceId.make(1);
const conflictId = SyncConflictId.make(7);

/** What the stub sidecar does with each command: unreachable, accept, or reject. */
type Mode = "unreachable" | "accept" | "reject";

/** A stub client whose behaviour the test switches between phases, recording every command it receives. */
const stubClient = () => {
  let mode: Mode = "unreachable";
  const received: Array<{ readonly tag: string; readonly payload: unknown }> = [];
  const client = DesktopSyncClient.of(((tag: string, payload: unknown) =>
    Effect.suspend(() => {
      received.push({ tag, payload });
      if (mode === "unreachable") return Effect.die("sidecar unreachable");
      if (mode === "reject") return VaultSyncActionError.failEffect("Review failed safely.");
      // The command atoms discard the success value.
      return Effect.void;
    })) as unknown as DesktopSyncClient["Service"]);
  return {
    client,
    received,
    setMode: (next: Mode) => {
      mode = next;
    },
  };
};

const registryWithClient = (client: DesktopSyncClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [DesktopSyncClient.runtime.layer, Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer)],
    ],
  });

const waitForPanelState = (registry: AtomRegistry.AtomRegistry, predicate: (state: VaultSyncPanelState) => boolean) =>
  AtomRegistry.toStream(registry, vaultSyncPanelStateAtoms(workspace)).pipe(
    Stream.filter(predicate),
    Stream.take(1),
    Stream.runDrain,
    Effect.timeoutOrElse({
      duration: Duration.seconds(3),
      orElse: () => Effect.fail("vault sync panel state has not reached the expected variant"),
    })
  );

const withRegistry = (client: DesktopSyncClient["Service"]) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      globalThis.localStorage.clear();
      const registry = registryWithClient(client);
      registry.mount(vaultSyncPanelStateAtoms(workspace));
      registry.mount(vaultSyncCommandAtoms(workspace));
      registry.mount(vaultSyncIntentQueueAtom);
      return registry;
    }),
    (registry) => Effect.sync(() => registry.dispose())
  );

describe("vault sync intent queue", () => {
  it.effect("dedupes a second trigger and a second review of one conflict", () =>
    Effect.sync(() => {
      const trigger = VaultSyncIntent.cases.trigger.make({ intentId: "t-1", workspaceId: workspace, queuedAt: 0 });
      const review = VaultSyncIntent.cases.review.make({
        intentId: "r-1",
        workspaceId: workspace,
        queuedAt: 1,
        conflictId,
      });
      const queue = [trigger, review].reduce(enqueueIntent, enqueueIntent([], trigger));
      const again = enqueueIntent(queue, VaultSyncIntent.cases.review.make({ ...review, intentId: "r-2" }));
      expect(A.map(again, ({ intentId }) => intentId)).toEqual(["t-1", "r-1"]);
      expect(triggerQueued(again, workspace)).toBe(true);
      expect(reviewQueued(again, workspace, conflictId)).toBe(true);
      expect(reviewQueued(withoutIntent(again, "r-1"), workspace, conflictId)).toBe(false);
    })
  );

  it.live("queues a trigger the sidecar cannot take, persists it, and replays it once with one intent id", () =>
    Effect.gen(function* () {
      const stub = stubClient();
      const registry = yield* withRegistry(stub.client);
      const command = vaultSyncCommandAtoms(workspace);

      registry.set(command, VaultSyncCommand.cases.trigger.make({}));
      yield* waitForPanelState(registry, VaultSyncPanelState.guards.queued);
      expect(triggerQueued(registry.get(vaultSyncIntentQueueAtom), workspace)).toBe(true);
      // Persisted: the queue survives a reload of the renderer.
      expect(globalThis.localStorage.getItem("beep.professional.vault-sync.intents.v1")).toContain("trigger");

      // Still unreachable: the replay keeps it queued.
      registry.set(command, VaultSyncCommand.cases.replay.make({}));
      yield* waitForPanelState(registry, VaultSyncPanelState.guards.queued);
      expect(registry.get(vaultSyncIntentQueueAtom)).toHaveLength(1);

      stub.setMode("accept");
      registry.set(command, VaultSyncCommand.cases.replay.make({}));
      yield* waitForPanelState(registry, VaultSyncPanelState.guards.succeeded);
      expect(registry.get(vaultSyncIntentQueueAtom)).toEqual([]);

      const triggers = A.filter(stub.received, ({ tag }) => tag === "TriggerVaultSync");
      const ids = A.map(triggers, ({ payload }) => (payload as { readonly intentId?: string }).intentId);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(1);
    }).pipe(Effect.scoped)
  );

  it.live("reverts a queued review the server rejects on replay", () =>
    Effect.gen(function* () {
      const stub = stubClient();
      const registry = yield* withRegistry(stub.client);
      const command = vaultSyncCommandAtoms(workspace);

      registry.set(command, VaultSyncCommand.cases.review.make({ conflictId }));
      yield* waitForPanelState(registry, VaultSyncPanelState.guards.queued);
      // Predicted: the conflict reads as reviewed while the review waits.
      expect(reviewQueued(registry.get(vaultSyncIntentQueueAtom), workspace, conflictId)).toBe(true);

      stub.setMode("reject");
      registry.set(command, VaultSyncCommand.cases.replay.make({}));
      yield* waitForPanelState(registry, VaultSyncPanelState.guards.failed);
      expect(reviewQueued(registry.get(vaultSyncIntentQueueAtom), workspace, conflictId)).toBe(false);
      const state = registry.get(vaultSyncPanelStateAtoms(workspace));
      expect(VaultSyncPanelState.guards.failed(state) ? state.message : "").toBe("Review failed safely.");
    }).pipe(Effect.scoped)
  );
});
