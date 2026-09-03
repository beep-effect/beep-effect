import "@testing-library/jest-dom/vitest";
import { RegistryProvider } from "@effect/atom-react";
import { it } from "@effect/vitest";
import { cleanup, render, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach, describe, expect, vi } from "vitest";
import { CosmosSpike } from "@/spikes/CosmosSpike";

describe("Cosmos spike runtime failure", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.effect(
    "surfaces and redacts a worker-construction failure instead of remaining in rendering state",
    Effect.fnUntraced(function* () {
      class FailingWorker {
        constructor() {
          throw new Error("token=cosmos-worker-secret at /home/operator/CosmosSpike.worker.ts");
        }
      }
      vi.stubGlobal("Worker", FailingWorker);

      const { container } = render(
        <RegistryProvider>
          <CosmosSpike />
        </RegistryProvider>
      );
      const screen = within(container);

      expect(
        yield* Effect.promise(() => screen.findByText("failed", undefined, { timeout: 5_000 }))
      ).toBeInTheDocument();
      expect(container.textContent).not.toContain("cosmos-worker-secret");
      expect(container.textContent).not.toContain("/home/operator");
    })
  );
});
