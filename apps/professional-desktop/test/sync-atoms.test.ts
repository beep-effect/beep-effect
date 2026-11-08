import { VaultSyncStatus } from "@beep/documents-use-cases/public";
import * as WorkspaceIdentity from "@beep/shared-domain/identity/Workspace";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { DesktopSyncClient, vaultSyncStatusAtom } from "@/sync/Sync.atoms";

const workspaceA = WorkspaceIdentity.WorkspaceId.make(1);

const registryWithClient = (client: DesktopSyncClient["Service"]) =>
  AtomRegistry.make({
    initialValues: [
      [DesktopSyncClient.runtime.layer, Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer)],
    ],
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

  it.effect(
    "clears the disconnect state when the sidecar pushes a reconnected frame after a probe",
    Effect.fnUntraced(function* () {
      const decode = S.decodeUnknownEffect(VaultSyncStatus);
      const status = (connected: boolean, disconnectReason: string | null) =>
        decode({
          conflictItems: 0,
          connected,
          disconnectReason,
          currentItems: 0,
          cursorPosition: null,
          errorItems: 0,
          failedOperations: 0,
          openConflicts: 0,
          pendingItems: 0,
          probedAt: null,
          provider: "box",
          queuedOperations: 0,
        });
      const disconnected = yield* status(false, "transient");
      const reconnected = yield* status(true, null);
      const probed = yield* Deferred.make<void>();
      const calls = yield* Ref.make<ReadonlyArray<string>>([]);
      // The sidecar pushes the availability change itself: the panel issues no status re-read.
      const client = DesktopSyncClient.of(((tag: string) =>
        tag === "WatchVaultSyncStatus"
          ? Stream.concat(
              Stream.make(disconnected),
              Stream.fromEffect(probed.pipe(Deferred.await, Effect.as(reconnected)))
            ).pipe(Stream.tap(() => Ref.update(calls, A.append(tag))))
          : Effect.die(`unexpected vault sync RPC: ${tag}`)) as unknown as DesktopSyncClient["Service"]);
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => registryWithClient(client)),
        (registry) => Effect.sync(() => registry.dispose())
      );
      const atom = vaultSyncStatusAtom(workspaceA);
      registry.mount(atom);
      const reaches = (connected: boolean) =>
        AtomRegistry.toStream(registry, atom).pipe(
          Stream.filter(AsyncResult.isSuccess),
          Stream.map((result) => result.value),
          Stream.filter((value) => value.connected === connected),
          Stream.runHead,
          Effect.flatMap(Effect.fromOption)
        );
      const before = yield* reaches(false);
      assertSome(before.disconnectReason, "transient");
      yield* Deferred.succeed(probed, undefined);
      const after = yield* reaches(true);
      assertNone(after.disconnectReason);
      const seen = yield* Ref.get(calls);
      expect(seen).toEqual(["WatchVaultSyncStatus", "WatchVaultSyncStatus"]);
    })
  );
});
