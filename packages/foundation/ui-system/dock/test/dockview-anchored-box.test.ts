import { AnchoredBox } from "@beep/dock";
import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";

const decodeUnknownAnchoredBoxResult = S.decodeUnknownResult(AnchoredBox);

describe("Dockview AnchoredBox", () => {
  it("decodes persisted boxes without an explicit tag", () => {
    expect(decodeUnknownAnchoredBoxResult({ left: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 },
    });
    expect(decodeUnknownAnchoredBoxResult({ right: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopRight", right: 1, top: 2, width: 3, height: 4 },
    });
    expect(decodeUnknownAnchoredBoxResult({ bottom: 1, left: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "BottomLeft", bottom: 1, left: 2, width: 3, height: 4 },
    });
    expect(decodeUnknownAnchoredBoxResult({ bottom: 1, right: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "BottomRight", bottom: 1, right: 2, width: 3, height: 4 },
    });
  });

  it("preserves explicit tags when decoding current boxes", () => {
    expect(decodeUnknownAnchoredBoxResult({ _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 },
    });
  });
});
