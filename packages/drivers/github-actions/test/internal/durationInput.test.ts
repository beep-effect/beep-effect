import { ReadinessOptions } from "@beep/github-actions/DetachedProcess";
import { ClientLayerOptions } from "@beep/github-actions/GitHubToken";
import { DurationInput } from "@beep/github-actions/internal/durationInput";
import { ToolDownloadOptions } from "@beep/github-actions/ToolInstaller";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import * as Duration from "effect/Duration";
import * as S from "effect/Schema";

describe("internal/durationInput", () => {
  it("accepts every representation Effect reads as a Duration.Input", () => {
    for (const input of [Duration.seconds(5), 150, 5n, "150 millis", [1, 500], { seconds: 2 }]) {
      assertTrue(S.is(DurationInput)(input));
    }
  });

  it("rejects non-finite counts and shapes Effect does not read", () => {
    for (const input of [Number.NaN, Number.POSITIVE_INFINITY, [1], { seconds: "2" }, null, true]) {
      assertFalse(S.is(DurationInput)(input));
    }
  });

  it("gates the option bags that take a time budget", () => {
    assertTrue(S.is(ReadinessOptions)({ attempts: 3, interval: "20 millis" }));
    assertFalse(S.is(ReadinessOptions)({ interval: Number.NaN }));
    assertTrue(S.is(ToolDownloadOptions)({ timeout: Duration.minutes(5) }));
    assertFalse(S.is(ToolDownloadOptions)({ timeout: true }));
  });

  it("accepts a fetch replacement only when it is a function", () => {
    assertTrue(S.is(ClientLayerOptions)({ fetch: globalThis.fetch, retry: "off" }));
    assertFalse(S.is(ClientLayerOptions)({ fetch: "https://example.test" }));
  });
});
