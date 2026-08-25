import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";

describe("@beep/semantica", () => {
  it("renders the desktop shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "@beep/semantica" })).toBeDefined();
  });
});
