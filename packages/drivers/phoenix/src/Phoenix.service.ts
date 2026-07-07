/**
 * Effect service for Phoenix datasets, prompts, experiments, and annotations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { createClient } from "@arizeai/phoenix-client";
import {
  appendDatasetExamples,
  createDataset,
  getDatasetExamples,
  getDatasetInfo,
} from "@arizeai/phoenix-client/datasets";
import { createExperiment, getExperimentInfo } from "@arizeai/phoenix-client/experiments";
import { createPrompt, getPrompt, promptVersion } from "@arizeai/phoenix-client/prompts";
import { addSessionAnnotation } from "@arizeai/phoenix-client/sessions";
import { addSpanAnnotation } from "@arizeai/phoenix-client/spans";
import { addTraceAnnotation } from "@arizeai/phoenix-client/traces";
import { $PhoenixId } from "@beep/identity";
import { URLStr } from "@beep/schema";
import { P, thunkEmptyStr } from "@beep/utils";
import { Config, Context, Effect, flow, Layer, pipe, Redacted } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { PHOENIX_API_URL, PhoenixConfigInput } from "./Phoenix.config.ts";
import { PhoenixError } from "./Phoenix.errors.ts";
import {
  PhoenixAnnotationTargetKind,
  PhoenixAnnotationWriteResult,
  PhoenixDatasetAppendResult,
  PhoenixDatasetCreateResult,
  PhoenixDatasetExample,
  PhoenixDatasetExamplesResult,
  PhoenixDatasetInfoResult,
  PhoenixDatasetSelectorKind,
  PhoenixDoctorResult,
  PhoenixExperimentInfoResult,
  PhoenixPromptModelProvider,
  PhoenixPromptReadResult,
  PhoenixPromptWriteResult,
} from "./Phoenix.models.ts";
import type { PhoenixClient } from "@arizeai/phoenix-client";
import type {
  Example as SdkDatasetExample,
  DatasetSelector as SdkDatasetSelector,
} from "@arizeai/phoenix-client/types/datasets";
import type { PromptSelector as SdkPromptSelector } from "@arizeai/phoenix-client/types/prompts";
import type { PhoenixOperation } from "./Phoenix.errors.ts";
import type {
  PhoenixAnnotationInput,
  PhoenixDatasetAppendInput,
  PhoenixDatasetCreateInput,
  PhoenixDatasetSelector,
  PhoenixExperimentCreateInput,
  PhoenixPromptCreateInput,
  PhoenixPromptSelector,
} from "./Phoenix.models.ts";

const $I = $PhoenixId.create("Phoenix.service");

/**
 * Promise-returning SDK adapter used behind the Effect service.
 *
 * @example
 * ```ts
 * import type { PhoenixSdkShape } from "@beep/phoenix"
 *
 * const keys = [
 *   "doctor",
 *   "createDataset",
 *   "addAnnotation"
 * ] satisfies ReadonlyArray<keyof PhoenixSdkShape>
 * console.log(keys)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PhoenixSdkShape {
  readonly addAnnotation: (input: PhoenixAnnotationInput) => Promise<PhoenixAnnotationWriteResult>;
  readonly appendDatasetExamples: (input: PhoenixDatasetAppendInput) => Promise<PhoenixDatasetAppendResult>;
  readonly createDataset: (input: PhoenixDatasetCreateInput) => Promise<PhoenixDatasetCreateResult>;
  readonly createExperiment: (input: PhoenixExperimentCreateInput) => Promise<PhoenixExperimentInfoResult>;
  readonly createPrompt: (input: PhoenixPromptCreateInput) => Promise<PhoenixPromptWriteResult>;
  readonly doctor: () => Promise<PhoenixDoctorResult>;
  readonly getDatasetExamples: (selector: PhoenixDatasetSelector) => Promise<PhoenixDatasetExamplesResult>;
  readonly getDatasetInfo: (selector: PhoenixDatasetSelector) => Promise<PhoenixDatasetInfoResult>;
  readonly getExperimentInfo: (experimentId: string) => Promise<PhoenixExperimentInfoResult>;
  readonly getPrompt: (selector: PhoenixPromptSelector) => Promise<PhoenixPromptReadResult>;
}

/**
 * Public Effect service shape for Phoenix operations.
 *
 * @example
 * ```ts
 * import type { PhoenixShape } from "@beep/phoenix"
 *
 * type PhoenixOperationName = keyof PhoenixShape
 * const operation: PhoenixOperationName = "doctor"
 * console.log(operation)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface PhoenixShape {
  readonly addAnnotation: (input: PhoenixAnnotationInput) => Effect.Effect<PhoenixAnnotationWriteResult, PhoenixError>;
  readonly appendDatasetExamples: (
    input: PhoenixDatasetAppendInput
  ) => Effect.Effect<PhoenixDatasetAppendResult, PhoenixError>;
  readonly createDataset: (input: PhoenixDatasetCreateInput) => Effect.Effect<PhoenixDatasetCreateResult, PhoenixError>;
  readonly createExperiment: (
    input: PhoenixExperimentCreateInput
  ) => Effect.Effect<PhoenixExperimentInfoResult, PhoenixError>;
  readonly createPrompt: (input: PhoenixPromptCreateInput) => Effect.Effect<PhoenixPromptWriteResult, PhoenixError>;
  readonly doctor: Effect.Effect<PhoenixDoctorResult, PhoenixError>;
  readonly getDatasetExamples: (
    selector: PhoenixDatasetSelector
  ) => Effect.Effect<PhoenixDatasetExamplesResult, PhoenixError>;
  readonly getDatasetInfo: (selector: PhoenixDatasetSelector) => Effect.Effect<PhoenixDatasetInfoResult, PhoenixError>;
  readonly getExperimentInfo: (experimentId: string) => Effect.Effect<PhoenixExperimentInfoResult, PhoenixError>;
  readonly getPrompt: (selector: PhoenixPromptSelector) => Effect.Effect<PhoenixPromptReadResult, PhoenixError>;
}
class ResolvedPhoenixConfig extends S.Class<ResolvedPhoenixConfig>($I`ResolvedPhoenixConfig`)(
  {
    apiKey: S.String.pipe(S.Redacted, S.Option).annotateKey({
      description: "Optional Phoenix API key resolved from config or environment.",
    }),
    baseUrl: URLStr.annotateKey({
      description: "Normalized Phoenix API base URL used by the SDK client.",
    }),
    headers: S.Record(S.String, S.String).annotateKey({
      description: "Resolved Phoenix API request headers.",
    }),
  },
  $I.annote("ResolvedPhoenixConfig", {
    description: "Resolved Phoenix API client configuration.",
  })
) {}

const resolveConfig = (config: PhoenixConfigInput): ResolvedPhoenixConfig => ({
  apiKey: config.apiKey,
  baseUrl: URLStr.make(config.baseUrl),
  headers: config.headers,
});

const resolvedHeaders = (config: ResolvedPhoenixConfig): Readonly<Record<string, string>> => ({
  ...config.headers,
  ...pipe(
    config.apiKey,
    O.map((apiKey) => ({ Authorization: `Bearer ${Redacted.value(apiKey)}` })),
    O.getOrElse(R.empty<string, string>)
  ),
});

const makeClient = (config: ResolvedPhoenixConfig): PhoenixClient =>
  createClient({
    getEnvironmentOptions: R.empty,
    options: {
      baseUrl: config.baseUrl,
      headers: resolvedHeaders(config),
    },
  });

const semanticVersionToString = flow(
  A.map((value: number) => `${value}`),
  A.join(".")
);

const toMutableRecord = (record: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  R.fromEntries(R.toEntries(record));

const optionalVersionId = (selector: PhoenixDatasetSelector): { readonly versionId?: string } =>
  pipe(
    O.fromUndefinedOr(selector.versionId),
    O.map((versionId) => ({ versionId })),
    O.getOrElse(R.empty)
  );

const optionalSplits = (selector: PhoenixDatasetSelector): { readonly splits?: string[] } =>
  pipe(
    O.fromUndefinedOr(selector.splits),
    O.map((splits) => ({ splits: A.fromIterable(splits) })),
    O.getOrElse(R.empty)
  );

const datasetSelectorExtras = (
  selector: PhoenixDatasetSelector
): { readonly splits?: string[]; readonly versionId?: string } => ({
  ...optionalSplits(selector),
  ...optionalVersionId(selector),
});

const datasetSelectorToSdk = (selector: PhoenixDatasetSelector): SdkDatasetSelector => {
  const extras = datasetSelectorExtras(selector);
  return PhoenixDatasetSelectorKind.$match(selector.kind, {
    "dataset-id": () => ({ datasetId: selector.value, ...extras }),
    "dataset-name": () => ({ datasetName: selector.value, ...extras }),
  });
};

const datasetSplitsToSdk = (splits: string | readonly string[] | null): string | string[] | null =>
  P.isString(splits) || P.isNull(splits) ? splits : A.fromIterable(splits);

const optionalDatasetExampleId = (example: PhoenixDatasetExample): { readonly id?: string } =>
  pipe(
    O.fromUndefinedOr(example.id),
    O.map((id) => ({ id })),
    O.getOrElse(R.empty)
  );

const optionalDatasetExampleOutput = (
  example: PhoenixDatasetExample
): { readonly output?: Record<string, unknown> | null } =>
  pipe(
    O.fromUndefinedOr(example.output),
    O.map((output) => ({ output: output === null ? null : toMutableRecord(output) })),
    O.getOrElse(R.empty)
  );

const optionalDatasetExampleSpanId = (example: PhoenixDatasetExample): { readonly spanId?: string | null } =>
  pipe(
    O.fromUndefinedOr(example.spanId),
    O.map((spanId) => ({ spanId })),
    O.getOrElse(R.empty)
  );

const optionalDatasetExampleSplits = (example: PhoenixDatasetExample): { readonly splits?: string | string[] | null } =>
  pipe(
    O.fromUndefinedOr(example.splits),
    O.map((splits) => ({ splits: datasetSplitsToSdk(splits) })),
    O.getOrElse(R.empty)
  );

const datasetExampleToSdk = (example: PhoenixDatasetExample): SdkDatasetExample => ({
  input: toMutableRecord(example.input),
  metadata: toMutableRecord(example.metadata),
  ...optionalDatasetExampleId(example),
  ...optionalDatasetExampleOutput(example),
  ...optionalDatasetExampleSpanId(example),
  ...optionalDatasetExampleSplits(example),
});

const promptSelectorToSdk = (selector: PhoenixPromptSelector): SdkPromptSelector => {
  const promptId = O.fromUndefinedOr(selector.promptId);
  if (O.isSome(promptId)) {
    return { promptId: promptId.value };
  }

  const versionId = O.fromUndefinedOr(selector.versionId);
  if (O.isSome(versionId)) {
    return { versionId: versionId.value };
  }

  const name = O.fromUndefinedOr(selector.name);
  const tag = O.fromUndefinedOr(selector.tag);
  if (O.isSome(name) && O.isSome(tag)) {
    return { name: name.value, tag: tag.value };
  }

  if (O.isSome(tag)) {
    return { name: O.getOrElse(name, thunkEmptyStr), tag: tag.value };
  }

  return { name: O.getOrElse(name, thunkEmptyStr) };
};

const promptSelectorHasValue = (selector: PhoenixPromptSelector): boolean =>
  O.isSome(O.fromUndefinedOr(selector.promptId)) ||
  O.isSome(O.fromUndefinedOr(selector.versionId)) ||
  O.isSome(O.fromUndefinedOr(selector.name)) ||
  O.isSome(O.fromUndefinedOr(selector.tag));

const experimentInfoResult = (experiment: {
  readonly datasetId: string;
  readonly datasetVersionId: string;
  readonly exampleCount: number;
  readonly failedRunCount: number;
  readonly id: string;
  readonly metadata: Record<string, unknown>;
  readonly missingRunCount: number;
  readonly projectName: string | null;
  readonly repetitions: number;
  readonly successfulRunCount: number;
}): PhoenixExperimentInfoResult =>
  PhoenixExperimentInfoResult.make({
    datasetId: experiment.datasetId,
    datasetVersionId: experiment.datasetVersionId,
    exampleCount: experiment.exampleCount,
    experimentId: experiment.id,
    failedRunCount: experiment.failedRunCount,
    metadata: experiment.metadata,
    missingRunCount: experiment.missingRunCount,
    projectName: experiment.projectName,
    repetitions: experiment.repetitions,
    successfulRunCount: experiment.successfulRunCount,
  });

const optionalLabel = (input: PhoenixAnnotationInput): { readonly label?: string } =>
  pipe(
    O.fromUndefinedOr(input.label),
    O.map((label) => ({ label })),
    O.getOrElse(R.empty)
  );

const optionalScore = (input: PhoenixAnnotationInput): { readonly score?: number } =>
  pipe(
    O.fromUndefinedOr(input.score),
    O.map((score) => ({ score })),
    O.getOrElse(R.empty)
  );

const optionalExplanation = (input: PhoenixAnnotationInput): { readonly explanation?: string } =>
  pipe(
    O.fromUndefinedOr(input.explanation),
    O.map((explanation) => ({ explanation })),
    O.getOrElse(R.empty)
  );

const optionalIdentifier = (input: PhoenixAnnotationInput): { readonly identifier?: string } =>
  pipe(
    O.fromUndefinedOr(input.identifier),
    O.map((identifier) => ({ identifier })),
    O.getOrElse(R.empty)
  );

const annotationBase = (input: PhoenixAnnotationInput) => ({
  annotatorKind: input.annotatorKind,
  metadata: toMutableRecord(input.metadata),
  name: input.name,
  ...optionalExplanation(input),
  ...optionalIdentifier(input),
  ...optionalLabel(input),
  ...optionalScore(input),
});

const optionalExperimentDatasetVersionId = (
  input: PhoenixExperimentCreateInput
): { readonly datasetVersionId?: string } =>
  pipe(
    O.fromUndefinedOr(input.datasetVersionId),
    O.map((datasetVersionId) => ({ datasetVersionId })),
    O.getOrElse(R.empty)
  );

const optionalExperimentName = (input: PhoenixExperimentCreateInput): { readonly experimentName?: string } =>
  pipe(
    O.fromUndefinedOr(input.experimentName),
    O.map((experimentName) => ({ experimentName })),
    O.getOrElse(R.empty)
  );

const optionalExperimentDescription = (
  input: PhoenixExperimentCreateInput
): { readonly experimentDescription?: string } =>
  pipe(
    O.fromUndefinedOr(input.experimentDescription),
    O.map((experimentDescription) => ({ experimentDescription })),
    O.getOrElse(R.empty)
  );

const optionalExperimentSplits = (input: PhoenixExperimentCreateInput): { readonly splits?: readonly string[] } =>
  pipe(
    O.fromUndefinedOr(input.splits),
    O.map((splits) => ({ splits })),
    O.getOrElse(R.empty)
  );

const optionalPromptDescription = (input: PhoenixPromptCreateInput): { readonly description?: string } =>
  pipe(
    O.fromUndefinedOr(input.description),
    O.map((description) => ({ description })),
    O.getOrElse(R.empty)
  );

const optionalPromptVersionDescription = (input: PhoenixPromptCreateInput): { readonly description?: string } =>
  pipe(
    O.fromUndefinedOr(input.versionDescription),
    O.map((description) => ({ description })),
    O.getOrElse(R.empty)
  );

const promptVersionInputBase = (input: PhoenixPromptCreateInput) => ({
  modelName: input.modelName,
  template: pipe(
    input.template,
    A.map((message) => ({ content: message.content, role: message.role }))
  ),
  templateFormat: input.templateFormat,
  ...optionalPromptVersionDescription(input),
});

const promptVersionForProvider = (input: PhoenixPromptCreateInput) => {
  const base = promptVersionInputBase(input);
  return PhoenixPromptModelProvider.$match(input.modelProvider, {
    AWS: () => promptVersion({ ...base, modelProvider: "AWS" }),
    AZURE_OPENAI: () => promptVersion({ ...base, modelProvider: "AZURE_OPENAI" }),
    DEEPSEEK: () => promptVersion({ ...base, modelProvider: "DEEPSEEK" }),
    GOOGLE: () => promptVersion({ ...base, modelProvider: "GOOGLE" }),
    OLLAMA: () => promptVersion({ ...base, modelProvider: "OLLAMA" }),
    OPENAI: () => promptVersion({ ...base, modelProvider: "OPENAI" }),
    XAI: () => promptVersion({ ...base, modelProvider: "XAI" }),
  });
};

const makePhoenixSdk = (config: ResolvedPhoenixConfig): PhoenixSdkShape => {
  const client = makeClient(config);

  return {
    addAnnotation: (input) =>
      PhoenixAnnotationTargetKind.$match(input.targetKind, {
        session: () =>
          addSessionAnnotation({
            client,
            sessionAnnotation: { ...annotationBase(input), sessionId: input.targetId },
            sync: input.sync,
          }),
        span: () =>
          addSpanAnnotation({
            client,
            spanAnnotation: { ...annotationBase(input), spanId: input.targetId },
            sync: input.sync,
          }),
        trace: () =>
          addTraceAnnotation({
            client,
            sync: input.sync,
            traceAnnotation: { ...annotationBase(input), traceId: input.targetId },
          }),
      }).then((result) =>
        PhoenixAnnotationWriteResult.make({
          annotationId: result?.id ?? null,
          name: input.name,
          targetId: input.targetId,
          targetKind: input.targetKind,
        })
      ),
    appendDatasetExamples: (input) =>
      appendDatasetExamples({
        client,
        dataset: datasetSelectorToSdk(input.dataset),
        examples: pipe(input.examples, A.map(datasetExampleToSdk)),
      }).then((result) => PhoenixDatasetAppendResult.make(result)),
    createDataset: (input) =>
      createDataset({
        client,
        description: input.description,
        examples: pipe(input.examples, A.map(datasetExampleToSdk)),
        name: input.name,
      }).then((result) => PhoenixDatasetCreateResult.make(result)),
    createExperiment: (input) =>
      createExperiment({
        client,
        datasetId: input.datasetId,
        experimentMetadata: toMutableRecord(input.experimentMetadata),
        repetitions: input.repetitions,
        ...optionalExperimentDatasetVersionId(input),
        ...optionalExperimentDescription(input),
        ...optionalExperimentName(input),
        ...optionalExperimentSplits(input),
      }).then(experimentInfoResult),
    createPrompt: (input) =>
      createPrompt({
        client,
        metadata: toMutableRecord(input.metadata),
        name: input.name,
        version: promptVersionForProvider(input),
        ...optionalPromptDescription(input),
      }).then((result) =>
        PhoenixPromptWriteResult.make({
          name: input.name,
          promptVersionId: result.id,
        })
      ),
    doctor: () =>
      client.getServerVersion().then((version) =>
        PhoenixDoctorResult.make({
          baseUrl: config.baseUrl,
          message: "Phoenix is reachable.",
          status: "passed",
          version: semanticVersionToString(version),
        })
      ),
    getDatasetExamples: (selector) =>
      getDatasetExamples({ client, dataset: datasetSelectorToSdk(selector) }).then((result) =>
        PhoenixDatasetExamplesResult.make({
          examples: pipe(
            result.examples,
            A.map((example) =>
              PhoenixDatasetExample.make({
                id: example.id,
                input: example.input,
                metadata: example.metadata ?? {},
                output: example.output ?? null,
                spanId: example.spanId ?? null,
                splits: example.splits ?? null,
              })
            )
          ),
          versionId: result.versionId,
        })
      ),
    getDatasetInfo: (selector) =>
      getDatasetInfo({ client, dataset: datasetSelectorToSdk(selector) }).then((result) =>
        PhoenixDatasetInfoResult.make({
          datasetId: result.id,
          description: result.description ?? null,
          metadata: result.metadata ?? {},
          name: result.name,
        })
      ),
    getExperimentInfo: (experimentId) => getExperimentInfo({ client, experimentId }).then(experimentInfoResult),
    getPrompt: (selector) =>
      getPrompt({ client, prompt: promptSelectorToSdk(selector) }).then((result) => {
        const prompt = O.fromNullishOr(result);
        return PhoenixPromptReadResult.make({
          exists: O.isSome(prompt),
          promptVersionId: pipe(
            prompt,
            O.map((value) => value.id),
            O.getOrNull
          ),
        });
      }),
  };
};

const logDriverFailure =
  (operation: PhoenixOperation) =>
  (error: PhoenixError): Effect.Effect<void> =>
    Effect.logDebug({
      cause: error.cause,
      operation,
      provider: "phoenix",
      reason: error.reason,
    });

const callSdk = Effect.fn("Phoenix.callSdk")(function* <A>(
  operation: PhoenixOperation,
  run: () => Promise<A>
): Effect.fn.Return<A, PhoenixError> {
  return yield* Effect.tryPromise({
    catch: (cause) => PhoenixError.operation(operation, "transport", { cause }),
    try: run,
  }).pipe(Effect.tapError(logDriverFailure(operation)));
});

const makeService = (sdk: PhoenixSdkShape): PhoenixShape => ({
  addAnnotation: (input) =>
    callSdk("addAnnotation", () => sdk.addAnnotation(input)).pipe(
      Effect.withSpan("Phoenix.addAnnotation", {
        attributes: {
          annotationName: input.name,
          targetKind: input.targetKind,
        },
      })
    ),
  appendDatasetExamples: (input) =>
    callSdk("appendDatasetExamples", () => sdk.appendDatasetExamples(input)).pipe(
      Effect.withSpan("Phoenix.appendDatasetExamples", {
        attributes: {
          datasetKind: input.dataset.kind,
          exampleCount: A.length(input.examples),
        },
      })
    ),
  createDataset: (input) =>
    callSdk("createDataset", () => sdk.createDataset(input)).pipe(
      Effect.withSpan("Phoenix.createDataset", {
        attributes: {
          exampleCount: A.length(input.examples),
          name: input.name,
        },
      })
    ),
  createExperiment: (input) =>
    callSdk("createExperiment", () => sdk.createExperiment(input)).pipe(
      Effect.withSpan("Phoenix.createExperiment", {
        attributes: {
          datasetId: input.datasetId,
        },
      })
    ),
  createPrompt: (input) =>
    callSdk("createPrompt", () => sdk.createPrompt(input)).pipe(
      Effect.withSpan("Phoenix.createPrompt", {
        attributes: {
          name: input.name,
        },
      })
    ),
  doctor: callSdk("doctor", sdk.doctor).pipe(Effect.withSpan("Phoenix.doctor")),
  getDatasetExamples: (selector) =>
    callSdk("getDatasetExamples", () => sdk.getDatasetExamples(selector)).pipe(
      Effect.withSpan("Phoenix.getDatasetExamples", {
        attributes: {
          datasetKind: selector.kind,
        },
      })
    ),
  getDatasetInfo: (selector) =>
    callSdk("getDatasetInfo", () => sdk.getDatasetInfo(selector)).pipe(
      Effect.withSpan("Phoenix.getDatasetInfo", {
        attributes: {
          datasetKind: selector.kind,
        },
      })
    ),
  getExperimentInfo: (experimentId) =>
    callSdk("getExperimentInfo", () => sdk.getExperimentInfo(experimentId)).pipe(
      Effect.withSpan("Phoenix.getExperimentInfo", {
        attributes: {
          experimentId,
        },
      })
    ),
  getPrompt: (selector) =>
    promptSelectorHasValue(selector)
      ? callSdk("getPrompt", () => sdk.getPrompt(selector)).pipe(Effect.withSpan("Phoenix.getPrompt"))
      : Effect.fail(
          PhoenixError.operation("getPrompt", "config", {
            cause: "Phoenix prompt selector requires promptId, versionId, name, or tag.",
          })
        ).pipe(Effect.withSpan("Phoenix.getPrompt")),
});

const makePhoenixFromEnvironment = Effect.fn("Phoenix.makePhoenixFromEnvironment")(function* () {
  const apiKey = yield* Config.redacted("PHOENIX_API_KEY").pipe(Config.option);
  const baseUrl = yield* Config.string("PHOENIX_HOST").pipe(Config.withDefault(PHOENIX_API_URL));
  const config = resolveConfig(
    PhoenixConfigInput.make({
      apiKey,
      baseUrl,
    })
  );

  return Phoenix.of(makeService(makePhoenixSdk(config)));
});

/**
 * Effect service for Phoenix datasets, prompts, experiments, and annotations.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import { Phoenix } from "@beep/phoenix"
 *
 * const program = Effect.gen(function* () {
 *   const phoenix = yield* Phoenix
 *   return yield* phoenix.doctor
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Phoenix extends Context.Service<Phoenix, PhoenixShape>()($I`Phoenix`) {
  /**
   * Build a Phoenix layer from explicit runtime configuration.
   *
   * @example
   * ```ts
   * import { Phoenix, PhoenixConfigInput } from "@beep/phoenix"
   *
   * const layer = Phoenix.makeLayer(PhoenixConfigInput.make({ baseUrl: "https://phoenix.test" }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config = PhoenixConfigInput.make({})): Layer.Layer<Phoenix> =>
    Layer.succeed(Phoenix, Phoenix.of(makeService(makePhoenixSdk(resolveConfig(config)))));

  /**
   * Build a Phoenix layer from an injected SDK adapter.
   *
   * @example
   * ```ts
   * import { Phoenix, type PhoenixSdkShape } from "@beep/phoenix"
   *
   * declare const sdk: PhoenixSdkShape
   * const layer = Phoenix.makeLayerWithSdk(sdk)
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerWithSdk = (sdk: PhoenixSdkShape): Layer.Layer<Phoenix> =>
    Layer.succeed(Phoenix, Phoenix.of(makeService(sdk)));

  /**
   * Live Phoenix layer backed by `PHOENIX_API_KEY` and optional `PHOENIX_HOST`.
   *
   * @example
   * ```ts
   * import { Phoenix } from "@beep/phoenix"
   *
   * const layer = Phoenix.layer
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Phoenix, PhoenixError> = Layer.effect(
    Phoenix,
    makePhoenixFromEnvironment().pipe(Effect.mapError((cause) => PhoenixError.operation("init", "config", { cause })))
  );
}
