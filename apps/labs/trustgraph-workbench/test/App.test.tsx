import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";

describe("@beep/trustgraph-workbench", () => {
  it("renders the app shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "@beep/trustgraph-workbench" })).toBeDefined();
  });
});
