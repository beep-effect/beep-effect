## 1. Instance

- id: `r2-apps-vault-sync-command-busy`
- file:line: `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:268`
- symbol: `VaultSyncPanel`
- members: `syncing`, `busy`
- evidence classes:
  - E4 at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:269` — busy is syncing || reviewing, so syncing implies busy; syncing && !busy is illegal.
  - E2 at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:301` — Label switches on syncing; the trigger disables on busy. Reviewing is busy-without-syncing.

## 2. Current shape

Live sibling-state declaration at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:264`:

```ts
const panelState = useAtomValue(vaultSyncPanelStateAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
const runCommand = useAtomSet(vaultSyncCommandAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

const connected = AsyncResult.isSuccess(status) && status.value.connected;
const syncing = VaultSyncPanelState.guards.syncing(panelState);
const busy = syncing || VaultSyncPanelState.guards.reviewing(panelState);
```

`busy` is also flattened into the child props at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:172`:

```ts
const VaultSyncConflictsList = ({
  conflicts,
  onRetry,
  onReview,
  busy,
}: {
  readonly busy: boolean;
```

## 3. Cardinality gap

The two derived booleans represent four combinations, but only three are legal:

- `idle`: neither syncing nor reviewing; this projection also includes succeeded/failed display states because both leave controls idle.
- `syncing`: syncing and busy.
- `reviewing`: busy but not syncing.

`syncing && !busy` is illegal. The authoritative upstream state already has honest variants: `idle | syncing | reviewing | succeeded | failed`.

## 4. Target schema

Do not create a new literal. Reuse and pass through the existing `VaultSyncPanelState` tagged union from `apps/professional-desktop/src/sync/Sync.atoms.ts:116`:

```ts
export const VaultSyncPanelState = VaultSyncPanelStateKind.mapMembers(
  Tuple.evolve([
    () => VaultSyncIdleState,
    () => VaultSyncRunningState,
    () => VaultSyncReviewingState,
    () => VaultSyncSucceededState,
    () => VaultSyncFailedState,
  ])
)
  .annotate(
    $I.annote("VaultSyncPanelState", {
      description: "Exhaustive lifecycle state for vault sync and conflict-review actions.",
    })
  )
  .pipe(S.toTaggedUnion("kind"));

export type VaultSyncPanelState = typeof VaultSyncPanelState.Type;
```

Replace `busy` props with the upstream state and use its schema-derived grouped guard:

```tsx
const VaultSyncConflictsList = ({
  conflicts,
  onRetry,
  onReview,
  panelState,
}: {
  readonly panelState: VaultSyncPanelState;
  readonly conflicts: AsyncResult.AsyncResult<ReadonlyArray<SyncConflict>, unknown>;
  readonly onRetry: () => void;
  readonly onReview: (conflict: SyncConflict) => void;
}): JSX.Element | null => {
  // ...
  return (
    <Button
      disabled={VaultSyncPanelState.isAnyOf(["syncing", "reviewing"])(panelState)}
      onClick={() => onReview(conflict)}
    >
      Mark reviewed
    </Button>
  );
};
```

The main trigger likewise uses `VaultSyncPanelState.isAnyOf(["syncing", "reviewing"])(panelState)` for disabled state and `VaultSyncPanelState.guards.syncing(panelState)` directly for its label. Pass `panelState={panelState}` to the conflict list. No `syncing` or `busy` local is stored.

## 5. Migration inventory

- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:176` — rename the child prop from `busy` to `panelState` and type it as `VaultSyncPanelState`.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:218` — replace the `busy` read with the existing tagged union's grouped `syncing/reviewing` guard.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:268` — delete both derived booleans; retain the upstream `panelState` unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:298` — derive disabled state directly from the grouped tagged-union guard plus independent connection state.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:301` — derive the label directly from `VaultSyncPanelState.guards.syncing(panelState)`.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:306` — pass `panelState` instead of `busy`.
- `apps/professional-desktop/src/sync/Sync.atoms.ts:116` — no change; this is the authoritative existing schema being reused.

No other source or test reads or writes these two local variables.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:268` — delete the `syncing` boolean projection.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:269` — delete `syncing || reviewing`, the runtime implication/coherence formula defining busy; grouped cases come from the existing tagged schema.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:176` and `:306` — delete the child-prop obligation to flatten and keep busy coherent with the upstream panel state.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:218`, `:298`, and `:301` — delete reads split across `busy` and `syncing`; controls consume the authoritative union directly.

There is no legacy normalizer, explicit mutual-exclusion error, or comment-only invariant for this pair.

## 7. Encoded-side impact

none (internal)

The existing `VaultSyncPanelState` schema and encoding do not change. This refactor only stops flattening it into transient React booleans.

## 8. Test impact

- `apps/professional-desktop/test/sync-atoms.test.ts:66` and `:107` — existing tests prove the authoritative `syncing` and `reviewing` variants; no fixture shape changes.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:48`, `:59`, and `:79` — preserve trigger disabled/enabled behavior for independent connection state.
- `apps/professional-desktop/test/sync-retry.test.tsx:12` — the panel render remains unaffected.
- Add UI cases that seed `vaultSyncPanelStateAtoms` with `syncing` and `reviewing` and assert both trigger/review controls are disabled, while only syncing changes the trigger label.

## 9. Risk & sequencing

No schema migration is required because the correct tagged union already exists. The change is confined to `VaultSyncPanel.tsx`, but that file is shared by sync UI tests and any other batch editing the panel. Preserve the separate `connected` boolean: connection availability is independent of command lifecycle and is not part of this boolean-creep instance.
