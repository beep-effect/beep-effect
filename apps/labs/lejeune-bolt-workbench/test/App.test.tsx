import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";

describe("@beep/lejeune-bolt-workbench", () => {
  it("renders the app shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "@beep/lejeune-bolt-workbench" })).toBeDefined();
  });
});
