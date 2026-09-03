import { VaultSyncActionError } from "@beep/documents-use-cases/public";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import { AtomRegistry, Reactivity } from "effect/unstable/reactivity";
import { describe, expect } from "vitest";
import {
  DesktopSyncClient,
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncPanelStateAtoms,
} from "@/sync/Sync.atoms";

const workspaceA = WorkspaceIdentity.WorkspaceId.make(1);
const workspaceB = WorkspaceIdentity.WorkspaceId.make(2);
const conflictId = SyncConflictId.make(1);

const waitForPanelState = (
  registry: AtomRegistry.AtomRegistry,
  workspaceId: WorkspaceIdentity.WorkspaceId,
  predicate: (state: VaultSyncPanelState) => boolean
): Effect.Effect<void, string> =>
  Effect.suspend(() =>
    predicate(registry.get(vaultSyncPanelStateAtoms(workspaceId)))
      ? Effect.void
      : Effect.fail("vault sync panel state has not reached the expected variant")
  ).pipe(
    Effect.retry(
      Schedule.spaced(Duration.millis(10)).pipe(Schedule.upTo({ duration: Duration.seconds(3), times: 300 }))
    )
  );

const registryWithClient = (client: DesktopSyncClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [DesktopSyncClient.runtime.layer, Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer)],
    ],
  });

describe("vault sync command atoms", () => {
  it.live(
    "runs different workspace command families independently",
    Effect.fnUntraced(function* () {
      const releaseA = yield* Deferred.make<void>();
      const releaseB = yield* Deferred.make<void>();
      const client = DesktopSyncClient.of(((
        tag: string,
        payload: { readonly workspaceId: WorkspaceIdentity.WorkspaceId }
      ) =>
        tag === "TriggerVaultSync"
          ? Deferred.await(Equal.equals(payload.workspaceId, workspaceA) ? releaseA : releaseB)
          : Effect.die(`unexpected vault sync RPC: ${tag}`)) as unknown as DesktopSyncClient["Service"]);
      const registry = registryWithClient(client);
      const actionA = vaultSyncCommandAtoms(workspaceA);
      const actionB = vaultSyncCommandAtoms(workspaceB);
      registry.mount(vaultSyncPanelStateAtoms(workspaceA));
      registry.mount(vaultSyncPanelStateAtoms(workspaceB));
      registry.mount(actionA);
      registry.mount(actionB);

      registry.set(actionA, VaultSyncCommand.cases.trigger.make());
      registry.set(actionB, VaultSyncCommand.cases.trigger.make());
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.syncing);
      yield* waitForPanelState(registry, workspaceB, VaultSyncPanelState.guards.syncing);

      yield* Deferred.succeed(releaseB, undefined);
      yield* waitForPanelState(registry, workspaceB, VaultSyncPanelState.guards.succeeded);
      expect(VaultSyncPanelState.guards.syncing(registry.get(vaultSyncPanelStateAtoms(workspaceA)))).toBe(true);

      yield* Deferred.succeed(releaseA, undefined);
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.succeeded);
      yield* AtomRegistry.getResult(registry, actionA);
      yield* AtomRegistry.getResult(registry, actionB);
      registry.dispose();
    })
  );

  it.live(
    "serializes a same-workspace review behind the active sync command",
    Effect.fnUntraced(function* () {
      const releaseTrigger = yield* Deferred.make<void>();
      const releaseReview = yield* Deferred.make<never, VaultSyncActionError>();
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const client = DesktopSyncClient.of(((tag: string) => {
        const recordCall = Ref.update(calls, A.append(tag));
        return tag === "TriggerVaultSync"
          ? recordCall.pipe(Effect.andThen(Deferred.await(releaseTrigger)))
          : tag === "MarkVaultSyncConflictReviewed"
            ? recordCall.pipe(Effect.andThen(Deferred.await(releaseReview)))
            : Effect.die(`unexpected vault sync RPC: ${tag}`);
      }) as unknown as DesktopSyncClient["Service"]);
      const registry = registryWithClient(client);
      const action = vaultSyncCommandAtoms(workspaceA);
      registry.mount(vaultSyncPanelStateAtoms(workspaceA));
      registry.mount(action);

      registry.set(action, VaultSyncCommand.cases.trigger.make());
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.syncing);
      registry.set(action, VaultSyncCommand.cases.review.make({ conflictId }));
      yield* Effect.sleep(25);
      expect(yield* Ref.get(calls)).toStrictEqual(["TriggerVaultSync"]);

      yield* Deferred.succeed(releaseTrigger, undefined);
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.reviewing);
      expect(yield* Ref.get(calls)).toStrictEqual(["TriggerVaultSync", "MarkVaultSyncConflictReviewed"]);

      yield* Deferred.fail(releaseReview, VaultSyncActionError.new("Review failed safely."));
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.failed);
      const finalState = registry.get(vaultSyncPanelStateAtoms(workspaceA));
      expect(VaultSyncPanelState.guards.failed(finalState) ? finalState.message : "").toBe("Review failed safely.");
      yield* AtomRegistry.getResult(registry, action);
      registry.dispose();
    })
  );
});
