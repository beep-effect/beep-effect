/**
 * Mermaid rendering of the goals capability graph for `goals/INDEX.md`.
 *
 * **Details**
 *
 * A pure renderer over the same projection and answers every other graph
 * report reads, so the diagram cannot invent its own semantics:
 *
 * - Nodes are non-terminal packets (`active`, `paused`) that declare any
 *   capability edge, plus `fog:<capability>` nodes for required capabilities
 *   no buildable packet provides.
 * - Completed providers appear only as relic nodes when they still feed a
 *   non-terminal consumer. Every other completed packet collapses into one
 *   count line (decision G4): the diagram shows work, not history.
 * - Edges run provider → consumer, labelled with the capability. Solid edges
 *   are satisfied requirements; dashed edges are still blocked.
 * - A blocker table names, per blocked non-terminal packet, the capabilities
 *   it waits on.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import type { GoalStatus } from "./Goals.schemas.ts";
import type { CapabilityGraphAnswers, CapabilityProjection, GraphPacketRow } from "./Graph.schemas.ts";

const NON_TERMINAL: ReadonlyArray<GoalStatus> = ["active", "paused"];

const RENDERED_PROVIDER_STATUSES: ReadonlyArray<GoalStatus> = ["active", "paused", "completed-retained"];

const isNonTerminal = (packet: GraphPacketRow): boolean => A.contains(NON_TERMINAL, packet.status);

const nodeId = (slug: string): string => `p_${Str.replaceAll("-", "_")(slug)}`;

const fogId = (capability: string): string => `fog_${Str.replace(/[^a-z0-9]/g, "_")(capability)}`;

const quote = (text: string): string => `"${Str.replaceAll('"', "#quot;")(text)}"`;

/**
 * Renders the capability graph as a Markdown section with a Mermaid block and a blocker table.
 *
 * **Example** (Render an empty graph)
 *
 * ```ts
 * import { renderCapabilityMermaidSection } from "@beep/repo-cli/commands/Goals/Graph.mermaid"
 * import { evaluateCapabilityGraph } from "@beep/repo-cli/commands/Goals/Graph.projection"
 * import { CapabilityProjection } from "@beep/repo-cli/commands/Goals/Graph.schemas"
 *
 * const projection = CapabilityProjection.make({ packets: [], capabilities: [], provides: [], requires: [], duplicates: [] })
 * console.log(renderCapabilityMermaidSection(projection, evaluateCapabilityGraph(projection)))
 * ```
 *
 * @param projection - Compiled capability projection.
 * @param answers - Graph answers over the same projection.
 * @returns Markdown lines for the "Capability graph" section, newline-joined.
 * @category formatting
 * @since 0.0.0
 */
export const renderCapabilityMermaidSection: {
  (answers: CapabilityGraphAnswers): (projection: CapabilityProjection) => string;
  (projection: CapabilityProjection, answers: CapabilityGraphAnswers): string;
} = dual(2, (projection: CapabilityProjection, answers: CapabilityGraphAnswers): string => {
  const packetWhere = (slug: string, predicate: (packet: GraphPacketRow) => boolean): boolean =>
    O.exists(
      A.findFirst(projection.packets, (packet) => packet.packetId === slug),
      predicate
    );
  const liveRequires = A.filter(projection.requires, (edge) => packetWhere(edge.packetId, isNonTerminal));
  const declaresEdge = (slug: string) =>
    A.some(projection.provides, (edge) => edge.packetId === slug) ||
    A.some(projection.requires, (edge) => edge.packetId === slug);
  const liveNodes = A.filter(projection.packets, (packet) => isNonTerminal(packet) && declaresEdge(packet.packetId));
  const edges = A.flatMap(liveRequires, (requirement) =>
    pipe(
      projection.provides,
      // Only providers the diagram draws (live nodes or relics) get an edge; a
      // reference or superseded provider would otherwise become an undeclared node.
      A.filter(
        (provide) =>
          provide.capability === requirement.capability &&
          packetWhere(provide.packetId, (packet) => A.contains(RENDERED_PROVIDER_STATUSES, packet.status))
      ),
      A.map((provide) => ({
        provider: provide.packetId,
        consumer: requirement.packetId,
        capability: provide.capability,
      }))
    )
  );
  const relicSlugs = pipe(
    edges,
    A.map((edge) => edge.provider),
    A.dedupe,
    A.filter((slug) => packetWhere(slug, (packet) => packet.status === "completed-retained")),
    A.sort(Order.String)
  );
  const liveFog = pipe(
    liveRequires,
    A.map((edge) => edge.capability),
    A.filter((capability) => A.contains(answers.fog, capability)),
    A.dedupe,
    A.sort(Order.String)
  );
  const collapsed = A.length(
    A.filter(
      projection.packets,
      (packet) => packet.status === "completed-retained" && !A.contains(relicSlugs, packet.packetId)
    )
  );
  const blocked = pipe(
    liveNodes,
    A.map((packet) => ({
      slug: packet.packetId,
      waiting: pipe(
        liveRequires,
        A.filter((edge) => edge.packetId === packet.packetId && !A.contains(answers.available, edge.capability)),
        A.map((edge) => edge.capability)
      ),
    })),
    A.filter((row) => A.isReadonlyArrayNonEmpty(row.waiting))
  );

  const lines = [
    "",
    "## Capability graph",
    "",
    `Generated from \`provides\`/\`requires\` (nominal readiness). ${A.length(liveNodes)} live packets, ${A.length(relicSlugs)} relic providers, ${A.length(liveFog)} fog capabilities; ${collapsed} other completed packets collapsed. Query with \`bun run beep goals next|explain|catalog\`.`,
    "",
    "```mermaid",
    "flowchart LR",
    "  classDef active fill:#1f4d3a,stroke:#3fbf7f,color:#e8f5ee",
    "  classDef paused fill:#4d4a1f,stroke:#bfb33f,color:#f5f3e8",
    "  classDef relic fill:#2b2b2b,stroke:#777,color:#ccc",
    "  classDef fog fill:#3a1f1f,stroke:#bf3f3f,color:#f5e8e8,stroke-dasharray:4 3",
    ...A.map(liveNodes, (packet) => `  ${nodeId(packet.packetId)}[${quote(packet.packetId)}]:::${packet.status}`),
    ...A.map(relicSlugs, (slug) => `  ${nodeId(slug)}([${quote(slug)}]):::relic`),
    ...A.map(liveFog, (capability) => `  ${fogId(capability)}{{${quote(`fog:${capability}`)}}}:::fog`),
    ...A.map(edges, (edge) =>
      A.contains(answers.available, edge.capability)
        ? `  ${nodeId(edge.provider)} -->|${quote(edge.capability)}| ${nodeId(edge.consumer)}`
        : `  ${nodeId(edge.provider)} -.->|${quote(edge.capability)}| ${nodeId(edge.consumer)}`
    ),
    ...pipe(
      liveRequires,
      A.filter((edge) => A.contains(liveFog, edge.capability)),
      A.map((edge) => `  ${fogId(edge.capability)} -.-> ${nodeId(edge.packetId)}`)
    ),
    "```",
  ];
  const table = A.isReadonlyArrayEmpty(blocked)
    ? []
    : [
        "",
        "| Blocked packet | Waiting on |",
        "| --- | --- |",
        ...A.map(
          blocked,
          (row) =>
            `| [${row.slug}](./${row.slug}/README.md) | ${A.join(
              A.map(row.waiting, (cap) => `\`${cap}\``),
              ", "
            )} |`
        ),
      ];
  return A.join([...lines, ...table], "\n");
});
