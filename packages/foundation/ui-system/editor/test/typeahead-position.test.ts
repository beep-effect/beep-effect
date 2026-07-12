import { shouldOpenUpward, typeaheadMenuPosition } from "@beep/editor/chat";
import { describe, expect, it } from "vitest";

describe("shouldOpenUpward", () => {
  it("opens downward when the full menu fits below the caret", () => {
    expect(shouldOpenUpward({ caretBottom: 120, caretTop: 100, viewportHeight: 800 })).toBe(false);
  });

  it("flips upward for a caret near the bottom of the viewport", () => {
    expect(shouldOpenUpward({ caretBottom: 780, caretTop: 760, viewportHeight: 800 })).toBe(true);
  });

  it("stays downward when there is no room in either direction", () => {
    expect(shouldOpenUpward({ caretBottom: 60, caretTop: 40, viewportHeight: 100 })).toBe(false);
  });
});

describe("typeaheadMenuPosition", () => {
  it("anchors below the caret with a gap when it fits", () => {
    expect(
      typeaheadMenuPosition({
        caret: { bottom: 120, left: 40, top: 100 },
        viewportHeight: 800,
        viewportWidth: 1280,
      })
    ).toStrictEqual({ left: 40, top: 124 });
  });

  it("anchors above the caret when the menu would spill past the viewport bottom", () => {
    expect(
      typeaheadMenuPosition({
        caret: { bottom: 720, left: 40, top: 700 },
        viewportHeight: 800,
        viewportWidth: 1280,
      })
    ).toStrictEqual({ left: 40, bottom: 104 });
  });

  it("clamps the menu inside the viewport horizontally", () => {
    expect(
      typeaheadMenuPosition({
        caret: { bottom: 120, left: 1270, top: 100 },
        viewportHeight: 800,
        viewportWidth: 1280,
      })
    ).toStrictEqual({ left: 1280 - 256 - 4, top: 124 });
  });
});
