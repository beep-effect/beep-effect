/**
 * Ontology workbench Graph region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import {
  ontologyFoldLevelAtom,
  ontologyGraphBackendAtom,
  ontologyGraphContainerBindingAtom,
  ontologyGraphErrorAtom,
  ontologyGraphProjectionAtom,
  ontologyGraphRenderBridgeAtom,
  ontologyGraphRendererAtom,
  ontologyGraphWorkerBridgeAtom,
  ontologyPathAtom,
  setOntologyGraphContainerElementAtom,
  setOntologyGraphRendererAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Switch } from "@beep/ui/components/switch";
import { O } from "@beep/utils";
import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { JSX } from "react";

/**
 * Graph header, renderer control, canvas mount, and projection overlay.
 *
 * @example
 * ```tsx
 * import { OntologyGraphRegion } from "@beep/ontology-ui"
 *
 * console.log(OntologyGraphRegion)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function OntologyGraphRegion(): JSX.Element {
  const foldLevel = useAtomValue(ontologyFoldLevelAtom);
  const graphProjection = useAtomValue(ontologyGraphProjectionAtom);
  const graphBackend = useAtomValue(ontologyGraphBackendAtom);
  const graphError = useAtomValue(ontologyGraphErrorAtom);
  const renderer = useAtomValue(ontologyGraphRendererAtom);
  const path = useAtomValue(ontologyPathAtom);
  const setRenderer = useAtomSet(setOntologyGraphRendererAtom);
  const setGraphContainer = useAtomSet(setOntologyGraphContainerElementAtom);
  useAtomMount(ontologyGraphContainerBindingAtom);
  useAtomValue(ontologyGraphWorkerBridgeAtom);
  useAtomValue(ontologyGraphRenderBridgeAtom);

  const graphBackendBadge: JSX.Element = O.isSome(graphError) ? (
    <Badge variant="destructive">failed</Badge>
  ) : renderer === "graph3d" ? (
    <Badge variant="outline">3d</Badge>
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
    <span className="block max-w-[44ch] text-destructive">Graph unavailable: {graphError.value}</span>
  ) : (
    graphProjectionSummary
  );
  const graphPathLabel = O.getOrElse(path, () => "No file open");

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between gap-1 border-b px-2">
        <div className="flex shrink-0 items-center gap-1">
          <span className="whitespace-nowrap text-sm font-medium">Turtle source</span>
          <Badge variant="outline">Graph</Badge>
          <Badge variant="secondary">{foldLevel}</Badge>
          {graphBackendBadge}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <span
            className="min-w-0 max-w-[45ch] truncate font-mono text-xs text-muted-foreground"
            title={graphPathLabel}
          >
            {graphPathLabel}
          </span>
          <div className="flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-1">
            <Switch
              aria-label="Toggle 3D graph renderer"
              size="sm"
              checked={renderer === "graph3d"}
              onCheckedChange={setRenderer}
            />
            <span className="text-xs">3D</span>
          </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-[3] bg-background">
        <div ref={setGraphContainer} className="h-full w-full" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
          {graphProjectionOverlay}
        </div>
      </div>
    </>
  );
}
