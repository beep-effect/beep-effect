import { VaultSyncPanel } from "@/sync/VaultSyncPanel";
import "@testing-library/jest-dom/vitest";
import { VaultSyncStatus } from "@beep/documents-use-cases/public";
import { RegistryProvider } from "@effect/atom-react";
import { cleanup, render, within } from "@testing-library/react";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { afterEach, describe, expect, it } from "vitest";
import { vaultSyncStatusAtom } from "@/sync/Sync.atoms";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import type { DmsMirrorDisconnectReason } from "@beep/documents-use-cases/public";

const statusWith = (connected: boolean, disconnectReason: O.Option<DmsMirrorDisconnectReason>): VaultSyncStatus =>
  S.decodeUnknownSync(VaultSyncStatus)({
    conflictItems: 0,
    connected,
    disconnectReason: O.getOrNull(disconnectReason),
    currentItems: 0,
    cursorPosition: null,
    errorItems: 0,
    failedOperations: 0,
    openConflicts: 0,
    pendingItems: 0,
    provider: "box",
    queuedOperations: 0,
  });

const renderWithStatus = (status: VaultSyncStatus) =>
  render(
    <RegistryProvider
      initialValues={[[vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID), AsyncResult.success(status)]]}
    >
      <VaultSyncPanel floating={false} />
    </RegistryProvider>
  );

describe("vault sync disconnected copy is keyed on the sidecar's reason", () => {
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

  it("treats a reasonless disconnect as a probe problem, not missing configuration", () => {
    // An older sidecar can report connected: false without a reason; claiming
    // the token is unset would be the exact lie this panel was fixed for.
    const { container } = renderWithStatus(statusWith(false, O.none()));
    const screen = within(container);

    const note = screen.getByTestId("vault-sync-setup-note");
    expect(note).not.toHaveTextContent("Set CLOUD_BOX_TOKEN");
    expect(screen.getByTestId("vault-sync-reconnect")).toBeInTheDocument();
  });

  it("shows no setup note while connected and enables the sync trigger", () => {
    const { container } = renderWithStatus(statusWith(true, O.none()));
    const screen = within(container);

    expect(screen.getByTestId("vault-sync-connection")).toHaveTextContent("connected");
    expect(screen.queryByTestId("vault-sync-setup-note")).not.toBeInTheDocument();
    expect(screen.getByTestId("vault-sync-trigger")).toBeEnabled();
  });
});
