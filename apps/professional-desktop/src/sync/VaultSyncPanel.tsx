/**
 * App-level vault sync status panel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { DmsMirrorDisconnectReason } from "@beep/documents-use-cases/public";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunkNull } from "@beep/utils/thunk";
import { useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import { AsyncResult } from "effect/unstable/reactivity";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import {
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncConflictsAtom,
  vaultSyncPanelStateAtoms,
  vaultSyncRetryConnectionAtoms,
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
        : "rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600 dark:text-amber-300"
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
    onFailure: (failure) => (
      // The status query had no retry and nothing invalidates it, so a sidecar that
      // restarted -- or a single dropped request -- left this reading "unavailable"
      // for the rest of the session, long after sync had come back. A dead end with
      // no way out is not a state; it is an abandonment. The waiting flag makes the
      // retry visibly do something even when the refresh fails again immediately.
      <div className="mt-2 flex items-center gap-2" data-testid="vault-sync-status">
        <p className="text-xs text-destructive">Sync status is unavailable.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={failure.waiting}
          data-testid="vault-sync-status-retry"
        >
          {failure.waiting ? "Retrying…" : "Retry"}
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

// Disconnected copy keyed on the sidecar's honest disconnect reason. Telling
// the operator to set CLOUD_BOX_TOKEN when the token IS set (but the probe
// failed) sent QA chasing configuration that was never the problem — and one
// generic note for every probe failure hid whether the fix was a fresh token,
// the mirror root folder, or simply waiting Box out.
const probeFailedCopy =
  "Box credentials are configured, but the provider probe failed. The token may be expired or the mirror root " +
  "folder is unreachable. Sync stays paused until Box answers.";

const DisconnectedNote = ({
  onRetry,
  probedAt,
  reason,
  waiting,
}: {
  readonly onRetry: () => void;
  readonly probedAt: O.Option<DateTime.Utc>;
  readonly reason: O.Option<DmsMirrorDisconnectReason>;
  readonly waiting: boolean;
}): JSX.Element => {
  // Dark mode needs the brighter amber text tier and an explicit high-contrast
  // button treatment: amber-600 on the tinted alert surface fell below
  // readable contrast on the near-black theme (QA round 104, R104-02).
  const probeNote = (message: string) => (
    <div
      className="mt-2 rounded-sm border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:border-amber-400/50 dark:text-amber-200"
      data-testid="vault-sync-setup-note"
    >
      <p>{message}</p>
      {pipe(
        probedAt,
        // The probe timestamp makes "Retry connection" visibly do something
        // even when the outcome is unchanged: the last honest ask of Box moves.
        O.map((value) => (
          <p className="mt-1 opacity-80" data-testid="vault-sync-probed-at">
            Last checked {DateTime.formatLocal(value, { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        )),
        O.getOrNull
      )}
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="mt-2 dark:border-amber-300/60 dark:text-amber-100 dark:hover:bg-amber-500/20"
        onClick={onRetry}
        disabled={waiting}
        data-testid="vault-sync-reconnect"
      >
        {waiting ? "Checking…" : "Retry connection"}
      </Button>
    </div>
  );
  return O.match(reason, {
    // A disconnected status without a reason is an older sidecar; the probe
    // path is the only honest guess that does not claim the token is unset.
    onNone: () => probeNote(probeFailedCopy),
    onSome: (value) =>
      DmsMirrorDisconnectReason.$match(value, {
        "credentials-missing": () => (
          <p
            className="mt-2 rounded-sm border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-600 dark:border-amber-400/50 dark:text-amber-200"
            data-testid="vault-sync-setup-note"
          >
            Configure CCG with DMS_BOX_CLIENT_ID, DMS_BOX_CLIENT_SECRET, and an enterprise or user subject, or set
            CLOUD_BOX_TOKEN. Restart the app after changing credentials.
          </p>
        ),
        // The renderer cannot see which auth mode the sidecar selected, so the
        // copy names the fix for each: only developer tokens expire on their
        // own; CCG self-refreshes, so an auth failure there means the client
        // credentials or subject are wrong.
        "auth-failed": () =>
          probeNote(
            "Box rejected the credentials. A developer token (CLOUD_BOX_TOKEN) lasts about 60 minutes. Restart the " +
              "app with a fresh token. CCG refreshes automatically, so check DMS_BOX_CLIENT_ID, " +
              "DMS_BOX_CLIENT_SECRET, and the enterprise or user subject."
          ),
        "root-unreachable": () =>
          probeNote(
            "The Box mirror root folder could not be listed or created. Check the mirror root folder name and the " +
              "configured Box application's folder access."
          ),
        transient: () =>
          probeNote("Box is unreachable or rate limiting. Retry shortly. Sync resumes once Box answers."),
        "probe-failed": () => probeNote(probeFailedCopy),
      }),
  });
};

const VaultSyncActionStatus = ({ state }: { readonly state: VaultSyncPanelState }): JSX.Element | null =>
  VaultSyncPanelState.match(state, {
    idle: thunkNull,
    syncing: thunkNull,
    reviewing: thunkNull,
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
        <p className="text-xs text-destructive">Open conflicts could not be loaded.</p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          disabled={conflicts.waiting}
          data-testid="vault-sync-conflicts-retry"
        >
          {conflicts.waiting ? "Retrying…" : "Retry"}
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
// fallow-ignore-next-line complexity -- cognitive 14 = pre-existing hook/JSX tax (six atom-hook bindings plus the status/panel-state conditionals); this branch's change here was passing the new probedAt prop through to DisconnectedNote and added no branching
export function VaultSyncPanel({ floating = true }: { readonly floating?: boolean }): JSX.Element {
  const status = useAtomValue(vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const refreshStatus = useAtomRefresh(vaultSyncStatusAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  // A plain refresh inside the sidecar's 3s failure cache replays the cached
  // failed probe; the explicit retry forces a fresh probe instead.
  const retryConnection = useAtomSet(vaultSyncRetryConnectionAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
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
        <DisconnectedNote
          probedAt={status.value.probedAt}
          reason={status.value.disconnectReason}
          waiting={status.waiting}
          onRetry={() => retryConnection()}
        />
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
