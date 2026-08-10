/**
 * App-level vault sync status panel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { Button } from "@beep/ui/components/button";
import { A, O } from "@beep/utils";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import {
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncConflictsAtom,
  vaultSyncPanelStateAtoms,
  vaultSyncStatusAtom,
} from "./Sync.atoms.ts";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import type { VaultSyncStatus } from "@beep/documents-use-cases/public";
import type { JSX } from "react";

const statusCounts = (status: VaultSyncStatus) => [
  { key: "pending", label: "Pending", value: status.pendingItems },
  { key: "current", label: "Current", value: status.currentItems },
  { key: "error", label: "Errors", value: status.errorItems },
  { key: "conflict", label: "Conflicts", value: status.conflictItems },
  { key: "queued-ops", label: "Queued ops", value: status.queuedOperations },
  { key: "failed-ops", label: "Failed ops", value: status.failedOperations },
  { key: "open-conflicts", label: "Open conflicts", value: status.openConflicts },
];

const ConnectionBadge = ({ connected }: { readonly connected: boolean }): JSX.Element => (
  <span
    className={
      connected
        ? "rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
        : "rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600"
    }
    data-testid="vault-sync-connection"
  >
    {connected ? "connected" : "disconnected"}
  </span>
);

const VaultSyncStatusView = ({
  status,
  onRetry,
}: {
  readonly onRetry: () => void;
  readonly status: AsyncResult.AsyncResult<VaultSyncStatus, unknown>;
}): JSX.Element =>
  AsyncResult.match(status, {
    onInitial: () => (
      <p className="mt-2 text-xs text-muted-foreground" data-testid="vault-sync-status">
        Loading sync status
      </p>
    ),
    onFailure: () => (
      // The status query had no retry and nothing invalidates it, so a sidecar that
      // restarted -- or a single dropped request -- left this reading "unavailable"
      // for the rest of the session, long after sync had come back. A dead end with
      // no way out is not a state; it is an abandonment.
      <div className="mt-2 flex items-center gap-2" data-testid="vault-sync-status">
        <p className="text-xs text-destructive">Sync status is unavailable.</p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="vault-sync-status-retry">
          Retry
        </Button>
      </div>
    ),
    onSuccess: (success) => (
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" data-testid="vault-sync-status">
        {A.map(statusCounts(success.value), (entry) => (
          <div key={entry.key} className="flex items-center justify-between gap-2">
            <dt className="text-xs text-muted-foreground">{entry.label}</dt>
            <dd className="text-xs font-medium" data-testid={`vault-sync-count-${entry.key}`}>
              {entry.value}
            </dd>
          </div>
        ))}
      </dl>
    ),
  });

const VaultSyncActionStatus = ({ state }: { readonly state: VaultSyncPanelState }): JSX.Element | null =>
  VaultSyncPanelState.match(state, {
    idle: () => null,
    syncing: () => null,
    reviewing: () => null,
    succeeded: ({ message }) => (
      <span className="text-xs text-muted-foreground" role="status" data-testid="vault-sync-complete">
        {message}
      </span>
    ),
    failed: ({ message }) => (
      <span className="text-xs text-destructive" role="status" data-testid="vault-sync-error">
        {message}
      </span>
    ),
  });

const VaultSyncConflictsList = ({
  conflicts,
  onRetry,
  onReview,
  busy,
}: {
  readonly busy: boolean;
  readonly conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown>;
  readonly onRetry: () => void;
  readonly onReview: (conflict: SyncConflict) => void;
}): JSX.Element | null => {
  // A failed conflict query used to render as `null` — exactly like "no
  // conflicts" — so an operator could be told everything was clean while the
  // listing was actually unavailable.
  if (AsyncResult.isFailure(conflicts)) {
    return (
      <div className="mt-3 flex items-center gap-2" role="alert" data-testid="vault-sync-conflicts-failed">
        <p className="text-xs text-destructive">
          Open conflicts could not be loaded. The count above may be out of date.
        </p>
        <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="vault-sync-conflicts-retry">
          Retry
        </Button>
      </div>
    );
  }
  return AsyncResult.isSuccess(conflicts) && A.isReadonlyArrayNonEmpty(conflicts.value) ? (
    <ul className="mt-3 space-y-2" data-testid="vault-sync-conflicts">
      {A.map(conflicts.value, (conflict) => (
        <li
          key={conflict.id}
          className="rounded-sm border border-amber-500/40 p-2"
          data-testid="vault-sync-conflict-row"
        >
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{conflict.conflictKind}</span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onReview(conflict)}
              disabled={busy}
              data-testid="vault-sync-conflict-review"
            >
              Mark reviewed
            </Button>
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {O.getOrElse(conflict.localRelPath, () => "(no local path)")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            event {O.getOrElse(conflict.remoteEventId, () => "(none)")}
          </p>
        </li>
      ))}
    </ul>
  ) : null;
};

/**
 * Floating vault sync status surface: provider connection badge, sync trigger,
 * reconciliation counts, and the open drift records with per-row review.
 *
 * **Details**
 *
 * While Box is not connected (no `CLOUD_BOX_TOKEN`), the panel shows setup
 * guidance and keeps the sync trigger disabled instead of surfacing a failing
 * remote call.
 *
 * **Example** (Create React element)
 *
 * ```ts
 * import { VaultSyncPanel } from "@/sync/VaultSyncPanel"
 * import { createElement } from "react"
 *
 * const element = createElement(VaultSyncPanel)
 * console.log(element.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function VaultSyncPanel({ floating = true }: { readonly floating?: boolean }): JSX.Element {
  const status = useAtomValue(vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const refreshStatus = useAtomRefresh(vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const refreshConflicts = useAtomRefresh(vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const conflicts = useAtomValue(vaultSyncConflictsAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const panelState = useAtomValue(vaultSyncPanelStateAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const runCommand = useAtomSet(vaultSyncCommandAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

  const connected = AsyncResult.isSuccess(status) && status.value.connected;
  const syncing = VaultSyncPanelState.guards.syncing(panelState);
  const busy = syncing || VaultSyncPanelState.guards.reviewing(panelState);

  return (
    <section
      className={
        floating
          ? "fixed bottom-4 left-4 z-40 max-h-96 w-80 overflow-y-auto rounded-md border bg-card p-3 text-sm shadow-sm"
          : "mx-auto mt-6 max-h-[calc(100vh-6rem)] w-[min(44rem,calc(100%-3rem))] overflow-y-auto rounded-lg border bg-card p-5 text-sm shadow-sm"
      }
      data-testid="vault-sync-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Vault sync</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="vault-sync-provider">
            {AsyncResult.isSuccess(status) ? status.value.provider : "box"}
          </span>
          <ConnectionBadge connected={connected} />
        </div>
      </div>
      <VaultSyncStatusView status={status} onRetry={refreshStatus} />
      {AsyncResult.isSuccess(status) && !status.value.connected ? (
        <p
          className="mt-2 rounded-sm border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600"
          data-testid="vault-sync-setup-note"
        >
          Set CLOUD_BOX_TOKEN and restart the app to connect Box. OAuth setup ships when the Box test tenant is
          provisioned.
        </p>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => runCommand(VaultSyncCommand.cases.trigger.make())}
          disabled={busy || !connected}
          data-testid="vault-sync-trigger"
        >
          {syncing ? "Syncing" : "Sync now"}
        </Button>
        <VaultSyncActionStatus state={panelState} />
      </div>
      <VaultSyncConflictsList
        busy={busy}
        conflicts={conflicts}
        onRetry={refreshConflicts}
        onReview={(conflict) =>
          runCommand(
            VaultSyncCommand.cases.review.make({
              conflictId: conflict.id,
            })
          )
        }
      />
    </section>
  );
}
