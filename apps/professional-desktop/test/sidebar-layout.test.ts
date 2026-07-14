import { describe, expect, it } from "@effect/vitest";
import {
  clampSidebarPercent,
  SIDEBAR_DEFAULT_PERCENT,
  SIDEBAR_MAX_PERCENT,
  SIDEBAR_MIN_PERCENT,
  sidebarSize,
} from "@/chat/ui/layout.atoms";

describe("the width the user gave the sidebar", () => {
  it("is handed back unchanged when it is a width the panes allow", () => {
    expect(clampSidebarPercent(SIDEBAR_DEFAULT_PERCENT)).toBe(SIDEBAR_DEFAULT_PERCENT);
  });

  it("cannot restore a sidebar too wide to drag back", () => {
    // The stored value outlives the build that wrote it. A width persisted before the
    // bounds existed — or typed into localStorage by hand — must not be able to hand
    // the user a pane they cannot recover from.
    expect(clampSidebarPercent(95)).toBe(SIDEBAR_MAX_PERCENT);
  });

  it("cannot restore a sidebar collapsed past its minimum", () => {
    expect(clampSidebarPercent(0)).toBe(SIDEBAR_MIN_PERCENT);
  });
});

describe("the size the panes are given", () => {
  it("carries its unit", () => {
    // react-resizable-panels reads a bare `number` as PIXELS. Handing it these
    // percentages by their number pinned the sidebar into a fourteen-to-forty *pixel*
    // range — a sliver too narrow to read, with a handle that would not move.
    expect(sidebarSize(SIDEBAR_DEFAULT_PERCENT)).toBe(`${SIDEBAR_DEFAULT_PERCENT}%`);
    expect(sidebarSize(SIDEBAR_MIN_PERCENT)).toBe(`${SIDEBAR_MIN_PERCENT}%`);
    expect(sidebarSize(SIDEBAR_MAX_PERCENT)).toBe(`${SIDEBAR_MAX_PERCENT}%`);
  });

  it("is bounded before it is handed over", () => {
    expect(sidebarSize(95)).toBe(`${SIDEBAR_MAX_PERCENT}%`);
    expect(sidebarSize(0)).toBe(`${SIDEBAR_MIN_PERCENT}%`);
  });
});
