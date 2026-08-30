import { AiMetricsSourceDiscoveryInput } from "@beep/repo-ai-metrics/source-discovery";
import { describe, expect, it } from "@effect/vitest";
import { Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeSourceDiscoveryInput = S.decodeUnknownResult(AiMetricsSourceDiscoveryInput);
const encodeSourceDiscoveryInput = S.encodeUnknownResult(AiMetricsSourceDiscoveryInput);

const validInput = {
  homeDir: "/home/dev",
  repoRoot: "/repo",
};

describe("AI metrics source discovery schemas", () => {
  it("defaults the scan bound through the schema", () => {
    const decoded = Result.getOrThrow(decodeSourceDiscoveryInput(validInput));

    expect(decoded.includeAll).toBe(false);
    expect(decoded.maxFiles).toBe(200);
    expect(decoded.hashSalt).toEqual(O.none());
    expect(decoded.maxFileBytes).toEqual(O.none());
    expect(Result.getOrThrow(encodeSourceDiscoveryInput(decoded))).not.toHaveProperty("hashSalt");
  });

  it("rejects negative and fractional scan bounds", () => {
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, maxFiles: -1 }))).toBe(true);
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, maxFiles: 1.5 }))).toBe(true);
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, maxFileBytes: -1 }))).toBe(true);
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, maxFileBytes: 1.5 }))).toBe(true);
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, sinceEpochMillis: -1 }))).toBe(true);
    expect(Result.isFailure(decodeSourceDiscoveryInput({ ...validInput, sinceEpochMillis: 1.5 }))).toBe(true);
  });
});
