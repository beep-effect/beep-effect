## 1. Instance

- id: `r2-apps-vault-sync-command-busy`
- file:line: `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:310`
- symbol: `VaultSyncPanel`
- members: `syncing`, `busy`
- evidence classes:
  - E4 at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:311` — busy is syncing || reviewing, so syncing implies busy; syncing && !busy is illegal.
  - E2 at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:345-348` — Label switches on syncing; the trigger disables on busy. Reviewing is busy-without-syncing.

## 2. Current shape

Live sibling-state declaration at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:306-311`:

```ts
const panelState = useAtomValue(vaultSyncPanelStateAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
const runCommand = useAtomSet(vaultSyncCommandAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

const connected = AsyncResult.isSuccess(status) && status.value.connected;
const syncing = VaultSyncPanelState.guards.syncing(panelState);
const busy = syncing || VaultSyncPanelState.guards.reviewing(panelState);
```

`busy` is also flattened into the child props at `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:210-217`:

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

Do not create a new literal. Reuse and pass through the existing `VaultSyncPanelState` tagged union from `apps/professional-desktop/src/sync/Sync.atoms.ts:119`:

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

The main trigger likewise uses
`VaultSyncPanelState.isAnyOf(["syncing", "reviewing"])(panelState)` for its
command-lifecycle disabled state and
`VaultSyncPanelState.guards.syncing(panelState)` for its label. This Tier 1D PR
lands after the DMS internal union but before the Vault compatibility codec, so
the independent connection gate reads `status.value.connected` directly in
both its existing `ConnectionBadge` prop and the trigger-disabled expression;
do not retain a local `connected` boolean. Pass `panelState={panelState}` to the
conflict list. No `connected`, `syncing`, or `busy` local is stored. The later
`vault-sync-status-connected` singleton owns the atomic replacement of both
temporary inline wire-field reads with the direct `DmsMirrorConnection` union
after the decoded status actually exposes it.

## 5. Migration inventory

- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:210-217` — rename the child prop from `busy` to `panelState` and type it as `VaultSyncPanelState`.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:256` — replace the `busy` read with the existing tagged union's grouped `syncing/reviewing` guard.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:306-311` — delete `connected`, `syncing`, and `busy`; retain the upstream `panelState` unchanged.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:328` — until the Vault Tier 2 singleton lands, pass `AsyncResult.isSuccess(status) && status.value.connected` directly to the existing boolean `ConnectionBadge` prop so deleting the local does not break this reader.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:345` — derive disabled state directly from the grouped panel-state guard plus the independent inline status-field read. The Vault Tier 2 singleton replaces only that read with `DmsMirrorConnection.guards.connected(status.value.connection)`.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:348` — derive the label directly from `VaultSyncPanelState.guards.syncing(panelState)`.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:352-353` — pass `panelState` instead of `busy`.
- `apps/professional-desktop/src/sync/Sync.atoms.ts:119` — no change; this is the authoritative existing schema being reused.

No other source or test reads or writes these two local variables.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:310-311` — delete the `syncing` projection and `syncing || reviewing` implication/coherence formula; grouped cases come from the existing tagged schema.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:210-217` and `:352-353` — delete the child-prop obligation to flatten and keep busy coherent with the upstream panel state.
- `apps/professional-desktop/src/sync/VaultSyncPanel.tsx:256`, `:345`, and `:348` — delete reads split across `busy` and `syncing`; controls consume the authoritative union directly.

There is no legacy normalizer, explicit mutual-exclusion error, or comment-only invariant for this pair.

## 7. Encoded-side impact

none (internal)

The existing `VaultSyncPanelState` schema and encoding do not change. This refactor only stops flattening it into transient React booleans.

## 8. Test impact

- `apps/professional-desktop/test/sync-atoms.test.ts:72-77` and `:107-113` — existing tests prove the authoritative `syncing` and `reviewing` variants; no fixture shape changes.
- `apps/professional-desktop/test/vault-sync-disconnected-note.test.tsx:48`, `:59`, and `:79` — preserve trigger disabled/enabled behavior for every independent connection case without constructing a local boolean; the sibling Vault Tier 2 PR migrates those fixtures to the decoded connection union.
- `apps/professional-desktop/test/sync-retry.test.tsx:12` — the panel render remains unaffected.
- Add UI cases that seed `vaultSyncPanelStateAtoms` with `syncing` and `reviewing` and assert both trigger/review controls are disabled, while only syncing changes the trigger label.

## 9. Risk & sequencing

No new panel-state schema is required because the command lifecycle union
already exists. Sequence this Tier 1 UI change after the DMS Tier 1 migration,
which supplies the separate connection union. Connection availability remains
independent of command lifecycle, but the UI consumes that honest union rather
than preserving a redundant local boolean. Because the trigger and
conflict-review controls are gesture-bearing UI, run the `browser-qa-loop`
through the portless package script and retain successful record -> extract ->
judge evidence with `requiredCount: 0` in addition to focused tests.
