## 1. Instance

- id: `intake-vault-status`
- file:line: `apps/professional-desktop/src/intake/Intake.atoms.ts:1109`
- symbol: `DocumentIntakeSurface`
- members: `configured`, `needsOnboarding`
- evidence classes:
  - E1 at `apps/professional-desktop/src/intake/Intake.atoms.ts:1200-1201` — Both flags are projected in one write from a single AsyncResult<Option<vaultRootPath>>: Some => configured, None => needsOnboarding.
  - E4 at `apps/professional-desktop/src/intake/Intake.atoms.ts:1103` — JSDoc declares them mutually exclusive; pending state is both-false — an ordered three-state machine flattened into two bits.

The brief's E4 citation is the second projection line; live re-verification found the cited JSDoc invariant at `apps/professional-desktop/src/intake/Intake.atoms.ts:1103`.

Current source rechecked at `7440cb8c4302ce64b87860069a464bafbf65f576`, with an identical
packages/apps corpus to main `9b7553f618b2b3ee10e11a3d6ee93606f3e40ce1`.
This refresh is design preparation; replacement independent P3 review is pending.

## 2. Current shape

Live declaration at `apps/professional-desktop/src/intake/Intake.atoms.ts:1109`:

```ts
export interface DocumentIntakeSurface {
  readonly actions: {
    readonly cancelManualVaultPath: () => void;
    readonly chooseVault: () => void;
    readonly clearResults: () => void;
    readonly dragEnter: (input: { readonly preventDefault: () => void }) => void;
    readonly dragLeave: (input: { readonly currentTarget: Node; readonly relatedTarget: EventTarget | null }) => void;
    readonly dragOver: (input: { readonly preventDefault: () => void }) => void;
    readonly drop: (input: { readonly files: ReadonlyArray<File>; readonly preventDefault: () => void }) => void;
    readonly fileSelection: (files: ReadonlyArray<File>) => void;
    readonly openFilePicker: () => void;
    readonly setFileInput: (element: HTMLInputElement | null) => void;
    readonly submitManualVaultPath: (path: string) => void;
  };
  readonly configured: boolean;
  readonly needsOnboarding: boolean;
  readonly state: DocumentIntakeState;
}
```

The single producer is inside `documentIntakeSurfaceAtoms` at `apps/professional-desktop/src/intake/Intake.atoms.ts:1194`, with the exclusive flag projection at lines 1200-1201:

```ts
return {
  state,
  configured: AsyncResult.isSuccess(vaultConfig) && O.isSome(vaultConfig.value.vaultRootPath),
  needsOnboarding: AsyncResult.isSuccess(vaultConfig) && O.isNone(vaultConfig.value.vaultRootPath),
  actions: get(documentIntakeActionsAtoms(workspaceId)),
};
```

## 3. Cardinality gap

The two booleans represent four combinations, but only three are legal:

- `pending`: vault configuration has not resolved successfully; both current flags are false.
- `configured`: the successful configuration contains a vault root path.
- `needs-onboarding`: the successful configuration contains no vault root path.

`configured && needsOnboarding` is illegal because a single `Option` cannot be both `Some` and `None`.

## 4. Target schema

Reuse the file's existing `LiteralKit` import and `$I` identity composer. Name the kit and its derived type `DocumentIntakeVaultStatus`, and replace both fields with `vaultStatus`:

```ts
export const DocumentIntakeVaultStatus = LiteralKit(["pending", "configured", "needs-onboarding"]).pipe(
  $I.annoteSchema("DocumentIntakeVaultStatus", {
    description: "Resolved vault availability used by the document-intake surface.",
  })
);

export type DocumentIntakeVaultStatus = typeof DocumentIntakeVaultStatus.Type;

export interface DocumentIntakeSurface {
  readonly actions: {
    readonly cancelManualVaultPath: () => void;
    readonly chooseVault: () => void;
    readonly clearResults: () => void;
    readonly dragEnter: (input: { readonly preventDefault: () => void }) => void;
    readonly dragLeave: (input: { readonly currentTarget: Node; readonly relatedTarget: EventTarget | null }) => void;
    readonly dragOver: (input: { readonly preventDefault: () => void }) => void;
    readonly drop: (input: { readonly files: ReadonlyArray<File>; readonly preventDefault: () => void }) => void;
    readonly fileSelection: (files: ReadonlyArray<File>) => void;
    readonly openFilePicker: () => void;
    readonly setFileInput: (element: HTMLInputElement | null) => void;
    readonly submitManualVaultPath: (path: string) => void;
  };
  readonly vaultStatus: DocumentIntakeVaultStatus;
  readonly state: DocumentIntakeState;
}
```

Derive the value from the existing upstream `AsyncResult` rather than storing another state.
Preserve the exact `isSuccess` policy: a success retained while waiting still
projects configured/onboarding from its Option; both initial and failure
project pending. Do not add an `isWaiting` guard that hides a retained success:


```ts
const vaultStatus = AsyncResult.isSuccess(vaultConfig)
  ? O.match(vaultConfig.value.vaultRootPath, {
      onNone: () => DocumentIntakeVaultStatus.Enum["needs-onboarding"],
      onSome: () => DocumentIntakeVaultStatus.Enum.configured,
    })
  : DocumentIntakeVaultStatus.Enum.pending;

return {
  state,
  vaultStatus,
  actions: get(documentIntakeActionsAtoms(workspaceId)),
};
```

Consumers use the kit-derived guards, not new boolean aliases:

```tsx
<IntakeFileControls actions={surface.actions} vaultStatus={surface.vaultStatus} />

if (DocumentIntakeVaultStatus.is["needs-onboarding"](surface.vaultStatus)) {
  return <VaultOnboarding actions={surface.actions} selection={surface.state.vaultSelection} />;
}
```

`IntakeFileControls` should accept `vaultStatus: DocumentIntakeVaultStatus` and render only when `DocumentIntakeVaultStatus.is.configured(vaultStatus)`.

## 5. Migration inventory

- `apps/professional-desktop/src/intake/Intake.atoms.ts:1103` — rewrite the JSDoc from a two-flag invariant to the three named `DocumentIntakeVaultStatus` cases.
- `apps/professional-desktop/src/intake/Intake.atoms.ts:1109-1126` — replace `configured` and `needsOnboarding` with `vaultStatus: DocumentIntakeVaultStatus`.
- `apps/professional-desktop/src/intake/Intake.atoms.ts:1194-1203` — replace both flag writes with the single upstream-derived `vaultStatus` projection.
- `apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:240-247` — change `IntakeFileControls` from a `configured` boolean prop to the literal `vaultStatus` prop and replace the truthiness read with `DocumentIntakeVaultStatus.is.configured(vaultStatus)`.
- `apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:297` — pass `surface.vaultStatus` instead of `surface.configured`.
- `apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:362` — replace `surface.needsOnboarding` in `VaultOnboardingGate` with the `needs-onboarding` kit guard.

No other source, package, or test reference to either member exists in the live repository search.

## 6. Guard-deletion accounting

- `apps/professional-desktop/src/intake/Intake.atoms.ts:1103` — delete the comment-only invariant that `configured` and `needsOnboarding` are mutually exclusive and that both false means pending; the literal names those states.
- `apps/professional-desktop/src/intake/Intake.atoms.ts:1200-1201` — delete the two parallel `AsyncResult.isSuccess(...) && Option` coherence checks and perform one exhaustive projection.
- `apps/professional-desktop/src/intake/DocumentIntakeTarget.tsx:247` and `:362` — delete independent reads of the two flags; both branch from one schema-derived value.

There is no legacy normalizer or mutual-exclusion error to retain.

## 7. Encoded-side impact

none (internal)

`DocumentIntakeSurface` is an atom-derived React view and is not persisted or transmitted.

## 8. Test impact

No test currently reads `configured` or `needsOnboarding`. `apps/professional-desktop/test/intake-atoms.test.ts` exercises the underlying intake and vault-selection atoms but does not assert the surface projection. Include initial, failure, and success-with-waiting fixtures; retained success
must still select configured/onboarding. Add focused atom assertions for all three `DocumentIntakeVaultStatus` cases so pending, configured, and needs-onboarding remain tied to the upstream `AsyncResult<Option<...>>`. Record the affected portless vault-onboarding and file-intake controls and complete browser-qa-loop record -> extract -> judge evidence with `requiredCount: 0`.

## 9. Risk & sequencing

Land `Intake.atoms.ts` and `DocumentIntakeTarget.tsx` together because the surface interface is consumed directly by the React component. The work shares `Intake.atoms.ts` with other intake state machinery, but has no cross-package or encoded blast radius.
