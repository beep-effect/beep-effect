import "@testing-library/jest-dom/vitest";
import { RegistryProvider } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Logger from "effect/Logger";
import * as References from "effect/References";
import { afterEach, describe, expect, vi } from "vitest";
import { SurfaceBoundary } from "@/App";
import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime";

// A child that throws for its first `limit` renders, then renders healthy —
// the deterministic stand-in for a surface tripped by a transient crash
// (e.g. the upstream MUI X StrictMode disposable bug during dock moves).
const makeCrashingChild = (limit: number, message = "surface boom", onRender: () => void = () => undefined) => {
  const state = { count: 0 };
  const CrashingChild = (): React.JSX.Element => {
    onRender();
    if (state.count < limit) {
      state.count += 1;
      throw new Error(message);
    }
    return <div data-testid="healed">healed</div>;
  };
  return CrashingChild;
};

describe("SurfaceBoundary", { concurrent: false }, () => {
  // Expected recoverable render errors from the crashing children are
  // filtered at the vitest-config level (onUnhandledError); the console.error
  // spies below keep React's boundary logging out of the output.
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
    const onRender = vi.fn();
    const AlwaysCrashing = makeCrashingChild(Number.POSITIVE_INFINITY, "surface boom", onRender);
    const { container } = render(
      <SurfaceBoundary label="Ontology">
        <AlwaysCrashing />
      </SurfaceBoundary>
    );
    const screen = within(container);

    expect(screen.getByText(/The Ontology surface crashed while rendering/)).toBeInTheDocument();
    const reload = screen.getByRole("button", { name: "Reload Ontology" });
    const rendersBeforeReload = onRender.mock.calls.length;
    // React may replay the first failed concurrent render once before handing
    // it to the boundary; the application itself performs only two remounts.
    expect(rendersBeforeReload).toBeLessThanOrEqual(8);

    // Reload restarts the cycle; a still-crashing surface lands back on the
    // card instead of looping forever.
    fireEvent.click(reload);
    expect(screen.getByRole("button", { name: "Reload Ontology" })).toBeInTheDocument();
    expect(onRender.mock.calls.length - rendersBeforeReload).toBeLessThanOrEqual(8);
  });

  it.effect(
    "reports one sanitized cause after bounded retries are exhausted",
    Effect.fnUntraced(function* () {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      const annotations: Array<Record<string, unknown>> = [];
      const logger = Logger.make<unknown, void>((options) => {
        annotations.push({ ...options.fiber.getRef(References.CurrentLogAnnotations) });
      });
      const AlwaysCrashing = makeCrashingChild(
        Number.POSITIVE_INFINITY,
        "token=private-value at /home/operator/workspace"
      );
      const { container } = render(
        <RegistryProvider initialValues={[[professionalBrowserRuntime.layer, Logger.layer([logger])]]}>
          <SurfaceBoundary label="Ontology">
            <AlwaysCrashing />
          </SurfaceBoundary>
        </RegistryProvider>
      );

      expect(within(container).getByRole("button", { name: "Reload Ontology" })).toBeInTheDocument();
      yield* Effect.tryPromise(() => waitFor(() => expect(annotations).toHaveLength(1)));
      expect(annotations[0]?.["professional_desktop.renderer.source"]).toBe("workspace");
      expect(annotations[0]?.cause_message).not.toContain("private-value");
      expect(annotations[0]?.cause_detail).not.toContain("/home/operator");
    })
  );

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
