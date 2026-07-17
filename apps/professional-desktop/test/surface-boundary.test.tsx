import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SurfaceBoundary } from "@/App";

// A child that throws for its first `limit` renders, then renders healthy —
// the deterministic stand-in for a surface tripped by a transient crash
// (e.g. the upstream MUI X StrictMode disposable bug during dock moves).
const makeCrashingChild = (limit: number) => {
  const state = { count: 0 };
  const CrashingChild = (): React.JSX.Element => {
    if (state.count < limit) {
      state.count += 1;
      throw new Error("surface boom");
    }
    return <div data-testid="healed">healed</div>;
  };
  return CrashingChild;
};

describe("SurfaceBoundary", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("self-heals a surface that crashes twice, without showing the card", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const CrashingChild = makeCrashingChild(2);
    const { container } = render(
      <SurfaceBoundary label="Ontology">
        <CrashingChild />
      </SurfaceBoundary>
    );
    const screen = within(container);

    // Two crashes consume the self-heal budget; the third mount succeeds.
    expect(screen.getByTestId("healed")).toBeInTheDocument();
    expect(screen.queryByText(/crashed while rendering/)).toBeNull();
  });

  it("stops retrying after the budget and offers a manual reload", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const AlwaysCrashing = makeCrashingChild(Number.POSITIVE_INFINITY);
    const { container } = render(
      <SurfaceBoundary label="Ontology">
        <AlwaysCrashing />
      </SurfaceBoundary>
    );
    const screen = within(container);

    expect(screen.getByText(/The Ontology surface crashed while rendering/)).toBeInTheDocument();
    const reload = screen.getByRole("button", { name: "Reload Ontology" });

    // Reload restarts the cycle; a still-crashing surface lands back on the
    // card instead of looping forever.
    fireEvent.click(reload);
    expect(screen.getByRole("button", { name: "Reload Ontology" })).toBeInTheDocument();
  });

  it("renders healthy children transparently", () => {
    const { container } = render(
      <SurfaceBoundary label="Chat">
        <div data-testid="content">fine</div>
      </SurfaceBoundary>
    );
    const screen = within(container);

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByText(/crashed/)).toBeNull();
  });
});
