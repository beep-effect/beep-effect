import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

describe("@beep/lejeune-bolt-workbench", () => {
  it("renders the app shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "@beep/lejeune-bolt-workbench" })).toBeDefined();
  });
});
