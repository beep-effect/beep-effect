import {
  AiMetricsInstallDoctorCheck,
  AiMetricsInstallInput,
  AiMetricsInstallPlan,
  AiMetricsInstallPlanStep,
  AiMetricsInstallPlanStepKind,
  aiMetricsInstallPlanToJson,
  makeAiMetricsInstallApplyDryRunResult,
  makeAiMetricsInstallPlan,
  makeAiMetricsInstallSpec,
} from "@beep/repo-ai-metrics/install";
import { AiMetricsDeployTarget, AiMetricsPrivacyMode, AiMetricsTool } from "@beep/repo-ai-metrics/models";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const decodeInstallPlanStep = S.decodeUnknownEffect(AiMetricsInstallPlanStep);
const decodeInstallDoctorCheck = S.decodeUnknownEffect(AiMetricsInstallDoctorCheck);
const decodeInstallPlanJson = S.decodeUnknownEffect(S.fromJsonString(AiMetricsInstallPlan));

describe("@beep/repo-ai-metrics install contracts", () => {
  it("generates plan steps accepted by their domain schema", () =>
    fc.assert(fc.property(S.toArbitrary(AiMetricsInstallPlanStep)(fc), S.is(AiMetricsInstallPlanStep)), fcRuns(25)));

  it.effect("applies plan-step and doctor metadata defaults during construction and decoding", () =>
    Effect.gen(function* () {
      const stepInput = {
        command: "beep-cli ai-metrics config snapshot",
        description: "Capture the active agent configuration.",
        kind: AiMetricsInstallPlanStepKind.Enum.config_snapshot,
        mutatesHost: false,
        order: 10,
        requiresRemote: false,
        stepId: "config.snapshot",
        title: "Create config snapshot",
      };
      const madeStep = AiMetricsInstallPlanStep.make(stepInput);
      const decodedStep = yield* decodeInstallPlanStep(stepInput);
      const madeCheck = AiMetricsInstallDoctorCheck.make({
        checkId: "install.spec",
        message: "Install spec resolved.",
        status: "passed",
      });
      const decodedCheck = yield* decodeInstallDoctorCheck({
        checkId: "install.spec",
        message: "Install spec resolved.",
        status: "passed",
      });

      expect(madeStep.required).toBe(true);
      expect(decodedStep.required).toBe(true);
      expect(madeCheck.metadata).toEqual({});
      expect(decodedCheck.metadata).toEqual({});
    })
  );

  it.effect("uses the default service URL for every planned OTLP base URL", () =>
    Effect.gen(function* () {
      const input = AiMetricsInstallInput.make({
        defaultTool: AiMetricsTool.Enum.opik,
        hashSaltSecretRef: O.some("op://TBK/ai-metrics/hash-salt"),
        privacyMode: AiMetricsPrivacyMode.Enum.encrypted_raw_redacted_ui,
        publicBaseUrl: O.some("https://metrics.example.test"),
        rawArchiveKeySecretRef: O.some("op://TBK/ai-metrics/raw-archive-key"),
        target: AiMetricsDeployTarget.Enum.dankserver,
      });
      const spec = yield* makeAiMetricsInstallSpec(input);
      const plan = yield* makeAiMetricsInstallPlan(input);
      const defaultService = pipe(
        spec.services,
        A.findFirst((service) => service.enabledByDefault),
        O.getOrThrow
      );
      const expectedFlag = `--otlp-base-url ${defaultService.publicUrl}`;
      const specCommands = A.filter(spec.plannedCommands, Str.includes("--otlp-base-url"));
      const planCommands = pipe(
        plan.steps,
        A.map((step) => step.command),
        A.filter(Str.includes("--otlp-base-url"))
      );

      expect(defaultService.publicUrl).toBe("https://metrics.example.test/ai-metrics/opik");
      expect(specCommands).toHaveLength(3);
      expect(planCommands).toHaveLength(3);
      expect(A.every(A.appendAll(specCommands, planCommands), Str.includes(expectedFlag))).toBe(true);
    })
  );

  it.effect("round-trips install plan JSON through the colocated class codec", () =>
    Effect.gen(function* () {
      const plan = yield* makeAiMetricsInstallPlan(
        AiMetricsInstallInput.make({
          dataRoot: O.some("/tmp/ai-metrics-install-test"),
        })
      );
      const apply = yield* makeAiMetricsInstallApplyDryRunResult(
        AiMetricsInstallInput.make({
          dataRoot: O.some("/tmp/ai-metrics-install-test"),
        })
      );
      const encoded = yield* aiMetricsInstallPlanToJson(plan);
      const decoded = yield* decodeInstallPlanJson(encoded);

      expect(apply.dryRun).toBe(true);
      expect(decoded).toEqual(plan);
    })
  );
});
