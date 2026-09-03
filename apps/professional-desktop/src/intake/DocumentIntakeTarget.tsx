/**
 * App-level document intake drag-and-drop target.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { FilingOutcome } from "@beep/documents-domain/aggregates/Document";
import { Button } from "@beep/ui/components/button";
import * as A from "@beep/utils/Array";
import * as O from "@beep/utils/Option";
import * as P from "@beep/utils/Predicate";
import { useAtomValue } from "@effect/atom-react";
import { Fragment } from "react";
import { DEFAULT_PROFESSIONAL_WORKSPACE_ID } from "@/workspace/ProfessionalWorkspace";
import { documentIntakeSurfaceAtoms, IntakeResultEntry, VaultSelectionState } from "./Intake.atoms.ts";
import type { JSX, ReactNode } from "react";
import type { DocumentIntakeSurface, VaultSelectionState as VaultSelectionStateType } from "./Intake.atoms.ts";

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

// The manual path form shown when no native folder picker is reachable. A
// real labelled form replaces the old `window.prompt` fallback: submitting an
// empty or unusable path keeps the form open with inline guidance, and Cancel
// returns to the onboarding card instead of stranding the operator.
const ManualVaultPathForm = ({
  draftPath,
  message,
  onCancel,
  onSubmit,
}: {
  readonly draftPath: O.Option<string>;
  readonly message: O.Option<string>;
  readonly onCancel: () => void;
  readonly onSubmit: (path: string) => void;
}): JSX.Element => (
  <form
    className="mt-4"
    data-testid="vault-manual-form"
    onSubmit={(event) => {
      event.preventDefault();
      const value = new FormData(event.currentTarget).get("vault-path");
      onSubmit(P.isString(value) ? value : "");
    }}
  >
    <label className="text-sm font-medium" htmlFor="vault-manual-path">
      Workspace vault folder
    </label>
    <input
      id="vault-manual-path"
      name="vault-path"
      type="text"
      defaultValue={O.getOrElse(draftPath, () => "")}
      placeholder="/home/you/Documents/beep-vault"
      className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
      data-testid="vault-manual-path"
    />
    <p className="mt-1 text-xs text-muted-foreground">
      No native folder picker is available in this session — enter the absolute path of a local folder.
    </p>
    {O.match(message, {
      onNone: () => null,
      onSome: (text) => (
        <p className="mt-2 text-sm text-destructive" role="alert" data-testid="vault-manual-error">
          {text}
        </p>
      ),
    })}
    <div className="mt-3 flex items-center gap-2">
      <Button type="submit" data-testid="vault-manual-save">
        Use this folder
      </Button>
      <Button type="button" variant="ghost" onClick={onCancel} data-testid="vault-manual-cancel">
        Cancel
      </Button>
    </div>
  </form>
);

const VaultChooseRow = ({
  disabled,
  label,
  onChoose,
  status,
}: {
  readonly disabled: boolean;
  readonly label: string;
  readonly onChoose: () => void;
  readonly status: O.Option<string>;
}): JSX.Element => (
  <div className="mt-4 flex items-center gap-3">
    <Button type="button" disabled={disabled} onClick={onChoose} data-testid="vault-choose">
      {label}
    </Button>
    {O.match(status, {
      onNone: () => null,
      onSome: (message) => <span className="text-sm text-muted-foreground">{message}</span>,
    })}
  </div>
);

const VaultOnboarding = ({
  actions,
  selection,
}: {
  readonly actions: DocumentIntakeSurface["actions"];
  readonly selection: VaultSelectionStateType;
}): JSX.Element => (
  <div className="h-full min-h-0 w-full overflow-y-auto bg-background text-foreground">
    <div className="flex min-h-full w-full items-center justify-center p-4">
      <section className="w-full max-w-md rounded-md border bg-card p-5 shadow-sm" data-testid="vault-onboarding">
        <h1 className="text-lg font-semibold">Choose workspace vault</h1>
        <p className="mt-2 text-sm text-muted-foreground">Select the local folder where filed documents will land.</p>
        {VaultSelectionState.match(selection, {
          idle: () => (
            <VaultChooseRow disabled={false} label="Choose folder" onChoose={actions.chooseVault} status={O.none()} />
          ),
          choosing: () => (
            <VaultChooseRow
              disabled
              label="Choosing folder…"
              onChoose={actions.chooseVault}
              status={O.some("Opening folder picker")}
            />
          ),
          manual: ({ draftPath, message }) => (
            <ManualVaultPathForm
              draftPath={draftPath}
              message={message}
              onCancel={actions.cancelManualVaultPath}
              onSubmit={actions.submitManualVaultPath}
            />
          ),
          saving: () => (
            <VaultChooseRow
              disabled
              label="Saving…"
              onChoose={actions.chooseVault}
              status={O.some("Saving workspace vault")}
            />
          ),
          failed: ({ message }) => (
            <VaultChooseRow
              disabled={false}
              label="Choose folder"
              onChoose={actions.chooseVault}
              status={O.some(message)}
            />
          ),
        })}
      </section>
    </div>
  </div>
);

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

const IntakeDraggingOverlay = ({ visible }: { readonly visible: boolean }): JSX.Element | null =>
  visible ? (
    <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center border-2 border-dashed border-primary bg-background/80 text-sm font-medium text-foreground backdrop-blur">
      Drop documents to file
    </div>
  ) : null;

const IntakeFileControls = ({
  actions,
  configured,
}: {
  readonly actions: DocumentIntakeSurface["actions"];
  readonly configured: boolean;
}): JSX.Element | null =>
  configured ? (
    <>
      <input
        ref={actions.setFileInput}
        type="file"
        multiple
        className="hidden"
        data-testid="intake-file-input"
        onChange={(event) => actions.fileSelection(A.fromIterable(event.target.files ?? []))}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="absolute bottom-4 left-4 z-40"
        data-testid="intake-choose-files"
        onClick={() => actions.openFilePicker()}
      >
        File documents…
      </Button>
    </>
  ) : null;

const IntakeWorkspaceSurface = ({
  children,
  surface,
}: {
  readonly children: ReactNode;
  readonly surface: DocumentIntakeSurface;
}): JSX.Element => (
  <div
    className="relative h-screen w-full"
    onDragEnter={(event) => surface.actions.dragEnter({ preventDefault: () => event.preventDefault() })}
    onDragOver={(event) => surface.actions.dragOver({ preventDefault: () => event.preventDefault() })}
    onDragLeave={(event) =>
      surface.actions.dragLeave({
        currentTarget: event.currentTarget,
        relatedTarget: event.relatedTarget,
      })
    }
    onDrop={(event) =>
      surface.actions.drop({
        files: A.fromIterable(event.dataTransfer.files),
        preventDefault: () => event.preventDefault(),
      })
    }
    data-testid="document-intake-target"
  >
    {children}
    <IntakeDraggingOverlay visible={surface.state.isDragging} />
    <IntakeFileControls actions={surface.actions} configured={surface.configured} />
    <IntakeBusyBadge activeBatches={surface.state.activeBatches} />
    <IntakeResultsPanel results={surface.state.results} onClear={surface.actions.clearResults} />
  </div>
);

/**
 * Full-screen boundary that routes DOM drag-and-drop events into
 * runtime-owned document intake actions.
 *
 * **Details**
 *
 * The boundary never withholds its children: when no workspace vault is
 * configured the intake affordances (file picker, drop overlay) stay inert,
 * while vault onboarding itself is scoped to the vault surfaces through
 * {@link VaultOnboardingGate}.
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
  const surface = useAtomValue(documentIntakeSurfaceAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

  return <IntakeWorkspaceSurface surface={surface}>{children}</IntakeWorkspaceSurface>;
}

/**
 * Vault-scoped onboarding gate: renders the choose-vault card until a
 * workspace vault is configured, then renders its children.
 *
 * **Details**
 *
 * Wrap only the surfaces that genuinely need a vault (vault sync, intake
 * management). Chat, Home, and the ontology regions must stay reachable on a
 * fresh profile, so the whole-shell {@link DocumentIntakeTarget} boundary no
 * longer hosts this gate. The card reuses the full vault-selection state
 * machine, including the manual-path fallback for sessions without a native
 * folder picker.
 *
 * **Example** (Create React Element)
 *
 * ```ts
 * import { VaultOnboardingGate } from "@/intake/DocumentIntakeTarget"
 * import { createElement } from "react"
 *
 * const element = createElement(VaultOnboardingGate, { children: null })
 * console.log(element.type)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function VaultOnboardingGate({ children }: { readonly children: ReactNode }): JSX.Element {
  const surface = useAtomValue(documentIntakeSurfaceAtoms(DEFAULT_PROFESSIONAL_WORKSPACE_ID));

  if (surface.needsOnboarding) {
    return <VaultOnboarding actions={surface.actions} selection={surface.state.vaultSelection} />;
  }

  return <>{children}</>;
}
