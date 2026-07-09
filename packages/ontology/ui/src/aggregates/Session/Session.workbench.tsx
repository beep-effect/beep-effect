/**
 * Ontology workbench explorer and editor screen.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EditorViewer } from "@beep/editor";
import { SerializedEditorState } from "@beep/lexical-schema";
import {
  ApplyOntologyBatchInput,
  applyOntologyBatchAtom,
  OpenOntologyDocumentInput,
  ontologyDirtyAtom,
  ontologyPathAtom,
  ontologyRedoStackAtom,
  ontologySearchQueryAtom,
  ontologySearchResultsAtom,
  ontologySessionAtom,
  ontologySnapshotAtom,
  ontologySourceAtom,
  ontologyViewModeAtom,
  openOntologyDocumentAtom,
  previewOntologyTurtleAtom,
  redoOntologyChangeAtom,
  SaveOntologyDocumentInput,
  saveOntologyDocumentAtom,
  selectedOntologyResourceAtom,
  selectedOntologyResourceIriAtom,
  undoOntologyChangeAtom,
  visibleOntologyResourcesAtom,
} from "@beep/ontology-client/aggregates/Session";
import { ChangeOperation, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath, resourceVisibleInViewMode } from "@beep/ontology-use-cases/aggregates/Session";
import { makeLiteral, makeNamedNode, makeQuad, serializeTerm } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { Textarea } from "@beep/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@beep/ui/components/tooltip";
import { A, O, Str } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { MutableHashMap, MutableHashSet, pipe } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import type {
  OntologyResourceSummary,
  OntologySnapshot,
  OntologyViewMode,
} from "@beep/ontology-use-cases/aggregates/Session";
import type { ChangeEvent, JSX } from "react";

const openPathInputAtom = Atom.make("tmp/ontology-workbench/pizza-tutorial.ttl");
const subjectInputAtom = Atom.make("https://example.org/pizza#Pizza");
const predicateInputAtom = Atom.make("http://www.w3.org/2000/01/rdf-schema#label");
const objectInputAtom = Atom.make("Pizza");
const objectKindAtom = Atom.make<"iri" | "literal">("literal");

const emptyStrings: () => ReadonlyArray<string> = A.empty;

type TreeItem = {
  readonly id: string;
  readonly label: string;
  readonly children?: ReadonlyArray<TreeItem>;
};

const sourceViewerState = S.decodeUnknownSync(SerializedEditorState)({
  root: {
    type: "root",
    version: 1,
    direction: null,
    format: "",
    indent: 0,
    children: [
      {
        type: "paragraph",
        version: 1,
        direction: null,
        format: "",
        indent: 0,
        children: [
          { type: "text", version: 1, detail: 0, format: 0, mode: "normal", style: "", text: "Turtle source" },
        ],
      },
    ],
  },
});

const decodePath = (value: string): O.Option<OntologyFilePath> => OntologyFilePath.decodeOption(Str.trim(value));

const sessionIdFromPath = (path: OntologyFilePath): SessionId => SessionId.fromUnknown(`ontology:${path}`);

const valueFromEvent = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): string =>
  event.target.value;

const treeItemsFor = (snapshot: OntologySnapshot, mode: OntologyViewMode): ReadonlyArray<TreeItem> => {
  const visible = A.filter(snapshot.resources, (resource) => resourceVisibleInViewMode(resource, mode));
  const visibleIds = MutableHashSet.fromIterable(A.map(visible, (resource) => resource.iri));
  const resourcesByIri = MutableHashMap.fromIterable(A.map(visible, (resource) => [resource.iri, resource] as const));
  const childrenByIri = MutableHashMap.fromIterable(
    A.map(snapshot.hierarchy, (entry) => [entry.iri, entry.childIris] as const)
  );

  const toItem = (resource: OntologyResourceSummary): TreeItem => {
    const children = pipe(
      MutableHashMap.get(childrenByIri, resource.iri),
      O.getOrElse(emptyStrings),
      A.filter((childIri) => MutableHashSet.has(visibleIds, childIri))
    );
    const childItems = A.flatMap(children, (childIri) =>
      pipe(MutableHashMap.get(resourcesByIri, childIri), O.map(toItem), O.toArray)
    );
    return childItems.length === 0
      ? { id: resource.iri, label: resource.label }
      : { id: resource.iri, label: resource.label, children: childItems };
  };

  return pipe(
    visible,
    A.filter((resource) => !A.some(resource.parentIris, (parentIri) => MutableHashSet.has(visibleIds, parentIri))),
    A.map(toItem)
  );
};

const statItems = (snapshot: OntologySnapshot) =>
  [
    ["Quads", snapshot.metrics.quadCount],
    ["Resources", snapshot.metrics.resourceCount],
    ["Classes", snapshot.metrics.classCount],
    ["Properties", snapshot.metrics.propertyCount],
    ["Individuals", snapshot.metrics.individualCount],
    ["TBox", snapshot.metrics.tboxCount],
    ["ABox", snapshot.metrics.aboxCount],
  ] as const;

const resourceBadgeVariant = (resource: OntologyResourceSummary): "default" | "secondary" =>
  resource.classification === "tbox" ? "default" : "secondary";

const changeTargetLabel = (change: ChangeOperation): string =>
  ChangeOperation.match(change, {
    addQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
    removeQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
  });

/**
 * Ontology explorer/editor workbench screen.
 *
 * @example
 * ```tsx
 * import { OntologyWorkbench } from "@beep/ontology-ui/aggregates/Session"
 *
 * console.log(OntologyWorkbench)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyWorkbench(): JSX.Element {
  const pathInput = useAtomValue(openPathInputAtom);
  const snapshot = useAtomValue(ontologySnapshotAtom);
  const source = useAtomValue(ontologySourceAtom);
  const dirty = useAtomValue(ontologyDirtyAtom);
  const path = useAtomValue(ontologyPathAtom);
  const session = useAtomValue(ontologySessionAtom);
  const mode = useAtomValue(ontologyViewModeAtom);
  const searchQuery = useAtomValue(ontologySearchQueryAtom);
  const searchResults = useAtomValue(ontologySearchResultsAtom);
  const selected = useAtomValue(selectedOntologyResourceAtom);
  const selectedIri = useAtomValue(selectedOntologyResourceIriAtom);
  const visibleResources = useAtomValue(visibleOntologyResourcesAtom);
  const redoStack = useAtomValue(ontologyRedoStackAtom);
  const subject = useAtomValue(subjectInputAtom);
  const predicate = useAtomValue(predicateInputAtom);
  const object = useAtomValue(objectInputAtom);
  const objectKind = useAtomValue(objectKindAtom);
  const setPathInput = useAtomSet(openPathInputAtom);
  const setMode = useAtomSet(ontologyViewModeAtom);
  const setSearchQuery = useAtomSet(ontologySearchQueryAtom);
  const setSelectedIri = useAtomSet(selectedOntologyResourceIriAtom);
  const setSubject = useAtomSet(subjectInputAtom);
  const setPredicate = useAtomSet(predicateInputAtom);
  const setObject = useAtomSet(objectInputAtom);
  const setObjectKind = useAtomSet(objectKindAtom);
  const openDocument = useAtomSet(openOntologyDocumentAtom);
  const saveDocument = useAtomSet(saveOntologyDocumentAtom);
  const previewTurtle = useAtomSet(previewOntologyTurtleAtom);
  const applyBatch = useAtomSet(applyOntologyBatchAtom);
  const undoChange = useAtomSet(undoOntologyChangeAtom);
  const redoChange = useAtomSet(redoOntologyChangeAtom);
  const treeItems = treeItemsFor(snapshot, mode);
  const canApplyTriple =
    Str.isNonEmpty(Str.trim(subject)) && Str.isNonEmpty(Str.trim(predicate)) && Str.isNonEmpty(Str.trim(object));
  const canUndo = O.match(session, { onNone: () => false, onSome: (openSession) => openSession.changeLog.length > 0 });
  const canRedo = redoStack.length > 0;
  const changeLog = O.match(session, {
    onNone: A.empty<ChangeOperation>,
    onSome: (openSession) => openSession.changeLog,
  });
  const undoPosition = changeLog.length;
  const totalChangeCount = undoPosition + redoStack.length;

  const runOpen = (): void => {
    pipe(
      decodePath(pathInput),
      O.match({
        onNone: () => undefined,
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

  const runAddTriple = (): void => {
    if (!canApplyTriple) return;
    const quad = makeQuad(
      makeNamedNode(Str.trim(subject)),
      makeNamedNode(Str.trim(predicate)),
      objectKind === "iri" ? makeNamedNode(Str.trim(object)) : makeLiteral(Str.trim(object), XSD_STRING.value)
    );
    applyBatch(
      ApplyOntologyBatchInput.make({
        operations: [
          ChangeOperation.make({
            kind: "addQuad",
            partition: "asserted",
            quad,
          }),
        ],
      })
    );
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen min-h-0 w-full flex-col bg-background text-foreground">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b px-3">
          <Input
            aria-label="Ontology file path"
            className="h-8 max-w-[460px] flex-1 font-mono text-xs"
            value={pathInput}
            onChange={(event) => setPathInput(valueFromEvent(event))}
          />
          <Button size="sm" type="button" onClick={runOpen}>
            Open
          </Button>
          <Button size="sm" type="button" variant="outline" disabled={O.isNone(session)} onClick={runSave}>
            Save
          </Button>
          <Button
            size="sm"
            type="button"
            variant="outline"
            disabled={O.isNone(session)}
            onClick={() => previewTurtle(undefined)}
          >
            Preview
          </Button>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
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
            onChange={(event) => setMode(valueFromEvent(event) as OntologyViewMode)}
          >
            <NativeSelectOption value="all">All</NativeSelectOption>
            <NativeSelectOption value="tbox">TBox</NativeSelectOption>
            <NativeSelectOption value="abox">ABox</NativeSelectOption>
          </NativeSelect>
          <Badge variant={dirty ? "destructive" : "secondary"}>{dirty ? "Dirty" : "Saved"}</Badge>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[300px_minmax(360px,1fr)_340px]">
          <aside className="flex min-h-0 flex-col border-r">
            <div className="border-b p-3">
              <Input
                aria-label="Search ontology resources"
                placeholder="Search resources"
                value={searchQuery}
                onChange={(event) => setSearchQuery(valueFromEvent(event))}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{visibleResources.length} visible</span>
                <span>{searchResults.length} matches</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              <RichTreeView
                items={treeItems}
                selectedItems={O.getOrNull(selectedIri)}
                onSelectedItemsChange={(_, itemId) => setSelectedIri(O.fromNullishOr(itemId))}
              />
            </div>
          </aside>

          <main className="flex min-h-0 flex-col">
            <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
              <div className="flex items-center gap-2">
                <EditorViewer state={sourceViewerState} className="text-sm font-medium" />
                <Badge variant="outline">Turtle</Badge>
              </div>
              <span className="max-w-[45ch] truncate font-mono text-xs text-muted-foreground">
                {O.getOrElse(path, () => "No file open")}
              </span>
            </div>
            <Textarea
              aria-label="Turtle source"
              className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs leading-5 shadow-none focus-visible:ring-0"
              readOnly
              value={source}
            />
          </main>

          <aside className="flex min-h-0 flex-col border-l">
            <section className="border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Inspector</h2>
                {O.match(selected, {
                  onNone: () => <Badge variant="outline">None</Badge>,
                  onSome: (resource) => (
                    <Badge variant={resourceBadgeVariant(resource)}>{resource.classification}</Badge>
                  ),
                })}
              </div>
              {O.match(selected, {
                onNone: () => <p className="text-sm text-muted-foreground">No resource selected.</p>,
                onSome: (resource) => (
                  <div className="space-y-2 text-sm">
                    <div className="font-medium">{resource.label}</div>
                    <div className="break-all font-mono text-xs text-muted-foreground">{resource.iri}</div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant="secondary">{resource.kind}</Badge>
                      {A.map(resource.sourcePartitions, (partition) => (
                        <Badge key={partition} variant="outline">
                          {partition}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ),
              })}
            </section>

            <section className="border-b p-3">
              <h2 className="mb-2 text-sm font-semibold">Add Triple</h2>
              <div className="space-y-2">
                <Input
                  aria-label="Subject IRI"
                  value={subject}
                  onChange={(event) => setSubject(valueFromEvent(event))}
                />
                <Input
                  aria-label="Predicate IRI"
                  value={predicate}
                  onChange={(event) => setPredicate(valueFromEvent(event))}
                />
                <div className="flex gap-2">
                  <NativeSelect
                    aria-label="Object type"
                    className="w-28 shrink-0"
                    value={objectKind}
                    onChange={(event) => setObjectKind(valueFromEvent(event) as "iri" | "literal")}
                  >
                    <NativeSelectOption value="literal">Literal</NativeSelectOption>
                    <NativeSelectOption value="iri">IRI</NativeSelectOption>
                  </NativeSelect>
                  <Input
                    aria-label="Object value"
                    value={object}
                    onChange={(event) => setObject(valueFromEvent(event))}
                  />
                </div>
                <Button
                  className="w-full"
                  size="sm"
                  type="button"
                  disabled={O.isNone(session) || !canApplyTriple}
                  onClick={runAddTriple}
                >
                  Apply
                </Button>
              </div>
            </section>

            <section className="border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Change Log</h2>
                <Badge variant="outline">
                  {undoPosition}/{totalChangeCount}
                </Badge>
              </div>
              <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{changeLog.length} applied</span>
                <span>{redoStack.length} redo</span>
              </div>
              <div className="max-h-48 space-y-2 overflow-auto pr-1">
                {changeLog.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No applied changes.</p>
                ) : (
                  A.map(changeLog, (change, index) => (
                    <div key={`${index}-${change.kind}`} className="rounded-md border p-2 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{change.kind}</span>
                        <span className="font-mono text-muted-foreground">#{index + 1}</span>
                      </div>
                      <div className="mt-1 break-all font-mono text-muted-foreground">{changeTargetLabel(change)}</div>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="min-h-0 flex-1 overflow-auto p-3">
              <h2 className="mb-2 text-sm font-semibold">Worker Metrics</h2>
              <div className="grid grid-cols-2 gap-2">
                {A.map(statItems(snapshot), ([label, value]) => (
                  <div key={label} className="rounded-md border p-2">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="text-lg font-semibold tabular-nums">{value}</div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
