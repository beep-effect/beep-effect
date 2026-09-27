import { AiMetricsSourceDiscoveryInput } from "@beep/repo-ai-metrics/source-discovery";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { pipe, Result } from "effect";
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

    pipe(decoded.includeAll, assertFalse);
    expect(decoded.maxFiles).toBe(200);
    assertNone(decoded.hashSalt);
    assertNone(decoded.maxFileBytes);
    expect(Result.getOrThrow(encodeSourceDiscoveryInput(decoded))).not.toHaveProperty("hashSalt");
  });

  it("rejects negative and fractional scan bounds", () => {
    pipe(decodeSourceDiscoveryInput({ ...validInput, maxFiles: -1 }), Result.isFailure, assertTrue);
    pipe(decodeSourceDiscoveryInput({ ...validInput, maxFiles: 1.5 }), Result.isFailure, assertTrue);
    pipe(decodeSourceDiscoveryInput({ ...validInput, maxFileBytes: -1 }), Result.isFailure, assertTrue);
    pipe(decodeSourceDiscoveryInput({ ...validInput, maxFileBytes: 1.5 }), Result.isFailure, assertTrue);
    pipe(decodeSourceDiscoveryInput({ ...validInput, sinceEpochMillis: -1 }), Result.isFailure, assertTrue);
    pipe(decodeSourceDiscoveryInput({ ...validInput, sinceEpochMillis: 1.5 }), Result.isFailure, assertTrue);
  });
});
