import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { AutoModelPick } from "../../beep/AutoModel.ts";

const decodeAutoModelPick = S.decodeUnknownEffect(AutoModelPick);

describe("AutoModel", () => {
  it("builds an arbitrary value", () => {
    assert.notStrictEqual(AutoModelPick.pipe(Arbitrary.schema), undefined);
  });

  it("keeps the refresh time as unix seconds", () => {
    const input: unknown = {
      provider: "geminiFlashLive",
      updatedAt: 1_700_000_000,
      detail: { reason: "quality", scores: { geminiFlashLive: 1 } },
      attribution: "https://artificialanalysis.ai/",
    };
    const decoded = Effect.runSync(decodeAutoModelPick(input));
    assert.strictEqual(decoded.updatedAt, 1_700_000_000);
    assert.strictEqual(decoded.detail.reason, "quality");
  });
});
