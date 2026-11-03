import { CatalogSource, EffortLevel, ModelId, UpstreamCatalog } from "@beep/ai-sync/ModelCatalog.schemas";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

describe("ModelCatalog.schemas", () => {
  it("guards model identifiers, effort levels, and catalog sources", () => {
    expect(S.is(ModelId)("claude-opus-5-5")).toBe(true);
    expect(S.is(ModelId)("")).toBe(false);
    expect(S.is(EffortLevel)("medium")).toBe(true);
    expect(S.is(EffortLevel)("turbo")).toBe(false);
    expect(S.is(CatalogSource)("router-for-me")).toBe(true);
  });

  it.effect("decodes an upstream catalog whose optional fields arrive as null and keeps unknown keys", () =>
    Effect.gen(function* () {
      const catalog = yield* S.decodeEffect(S.fromJsonString(UpstreamCatalog))(
        '{"claude":[{"id":"claude-opus-5-5","owned_by":null,"vendor_extra":1}]}'
      );
      expect(catalog.claude?.[0]?.id).toBe("claude-opus-5-5");
      expect(catalog.claude?.[0]?.vendor_extra).toBe(1);
    })
  );
});
