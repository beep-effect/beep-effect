#!/usr/bin/env bun
/**
 * One explicitly enrolled managed CLI, one fixed synthetic turn, then verified close.
 * No provider text, protocol payload, native identifier or diagnostic body is exported.
 * @packageDocumentation
 * @since 0.0.0
 */
import { AiProviderCliSession, ManagedProvider, ManagedSessionMessage } from "@beep/ai-provider-cli";
import { $RepoCliId } from "@beep/identity/packages";
import { ObservationLaunchFact } from "@beep/repo-ai-metrics/observation-launch-facts";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { requirePrivateAgentPath } from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.layer.ts";
import {
  AgentObservationRequest,
  openAgentMessageSession,
  recoverAgentObservation,
} from "../../../packages/tooling/tool/cli/src/commands/AgentMessage/AgentMessage.observation.ts";

const $I = $RepoCliId.create("goals/harness-telemetry-enrollment/ops/cli-enrollment-canary");

/**
 * Content-free failure; the original attempt must be reconciled before another launch.
 * **Example** (Inspect a safe failure phase)
 *
 * ```ts
 * const failure = CliEnrollmentCanaryError.make({ phase: "close" });
 * console.log(failure.phase);
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CliEnrollmentCanaryError extends S.TaggedError<
  CliEnrollmentCanaryError,
  { readonly brand: unique symbol }
>($I`CliEnrollmentCanaryError`)(
  "CliEnrollmentCanaryError",
  { phase: S.Literals(["input", "open", "turn", "terminal", "response", "close", "deadline", "unresolved"]) },
  $I.annote("CliEnrollmentCanaryError", { description: "Fixed failure phase without source content or causes." })
) {}

/**
 * Successful request/close evidence only; token usage and backend visibility stay unknown.
 * **Example** (Inspect an unknown usage result)
 *
 * ```ts
 * const report = CliEnrollmentCanaryReport.make({ provider: "codex" });
 * console.log(report.usage);
 * ```
 * @category models
 * @since 0.0.0
 */
export class CliEnrollmentCanaryReport extends S.Opaque<CliEnrollmentCanaryReport, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("cli-enrollment-canary/v1"),
    provider: ManagedProvider,
    status: S.tag("terminal-verified-and-closed"),
    response: S.tag("exact-constant-matched"),
    usage: S.tag("Unknown"),
    backendVisibility: S.tag("Unknown"),
  }).pipe(
    $I.annoteSchema("CliEnrollmentCanaryReport", {
      description: "Bounded allowlisted result, deliberately excluding native output and identifiers.",
    })
  )
) {}

const controlledMessage = ManagedSessionMessage.make({
  messageId: "harness-enrollment-fixed-canary-v1",
  text: "Reply with ENROLLMENT_CANARY_OK only. Do not use tools or read any files.",
});

/**
 * Reuse the existing independent claim fence and lifecycle integration exactly once.
 *
 * The deadline interrupts the turn inside its owning scope; existing finalizers
 * close the child. No retry or event subscription exists. Logs are disabled here
 * because adapter debug stderr is outside this metadata-only report boundary.
 *
 * **Example** (Build the explicitly enrolled canary effect)
 *
 * ```ts
 * const canary = runCliEnrollmentCanary(request);
 * console.log(Effect.isEffect(canary));
 * ```
 * @param request - Existing explicitly enrolled, private managed launch request.
 * @returns A safe report after a correlated terminal receipt and actual child close.
 * @category verification
 * @since 0.0.0
 */
export const runCliEnrollmentCanary = Effect.fn("HarnessEnrollment.runCliCanary")(
  function* (request: AgentObservationRequest) {
    if (O.isNone(request.enrollmentDirectory) || A.isReadonlyArrayNonEmpty(request.profile.tools))
      return yield* CliEnrollmentCanaryError.make({ phase: "input" });
    const session = yield* openAgentMessageSession(request).pipe(
      Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "open" }))
    );
    // Exit capture allows explicit close even when this one turn fails.
    const terminal = yield* session.prompt(controlledMessage).pipe(
      Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "turn" })),
      Effect.exit
    );
    yield* session.close.pipe(Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "close" })));
    const running = yield* session.process.isRunning.pipe(
      Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "close" }))
    );
    if (running) return yield* CliEnrollmentCanaryError.make({ phase: "close" });
    const local = yield* recoverAgentObservation(request.enrollmentDirectory.value, "status").pipe(
      Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "close" }))
    );
    const finished = A.last(local.outbox.submissions).pipe(
      O.map((submission) => submission.fact),
      O.filter(ObservationLaunchFact.guards.Finished)
    );
    if (O.isNone(finished) || (finished.value.outcome !== "succeeded" && finished.value.outcome !== "cancelled"))
      return yield* CliEnrollmentCanaryError.make({ phase: "close" });
    const result = yield* terminal;
    if (O.isNone(result.terminalEvidence)) return yield* CliEnrollmentCanaryError.make({ phase: "terminal" });
    const evidence = result.terminalEvidence.value;
    if (
      evidence.adapter !== request.profile.provider ||
      evidence.sessionId !== session.identity.sessionId ||
      evidence.messageId !== controlledMessage.messageId ||
      result.messageId !== controlledMessage.messageId ||
      evidence.stopReason !== result.stopReason
    )
      return yield* CliEnrollmentCanaryError.make({ phase: "terminal" });
    if (result.text !== "ENROLLMENT_CANARY_OK") return yield* CliEnrollmentCanaryError.make({ phase: "response" });
    return CliEnrollmentCanaryReport.make({ provider: request.profile.provider });
  },
  (effect) =>
    effect.pipe(
      Effect.timeoutOrElse({
        duration: Duration.seconds(90),
        orElse: () => Effect.fail(CliEnrollmentCanaryError.make({ phase: "deadline" })),
      }),
      Effect.scoped,
      Effect.provide(Logger.layer([]))
    )
);

const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.NonEmptyString]));
const decodeRequest = S.decodeEffect(S.fromJsonString(AgentObservationRequest));
const encodeReport = S.encodeEffect(S.fromJsonString(CliEnrollmentCanaryReport));

const program = Effect.gen(function* () {
  const [requestFile] = yield* decodeArguments(A.drop(process.argv, 2)).pipe(
    Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "input" }))
  );
  yield* requirePrivateAgentPath(requestFile, "File").pipe(
    Effect.mapError(() => CliEnrollmentCanaryError.make({ phase: "input" }))
  );
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.lstat(requestFile);
  if (!O.contains(process.geteuid?.() ?? -1)(info.uid) || info.size > 65536n)
    return yield* CliEnrollmentCanaryError.make({ phase: "input" });
  const request = yield* fs.readFileString(requestFile).pipe(Effect.flatMap(decodeRequest));
  const report = yield* runCliEnrollmentCanary(request);
  yield* Console.log(yield* encodeReport(report));
});

if (import.meta.main)
  NodeRuntime.runMain(
    program.pipe(
      Effect.provide(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, AiProviderCliSession.layer)),
      Effect.catchCause(() => Effect.fail(CliEnrollmentCanaryError.make({ phase: "unresolved" }))),
      Effect.tapError(() => Console.error("Enrollment canary unresolved; retain and reconcile the original attempt."))
    ),
    { disableErrorReporting: true }
  );
