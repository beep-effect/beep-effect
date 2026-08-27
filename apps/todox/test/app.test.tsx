import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/page";

describe("@beep/todox", () => {
  it("renders the starter page", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "@beep/todox" })).toBeDefined();
  });
});
