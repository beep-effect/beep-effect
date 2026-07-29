import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { act, cleanup, render, waitFor, within } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, describe, expect, vi } from "vitest";

interface PendingRender {
  readonly id: string;
  readonly promise: Promise<{ readonly svg: string }>;
  readonly resolve: (result: { readonly svg: string }) => void;
  readonly source: string;
}

const mermaidStub = vi.hoisted(() => {
  const pending = new Map<string, PendingRender>();
  return {
    initialize: vi.fn(),
    parse: vi.fn(() => Promise.resolve(true)),
    pending,
    render: vi.fn((id: string, source: string) => {
      const current = pending.get(source);
      if (current?.id === id) return current.promise;
      const deferred = Promise.withResolvers<{ readonly svg: string }>();
      pending.set(source, { id, promise: deferred.promise, resolve: deferred.resolve, source });
      return deferred.promise;
    }),
  };
});

vi.mock("mermaid", () => ({
  default: {
    initialize: mermaidStub.initialize,
    parse: mermaidStub.parse,
    render: mermaidStub.render,
  },
}));

import { MermaidView } from "@beep/editor/mermaid-view";

describe("Mermaid async ownership", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    mermaidStub.pending.clear();
    vi.clearAllMocks();
  });

  it.effect(
    "does not let an obsolete same-prefix, same-length render overwrite the current source",
    Effect.fnUntraced(function* () {
      const prefix = `graph TD\n${"A".repeat(80)}`;
      const first = `${prefix}\nX-->Y`;
      const second = `${prefix}\nP-->Q`;
      expect(first.length).toBe(second.length);

      const view = render(<MermaidView renderKey="replacement-race" source={first} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(first)).toBe(true)));
      const firstRender = mermaidStub.pending.get(first);
      expect(firstRender).toBeDefined();

      view.rerender(<MermaidView renderKey="replacement-race" source={second} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(second)).toBe(true)));
      const secondRender = mermaidStub.pending.get(second);
      expect(secondRender).toBeDefined();
      expect(firstRender?.id).not.toBe(secondRender?.id);

      yield* Effect.sync(() => {
        act(() => secondRender?.resolve({ svg: '<svg data-source="second"></svg>' }));
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("svg")).toHaveAttribute(
            "data-source",
            "second"
          )
        )
      );

      yield* Effect.sync(() => {
        act(() => firstRender?.resolve({ svg: '<svg data-source="first"></svg>' }));
      });
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByTestId("mermaid-diagram").querySelector("svg")).toHaveAttribute(
            "data-source",
            "second"
          )
        )
      );
    })
  );

  it.effect(
    "leaves no sink behind when an obsolete render resolves after unmount",
    Effect.fnUntraced(function* () {
      const source = "graph TD\nUnmount-->Done";
      const view = render(<MermaidView renderKey="unmount-race" source={source} />);
      yield* Effect.promise(() => waitFor(() => expect(mermaidStub.pending.has(source)).toBe(true)));
      const pending = mermaidStub.pending.get(source);

      view.unmount();
      yield* Effect.sync(() => {
        act(() => pending?.resolve({ svg: '<svg data-after-unmount="no"></svg>' }));
      });
      yield* Effect.yieldNow;

      expect(view.container).toBeEmptyDOMElement();
    })
  );
});
