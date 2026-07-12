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
  ApplyOntologyGraphGestureInput,
  applyOntologyBatchAtom,
  applyOntologyGraphGestureAtom,
  applyOntologyRepairAtom,
  applyOntologySparqlExampleAtom,
  exportOntologyProvenanceAtom,
  OpenOntologyDocumentInput,
  ontologyDirtyAtom,
  ontologyDocumentErrorAtom,
  ontologyFoldLevelAtom,
  ontologyGraphBackendAtom,
  ontologyGraphContainerAtom,
  ontologyGraphErrorAtom,
  ontologyGraphProjectionAtom,
  ontologyGraphRenderBridgeAtom,
  ontologyGraphWorkerBridgeAtom,
  ontologyInferenceErrorAtom,
  ontologyInferenceResultAtom,
  ontologyInferredViewAtom,
  ontologyPathAtom,
  ontologyPredicateSuggestionsAtom,
  ontologyProvenanceExportAtom,
  ontologyRedoStackAtom,
  ontologySearchQueryAtom,
  ontologySearchResultsAtom,
  ontologySessionAtom,
  ontologySnapshotAtom,
  ontologySourceAtom,
  ontologySparqlErrorAtom,
  ontologySparqlExamplesAtom,
  ontologySparqlProfileAtom,
  ontologySparqlQueryAtom,
  ontologySparqlResultAtom,
  ontologyValidationErrorAtom,
  ontologyValidationResultAtom,
  ontologyValidationStatusAtom,
  ontologyViewModeAtom,
  openOntologyDocumentAtom,
  previewOntologyTurtleAtom,
  redoOntologyChangeAtom,
  runOntologySparqlAtom,
  runOntologyValidationAtom,
  SaveOntologyDocumentInput,
  saveOntologyDocumentAtom,
  selectedOntologyResourceAtom,
  selectedOntologyResourceIriAtom,
  toggleOntologyInferredViewAtom,
  undoOntologyChangeAtom,
  visibleOntologyResourcesAtom,
} from "@beep/ontology-client/aggregates/Session";
import { ChangeOperation, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { OntologyFilePath, OntologyGraphGesture } from "@beep/ontology-use-cases/aggregates/Session";
import { IRI } from "@beep/rdf/Iri";
import { makeLiteral, makeNamedNode, makeQuad, serializeQuad, serializeTerm } from "@beep/rdf/Rdf";
import { XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { Input } from "@beep/ui/components/input";
import { NativeSelect, NativeSelectOption } from "@beep/ui/components/native-select";
import { Switch } from "@beep/ui/components/switch";
import { Textarea } from "@beep/ui/components/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@beep/ui/components/tooltip";
import { A, O, R, Str } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { RichTreeView } from "@mui/x-tree-view/RichTreeView";
import { flow, pipe } from "effect";
import * as S from "effect/Schema";
import { Atom } from "effect/unstable/reactivity";
import { useCallback } from "react";
import { ontologyTreeItemsFor } from "./Session.tree.js";
import type { OntologyValidationStatus } from "@beep/ontology-client/aggregates/Session";
import type {
  OntologyFoldLevel,
  OntologyInferenceResult,
  OntologyRepairProposal,
  OntologyResourceSummary,
  OntologySnapshot,
  OntologySparqlPanelProfile,
  OntologyViewMode,
  RunOntologySparqlResult,
  RunOntologyValidationResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import type { ChangeEvent, JSX, KeyboardEvent } from "react";

const openPathInputAtom = Atom.make("tmp/ontology-workbench/pizza-tutorial.ttl");
const subjectInputAtom = Atom.make("https://example.org/pizza#Pizza");
const predicateInputAtom = Atom.make("http://www.w3.org/2000/01/rdf-schema#label");
const objectInputAtom = Atom.make("Pizza");
const objectKindAtom = Atom.make<"iri" | "literal">("literal");

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

// Subjects, predicates, and IRI objects must be IRIs. The form used to accept
// any non-empty string, so `not an iri` sailed through into the change log and
// only surfaced later as a broken serialization.
//
// `IRI`, not `AbsoluteIRI`: the latter is RFC 3987 absolute-IRI *without a
// fragment*, which rejects the hash IRIs RDF vocabularies are built from
// (`https://example.org/pizza#Pizza`, `…/rdf-schema#label`).
const isIri = S.is(IRI);

/**
 * Whether an Add Triple IRI field holds a usable IRI.
 *
 * @example
 * ```ts
 * import { iriFieldValid } from "@beep/ontology-ui/aggregates/Session"
 *
 * console.log(iriFieldValid("https://example.org/pizza#Pizza")) // true
 * console.log(iriFieldValid("not an iri")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const iriFieldValid = (value: string): boolean => isIri(Str.trim(value));

const sessionIdFromPath = (path: OntologyFilePath): SessionId => SessionId.fromUnknown(`ontology:${path}`);

const valueFromEvent = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): string =>
  event.target.value;

const validationViolationCount = flow(
  O.map((current: RunOntologyValidationResult) => current.validation.violations.length),
  O.getOrElse(() => 0)
);

const statItems = (snapshot: OntologySnapshot, validationResult: O.Option<RunOntologyValidationResult>) =>
  [
    ["Quads", snapshot.metrics.quadCount],
    ["Resources", snapshot.metrics.resourceCount],
    ["Classes", snapshot.metrics.classCount],
    ["Properties", snapshot.metrics.propertyCount],
    ["Individuals", snapshot.metrics.individualCount],
    ["TBox", snapshot.metrics.tboxCount],
    ["ABox", snapshot.metrics.aboxCount],
    ["Disjoint", snapshot.metrics.disjointnessViolationCount],
    ["SHACL", validationViolationCount(validationResult)],
  ] as const;

const resourceBadgeVariant = (resource: OntologyResourceSummary): "default" | "secondary" =>
  resource.classification === "tbox" ? "default" : "secondary";

const changeTargetLabel = (change: ChangeOperation): string =>
  ChangeOperation.match(change, {
    addQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
    removeQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
  });

const sparqlResultPreview = (result: RunOntologySparqlResult): JSX.Element => {
  if (result.result.profile === "select") {
    return (
      <div className="space-y-2">
        {result.result.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No rows.</p>
        ) : (
          A.map(A.take(result.result.rows, 8), (row, index) => (
            <div key={index} className="rounded-md border p-2 font-mono text-[11px]">
              {A.map(R.toEntries(row), ([name, term]) => (
                <div key={name} className="grid grid-cols-[70px_minmax(0,1fr)] gap-2">
                  <span className="text-muted-foreground">?{name}</span>
                  <span className="break-all">{serializeTerm(term)}</span>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    );
  }

  if (result.result.profile === "construct") {
    return (
      <div className="space-y-2">
        {result.result.dataset.quads.length === 0 ? (
          <p className="text-sm text-muted-foreground">No quads.</p>
        ) : (
          A.map(A.take(result.result.dataset.quads, 8), (quad, index) => (
            <div key={`${index}-${serializeQuad(quad)}`} className="rounded-md border p-2 font-mono text-[11px]">
              {serializeQuad(quad)}
            </div>
          ))
        )}
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Unsupported result.</p>;
};

const noSparqlResult = (): JSX.Element => <p className="text-sm text-muted-foreground">No query result.</p>;

const sparqlErrorView = (error: string): JSX.Element => <p className="text-sm text-destructive">{error}</p>;

const sparqlResultView = (result: RunOntologySparqlResult): JSX.Element => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1">
      <Badge variant="outline">LIMIT {result.effectiveLimit}</Badge>
      {result.limitInjected ? <Badge variant="secondary">injected</Badge> : null}
      {result.truncated ? <Badge variant="destructive">truncated</Badge> : null}
    </div>
    {sparqlResultPreview(result)}
  </div>
);

const sparqlResultPanel = (error: O.Option<string>, result: O.Option<RunOntologySparqlResult>): JSX.Element =>
  pipe(
    error,
    O.map(sparqlErrorView),
    O.getOrElse(() => pipe(result, O.map(sparqlResultView), O.getOrElse(noSparqlResult)))
  );

const noInferenceResult = (): JSX.Element => <p className="text-muted-foreground">No inferred graph.</p>;

const inferenceErrorView = (error: string): JSX.Element => <p className="text-destructive">{error}</p>;

const inferenceResultView = (result: OntologyInferenceResult): JSX.Element => (
  <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono">
    <span>quads {result.inferredDataset.quads.length}</span>
    <span>drift {result.drifted ? "full" : "ok"}</span>
    <span>changes {result.processedChangeCount}</span>
    <span>violations {result.disjointnessViolations.length}</span>
  </div>
);

const inferenceResultPanel = (error: O.Option<string>, result: O.Option<OntologyInferenceResult>): JSX.Element =>
  pipe(
    error,
    O.map(inferenceErrorView),
    O.getOrElse(() => pipe(result, O.map(inferenceResultView), O.getOrElse(noInferenceResult)))
  );

const severityVariant = (severity: string): "default" | "secondary" | "destructive" | "outline" =>
  severity === "violation" ? "destructive" : severity === "warning" ? "default" : "secondary";

const repairsForViolation = (
  result: RunOntologyValidationResult,
  violationIndex: number
): ReadonlyArray<OntologyRepairProposal> =>
  pipe(
    result.repairs,
    A.filter((proposal) => proposal.violationIndex === violationIndex)
  );

const noValidationResult = (): JSX.Element => <p className="text-sm text-muted-foreground">No validation run.</p>;

const validationMessageView = (status: OntologyValidationStatus, message: string): JSX.Element => (
  <p className={status === "blocked" ? "text-sm text-muted-foreground" : "text-sm text-destructive"}>{message}</p>
);

const validationRunningView = (): JSX.Element => <p className="text-sm text-muted-foreground">Validation running.</p>;

const validationResultView = (
  result: RunOntologyValidationResult,
  selectFocus: (iri: string) => void,
  applyRepair: (proposal: OntologyRepairProposal) => void
): JSX.Element => (
  <div className="space-y-2">
    <div className="flex flex-wrap gap-1">
      <Badge variant={result.validation.conforms ? "secondary" : "destructive"}>
        {result.validation.conforms ? "conforms" : "violations"}
      </Badge>
      <Badge variant="outline">{result.shapeCount} shapes</Badge>
      <Badge variant="outline">{result.dataQuadCount} data quads</Badge>
      {result.validation.truncated ? <Badge variant="destructive">truncated</Badge> : null}
    </div>
    {result.validation.violations.length === 0 ? (
      <p className="text-sm text-muted-foreground">No violations.</p>
    ) : (
      <div className="max-h-56 space-y-2 overflow-auto pr-1">
        {A.map(result.validation.violations, (violation, index) => {
          const repairs = repairsForViolation(result, index);
          return (
            <div
              key={`${index}-${violation.focusNode}-${violation.path.value}`}
              className="rounded-md border p-2 text-xs"
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <Badge variant={severityVariant(violation.severity)}>{violation.severity}</Badge>
                <Button size="sm" type="button" variant="ghost" onClick={() => selectFocus(violation.focusNode)}>
                  Focus
                </Button>
              </div>
              <div className="break-all font-mono text-muted-foreground">{violation.focusNode}</div>
              <div className="mt-1 break-all font-mono">{violation.path.value}</div>
              <p className="mt-1 text-muted-foreground">{violation.message}</p>
              {repairs.length === 0 ? (
                <p className="mt-2 text-muted-foreground">No verified repair.</p>
              ) : (
                <div className="mt-2 space-y-1">
                  {A.map(repairs, (proposal) => (
                    <Button
                      key={proposal.id}
                      className="w-full justify-start"
                      size="sm"
                      type="button"
                      variant="outline"
                      onClick={() => applyRepair(proposal)}
                    >
                      Apply verified repair
                    </Button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    )}
  </div>
);

const validationPanel = (
  status: OntologyValidationStatus,
  error: O.Option<string>,
  result: O.Option<RunOntologyValidationResult>,
  selectFocus: (iri: string) => void,
  applyRepair: (proposal: OntologyRepairProposal) => void
): JSX.Element =>
  status === "running"
    ? validationRunningView()
    : pipe(
        error,
        O.map((message) => validationMessageView(status, message)),
        O.getOrElse(() =>
          pipe(
            result,
            O.map((current) => validationResultView(current, selectFocus, applyRepair)),
            O.getOrElse(noValidationResult)
          )
        )
      );

const validationStatusBadge = (
  status: OntologyValidationStatus,
  result: O.Option<RunOntologyValidationResult>
): JSX.Element => {
  if (status === "running") {
    return <Badge variant="outline">running</Badge>;
  }

  if (status === "blocked") {
    return <Badge variant="outline">blocked</Badge>;
  }

  if (status === "failed") {
    return <Badge variant="destructive">failed</Badge>;
  }

  return O.match(result, {
    onNone: () => <Badge variant="outline">not run</Badge>,
    onSome: (current) => (
      <Badge variant={current.validation.conforms ? "secondary" : "destructive"}>
        {current.validation.violations.length}
      </Badge>
    ),
  });
};

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
// This is pre-existing workbench decomposition debt: the QA patch only adds
// validation and error presentation to the established atom-backed assembly.
// Splitting the full surface is a separate behavior-sensitive UI refactor.
// fallow-ignore-next-line complexity
export function OntologyWorkbench(): JSX.Element {
  const pathInput = useAtomValue(openPathInputAtom);
  const snapshot = useAtomValue(ontologySnapshotAtom);
  const source = useAtomValue(ontologySourceAtom);
  const graphProjection = useAtomValue(ontologyGraphProjectionAtom);
  const graphBackend = useAtomValue(ontologyGraphBackendAtom);
  const graphError = useAtomValue(ontologyGraphErrorAtom);
  const documentError = useAtomValue(ontologyDocumentErrorAtom);
  const setDocumentError = useAtomSet(ontologyDocumentErrorAtom);
  const dirty = useAtomValue(ontologyDirtyAtom);
  const path = useAtomValue(ontologyPathAtom);
  const session = useAtomValue(ontologySessionAtom);
  const mode = useAtomValue(ontologyViewModeAtom);
  const foldLevel = useAtomValue(ontologyFoldLevelAtom);
  const inferredView = useAtomValue(ontologyInferredViewAtom);
  const inferenceResult = useAtomValue(ontologyInferenceResultAtom);
  const inferenceError = useAtomValue(ontologyInferenceErrorAtom);
  const searchQuery = useAtomValue(ontologySearchQueryAtom);
  const searchResults = useAtomValue(ontologySearchResultsAtom);
  const predicateSuggestions = useAtomValue(ontologyPredicateSuggestionsAtom);
  const sparqlProfile = useAtomValue(ontologySparqlProfileAtom);
  const sparqlQuery = useAtomValue(ontologySparqlQueryAtom);
  const sparqlExamples = useAtomValue(ontologySparqlExamplesAtom);
  const sparqlResult = useAtomValue(ontologySparqlResultAtom);
  const sparqlError = useAtomValue(ontologySparqlErrorAtom);
  const validationResult = useAtomValue(ontologyValidationResultAtom);
  const validationError = useAtomValue(ontologyValidationErrorAtom);
  const validationStatus = useAtomValue(ontologyValidationStatusAtom);
  const provenanceExport = useAtomValue(ontologyProvenanceExportAtom);
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
  const setFoldLevel = useAtomSet(ontologyFoldLevelAtom);
  const toggleInferredView = useAtomSet(toggleOntologyInferredViewAtom);
  const setSearchQuery = useAtomSet(ontologySearchQueryAtom);
  const setSparqlProfile = useAtomSet(ontologySparqlProfileAtom);
  const setSparqlQuery = useAtomSet(ontologySparqlQueryAtom);
  const setSelectedIri = useAtomSet(selectedOntologyResourceIriAtom);
  const setGraphContainer = useAtomSet(ontologyGraphContainerAtom);
  const setSubject = useAtomSet(subjectInputAtom);
  const setPredicate = useAtomSet(predicateInputAtom);
  const setObject = useAtomSet(objectInputAtom);
  const setObjectKind = useAtomSet(objectKindAtom);
  const openDocument = useAtomSet(openOntologyDocumentAtom);
  const saveDocument = useAtomSet(saveOntologyDocumentAtom);
  const previewTurtle = useAtomSet(previewOntologyTurtleAtom);
  const applyBatch = useAtomSet(applyOntologyBatchAtom);
  const applyGraphGesture = useAtomSet(applyOntologyGraphGestureAtom);
  const applyRepair = useAtomSet(applyOntologyRepairAtom);
  const applySparqlExample = useAtomSet(applyOntologySparqlExampleAtom);
  const runSparql = useAtomSet(runOntologySparqlAtom);
  const runValidation = useAtomSet(runOntologyValidationAtom);
  const exportProvenance = useAtomSet(exportOntologyProvenanceAtom);
  const undoChange = useAtomSet(undoOntologyChangeAtom);
  const redoChange = useAtomSet(redoOntologyChangeAtom);
  useAtomValue(ontologyGraphWorkerBridgeAtom);
  useAtomValue(ontologyGraphRenderBridgeAtom);
  const treeItems = ontologyTreeItemsFor(snapshot, mode);
  // A literal object is free text (whitespace included, once it has content);
  // an IRI object, like every subject and predicate, must be an absolute IRI.
  const subjectValid = iriFieldValid(subject);
  const predicateValid = iriFieldValid(predicate);
  const objectValid = objectKind === "iri" ? iriFieldValid(object) : Str.isNonEmpty(Str.trim(object));
  const canApplyTriple = subjectValid && predicateValid && objectValid;
  const canApplyGraphGesture = canApplyTriple && objectKind === "iri";
  const canRunSparql = O.isSome(session) && Str.isNonEmpty(Str.trim(sparqlQuery));
  const canRunValidation = O.isSome(session);
  const canUndo = O.match(session, { onNone: () => false, onSome: (openSession) => openSession.changeLog.length > 0 });
  const canRedo = redoStack.length > 0;
  const changeLog = O.match(session, {
    onNone: A.empty<ChangeOperation>,
    onSome: (openSession) => openSession.changeLog,
  });
  const undoPosition = changeLog.length;
  const totalChangeCount = undoPosition + redoStack.length;
  const graphBackendBadge: JSX.Element = O.isSome(graphError) ? (
    <Badge variant="destructive">failed</Badge>
  ) : (
    O.match(graphBackend, {
      onNone: () => <Badge variant="outline">pending</Badge>,
      onSome: (backend) => <Badge variant="outline">{backend}</Badge>,
    })
  );
  const graphProjectionSummary = O.match(graphProjection, {
    onNone: () => <span className="text-muted-foreground">Worker projection pending</span>,
    onSome: (projection) => (
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono">
        <span>nodes {projection.nodeCount}</span>
        <span>edges {projection.edgeCount}</span>
        <span>folded {projection.stats.foldedResourceCount}</span>
        <span>labels {projection.labelDetail}</span>
      </div>
    ),
  });
  const graphProjectionOverlay: JSX.Element = O.isSome(graphError) ? (
    <span className="block max-w-[44ch] text-destructive">Worker projection failed: {graphError.value}</span>
  ) : (
    graphProjectionSummary
  );

  const runOpen = (): void => {
    pipe(
      decodePath(pathInput),
      O.match({
        // A malformed path returned here silently, so Open read as a dead
        // button. Say why the path was rejected instead of doing nothing.
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

  const runAddTriple = (): void => {
    if (!canApplyTriple) return;
    const quad = makeQuad(
      makeNamedNode(Str.trim(subject)),
      makeNamedNode(Str.trim(predicate)),
      // Literals keep their text verbatim: trimming silently rewrote the value
      // the user typed, and leading/trailing whitespace can be significant.
      objectKind === "iri" ? makeNamedNode(Str.trim(object)) : makeLiteral(object, XSD_STRING.value)
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

  const runGraphGesture = (gesture: OntologyGraphGesture): void => {
    applyGraphGesture(ApplyOntologyGraphGestureInput.make({ gesture }));
  };

  const runConnect = (): void => {
    if (!canApplyGraphGesture) return;
    runGraphGesture(
      OntologyGraphGesture.make({
        kind: "connect",
        sourceIri: Str.trim(subject),
        predicateIri: Str.trim(predicate),
        targetIri: Str.trim(object),
      })
    );
  };

  const runDelete = (): void => {
    if (!canApplyGraphGesture) return;
    runGraphGesture(
      OntologyGraphGesture.make({
        kind: "delete",
        sourceIri: Str.trim(subject),
        predicateIri: Str.trim(predicate),
        targetIri: Str.trim(object),
      })
    );
  };

  const runExpand = (): void => {
    if (!canApplyGraphGesture) return;
    runGraphGesture(
      OntologyGraphGesture.make({
        kind: "expand",
        sourceIri: Str.trim(subject),
        predicateIri: Str.trim(predicate),
        targetIri: Str.trim(object),
      })
    );
  };

  const runInstantiate = (): void => {
    if (!canApplyGraphGesture) return;
    runGraphGesture(
      OntologyGraphGesture.make({
        kind: "instantiate",
        classIri: Str.trim(subject),
        instanceIri: Str.trim(object),
      })
    );
  };

  const runSparqlFromKeyboard = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (canRunSparql) {
        runSparql(undefined);
      }
    }
  };

  const selectSparqlExample = (exampleId: string): void => {
    if (Str.isNonEmpty(exampleId)) {
      applySparqlExample(exampleId);
    }
  };

  const selectValidationFocus = (iri: string): void => {
    setSelectedIri(O.some(iri));
    setSearchQuery(iri);
  };

  // The ref callback has to be STABLE. A fresh closure each render makes React
  // detach the old ref (calling it with `null`) and attach the new one on every
  // single render — so the container atom flipped none → some → none → some
  // forever, and the render bridge tore the cosmos graph down and rebuilt it each
  // time. Whenever the flip landed on `none` the backend reset, the canvas was
  // destroyed, and the badge fell back to "pending": the graph was being mounted
  // correctly and thrown away just as fast, which is why it looked like it had
  // never rendered at all.
  const graphContainerRef = useCallback(
    (element: HTMLDivElement | null): void => {
      setGraphContainer(O.fromNullishOr(element));
    },
    [setGraphContainer]
  );

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
          <NativeSelect
            aria-label="Graph fold level"
            size="sm"
            value={foldLevel}
            onChange={(event) => setFoldLevel(valueFromEvent(event) as OntologyFoldLevel)}
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

        {/* Open/save/preview failures had nowhere to land, so a rejected path or
            an unreadable file made the toolbar look inert. */}
        {O.isSome(documentError) ? (
          <div
            role="alert"
            className="text-destructive border-destructive/40 bg-destructive/10 shrink-0 border-b px-3 py-2 text-xs"
          >
            {documentError.value}
          </div>
        ) : null}

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
                <Badge variant="outline">Graph</Badge>
                <Badge variant="secondary">{foldLevel}</Badge>
                {graphBackendBadge}
              </div>
              <span className="max-w-[45ch] truncate font-mono text-xs text-muted-foreground">
                {O.getOrElse(path, () => "No file open")}
              </span>
            </div>
            <div className="relative min-h-0 flex-[3] bg-background">
              <div ref={graphContainerRef} className="h-full w-full" />
              <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
                {graphProjectionOverlay}
              </div>
            </div>
            <section className="flex h-48 shrink-0 flex-col border-t">
              <div className="flex h-8 shrink-0 items-center justify-between border-b px-3">
                <span className="text-xs font-medium">Turtle source</span>
                <Badge variant="outline">{snapshot.metrics.quadCount} quads</Badge>
              </div>
              <Textarea
                aria-label="Turtle source"
                className="min-h-0 flex-1 resize-none rounded-none border-0 font-mono text-xs leading-5 shadow-none focus-visible:ring-0"
                readOnly
                value={source}
              />
            </section>
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
                  aria-invalid={Str.isNonEmpty(Str.trim(subject)) && !subjectValid}
                  value={subject}
                  onChange={(event) => setSubject(valueFromEvent(event))}
                />
                <Input
                  aria-label="Predicate IRI"
                  aria-invalid={Str.isNonEmpty(Str.trim(predicate)) && !predicateValid}
                  list="ontology-predicate-suggestions"
                  value={predicate}
                  onChange={(event) => setPredicate(valueFromEvent(event))}
                />
                <datalist id="ontology-predicate-suggestions">
                  {A.map(predicateSuggestions, (suggestion) => (
                    <option key={suggestion.iri} value={suggestion.iri}>
                      {suggestion.label}
                    </option>
                  ))}
                </datalist>
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
                    aria-invalid={Str.isNonEmpty(Str.trim(object)) && !objectValid}
                    value={object}
                    onChange={(event) => setObject(valueFromEvent(event))}
                  />
                </div>
                {/* Apply is disabled for a malformed IRI; say why, or the button
                    just looks broken. */}
                {Str.isNonEmpty(Str.trim(subject)) && !subjectValid ? (
                  <p className="text-destructive text-xs">
                    Subject must be an IRI (e.g. https://example.org/pizza#Pizza).
                  </p>
                ) : null}
                {Str.isNonEmpty(Str.trim(predicate)) && !predicateValid ? (
                  <p className="text-destructive text-xs">
                    Predicate must be an IRI (e.g. http://www.w3.org/2000/01/rdf-schema#label).
                  </p>
                ) : null}
                {objectKind === "iri" && Str.isNonEmpty(Str.trim(object)) && !objectValid ? (
                  <p className="text-destructive text-xs">An IRI object must be an IRI.</p>
                ) : null}
                <Button
                  className="w-full"
                  size="sm"
                  type="button"
                  disabled={O.isNone(session) || !canApplyTriple}
                  onClick={runAddTriple}
                >
                  Apply
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!canApplyGraphGesture}
                    onClick={runConnect}
                  >
                    Connect
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!canApplyGraphGesture}
                    onClick={runDelete}
                  >
                    Delete
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!canApplyGraphGesture}
                    onClick={runExpand}
                  >
                    Expand
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!canApplyGraphGesture}
                    onClick={runInstantiate}
                  >
                    Instantiate
                  </Button>
                </div>
              </div>
            </section>

            <section className="border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">SPARQL</h2>
                <Badge variant={inferredView ? "secondary" : "outline"}>{inferredView ? "inferred" : "asserted"}</Badge>
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <NativeSelect
                    aria-label="SPARQL profile"
                    value={sparqlProfile}
                    onChange={(event) => setSparqlProfile(valueFromEvent(event) as OntologySparqlPanelProfile)}
                  >
                    <NativeSelectOption value="select">SELECT</NativeSelectOption>
                    <NativeSelectOption value="construct">CONSTRUCT</NativeSelectOption>
                  </NativeSelect>
                  <NativeSelect
                    aria-label="SPARQL examples"
                    value=""
                    onChange={(event) => selectSparqlExample(valueFromEvent(event))}
                  >
                    <NativeSelectOption value="">Examples</NativeSelectOption>
                    {A.map(sparqlExamples, (example) => (
                      <NativeSelectOption key={example.id} value={example.id}>
                        {example.label}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <Textarea
                  aria-label="SPARQL query"
                  className="h-40 resize-none font-mono text-xs leading-5"
                  value={sparqlQuery}
                  onChange={(event) => setSparqlQuery(valueFromEvent(event))}
                  onKeyDown={runSparqlFromKeyboard}
                />
                <Button
                  className="w-full"
                  size="sm"
                  type="button"
                  disabled={!canRunSparql}
                  onClick={() => runSparql(undefined)}
                >
                  Run
                </Button>
                <div className="rounded-md border p-2 text-xs">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="font-medium">Result</span>
                    {O.match(sparqlResult, {
                      onNone: () => <Badge variant="outline">empty</Badge>,
                      onSome: (result) => (
                        <Badge variant={result.truncated ? "destructive" : "secondary"}>
                          {result.displayedResultCount}/{result.rawResultCount}
                        </Badge>
                      ),
                    })}
                  </div>
                  {sparqlResultPanel(sparqlError, sparqlResult)}
                </div>
              </div>
            </section>

            <section className="border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Validation</h2>
                {validationStatusBadge(validationStatus, validationResult)}
              </div>
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" type="button" disabled={!canRunValidation} onClick={() => runValidation(undefined)}>
                    Validate
                  </Button>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    disabled={!canRunValidation}
                    onClick={() => exportProvenance(undefined)}
                  >
                    Export
                  </Button>
                </div>
                {validationPanel(
                  validationStatus,
                  validationError,
                  validationResult,
                  selectValidationFocus,
                  applyRepair
                )}
                {O.match(provenanceExport, {
                  onNone: () => null,
                  onSome: (exported) => (
                    <div className="rounded-md border p-2 text-xs">
                      <div className="mb-1 font-medium">Exports</div>
                      <div className="break-all font-mono text-muted-foreground">{exported.provPath}</div>
                      <div className="break-all font-mono text-muted-foreground">{exported.datasetPath}</div>
                    </div>
                  ),
                })}
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
              <div className="mb-3 rounded-md border p-2 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-medium">Inference</span>
                  <Badge variant={inferredView ? "secondary" : "outline"}>{inferredView ? "on" : "off"}</Badge>
                </div>
                {inferenceResultPanel(inferenceError, inferenceResult)}
              </div>
              <div className="grid grid-cols-2 gap-2">
                {A.map(statItems(snapshot, validationResult), ([label, value]) => (
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
