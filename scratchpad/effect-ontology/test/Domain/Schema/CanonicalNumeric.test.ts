import { Confidence } from "@beep/epistemic-domain/values/EvidenceSpan";
import { describe, expect, it } from "@effect/vitest";
import { Redacted } from "effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { TerminationCondition } from "../../../Domain/Model/Agent.ts";
import { PostgresConfig } from "../../../Runtime/Persistence/PostgresLayer.ts";
import { RefinementConfig, RefinementResult } from "../../../Service/Agent/types.ts";
import { ReasoningConfig, ReasoningResult } from "../../../Service/Reasoner.ts";
const decodeConfidenceResult = S.decodeResult(Confidence);
const decodePostgresConfigResult = S.decodeResult(PostgresConfig);
const decodeReasoningConfigResult = S.decodeResult(ReasoningConfig);
const decodeReasoningResultResult = S.decodeResult(ReasoningResult);
const decodeRefinementConfigResult = S.decodeResult(RefinementConfig);
const decodeRefinementResultResult = S.decodeResult(RefinementResult);
const decodeTerminationConditionResult = S.decodeResult(TerminationCondition);

describe("canonical numeric boundaries", () => {
  it("rejects zero or fractional positive iteration limits", () => {
    expect(Result.isFailure(decodeTerminationConditionResult({ maxIterations: 0 }))).toBe(true);
    expect(Result.isFailure(decodeReasoningConfigResult({ maxIterations: 1.5 }))).toBe(true);
  });

  it("rejects negative workflow counts", () => {
    const result = decodeReasoningResultResult({
      inferredTripleCount: -1,
      totalTripleCount: 1,
      rulesApplied: 0,
      durationMs: 0,
    });

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects confidence and similarity values outside the unit interval", () => {
    const result = decodeConfidenceResult(1.1);

    expect(Result.isFailure(result)).toBe(true);
  });

  it("rejects fractional timeout and violation counts", () => {
    expect(
      Result.isFailure(decodeRefinementConfigResult({ maxIterations: 5, stopOnConformance: true, timeoutMs: 1.5 }))
    ).toBe(true);
    expect(
      Result.isFailure(
        decodeRefinementResultResult({
          graph: {},
          iterations: 0,
          status: "conformant",
          durationMs: 0,
          violationsFixed: [-1, 1.5],
        })
      )
    ).toBe(true);
  });

  it("rejects transport ports outside the canonical range", () => {
    const result = decodePostgresConfigResult({
      host: "localhost",
      port: 70_000,
      database: "workflow",
      username: "workflow",
      password: Redacted.make("secret"),
      ssl: false,
    });

    expect(Result.isFailure(result)).toBe(true);
  });
});
