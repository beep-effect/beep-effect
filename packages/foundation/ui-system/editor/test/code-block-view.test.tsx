// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { CodeBlockView } from "@beep/editor/code-block-view";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect, vi } from "@effect/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";

describe("code block clipboard", () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it.effect("copies the original source and clears its temporary copied state", () =>
    Effect.gen(function* () {
      const writeText = vi.fn(() => Promise.resolve());
      vi.stubGlobal("navigator", { clipboard: { writeText } });
      const code = "export const answer = 42;";
      render(<CodeBlockView code={code} language="typescript" />);
      fireEvent.click(screen.getByRole("button", { name: "Copy code" }));
      yield* Effect.promise(() => waitFor(() => expect(writeText).toHaveBeenCalledWith(code)));
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getByRole("button", { name: "Code copied" })).toBeVisible())
      );
      yield* Effect.promise(() =>
        waitFor(() => expect(screen.getByRole("button", { name: "Copy code" })).toBeVisible(), { timeout: 3_000 })
      );
      expect(writeText).toHaveBeenCalledTimes(1);
    })
  );
});
