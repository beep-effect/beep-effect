import { describe, expect, it } from "@effect/vitest";
import { createMemoryHistory, createRouter, RouterProvider } from "@tanstack/react-router";
import * as Effect from "effect/Effect";
import { renderToString } from "react-dom/server";
import { routeTree } from "../generated/routeTree.gen";

describe("root route", () => {
  it.effect("server-renders the document shell around the home page", () =>
    Effect.gen(function* () {
      const router = createRouter({
        routeTree,
        history: createMemoryHistory({ initialEntries: ["/"] }),
      });
      yield* Effect.promise(() => router.load());

      const html = renderToString(<RouterProvider router={router} />);

      expect(html).toContain('<html lang="en">');
      expect(html).toContain("<title>beep-effect</title>");
      expect(html).toContain("<h1>beep-effect</h1>");
    })
  );
});
