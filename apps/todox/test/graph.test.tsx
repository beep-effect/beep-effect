import { afterEach, describe, expect, it } from "@effect/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { EvidenceGraph, graphEdges, graphNodes } from "@/components/EvidenceGraph";
import { TodoxAtomProvider } from "@/runtime/TodoxAtomProvider";

afterEach(cleanup);

const renderGraph = () =>
  render(
    <TodoxAtomProvider>
      <EvidenceGraph />
    </TodoxAtomProvider>
  );

describe("evidence graph", () => {
  it("wires every edge to a real node and opens on the core claim", () => {
    const ids = graphNodes.map((node) => node.id);
    for (const edge of graphEdges) {
      expect(ids, edge.from).toContain(edge.from);
      expect(ids, edge.to).toContain(edge.to);
    }
    const { container } = renderGraph();
    const detail = container.querySelector(".graph-detail");
    expect(detail?.textContent).toContain("CLM 0101");
    expect(detail?.textContent).toContain("ACCEPTED (SCOPED)");
  });

  it("selects a node by click and by keyboard, lighting its edges", () => {
    const { container } = renderGraph();
    const view = within(container);
    const superseded = view.getByRole("button", { name: /CLM 0099/ });

    fireEvent.click(superseded);
    expect(superseded.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".graph-detail")?.textContent).toContain("SUPERSEDED");
    const active = container.querySelectorAll(".graph__edge[data-active='true']");
    expect(active.length).toBe(2);

    const brief = view.getByRole("button", { name: /MEETING BRIEF/ });
    fireEvent.keyDown(brief, { key: "Enter" });
    expect(brief.getAttribute("aria-pressed")).toBe("true");
    expect(container.querySelector(".graph-detail")?.textContent).toContain("PKT 0501");
  });
});
