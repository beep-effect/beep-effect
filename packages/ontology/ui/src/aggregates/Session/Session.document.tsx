/**
 * Ontology workbench Document region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  OpenOntologyDocumentInput,
  ontologyDirtyAtom,
  ontologyDocumentErrorAtom,
  ontologyFoldLevelAtom,
  ontologyInferredViewAtom,
  ontologyPathAtom,
  ontologyRedoStackAtom,
  ontologySessionAtom,
  ontologyViewModeAtom,
  openOntologyDocumentAtom,
  openPathInputAtom,
  previewOntologyTurtleAtom,
  redoOntologyChangeAtom,
  SaveOntologyDocumentInput,
  saveOntologyDocumentAtom,
  toggleOntologyInferredViewAtom,
  undoOntologyChangeAtom,
} from "@beep/ontology-client/aggregates/Session";
import { SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath, OntologyFoldLevel, OntologyViewMode } from "@beep/ontology-use-cases/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { Switch } from "@beep/ui/components/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@beep/ui/components/tooltip";
import { O, Str } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { pipe } from "effect";
import * as S from "effect/Schema";
import { AsyncResult } from "effect/unstable/reactivity";
import { valueFromEvent } from "./Session.workbench.shared.ts";
import type { JSX } from "react";

const decodePath = (value: string): O.Option<OntologyFilePath> => OntologyFilePath.decodeOption(Str.trim(value));

/**
 * Pure busy/disabled presentation state for the Document toolbar's async
 * actions, derived from the in-flight flags of the open/save/preview atoms
 * and whether a session is open.
 *
 * @example
 * ```ts
 * import { documentToolbarState } from "@beep/ontology-ui/aggregates/Session"
 *
 * const state = documentToolbarState({ opening: false, saving: false, previewing: false, sessionOpen: false })
 * console.log(state.saveDisabled) // true
 * ```
 *
 * @category presentation
 * @since 0.0.0
 */
export const documentToolbarState = (input: {
  readonly opening: boolean;
  readonly saving: boolean;
  readonly previewing: boolean;
  readonly sessionOpen: boolean;
}) => ({
  openBusy: input.opening,
  openLabel: input.opening ? "Opening…" : "Open",
  openDisabled: input.opening,
  saveBusy: input.saving,
  saveLabel: input.saving ? "Saving…" : "Save",
  saveDisabled: !input.sessionOpen || input.saving,
  previewBusy: input.previewing,
  previewLabel: input.previewing ? "Previewing…" : "Preview",
  previewDisabled: !input.sessionOpen || input.previewing,
  sessionHint: input.sessionOpen ? undefined : "Open a document first",
});

const sessionIdFromPath = (path: OntologyFilePath): SessionId => SessionId.fromUnknown(`ontology:${path}`);

const isOntologyViewMode = S.is(OntologyViewMode);
const isOntologyFoldLevel = S.is(OntologyFoldLevel);

/**
 * Document actions, view controls, dirty state, and document errors.
 *
 * @example
 * ```tsx
 * import { OntologyDocumentRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyDocumentRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
// The zero-behavior extraction keeps the toolbar's established event wiring
// together so document actions and their error surface remain one region.
// fallow-ignore-next-line complexity
export function OntologyDocumentRegion(): JSX.Element {
  const pathInput = useAtomValue(openPathInputAtom);
  const documentError = useAtomValue(ontologyDocumentErrorAtom);
  const dirty = useAtomValue(ontologyDirtyAtom);
  const path = useAtomValue(ontologyPathAtom);
  const session = useAtomValue(ontologySessionAtom);
  const mode = useAtomValue(ontologyViewModeAtom);
  const foldLevel = useAtomValue(ontologyFoldLevelAtom);
  const inferredView = useAtomValue(ontologyInferredViewAtom);
  const redoStack = useAtomValue(ontologyRedoStackAtom);
  const setPathInput = useAtomSet(openPathInputAtom);
  const setDocumentError = useAtomSet(ontologyDocumentErrorAtom);
  const setMode = useAtomSet(ontologyViewModeAtom);
  const setFoldLevel = useAtomSet(ontologyFoldLevelAtom);
  const toggleInferredView = useAtomSet(toggleOntologyInferredViewAtom);
  const openDocument = useAtomSet(openOntologyDocumentAtom);
  const saveDocument = useAtomSet(saveOntologyDocumentAtom);
  const previewTurtle = useAtomSet(previewOntologyTurtleAtom);
  const undoChange = useAtomSet(undoOntologyChangeAtom);
  const redoChange = useAtomSet(redoOntologyChangeAtom);
  const canUndo = O.match(session, { onNone: () => false, onSome: (openSession) => openSession.changeLog.length > 0 });
  const canRedo = redoStack.length > 0;
  // The action atoms are AsyncResult fns: while an RPC is in flight the
  // triggering button must say so and refuse re-entry, otherwise a slow open
  // or save reads as "the button does nothing".
  const toolbar = documentToolbarState({
    opening: AsyncResult.isWaiting(useAtomValue(openOntologyDocumentAtom)),
    saving: AsyncResult.isWaiting(useAtomValue(saveOntologyDocumentAtom)),
    previewing: AsyncResult.isWaiting(useAtomValue(previewOntologyTurtleAtom)),
    sessionOpen: O.isSome(session),
  });

  const runOpen = (): void => {
    pipe(
      decodePath(pathInput),
      O.match({
        onNone: () =>
          setDocumentError(
            O.some(
              "Enter a workspace-relative, lower-case .ttl path with no leading slash and no '..' segments — for example tmp/ontology-workbench/pizza-tutorial.ttl."
            )
          ),
        onSome: (decodedPath) =>
          openDocument(
            OpenOntologyDocumentInput.make({
              sessionId: sessionIdFromPath(decodedPath),
              path: decodedPath,
            })
          ),
      })
    );
  };

  const runSave = (): void => {
    pipe(
      path,
      O.orElse(() => decodePath(pathInput)),
      O.match({
        onNone: () => undefined,
        onSome: (decodedPath) => saveDocument(SaveOntologyDocumentInput.make({ path: decodedPath })),
      })
    );
  };

  return (
    <>
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b px-3 py-2">
        <Input
          aria-label="Ontology file path"
          className="h-8 min-w-[180px] max-w-[460px] flex-1 font-mono text-xs"
          value={pathInput}
          onChange={(event) => setPathInput(valueFromEvent(event))}
        />
        <Button size="sm" type="button" aria-busy={toolbar.openBusy} disabled={toolbar.openDisabled} onClick={runOpen}>
          {toolbar.openLabel}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          aria-busy={toolbar.saveBusy}
          disabled={toolbar.saveDisabled}
          title={toolbar.sessionHint}
          onClick={runSave}
        >
          {toolbar.saveLabel}
        </Button>
        <Button
          size="sm"
          type="button"
          variant="outline"
          aria-busy={toolbar.previewBusy}
          disabled={toolbar.previewDisabled}
          title={toolbar.sessionHint}
          onClick={() => previewTurtle(undefined)}
        >
          {toolbar.previewLabel}
        </Button>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Undo ontology change"
                size="icon-sm"
                type="button"
                variant="ghost"
                disabled={!canUndo}
                onClick={() => undoChange(undefined)}
              >
                U
              </Button>
            }
          />
          <TooltipContent>Undo</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                aria-label="Redo ontology change"
                size="icon-sm"
                type="button"
                variant="ghost"
                disabled={!canRedo}
                onClick={() => redoChange(undefined)}
              >
                R
              </Button>
            }
          />
          <TooltipContent>Redo</TooltipContent>
        </Tooltip>
        <NativeSelect
          aria-label="Ontology view mode"
          size="sm"
          value={mode}
          onChange={(event) => {
            const value = valueFromEvent(event);
            if (isOntologyViewMode(value)) setMode(value);
          }}
        >
          <NativeSelectOption value="all">All</NativeSelectOption>
          <NativeSelectOption value="tbox">TBox</NativeSelectOption>
          <NativeSelectOption value="abox">ABox</NativeSelectOption>
        </NativeSelect>
        <NativeSelect
          aria-label="Graph fold level"
          size="sm"
          value={foldLevel}
          onChange={(event) => {
            const value = valueFromEvent(event);
            if (isOntologyFoldLevel(value)) setFoldLevel(value);
          }}
        >
          <NativeSelectOption value="L0">L0</NativeSelectOption>
          <NativeSelectOption value="L1">L1</NativeSelectOption>
          <NativeSelectOption value="L2">L2</NativeSelectOption>
          <NativeSelectOption value="L3">L3</NativeSelectOption>
        </NativeSelect>
        <div className="flex items-center gap-2 rounded-md border px-2 py-1">
          <Switch
            aria-label="Toggle inferred view"
            size="sm"
            checked={inferredView}
            disabled={O.isNone(session)}
            onCheckedChange={(checked) => toggleInferredView(checked)}
          />
          <span className="text-xs">Inferred</span>
        </div>
        <Badge variant={dirty ? "destructive" : "secondary"}>{dirty ? "Dirty" : "Saved"}</Badge>
      </div>
      {O.isSome(documentError) ? (
        <div
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 shrink-0 border-b px-3 py-2 text-xs"
        >
          {documentError.value}
        </div>
      ) : null}
    </>
  );
}
