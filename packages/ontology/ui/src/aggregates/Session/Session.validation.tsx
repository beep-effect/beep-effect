/**
 * Ontology workbench Validation region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  applyOntologyRepairAtom,
  exportOntologyProvenanceAtom,
  ontologyProvenanceExportAtom,
  ontologySearchQueryAtom,
  ontologySessionAtom,
  ontologyValidationErrorAtom,
  ontologyValidationResultAtom,
  ontologyValidationStatusAtom,
  runOntologyValidationAtom,
  selectedOntologyResourceIriAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Button } from "@beep/ui/components/button";
import { A, O } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { pipe } from "effect";
import type { OntologyValidationStatus } from "@beep/ontology-client/aggregates/Session";
import type { OntologyRepairProposal, RunOntologyValidationResult } from "@beep/ontology-use-cases/aggregates/Session";
import type { JSX } from "react";

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
  if (status === "running") return <Badge variant="outline">running</Badge>;
  if (status === "blocked") return <Badge variant="outline">blocked</Badge>;
  if (status === "failed") return <Badge variant="destructive">failed</Badge>;

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
 * Validation actions, results, verified repairs, and provenance export.
 *
 * @example
 * ```tsx
 * import { OntologyValidationRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyValidationRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyValidationRegion(): JSX.Element {
  const session = useAtomValue(ontologySessionAtom);
  const validationResult = useAtomValue(ontologyValidationResultAtom);
  const validationError = useAtomValue(ontologyValidationErrorAtom);
  const validationStatus = useAtomValue(ontologyValidationStatusAtom);
  const provenanceExport = useAtomValue(ontologyProvenanceExportAtom);
  const setSearchQuery = useAtomSet(ontologySearchQueryAtom);
  const setSelectedIri = useAtomSet(selectedOntologyResourceIriAtom);
  const applyRepair = useAtomSet(applyOntologyRepairAtom);
  const runValidation = useAtomSet(runOntologyValidationAtom);
  const exportProvenance = useAtomSet(exportOntologyProvenanceAtom);
  const canRunValidation = O.isSome(session);

  const selectValidationFocus = (iri: string): void => {
    setSelectedIri(O.some(iri));
    setSearchQuery(iri);
  };

  return (
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
        {validationPanel(validationStatus, validationError, validationResult, selectValidationFocus, applyRepair)}
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
  );
}
