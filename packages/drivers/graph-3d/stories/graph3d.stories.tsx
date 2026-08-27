import { Graph3DProjection, generateSyntheticGraph3DProjection, SyntheticGraph3DOptions } from "@beep/graph-3d";
import { useGraph3DFps, useGraph3DHandle } from "@beep/graph-3d/react";
import { useEffect, useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Story wrapper over the driver's React hooks (`@beep/graph-3d/react`). The
 * driver itself is framework-free; the ontology client bridge owns mounting in
 * the product, and the hooks play that role for Storybook.
 */
interface Graph3DDemoProps {
  readonly communityCount: number;
  readonly edgeCount: number;
  /**
   * Non-destructive 2D flatten: renders the same projection with z forced to
   * zero; switching back restores the identical baked depths (the toggle
   * contract from the design gate).
   */
  readonly flatten: boolean;
  readonly nodeCount: number;
  readonly seed: number;
  /** Applies selection dimming to the highest-importance node. */
  readonly selectHub: boolean;
}

const flattenProjection = (projection: Graph3DProjection): Graph3DProjection => {
  const flattened = new Float32Array(projection.pointPositions);
  for (let index = 0; index < projection.nodeCount; index += 1) {
    flattened[index * 3 + 2] = 0;
  }
  return Graph3DProjection.make({
    nodeCount: projection.nodeCount,
    edgeCount: projection.edgeCount,
    nodeIds: projection.nodeIds,
    pointPositions: flattened,
    links: projection.links,
    nodeCommunities: projection.nodeCommunities,
    nodeImportance: projection.nodeImportance,
    edgeWeights: projection.edgeWeights,
    ...(projection.labels === undefined ? {} : { labels: projection.labels }),
  });
};

const hubIndex = (projection: Graph3DProjection): number => {
  let best = 0;
  for (let index = 1; index < projection.nodeCount; index += 1) {
    if (projection.nodeImportance[index]! > projection.nodeImportance[best]!) {
      best = index;
    }
  }
  return best;
};

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  color: "#9ee2e2",
  background: "rgba(0,0,0,0.55)",
  font: "12px/1.5 monospace",
  padding: "6px 10px",
  borderRadius: 6,
  pointerEvents: "none",
  whiteSpace: "pre",
};

// fallow-ignore-next-line complexity -- cognitive 12 = pre-existing hook/JSX tax (six hook bindings across state/memo/effect); this branch's changes in this file were story args and story renames only and added no branching here
const Graph3DDemo = ({ nodeCount, edgeCount, communityCount, seed, selectHub, flatten }: Graph3DDemoProps) => {
  const [picked, setPicked] = useState<number | undefined>(undefined);

  const projection = useMemo(
    () =>
      generateSyntheticGraph3DProjection(SyntheticGraph3DOptions.make({ nodeCount, edgeCount, communityCount, seed })),
    [nodeCount, edgeCount, communityCount, seed]
  );
  const flattened = useMemo(() => flattenProjection(projection), [projection]);

  const { containerRef, handle, error } = useGraph3DHandle({ projection, onNodeSelect: setPicked });
  const fps = useGraph3DFps({ handle });

  useEffect(() => {
    if (handle === undefined) {
      return;
    }
    handle.update(flatten ? flattened : projection);
    // update() resets selection; re-apply the demo's declarative selection —
    // the same re-apply contract the ontology bridge follows.
    handle.select(selectHub ? hubIndex(projection) : undefined);
  }, [handle, flatten, flattened, projection, selectHub]);

  return (
    <div style={{ position: "relative", width: "100%", height: "80vh", minHeight: 480 }}>
      <div ref={containerRef} data-testid="graph3d-container" style={{ position: "absolute", inset: 0 }} />
      <div style={overlayStyle} data-testid="graph3d-overlay">
        {error === undefined
          ? `nodes ${projection.nodeCount}  edges ${projection.edgeCount}\n` +
            `fps ${fps.toFixed(1)}\n` +
            `mode ${flatten ? "2D (z flattened)" : "3D"}  picked ${picked ?? "none"}`
          : `render error: ${error}`}
      </div>
    </div>
  );
};

/**
 * `renderGraph3D` is the instanced three.js knowledge-graph renderer from
 * `@beep/graph-3d/browser`: dark `#111111` canvas, community-colored billboard
 * nodes sized by importance, curved ribbon edges, importance-ranked labels
 * that fade with camera distance, click selection with neighborhood dimming,
 * and a non-destructive 2D/3D flatten toggle. Drag to orbit (trackball),
 * wheel to dolly, right-drag to pan, click a node to select, click empty
 * space to clear.
 */
const meta = {
  title: "Drivers/Graph3D/KnowledgeGraph",
  component: Graph3DDemo,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    backgrounds: { default: "dark" },
  },
  argTypes: {
    nodeCount: { control: { type: "number", min: 10, max: 10_000 } },
    edgeCount: { control: { type: "number", min: 0, max: 25_000 } },
    communityCount: { control: { type: "number", min: 1, max: 12 } },
    seed: { control: "number" },
    selectHub: {
      control: "boolean",
      description: "Selection dimming: selected hub + neighbors stay at full opacity, the rest dim to 0.10.",
    },
    flatten: {
      control: "boolean",
      description: "Non-destructive 2D flatten/restore of the same baked layout (the 2D/3D toggle contract).",
    },
  },
} satisfies Meta<typeof Graph3DDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default browsing scale: a few hundred nodes render smoothly on any
 * hardware while still exercising all six behaviors. Toggle `selectHub` to see
 * selection dimming and `flatten` to see the non-destructive 2D/3D switch.
 */
export const KnowledgeGraph: Story = {
  args: {
    nodeCount: 250,
    edgeCount: 500,
    communityCount: 6,
    seed: 1_337,
    selectHub: false,
    flatten: false,
  },
};

/**
 * Selection-dimming state: the highest-importance node and its neighborhood
 * stay at full opacity while everything else dims to 0.10 (nodes and labels)
 * and non-incident edges fall to gray 0.30.
 */
export const SelectionDimming: Story = {
  args: {
    ...KnowledgeGraph.args,
    selectHub: true,
  },
};

/**
 * Deliberate design-gate perf probe at the target scale: ~2,500 nodes / 5,000
 * edges rendered interactively, targeting ≥30fps on reference desktop hardware
 * (the overlay reports the sustained framerate of the continuous render loop).
 * Headless CI renders via SwiftShader and MUST NOT assert fps. Drag/dolly to
 * stress interaction; raise `nodeCount`/`edgeCount` to find the local ceiling.
 */
export const PerfProbe2500: Story = {
  args: {
    nodeCount: 2_500,
    edgeCount: 5_000,
    communityCount: 8,
    seed: 1_337,
    selectHub: false,
    flatten: false,
  },
};
