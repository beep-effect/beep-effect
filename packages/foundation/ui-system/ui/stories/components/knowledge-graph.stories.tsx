import { KnowledgeGraph } from "@beep/ui/components/knowledge-graph";
import { fn } from "storybook/test";
import type { GraphLink, GraphNode } from "@beep/ui/components/knowledge-graph";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `KnowledgeGraph` is a force-directed graph renderer built on D3. It lays out `nodes`
 * with a physics simulation, draws `links` between them, colors nodes by `type`, and
 * supports drag, zoom/pan, hover tooltips, an optional legend, and optional link labels.
 * It also exposes an imperative handle (`resetZoom`, `exportAsSVG`, `exportAsPNG`) via ref.
 *
 * Imported from `@beep/ui/components/knowledge-graph`.
 */
const nodes: GraphNode[] = [
  { id: "effect", label: "Effect", type: "library" },
  { id: "schema", label: "Schema", type: "library" },
  { id: "stream", label: "Stream", type: "module" },
  { id: "layer", label: "Layer", type: "module" },
  { id: "service", label: "Service", type: "concept" },
  { id: "runtime", label: "Runtime", type: "concept" },
];

const links: GraphLink[] = [
  { source: "effect", target: "schema", label: "depends on" },
  { source: "effect", target: "stream", label: "provides" },
  { source: "effect", target: "layer", label: "provides" },
  { source: "layer", target: "service", label: "wires" },
  { source: "service", target: "runtime", label: "runs in" },
  { source: "stream", target: "runtime", label: "runs in" },
];

const meta = {
  title: "Components/Data Display/KnowledgeGraph",
  component: KnowledgeGraph,
  tags: ["autodocs"],
  argTypes: {
    nodes: {
      control: false,
      description: "Array of nodes to display; each needs an `id`, `label`, and `type` (used for coloring).",
    },
    links: {
      control: false,
      description: "Array of links connecting nodes by `source`/`target` id, with an optional relationship `label`.",
    },
    centerNodeId: {
      control: "text",
      description: "Id of a node to pin to the center of the canvas.",
    },
    showLegend: {
      control: "boolean",
      description: "Show the legend mapping node types to their generated colors.",
      table: { defaultValue: { summary: "true" } },
    },
    showLinkLabels: {
      control: "boolean",
      description: "Render the relationship label on each link.",
      table: { defaultValue: { summary: "true" } },
    },
    className: {
      control: "text",
      description: "Additional classes merged onto the graph wrapper (e.g. sizing constraints).",
    },
    onNodeClick: {
      control: false,
      description: "Callback fired with the node when it is clicked.",
    },
    onNodeHover: {
      control: false,
      description: "Callback fired with the node on hover, or `null` on mouse-out.",
    },
  },
  args: {
    nodes,
    links,
    showLegend: true,
    showLinkLabels: true,
    onNodeClick: fn(),
    onNodeHover: fn(),
  },
  decorators: [
    (Story) => (
      <div className="h-120 w-full max-w-3xl">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof KnowledgeGraph>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default force-directed graph: six nodes colored by type, connected by labeled
 * links, with the type legend shown in the top-right corner.
 */
export const Default: Story = {};

/**
 * The same graph with `effect` pinned to the center, useful for ego-network views that
 * radiate out from a focal node.
 */
export const Centered: Story = {
  args: { centerNodeId: "effect" },
};

/**
 * A minimal graph with the legend and link labels hidden, leaving just the nodes and edges.
 */
export const Minimal: Story = {
  args: { showLegend: false, showLinkLabels: false },
};
