import { beep } from "@beep/brand";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { render, screen } from "@testing-library/react";
import { App } from "@/App";

describe("@beep/trustgraph-workbench", () => {
  it("renders the branded shell", ({ onTestFinished }) => {
    const view = render(<App />);
    onTestFinished(() => {
      try {
        view.unmount();
      } finally {
        view.container.remove();
      }
    });

    expect(screen.getByRole("heading", { name: "Beep Graph" })).toBeDefined();
    expect(screen.getByRole("img", { name: beep.mark.name })).toBeDefined();
  });

  it("hoists the brand favicon set and theme color into the document head", ({ onTestFinished }) => {
    const view = render(<App />);
    onTestFinished(() => {
      try {
        view.unmount();
      } finally {
        view.container.remove();
      }
    });

    // Vite serves small assets as data URIs and larger ones by hashed path; both are valid icon hrefs.
    expect(document.head.querySelector('link[rel="icon"][type="image/svg+xml"]')?.getAttribute("href")).toMatch(
      /favicon\.svg$|^data:image\/svg\+xml/
    );
    expect(document.head.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe(
      beep.dark.brand["900"]
    );
  });
});
