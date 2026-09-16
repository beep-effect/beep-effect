import { afterEach, describe, expect, it } from "@effect/vitest";
import { cleanup, fireEvent, render, within } from "@testing-library/react";
import * as A from "effect/Array";
import { SessionDemo } from "@/components/SessionDemo";
import { TodoxAtomProvider } from "@/runtime/TodoxAtomProvider";

afterEach(cleanup);

const renderDemo = () =>
  render(
    <TodoxAtomProvider>
      <SessionDemo />
    </TodoxAtomProvider>
  );

const rowButtons = (container: HTMLElement): ReadonlyArray<HTMLButtonElement> =>
  A.fromIterable(container.querySelectorAll<HTMLButtonElement>("button[data-row]"));

describe("record inspector", () => {
  it("renders the rejected candidate open without any interaction", () => {
    const { container } = renderDemo();

    const inspector = within(container).getByRole("region", { name: "Record inspector: CLM 0104" });
    expect(within(inspector).getByText("REJECTED")).toBeDefined();
    expect(within(inspector).getByText(/Not supported by span S3\./)).toBeDefined();
  });

  it("moves the cursor with the arrow keys, opens with Enter, closes with Escape", () => {
    const { container } = renderDemo();
    const [first, second] = rowButtons(container);
    if (first === undefined || second === undefined) {
      throw new Error("expected at least two record rows");
    }

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowDown" });
    expect(document.activeElement).toBe(second);

    fireEvent.keyDown(second, { key: "ArrowUp" });
    expect(document.activeElement).toBe(first);

    fireEvent.click(first);
    expect(first.getAttribute("aria-expanded")).toBe("true");
    expect(within(container).getByRole("region", { name: "Record inspector: CLM 0101" })).toBeDefined();

    fireEvent.keyDown(first, { key: "Escape" });
    expect(within(container).queryByRole("region", { name: /Record inspector/ })).toBeNull();
    expect(within(container).getByText(/INSPECTOR CLOSED/)).toBeDefined();
  });
});
