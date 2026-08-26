import { beep } from "@beep/brand";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { App } from "@/App";

describe("@beep/trustgraph-workbench", () => {
  it("renders the branded shell", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "Beep Graph" })).toBeDefined();
    expect(screen.getByRole("img", { name: beep.mark.name })).toBeDefined();
  });

  it("hoists the brand favicon set and theme color into the document head", () => {
    render(<App />);

    // Vite serves small assets as data URIs and larger ones by hashed path; both are valid icon hrefs.
    expect(document.head.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute("href")).toMatch(
      /favicon\.svg$|^data:image\/svg\+xml/
    );
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      beep.dark.brand["900"]
    );
  });
});
