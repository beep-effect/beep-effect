/**
 * Local compose rendering for AI metrics backend smoke targets.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as O from "effect/Option";
import { stringify as stringifyYaml } from "yaml";
import { AiMetricsInstallConfigurationError } from "./install.ts";
import { AiMetricsDeployTarget, AiMetricsTool } from "./models.ts";
import type { AiMetricsInstallSpec, AiMetricsServiceSpec } from "./install.ts";

const $I = $RepoAiMetricsId.create("compose");
void $I;

const composeFailure = (message: string, cause: unknown): AiMetricsInstallConfigurationError =>
  AiMetricsInstallConfigurationError.make({ cause, message });

const phoenixService = (spec: AiMetricsInstallSpec): O.Option<AiMetricsServiceSpec> =>
  pipe(
    spec.services,
    A.findFirst((service) => service.tool === AiMetricsTool.Enum.phoenix)
  );

/**
 * Render a dedicated Docker Compose file for local Phoenix smoke tests.
 *
 * **Example** (Render local Phoenix compose)
 *
 * ```ts
 * import { makeAiMetricsInstallSpec, renderAiMetricsLocalPhoenixCompose } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const spec = yield* makeAiMetricsInstallSpec()
 *   return yield* renderAiMetricsLocalPhoenixCompose(spec)
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const renderAiMetricsLocalPhoenixCompose: (
  spec: AiMetricsInstallSpec
) => Effect.Effect<string, AiMetricsInstallConfigurationError> = Effect.fn(
  "AiMetrics.renderAiMetricsLocalPhoenixCompose"
)(function* (spec) {
  if (spec.target !== AiMetricsDeployTarget.Enum.local) {
    return yield* composeFailure("AI metrics local Phoenix compose rendering only supports the local target.", {
      target: spec.target,
    });
  }

  const phoenix = phoenixService(spec);
  if (O.isNone(phoenix)) {
    return yield* composeFailure("AI metrics local Phoenix compose rendering requires a Phoenix service spec.", {
      services: A.map(spec.services, (service) => service.tool),
    });
  }

  return stringifyYaml(
    {
      name: "beep-ai-metrics-local",
      services: {
        [phoenix.value.composeServiceName]: {
          container_name: "beep-ai-metrics-phoenix",
          environment: {
            PHOENIX_WORKING_DIR: "/data",
          },
          image: phoenix.value.image,
          ports: ["127.0.0.1:6006:6006"],
          restart: "unless-stopped",
          volumes: ["phoenix_data:/data"],
        },
      },
      volumes: {
        phoenix_data: {},
      },
    },
    { lineWidth: 0 }
  );
});
