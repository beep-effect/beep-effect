import {
  Phoenix,
  PhoenixAnnotationInput,
  PhoenixConfigInput,
  PhoenixDatasetCreateInput,
  PhoenixDatasetExample,
} from "@beep/phoenix";
import { Redacted } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "tstyche";
import type {
  PhoenixAnnotationWriteResult,
  PhoenixDatasetCreateResult,
  PhoenixDoctorResult,
  PhoenixError,
  PhoenixSdkShape,
  PhoenixShape,
} from "@beep/phoenix";
import type { Effect, Layer } from "effect";

declare const phoenix: PhoenixShape;
declare const sdk: PhoenixSdkShape;

describe("Phoenix", () => {
  it("preserves layer and service method types", () => {
    expect(
      Phoenix.makeLayer(PhoenixConfigInput.make({ apiKey: O.some(Redacted.make("test-key")) }))
    ).type.toBeAssignableTo<Layer.Layer<Phoenix>>();
    expect(Phoenix.makeLayerWithSdk(sdk)).type.toBeAssignableTo<Layer.Layer<Phoenix>>();
    expect(Phoenix.layer).type.toBeAssignableTo<Layer.Layer<Phoenix, PhoenixError>>();

    expect(phoenix.doctor).type.toBeAssignableTo<Effect.Effect<PhoenixDoctorResult, PhoenixError>>();
    expect(
      phoenix.createDataset(
        PhoenixDatasetCreateInput.make({
          description: "Agent loop health examples.",
          examples: [PhoenixDatasetExample.make({ input: { task: "loop-health" } })],
          name: "agent-loop-health-v1",
        })
      )
    ).type.toBeAssignableTo<Effect.Effect<PhoenixDatasetCreateResult, PhoenixError>>();
    expect(
      phoenix.addAnnotation(
        PhoenixAnnotationInput.make({
          label: "passed",
          name: "agent.outcome",
          targetId: "trace-id",
          targetKind: "trace",
        })
      )
    ).type.toBeAssignableTo<Effect.Effect<PhoenixAnnotationWriteResult, PhoenixError>>();
  });

  it("rejects invalid construction shapes", () => {
    // @ts-expect-error!
    const invalidConfig = PhoenixConfigInput.make({ apiKey: "test-key" });
    // @ts-expect-error!
    const missingDatasetName = PhoenixDatasetCreateInput.make({ description: "missing", examples: [] });

    void invalidConfig;
    void missingDatasetName;
  });
});
