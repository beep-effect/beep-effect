import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RootLayout, { metadata } from "@/app/layout";
import Home from "@/app/page";

describe("@beep/todox", () => {
  it("renders the starter page", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "@beep/todox" })).toBeDefined();
  });

  it("declares the application metadata", () => {
    expect(metadata).toEqual({
      title: "@beep/todox",
      description: "Minimal Next.js app",
    });
  });

  it("renders the shared document shell", () => {
    const layout = RootLayout({ children: "content" });

    expect(layout.type).toBe("html");
    expect(layout.props.lang).toBe("en");
    expect(layout.props.children.type).toBe("body");
    expect(layout.props.children.props.children).toBe("content");
  });
});
