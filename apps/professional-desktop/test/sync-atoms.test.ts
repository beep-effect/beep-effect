import { VaultSyncActionError, VaultSyncStatus } from "@beep/documents-use-cases/public";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import {
  DesktopSyncClient,
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncPanelStateAtoms,
  vaultSyncStatusAtom,
} from "@/sync/Sync.atoms";

const workspaceA = WorkspaceIdentity.WorkspaceId.make(1);
const workspaceB = WorkspaceIdentity.WorkspaceId.make(2);
const conflictId = SyncConflictId.make(1);

const waitForPanelState = (
  registry: AtomRegistry.AtomRegistry,
  workspaceId: WorkspaceIdentity.WorkspaceId,
  predicate: (state: VaultSyncPanelState) => boolean
): Effect.Effect<void, string> =>
  AtomRegistry.toStream(registry, vaultSyncPanelStateAtoms(workspaceId)).pipe(
    Stream.filter(predicate),
    Stream.take(1),
    Stream.runDrain,
    Effect.timeoutOrElse({
      duration: Duration.seconds(3),
      orElse: () => Effect.fail("vault sync panel state has not reached the expected variant"),
    })
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const actionA = vaultSyncCommandAtoms(workspaceA);
      const actionB = vaultSyncCommandAtoms(workspaceB);
      registry.mount(vaultSyncPanelStateAtoms(workspaceA));
      registry.mount(vaultSyncPanelStateAtoms(workspaceB));
      registry.mount(actionA);
      registry.mount(actionB);

      registry.set(actionA, VaultSyncCommand.cases.trigger.make({}));
      registry.set(actionB, VaultSyncCommand.cases.trigger.make({}));
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.syncing);
      yield* waitForPanelState(registry, workspaceB, VaultSyncPanelState.guards.syncing);

      yield* Deferred.succeed(releaseB, undefined);
      yield* waitForPanelState(registry, workspaceB, VaultSyncPanelState.guards.succeeded);
      expect(VaultSyncPanelState.guards.syncing(registry.get(vaultSyncPanelStateAtoms(workspaceA)))).toBe(true);

      yield* Deferred.succeed(releaseA, undefined);
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.succeeded);
      yield* AtomRegistry.getResult(registry, actionA);
      yield* AtomRegistry.getResult(registry, actionB);
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const action = vaultSyncCommandAtoms(workspaceA);
      registry.mount(vaultSyncPanelStateAtoms(workspaceA));
      registry.mount(action);

      registry.set(action, VaultSyncCommand.cases.trigger.make({}));
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.syncing);
      registry.set(action, VaultSyncCommand.cases.review.make({ conflictId }));
      yield* Effect.sleep(25);
      const got = yield* Ref.get(calls);
      expect(got).toStrictEqual(["TriggerVaultSync"]);

      yield* Deferred.succeed(releaseTrigger, undefined);
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.reviewing);
      const got1 = yield* Ref.get(calls);
      expect(got1).toStrictEqual(["TriggerVaultSync", "MarkVaultSyncConflictReviewed"]);

      yield* Deferred.fail(releaseReview, VaultSyncActionError.new("Review failed safely."));
      yield* waitForPanelState(registry, workspaceA, VaultSyncPanelState.guards.failed);
      const finalState = registry.get(vaultSyncPanelStateAtoms(workspaceA));
      expect(VaultSyncPanelState.guards.failed(finalState) ? finalState.message : "").toBe("Review failed safely.");
      yield* AtomRegistry.getResult(registry, action);
    })
  );
});

describe("vault sync status subscription", () => {
  it.effect(
    "updates the status atom from the watch stream when the pass finishes",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(VaultSyncStatus);
      const status = (pendingItems: number, currentItems: number) =>
        decode({
          conflictItems: 0,
          connected: true,
          disconnectReason: null,
          currentItems,
          cursorPosition: null,
          errorItems: 0,
          failedOperations: 0,
          openConflicts: 0,
          pendingItems,
          probedAt: null,
          provider: "box",
          queuedOperations: 0,
        });
      const accepted = yield* status(2, 0);
      const finished = yield* status(0, 2);
      const finish = yield* Deferred.make<void>();
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      const client = DesktopSyncClient.of(((tag: string) =>
        tag === "WatchVaultSyncStatus"
          ? Stream.concat(
              Stream.make(accepted),
              Stream.fromEffect(
                Effect.gen(function* () {
                  yield* Deferred.await(finish);
                  return finished;
                })
              )
            ).pipe(Stream.tap(() => Ref.update(calls, A.append(tag))))
          : Effect.die(`unexpected vault sync RPC: ${tag}`)) as unknown as DesktopSyncClient["Service"]);
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const atom = vaultSyncStatusAtom(workspaceA);
      registry.mount(atom);
      const reaches = (wanted: VaultSyncStatus) =>
        AtomRegistry.toStream(registry, atom).pipe(
          Stream.filter((result) => AsyncResult.isSuccess(result) && result.value.currentItems === wanted.currentItems),
          Stream.take(1),
          Stream.runDrain
        );
      yield* reaches(accepted);
      yield* Deferred.succeed(finish, undefined);
      yield* reaches(finished);
      const seen = yield* Ref.get(calls);
      // One subscription delivered both frames; no status re-read was issued.
      expect(seen).toEqual(["WatchVaultSyncStatus", "WatchVaultSyncStatus"]);
    })
  );
});
