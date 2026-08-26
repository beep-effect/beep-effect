// @vitest-environment jsdom
import { beep } from "@beep/brand";
import { BeepMark, BeepWordmark } from "@beep/brand/react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

describe("BeepMark", () => {
  it("renders the five mark paths inside a labelled svg", () => {
    const { container } = render(<BeepMark className="size-8" />);
    const svg = screen.getByRole("img", { name: beep.mark.name });

    expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
    expect(svg.getAttribute("class")).toBe("size-8");
    expect(container.querySelectorAll("path")).toHaveLength(5);
    expect(container.querySelector("g")?.getAttribute("transform")).toBe(
      "translate(5.4, 9.5) scale(0.52) rotate(8 12.5 2.5)"
    );
  });
});

describe("BeepWordmark", () => {
  it("renders the brand name beside a hidden mark", () => {
    const { container } = render(<BeepWordmark />);

    expect(screen.getByText(beep.name)).toBeDefined();
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });
});
