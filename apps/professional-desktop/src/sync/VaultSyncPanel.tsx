/**
 * App-level vault sync status panel.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { MarkVaultSyncConflictReviewedPayload } from "@beep/documents-use-cases/public";
import { Button } from "@beep/ui/components/button";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Effect } from "effect";
import * as O from "effect/Option";
import { AsyncResult } from "effect/unstable/reactivity";
import { useState } from "react";
import { DEFAULT_WORKSPACE_ID } from "@/intake/Intake.atoms";
import { failureMessageOr } from "@/lib/failureMessage";
import {
  markVaultSyncConflictReviewedAtom,
  triggerVaultSyncAtom,
  vaultSyncConflictsAtom,
  vaultSyncStatusAtom,
} from "./Sync.atoms.js";
import type { SyncConflict } from "@beep/documents-domain/entities/SyncConflict";
import type { VaultSyncStatus } from "@beep/documents-use-cases/public";
import type { JSX } from "react";

const syncFailureMessage = failureMessageOr("Vault sync failed.");

const reviewFailureMessage = failureMessageOr("Marking the conflict reviewed failed.");

type StatusCountEntry = {
  readonly key: string;
  readonly label: string;
  readonly value: number;
};

const statusCounts = (status: VaultSyncStatus): ReadonlyArray<StatusCountEntry> => [
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
}: {
  readonly status: AsyncResult.AsyncResult<VaultSyncStatus, unknown>;
}): JSX.Element =>
  AsyncResult.match(status, {
    onInitial: () => (
      <p className="mt-2 text-xs text-muted-foreground" data-testid="vault-sync-status">
        Loading sync status
      </p>
    ),
    onFailure: () => (
      <p className="mt-2 text-xs text-destructive" data-testid="vault-sync-status">
        Sync status is unavailable.
      </p>
    ),
    onSuccess: (success) => (
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1" data-testid="vault-sync-status">
        {statusCounts(success.value).map((entry) => (
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

const VaultSyncConflictsList = ({
  conflicts,
  onReview,
  reviewingId,
}: {
  readonly conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown>;
  readonly onReview: (conflict: SyncConflict) => void;
  readonly reviewingId: SyncConflict["id"] | null;
}): JSX.Element | null =>
  AsyncResult.isSuccess(conflicts) && conflicts.value.length > 0 ? (
    <ul className="mt-3 space-y-2" data-testid="vault-sync-conflicts">
      {conflicts.value.map((conflict) => (
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
              disabled={reviewingId !== null}
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

/**
 * Floating vault sync status surface: provider connection badge, sync trigger,
 * reconciliation counts, and the open drift records with per-row review.
 *
 * While Box is not connected (no `CLOUD_BOX_TOKEN`), the panel shows setup
 * guidance and keeps the sync trigger disabled instead of surfacing a failing
 * remote call.
 *
 * @example
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
  const status = useAtomValue(vaultSyncStatusAtom(DEFAULT_WORKSPACE_ID));
  const conflicts = useAtomValue(vaultSyncConflictsAtom(DEFAULT_WORKSPACE_ID));
  const triggerSync = useAtomSet(triggerVaultSyncAtom, { mode: "promise" });
  const markReviewed = useAtomSet(markVaultSyncConflictReviewedAtom, { mode: "promise" });
  const [syncing, setSyncing] = useState(false);
  const [reviewingId, setReviewingId] = useState<SyncConflict["id"] | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const connected = AsyncResult.isSuccess(status) && status.value.connected;

  const runSync = (): void => {
    setSyncing(true);
    setActionMessage(null);
    void Effect.runPromise(
      Effect.tryPromise({ try: () => triggerSync(DEFAULT_WORKSPACE_ID), catch: syncFailureMessage }).pipe(
        Effect.matchEffect({
          onFailure: (message) => Effect.sync(() => setActionMessage(message)),
          onSuccess: () => Effect.sync(() => setActionMessage(null)),
        }),
        Effect.ensuring(Effect.sync(() => setSyncing(false)))
      )
    );
  };

  const reviewConflict = (conflict: SyncConflict): void => {
    setReviewingId(conflict.id);
    setActionMessage(null);
    void Effect.runPromise(
      Effect.tryPromise({
        try: () =>
          markReviewed(
            MarkVaultSyncConflictReviewedPayload.make({
              conflictId: conflict.id,
              workspaceId: DEFAULT_WORKSPACE_ID,
            })
          ),
        catch: reviewFailureMessage,
      }).pipe(
        Effect.matchEffect({
          onFailure: (message) => Effect.sync(() => setActionMessage(message)),
          onSuccess: () => Effect.sync(() => setActionMessage(null)),
        }),
        Effect.ensuring(Effect.sync(() => setReviewingId(null)))
      )
    );
  };

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
      <VaultSyncStatusView status={status} />
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
          onClick={runSync}
          disabled={syncing || !connected}
          data-testid="vault-sync-trigger"
        >
          {syncing ? "Syncing" : "Sync now"}
        </Button>
        {actionMessage === null ? null : (
          <span className="text-xs text-destructive" data-testid="vault-sync-error">
            {actionMessage}
          </span>
        )}
      </div>
      <VaultSyncConflictsList conflicts={conflicts} onReview={reviewConflict} reviewingId={reviewingId} />
    </section>
  );
}
