/**
 * Ontology workbench Worker Metrics region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ontologyInferenceErrorAtom,
  ontologyInferenceResultAtom,
  ontologyInferredViewAtom,
  ontologySnapshotAtom,
  ontologyValidationResultAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { A, O } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import { flow, pipe } from "effect";
import type {
  OntologyInferenceResult,
  OntologySnapshot,
  RunOntologyValidationResult,
} from "@beep/ontology-use-cases/aggregates/Session";
import type { JSX } from "react";

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

/**
 * Inference status and ontology worker metric cards.
 *
 * @example
 * ```tsx
 * import { OntologyMetricsRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyMetricsRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyMetricsRegion(): JSX.Element {
  const snapshot = useAtomValue(ontologySnapshotAtom);
  const inferredView = useAtomValue(ontologyInferredViewAtom);
  const inferenceResult = useAtomValue(ontologyInferenceResultAtom);
  const inferenceError = useAtomValue(ontologyInferenceErrorAtom);
  const validationResult = useAtomValue(ontologyValidationResultAtom);

  return (
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
  );
}
