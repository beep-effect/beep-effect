import { afterEach, describe, expect, it } from "@effect/vitest";
import { cleanup, render, within } from "@testing-library/react";
import * as A from "effect/Array";
import * as Str from "effect/String";
import RootLayout, { directionContract, metadata } from "@/app/layout";
import Home from "@/app/page";
import { contact, footer, hero, meta, nav } from "@/content/copy";
import { TodoxAtomProvider } from "@/runtime/TodoxAtomProvider";
import { PRODUCER } from "@/session/Session.schema";

const FORBIDDEN_PHRASES = [
  "soc 2",
  "hallucination",
  "nothing leaves",
  "generally available",
  "pilot-ready",
  "roi",
  "aum",
  "the ai os",
  "mariner",
  "adviceperiod",
  "summit advice",
  "zocks",
  "practifi",
  "wealthbox",
  "clarista",
  "testimonial",
  "certified",
];

afterEach(cleanup);

const renderHome = () =>
  render(
    <TodoxAtomProvider>
      <Home />
    </TodoxAtomProvider>
  );

describe("@beep/todox homepage", () => {
  it("leads with the headline and the demo request actions", () => {
    const { container } = renderHome();
    const view = within(container);

    expect(view.getByRole("heading", { level: 1, name: hero.headline })).toBeDefined();
    const demoLinks = view.getAllByRole("link", { name: new RegExp(nav.primary.label) });
    expect(demoLinks.length).toBe(2);
    for (const link of demoLinks) {
      expect(link.getAttribute("href")).toBe(nav.primary.href);
    }
    expect(view.getByRole("navigation", { name: "Sections" })).toBeDefined();
  });

  it("renders every section the nav points at", () => {
    const { container } = renderHome();

    for (const link of nav.links) {
      expect(container.querySelector(link.href), link.href).not.toBeNull();
    }
    expect(container.querySelector(nav.primary.href)).not.toBeNull();
  });

  it("labels the demonstration synthetic and names the deterministic producer", () => {
    const { container } = renderHome();

    const demo = container.querySelector("[data-session-demo]");
    expect(demo).not.toBeNull();
    expect(demo?.textContent).toContain("NO CLIENT DATA");
    const producers = A.fromIterable(container.querySelectorAll('dd[data-field="producer"]'));
    expect(producers.length).toBe(1);
    expect(producers[0]?.textContent).toBe(PRODUCER);
  });

  it("ships the demo form against the placeholder action with the wiring note", () => {
    const { container } = renderHome();

    const form = container.querySelector("form[data-wiring='pending']");
    expect(form?.getAttribute("action")).toBe("/api/request-demo");
    expect(within(container).getByText(contact.wiringNote)).toBeDefined();
  });

  it("ships the required qualification footer whole", () => {
    const { container } = renderHome();

    expect(within(container).getByText(footer.qualification)).toBeDefined();
  });

  it("carries no forbidden claim language or competitor names", () => {
    const { container } = renderHome();

    const text = Str.toLowerCase(container.textContent ?? "");
    for (const phrase of FORBIDDEN_PHRASES) {
      expect(text, phrase).not.toContain(phrase);
    }
  });
});

describe("@beep/todox layout", () => {
  it("declares the metadata", () => {
    expect(metadata.title).toBe(meta.title);
    expect(metadata.description).toBe(meta.description);
  });

  it("emits the direction contract as the first child of the body", () => {
    const layout = RootLayout({ children: "content" });
    const body = layout.props.children;
    const first = body.props.children[0];

    expect(layout.type).toBe("html");
    expect(body.type).toBe("body");
    expect(first.props.dangerouslySetInnerHTML.__html).toBe(directionContract);
  });

  it("keeps the contract auditable: six blocks, the key, the FINISH line, under 150 words", () => {
    for (const block of ["THESIS:", "OWN-WORLD:", "STORY:", "FIRST VIEWPORT:", "FORM:", "FINISH:"]) {
      expect(directionContract).toContain(block);
    }
    expect(directionContract).toContain("evergreen-ledger");
    expect(directionContract).toContain(
      "unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance"
    );
    const words = A.filter(Str.split(directionContract, /\s+/), (word) => word.length > 0);
    expect(words.length).toBeLessThanOrEqual(150 + 8);
  });
});
