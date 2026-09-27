import { DevToolsSpanFilter, LayerFilteredDevToolsOptions } from "@beep/observability/server";
import { it } from "@beep/test-runner";
import { describe } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeDevToolsSpanFilterOption = S.decodeOption(DevToolsSpanFilter);
const decodeLayerFilteredDevToolsOptionsOption = S.decodeOption(LayerFilteredDevToolsOptions);

describe("DevTools", () => {
  it("models span filters and layer options as executable schemas", () => {
    const shouldPublish = DevToolsSpanFilter.implementSync((name) => name === "Http.server");
    const options = {
      shouldPublish,
      url: "ws://localhost:34437",
    };

    assertTrue(shouldPublish("Http.server"));
    assertFalse(shouldPublish("Sql.query"));
    pipe(decodeDevToolsSpanFilterOption(shouldPublish), O.isSome, assertTrue);
    pipe(decodeLayerFilteredDevToolsOptionsOption(options), O.isSome, assertTrue);
  });
});
