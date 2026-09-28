import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

describe("@beep/semantica", () => {
  it("renders the desktop shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "@beep/semantica" })).toBeDefined();
  });
});
