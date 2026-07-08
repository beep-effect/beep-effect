/**
 * Knowledge-graph primitive: a force-directed node/link graph view with an imperative handle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { A, Str } from "@beep/utils";
import { useAtom } from "@effect/atom-react";
import * as d3 from "d3";
import { flow, HashSet, Order, pipe } from "effect";
import * as O from "effect/Option";
import { Atom } from "effect/unstable/reactivity";
import { forwardRef, useEffect, useId, useImperativeHandle, useRef } from "react";
import { cn } from "../lib/index.ts";

// ============================================================================
// Types
// ============================================================================

/**
 * Graph node type.
 *
 * @example
 * ```ts
 * import type { GraphNode } from "@beep/ui/components/knowledge-graph"
 *
 * const node: GraphNode = { id: "concept-1", label: "Prior Art", type: "concept" }
 *
 * console.log(node.label)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GraphNode extends d3.SimulationNodeDatum {
  /** Optional custom color */
  readonly color?: undefined | string;
  /** Optional additional data */
  readonly data?: undefined | unknown;
  /** Unique identifier for the node */
  readonly id: string;
  /** Display label for the node */
  readonly label: string;
  /** Optional node size (default: 20) */
  readonly size?: undefined | number;
  /** Node type/category (used for coloring) */
  readonly type: string;
}

/**
 * Graph link type.
 *
 * @example
 * ```ts
 * import type { GraphLink } from "@beep/ui/components/knowledge-graph"
 *
 * const link: GraphLink = { source: "concept-1", target: "concept-2" }
 *
 * console.log(link.source)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  /** Optional relationship label */
  readonly label?: undefined | string;
  /** Source node ID or node reference */
  readonly source: string | GraphNode;
  /** Optional link strength (default: 1) */
  readonly strength?: undefined | number;
  /** Target node ID or node reference */
  readonly target: string | GraphNode;
}

interface KnowledgeGraphProps {
  /** Center node ID (will be positioned in center) */
  readonly centerNodeId?: undefined | string;
  /** Additional CSS classes */
  readonly className?: undefined | string;
  /** Array of links connecting nodes */
  readonly links: GraphLink[];
  /** Array of nodes to display */
  readonly nodes: GraphNode[];
  /** Callback when a node is clicked */
  readonly onNodeClick?: undefined | ((node: GraphNode) => void);
  /** Callback when a node is hovered */
  readonly onNodeHover?: undefined | ((node: GraphNode | null) => void);
  /** Show legend for node types */
  readonly showLegend?: undefined | boolean;
  /** Show link labels */
  readonly showLinkLabels?: undefined | boolean;
}

/**
 * Knowledge graph handle type.
 *
 * @example
 * ```ts
 * import type { KnowledgeGraphHandle } from "@beep/ui/components/knowledge-graph"
 *
 * const handle: KnowledgeGraphHandle = {
 *   exportAsPNG: () => undefined,
 *   exportAsSVG: () => undefined,
 *   resetZoom: () => undefined,
 * }
 *
 * console.log(typeof handle.resetZoom)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export interface KnowledgeGraphHandle {
  /** Export the graph as PNG */
  readonly exportAsPNG: () => void;
  /** Export the graph as SVG */
  readonly exportAsSVG: () => void;
  /** Reset zoom to default */
  readonly resetZoom: () => void;
}

type KnowledgeGraphState = {
  readonly legendItems: ReadonlyArray<{ readonly type: string; readonly color: string }>;
  readonly tooltip: {
    readonly x: number;
    readonly y: number;
    readonly content: string;
    readonly visible: boolean;
  };
};

const emptyKnowledgeGraphState: KnowledgeGraphState = {
  legendItems: A.empty(),
  tooltip: {
    x: 0,
    y: 0,
    content: "",
    visible: false,
  },
};

const knowledgeGraphStateAtom = Atom.family((_scope: string) =>
  Atom.make<KnowledgeGraphState>(emptyKnowledgeGraphState)
);

// ============================================================================
// Utility Functions
// ============================================================================

/** Generate a deterministic color from a string */
const stringToColor = (str: string): string => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = O.getOrElse(Str.charCodeAt(str, i), () => 0);
    hash = (hash << 5) - hash + char;
    hash &= hash;
  }
  const hue = Math.abs(hash) % 360;
  const saturation = 65 + (Math.abs(hash) % 20);
  const lightness = 50 + (Math.abs(hash) % 15);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

/** Format type string for display */
const formatTypeLabel: (type: string) => string = flow(
  Str.replace(/_/g, " "),
  Str.replaceWith(/\b\w/g, Str.toUpperCase)
);

// ============================================================================
// Component
// ============================================================================

/**
 * Knowledge graph component.
 *
 * @example
 * ```tsx
 * import { KnowledgeGraph } from "@beep/ui/components/knowledge-graph"
 *
 * console.log(KnowledgeGraph)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const KnowledgeGraph = forwardRef<KnowledgeGraphHandle, KnowledgeGraphProps>(
  (
    { nodes, links, onNodeClick, onNodeHover, showLegend = true, showLinkLabels = true, centerNodeId, className = "" },
    ref
  ) => {
    const scope = useId();
    const [graphState, setGraphState] = useAtom(knowledgeGraphStateAtom(scope));
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

    // Export as SVG
    const exportAsSVG = () => {
      if (svgRef.current === null) return;

      const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
      const graphGroup = clonedSvg.querySelector<SVGGElement>("g");

      if (graphGroup !== null) {
        const originalGroup = svgRef.current.querySelector<SVGGElement>("g");
        if (originalGroup !== null) {
          const bbox = originalGroup.getBBox();
          const padding = 50;
          clonedSvg.setAttribute(
            "viewBox",
            `${bbox.x - padding} ${bbox.y - padding} ${bbox.width + padding * 2} ${bbox.height + padding * 2}`
          );
          clonedSvg.setAttribute("width", `${bbox.width + padding * 2}`);
          clonedSvg.setAttribute("height", `${bbox.height + padding * 2}`);
          graphGroup.removeAttribute("transform");
        }
      }

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "knowledge-graph.svg";
      link.click();
      URL.revokeObjectURL(url);
    };

    // Export as PNG
    const exportAsPNG = () => {
      if (svgRef.current === null) return;

      const clonedSvg = svgRef.current.cloneNode(true) as SVGSVGElement;
      const graphGroup = clonedSvg.querySelector<SVGGElement>("g");
      let bbox = { x: 0, y: 0, width: 800, height: 600 };

      const originalGroup = svgRef.current.querySelector<SVGGElement>("g");
      if (originalGroup !== null) {
        bbox = originalGroup.getBBox();
      }

      const padding = 100;
      const width = bbox.width + padding * 2;
      const height = bbox.height + padding * 2;

      clonedSvg.setAttribute("viewBox", `${bbox.x - padding} ${bbox.y - padding} ${width} ${height}`);
      clonedSvg.setAttribute("width", `${width}`);
      clonedSvg.setAttribute("height", `${height}`);
      if (graphGroup !== null) graphGroup.removeAttribute("transform");

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new window.Image();
      const scale = 2;

      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx?.scale(scale, scale);

      if (ctx !== null) {
        ctx.fillStyle = "#18181b";
        ctx.fillRect(0, 0, width, height);
      }

      img.onload = () => {
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (blob !== null) {
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "knowledge-graph.png";
            link.click();
            URL.revokeObjectURL(url);
          }
        }, "image/png");
      };

      const svgData = new XMLSerializer().serializeToString(clonedSvg);
      const blob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      img.src = URL.createObjectURL(blob);
    };

    // Reset zoom
    const resetZoom = () => {
      if (svgRef.current !== null && zoomRef.current !== null) {
        d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity);
      }
    };

    useImperativeHandle(ref, () => ({
      exportAsSVG,
      exportAsPNG,
      resetZoom,
    }));

    // Main D3 effect
    useEffect(() => {
      if (svgRef.current === null || containerRef.current === null || nodes.length === 0) return;

      const container = containerRef.current;
      const svg = d3.select(svgRef.current);

      // Clear previous content
      svg.selectAll("*").remove();

      const width = container.clientWidth;
      const height = container.clientHeight;

      // Get unique node types for coloring
      const nodeTypes = pipe(
        nodes,
        A.map((node) => node.type),
        HashSet.fromIterable,
        A.fromIterable,
        A.sort(Order.String)
      );
      const colorMapping: Record<string, string> = {};
      for (const type of nodeTypes) {
        colorMapping[type] = stringToColor(type);
      }

      const colorScale = (type: string, customColor?: string) => customColor ?? colorMapping[type] ?? "#6b7280";

      // Set legend items
      setGraphState((state) => ({
        ...state,
        legendItems: A.map(nodeTypes, (type) => ({
          type: formatTypeLabel(type),
          color: colorMapping[type] ?? "#6b7280",
        })),
      }));

      // Clone data to avoid mutation
      const nodesCopy: GraphNode[] = A.map(nodes, (n) => ({
        ...n,
        size: n.size ?? 20,
      }));
      const linksCopy: GraphLink[] = A.map(links, (l) => ({ ...l }));

      // Position center node if specified
      const centerNode =
        centerNodeId !== undefined
          ? pipe(
              nodesCopy,
              A.findFirst((n) => n.id === centerNodeId),
              O.getOrNull
            )
          : null;
      if (centerNode !== null) {
        centerNode.x = width / 2;
        centerNode.y = height / 2;
      }

      // Create simulation
      const simulation = d3
        .forceSimulation<GraphNode>(nodesCopy)
        .force(
          "link",
          d3
            .forceLink<GraphNode, GraphLink>(linksCopy)
            .id((d: GraphNode) => d.id)
            .distance(150)
            .strength((d: GraphLink) => d.strength ?? 0.8)
        )
        .force("charge", d3.forceManyBody().strength(-800))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force(
          "collision",
          d3.forceCollide<GraphNode>().radius((d: GraphNode) => (d.size ?? 20) + 20)
        );

      // Create zoom behavior
      const zoom = d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on(
          "zoom",
          (event: d3.D3ZoomEvent<SVGSVGElement, unknown>) => void g.attr("transform", event.transform.toString())
        );

      zoomRef.current = zoom;
      svg.call(zoom);

      // Create container group
      const g = svg.append("g");

      // Create links
      const link = g
        .selectAll<SVGLineElement, GraphLink>(".link")
        .data(linksCopy)
        .join("line")
        .attr("class", "link")
        .attr("stroke", "#6b7280")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-width", 2);

      // Create link labels
      const linkLabel = showLinkLabels
        ? g
            .selectAll<SVGTextElement, GraphLink>(".link-label")
            .data(A.filter(linksCopy, (l) => l.label !== undefined && l.label.length > 0))
            .join("text")
            .attr("class", "link-label")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#9ca3af")
            .text((d: GraphLink) => d.label ?? "")
        : null;

      // Create node groups
      const nodeGroup = g
        .selectAll<SVGGElement, GraphNode>(".node-group")
        .data(nodesCopy)
        .join("g")
        .attr("class", "node-group")
        .style("cursor", "pointer")
        .call(
          d3
            .drag<SVGGElement, GraphNode>()
            .on("start", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
              if (event.active === 0) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event: d3.D3DragEvent<SVGGElement, GraphNode, GraphNode>, d: GraphNode) => {
              if (event.active === 0) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        );

      // Add circles
      nodeGroup
        .append("circle")
        .attr("r", (d: GraphNode) => d.size ?? 20)
        .attr("fill", (d: GraphNode) => colorScale(d.type, d.color))
        .attr("stroke", "#27272a")
        .attr("stroke-width", 2);

      // Add labels
      nodeGroup
        .append("text")
        .attr("class", "node-label")
        .attr("text-anchor", "middle")
        .attr("dy", ".35em")
        .attr("font-size", "11px")
        .attr("font-weight", "500")
        .attr("fill", "#ffffff")
        .attr("pointer-events", "none")
        .text((d: GraphNode) => (d.label.length > 12 ? `${Str.substring(0, 10)(d.label)}...` : d.label));

      // Add event handlers
      nodeGroup
        .on("click", (_event: MouseEvent, d: GraphNode) => void onNodeClick?.(d))
        .on("mouseover", (event: MouseEvent, d: GraphNode) => {
          const [x, y] = d3.pointer(event, container);
          setGraphState((state) => ({
            ...state,
            tooltip: {
              x: x + 10,
              y: y - 10,
              content: `${d.label} (${formatTypeLabel(d.type)})`,
              visible: true,
            },
          }));
          onNodeHover?.(d);
        })
        .on("mouseout", () => {
          setGraphState((state) => ({
            ...state,
            tooltip: { ...state.tooltip, visible: false },
          }));
          onNodeHover?.(null);
        });

      // Update positions on tick
      simulation.on("tick", () => {
        link
          .attr("x1", (d: GraphLink) => (d.source as GraphNode).x ?? 0)
          .attr("y1", (d: GraphLink) => (d.source as GraphNode).y ?? 0)
          .attr("x2", (d: GraphLink) => (d.target as GraphNode).x ?? 0)
          .attr("y2", (d: GraphLink) => (d.target as GraphNode).y ?? 0);

        if (linkLabel !== null) {
          linkLabel
            .attr("x", (d: GraphLink) => (((d.source as GraphNode).x ?? 0) + ((d.target as GraphNode).x ?? 0)) / 2)
            .attr("y", (d: GraphLink) => (((d.source as GraphNode).y ?? 0) + ((d.target as GraphNode).y ?? 0)) / 2);
        }

        nodeGroup.attr("transform", (d: GraphNode) => `translate(${d.x ?? 0},${d.y ?? 0})`);
      });

      // Cleanup
      return () => void simulation.stop();
    }, [nodes, links, onNodeClick, onNodeHover, showLinkLabels, centerNodeId, setGraphState]);

    return (
      <div className={cn("relative h-full w-full min-h-[400px]", className)}>
        <div ref={containerRef} className="h-full w-full">
          <svg ref={svgRef} width="100%" height="100%" className="bg-zinc-50 dark:bg-zinc-900 rounded-xl" />
        </div>

        {/* Tooltip */}
        {graphState.tooltip.visible && (
          <div
            className="pointer-events-none absolute z-10 px-3 py-2 text-sm rounded-lg bg-zinc-800 text-zinc-100 shadow-lg border border-zinc-700"
            style={{ left: graphState.tooltip.x, top: graphState.tooltip.y }}
          >
            {graphState.tooltip.content}
          </div>
        )}

        {/* Legend */}
        {showLegend && graphState.legendItems.length > 0 && (
          <div className="absolute top-4 right-4 z-10 p-3 rounded-lg bg-zinc-800/90 backdrop-blur-sm border border-zinc-700">
            <div className="max-h-48 space-y-1.5 overflow-y-auto">
              {A.map(graphState.legendItems, (item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                  <span className="text-xs text-zinc-300">{item.type}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
);

KnowledgeGraph.displayName = "KnowledgeGraph";

/**
 * @category components
 * @since 0.0.0
 */
export default KnowledgeGraph;
