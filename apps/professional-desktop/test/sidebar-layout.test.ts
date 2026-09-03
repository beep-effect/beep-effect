import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { AtomRegistry } from "effect/unstable/reactivity";
import {
  clampSidebarPercent,
  persistSidebarLayoutAtom,
  SIDEBAR_DEFAULT_PERCENT,
  SIDEBAR_MAX_PERCENT,
  SIDEBAR_MIN_PERCENT,
  SidebarPercent,
  sidebarPercentAtom,
  sidebarSize,
} from "@/chat/ui/layout.atoms";

const decodeSidebarPercent = S.decodeUnknownOption(SidebarPercent);

describe("the width the user gave the sidebar", () => {
  it("is handed back unchanged when it is a width the panes allow", () => {
    expect(clampSidebarPercent(SIDEBAR_DEFAULT_PERCENT)).toBe(SIDEBAR_DEFAULT_PERCENT);
    expect(O.getOrUndefined(decodeSidebarPercent(SIDEBAR_DEFAULT_PERCENT))).toBe(SIDEBAR_DEFAULT_PERCENT);
  });

  it("cannot restore a sidebar too wide to drag back", () => {
    // The stored value outlives the build that wrote it. A width persisted before the
    // bounds existed — or typed into localStorage by hand — must not be able to hand
    // the user a pane they cannot recover from.
    expect(clampSidebarPercent(95)).toBe(SIDEBAR_MAX_PERCENT);
    expect(O.isNone(decodeSidebarPercent(95))).toBe(true);
  });

  it("cannot restore a sidebar collapsed past its minimum", () => {
    expect(clampSidebarPercent(0)).toBe(SIDEBAR_MIN_PERCENT);
    expect(O.isNone(decodeSidebarPercent(0))).toBe(true);
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

describe("completed sidebar layouts", () => {
  it.effect(
    "persist only completed user interactions through the storage runtime",
    Effect.fnUntraced(function* () {
      localStorage.clear();
      const registry = AtomRegistry.make();
      registry.mount(sidebarPercentAtom);
      registry.mount(persistSidebarLayoutAtom);

      registry.set(persistSidebarLayoutAtom, {
        layout: { "sidebar-pane": 31, "main-pane": 69 },
        isUserInteraction: false,
      });
      yield* AtomRegistry.getResult(registry, persistSidebarLayoutAtom);
      expect(registry.get(sidebarPercentAtom)).toBe(SIDEBAR_DEFAULT_PERCENT);

      registry.set(persistSidebarLayoutAtom, {
        layout: { "sidebar-pane": 31, "main-pane": 69 },
        isUserInteraction: true,
      });
      yield* AtomRegistry.getResult(registry, persistSidebarLayoutAtom);
      expect(registry.get(sidebarPercentAtom)).toBe(31);

      registry.dispose();
    })
  );
});
