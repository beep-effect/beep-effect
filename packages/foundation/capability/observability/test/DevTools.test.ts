import { DevToolsSpanFilter, LayerFilteredDevToolsOptions } from "@beep/observability/server";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { describe, expect, it } from "vitest";

describe("DevTools", () => {
  it("models span filters and layer options as executable schemas", () => {
    const shouldPublish = DevToolsSpanFilter.implementSync((name) => name === "Http.server");
    const options = {
      shouldPublish,
      url: "ws://localhost:34437",
    };

    expect(shouldPublish("Http.server")).toBe(true);
    expect(shouldPublish("Sql.query")).toBe(false);
    expect(O.isSome(S.decodeOption(DevToolsSpanFilter)(shouldPublish))).toBe(true);
    expect(O.isSome(S.decodeOption(LayerFilteredDevToolsOptions)(options))).toBe(true);
  });
});
