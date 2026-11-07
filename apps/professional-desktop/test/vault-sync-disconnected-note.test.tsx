import { VaultSyncPanel } from "@/sync/VaultSyncPanel";
import "@testing-library/jest-dom/vitest";
import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { SyncConflict as DomainSyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import { DmsMirrorDisconnectReason, VaultSyncActionError, VaultSyncStatus } from "@beep/documents-use-cases/public";
import { SyncConflictId } from "@beep/shared-domain/identity/Documents/SyncConflictId";
import { it } from "@beep/test-runner";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import * as A from "effect/Array";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as H from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { DesktopSyncClient, vaultSyncConflictsAtom, vaultSyncStatusAtom } from "@/sync/Sync.atoms";
import {
  vaultSyncIntentQueueAtom,
  vaultSyncIntentTransportLayerAtom,
  vaultSyncLinkAtom,
  vaultSyncRefusalsAtom,
  vaultSyncServerStateAtom,
  vaultSyncSnapshotAtom,
} from "@/sync/VaultSyncIntent.atoms";
import { VaultSyncAction, VaultSyncIntent, VaultSyncRefusal } from "@/sync/VaultSyncIntent.model";
import { VaultSyncServerState } from "@/sync/VaultSyncIntent.prediction";
import { VaultSyncIntentTransport, VaultSyncUnreachable } from "@/sync/VaultSyncIntent.transport";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";

const decodeVaultSyncStatus = S.decodeEffect(VaultSyncStatus);

const statusWith = (
  connected: boolean,
  disconnectReason: O.Option<DmsMirrorDisconnectReason>,
  probedAt: O.Option<string> = O.none()
) =>
  decodeVaultSyncStatus({
    conflictItems: 0,
    connected,
    disconnectReason: O.getOrNull(disconnectReason),
    currentItems: 0,
    cursorPosition: null,
    errorItems: 0,
    failedOperations: 0,
    openConflicts: 0,
    pendingItems: 0,
    probedAt: O.getOrNull(probedAt),
    provider: "box",
    queuedOperations: 0,
  });

const noConflicts: ReadonlyArray<SyncConflict> = [];

const destinationId = V.DestinationId.make("documents_sync_destination_adesktopvault");

const serverState = (paused = false) =>
  VaultSyncServerState.make({
    destinationId,
    destination: {
      _tag: "Registered",
      orgId: 1,
      workspaceId: 1,
      name: "Vault",
      provider: "box",
      rootId: null,
      cursor: null,
      cursorError: null,
      paused,
      paths: H.empty(),
    },
    conflicts: H.empty(),
  });

// A transport that records every send and never answers, so a prediction stays pending.
const pendingTransport = (sent: Ref.Ref<ReadonlyArray<VaultSyncIntent>>) =>
  Layer.succeed(
    VaultSyncIntentTransport,
    VaultSyncIntentTransport.of({
      read: Effect.fn("test.read")(function* () {
        return O.some(serverState());
      }),
      send: Effect.fn("test.send")(function* (intent) {
        yield* Ref.update(sent, A.append(intent));
        return yield* Effect.never;
      }),
    })
  );

const renderWithStatus = (
  status: VaultSyncStatus,
  conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown> = AsyncResult.success(noConflicts),
  extra: ReadonlyArray<readonly [unknown, unknown]> = []
) =>
  render(
    <RegistryProvider
      initialValues={[
        [vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(status)],
        [vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), conflicts],
        [vaultSyncServerStateAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(O.some(serverState()))],
        ...(extra as ReadonlyArray<readonly [never, never]>),
      ]}
    >
      <VaultSyncPanel floating={false} />
    </RegistryProvider>
  );

// The panel persists its intent queue to the shared jsdom localStorage: one test at a time.
describe("vault sync panel", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.clear();
  });

  it.effect(
    "shows a server refusal with its typed rule and lets the operator dismiss it",
    Effect.fnUntraced(function* () {
      const connected = yield* statusWith(true, O.none());
      const refusal = VaultSyncRefusal.make({
        commandId: "vault-sync_1",
        intentKind: "request-sync",
        source: "server",
        reason: V.SyncRuleViolation.make({ rule: "destination-paused", evidence: "destination state" }),
      });
      const { container } = renderWithStatus(connected, AsyncResult.success(noConflicts), [
        [vaultSyncRefusalsAtom, [refusal]],
      ]);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-refusal")).toHaveTextContent("Sync now was refused: destination paused.");
      expect(screen.getByTestId("vault-sync-refusal")).toHaveAttribute("role", "alert");
      fireEvent.click(screen.getByTestId("vault-sync-refusal-dismiss"));
      expect(screen.queryByTestId("vault-sync-refusal")).not.toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-trigger")).toBeEnabled();
    })
  );

  it.effect(
    "lists intents queued while the sidecar is offline and offers a retry",
    Effect.fnUntraced(function* () {
      const connected = yield* statusWith(true, O.none());
      const queued = VaultSyncIntent.make({
        commandId: "vault-sync_2",
        destinationId,
        queuedAt: 0,
        action: VaultSyncAction.cases.pause.make({}),
      });
      const { container } = renderWithStatus(connected, AsyncResult.success(noConflicts), [
        [vaultSyncIntentQueueAtom, [queued]],
        [vaultSyncLinkAtom, "offline"],
      ]);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-offline")).toHaveTextContent("sidecar offline");
      // Box state is only the last answer while the sidecar is unreachable.
      expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("connected (last known)");
      expect(screen.getByTestId("vault-sync-connection")).toHaveAttribute("data-last-known", "true");
      expect(screen.getByTestId("vault-sync-destination-last-known")).toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-pending")).toHaveTextContent("Queued until the sidecar answers (1)");
      expect(screen.getByTestId("vault-sync-pending-intent")).toHaveTextContent("Pause sync");
      expect(screen.getByTestId("vault-sync-pending-retry")).toBeEnabled();
      // The queued pause is already predicted: the destination reads paused, pending confirmation.
      expect(screen.getByTestId("vault-sync-destination-state")).toHaveTextContent("paused");
      expect(screen.getByTestId("vault-sync-destination-predicted")).toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
    })
  );

  it.effect(
    "predicts a pause before the sidecar answers",
    Effect.fnUntraced(function* () {
      const sent = yield* Ref.make<ReadonlyArray<VaultSyncIntent>>([]);
      const connected = yield* statusWith(true, O.none());
      const { container } = renderWithStatus(connected, AsyncResult.success(noConflicts), [
        [vaultSyncIntentTransportLayerAtom, pendingTransport(sent)],
      ]);
      const screen = within(container);
      expect(screen.getByTestId("vault-sync-destination-state")).toHaveTextContent("active");

      fireEvent.click(screen.getByTestId("vault-sync-pause-toggle"));

      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getByTestId("vault-sync-destination-state")).toHaveTextContent("paused"))
      );
      expect(screen.getByTestId("vault-sync-destination-predicted")).toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-pause-toggle")).toHaveTextContent("Resume sync");
      const intents = yield* Ref.get(sent);
      expect(A.map(intents, (intent) => intent.action.kind)).toEqual(["pause"]);
    })
  );

  it.effect(
    "sends Sync now and a conflict review as intents and marks the review queued",
    Effect.fnUntraced(function* () {
      const sent = yield* Ref.make<ReadonlyArray<VaultSyncIntent>>([]);
      const connected = yield* statusWith(true, O.none());
      const conflict = yield* S.decodeEffect(DomainSyncConflict)({
        conflictKind: "remoteEdit",
        createdAt: 1,
        createdByPrincipal: { kind: "System", component: "Runtime" },
        entityType: SyncConflictId.entityType,
        id: 1,
        localRelPath: "matters/vault/notes.md",
        orgId: 1,
        provider: "box",
        publicId: "documents_sync_conflict_a1",
        remoteEventId: "evt-1",
        remoteId: "1234567890",
        remotePayload: { eventType: "ITEM_MODIFY" },
        resolutionStatus: "open",
        rowVersion: 1,
        schemaVersion: "0.0.0",
        source: "System",
        syncItemId: 1,
        updatedAt: 1,
        updatedByPrincipal: { kind: "System", component: "Runtime" },
        workspaceId: 1,
      });
      const record = V.ConflictRecord.make({
        publicId: V.ConflictId.make("documents_sync_conflict_a1"),
        destinationId,
        workspaceId: 1,
        remoteEventId: "evt-1",
        itemId: null,
        evidence: "ITEM_MODIFY",
        reviewed: false,
      });
      const withConflict = VaultSyncServerState.make({ ...serverState(), conflicts: H.make(["evt-1", record]) });
      const { container } = renderWithStatus(connected, AsyncResult.success([conflict]), [
        [vaultSyncIntentTransportLayerAtom, pendingTransport(sent)],
        [vaultSyncServerStateAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(O.some(withConflict))],
      ]);
      const screen = within(container);

      fireEvent.click(screen.getByTestId("vault-sync-conflict-review"));
      yield* Effect.promise(() => waitFor(() => screen.getByTestId("vault-sync-conflict-review-queued")));
      fireEvent.click(screen.getByTestId("vault-sync-trigger"));
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getAllByTestId("vault-sync-pending-intent")).toHaveLength(2))
      );

      const [review] = yield* Ref.get(sent);
      expect(review?.action.kind).toBe("review-conflict");
      expect(
        review !== undefined && review.action.kind === "review-conflict" ? review.action.healOperationId : ""
      ).toBe("documents_sync_operation_a1");
      expect(A.map(screen.getAllByTestId("vault-sync-pending-intent"), (row) => row.textContent)).toEqual([
        "Mark reviewed",
        "Sync now",
      ]);
    })
  );

  it.effect(
    "retries the queue from the pending list",
    Effect.fnUntraced(function* () {
      const sent = yield* Ref.make<ReadonlyArray<VaultSyncIntent>>([]);
      const online = yield* Ref.make(false);
      // Unreachable until the test flips it, then every send is accepted.
      const transport = Layer.succeed(
        VaultSyncIntentTransport,
        VaultSyncIntentTransport.of({
          read: Effect.fn("test.read")(function* () {
            return O.some(serverState());
          }),
          send: Effect.fn("test.send")(function* (intent) {
            const reachable = yield* Ref.get(online);
            if (!reachable) return yield* VaultSyncUnreachable.make({});
            yield* Ref.update(sent, A.append(intent));
          }),
        })
      );
      const connected = yield* statusWith(true, O.none());
      const queued = VaultSyncIntent.make({
        commandId: "vault-sync_3",
        destinationId,
        queuedAt: 0,
        action: VaultSyncAction.cases.resume.make({}),
      });
      const { container } = renderWithStatus(connected, AsyncResult.success(noConflicts), [
        [vaultSyncIntentQueueAtom, [queued]],
        [vaultSyncLinkAtom, "offline"],
        [vaultSyncIntentTransportLayerAtom, transport],
      ]);
      const screen = within(container);
      expect(screen.getByTestId("vault-sync-pending-intent")).toHaveTextContent("Resume sync");

      // The startup replay fails while the sidecar is unreachable; the retry stays offered.
      const retry = yield* Effect.promise(() => waitFor(() => screen.getByTestId("vault-sync-pending-retry")));
      yield* Ref.set(online, true);
      fireEvent.click(retry);

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(A.isReadonlyArrayNonEmpty(Ref.getUnsafe(sent))).toBe(true);
        })
      );
      const intents = yield* Ref.get(sent);
      expect(A.map(intents, (intent) => intent.commandId)).toEqual(["vault-sync_3"]);
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.queryByTestId("vault-sync-pending")).not.toBeInTheDocument())
      );
    })
  );

  it.effect(
    "labels the destination last known while the sidecar has not answered since a reload",
    Effect.fnUntraced(function* () {
      const connected = yield* statusWith(true, O.none());
      const { container } = renderWithStatus(connected, AsyncResult.success(noConflicts), [
        [vaultSyncServerStateAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.fail(VaultSyncUnreachable.make({}))],
        [vaultSyncSnapshotAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), O.some(serverState(true))],
      ]);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-destination")).toHaveTextContent("Vault");
      expect(screen.getByTestId("vault-sync-destination-state")).toHaveTextContent("paused");
      expect(screen.getByTestId("vault-sync-destination-last-known")).toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-pause-toggle")).toHaveTextContent("Resume sync");
      expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
      expect(screen.getByTestId("vault-sync-trigger")).toHaveAttribute(
        "title",
        "This destination is paused. Resume sync first."
      );
    })
  );

  it.effect(
    "lists both supported credential modes when credentials are missing",
    Effect.fnUntraced(function* () {
      const statusWith3 = yield* statusWith(false, O.some("credentials-missing"));
      const { container } = renderWithStatus(statusWith3);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("disconnected");
      expect(screen.getByTestId("vault-sync-setup-note")).toHaveTextContent("DMS_BOX_CLIENT_ID");
      expect(screen.getByTestId("vault-sync-setup-note")).toHaveTextContent("CLOUD_BOX_TOKEN");
      expect(screen.queryByTestId("vault-sync-reconnect")).not.toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
    })
  );

  it.effect(
    "never blames configuration when the probe failed with a token present",
    Effect.fnUntraced(function* () {
      const statusWith4 = yield* statusWith(false, O.some("probe-failed"));
      const { container } = renderWithStatus(statusWith4);
      const screen = within(container);

      const note = screen.getByTestId("vault-sync-setup-note");
      expect(note).toHaveTextContent("provider probe failed");
      expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
      expect(screen.getByTestId("vault-sync-reconnect")).toHaveTextContent("Retry connection");
      expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
    })
  );

  it.effect(
    "splits the auth-failed fix by auth mode instead of blaming expiry under CCG",
    Effect.fnUntraced(function* () {
      const statusWith5 = yield* statusWith(false, O.some("auth-failed"));
      const { container } = renderWithStatus(statusWith5);
      const screen = within(container);

      const note = screen.getByTestId("vault-sync-setup-note");
      expect(note).toHaveTextContent("Box rejected the credentials");
      // CCG self-refreshes, so "the token expired" would be the wrong diagnosis
      // there; the copy must name the CCG fix too.
      expect(note).toHaveTextContent("CCG refreshes automatically");
      expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN and restart the app");
      expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
    })
  );

  it.effect(
    "points at the mirror root folder when it cannot be listed or created",
    Effect.fnUntraced(function* () {
      const statusWith6 = yield* statusWith(false, O.some("root-unreachable"));
      const { container } = renderWithStatus(statusWith6);
      const screen = within(container);

      const note = screen.getByTestId("vault-sync-setup-note");
      expect(note).toHaveTextContent("mirror root folder could not be listed or created");
      expect(note).toHaveTextContent("configured Box application's folder access");
      expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
    })
  );

  it.effect(
    "asks for a short retry when Box is rate limiting or unreachable",
    Effect.fnUntraced(function* () {
      const statusWith7 = yield* statusWith(false, O.some("transient"));
      const { container } = renderWithStatus(statusWith7);
      const screen = within(container);

      const note = screen.getByTestId("vault-sync-setup-note");
      expect(note).toHaveTextContent("Retry shortly");
      expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
    })
  );

  it.effect(
    "starts exactly one probe per Retry connection click",
    Effect.fnUntraced(function* () {
      const called = yield* Deferred.make<void>();
      const sent = yield* Ref.make<ReadonlyArray<VaultSyncIntent>>([]);
      const rpcs = MutableRef.make<ReadonlyArray<string>>([]);
      // Every desktop RPC is recorded when it is called; the status re-subscription after acceptance
      // signals `called`. Every other RPC fails after being recorded.
      const client = DesktopSyncClient.of(((tag: string) => {
        MutableRef.update(rpcs, A.append(tag));
        return tag === "WatchVaultSyncStatus"
          ? Stream.unwrap(Deferred.succeed(called, undefined).pipe(Effect.as(Stream.never)))
          : VaultSyncActionError.failEffect("not served by this test");
      }) as unknown as DesktopSyncClient["Service"]);
      const clientLayer = Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer);
      const transport = Layer.succeed(
        VaultSyncIntentTransport,
        VaultSyncIntentTransport.of({
          read: Effect.fn("test.read")(function* () {
            return O.some(serverState());
          }),
          send: Effect.fn("test.send")(function* (intent) {
            yield* Ref.update(sent, A.append(intent));
          }),
        })
      );
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [DesktopSyncClient.runtime.layer, clientLayer],
            [vaultSyncIntentTransportLayerAtom, transport],
            [vaultSyncServerStateAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(O.some(serverState()))],
            [
              vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID),
              yield* Effect.map(statusWith(false, O.some("transient")), AsyncResult.success),
            ],
            [vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(noConflicts)],
          ]}
        >
          <VaultSyncPanel floating={false} />
        </RegistryProvider>
      );

      fireEvent.click(within(container).getByTestId("vault-sync-reconnect"));

      yield* Effect.promise(() =>
        waitFor(() => {
          expect(A.isReadonlyArrayNonEmpty(Ref.getUnsafe(sent))).toBe(true);
        })
      );
      yield* Deferred.await(called).pipe(Effect.timeout("4 seconds"));
      const intents = yield* Ref.get(sent);
      // The click delivers one ProbeDestination intent. The accepted probe only re-subscribes the
      // status stream; a `GetVaultSyncStatus` read with `forceProbe` would start a second probe workflow.
      expect(A.map(intents, (intent) => intent.action.kind)).toEqual(["probe"]);
      const calls = MutableRef.get(rpcs);
      expect(A.contains(calls, "WatchVaultSyncStatus")).toBe(true);
      expect(A.filter(calls, (tag) => tag === "GetVaultSyncStatus")).toEqual([]);
    })
  );

  it.effect(
    "holds Retry connection while the status is being re-read",
    Effect.fnUntraced(function* () {
      const disconnected = yield* statusWith(false, O.some("transient"));
      const { container } = render(
        <RegistryProvider
          initialValues={[
            [
              vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID),
              AsyncResult.success(disconnected, { waiting: true }),
            ],
            [vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(noConflicts)],
          ]}
        >
          <VaultSyncPanel floating={false} />
        </RegistryProvider>
      );
      const reconnect = within(container).getByTestId("vault-sync-reconnect");
      expect(reconnect).toHaveTextContent("Checking…");
      expect(reconnect).toBeDisabled();
    })
  );

  it.effect(
    "renders a setup note for every disconnect reason",
    Effect.fnUntraced(function* () {
      // Totality over the reason union: a new member without panel copy must
      // fail here, not silently fall through to a blank panel.
      for (const reason of DmsMirrorDisconnectReason.literals) {
        const statusWith8 = yield* statusWith(false, O.some(reason));
        const { container, unmount } = renderWithStatus(statusWith8);
        expect(within(container).getByTestId("vault-sync-setup-note")).toBeInTheDocument();
        unmount();
      }
    })
  );

  it.effect(
    "shows when the probe last asked Box so a retry visibly moves the panel",
    Effect.fnUntraced(function* () {
      const statusWith9 = yield* statusWith(false, O.some("probe-failed"), O.some("2026-08-26T12:00:00.000Z"));
      const { container } = renderWithStatus(statusWith9);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-probed-at")).toHaveTextContent("Last checked");
    })
  );

  it.effect(
    "treats a reasonless disconnect as a probe problem, not missing configuration",
    Effect.fnUntraced(function* () {
      // An older sidecar can report connected: false without a reason; claiming
      // the token is unset would be the exact lie this panel was fixed for.
      const statusWith10 = yield* statusWith(false, O.none());
      const { container } = renderWithStatus(statusWith10);
      const screen = within(container);

      const note = screen.getByTestId("vault-sync-setup-note");
      expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
      expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
      // No probe timestamp arrived, so no stale "Last checked" claim renders.
      expect(screen.queryByTestId("vault-sync-probed-at")).not.toBeInTheDocument();
    })
  );

  it.effect(
    "shows no setup note while connected and enables the sync trigger",
    Effect.fnUntraced(function* () {
      const statusWith11 = yield* statusWith(true, O.none());
      const { container } = renderWithStatus(statusWith11);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("connected");
      expect(screen.queryByTestId("vault-sync-setup-note")).not.toBeInTheDocument();
      expect(screen.getByTestId("vault-sync-trigger")).toBeEnabled();
    })
  );

  it.effect(
    "keeps a failed conflict query visible and retryable",
    Effect.fnUntraced(function* () {
      const conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown> = AsyncResult.fail(
        "conflicts unavailable"
      );
      const statusWith12 = yield* statusWith(true, O.none());
      const { container } = renderWithStatus(statusWith12, conflicts);
      const screen = within(container);

      expect(screen.getByTestId("vault-sync-conflicts-failed")).toHaveTextContent(
        "Open conflicts could not be loaded."
      );
      expect(screen.getByTestId("vault-sync-conflicts-retry")).toHaveTextContent("Retry");
      expect(screen.getByTestId("vault-sync-conflicts-retry")).toBeEnabled();
      expect(screen.queryByTestId("vault-sync-conflicts")).not.toBeInTheDocument();
    })
  );
});
