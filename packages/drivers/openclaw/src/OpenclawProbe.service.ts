/**
 * HTTP liveness and readiness probes for the OpenClaw gateway.
 *
 * Probes never fail: any 2xx response maps to `healthy` while non-2xx
 * responses, transport failures, and timeouts collapse to `unreachable`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Effect, Number as N, pipe, String as Str } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/unstable/http";
import { OPENCLAW_HTTP_PROBE_TIMEOUT } from "./Openclaw.config.ts";
import {
  OpenclawDiagnosticText,
  OpenclawHttpProbe,
  OpenclawLiveAcceptanceFailed,
  OpenclawLiveAcceptancePassed,
  OpenclawLocalModels,
} from "./Openclaw.models.ts";
import type { Duration } from "effect";
import type {
  OpenclawLiveAcceptanceInput,
  OpenclawLiveAcceptanceResult,
  OpenclawLiveAcceptanceStep,
} from "./Openclaw.models.ts";

const defaultProbeHost = "127.0.0.1";

const probeEndpoint = Effect.fnUntraced(function* (input: {
  readonly host: string;
  readonly path: string;
  readonly port: number;
  readonly timeout: Duration.Input;
}): Effect.fn.Return<OpenclawHttpProbe, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const endpoint = `http://${input.host}:${input.port}${input.path}`;
  const response = yield* client
    .execute(HttpClientRequest.get(endpoint))
    .pipe(Effect.timeoutOption(input.timeout), Effect.orElseSucceed(O.none<HttpClientResponse.HttpClientResponse>));
  const healthy = pipe(
    response,
    O.map((httpResponse) => N.between(httpResponse.status, { minimum: 200, maximum: 299 })),
    O.getOrElse(() => false)
  );

  return OpenclawHttpProbe.make({
    endpoint,
    httpStatus: O.map(response, (httpResponse) => httpResponse.status),
    status: healthy ? "healthy" : "unreachable",
  });
});

interface OpenclawEndpointProbeInput {
  readonly host?: string | undefined;
  readonly path?: string | undefined;
  readonly port: number;
  readonly timeout?: Duration.Input | undefined;
}

const makeEndpointProbe = (spanName: string, defaultPath: string) =>
  Effect.fn(spanName)(function* (
    input: OpenclawEndpointProbeInput
  ): Effect.fn.Return<OpenclawHttpProbe, never, HttpClient.HttpClient> {
    return yield* probeEndpoint({
      host: input.host ?? defaultProbeHost,
      path: input.path ?? defaultPath,
      port: input.port,
      timeout: input.timeout ?? OPENCLAW_HTTP_PROBE_TIMEOUT,
    });
  });

/**
 * Probe the OpenClaw gateway liveness endpoint over loopback HTTP.
 *
 * @example
 * ```ts
 * import { probeOpenclawLiveness } from "@beep/openclaw/OpenclawProbe.service"
 *
 * const program = probeOpenclawLiveness({ port: 19031 })
 * console.log(program)
 * ```
 *
 * @effects Performs one HTTP GET request and converts transport failure or timeout to `unreachable`.
 * @category clients
 * @since 0.0.0
 */
export const probeOpenclawLiveness = makeEndpointProbe("Openclaw.probeLiveness", "/health");

/**
 * Probe the OpenClaw gateway readiness endpoint over loopback HTTP.
 *
 * The default `/ready` path is the fallback readiness literal; upstream also
 * serves `/readyz` and `/healthz`, which callers can select via `path`.
 *
 * @example
 * ```ts
 * import { probeOpenclawReadiness } from "@beep/openclaw/OpenclawProbe.service"
 *
 * const program = probeOpenclawReadiness({ path: "/readyz", port: 19031 })
 * console.log(program)
 * ```
 *
 * @effects Performs one HTTP GET request and converts transport failure or timeout to `unreachable`.
 * @category clients
 * @since 0.0.0
 */
export const probeOpenclawReadiness = makeEndpointProbe("Openclaw.probeReadiness", "/ready");

const sameString = S.toEquivalence(S.String);
const acceptanceFailure = (step: OpenclawLiveAcceptanceStep, diagnostics: string): OpenclawLiveAcceptanceFailed =>
  OpenclawLiveAcceptanceFailed.make({
    _tag: "Failed",
    diagnostics: OpenclawDiagnosticText.fromUnknown(diagnostics),
    step,
  });

/**
 * Probe a local OpenAI-compatible `/models` endpoint and require one exact model id.
 *
 * @category clients
 * @since 0.0.0
 */
export const probeOpenclawLocalModels = Effect.fn("Openclaw.probeLocalModels")(function* (input: {
  readonly baseUrl: string;
  readonly modelId: string;
  readonly timeout?: Duration.Input | undefined;
}): Effect.fn.Return<OpenclawLiveAcceptanceResult, never, HttpClient.HttpClient> {
  const client = yield* HttpClient.HttpClient;
  const endpoint = `${input.baseUrl}/models`;
  const models = yield* client
    .execute(HttpClientRequest.get(endpoint))
    .pipe(
      Effect.flatMap(HttpClientResponse.schemaBodyJson(OpenclawLocalModels)),
      Effect.timeoutOption(input.timeout ?? OPENCLAW_HTTP_PROBE_TIMEOUT),
      Effect.orElseSucceed(O.none<OpenclawLocalModels>)
    );
  return O.match(models, {
    onNone: () => acceptanceFailure("local-model", "Local /models request or schema decode failed."),
    onSome: (inventory) =>
      A.some(inventory.data, (model) => sameString(model.id, input.modelId))
        ? OpenclawLiveAcceptancePassed.make({ _tag: "Passed", steps: ["local-model"] })
        : acceptanceFailure("local-model", "Local /models omitted the configured model id."),
  });
});

/**
 * Coordinate already-decoded P3 acceptance results without performing mutation.
 *
 * @category utilities
 * @since 0.0.0
 */
export const coordinateOpenclawLiveAcceptance = (input: OpenclawLiveAcceptanceInput): OpenclawLiveAcceptanceResult => {
  const hostedOk =
    sameString(input.hostedTurn.status, "ok") &&
    O.exists(input.hostedTurn.text, (text) => sameString(text, "P3_MODEL_OK")) &&
    O.exists(input.hostedTurn.runId, Str.isNonEmpty) &&
    O.exists(input.hostedTurn.stopReason, (reason) => sameString(reason, "stop")) &&
    O.exists(input.hostedTurn.aborted, (aborted) => !aborted) &&
    O.exists(input.hostedTurn.provider, (provider) => sameString(provider, input.hostedProviderId)) &&
    O.exists(input.hostedTurn.model, (model) => sameString(model, input.hostedModelId));
  const localOk = A.some(input.localModels.data, (model) => sameString(model.id, input.localModelId));
  const eligibleProofSkills = A.filter(
    input.skillInventory.skills,
    (skill) =>
      skill.eligible && sameString(skill.name, "beep-proof-ping") && sameString(skill.source, "openclaw-workspace")
  );
  const skillOk =
    A.length(eligibleProofSkills) === 1 &&
    sameString(input.skillTurn.status, "ok") &&
    O.exists(input.skillTurn.text, (text) => sameString(text, "P3_SKILL_OK"));
  const reloadOk = P.isTagged("Reloaded")(input.restoredReload) && input.restoredReload.warningCount === 0;
  const channelOk =
    A.length(input.channelAccounts) === 1 &&
    sameString(input.channelAccounts[0]?.accountId ?? "", "default") &&
    O.exists(input.channelAccounts[0]?.probeOk ?? O.none(), (ok) => ok) &&
    O.isNone(input.channelAccounts[0]?.probeError ?? O.none());
  const failures = A.getSomes([
    hostedOk ? O.none() : O.some(acceptanceFailure("hosted-model", "Hosted model assertion failed.")),
    localOk ? O.none() : O.some(acceptanceFailure("local-model", "Local model assertion failed.")),
    skillOk ? O.none() : O.some(acceptanceFailure("skill", "Proof skill assertion failed.")),
    reloadOk ? O.none() : O.some(acceptanceFailure("reload", "Restored reload assertion failed.")),
    channelOk && input.telegramSend.payload.ok
      ? O.none()
      : O.some(acceptanceFailure("telegram", "Telegram send or channel assertion failed.")),
  ]);
  return O.getOrElse(A.head(failures), () =>
    OpenclawLiveAcceptancePassed.make({
      _tag: "Passed",
      steps: ["hosted-model", "local-model", "skill", "reload", "telegram"],
    })
  );
};
