import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Arbitrary from "effect/Arbitrary";
import { ScreenActivityCoverage, ScreenActivitySource } from "../../beep/ScreenActivity.ts";

const isScreenActivitySource = S.is(ScreenActivitySource);
const encodeScreenActivityCoverage = S.encodeEffect(ScreenActivityCoverage);

const fails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const decode = <A extends S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

describe("ScreenActivity", () => {
  it("fills the source and completeness defaults at construction", () => {
    const coverage = ScreenActivityCoverage.make({ rowLimit: 1, truncated: false });
    expect(coverage.source).toBe("synced_screen_activity");
    expect(coverage.captureCompleteness).toBe("unknown");
    expect(O.isNone(coverage.firstObservedAt)).toBe(true);
    expect(isScreenActivitySource("memory")).toBe(false);
  });

  it("treats missing and null observed-at strings as absent and keeps present strings", () => {
    const missing = decode(ScreenActivityCoverage, {
      source: "synced_screen_activity",
      rowLimit: 1,
      truncated: false,
      captureCompleteness: "unknown",
    });
    const nulled = decode(ScreenActivityCoverage, {
      source: "synced_screen_activity",
      rowLimit: 2,
      truncated: true,
      firstObservedAt: null,
      lastObservedAt: null,
      captureCompleteness: "unknown",
    });
    const present = decode(ScreenActivityCoverage, {
      source: "synced_screen_activity",
      rowLimit: 3,
      truncated: false,
      firstObservedAt: "2020-01-02 03:04:05",
      lastObservedAt: "later",
      captureCompleteness: "unknown",
    });
    expect(O.isNone(missing.firstObservedAt)).toBe(true);
    expect(O.isNone(nulled.lastObservedAt)).toBe(true);
    expect(O.isSome(present.firstObservedAt) && present.firstObservedAt.value).toBe("2020-01-02 03:04:05");
    expect(fails(ScreenActivityCoverage, {
      source: "synced_screen_activity",
      rowLimit: 0,
      truncated: false,
      captureCompleteness: "unknown",
    })).toBe(true);
  });

  it("encodes an absent timestamp as null and builds an arbitrary", () => {
    const decoded = decode(ScreenActivityCoverage, {
      source: "synced_screen_activity",
      rowLimit: 1,
      truncated: false,
      captureCompleteness: "unknown",
    });
    const encoded = Effect.runSync(encodeScreenActivityCoverage(decoded));
    expect(encoded.firstObservedAt).toBeNull();
    expect(Arbitrary.isArbitrary(ScreenActivityCoverage.pipe(Arbitrary.schema))).toBe(true);
  });
});
