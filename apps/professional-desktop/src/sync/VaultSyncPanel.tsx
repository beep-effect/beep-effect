/**
 * App-level vault sync status panel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { DmsMirrorDisconnectReason, VaultSyncActionError } from "@beep/documents-use-cases/public";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunkNull } from "@beep/utils/thunk";
import { useAtomMount, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as S from "effect/Schema";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import {
  VaultSyncCommand,
  VaultSyncPanelState,
  vaultSyncCommandAtoms,
  vaultSyncConflictsAtom,
  vaultSyncIntentReplayAtom,
  vaultSyncPanelStateAtoms,
  vaultSyncRetryConnectionAtoms,
  vaultSyncStatusAtom,
} from "./Sync.atoms.ts";
import {
  intentsOf,
  reviewQueued,
  triggerQueued,
  VaultSyncIntent,
  vaultSyncIntentQueueAtom,
} from "./VaultSyncIntents.ts";

/** A queued review intent, as its pending row reads it. */
type ReviewIntentRow = Extract<VaultSyncIntent, { readonly kind: "review" }>;

import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import type { VaultSyncStatus } from "@beep/documents-use-cases/public";
import type { JSX } from "react";

/** Local work not yet reported by the sidecar: shown beside the server's counts, never folded into them. */
interface LocalWork {
  readonly pendingReviews: number;
  readonly waiting: number;
}

const withLocal = (value: number, local: number, label: string) =>
  local > 0 ? `${value} (+${local} ${label})` : `${value}`;

const statusCounts = (status: VaultSyncStatus, local: LocalWork) => [
  { key: "pending", label: "Pending", value: `${status.pendingItems}` },
  { key: "current", label: "Current", value: `${status.currentItems}` },
  { key: "error", label: "Errors", value: `${status.errorItems}` },
  { key: "conflict", label: "Conflicts", value: `${status.conflictItems}` },
  { key: "queued-ops", label: "Queued ops", value: withLocal(status.queuedOperations, local.waiting, "waiting") },
  { key: "failed-ops", label: "Failed ops", value: `${status.failedOperations}` },
  {
    key: "open-conflicts",
    label: "Open conflicts",
    // A pending review is of a conflict already counted: say so, never add it.
    value:
      local.pendingReviews > 0
        ? `${status.openConflicts} (${local.pendingReviews} reviewed, waiting to sync)`
        : `${status.openConflicts}`,
  },
];

/** Box as the sidecar reports it, or the sidecar itself out of reach (queued work, or no status). */
type Connection = "connected" | "disconnected" | "checking…" | "sidecar offline";

const ConnectionBadge = ({ connection }: { readonly connection: Connection }): JSX.Element => (
  <span
    className={
      connection === "connected"
        ? "rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
        : "rounded-sm bg-warning/10 px-1.5 py-0.5 text-xs text-warning-text"
    }
    data-testid="vault-sync-connection"
  >
    {connection}
  </span>
);

const VaultSyncStatusView = ({
  status,
  onRetry,
  local,
  offline,
}: {
  readonly local: LocalWork;
  /** The sidecar is out of reach: the offline notice reports it once, with its own Retry. */
  readonly offline: boolean;
  readonly onRetry: () => void;
  readonly status: AsyncResult.AsyncResult<VaultSyncStatus, unknown>;
}): JSX.Element | null =>
  AsyncResult.match(status, {
    onInitial: () => (
      <p className="mt-2 text-xs text-muted-foreground" data-testid="vault-sync-status">
        Loading sync status
      </p>
    ),
    onFailure: (failure) =>
      offline ? null : (
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
        {A.map(statusCounts(success.value, local), (entry) => (
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
  // Dark mode needs the brighter warning text tier: amber-600 on the tinted
  // alert surface fell below readable contrast on the near-black theme (QA
  // round 104, R104-02). `warning-text` carries that high-contrast tier in its
  // dark value; the retry button uses the design system's `warning` variant,
  // which paints the same tier on its own border, label and hover wash.
  const probeNote = (message: string) => (
    <div
      className="mt-2 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-warning-text dark:border-warning/50"
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
        variant="warning"
        className="mt-2"
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
      DmsMirrorDisconnectReason.match(value, {
        "credentials-missing": () => (
          <p
            className="mt-2 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-warning-text dark:border-warning/50"
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
    // The offline notice reports queued work once for the whole panel.
    queued: thunkNull,
    succeeded: ({ message }) => (
      <span className="text-xs text-muted-foreground" role="status" data-testid="vault-sync-complete">
        {message}
      </span>
    ),
    // A refused review reports on its conflict row; this slot is for sync-level outcomes.
    failed: ({ message, conflictId }) =>
      conflictId === undefined ? (
        <span className="text-xs text-destructive" role="status" data-testid="vault-sync-error">
          {message}
        </span>
      ) : null,
  });

/** A queued review whose conflict list cannot load: its row, rebuilt from the intent. */
const PendingReviewRow = ({ intent }: { readonly intent: ReviewIntentRow }): JSX.Element => (
  <li className="rounded-sm border border-warning/40 p-2" data-testid="vault-sync-conflict-row">
    <div className="flex items-center justify-between gap-2">
      <span className="font-medium">{intent.conflictKind ?? "conflict"}</span>
      <span className="text-xs text-muted-foreground" data-testid="vault-sync-conflict-pending">
        Reviewed, waiting to sync
      </span>
    </div>
    <p className="mt-1 break-all text-xs text-muted-foreground">{intent.localRelPath ?? "(no local path)"}</p>
  </li>
);

const VaultSyncConflictsList = ({
  conflicts,
  onRetry,
  onReview,
  busy,
  pendingReview,
  pendingReviews,
  rejection,
  offline,
}: {
  readonly busy: boolean;
  /** Queued reviews: their rows stay visible when the list itself cannot load. */
  readonly pendingReviews: ReadonlyArray<ReviewIntentRow>;
  /** The server's message for the conflict whose review it refused, if any. */
  readonly rejection: O.Option<{ readonly conflictId: SyncConflict["id"]; readonly message: string }>;
  /** The sidecar is out of reach: an unloadable list is expected, not an error. */
  readonly offline: boolean;
  /** Whether a review of the conflict is queued: shown as predicted, reviewed. */
  readonly pendingReview: (conflict: SyncConflict) => boolean;
  readonly conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown>;
  readonly onRetry: () => void;
  readonly onReview: (conflict: SyncConflict) => void;
}): JSX.Element | null => {
  // A failed conflict query used to render as `null` — exactly like "no
  // conflicts" — so an operator could be told everything was clean while the
  // listing was actually unavailable.
  if (AsyncResult.isFailure(conflicts) && offline) {
    return A.isReadonlyArrayNonEmpty(pendingReviews) ? (
      <ul className="mt-3 space-y-2" data-testid="vault-sync-conflicts">
        {A.map(pendingReviews, (intent) => (
          <PendingReviewRow key={intent.intentId} intent={intent} />
        ))}
      </ul>
    ) : null;
  }
  if (AsyncResult.isFailure(conflicts)) {
    return (
      <>
        <div className="mt-3 flex items-center gap-2" role="alert" data-testid="vault-sync-conflicts-failed">
          <p className="text-xs text-destructive">
            {A.isReadonlyArrayNonEmpty(pendingReviews)
              ? "Open conflicts could not be loaded. Showing reviews waiting to sync."
              : "Open conflicts could not be loaded."}
          </p>
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
        {A.isReadonlyArrayNonEmpty(pendingReviews) ? (
          <ul className="mt-3 space-y-2" data-testid="vault-sync-conflicts">
            {A.map(pendingReviews, (intent) => (
              <PendingReviewRow key={intent.intentId} intent={intent} />
            ))}
          </ul>
        ) : null}
      </>
    );
  }
  return AsyncResult.isSuccess(conflicts) && A.isReadonlyArrayNonEmpty(conflicts.value) ? (
    <ul className="mt-3 space-y-2" data-testid="vault-sync-conflicts">
      {A.map(conflicts.value, (conflict) => (
        <li key={conflict.id} className="rounded-sm border border-warning/40 p-2" data-testid="vault-sync-conflict-row">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{conflict.conflictKind}</span>
            {pendingReview(conflict) ? (
              <span className="text-xs text-muted-foreground" data-testid="vault-sync-conflict-pending">
                Reviewed, waiting to sync
              </span>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onReview(conflict)}
                disabled={busy}
                data-testid="vault-sync-conflict-review"
              >
                Mark reviewed
              </Button>
            )}
          </div>
          <p className="mt-1 break-all text-xs text-muted-foreground">
            {O.getOrElse(conflict.localRelPath, () => "(no local path)")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            event {O.getOrElse(conflict.remoteEventId, () => "(none)")}
          </p>
          {pipe(
            rejection,
            O.filter(({ conflictId }) => conflictId === conflict.id),
            O.map(({ message }) => (
              <p className="mt-1 text-xs text-destructive" role="alert" data-testid="vault-sync-conflict-error">
                {message}
              </p>
            )),
            O.getOrNull
          )}
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
// fallow-ignore-next-line complexity -- fallow's React model adds one cognitive point per hook binding; cognitive 15 comes from six atom-hook bindings plus the status and panel-state conditionals, so splitting would only fragment hook ownership (#1855 detector frontier). Owner: @beep/professional-desktop. Exit: remove when the component sheds bindings or fallow stops counting hook bindings as branches.
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
  const queue = useAtomValue(vaultSyncIntentQueueAtom);
  // Replays queued intents while the panel is mounted.
  useAtomMount(vaultSyncIntentReplayAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

  const connected = AsyncResult.isSuccess(status) && status.value.connected;
  const pendingReviews = A.filter(intentsOf(queue, DEFAULT_PROFESSIONAL_WORKSPACE_ID), VaultSyncIntent.guards.review);
  const rejection = VaultSyncPanelState.guards.failed(panelState)
    ? O.map(O.fromUndefinedOr(panelState.conflictId), (conflictId) => ({ conflictId, message: panelState.message }))
    : O.none();
  // Box answered as not configured: a pass cannot run. An unreachable sidecar is not that: the
  // trigger is queued as an intent and replays when the sidecar is back.
  const unconfigured = AsyncResult.isSuccess(status) && !status.value.connected;
  const queuedCount = intentsOf(queue, DEFAULT_PROFESSIONAL_WORKSPACE_ID).length;
  const passQueued = triggerQueued(queue, DEFAULT_PROFESSIONAL_WORKSPACE_ID);
  // An intent in flight has no answer yet: the last known state is not claimed until it settles.
  const inFlight = VaultSyncPanelState.guards.syncing(panelState) || VaultSyncPanelState.guards.reviewing(panelState);
  // A status failure the sidecar answered (a typed refusal) means it is reachable; any other failure means it is not.
  const statusUnreachable =
    AsyncResult.isFailure(status) && !O.exists(Cause.findErrorOption(status.cause), S.is(VaultSyncActionError));
  // Work waits beyond the one in flight only when an earlier delivery could not reach the sidecar.
  const offline =
    statusUnreachable || VaultSyncPanelState.guards.queued(panelState) || queuedCount > (inFlight ? 1 : 0);
  const connection: Connection = offline
    ? "sidecar offline"
    : inFlight || AsyncResult.isInitial(status)
      ? "checking…"
      : connected
        ? "connected"
        : "disconnected";
  const syncing = VaultSyncPanelState.guards.syncing(panelState);
  const busy = syncing || VaultSyncPanelState.guards.reviewing(panelState);

  const card = (
    <section
      className={
        floating
          ? "fixed bottom-4 left-4 z-40 max-h-96 w-80 overflow-y-auto rounded-md border bg-card p-3 text-sm shadow-sm"
          : "mx-auto mt-6 w-sync-panel rounded-lg border bg-card p-5 text-sm shadow-sm"
      }
      data-testid="vault-sync-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Vault sync</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground" data-testid="vault-sync-provider">
            {AsyncResult.isSuccess(status) ? status.value.provider : "box"}
          </span>
          <ConnectionBadge connection={connection} />
        </div>
      </div>
      <VaultSyncStatusView
        status={status}
        onRetry={refreshStatus}
        offline={offline}
        local={{ waiting: queuedCount, pendingReviews: pendingReviews.length }}
      />
      {offline ? (
        <div
          className="mt-2 flex items-center justify-between gap-2 rounded-sm border border-warning/40 bg-warning/10 p-2 text-xs text-warning-text"
          role="status"
          data-testid="vault-sync-offline-notice"
        >
          <p>
            Sidecar offline.{" "}
            <span data-testid="vault-sync-intents">
              {queuedCount === 0
                ? "Status and conflicts refresh when it reconnects."
                : queuedCount === 1
                  ? "1 action waiting for the sidecar; it runs when the sidecar reconnects."
                  : `${queuedCount} actions waiting for the sidecar; they run when the sidecar reconnects.`}
            </span>
          </p>
          <Button
            type="button"
            size="sm"
            variant="warning"
            onClick={() => {
              refreshStatus();
              refreshConflicts();
            }}
            disabled={AsyncResult.isFailure(status) && status.waiting}
            data-testid="vault-sync-status-retry"
          >
            Retry
          </Button>
        </div>
      ) : null}
      {AsyncResult.isSuccess(status) && !status.value.connected ? (
        <DisconnectedNote
          probedAt={status.value.probedAt}
          reason={status.value.disconnectReason}
          waiting={status.waiting}
          onRetry={() => retryConnection()}
        />
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {passQueued ? (
          // A queued pass is a status, not a faded button: a chip at readable contrast.
          <span
            className="rounded-md border border-warning/40 bg-warning/10 px-2.5 py-1 text-xs font-medium text-warning-text"
            aria-disabled="true"
            data-testid="vault-sync-trigger"
          >
            Sync queued
          </span>
        ) : (
          <Button
            type="button"
            size="sm"
            onClick={() => runCommand(VaultSyncCommand.cases.trigger.make({}))}
            disabled={busy || unconfigured}
            data-testid="vault-sync-trigger"
          >
            {syncing ? "Requesting…" : "Sync now"}
          </Button>
        )}
        <VaultSyncActionStatus state={panelState} />
      </div>

      <VaultSyncConflictsList
        busy={busy}
        pendingReview={(conflict) => reviewQueued(queue, DEFAULT_PROFESSIONAL_WORKSPACE_ID, conflict.id)}
        pendingReviews={pendingReviews}
        rejection={rejection}
        offline={offline}
        conflicts={conflicts}
        onRetry={refreshConflicts}
        onReview={(conflict) =>
          runCommand(
            VaultSyncCommand.cases.review.make({
              conflictId: conflict.id,
              conflictKind: conflict.conflictKind,
              ...O.match(conflict.localRelPath, {
                onNone: () => ({}),
                onSome: (localRelPath) => ({ localRelPath }),
              }),
            })
          )
        }
      />
    </section>
  );
  // Docked, the card scrolls inside its dock area rather than past it; the bottom padding keeps
  // its last row clear of the floating composer control.
  return floating ? card : <div className="h-full overflow-y-auto px-4 pb-20">{card}</div>;
}
