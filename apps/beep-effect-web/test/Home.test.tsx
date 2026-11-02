import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Home } from "@/routes/index";

describe("@beep/beep-effect-web", () => {
  it("renders the starter page", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "beep-effect" })).toBeDefined();
  });
});
