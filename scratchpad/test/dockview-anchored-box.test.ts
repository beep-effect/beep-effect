import { describe, expect, it } from "@effect/vitest";
import * as S from "effect/Schema";
import { AnchoredBox } from "../dockview/Dockview.models.ts";

describe("Dockview AnchoredBox", () => {
  const decode = S.decodeUnknownResult(AnchoredBox);

  it("decodes persisted boxes without an explicit tag", () => {
    expect(decode({ left: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 },
    });
    expect(decode({ right: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopRight", right: 1, top: 2, width: 3, height: 4 },
    });
    expect(decode({ bottom: 1, left: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "BottomLeft", bottom: 1, left: 2, width: 3, height: 4 },
    });
    expect(decode({ bottom: 1, right: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "BottomRight", bottom: 1, right: 2, width: 3, height: 4 },
    });
  });

  it("preserves explicit tags when decoding current boxes", () => {
    expect(decode({ _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 })).toMatchObject({
      success: { _tag: "TopLeft", left: 1, top: 2, width: 3, height: 4 },
    });
  });
});
