/**
 * Runpod-backed JSDoc quality worker evaluation.
 *
 * This module keeps remote GPU orchestration read-only: it creates an
 * ephemeral Runpod pod, serves Ollama behind the Codex SDK, runs the existing
 * worker eval, and tears the pod down before returning the wrapper report.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { layerNodeSdkServerTraces, ServerObservabilityConfig } from "@beep/observability/server";
import { hashPublicTextSha256, shellQuote } from "@beep/repo-ai-metrics";
import { DomainError } from "@beep/repo-utils";
import {
  CreatePodRequest,
  DeletePodRequest,
  GetPodRequest,
  ListPodsRequest,
  ListTemplatesRequest,
  PodCreateInput,
  Runpod,
  StopPodRequest,
} from "@beep/runpod";
import { LiteralKit } from "@beep/schema";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import * as O from "@beep/utils/Option";
import { Console, Duration, Effect, flow, Layer, Order, pipe, Ref, Result, Schedule } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import {
  DEFAULT_JSON_PRETTY_MAX_LENGTH,
  encodeCommandJson,
  renderPrettyCommandJson,
} from "../../../internal/cli/Json.ts";
import { errorMessage as cliErrorMessage, durationMsSince, timestampIso } from "../../../internal/cli/Timing.ts";
import { DocgenQualityReport } from "./Quality.ts";
import {
  analyzeDocgenQualityWorkerEval,
  DocgenQualityWorkerEvalProvider,
  DocgenQualityWorkerEvalReport,
  DocgenQualityWorkerEvalScope,
} from "./QualityWorkerEval.ts";
import type { Pod, Template } from "@beep/runpod";

const $I = $RepoCliId.create("commands/Docgen/internal/QualityWorkerRunpodEval");

const QUALITY_WORKER_RUNPOD_EVAL_SCHEMA_VERSION = 1 as const;
const DEFAULT_RUNPOD_WORKER_PACKET_LIMIT = 10;
const REQUIRED_RUNPOD_WORKER_MODEL = "qwen3-coder:30b";
const DEFAULT_RUNPOD_OTLP_BASE_URL = "http://localhost:6006";
const DEFAULT_RUNPOD_OTLP_PROJECT = "beep-jsdoc-worker-eval";
const DEFAULT_RUNPOD_READINESS_TIMEOUT = Duration.minutes(30);
const OLLAMA_PORT = 11434;
const OLLAMA_PORT_MAPPING = "11434/http";
const RUNPOD_PYTORCH_IMAGE = "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04";
const OLLAMA_INSTALL_SCRIPT_SHA256 = "25f64b810b947145095956533e1bdf56eacea2673c55a7e586be4515fc882c9f";

class OllamaTagsModel extends S.Class<OllamaTagsModel>($I`OllamaTagsModel`)(
  {
    model: S.optionalKey(S.String),
    name: S.String,
  },
  $I.annote("OllamaTagsModel", {
    description: "One Ollama /api/tags model entry.",
  })
) {}

class OllamaTagsResponse extends S.Class<OllamaTagsResponse>($I`OllamaTagsResponse`)(
  {
    models: S.Array(OllamaTagsModel),
  },
  $I.annote("OllamaTagsResponse", {
    description: "Decoded Ollama /api/tags response payload.",
  })
) {}
const decodeOllamaTagsResponse = S.decodeUnknownEffect(OllamaTagsResponse);

const PreferredGpuTypeIds48Gb = [
  "NVIDIA RTX PRO 6000 Blackwell Server Edition",
  "NVIDIA RTX 6000 Ada Generation",
  "NVIDIA RTX A6000",
  "NVIDIA A40",
  "NVIDIA L40S",
  "NVIDIA L40",
] as const;

const VerifiedGpuTypeIds24Gb = [
  "NVIDIA GeForce RTX 4090",
  "NVIDIA RTX A5000",
  "NVIDIA GeForce RTX 3090",
  "NVIDIA GeForce RTX 3090 Ti",
] as const;

const DocgenQualityWorkerRunpodEvalTemplateStrategy = LiteralKit([
  "explicit-template",
  "existing-template",
  "fallback-image",
]).pipe(
  $I.annoteSchema("DocgenQualityWorkerRunpodEvalTemplateStrategy", {
    description: "How the Runpod worker eval pod image or template was selected.",
  })
);

const DocgenQualityWorkerRunpodEvalCleanupStatus = LiteralKit(["completed", "failed", "skipped-debug-keep"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerRunpodEvalCleanupStatus", {
    description: "Cleanup outcome for a Runpod worker eval pod.",
  })
);

const DocgenQualityWorkerRunpodEvalOtlpStatus = LiteralKit(["disabled", "exported", "failed"]).pipe(
  $I.annoteSchema("DocgenQualityWorkerRunpodEvalOtlpStatus", {
    description: "OTLP export outcome for a Runpod worker eval wrapper report.",
  })
);

class DocgenQualityWorkerRunpodEvalTemplate extends S.Class<DocgenQualityWorkerRunpodEvalTemplate>(
  $I`DocgenQualityWorkerRunpodEvalTemplate`
)(
  {
    imageName: S.String,
    searchIncludedPublicTemplates: S.Boolean,
    searchIncludedRunpodTemplates: S.Boolean,
    strategy: DocgenQualityWorkerRunpodEvalTemplateStrategy,
    templateId: S.NullOr(S.String),
    templateName: S.NullOr(S.String),
  },
  $I.annote("DocgenQualityWorkerRunpodEvalTemplate", {
    description: "Sanitized template or image decision used to create the Runpod eval pod.",
  })
) {}

class DocgenQualityWorkerRunpodEvalPod extends S.Class<DocgenQualityWorkerRunpodEvalPod>(
  $I`DocgenQualityWorkerRunpodEvalPod`
)(
  {
    baseUrl: S.String,
    codexBaseUrl: S.String,
    gpuDisplayName: S.NullOr(S.String),
    gpuTypeIds: S.Array(S.String),
    imageName: S.String,
    minRamPerGpuGb: S.Finite,
    podId: S.String,
    podName: S.String,
    templateId: S.NullOr(S.String),
  },
  $I.annote("DocgenQualityWorkerRunpodEvalPod", {
    description: "Sanitized Runpod pod metadata for a worker eval run.",
  })
) {}

class DocgenQualityWorkerRunpodEvalBootstrap extends S.Class<DocgenQualityWorkerRunpodEvalBootstrap>(
  $I`DocgenQualityWorkerRunpodEvalBootstrap`
)(
  {
    dockerStartCmdHash: S.String,
    model: S.String,
    portMappings: S.Array(S.String),
    readinessPath: S.String,
  },
  $I.annote("DocgenQualityWorkerRunpodEvalBootstrap", {
    description: "Sanitized Ollama bootstrap metadata for the Runpod eval pod.",
  })
) {}

class DocgenQualityWorkerRunpodEvalCleanup extends S.Class<DocgenQualityWorkerRunpodEvalCleanup>(
  $I`DocgenQualityWorkerRunpodEvalCleanup`
)(
  {
    deleteStatus: DocgenQualityWorkerRunpodEvalCleanupStatus,
    durationMs: S.Finite,
    error: S.NullOr(S.String),
    keepPod: S.Boolean,
    stopStatus: DocgenQualityWorkerRunpodEvalCleanupStatus,
  },
  $I.annote("DocgenQualityWorkerRunpodEvalCleanup", {
    description: "Stop and delete outcome for the ephemeral Runpod eval pod.",
  })
) {}

class DocgenQualityWorkerRunpodEvalOtlp extends S.Class<DocgenQualityWorkerRunpodEvalOtlp>(
  $I`DocgenQualityWorkerRunpodEvalOtlp`
)(
  {
    baseUrl: S.NullOr(S.String),
    error: S.NullOr(S.String),
    exportedSpans: S.Finite,
    project: S.String,
    serviceName: S.String,
    status: DocgenQualityWorkerRunpodEvalOtlpStatus,
  },
  $I.annote("DocgenQualityWorkerRunpodEvalOtlp", {
    description: "Phoenix-compatible OTLP export summary for a Runpod worker eval.",
  })
) {}

class DocgenQualityWorkerRunpodEvalRuntime extends S.Class<DocgenQualityWorkerRunpodEvalRuntime>(
  $I`DocgenQualityWorkerRunpodEvalRuntime`
)(
  {
    cleanupDurationMs: S.Finite,
    provisionDurationMs: S.Finite,
    totalDurationMs: S.Finite,
    workerDurationMs: S.Finite,
  },
  $I.annote("DocgenQualityWorkerRunpodEvalRuntime", {
    description: "Runtime measurements for Runpod worker eval orchestration.",
  })
) {}

/**
 * JSON wrapper report emitted by `docgen quality-worker-eval-runpod`.
 *
 * **Example** (Access report model fields)
 *
 * ```ts
 * import type { DocgenQualityWorkerRunpodEvalReport } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * const model: DocgenQualityWorkerRunpodEvalReport["model"] = "qwen3-coder:30b"
 * const sourceReport: DocgenQualityWorkerRunpodEvalReport["sourceQualityReport"] = "quality.json"
 * console.log(`${model} from ${sourceReport}`)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DocgenQualityWorkerRunpodEvalReport extends S.Class<DocgenQualityWorkerRunpodEvalReport>(
  $I`DocgenQualityWorkerRunpodEvalReport`
)(
  {
    schemaVersion: S.Literal(QUALITY_WORKER_RUNPOD_EVAL_SCHEMA_VERSION),
    bootstrap: DocgenQualityWorkerRunpodEvalBootstrap,
    cleanup: DocgenQualityWorkerRunpodEvalCleanup,
    generatedAt: S.String,
    model: S.String,
    otlp: DocgenQualityWorkerRunpodEvalOtlp,
    pod: DocgenQualityWorkerRunpodEvalPod,
    provider: DocgenQualityWorkerEvalProvider,
    recommendation: S.String,
    runId: S.String,
    runtime: DocgenQualityWorkerRunpodEvalRuntime,
    scope: DocgenQualityWorkerEvalScope,
    sourceQualityReport: S.String,
    template: DocgenQualityWorkerRunpodEvalTemplate,
    workerEval: DocgenQualityWorkerEvalReport,
  },
  $I.annote("DocgenQualityWorkerRunpodEvalReport", {
    description: "Runpod orchestration wrapper around a read-only JSDoc quality worker eval report.",
  })
) {}

/**
 * Options for a Runpod-backed quality worker eval run.
 *
 * **Example** (Pick eval options subset)
 *
 * ```ts
 * import type { RunDocgenQualityWorkerRunpodEvalOptions } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * const options: Pick<RunDocgenQualityWorkerRunpodEvalOptions, "confirmRunpodEval" | "provider" | "scope"> = {
 *   confirmRunpodEval: true,
 *   provider: "ollama",
 *   scope: "input"
 * }
 * console.log(options.scope)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunDocgenQualityWorkerRunpodEvalOptions extends S.Class<RunDocgenQualityWorkerRunpodEvalOptions>(
  $I`RunDocgenQualityWorkerRunpodEvalOptions`
)(
  {
    allow24GbFallback: S.optionalKey(S.Boolean),
    confirmRunpodEval: S.Boolean,
    gpuTypeIds: S.Array(S.String).pipe(S.optionalKey),
    keepPod: S.optionalKey(S.Boolean),
    model: S.String,
    otlpBaseUrl: S.optionalKey(S.String),
    otlpEnabled: S.optionalKey(S.Boolean),
    otlpProject: S.optionalKey(S.String),
    packetLimit: S.optionalKey(S.Finite),
    provider: DocgenQualityWorkerEvalProvider,
    readinessTimeoutMs: S.optionalKey(S.Finite),
    report: DocgenQualityReport,
    scope: DocgenQualityWorkerEvalScope,
    sourceQualityReport: S.String,
    allowPublicTemplateSearch: S.optionalKey(S.Boolean),
    skipTemplateSearch: S.optionalKey(S.Boolean),
    templateId: S.optionalKey(S.String),
  },
  $I.annote("RunDocgenQualityWorkerRunpodEvalOptions", {
    description: "Options used to create an ephemeral Runpod pod and execute a read-only worker eval.",
  })
) {}

type AcquiredRunpodPod = {
  readonly bootstrap: DocgenQualityWorkerRunpodEvalBootstrap;
  readonly pod: DocgenQualityWorkerRunpodEvalPod;
  readonly provisionDurationMs: number;
  readonly template: DocgenQualityWorkerRunpodEvalTemplate;
};

const errorMessage = (error: unknown): string => cliErrorMessage(error, "Unknown Runpod worker eval failure.");

const renderJson = Effect.fn("DocgenQualityWorkerRunpodEval.renderJson")(function* (value: unknown) {
  const encoded = yield* encodeCommandJson(value).pipe(
    Effect.mapError(DomainError.newCause("Failed to encode docgen Runpod worker eval JSON."))
  );
  return renderPrettyCommandJson(encoded, { maxLength: DEFAULT_JSON_PRETTY_MAX_LENGTH });
});

const hashPublicIdentifier = (value: string): Effect.Effect<string, DomainError> =>
  hashPublicTextSha256(value).pipe(Effect.mapError(DomainError.newCause("Failed to hash Runpod eval metadata.")));

const ollamaBootstrapCommand = (model: string): ReadonlyArray<string> => {
  // TODO(effect-native-migration): model schema
  const pullPayload = shellQuote(UnknownFromJsonString.encodeUnknownSync({ name: model }));

  // cspell:ignore resolv
  return [
    "bash",
    "-lc",
    A.join("\n")([
      "set -euo pipefail",
      "printf 'nameserver 1.1.1.1\\nnameserver 8.8.8.8\\noptions timeout:2 attempts:3\\n' >/etc/resolv.conf || true",
      'wait_for_dns() { host="$1"; for attempt in $(seq 1 120); do getent hosts "$host" >/dev/null 2>&1 && return 0; echo "waiting for DNS: $host ($attempt/120)"; sleep 5; done; echo "DNS never resolved: $host" >&2; return 1; }',
      'retry_command() { label="$1"; shift; for attempt in $(seq 1 30); do "$@" && return 0; echo "retrying $label ($attempt/30)"; sleep 5; done; echo "$label failed after retries" >&2; return 1; }',
      "wait_for_dns ollama.com",
      'retry_command "apt-get update" apt-get update',
      "apt-get install -y curl ca-certificates zstd",
      "curl --retry 60 --retry-all-errors --retry-delay 5 --connect-timeout 10 -fsSL https://ollama.com/install.sh -o /tmp/ollama-install.sh",
      `echo '${OLLAMA_INSTALL_SCRIPT_SHA256}  /tmp/ollama-install.sh' | sha256sum -c -`,
      "sh /tmp/ollama-install.sh",
      `OLLAMA_HOST=0.0.0.0:${OLLAMA_PORT} ollama serve >/tmp/ollama.log 2>&1 &`,
      `until curl -fsS http://127.0.0.1:${OLLAMA_PORT}/api/tags >/dev/null; do sleep 2; done`,
      `retry_command "ollama api pull" curl --retry 60 --retry-all-errors --retry-delay 5 --connect-timeout 10 --max-time 7200 -fsS -H 'Content-Type: application/json' -d ${pullPayload} http://127.0.0.1:${OLLAMA_PORT}/api/pull >/tmp/ollama-pull.log`,
      "tail -f /tmp/ollama.log",
    ]),
  ];
};

const templateText = (template: Template): string =>
  pipe(
    [template.name, template.imageName, template.readme],
    A.map(
      flow(
        O.fromUndefinedOr,
        O.getOrElse(() => "")
      )
    ),
    A.join("\n"),
    Str.toLowerCase
  );

const isOllamaTemplate = (template: Template): boolean =>
  pipe(templateText(template), (text) => Str.includes("ollama")(text) && !Str.includes("serverless")(text));

const templateSortKey = (template: Template): string =>
  pipe(
    O.fromUndefinedOr(template.name),
    O.orElse(() => O.fromUndefinedOr(template.id)),
    O.orElse(() => O.fromUndefinedOr(template.imageName)),
    O.getOrElse(() => "")
  );

const templateOrder = Order.mapInput(Order.String, templateSortKey);

/**
 * Select the first suitable Ollama template from live Runpod templates.
 *
 * **Example** (Select from empty templates)
 *
 * ```ts
 * import { selectQualityWorkerRunpodTemplate } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(selectQualityWorkerRunpodTemplate([]))
 * ```
 *
 * @param templates - Templates returned by Runpod.
 * @returns The deterministic Ollama template candidate, when present.
 * @category utilities
 * @since 0.0.0
 */
export const selectQualityWorkerRunpodTemplate: (templates: ReadonlyArray<Template>) => O.Option<Template> = flow(
  A.filter(isOllamaTemplate),
  A.sort(templateOrder),
  A.head
);

const gpuTypeIdsFor = ({
  allow24GbFallback,
  gpuTypeIds,
}: {
  readonly allow24GbFallback: boolean;
  readonly gpuTypeIds?: ReadonlyArray<string>;
}): ReadonlyArray<string> => {
  if (gpuTypeIds !== undefined && A.length(gpuTypeIds) > 0) {
    return gpuTypeIds;
  }

  return allow24GbFallback ? A.appendAll(PreferredGpuTypeIds48Gb, VerifiedGpuTypeIds24Gb) : PreferredGpuTypeIds48Gb;
};

const minRamPerGpuFor = (allow24GbFallback: boolean): number => (allow24GbFallback ? 24 : 48);

class QualityWorkerRunpodEvalPodCreateInputOptions extends S.Class<QualityWorkerRunpodEvalPodCreateInputOptions>(
  $I`QualityWorkerRunpodEvalPodCreateInputOptions`
)(
  {
    gpuTypeIds: S.Array(S.String),
    imageName: S.optionalKey(S.String),
    minRamPerGpuGb: S.Finite,
    model: S.String,
    podName: S.String,
    templateId: S.optionalKey(S.String),
  },
  $I.annote("QualityWorkerRunpodEvalPodCreateInputOptions", {
    description: "Input options for building a Runpod worker eval create-pod request.",
  })
) {}

/**
 * Build the Runpod create-pod body for an Ollama worker eval host.
 *
 * **Example** (Build pod create input)
 *
 * ```ts
 * import { makeQualityWorkerRunpodEvalPodCreateInput } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * const input = makeQualityWorkerRunpodEvalPodCreateInput({
 *   gpuTypeIds: ["NVIDIA RTX A6000"],
 *   minRamPerGpuGb: 48,
 *   model: "qwen3-coder:30b",
 *   podName: "beep-jsdoc-worker-eval-example"
 * })
 * console.log(input.computeType)
 * ```
 *
 * @param input - Pod image, template, GPU, and model selection.
 * @returns The typed Runpod create-pod input.
 * @category constructors
 * @since 0.0.0
 */
export const makeQualityWorkerRunpodEvalPodCreateInput = ({
  gpuTypeIds,
  imageName = RUNPOD_PYTORCH_IMAGE,
  minRamPerGpuGb,
  model,
  podName,
  templateId,
}: QualityWorkerRunpodEvalPodCreateInputOptions): PodCreateInput =>
  PodCreateInput.make({
    cloudType: "COMMUNITY",
    computeType: "GPU",
    containerDiskInGb: 100,
    dockerStartCmd: ollamaBootstrapCommand(model),
    globalNetworking: true,
    gpuCount: 1,
    gpuTypeIds,
    gpuTypePriority: "availability",
    ...(templateId === undefined ? { imageName } : { templateId }),
    interruptible: false,
    minRAMPerGPU: minRamPerGpuGb,
    name: podName,
    ports: [OLLAMA_PORT_MAPPING],
    supportPublicIp: true,
    volumeInGb: 0,
  });

const podProxyBaseUrl = (podId: string): string => `https://${podId}-${OLLAMA_PORT}.proxy.runpod.net`;

const codexBaseUrlFor = (baseUrl: string): string => `${baseUrl}/v1`;

const podIdOption = (pod: Pod): O.Option<string> =>
  pipe(O.fromUndefinedOr(pod.id), O.map(Str.trim), O.filter(Str.isNonEmpty));

const requirePodId = (pod: Pod): Effect.Effect<string, DomainError> =>
  pipe(
    podIdOption(pod),
    Effect.fromOption(() => DomainError.make({ message: "Runpod createPod returned a pod without an id." }))
  );

const findCreatedPodIdByName = Effect.fn("DocgenQualityWorkerRunpodEval.findCreatedPodIdByName")(function* ({
  podName,
}: {
  readonly podName: string;
}) {
  const runpod = yield* Runpod;
  const pods = yield* runpod
    .listPods(ListPodsRequest.make({ name: podName }))
    .pipe(Effect.mapError(DomainError.newCause(`Failed to list Runpod pods named "${podName}".`)));
  const podId = pipe(
    pods,
    A.findFirst((pod) => pod.name === podName),
    O.flatMap(podIdOption)
  );

  return yield* pipe(
    podId,
    Effect.fromOption(() => DomainError.make({ message: `Runpod pod "${podName}" did not expose an id.` }))
  );
});

const podGpuDisplayName = (pod: Pod): string | null =>
  pipe(
    O.fromUndefinedOr(pod.gpu?.displayName),
    O.orElse(() => O.fromUndefinedOr(pod.machine?.gpuDisplayName)),
    O.orElse(() => O.fromUndefinedOr(pod.machine?.gpuType?.displayName)),
    O.getOrNull
  );

const fallbackTemplate = ({
  searchIncludedPublicTemplates,
  searchIncludedRunpodTemplates,
}: {
  readonly searchIncludedPublicTemplates: boolean;
  readonly searchIncludedRunpodTemplates: boolean;
}): DocgenQualityWorkerRunpodEvalTemplate =>
  DocgenQualityWorkerRunpodEvalTemplate.make({
    imageName: RUNPOD_PYTORCH_IMAGE,
    searchIncludedPublicTemplates,
    searchIncludedRunpodTemplates,
    strategy: "fallback-image",
    templateId: null,
    templateName: null,
  });

const explicitTemplate = (templateId: string | undefined): O.Option<DocgenQualityWorkerRunpodEvalTemplate> =>
  pipe(
    O.fromUndefinedOr(templateId),
    O.map(Str.trim),
    O.filter(Str.isNonEmpty),
    O.map((normalizedTemplateId) =>
      DocgenQualityWorkerRunpodEvalTemplate.make({
        imageName: RUNPOD_PYTORCH_IMAGE,
        searchIncludedPublicTemplates: false,
        searchIncludedRunpodTemplates: false,
        strategy: "explicit-template",
        templateId: normalizedTemplateId,
        templateName: null,
      })
    )
  );

const existingTemplate = (template: Template): DocgenQualityWorkerRunpodEvalTemplate =>
  DocgenQualityWorkerRunpodEvalTemplate.make({
    imageName: template.imageName ?? RUNPOD_PYTORCH_IMAGE,
    searchIncludedPublicTemplates: true,
    searchIncludedRunpodTemplates: true,
    strategy: "existing-template",
    templateId: template.id ?? null,
    templateName: template.name ?? null,
  });

const resolveTemplate = Effect.fn("DocgenQualityWorkerRunpodEval.resolveTemplate")(function* ({
  allowPublicTemplateSearch,
  skipTemplateSearch,
  templateId,
}: {
  readonly allowPublicTemplateSearch: boolean;
  readonly skipTemplateSearch: boolean;
  readonly templateId?: string;
}) {
  const selectedExplicitTemplate = explicitTemplate(templateId);
  if (O.isSome(selectedExplicitTemplate)) return selectedExplicitTemplate.value;

  if (skipTemplateSearch || !allowPublicTemplateSearch) {
    return fallbackTemplate({
      searchIncludedPublicTemplates: false,
      searchIncludedRunpodTemplates: false,
    });
  }

  const runpod = yield* Runpod;
  const templates = yield* runpod
    .listTemplates(
      ListTemplatesRequest.make({
        includePublicTemplates: true,
        includeRunpodTemplates: true,
      })
    )
    .pipe(Effect.mapError(DomainError.newCause("Failed to list Runpod templates for worker eval.")));
  return pipe(
    selectQualityWorkerRunpodTemplate(templates),
    O.map(existingTemplate),
    O.getOrElse(() =>
      fallbackTemplate({
        searchIncludedPublicTemplates: true,
        searchIncludedRunpodTemplates: true,
      })
    )
  );
});

const ollamaTagsIncludeModel = (model: string, tags: OllamaTagsResponse): boolean =>
  pipe(
    tags.models,
    A.some((entry) => entry.name === model || entry.model === model)
  );

const ollamaReadyProbe = Effect.fn("DocgenQualityWorkerRunpodEval.ollamaReadyProbe")(function* ({
  baseUrl,
  model,
}: {
  readonly baseUrl: string;
  readonly model: string;
}) {
  const client = yield* HttpClient.HttpClient;
  const tags = yield* client.execute(HttpClientRequest.get(`${baseUrl}/api/tags`)).pipe(
    Effect.filterOrFail(
      (response) => response.status >= 200 && response.status < 300,
      () => DomainError.make({ message: `Ollama tags endpoint is not ready at ${baseUrl}.` })
    ),
    Effect.flatMap((response) => response.json),
    Effect.flatMap(decodeOllamaTagsResponse),
    Effect.option
  );

  return pipe(
    tags,
    O.map((value) => ollamaTagsIncludeModel(model, value)),
    O.getOrElse(() => false)
  );
});

const waitForOllamaReady = Effect.fn("DocgenQualityWorkerRunpodEval.waitForOllamaReady")(function* ({
  baseUrl,
  model,
  timeout,
}: {
  readonly baseUrl: string;
  readonly model: string;
  readonly timeout: Duration.Duration;
}) {
  const attempts = Math.max(1, Math.floor(Duration.toMillis(timeout) / Duration.toMillis(Duration.seconds(5))));
  return yield* ollamaReadyProbe({ baseUrl, model }).pipe(
    Effect.flatMap((ready) =>
      ready
        ? Effect.succeed(true)
        : Effect.fail(DomainError.make({ message: `Ollama model "${model}" is not ready at ${baseUrl}.` }))
    ),
    // Schedule.max continues while ANY sub-schedule continues, so the old
    // `max([spaced, recurs])` form was unbounded and only the outer timeout saved it;
    // the delay must ride on `recurs` itself for the attempt cap to be real.
    Effect.retry(Schedule.recurs(attempts).pipe(Schedule.addDelay(() => Effect.succeed(Duration.seconds(5))))),
    Effect.timeoutOrElse({
      duration: timeout,
      orElse: () =>
        Effect.fail(DomainError.make({ message: `Timed out waiting for Ollama model "${model}" at ${baseUrl}.` })),
    })
  );
});

const acquireRunpodPod = Effect.fn("DocgenQualityWorkerRunpodEval.acquireRunpodPod")(function* ({
  allow24GbFallback,
  gpuTypeIds,
  model,
  runId,
  allowPublicTemplateSearch,
  skipTemplateSearch,
  templateId,
}: {
  readonly allow24GbFallback: boolean;
  readonly allowPublicTemplateSearch: boolean;
  readonly gpuTypeIds?: ReadonlyArray<string>;
  readonly model: string;
  readonly runId: string;
  readonly skipTemplateSearch: boolean;
  readonly templateId?: string;
}) {
  const startedAtMs = globalThis.performance.now();
  const runpod = yield* Runpod;
  const template = yield* resolveTemplate({
    allowPublicTemplateSearch,
    skipTemplateSearch,
    ...O.getSomesStruct({ templateId: O.fromUndefinedOr(templateId) }),
  });
  yield* Console.log(
    `docgen: Runpod template strategy=${template.strategy} image=${template.imageName} template=${template.templateId ?? "none"}`
  );
  const resolvedGpuTypeIds = gpuTypeIdsFor({
    allow24GbFallback,
    ...O.getSomesStruct({ gpuTypeIds: O.fromUndefinedOr(gpuTypeIds) }),
  });
  const minRamPerGpuGb = minRamPerGpuFor(allow24GbFallback);
  const podName = `beep-jsdoc-worker-eval-${pipe(runId, Str.takeLeft(12))}`;
  yield* Console.log(
    `docgen: creating Runpod pod ${podName} gpuTypeIds=${A.join(resolvedGpuTypeIds, ", ")} minRAMPerGPU=${minRamPerGpuGb}`
  );
  const createInput = makeQualityWorkerRunpodEvalPodCreateInput({
    gpuTypeIds: resolvedGpuTypeIds,
    imageName: template.imageName,
    minRamPerGpuGb,
    model,
    podName,
    ...(template.templateId === null ? {} : { templateId: template.templateId }),
  });
  const bootstrapHash = yield* hashPublicIdentifier(A.join(createInput.dockerStartCmd ?? [], "\n"));
  const created = yield* runpod
    .createPod(CreatePodRequest.make({ body: createInput }))
    .pipe(Effect.mapError(DomainError.newCause("Failed to create Runpod worker eval pod.")));
  const podId = yield* requirePodId(created).pipe(Effect.catch(() => findCreatedPodIdByName({ podName })));
  const baseUrl = podProxyBaseUrl(podId);
  yield* Console.log(`docgen: created Runpod pod ${podId}; waiting on ${baseUrl}`);
  const pod = yield* runpod
    .getPod(
      GetPodRequest.make({
        includeMachine: true,
        podId,
      })
    )
    .pipe(Effect.orElseSucceed(() => created));

  return {
    bootstrap: DocgenQualityWorkerRunpodEvalBootstrap.make({
      dockerStartCmdHash: bootstrapHash,
      model,
      portMappings: [OLLAMA_PORT_MAPPING],
      readinessPath: "/api/tags",
    }),
    pod: DocgenQualityWorkerRunpodEvalPod.make({
      baseUrl,
      codexBaseUrl: codexBaseUrlFor(baseUrl),
      gpuDisplayName: podGpuDisplayName(pod),
      gpuTypeIds: resolvedGpuTypeIds,
      imageName: template.imageName,
      minRamPerGpuGb,
      podId,
      podName,
      templateId: template.templateId,
    }),
    provisionDurationMs: durationMsSince(startedAtMs),
    template,
  } satisfies AcquiredRunpodPod;
});

const cleanupSkipped = (keepPod: boolean): DocgenQualityWorkerRunpodEvalCleanup =>
  DocgenQualityWorkerRunpodEvalCleanup.make({
    deleteStatus: keepPod ? "skipped-debug-keep" : "failed",
    durationMs: 0,
    error: keepPod ? null : "Runpod cleanup did not run.",
    keepPod,
    stopStatus: keepPod ? "skipped-debug-keep" : "failed",
  });

const cleanupRunpodPod = Effect.fn("DocgenQualityWorkerRunpodEval.cleanupRunpodPod")(function* ({
  keepPod,
  podId,
}: {
  readonly keepPod: boolean;
  readonly podId: string;
}) {
  const startedAtMs = globalThis.performance.now();

  if (keepPod) {
    yield* Console.log(`docgen: keeping Runpod pod ${podId} for debugging`);
    return DocgenQualityWorkerRunpodEvalCleanup.make({
      deleteStatus: "skipped-debug-keep",
      durationMs: durationMsSince(startedAtMs),
      error: null,
      keepPod,
      stopStatus: "skipped-debug-keep",
    });
  }

  const runpod = yield* Runpod;
  yield* Console.log(`docgen: stopping Runpod pod ${podId}`);
  const stopResult = yield* runpod.stopPod(StopPodRequest.make({ podId })).pipe(Effect.result);
  yield* Console.log(`docgen: deleting Runpod pod ${podId}`);
  const deleteResult = yield* runpod.deletePod(DeletePodRequest.make({ podId })).pipe(Effect.result);
  const stopStatus = Result.isSuccess(stopResult) ? "completed" : "failed";
  const deleteStatus = Result.isSuccess(deleteResult) ? "completed" : "failed";
  const error = pipe(
    [
      Result.isFailure(stopResult) ? O.some(`stop: ${errorMessage(stopResult.failure)}`) : O.none<string>(),
      Result.isFailure(deleteResult) ? O.some(`delete: ${errorMessage(deleteResult.failure)}`) : O.none<string>(),
    ],
    A.getSomes,
    A.match({
      onEmpty: () => null,
      onNonEmpty: A.join("; "),
    })
  );

  return DocgenQualityWorkerRunpodEvalCleanup.make({
    deleteStatus,
    durationMs: durationMsSince(startedAtMs),
    error,
    keepPod,
    stopStatus,
  });
});

const disabledOtlp = (project: string): DocgenQualityWorkerRunpodEvalOtlp =>
  DocgenQualityWorkerRunpodEvalOtlp.make({
    baseUrl: null,
    error: null,
    exportedSpans: 0,
    project,
    serviceName: "beep.docgen.quality-worker-eval-runpod",
    status: "disabled",
  });

const runOtlpSpan = (spanName: string, attributes: Record<string, string | number | boolean>) =>
  Effect.void.pipe(Effect.withSpan(spanName, { attributes }));

const packetSpanAttributes = Effect.fn("DocgenQualityWorkerRunpodEval.packetSpanAttributes")(function* ({
  model,
  packet,
  provider,
  runId,
}: {
  readonly model: string;
  readonly packet: DocgenQualityWorkerEvalReport["packets"][number];
  readonly provider: DocgenQualityWorkerEvalProvider;
  readonly runId: string;
}) {
  return {
    "beep.docgen.eval.duration_ms": packet.durationMs,
    "beep.docgen.eval.finding_count": A.length(packet.findingCodes),
    "beep.docgen.eval.local_score": packet.localScore ?? 0,
    "beep.docgen.eval.model": model,
    "beep.docgen.eval.package_hash": yield* hashPublicIdentifier(packet.packageName),
    "beep.docgen.eval.packet_id_hash": yield* hashPublicIdentifier(packet.packetId),
    "beep.docgen.eval.policy_violation_count": A.length(packet.policyViolationCodes),
    "beep.docgen.eval.provider": provider,
    "beep.docgen.eval.review_disposition": packet.reviewDisposition,
    "beep.docgen.eval.run_id": runId,
    "beep.docgen.eval.status": packet.status,
    "beep.docgen.eval.subject_id_hash": yield* hashPublicIdentifier(packet.subjectId),
    "openinference.span.kind": "EVALUATOR",
  };
});

const emitRunpodEvalOtlp = Effect.fn("DocgenQualityWorkerRunpodEval.emitRunpodEvalOtlp")(function* ({
  baseUrl,
  enabled,
  model,
  project,
  provider,
  runId,
  sourceQualityReport,
  workerEval,
}: {
  readonly baseUrl: string;
  readonly enabled: boolean;
  readonly model: string;
  readonly project: string;
  readonly provider: DocgenQualityWorkerEvalProvider;
  readonly runId: string;
  readonly sourceQualityReport: string;
  readonly workerEval: DocgenQualityWorkerEvalReport;
}) {
  if (!enabled) {
    return disabledOtlp(project);
  }

  const serviceName = "beep.docgen.quality-worker-eval-runpod";
  const spanCount = A.length(workerEval.packets) + 1;
  const exportResult = yield* Effect.scoped(
    Layer.build(
      layerNodeSdkServerTraces(
        ServerObservabilityConfig.make({
          devtoolsEnabled: false,
          devtoolsUrl: "ws://127.0.0.1:34437",
          environment: "eval",
          minLogLevel: "Info",
          otlpBaseUrl: baseUrl,
          otlpEnabled: true,
          otlpResourceAttributes: {
            "openinference.project.name": project,
            "service.namespace": "beep",
          },
          prometheusPrefix: "beep",
          serviceName,
          serviceVersion: "0.0.0",
        })
      )
    ).pipe(
      Effect.flatMap((context) =>
        Effect.gen(function* () {
          const sourceQualityReportHash = yield* hashPublicIdentifier(sourceQualityReport);
          yield* runOtlpSpan(`${serviceName}.summary`, {
            "beep.docgen.eval.completed": workerEval.summary.completed,
            "beep.docgen.eval.failed": workerEval.summary.failed,
            "beep.docgen.eval.model": model,
            "beep.docgen.eval.provider": provider,
            "beep.docgen.eval.run_id": runId,
            "beep.docgen.eval.scope": workerEval.scope,
            "beep.docgen.eval.selected_packets": workerEval.summary.selectedPackets,
            "beep.docgen.eval.source_quality_report_hash": sourceQualityReportHash,
            "beep.docgen.eval.timed_out": workerEval.summary.timedOut,
            "openinference.span.kind": "EVALUATOR",
          });
          yield* Effect.forEach(
            workerEval.packets,
            (packet) =>
              packetSpanAttributes({ model, packet, provider, runId }).pipe(
                Effect.flatMap((attributes) => runOtlpSpan(`${serviceName}.packet`, attributes))
              ),
            { concurrency: 8, discard: true }
          );
        }).pipe(Effect.provide(context))
      )
    )
  ).pipe(Effect.result);

  if (Result.isFailure(exportResult)) {
    return DocgenQualityWorkerRunpodEvalOtlp.make({
      baseUrl,
      error: errorMessage(exportResult.failure),
      exportedSpans: 0,
      project,
      serviceName,
      status: "failed",
    });
  }

  return DocgenQualityWorkerRunpodEvalOtlp.make({
    baseUrl,
    error: null,
    exportedSpans: spanCount,
    project,
    serviceName,
    status: "exported",
  });
});

const validateOptions = Effect.fn("DocgenQualityWorkerRunpodEval.validateOptions")(function* ({
  confirmRunpodEval,
  model,
  packetLimit,
  provider,
}: RunDocgenQualityWorkerRunpodEvalOptions) {
  if (!confirmRunpodEval) {
    return yield* DomainError.make({
      message: "Runpod worker eval requires --confirm-runpod-eval because it creates a billable remote GPU pod.",
    });
  }

  if (provider !== "ollama") {
    return yield* DomainError.make({
      message: "Runpod worker eval v1 only supports --provider ollama.",
    });
  }

  if (model !== REQUIRED_RUNPOD_WORKER_MODEL) {
    return yield* DomainError.make({
      message: `Runpod worker eval v1 requires --model ${REQUIRED_RUNPOD_WORKER_MODEL}.`,
    });
  }

  if (packetLimit !== undefined && packetLimit < 0) {
    return yield* DomainError.make({
      message: "--packet-limit must be zero or greater; use 0 to suppress worker packet turns.",
    });
  }
});

const recommendationFor = (
  workerEval: DocgenQualityWorkerEvalReport,
  cleanup: DocgenQualityWorkerRunpodEvalCleanup,
  otlp: DocgenQualityWorkerRunpodEvalOtlp
): string => {
  if (cleanup.deleteStatus !== "completed" || cleanup.stopStatus !== "completed") {
    return "Review Runpod cleanup before more remote eval runs; worker output remains read-only evidence.";
  }

  if (otlp.status === "failed") {
    return "Worker eval completed, but Phoenix export failed; keep the JSON report as the source of evidence.";
  }

  return workerEval.recommendation;
};

/**
 * Required v1 model id for Runpod-backed Qwen worker evals.
 *
 * **Example** (Return required model id)
 *
 * ```ts
 * import { requiredQualityWorkerRunpodEvalModel } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(requiredQualityWorkerRunpodEvalModel()) // "qwen3-coder:30b"
 * ```
 *
 * @returns The exact model id accepted by the Runpod command in v1.
 * @category constants
 * @since 0.0.0
 */
export const requiredQualityWorkerRunpodEvalModel = (): string => REQUIRED_RUNPOD_WORKER_MODEL;

/**
 * Default packet cap for Runpod-backed worker eval runs.
 *
 * **Example** (Return default packet limit)
 *
 * ```ts
 * import { defaultQualityWorkerRunpodEvalPacketLimit } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(defaultQualityWorkerRunpodEvalPacketLimit()) // 10
 * ```
 *
 * @returns Default maximum number of packets sent to the remote worker.
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerRunpodEvalPacketLimit = (): number => DEFAULT_RUNPOD_WORKER_PACKET_LIMIT;

/**
 * Default Phoenix-compatible OTLP base URL for remote worker eval traces.
 *
 * **Example** (Return default OTLP URL)
 *
 * ```ts
 * import { defaultQualityWorkerRunpodEvalOtlpBaseUrl } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(defaultQualityWorkerRunpodEvalOtlpBaseUrl()) // "http://localhost:6006"
 * ```
 *
 * @returns Default OTLP collector base URL.
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerRunpodEvalOtlpBaseUrl = (): string => DEFAULT_RUNPOD_OTLP_BASE_URL;

/**
 * Default Phoenix project for remote worker eval traces.
 *
 * **Example** (Return default OTLP project)
 *
 * ```ts
 * import { defaultQualityWorkerRunpodEvalOtlpProject } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(defaultQualityWorkerRunpodEvalOtlpProject()) // "beep-jsdoc-worker-eval"
 * ```
 *
 * @returns Default Phoenix project name.
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerRunpodEvalOtlpProject = (): string => DEFAULT_RUNPOD_OTLP_PROJECT;

/**
 * Default readiness timeout for remote Ollama bootstrap.
 *
 * **Example** (Return readiness timeout ms)
 *
 * ```ts
 * import { defaultQualityWorkerRunpodEvalReadinessTimeoutMs } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * console.log(defaultQualityWorkerRunpodEvalReadinessTimeoutMs()) // 1_800_000
 * ```
 *
 * @returns Default timeout in milliseconds.
 * @category constants
 * @since 0.0.0
 */
export const defaultQualityWorkerRunpodEvalReadinessTimeoutMs = (): number =>
  Duration.toMillis(DEFAULT_RUNPOD_READINESS_TIMEOUT);

/**
 * Run a read-only JSDoc quality worker eval on an ephemeral Runpod pod.
 *
 * **Example** (Compose Runpod eval CLI)
 *
 * ```ts
 * import { requiredQualityWorkerRunpodEvalModel } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * // `runDocgenQualityWorkerRunpodEval` backs this CLI subcommand:
 * const model = requiredQualityWorkerRunpodEvalModel()
 * const command = [
 *   "bun",
 *   "run",
 *   "beep",
 *   "docgen",
 *   "quality-worker-eval-runpod",
 *   "--confirm-runpod-eval",
 *   "--provider",
 *   "ollama",
 *   "--model",
 *   model
 * ]
 * // "bun run beep docgen quality-worker-eval-runpod --confirm-runpod-eval --provider ollama --model qwen3-coder:30b"
 * console.log(command.join(" "))
 * ```
 *
 * @effects
 * - Creates a billable Runpod GPU pod after explicit confirmation.
 * - Waits for Ollama readiness, runs the existing read-only worker eval, and
 *   stops/deletes the pod unless debug keep mode is enabled.
 * - Optionally emits sanitized summary and hashed packet spans to Phoenix OTLP.
 * @category use-cases
 * @since 0.0.0
 */
export const runDocgenQualityWorkerRunpodEval = Effect.fn(
  "DocgenQualityWorkerRunpodEval.runDocgenQualityWorkerRunpodEval"
)(function* (options: RunDocgenQualityWorkerRunpodEvalOptions) {
  yield* validateOptions(options);

  const totalStartedAtMs = globalThis.performance.now();
  const generatedAt = timestampIso();
  const runId = yield* hashPublicIdentifier(`${generatedAt}\u0000${options.model}\u0000${options.sourceQualityReport}`);
  const keepPod = options.keepPod ?? false;
  const cleanupRef = yield* Ref.make(cleanupSkipped(keepPod));
  const { acquired, workerDurationMs, workerEval } = yield* Effect.acquireUseRelease(
    acquireRunpodPod({
      allow24GbFallback: options.allow24GbFallback ?? false,
      allowPublicTemplateSearch: options.allowPublicTemplateSearch ?? false,
      ...O.getSomesStruct({ gpuTypeIds: O.fromUndefinedOr(options.gpuTypeIds) }),
      model: options.model,
      runId,
      skipTemplateSearch: options.skipTemplateSearch ?? false,
      ...O.getSomesStruct({ templateId: O.fromUndefinedOr(options.templateId) }),
    }),
    Effect.fnUntraced(function* (acquired) {
      const workerStartedAtMs = globalThis.performance.now();
      yield* Console.log(`docgen: waiting for Ollama model ${options.model}`);
      yield* waitForOllamaReady({
        baseUrl: acquired.pod.baseUrl,
        model: options.model,
        timeout: Duration.millis(options.readinessTimeoutMs ?? defaultQualityWorkerRunpodEvalReadinessTimeoutMs()),
      });

      yield* Console.log("docgen: running read-only worker eval packets");
      const workerEval = yield* analyzeDocgenQualityWorkerEval({
        baseUrl: acquired.pod.codexBaseUrl,
        model: options.model,
        packetLimit: options.packetLimit ?? DEFAULT_RUNPOD_WORKER_PACKET_LIMIT,
        provider: options.provider,
        report: options.report,
        scope: options.scope,
        sourceQualityReport: options.sourceQualityReport,
      });

      return {
        acquired,
        workerDurationMs: durationMsSince(workerStartedAtMs),
        workerEval,
      };
    }),
    (acquired) =>
      cleanupRunpodPod({ keepPod, podId: acquired.pod.podId }).pipe(
        Effect.flatMap((cleanup) => Ref.set(cleanupRef, cleanup))
      )
  );
  const cleanup = yield* Ref.get(cleanupRef);
  const otlp = yield* emitRunpodEvalOtlp({
    baseUrl: options.otlpBaseUrl ?? DEFAULT_RUNPOD_OTLP_BASE_URL,
    enabled: options.otlpEnabled ?? false,
    model: options.model,
    project: options.otlpProject ?? DEFAULT_RUNPOD_OTLP_PROJECT,
    provider: options.provider,
    runId,
    sourceQualityReport: options.sourceQualityReport,
    workerEval,
  });

  return DocgenQualityWorkerRunpodEvalReport.make({
    schemaVersion: QUALITY_WORKER_RUNPOD_EVAL_SCHEMA_VERSION,
    bootstrap: acquired.bootstrap,
    cleanup,
    generatedAt,
    model: options.model,
    otlp,
    pod: acquired.pod,
    provider: options.provider,
    recommendation: recommendationFor(workerEval, cleanup, otlp),
    runId,
    runtime: DocgenQualityWorkerRunpodEvalRuntime.make({
      cleanupDurationMs: cleanup.durationMs,
      provisionDurationMs: acquired.provisionDurationMs,
      totalDurationMs: durationMsSince(totalStartedAtMs),
      workerDurationMs,
    }),
    scope: options.scope,
    sourceQualityReport: options.sourceQualityReport,
    template: acquired.template,
    workerEval,
  });
});

/**
 * Render a Runpod worker eval wrapper report as stable JSON.
 *
 * **Example** (Serialize report to JSON)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { DocgenQualityWorkerEvalReport } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerEval"
 * import {
 *   DocgenQualityWorkerRunpodEvalReport,
 *   generateQualityWorkerRunpodEvalJson
 * } from "@beep/repo-cli/commands/Docgen/internal/QualityWorkerRunpodEval"
 *
 * const workerEval = DocgenQualityWorkerEvalReport.make({
 *   schemaVersion: 1,
 *   generatedAt: "2026-05-12T00:00:00.000Z",
 *   sourceQualityReport: "quality.json",
 *   provider: "ollama",
 *   model: "qwen3-coder:30b",
 *   reasoningEffort: null,
 *   codexSdkVersion: "example-sdk",
 *   scope: "input",
 *   summary: {
 *     packages: 0,
 *     sourcePackets: 0,
 *     selectedPackets: 0,
 *     completed: 0,
 *     failed: 0,
 *     timedOut: 0,
 *     candidates: 0,
 *     needsHumanReview: 0,
 *     rejected: 0
 *   },
 *   packets: [],
 *   policyViolations: [],
 *   runtime: { totalDurationMs: 0, packetTimeoutMs: 180000 },
 *   recommendation: "No packets selected."
 * })
 * const report = DocgenQualityWorkerRunpodEvalReport.make({
 *   schemaVersion: 1,
 *   bootstrap: {
 *     dockerStartCmdHash: "sha256:example",
 *     model: "qwen3-coder:30b",
 *     portMappings: ["11434/http"],
 *     readinessPath: "/api/tags"
 *   },
 *   cleanup: {
 *     deleteStatus: "completed",
 *     durationMs: 0,
 *     error: null,
 *     keepPod: false,
 *     stopStatus: "completed"
 *   },
 *   generatedAt: "2026-05-12T00:00:00.000Z",
 *   model: "qwen3-coder:30b",
 *   otlp: {
 *     baseUrl: null,
 *     error: null,
 *     exportedSpans: 0,
 *     project: "beep-jsdoc-worker-eval",
 *     serviceName: "beep-docgen-quality-worker-runpod-eval",
 *     status: "disabled"
 *   },
 *   pod: {
 *     baseUrl: "https://pod-11434.proxy.runpod.net",
 *     codexBaseUrl: "https://pod-11434.proxy.runpod.net/v1",
 *     gpuDisplayName: null,
 *     gpuTypeIds: ["NVIDIA RTX A6000"],
 *     imageName: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04",
 *     minRamPerGpuGb: 48,
 *     podId: "pod",
 *     podName: "beep-jsdoc-worker-eval-example",
 *     templateId: null
 *   },
 *   provider: "ollama",
 *   recommendation: "No packets selected.",
 *   runId: "run",
 *   runtime: {
 *     cleanupDurationMs: 0,
 *     provisionDurationMs: 0,
 *     totalDurationMs: 0,
 *     workerDurationMs: 0
 *   },
 *   scope: "input",
 *   sourceQualityReport: "quality.json",
 *   template: {
 *     imageName: "runpod/pytorch:2.8.0-py3.11-cuda12.8.1-cudnn-devel-ubuntu22.04",
 *     searchIncludedPublicTemplates: false,
 *     searchIncludedRunpodTemplates: false,
 *     strategy: "fallback-image",
 *     templateId: null,
 *     templateName: null
 *   },
 *   workerEval
 * })
 * const hasRecommendation = Effect.runSync(
 *   generateQualityWorkerRunpodEvalJson(report).pipe(
 *     Effect.map((json) => json.includes("\"recommendation\""))
 *   )
 * )
 * console.log(hasRecommendation) // example value
 * ```
 *
 * @param report - Runpod worker eval wrapper report.
 * @returns Effect that yields stable pretty JSON.
 * @category formatting
 * @since 0.0.0
 */
export const generateQualityWorkerRunpodEvalJson = (
  report: DocgenQualityWorkerRunpodEvalReport
): Effect.Effect<string, DomainError> => renderJson(report);
