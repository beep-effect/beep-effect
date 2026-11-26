import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import * as S from "effect/Schema";
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
import { SidebarLayoutChanged } from "../src/chat/ui/layout.atoms.ts";

const decodeSidebarPercent = S.decodeUnknownOption(SidebarPercent);

describe("the width the user gave the sidebar", () => {
  it("is handed back unchanged when it is a width the panes allow", () => {
    expect(clampSidebarPercent(SIDEBAR_DEFAULT_PERCENT)).toBe(SIDEBAR_DEFAULT_PERCENT);
    expect(O.getOrUndefined(decodeSidebarPercent(SIDEBAR_DEFAULT_PERCENT))).toBe(SIDEBAR_DEFAULT_PERCENT);
  });

  it("cannot restore a sidebar too wide to drag back", () => {
    expect(
      clampSidebarPercent(95),
      "a width stored before the bounds existed, or typed in by hand, must not leave an unrecoverable pane"
    ).toBe(SIDEBAR_MAX_PERCENT);
    assertNone(decodeSidebarPercent(95));
  });

  it("cannot restore a sidebar collapsed past its minimum", () => {
    expect(clampSidebarPercent(0)).toBe(SIDEBAR_MIN_PERCENT);
    assertNone(decodeSidebarPercent(0));
  });
});

describe("the size the panes are given", () => {
  it("carries its unit", () => {
    expect(
      sidebarSize(SIDEBAR_DEFAULT_PERCENT),
      "react-resizable-panels reads a bare number as pixels, so the percent carries its unit"
    ).toBe(`${SIDEBAR_DEFAULT_PERCENT}%`);
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
      const registry = yield* Effect.acquireRelease(
        Effect.sync(() => AtomRegistry.make()),
        (registry) => Effect.sync(() => registry.dispose())
      );
      registry.mount(sidebarPercentAtom);
      registry.mount(persistSidebarLayoutAtom);

      registry.set(
        persistSidebarLayoutAtom,
        SidebarLayoutChanged.make({
          layout: { "sidebar-pane": 31, "main-pane": 69 },
          isUserInteraction: false,
        })
      );
      yield* AtomRegistry.getResult(registry, persistSidebarLayoutAtom);
      expect(registry.get(sidebarPercentAtom)).toBe(SIDEBAR_DEFAULT_PERCENT);

      registry.set(
        persistSidebarLayoutAtom,
        SidebarLayoutChanged.make({
          layout: { "sidebar-pane": 31, "main-pane": 69 },
          isUserInteraction: true,
        })
      );
      yield* AtomRegistry.getResult(registry, persistSidebarLayoutAtom);
      expect(registry.get(sidebarPercentAtom)).toBe(31);
    })
  );
});
