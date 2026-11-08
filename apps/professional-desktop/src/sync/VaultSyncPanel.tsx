/**
 * App-level vault sync status panel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import * as V from "@beep/documents-domain/aggregates/VaultSync";
import { DmsMirrorDisconnectReason } from "@beep/documents-use-cases/public";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import { thunkNull } from "@beep/utils/thunk";
import { useAtomMount, useAtomRefresh, useAtomSet, useAtomValue } from "@effect/atom-react";
import * as DateTime from "effect/DateTime";
import { pipe } from "effect/Function";
import * as H from "effect/HashMap";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import { vaultSyncConflictsAtom, vaultSyncStatusAtom } from "./Sync.atoms.ts";
import {
  vaultSyncDismissRefusalAtom,
  vaultSyncFlushAtom,
  vaultSyncIntentQueueAtom,
  vaultSyncLinkAtom,
  vaultSyncPredictionAtom,
  vaultSyncRefusalsAtom,
  vaultSyncReplayOnReconnectAtom,
  vaultSyncServerStateAtom,
  vaultSyncSubmitAtom,
} from "./VaultSyncIntent.atoms.ts";
import { VaultSyncAction, VaultSyncActionKind } from "./VaultSyncIntent.model.ts";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import type { VaultSyncStatus } from "@beep/documents-use-cases/public";
import type { JSX } from "react";
import type { VaultSyncIntent, VaultSyncRefusal } from "./VaultSyncIntent.model.ts";
import type { VaultSyncPrediction } from "./VaultSyncIntent.prediction.ts";

const statusCounts = (status: VaultSyncStatus) => [
  { key: "pending", label: "Pending", value: status.pendingItems },
  { key: "current", label: "Current", value: status.currentItems },
  { key: "error", label: "Errors", value: status.errorItems },
  { key: "conflict", label: "Conflicts", value: status.conflictItems },
  { key: "queued-ops", label: "Queued ops", value: status.queuedOperations },
  { key: "failed-ops", label: "Failed ops", value: status.failedOperations },
  { key: "open-conflicts", label: "Open conflicts", value: status.openConflicts },
];

// While the sidecar is unreachable the Box state is only the last answer it gave, so the badge
// drops its live colour and says so instead of claiming a healthy connection.
const ConnectionBadge = ({
  connected,
  lastKnown,
}: {
  readonly connected: boolean;
  readonly lastKnown: boolean;
}): JSX.Element => (
  <span
    className={
      lastKnown
        ? "rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
        : connected
          ? "rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
          : "rounded-sm bg-warning/10 px-1.5 py-0.5 text-xs text-warning-text"
    }
    data-testid="vault-sync-connection"
    data-last-known={lastKnown}
  >
    {connected ? "connected" : "disconnected"}
    {lastKnown ? " (last known)" : ""}
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

const actionLabel = (kind: VaultSyncActionKind): string =>
  VaultSyncActionKind.match(kind, {
    "request-sync": () => "Sync now",
    probe: () => "Retry connection",
    pause: () => "Pause sync",
    resume: () => "Resume sync",
    "review-conflict": () => "Mark reviewed",
  });

const refusalReason = (refusal: VaultSyncRefusal): string =>
  refusal.reason._tag === "SyncRuleViolation"
    ? Str.replaceAll("-", " ")(refusal.reason.rule)
    : "this session may not act on the workspace";

// A refusal is the typed rejection the server's decide returned (or that the
// same decide predicted locally): its prediction is already reverted, so the
// notice says which action did not happen and why.
const VaultSyncRefusals = ({
  refusals,
  onDismiss,
}: {
  readonly refusals: ReadonlyArray<VaultSyncRefusal>;
  readonly onDismiss: (commandId: string) => void;
}): JSX.Element | null =>
  A.isReadonlyArrayNonEmpty(refusals) ? (
    <ul className="mt-2 space-y-1" data-testid="vault-sync-refusals">
      {A.map(refusals, (refusal) => (
        <li
          key={refusal.commandId}
          className="flex items-center justify-between gap-2 rounded-sm border border-destructive/40 px-2 py-1.5 text-xs text-destructive"
          role="alert"
          data-testid="vault-sync-refusal"
          data-source={refusal.source}
        >
          <span>
            {actionLabel(refusal.intentKind)} {refusal.source === "server" ? "was refused" : "would be refused"}:{" "}
            {refusalReason(refusal)}.
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onDismiss(refusal.commandId)}
            data-testid="vault-sync-refusal-dismiss"
          >
            Dismiss
          </Button>
        </li>
      ))}
    </ul>
  ) : null;

// Queued intents are what the operator asked for and the sidecar has not
// answered yet. Offline they wait; the panel already shows their predicted
// effect, and a replay sends each one again with the same command id.
const VaultSyncPendingIntents = ({
  intents,
  offline,
  onRetry,
}: {
  readonly intents: ReadonlyArray<VaultSyncIntent>;
  readonly offline: boolean;
  readonly onRetry: () => void;
}): JSX.Element | null =>
  A.isReadonlyArrayNonEmpty(intents) ? (
    <div className="mt-2 rounded-sm border border-dashed p-2 text-xs" data-testid="vault-sync-pending">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {offline ? "Queued until the sidecar answers" : "Sending"} ({intents.length})
        </span>
        {offline ? (
          <Button type="button" size="sm" variant="outline" onClick={onRetry} data-testid="vault-sync-pending-retry">
            Retry now
          </Button>
        ) : null}
      </div>
      <ol className="mt-1 space-y-0.5 text-muted-foreground">
        {A.map(intents, (intent) => (
          <li key={intent.commandId} data-testid="vault-sync-pending-intent" data-kind={intent.action.kind}>
            {actionLabel(intent.action.kind)}
          </li>
        ))}
      </ol>
    </div>
  ) : null;

const DestinationStateBadge = ({ paused }: { readonly paused: boolean }): JSX.Element => (
  <span
    className={
      paused
        ? "rounded-sm bg-warning/10 px-1.5 py-0.5 text-warning-text"
        : "rounded-sm bg-primary/10 px-1.5 py-0.5 text-primary"
    }
    data-testid="vault-sync-destination-state"
  >
    {paused ? "paused" : "active"}
  </span>
);

const DestinationSummary = ({
  prediction,
  pending,
  lastKnown,
}: {
  readonly lastKnown: boolean;
  readonly prediction: VaultSyncPrediction;
  readonly pending: boolean;
}): JSX.Element | null =>
  prediction.destination._tag === "Registered" ? (
    <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground" data-testid="vault-sync-destination">
      <span className="font-medium text-foreground">{prediction.destination.name}</span>
      <DestinationStateBadge paused={prediction.destination.paused} />
      {pending ? <span data-testid="vault-sync-destination-predicted">(pending confirmation)</span> : null}
      {/* After a reload with the sidecar unreachable the row is the cached last answer. */}
      {lastKnown ? <span data-testid="vault-sync-destination-last-known">last known</span> : null}
    </p>
  ) : null;

const healOperationFor = (publicId: string) =>
  S.decodeOption(V.OperationId)(Str.replace("documents_sync_conflict_", "documents_sync_operation_")(publicId));

const VaultSyncConflictsList = ({
  conflicts,
  onRetry,
  onReview,
  canReview,
  reviewQueued,
}: {
  readonly canReview: (conflict: SyncConflict) => boolean;
  readonly conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown>;
  readonly onRetry: () => void;
  readonly onReview: (conflict: SyncConflict) => void;
  readonly reviewQueued: (conflict: SyncConflict) => boolean;
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
        <li key={conflict.id} className="rounded-sm border border-warning/40 p-2" data-testid="vault-sync-conflict-row">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{conflict.conflictKind}</span>
            {reviewQueued(conflict) ? (
              <span className="text-xs text-muted-foreground" data-testid="vault-sync-conflict-review-queued">
                Review queued
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onReview(conflict)}
                disabled={!canReview(conflict)}
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
  const workspaceId = DEFAULT_PROFESSIONAL_WORKSPACE_ID;
  useAtomMount(vaultSyncReplayOnReconnectAtom(workspaceId));
  const status = useAtomValue(vaultSyncStatusAtom(workspaceId));
  const refreshStatus = useAtomRefresh(vaultSyncStatusAtom(workspaceId));
  const refreshConflicts = useAtomRefresh(vaultSyncConflictsAtom(workspaceId));
  const conflicts = useAtomValue(vaultSyncConflictsAtom(workspaceId));
  const predicted = useAtomValue(vaultSyncPredictionAtom(workspaceId));
  const prediction = O.flatten(predicted);
  const serverState = useAtomValue(vaultSyncServerStateAtom(workspaceId));
  const queue = useAtomValue(vaultSyncIntentQueueAtom);
  const offline = useAtomValue(vaultSyncLinkAtom) === "offline";
  const refusals = useAtomValue(vaultSyncRefusalsAtom);
  const submit = useAtomSet(vaultSyncSubmitAtom(workspaceId));
  const flush = useAtomSet(vaultSyncFlushAtom(workspaceId));
  const dismissRefusal = useAtomSet(vaultSyncDismissRefusalAtom);

  // The last status the sidecar sent stays authoritative for Box connectivity
  // while the sidecar itself is unreachable; intents queue meanwhile.
  const lastStatus = AsyncResult.value(status);
  const connected = O.exists(lastStatus, (value) => value.connected);
  const paused = O.exists(prediction, (value) => value.destination._tag === "Registered" && value.destination.paused);
  const syncBlockedReason = O.isNone(prediction)
    ? O.some("No vault destination is available yet.")
    : !connected
      ? O.some("Box is not connected.")
      : paused
        ? O.some("This destination is paused. Resume sync first.")
        : O.none<string>();
  const recordFor = (conflict: SyncConflict) =>
    O.flatMap(prediction, (value) =>
      value.server.conflicts.pipe(
        H.values,
        A.fromIterable,
        A.findFirst((record) => `${record.publicId}` === `${conflict.publicId}`)
      )
    );
  const reviewQueued = (conflict: SyncConflict) =>
    A.some(
      queue,
      (intent) => intent.action.kind === "review-conflict" && `${intent.action.conflictId}` === `${conflict.publicId}`
    );

  return (
    <section
      className={
        floating
          ? "fixed bottom-4 left-4 z-40 max-h-96 w-80 overflow-y-auto rounded-md border bg-card p-3 text-sm shadow-sm"
          : "mx-auto mt-6 max-h-viewport-inset w-sync-panel overflow-y-auto rounded-lg border bg-card p-5 text-sm shadow-sm"
      }
      data-testid="vault-sync-panel"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Vault sync</h2>
        <div className="flex items-center gap-2">
          {offline ? (
            <span
              className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              data-testid="vault-sync-offline"
            >
              sidecar offline
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground" data-testid="vault-sync-provider">
            {O.match(lastStatus, { onNone: () => "box", onSome: (value) => value.provider })}
          </span>
          <ConnectionBadge connected={connected} lastKnown={offline} />
        </div>
      </div>
      {O.match(prediction, {
        onNone: thunkNull,
        onSome: (value) => (
          <DestinationSummary
            prediction={value}
            pending={A.isReadonlyArrayNonEmpty(value.pending)}
            lastKnown={offline || !AsyncResult.isSuccess(serverState)}
          />
        ),
      })}
      <VaultSyncStatusView status={status} onRetry={refreshStatus} />
      {O.match(lastStatus, {
        onNone: thunkNull,
        onSome: (value) =>
          value.connected ? null : (
            <DisconnectedNote
              probedAt={value.probedAt}
              reason={value.disconnectReason}
              waiting={status.waiting || A.some(queue, (intent) => intent.action.kind === "probe")}
              onRetry={() => submit(VaultSyncAction.cases.probe.make({}))}
            />
          ),
      })}
      <div className="mt-3 flex items-center gap-2">
        <Button
          type="button"
          size="sm"
          // Disabled for long stretches (paused, Box down): muted reads better than a faded primary.
          disabledTone="muted"
          title={O.getOrUndefined(syncBlockedReason)}
          onClick={() => submit(VaultSyncAction.cases["request-sync"].make({}))}
          disabled={O.isSome(syncBlockedReason)}
          data-testid="vault-sync-trigger"
        >
          Sync now
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => submit(paused ? VaultSyncAction.cases.resume.make({}) : VaultSyncAction.cases.pause.make({}))}
          disabled={O.isNone(prediction)}
          data-testid="vault-sync-pause-toggle"
        >
          {paused ? "Resume sync" : "Pause sync"}
        </Button>
      </div>
      <VaultSyncPendingIntents intents={queue} offline={offline} onRetry={() => flush()} />
      <VaultSyncRefusals refusals={refusals} onDismiss={dismissRefusal} />
      <VaultSyncConflictsList
        conflicts={conflicts}
        onRetry={refreshConflicts}
        canReview={(conflict) => O.isSome(recordFor(conflict))}
        reviewQueued={reviewQueued}
        onReview={(conflict) =>
          O.match(
            O.flatMap(recordFor(conflict), (record) =>
              O.map(healOperationFor(record.publicId), (healOperationId) =>
                VaultSyncAction.cases["review-conflict"].make({
                  conflictId: record.publicId,
                  remoteEventId: record.remoteEventId,
                  workspaceId: record.workspaceId,
                  healOperationId,
                })
              )
            ),
            { onNone: () => undefined, onSome: submit }
          )
        }
      />
    </section>
  );
}
