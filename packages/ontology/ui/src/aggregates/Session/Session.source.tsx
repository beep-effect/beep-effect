/**
 * Ontology workbench Source region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ontologySnapshotAtom, ontologySourceAtom } from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Textarea } from "@beep/ui/components/textarea";
import { useAtomValue } from "@effect/atom-react";
import type { JSX } from "react";

/**
 * Read-only Turtle source for the open ontology document.
 *
 * @example
 * ```tsx
 * import { OntologySourceRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologySourceRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologySourceRegion(): JSX.Element {
  const snapshot = useAtomValue(ontologySnapshotAtom);
  const source = useAtomValue(ontologySourceAtom);

  return (
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
  );
}
