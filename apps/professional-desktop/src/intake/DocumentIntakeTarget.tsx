/**
 * App-level document intake drag-and-drop target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { Button } from "@beep/ui/components/button";
import { A, O } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { AsyncResult } from "effect/unstable/reactivity";
import { Fragment } from "react";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import {
  chooseWorkspaceVaultAtoms,
  clearIntakeResultsAtoms,
  documentIntakeStateAtoms,
  IntakeResultEntry,
  intakeDomEventAtoms,
  openIntakeFilePickerAtoms,
  setIntakeFileInputAtoms,
  VaultSelectionState,
  workspaceVaultConfigAtom,
} from "./Intake.atoms.ts";
import type { JSX, ReactNode } from "react";
import type { VaultSelectionState as VaultSelectionStateType } from "./Intake.atoms.ts";

const intakeResultKey = (entry: IntakeResultEntry, index: number): string =>
  IntakeResultEntry.match(entry, {
    document: ({ document }) => `${index}-${document.contentDigest}`,
    failure: ({ fileName }) => `${index}-${fileName}`,
  });

const intakeResultRow = (entry: IntakeResultEntry): JSX.Element =>
  IntakeResultEntry.match(entry, {
    failure: ({ fileName, message }) => (
      <li className="rounded-sm border border-destructive/40 p-2" data-testid="intake-result-failure">
        <span className="font-medium">{fileName}</span>
        <p className="mt-1 text-xs text-destructive">{message}</p>
      </li>
    ),
    document: ({ document }) =>
      FilingOutcome.match(document.filing, {
        filed: (filed) => (
          <li className="rounded-sm border p-2" data-testid="intake-result-filed">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{document.originalFileName}</span>
              <span className="rounded-sm bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                {filed.taxonomyConceptId}
              </span>
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">{document.vaultPath.relativePath}</p>
            <p className="mt-1 text-xs text-muted-foreground">{filed.rationale}</p>
          </li>
        ),
        inboxed: (inboxed) => (
          <li className="rounded-sm border border-amber-500/40 p-2" data-testid="intake-result-inboxed">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium">{document.originalFileName}</span>
              <span className="rounded-sm bg-amber-500/10 px-1.5 py-0.5 text-xs text-amber-600">inbox</span>
            </div>
            <p className="mt-1 break-all text-xs text-muted-foreground">{document.vaultPath.relativePath}</p>
            <p className="mt-1 text-xs text-muted-foreground">{inboxed.rationale}</p>
          </li>
        ),
      }),
  });

const VaultOnboarding = ({
  onChoose,
  selection,
}: {
  readonly onChoose: () => void;
  readonly selection: VaultSelectionStateType;
}): JSX.Element => {
  const presentation = VaultSelectionState.match(selection, {
    idle: () => ({ disabled: false, label: "Choose folder", status: O.none<string>() }),
    choosing: () => ({ disabled: true, label: "Choosing folder…", status: O.some("Opening folder picker") }),
    saving: () => ({ disabled: true, label: "Saving…", status: O.some("Saving workspace vault") }),
    failed: ({ message }) => ({ disabled: false, label: "Choose folder", status: O.some(message) }),
  });

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
      <section className="w-full max-w-md rounded-md border bg-card p-5 shadow-sm" data-testid="vault-onboarding">
        <h1 className="text-lg font-semibold">Choose workspace vault</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select the local folder where filed documents will land.</p>
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" disabled={presentation.disabled} onClick={onChoose} data-testid="vault-choose">
            {presentation.label}
          </Button>
          {O.match(presentation.status, {
            onNone: () => null,
            onSome: (message) => <span className="text-sm text-muted-foreground">{message}</span>,
          })}
        </div>
      </section>
    </div>
  );
};

const IntakeBusyBadge = ({ activeBatches }: { readonly activeBatches: number }): JSX.Element | null =>
  activeBatches === 0 ? null : (
    <div
      className="absolute right-4 top-16 z-40 rounded-md border bg-card px-3 py-2 text-sm shadow-sm"
      data-testid="intake-busy"
    >
      Filing {activeBatches === 1 ? "documents" : `${activeBatches} batches`}
    </div>
  );

const IntakeResultsPanel = ({
  onClear,
  results,
}: {
  readonly onClear: () => void;
  readonly results: ReadonlyArray<IntakeResultEntry>;
}): JSX.Element | null =>
  A.isReadonlyArrayEmpty(results) ? null : (
    <div
      className="absolute bottom-4 right-4 z-40 max-h-80 w-96 overflow-y-auto rounded-md border bg-card p-3 text-sm shadow-sm"
      data-testid="intake-results"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Intake results</h2>
        <Button type="button" variant="ghost" size="sm" onClick={onClear} data-testid="intake-results-clear">
          Clear
        </Button>
      </div>
      <ul className="mt-2 space-y-2">
        {A.map(results, (entry, index) => (
          <Fragment key={intakeResultKey(entry, index)}>{intakeResultRow(entry)}</Fragment>
        ))}
      </ul>
    </div>
  );

type VoidIntakeAction = (input: void) => void;

const IntakeDraggingOverlay = ({ visible }: { readonly visible: boolean }): JSX.Element | null =>
  visible ? (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-foreground backdrop-blur">
      Drop documents to file
    </div>
  ) : null;

const IntakeFileControls = ({
  configured,
  onFileSelection,
  openFilePicker,
  setFileInput,
}: {
  readonly configured: boolean;
  readonly onFileSelection: (files: ReadonlyArray<File>) => void;
  readonly openFilePicker: VoidIntakeAction;
  readonly setFileInput: (element: HTMLInputElement | null) => void;
}): JSX.Element | null =>
  configured ? (
    <>
      <input
        ref={setFileInput}
        type="file"
        multiple
        className="hidden"
        data-testid="intake-file-input"
        onChange={(event) => onFileSelection(A.fromIterable(event.target.files ?? []))}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute bottom-4 left-4 z-40"
        data-testid="intake-choose-files"
        onClick={() => openFilePicker(void 0)}
      >
        File documents…
      </Button>
    </>
  ) : null;

const IntakeWorkspaceSurface = ({
  activeBatches,
  children,
  clearResults,
  configured,
  isDragging,
  onDragEnter,
  onDragLeave,
  onDragOver,
  onDrop,
  onFileSelection,
  openFilePicker,
  results,
  setFileInput,
}: {
  readonly activeBatches: number;
  readonly children: ReactNode;
  readonly clearResults: VoidIntakeAction;
  readonly configured: boolean;
  readonly isDragging: boolean;
  readonly onDragEnter: (input: { readonly preventDefault: () => void }) => void;
  readonly onDragLeave: (input: { readonly currentTarget: Node; readonly relatedTarget: EventTarget | null }) => void;
  readonly onDragOver: (input: { readonly preventDefault: () => void }) => void;
  readonly onDrop: (input: { readonly files: ReadonlyArray<File>; readonly preventDefault: () => void }) => void;
  readonly onFileSelection: (files: ReadonlyArray<File>) => void;
  readonly openFilePicker: VoidIntakeAction;
  readonly results: ReadonlyArray<IntakeResultEntry>;
  readonly setFileInput: (element: HTMLInputElement | null) => void;
}): JSX.Element => (
  <div
    className="relative h-screen w-full"
    onDragEnter={(event) => onDragEnter({ preventDefault: () => event.preventDefault() })}
    onDragOver={(event) => onDragOver({ preventDefault: () => event.preventDefault() })}
    onDragLeave={(event) =>
      onDragLeave({
        currentTarget: event.currentTarget,
        relatedTarget: event.relatedTarget,
      })
    }
    onDrop={(event) =>
      onDrop({
        files: A.fromIterable(event.dataTransfer.files),
        preventDefault: () => event.preventDefault(),
      })
    }
    data-testid="document-intake-target"
  >
    {children}
    <IntakeDraggingOverlay visible={isDragging} />
    <IntakeFileControls
      configured={configured}
      onFileSelection={onFileSelection}
      openFilePicker={openFilePicker}
      setFileInput={setFileInput}
    />
    <IntakeBusyBadge activeBatches={activeBatches} />
    <IntakeResultsPanel results={results} onClear={() => clearResults(void 0)} />
  </div>
);

/**
 * Full-screen boundary that onboards a workspace vault and routes DOM events
 * into runtime-owned document intake actions.
 *
 * **Example** (Create React Element)
 *
 * ```ts
 * import { DocumentIntakeTarget } from "@/intake/DocumentIntakeTarget"
 * import { createElement } from "react"
 *
 * const element = createElement(DocumentIntakeTarget, { children: null })
 * console.log(element.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function DocumentIntakeTarget({ children }: { readonly children: ReactNode }): JSX.Element {
  const vaultConfig = useAtomValue(workspaceVaultConfigAtom(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const state = useAtomValue(documentIntakeStateAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const chooseVault = useAtomSet(chooseWorkspaceVaultAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const clearResults = useAtomSet(clearIntakeResultsAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const intakeDomEvents = intakeDomEventAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID);
  const onDragEnter = useAtomSet(intakeDomEvents.dragEnter);
  const onDragLeave = useAtomSet(intakeDomEvents.dragLeave);
  const onDragOver = useAtomSet(intakeDomEvents.dragOver);
  const onDrop = useAtomSet(intakeDomEvents.drop);
  const onFileSelection = useAtomSet(intakeDomEvents.fileSelection);
  const openFilePicker = useAtomSet(openIntakeFilePickerAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));
  const setFileInput = useAtomSet(setIntakeFileInputAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

  const configured = AsyncResult.isSuccess(vaultConfig) && O.isSome(vaultConfig.value.vaultRootPath);
  const needsOnboarding = AsyncResult.isSuccess(vaultConfig) && O.isNone(vaultConfig.value.vaultRootPath);

  if (needsOnboarding) {
    return <VaultOnboarding onChoose={() => chooseVault(void 0)} selection={state.vaultSelection} />;
  }

  return (
    <IntakeWorkspaceSurface
      activeBatches={state.activeBatches}
      clearResults={clearResults}
      configured={configured}
      isDragging={state.isDragging}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onFileSelection={onFileSelection}
      openFilePicker={openFilePicker}
      results={state.results}
      setFileInput={setFileInput}
    >
      {children}
    </IntakeWorkspaceSurface>
  );
}
