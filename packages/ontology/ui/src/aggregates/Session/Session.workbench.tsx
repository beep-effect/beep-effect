/**
 * Ontology workbench composition.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TooltipProvider } from "@beep/ui/components/tooltip";
import { OntologyChangeLogRegion } from "./Session.changelog.js";
import { OntologyDocumentRegion } from "./Session.document.js";
import { OntologyExplorerRegion } from "./Session.explorer.js";
import { OntologyGraphRegion } from "./Session.graph.js";
import { OntologyInspectorRegion } from "./Session.inspector.js";
import { OntologyMetricsRegion } from "./Session.metrics.js";
import { OntologySourceRegion } from "./Session.source.js";
import { OntologySparqlRegion } from "./Session.sparql.js";
import { OntologyValidationRegion } from "./Session.validation.js";
import type { JSX } from "react";

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
  return (
    <TooltipProvider>
      <div className="flex h-full min-h-0 w-full flex-col bg-background text-foreground">
        <OntologyDocumentRegion />
        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[260px_minmax(320px,1fr)] lg:overflow-hidden xl:grid-cols-[300px_minmax(360px,1fr)_340px]">
          <OntologyExplorerRegion />
          <main className="flex min-h-0 flex-col">
            <OntologyGraphRegion />
            <OntologySourceRegion />
          </main>
          <aside className="flex min-h-0 flex-col border-l">
            <OntologyInspectorRegion />
            <OntologySparqlRegion />
            <OntologyValidationRegion />
            <OntologyChangeLogRegion />
            <OntologyMetricsRegion />
          </aside>
        </div>
      </div>
    </TooltipProvider>
  );
}
