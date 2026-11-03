import "@testing-library/jest-dom/vitest";
import * as Graph3D from "@beep/graph-3d/browser";
import { it } from "@beep/test-runner";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, expect, vi } from "@effect/vitest";
import { cleanup, render, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { Graph3DSpike } from "@/spikes/Graph3DSpike";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it.effect(
  "surfaces a redacted renderer failure in the spike HUD",
  Effect.fnUntraced(function* () {
    vi.spyOn(Graph3D, "renderGraph3D").mockReturnValue(
      Effect.die(new Error("token=graph-render-secret at /home/operator/renderer.ts"))
    );
    const { container } = render(
      <RegistryProvider>
        <Graph3DSpike />
      </RegistryProvider>
    );
    const screen = within(container);
    const promise1 = yield* Effect.promise(() => screen.findByText(/error:/));
    expect(promise1).toBeInTheDocument();
    expect(container.textContent).not.toContain("graph-render-secret");
    expect(container.textContent).not.toContain("/home/operator");
    expect(screen.getByRole("button", { name: "run stress pass" })).toBeInTheDocument();
  })
);
