/**
 * Ontology workbench Graph region.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { EditorViewer } from "@beep/editor";
import { SerializedEditorState } from "@beep/lexical-schema";
import {
  ontologyFoldLevelAtom,
  ontologyGraphBackendAtom,
  ontologyGraphContainerAtom,
  ontologyGraphErrorAtom,
  ontologyGraphProjectionAtom,
  ontologyGraphRenderBridgeAtom,
  ontologyGraphRendererAtom,
  ontologyGraphWorkerBridgeAtom,
  ontologyPathAtom,
} from "@beep/ontology-client/aggregates/Session";
import { Badge } from "@beep/ui/components/badge";
import { Switch } from "@beep/ui/components/switch";
import { O } from "@beep/utils";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as S from "effect/Schema";
import { useCallback } from "react";
import type { JSX } from "react";

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
  const setRenderer = useAtomSet(ontologyGraphRendererAtom);
  const setGraphContainer = useAtomSet(ontologyGraphContainerAtom);
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
    <span className="block max-w-[44ch] text-destructive">Worker projection failed: {graphError.value}</span>
  ) : (
    graphProjectionSummary
  );

  const graphContainerRef = useCallback(
    (element: HTMLDivElement | null): (() => void) | undefined => {
      if (element === null) {
        setGraphContainer(O.none());
        return undefined;
      }
      if (element.clientWidth > 0 && element.clientHeight > 0) {
        setGraphContainer(O.some(element));
        return () => setGraphContainer(O.none());
      }
      const observer = new ResizeObserver(() => {
        if (element.clientWidth > 0 && element.clientHeight > 0) {
          observer.disconnect();
          setGraphContainer(O.some(element));
        }
      });
      observer.observe(element);
      return () => {
        observer.disconnect();
        setGraphContainer(O.none());
      };
    },
    [setGraphContainer]
  );

  return (
    <>
      <div className="flex h-10 shrink-0 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <EditorViewer state={sourceViewerState} className="text-sm font-medium" />
          <Badge variant="outline">Graph</Badge>
          <Badge variant="secondary">{foldLevel}</Badge>
          {graphBackendBadge}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <span className="max-w-[45ch] truncate font-mono text-xs text-muted-foreground">
            {O.getOrElse(path, () => "No file open")}
          </span>
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <Switch
              aria-label="Toggle 3D graph renderer"
              size="sm"
              checked={renderer === "graph3d"}
              onCheckedChange={(checked) => setRenderer(checked ? "graph3d" : "cosmos")}
            />
            <span className="text-xs">3D</span>
          </div>
        </div>
      </div>
      <div className="relative min-h-0 flex-[3] bg-background">
        <div ref={graphContainerRef} className="h-full w-full" />
        <div className="pointer-events-none absolute left-3 top-3 rounded-md border bg-background/95 px-3 py-2 text-xs shadow-sm">
          {graphProjectionOverlay}
        </div>
      </div>
    </>
  );
}
