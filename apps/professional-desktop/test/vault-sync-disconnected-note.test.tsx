import { VaultSyncPanel } from "@/sync/VaultSyncPanel";
import "@testing-library/jest-dom/vitest";
import { DmsMirrorDisconnectReason, VaultSyncStatus } from "@beep/documents-use-cases/public";
import { RegistryProvider } from "@effect/atom-react";
import { cleanup, render, within } from "@testing-library/react";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { afterEach, describe, expect, it } from "vitest";
import { vaultSyncConflictsAtom, vaultSyncStatusAtom } from "@/sync/Sync.atoms";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";

const statusWith = (
  connected: boolean,
  disconnectReason: O.Option<DmsMirrorDisconnectReason>,
  probedAt: O.Option<string> = O.none()
): VaultSyncStatus =>
  S.decodeSync(VaultSyncStatus)({
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

const renderWithStatus = (
  status: VaultSyncStatus,
  conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown> = AsyncResult.success(noConflicts)
) =>
  render(
    <RegistryProvider
      initialValues={[
        [vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(status)],
        [vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), conflicts],
      ]}
    >
      <VaultSyncPanel floating={false} />
    </RegistryProvider>
  );

describe("vault sync panel", () => {
  afterEach(cleanup);

  it("tells the operator to set the token only when credentials are missing", () => {
    const { container } = renderWithStatus(statusWith(false, O.some("credentials-missing")));
    const screen = within(container);

    expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("disconnected");
    expect(screen.getByTestId("vault-sync-setup-note")).toHaveTextContent("Set CLOUD_BOX_TOKEN");
    expect(screen.queryByTestId("vault-sync-reconnect")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
  });

  it("never blames configuration when the probe failed with a token present", () => {
    const { container } = renderWithStatus(statusWith(false, O.some("probe-failed")));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).toHaveTextContent("provider probe failed");
    expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
    expect(screen.getByTestId("vault-sync-reconnect")).toHaveTextContent("Retry connection");
    expect(screen.getByTestId("vault-sync-trigger")).toBeDisabled();
  });

  it("blames the token when Box rejected the credentials", () => {
    const { container } = renderWithStatus(statusWith(false, O.some("auth-failed")));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).toHaveTextContent("Box rejected the stored credentials");
    expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
    expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
  });

  it("points at the mirror root folder when it cannot be listed or created", () => {
    const { container } = renderWithStatus(statusWith(false, O.some("root-unreachable")));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).toHaveTextContent("mirror root folder could not be listed or created");
    expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
  });

  it("asks for a short retry when Box is rate limiting or unreachable", () => {
    const { container } = renderWithStatus(statusWith(false, O.some("transient")));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).toHaveTextContent("Retry shortly");
    expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
  });

  it("renders a setup note for every disconnect reason", () => {
    // Totality over the reason union: a new member without panel copy must
    // fail here, not silently fall through to a blank panel.
    A.forEach(DmsMirrorDisconnectReason.Options, (reason) => {
      const { container, unmount } = renderWithStatus(statusWith(false, O.some(reason)));
      expect(within(container).getByTestId("vault-sync-setup-note")).toBeInTheDocument();
      unmount();
    });
  });

  it("shows when the probe last asked Box so a retry visibly moves the panel", () => {
    const { container } = renderWithStatus(
      statusWith(false, O.some("probe-failed"), O.some("2026-08-26T12:00:00.000Z"))
    );
    const screen = within(container);

    expect(screen.getByTestId("vault-sync-probed-at")).toHaveTextContent("Last checked");
  });

  it("treats a reasonless disconnect as a probe problem, not missing configuration", () => {
    // An older sidecar can report connected: false without a reason; claiming
    // the token is unset would be the exact lie this panel was fixed for.
    const { container } = renderWithStatus(statusWith(false, O.none()));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
    expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
    // No probe timestamp arrived, so no stale "Last checked" claim renders.
    expect(screen.queryByTestId("vault-sync-probed-at")).not.toBeInTheDocument();
  });

  it("shows no setup note while connected and enables the sync trigger", () => {
    const { container } = renderWithStatus(statusWith(true, O.none()));
    const screen = within(container);

    expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("connected");
    expect(screen.queryByTestId("vault-sync-setup-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-sync-trigger")).toBeEnabled();
  });

  it("keeps a failed conflict query visible and retryable", () => {
    const conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown> = AsyncResult.fail(
      "conflicts unavailable"
    );
    const { container } = renderWithStatus(statusWith(true, O.none()), conflicts);
    const screen = within(container);

    expect(screen.getByTestId("vault-sync-conflicts-failed")).toHaveTextContent("Open conflicts could not be loaded.");
    expect(screen.getByTestId("vault-sync-conflicts-retry")).toHaveTextContent("Retry");
    expect(screen.getByTestId("vault-sync-conflicts-retry")).toBeEnabled();
    expect(screen.queryByTestId("vault-sync-conflicts")).not.toBeInTheDocument();
  });
});
