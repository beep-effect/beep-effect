/**
 * Ontology workbench Change Log region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ontologyRedoStackAtom, ontologySessionAtom } from "@beep/ontology-client/aggregates/Session";
import { ChangeOperation } from "@beep/ontology-domain/aggregates/Session";
import { serializeTerm } from "@beep/rdf/Rdf";
import { Badge } from "@beep/ui/components/badge";
import { A, O } from "@beep/utils";
import { useAtomValue } from "@effect/atom-react";
import type { JSX } from "react";

const changeTargetLabel = (change: ChangeOperation): string =>
  ChangeOperation.match(change, {
    addQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
    removeQuad: ({ quad }) => `${serializeTerm(quad.subject)} ${serializeTerm(quad.predicate)}`,
  });

/**
 * Applied change history and redo position for the ontology session.
 *
 * @example
 * ```tsx
 * import { OntologyChangeLogRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyChangeLogRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyChangeLogRegion(): JSX.Element {
  const session = useAtomValue(ontologySessionAtom);
  const redoStack = useAtomValue(ontologyRedoStackAtom);
  const changeLog = O.match(session, {
    onNone: A.empty<ChangeOperation>,
    onSome: (openSession) => openSession.changeLog,
  });
  const undoPosition = changeLog.length;
  const totalChangeCount = undoPosition + redoStack.length;

  return (
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
  );
}
