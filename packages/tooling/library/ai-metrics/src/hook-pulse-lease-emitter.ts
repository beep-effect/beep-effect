/**
 * Deterministic HookPulseV1 to session-lease projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Eq from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HookPulseAgentKind, HookPulseEvent, HookPulseV1 } from "./hook-pulse.ts";
import { AiMetricsTranscriptSource } from "./models.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import { SessionLeaseEvent, SessionLeaseOpenWait } from "./session-lease.ts";
import { EvidenceTier, OipTaint, weakestEvidenceTier } from "./telemetry-v2.ts";
import type { Sha256Hex as Sha256HexType } from "@beep/schema";

const $I = $RepoAiMetricsId.create("hook-pulse-lease-emitter");
const projectionSchemaVersion = "telemetry-v2/hook-pulse-lease-projection/v1";

/**
 * Privacy-safe rows and source taint supplied to one lease projection.
 *
 * **Details**
 *
 * The input has no prompt, command, tool-argument, or tool-result field. Rows
 * are consumed in ledger append order so equal-millisecond events retain their
 * observed lifecycle order.
 *
 * **Example** (Inspect the required non-empty row set)
 *
 * ```ts
 * import { HookPulseLeaseProjectionInput } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseLeaseProjectionInput.fields.rows)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseLeaseProjectionInput extends S.Class<HookPulseLeaseProjectionInput>(
  $I`HookPulseLeaseProjectionInput`
)(
  {
    rows: S.NonEmptyArray(HookPulseV1),
    oipTaint: OipTaint,
  },
  $I.annote("HookPulseLeaseProjectionInput", {
    description: "Ordered privacy-safe hook rows and OIP taint used to derive one session lease projection.",
  })
) {}

/**
 * Bounded reason a hook history cannot be projected without inventing facts.
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseLeaseProjectionFailure = LiteralKit([
  "missing-session-start",
  "duplicate-session-start",
  "duplicate-session-end",
  "session-start-not-first",
  "session-end-not-last",
  "identity-mismatch",
  "time-regression",
  "permission-attribution-missing",
  "terminal-attribution-missing",
]).pipe(
  $I.annoteSchema("HookPulseLeaseProjectionFailure", {
    description: "Content-free refusal reasons for deterministic HookPulseV1 lease projection.",
  })
);

/**
 * Decoded lease-projection refusal reason.
 *
 * @category type-level
 * @since 0.0.0
 */
export type HookPulseLeaseProjectionFailure = typeof HookPulseLeaseProjectionFailure.Type;

class AcceptedHookPulseLeaseProjection extends S.Class<AcceptedHookPulseLeaseProjection>(
  $I`AcceptedHookPulseLeaseProjection`
)(
  {
    status: S.tag("accepted"),
    schemaVersion: S.Literal(projectionSchemaVersion),
    projectionDigest: Sha256Hex,
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    events: S.NonEmptyArray(SessionLeaseEvent),
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("AcceptedHookPulseLeaseProjection", {
    description: "Strictly attributed lease events derived from one ordered hook history.",
  })
) {}

class QuarantinedHookPulseLeaseProjection extends S.Class<QuarantinedHookPulseLeaseProjection>(
  $I`QuarantinedHookPulseLeaseProjection`
)(
  {
    status: S.tag("quarantined"),
    schemaVersion: S.Literal(projectionSchemaVersion),
    projectionDigest: Sha256Hex,
    sessionId: Sha256Hex,
    sourceKind: AiMetricsTranscriptSource,
    reason: HookPulseLeaseProjectionFailure,
    evidenceTier: EvidenceTier,
    oipTaint: OipTaint,
  },
  $I.annote("QuarantinedHookPulseLeaseProjection", {
    description: "Content-free refusal receipt for a hook history that cannot be projected without guessing.",
  })
) {}

/**
 * Accepted lease events or a content-free projection quarantine.
 *
 * **Example** (Recognize the two projection outcomes)
 *
 * ```ts
 * import { HookPulseLeaseProjection } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseLeaseProjection.members.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseLeaseProjection = S.Union([
  AcceptedHookPulseLeaseProjection,
  QuarantinedHookPulseLeaseProjection,
]).pipe(
  S.toTaggedUnion("status"),
  $I.annoteSchema("HookPulseLeaseProjection", {
    description: "Deterministic HookPulseV1 lease projection or an explicit no-guess quarantine.",
  }),
  SchemaUtils.withStatics((schema) => ({
    decodeJsonEffect: S.decodeUnknownEffect(S.fromJsonString(schema)),
    encodeJsonEffect: S.encodeUnknownEffect(S.fromJsonString(schema)),
  }))
);

/**
 * Decoded HookPulseV1 lease-projection outcome.
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseLeaseProjection = typeof HookPulseLeaseProjection.Type;

const HookPulseLeaseEmitterOperation = LiteralKit(["encode-row", "hash-event", "hash-wait", "hash-projection"]);

/**
 * Typed codec or digest failure at the lease-emitter boundary.
 *
 * **Example** (Name a digest failure)
 *
 * ```ts
 * import { HookPulseLeaseEmitterError } from "@beep/repo-ai-metrics"
 *
 * const error = HookPulseLeaseEmitterError.make({
 *   cause: "digest unavailable",
 *   message: "Failed to hash a hook-pulse event.",
 *   operation: "hash-event"
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class HookPulseLeaseEmitterError extends S.TaggedError<HookPulseLeaseEmitterError>(
  $I`HookPulseLeaseEmitterError`
)(
  "HookPulseLeaseEmitterError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: HookPulseLeaseEmitterOperation,
  },
  $I.annoteError<HookPulseLeaseEmitterError>("HookPulseLeaseEmitterError", {
    description: "Typed HookPulseV1 lease-emitter encoding or digest failure.",
  })
) {}

interface PreparedPulse {
  readonly eventDigest: Sha256HexType;
  readonly row: HookPulseV1;
  readonly waitId: O.Option<Sha256HexType>;
}

interface ToolAttempt {
  readonly claimed: boolean;
  readonly toolName: string;
  readonly waitId: Sha256HexType;
}

interface ProjectionState {
  readonly attempts: ReadonlyArray<ToolAttempt>;
  readonly events: ReadonlyArray<SessionLeaseEvent>;
  readonly failure: O.Option<HookPulseLeaseProjectionFailure>;
  readonly openWaitIds: ReadonlyArray<Sha256HexType>;
}

const emitterFailure = (
  operation: typeof HookPulseLeaseEmitterOperation.Type,
  message: string,
  cause: unknown
): HookPulseLeaseEmitterError => HookPulseLeaseEmitterError.make({ cause, message, operation });

const sourceKindFromAgent = HookPulseAgentKind.$match({
  "claude-code": AiMetricsTranscriptSource.thunk.claude,
  "codex-cli": AiMetricsTranscriptSource.thunk.codex,
});

const eventTier = (row: HookPulseV1): EvidenceTier => weakestEvidenceTier(["derived", row.evidenceTier]);

const hashEmitterText = (
  operation: typeof HookPulseLeaseEmitterOperation.Type,
  message: string,
  value: string
): Effect.Effect<Sha256HexType, HookPulseLeaseEmitterError> =>
  hashPublicTextSha256(value).pipe(Effect.mapError((cause) => emitterFailure(operation, message, cause)));

const preparePulse = Effect.fn("HookPulseLeaseEmitter.preparePulse")(function* (row: HookPulseV1) {
  const json = yield* HookPulseV1.encodeJsonEffect(row).pipe(
    Effect.mapError((cause) => emitterFailure("encode-row", "Failed to encode a hook-pulse row.", cause))
  );
  const eventDigest = yield* hashEmitterText(
    "hash-event",
    "Failed to hash a hook-pulse event.",
    `hook-pulse-event\u0000${json}`
  );
  const waitId = yield* O.match(O.filter(row.toolUseId, Str.isNonEmpty), {
    onNone: () => Effect.succeedNone,
    onSome: (toolUseId) =>
      hashEmitterText(
        "hash-wait",
        "Failed to hash a hook-pulse wait identity.",
        `hook-pulse-wait\u0000${row.sessionId}\u0000${toolUseId}`
      ).pipe(Effect.asSome),
  });
  return { row, eventDigest, waitId } satisfies PreparedPulse;
});

const identityMatches = (first: HookPulseV1, row: HookPulseV1): boolean =>
  Eq.equals(first.sessionId, row.sessionId) &&
  Eq.equals(first.agentKind, row.agentKind) &&
  Eq.equals(first.cwd, row.cwd) &&
  Eq.equals(first.instrumentClass, row.instrumentClass);

const hasTimeRegression = (rows: A.NonEmptyReadonlyArray<HookPulseV1>): boolean =>
  A.reduce(rows, { previous: DateTime.toEpochMillis(rows[0].ts), regressed: false }, (state, row) => {
    const current = DateTime.toEpochMillis(row.ts);
    return { previous: current, regressed: state.regressed || current < state.previous };
  }).regressed;

const commonEventFields = (pulse: PreparedPulse, oipTaint: OipTaint) => ({
  sessionId: pulse.row.sessionId,
  observedAt: pulse.row.ts,
  eventDigest: pulse.eventDigest,
  evidenceTier: eventTier(pulse.row),
  oipTaint,
});

const activityEvent = (pulse: PreparedPulse, oipTaint: OipTaint): SessionLeaseEvent =>
  SessionLeaseEvent.makeActivity(commonEventFields(pulse, oipTaint));

const appendActivity = (state: ProjectionState, pulse: PreparedPulse, oipTaint: OipTaint): ProjectionState => ({
  ...state,
  events: A.append(state.events, activityEvent(pulse, oipTaint)),
});

const openPermissionWait = (state: ProjectionState, pulse: PreparedPulse, oipTaint: OipTaint): ProjectionState =>
  O.match(pulse.row.toolName, {
    onNone: () => ({
      ...state,
      failure: O.some(HookPulseLeaseProjectionFailure.Enum["permission-attribution-missing"]),
    }),
    onSome: (toolName) =>
      O.match(
        A.findLastIndex(state.attempts, (attempt) => !attempt.claimed && Eq.equals(attempt.toolName, toolName)),
        {
          onNone: () => ({
            ...state,
            failure: O.some(HookPulseLeaseProjectionFailure.Enum["permission-attribution-missing"]),
          }),
          onSome: (attemptIndex) => {
            const attempt = state.attempts[attemptIndex];
            if (attempt === undefined) {
              return {
                ...state,
                failure: O.some(HookPulseLeaseProjectionFailure.Enum["permission-attribution-missing"]),
              };
            }
            const wait = SessionLeaseOpenWait.make({
              waitId: attempt.waitId,
              openedAt: pulse.row.ts,
              reason: pulse.row.waitReason,
              evidenceTier: eventTier(pulse.row),
              oipTaint,
            });
            return {
              ...state,
              attempts: A.map(state.attempts, (candidate, index) =>
                Eq.equals(index, attemptIndex) ? { ...candidate, claimed: true } : candidate
              ),
              events: A.append(
                state.events,
                SessionLeaseEvent.makeWaitOpened({
                  ...commonEventFields(pulse, oipTaint),
                  wait,
                })
              ),
              openWaitIds: A.append(state.openWaitIds, attempt.waitId),
            };
          },
        }
      ),
  });

const closePermissionWait = (state: ProjectionState, pulse: PreparedPulse, oipTaint: OipTaint): ProjectionState =>
  O.match(pulse.waitId, {
    onNone: () =>
      A.isReadonlyArrayNonEmpty(state.openWaitIds)
        ? { ...state, failure: O.some(HookPulseLeaseProjectionFailure.Enum["terminal-attribution-missing"]) }
        : appendActivity(state, pulse, oipTaint),
    onSome: (waitId) =>
      A.some(state.openWaitIds, Eq.equals(waitId))
        ? {
            ...state,
            events: A.append(
              state.events,
              SessionLeaseEvent.makeWaitClosed({
                ...commonEventFields(pulse, oipTaint),
                waitId,
                executionDurationMs: O.getOrElse(pulse.row.durationMs, () => 0),
              })
            ),
            openWaitIds: A.filter(state.openWaitIds, (candidate) => !Eq.equals(candidate, waitId)),
          }
        : appendActivity(state, pulse, oipTaint),
  });

const projectPreparedPulse = (state: ProjectionState, pulse: PreparedPulse, oipTaint: OipTaint): ProjectionState => {
  if (O.isSome(state.failure)) return state;

  return HookPulseEvent.$match(pulse.row.hookEvent, {
    SessionStart: () => ({
      ...state,
      events: A.append(
        state.events,
        SessionLeaseEvent.makeStarted({
          ...commonEventFields(pulse, oipTaint),
          sourceKind: sourceKindFromAgent(pulse.row.agentKind),
          instrumentClass: pulse.row.instrumentClass,
        })
      ),
    }),
    PreToolUse: () => {
      const renewed = appendActivity(state, pulse, oipTaint);
      return O.match(pulse.row.toolName, {
        onNone: () => renewed,
        onSome: (toolName) =>
          O.match(pulse.waitId, {
            onNone: () => renewed,
            onSome: (waitId) => ({
              ...renewed,
              attempts: A.append(renewed.attempts, { claimed: false, toolName, waitId }),
            }),
          }),
      });
    },
    PermissionRequest: () => openPermissionWait(state, pulse, oipTaint),
    PostToolUse: () => closePermissionWait(state, pulse, oipTaint),
    PostToolUseFailure: () => closePermissionWait(state, pulse, oipTaint),
    Notification: () => appendActivity(state, pulse, oipTaint),
    UserPromptSubmit: () => appendActivity(state, pulse, oipTaint),
    Stop: () => appendActivity(state, pulse, oipTaint),
    SessionEnd: () => ({
      ...state,
      events: A.append(state.events, SessionLeaseEvent.makeEnded(commonEventFields(pulse, oipTaint))),
    }),
    PermissionDenied: () => closePermissionWait(state, pulse, oipTaint),
  });
};

const quarantineReason = (rows: A.NonEmptyReadonlyArray<HookPulseV1>): O.Option<HookPulseLeaseProjectionFailure> => {
  const startRows = A.filter(rows, (row) => HookPulseEvent.is.SessionStart(row.hookEvent));
  const endRows = A.filter(rows, (row) => HookPulseEvent.is.SessionEnd(row.hookEvent));
  if (!A.isReadonlyArrayNonEmpty(startRows)) {
    return O.some(HookPulseLeaseProjectionFailure.Enum["missing-session-start"]);
  }
  if (A.length(startRows) > 1) return O.some(HookPulseLeaseProjectionFailure.Enum["duplicate-session-start"]);
  if (A.length(endRows) > 1) return O.some(HookPulseLeaseProjectionFailure.Enum["duplicate-session-end"]);
  if (!HookPulseEvent.is.SessionStart(rows[0].hookEvent)) {
    return O.some(HookPulseLeaseProjectionFailure.Enum["session-start-not-first"]);
  }
  if (A.isReadonlyArrayNonEmpty(endRows) && !HookPulseEvent.is.SessionEnd(A.lastNonEmpty(rows).hookEvent)) {
    return O.some(HookPulseLeaseProjectionFailure.Enum["session-end-not-last"]);
  }
  if (!A.every(rows, (row) => identityMatches(rows[0], row))) {
    return O.some(HookPulseLeaseProjectionFailure.Enum["identity-mismatch"]);
  }
  return hasTimeRegression(rows) ? O.some(HookPulseLeaseProjectionFailure.Enum["time-regression"]) : O.none();
};

/**
 * Project one ordered HookPulseV1 history into exact session-lease events.
 *
 * **Details**
 *
 * Every row renews liveness. `PermissionRequest` claims the nearest preceding
 * unpaired `PreToolUse` with the same tool name; only a terminal carrying that
 * attempt's exact tool-use digest closes the wait. Missing or contradictory
 * attribution returns a content-free quarantine instead of choosing a default.
 *
 * **Example** (Run a privacy-safe projection)
 *
 * ```ts
 * import { projectHookPulseLease } from "@beep/repo-ai-metrics"
 *
 * console.log(projectHookPulseLease)
 * ```
 *
 * @param input - Ordered rows for exactly one hook session plus source OIP taint.
 * @returns Accepted lease events or a no-guess quarantine receipt.
 * @category utilities
 * @since 0.0.0
 */
export const projectHookPulseLease: (
  input: HookPulseLeaseProjectionInput
) => Effect.Effect<HookPulseLeaseProjection, HookPulseLeaseEmitterError> = Effect.fn(
  "HookPulseLeaseEmitter.projectHookPulseLease"
)(function* (input) {
  const prepared = yield* Effect.forEach(input.rows, preparePulse, { concurrency: 4 });
  const projectionDigest = yield* hashEmitterText(
    "hash-projection",
    "Failed to hash a hook-pulse lease projection.",
    `hook-pulse-lease-projection\u0000${A.join(
      A.map(prepared, (pulse) => pulse.eventDigest),
      "\u0000"
    )}`
  );
  const first = input.rows[0];
  const sourceKind = sourceKindFromAgent(first.agentKind);
  const evidenceTier = weakestEvidenceTier(["derived", ...A.map(input.rows, (row) => row.evidenceTier)]);
  const common = {
    schemaVersion: projectionSchemaVersion,
    projectionDigest,
    sessionId: first.sessionId,
    sourceKind,
    evidenceTier,
    oipTaint: input.oipTaint,
  } as const;

  const initialFailure = quarantineReason(input.rows);
  if (O.isSome(initialFailure)) {
    return QuarantinedHookPulseLeaseProjection.make({ ...common, reason: initialFailure.value });
  }

  const initial: ProjectionState = {
    attempts: [],
    events: [],
    failure: O.none<HookPulseLeaseProjectionFailure>(),
    openWaitIds: [],
  };
  const projected = A.reduce(prepared, initial, (state, pulse) => projectPreparedPulse(state, pulse, input.oipTaint));

  if (O.isSome(projected.failure)) {
    return QuarantinedHookPulseLeaseProjection.make({ ...common, reason: projected.failure.value });
  }

  return A.match(projected.events, {
    onEmpty: () =>
      QuarantinedHookPulseLeaseProjection.make({
        ...common,
        reason: HookPulseLeaseProjectionFailure.Enum["missing-session-start"],
      }),
    onNonEmpty: (events) => AcceptedHookPulseLeaseProjection.make({ ...common, events }),
  });
});
