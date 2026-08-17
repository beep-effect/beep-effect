import { PosInt } from "@beep/schema/Int";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { describe, expect, it } from "@effect/vitest";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { BackpressureConfig } from "../../Cluster/BackpressureHandler.ts";

const decodeConfig = S.decodeUnknownResult(BackpressureConfig);

describe("BackpressureConfig", () => {
  it("decodes canonical defaults without failing at module initialization", () => {
    const config = Result.getOrThrow(decodeConfig({}));

    expect(config.maxQueuedEvents).toBe(1000);
    expect(config.samplingThreshold).toBe(0.8);
    expect(config.samplingRate).toBe(0.1);
    expect(S.is(PosInt)(config.maxQueuedEvents)).toBe(true);
    expect(UnitInterval.is(config.samplingThreshold)).toBe(true);
    expect(UnitInterval.is(config.samplingRate)).toBe(true);
  });

  it("rejects invalid capacities and sampling ratios", () => {
    expect(Result.isFailure(decodeConfig({ maxQueuedEvents: 0 }))).toBe(true);
    expect(Result.isFailure(decodeConfig({ maxQueuedEvents: 1.5 }))).toBe(true);
    expect(Result.isFailure(decodeConfig({ samplingThreshold: -0.1 }))).toBe(true);
    expect(Result.isFailure(decodeConfig({ samplingThreshold: 1.1 }))).toBe(true);
    expect(Result.isFailure(decodeConfig({ samplingRate: -0.1 }))).toBe(true);
    expect(Result.isFailure(decodeConfig({ samplingRate: 1.1 }))).toBe(true);
  });
});
