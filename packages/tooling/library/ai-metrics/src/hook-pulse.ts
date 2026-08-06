/**
 * Schema-first hook-pulse ledger contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegNum, Sha256Hex } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Effect, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { hashPrivateIdentifier } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("hook-pulse");

/**
 * Version identifier for hook-pulse ledger records.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseSchemaVersion } from "@beep/repo-ai-metrics"
 * console.log(HookPulseSchemaVersion.Enum["hook-pulse/v1"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseSchemaVersion = LiteralKit(["hook-pulse/v1"]).pipe(
  $I.annoteSchema("HookPulseSchemaVersion", {
    description: "Version identifiers accepted by the hook-pulse ledger contract.",
  })
);

/**
 * Runtime type for {@link HookPulseSchemaVersion}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseSchemaVersion } from "@beep/repo-ai-metrics"
 * const version: HookPulseSchemaVersion = "hook-pulse/v1"
 * console.log(version)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseSchemaVersion = typeof HookPulseSchemaVersion.Type;

/**
 * Coding-agent harnesses that can emit hook-pulse records.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseAgentKind } from "@beep/repo-ai-metrics"
 * console.log(HookPulseAgentKind.Enum["claude-code"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseAgentKind = LiteralKit(["claude-code", "codex-cli"]).pipe(
  $I.annoteSchema("HookPulseAgentKind", {
    description: "Coding-agent harnesses that emit hook-pulse ledger records.",
  })
);

/**
 * Runtime type for {@link HookPulseAgentKind}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseAgentKind } from "@beep/repo-ai-metrics"
 * const agentKind: HookPulseAgentKind = "codex-cli"
 * console.log(agentKind)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseAgentKind = typeof HookPulseAgentKind.Type;

/**
 * Hook events recorded by the sequence-break instrument.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseEvent } from "@beep/repo-ai-metrics"
 * console.log(HookPulseEvent.Enum.PreToolUse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseEvent = LiteralKit([
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "Notification",
  "UserPromptSubmit",
  "Stop",
  "SessionEnd",
  "PermissionDenied",
]).pipe(
  $I.annoteSchema("HookPulseEvent", {
    description: "Hook lifecycle events retained by the hook-pulse ledger.",
  })
);

/**
 * Runtime type for {@link HookPulseEvent}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseEvent } from "@beep/repo-ai-metrics"
 * const hookEvent: HookPulseEvent = "SessionEnd"
 * console.log(hookEvent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseEvent = typeof HookPulseEvent.Type;

/**
 * Experimental role of a hook-pulse emitting session.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseInstrumentClass } from "@beep/repo-ai-metrics"
 * console.log(HookPulseInstrumentClass.Enum.spike)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseInstrumentClass = LiteralKit(["production", "spike", "meta"]).pipe(
  $I.annoteSchema("HookPulseInstrumentClass", {
    description: "Experimental role used to exclude spike and meta sessions from default baselines.",
  })
);

/**
 * Runtime type for {@link HookPulseInstrumentClass}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseInstrumentClass } from "@beep/repo-ai-metrics"
 * const instrumentClass: HookPulseInstrumentClass = "production"
 * console.log(instrumentClass)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseInstrumentClass = typeof HookPulseInstrumentClass.Type;

/**
 * Confidence tier carried by a hook-pulse observation.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseEvidenceTier } from "@beep/repo-ai-metrics"
 * console.log(HookPulseEvidenceTier.Enum.observed)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseEvidenceTier = LiteralKit(["observed", "derived", "heuristic", "unknown"]).pipe(
  $I.annoteSchema("HookPulseEvidenceTier", {
    description: "Weakest-link evidence confidence attached to a hook-pulse record.",
  })
);

/**
 * Runtime type for {@link HookPulseEvidenceTier}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseEvidenceTier } from "@beep/repo-ai-metrics"
 * const evidenceTier: HookPulseEvidenceTier = "unknown"
 * console.log(evidenceTier)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseEvidenceTier = typeof HookPulseEvidenceTier.Type;

/**
 * Wait attribution attached to a hook-pulse event.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseWaitReason } from "@beep/repo-ai-metrics"
 * console.log(HookPulseWaitReason.Enum["plan-approval"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseWaitReason = LiteralKit([
  "plan-approval",
  "tool-permission",
  "idle-input",
  "none",
  "unknown",
]).pipe(
  $I.annoteSchema("HookPulseWaitReason", {
    description: "Observed or explicitly unknown reason that an agent session is waiting.",
  })
);

/**
 * Runtime type for {@link HookPulseWaitReason}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseWaitReason } from "@beep/repo-ai-metrics"
 * const waitReason: HookPulseWaitReason = "idle-input"
 * console.log(waitReason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseWaitReason = typeof HookPulseWaitReason.Type;

/**
 * Content-free notification categories retained by the hook-pulse writer.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseNotificationType } from "@beep/repo-ai-metrics"
 * console.log(HookPulseNotificationType.Enum.idle_prompt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseNotificationType = LiteralKit(["permission_prompt", "idle_prompt"]).pipe(
  $I.annoteSchema("HookPulseNotificationType", {
    description: "Stable notification categories retained without notification message content.",
  })
);

/**
 * Runtime type for {@link HookPulseNotificationType}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseNotificationType } from "@beep/repo-ai-metrics"
 * const notificationType: HookPulseNotificationType = "permission_prompt"
 * console.log(notificationType)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseNotificationType = typeof HookPulseNotificationType.Type;

/**
 * Content-free fields forwarded from a coding-agent hook payload.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseRawEvent } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const rawEvent = S.decodeUnknownEffect(HookPulseRawEvent)({
 *   session_id: "session-1",
 *   hook_event_name: "PermissionRequest",
 *   cwd: "/workspace/beep-effect2",
 *   tool_name: "ExitPlanMode",
 *   transcript_path: "/tmp/claude/session-1.jsonl"
 * })
 * console.log(rawEvent)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseRawEvent extends S.Class<HookPulseRawEvent>($I`HookPulseRawEvent`)(
  {
    session_id: S.NonEmptyString,
    hook_event_name: HookPulseEvent,
    cwd: S.String,
    tool_name: S.OptionFromOptionalKey(S.String),
    tool_use_id: S.OptionFromOptionalKey(S.String),
    prompt_id: S.OptionFromOptionalKey(S.String),
    transcript_path: S.String,
    permission_mode: S.OptionFromOptionalKey(S.String),
    notification_type: S.OptionFromOptionalKey(S.String),
    duration_ms: S.OptionFromOptionalKey(NonNegNum),
    reason: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("HookPulseRawEvent", {
    description: "Whitelisted non-content fields forwarded from a coding-agent hook payload.",
  })
) {}

class HookPulseRawEventInput extends S.Class<HookPulseRawEventInput>($I`HookPulseRawEventInput`)(
  {
    event: HookPulseRawEvent,
    notifierRev: S.String,
    instrumentClass: HookPulseInstrumentClass,
    agentKind: HookPulseAgentKind,
    evidenceTier: HookPulseEvidenceTier,
    ts: S.String,
  },
  $I.annote("HookPulseRawEventInput", {
    description: "Raw hook payload paired with the ambient stamps supplied by its writer.",
  })
) {}

const derivePermissionWaitReason = (toolName: O.Option<string>): HookPulseWaitReason =>
  O.match(toolName, {
    onNone: HookPulseWaitReason.thunk.unknown,
    onSome: (name) =>
      Bool.match(Eq.equals(name, "ExitPlanMode"), {
        onFalse: HookPulseWaitReason.thunk["tool-permission"],
        onTrue: HookPulseWaitReason.thunk["plan-approval"],
      }),
  });

const deriveWaitReason = (
  hookEvent: HookPulseEvent,
  toolName: O.Option<string>,
  notificationType: O.Option<string>
): HookPulseWaitReason =>
  HookPulseEvent.$match(hookEvent, {
    PreToolUse: HookPulseWaitReason.thunk.none,
    PermissionRequest: () => derivePermissionWaitReason(toolName),
    PostToolUse: HookPulseWaitReason.thunk.none,
    Notification: () =>
      Bool.match(O.exists(notificationType, HookPulseNotificationType.is.idle_prompt), {
        onFalse: HookPulseWaitReason.thunk.unknown,
        onTrue: HookPulseWaitReason.thunk["idle-input"],
      }),
    UserPromptSubmit: HookPulseWaitReason.thunk.none,
    Stop: HookPulseWaitReason.thunk.none,
    SessionEnd: HookPulseWaitReason.thunk.none,
    PermissionDenied: HookPulseWaitReason.thunk.none,
  });

const clampDerivedEvidenceTier = (evidenceTier: HookPulseEvidenceTier): HookPulseEvidenceTier =>
  HookPulseEvidenceTier.$match(evidenceTier, {
    observed: HookPulseEvidenceTier.thunk.derived,
    derived: HookPulseEvidenceTier.thunk.derived,
    heuristic: HookPulseEvidenceTier.thunk.heuristic,
    unknown: HookPulseEvidenceTier.thunk.unknown,
  });

const isHookPulseNotificationType = S.is(HookPulseNotificationType);
const areHookPulseEventsEquivalent = S.toEquivalence(HookPulseEvent);
const areHookPulseWaitReasonsEquivalent = S.toEquivalence(HookPulseWaitReason);
const sha256HexPattern = /^[0-9a-f]{64}$/u;
const privateReference = (value: string) =>
  sha256HexPattern.test(value)
    ? Effect.succeed(Sha256Hex.make(value))
    : hashPrivateIdentifier(value, undefined).pipe(Effect.map(Sha256Hex.make));

// Only fields semantically bound to exactly one event belong here. `toolName`,
// `toolUseId`, and `durationMs` are deliberately left unconstrained: their
// presence varies by harness version — a measured `PermissionRequest` carries
// `tool_name` but no `tool_use_id`, while `PreToolUse` and `PostToolUse` carry
// both — so binding them to an event would reject legitimate future rows, and
// rejecting rows costs real telemetry.
const HookPulseEventOwnedField = LiteralKit(["notificationType", "sessionEndReason"]).pipe(
  $I.annoteSchema("HookPulseEventOwnedField", {
    description: "Canonical hook-pulse fields whose meaning is owned by exactly one hook event.",
  })
);
type HookPulseEventOwnedField = typeof HookPulseEventOwnedField.Type;

const hookPulseEventOwningField = HookPulseEventOwnedField.$match({
  notificationType: HookPulseEvent.thunk.Notification,
  sessionEndReason: HookPulseEvent.thunk.SessionEnd,
});

const doesHookPulseEventOwnField = (field: HookPulseEventOwnedField, hookEvent: HookPulseEvent): boolean =>
  areHookPulseEventsEquivalent(hookEvent, hookPulseEventOwningField(field));

const filterHookPulseEventOwnedField = <A>(
  field: HookPulseEventOwnedField,
  hookEvent: HookPulseEvent,
  value: O.Option<A>
): O.Option<A> => O.filter(value, () => doesHookPulseEventOwnField(field, hookEvent));

/**
 * Privacy-safe, schema-versioned record emitted once per coding-agent hook event.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseV1 } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const pulse = S.decodeUnknownEffect(HookPulseV1)({
 *   schemaVersion: "hook-pulse/v1",
 *   ts: "2026-08-01T06:40:07.000Z",
 *   sessionId: "session-1",
 *   agentKind: "claude-code",
 *   hookEvent: "PermissionRequest",
 *   cwd: "/workspace/beep-effect2",
 *   notifierRev: "spike-0",
 *   instrumentClass: "spike",
 *   evidenceTier: "observed",
 *   waitReason: "plan-approval",
 *   toolName: "ExitPlanMode"
 * })
 * console.log(pulse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseV1 extends S.Class<HookPulseV1>($I`HookPulseV1`)(
  S.Struct({
    schemaVersion: HookPulseSchemaVersion,
    ts: S.DateTimeUtcFromString,
    sessionId: Sha256Hex,
    agentKind: HookPulseAgentKind,
    hookEvent: HookPulseEvent,
    cwd: Sha256Hex,
    notifierRev: S.String,
    instrumentClass: HookPulseInstrumentClass,
    evidenceTier: HookPulseEvidenceTier,
    waitReason: HookPulseWaitReason,
    toolName: S.OptionFromOptionalKey(S.String),
    toolUseId: S.OptionFromOptionalKey(S.String),
    promptId: S.OptionFromOptionalKey(S.String),
    transcriptPath: S.OptionFromOptionalKey(Sha256Hex),
    permissionMode: S.OptionFromOptionalKey(S.String),
    notificationType: S.OptionFromOptionalKey(HookPulseNotificationType),
    durationMs: S.OptionFromOptionalKey(NonNegNum),
    sessionEndReason: S.OptionFromOptionalKey(S.String),
  }).check(
    S.makeFilterGroup(
      [
        S.makeFilter(
          (input) =>
            A.getSomes(
              A.map(HookPulseEventOwnedField.Options, (field) =>
                O.match(input[field], {
                  onNone: O.none,
                  onSome: () =>
                    Bool.match(doesHookPulseEventOwnField(field, input.hookEvent), {
                      onFalse: () =>
                        O.some({
                          path: [field],
                          issue: `${field} belongs to ${hookPulseEventOwningField(field)}, not hookEvent ${input.hookEvent}`,
                        }),
                      onTrue: O.none,
                    }),
                })
              )
            ),
          {
            identifier: "HookPulseEventOwnedFieldInvariant",
            title: "Hook-pulse event-owned field invariant",
            description: "Requires fields owned by one hook event to be absent from every other event.",
          }
        ),
        S.makeFilter(
          (input) =>
            areHookPulseWaitReasonsEquivalent(
              input.waitReason,
              deriveWaitReason(input.hookEvent, input.toolName, input.notificationType)
            ),
          {
            identifier: "HookPulseWaitReasonInvariant",
            title: "Hook-pulse wait-reason derivation invariant",
            description: "Requires waitReason to agree with the value derived from the canonical hook event fields.",
            message: "Expected waitReason to match the value derived from hookEvent, toolName, and notificationType",
          }
        ),
      ],
      {
        identifier: "HookPulseV1Invariants",
        title: "Hook-pulse canonical record invariants",
        description: "Checks event-owned fields and derived wait attribution for canonical hook-pulse records.",
      }
    )
  ),
  $I.annote("HookPulseV1", {
    description: "Privacy-safe hook event used as first-class raw history for wait attribution and replay.",
  })
) {}

const HookPulseLegacyV1Record = S.Struct({
  schemaVersion: S.Literal("hook-pulse/v1"),
  ts: S.String,
  sessionId: S.String,
  agentKind: HookPulseAgentKind,
  hookEvent: HookPulseEvent,
  cwd: S.String,
  notifierRev: S.String,
  instrumentClass: HookPulseInstrumentClass,
  evidenceTier: HookPulseEvidenceTier,
  waitReason: HookPulseWaitReason,
  toolName: S.optionalKey(S.String),
  toolUseId: S.optionalKey(S.String),
  promptId: S.optionalKey(S.String),
  transcriptPath: S.optionalKey(S.String),
  permissionMode: S.optionalKey(S.String),
  notificationType: S.optionalKey(HookPulseNotificationType),
  durationMs: S.optionalKey(NonNegNum),
  sessionEndReason: S.optionalKey(S.String),
});

/**
 * Compatibility codec for hook-pulse/v1 rows written before private
 * identifiers were pseudonymized. Decoding hashes legacy raw identifiers;
 * encoding emits only the privacy-safe canonical representation.
 *
 * **Example** (Migrate a Legacy Ledger Row)
 * ```ts
 * import { HookPulseV1FromLegacyRecord } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const migrate = S.decodeUnknownEffect(HookPulseV1FromLegacyRecord)
 * const pulse = migrate({
 *   schemaVersion: "hook-pulse/v1",
 *   ts: "2026-08-01T06:40:07.000Z",
 *   sessionId: "legacy-session",
 *   agentKind: "claude-code",
 *   hookEvent: "Stop",
 *   cwd: "/workspace/beep-effect",
 *   notifierRev: "spike-0",
 *   instrumentClass: "spike",
 *   evidenceTier: "observed",
 *   waitReason: "none"
 * })
 * console.log(pulse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseV1FromLegacyRecord = HookPulseLegacyV1Record.pipe(
  S.decodeTo(
    HookPulseV1,
    SchemaTransformation.transformOrFail<typeof HookPulseV1.Encoded, typeof HookPulseLegacyV1Record.Type>({
      decode: (input) =>
        Effect.all({
          sessionId: privateReference(input.sessionId),
          cwd: privateReference(input.cwd),
          transcriptPath: O.match(O.fromUndefinedOr(input.transcriptPath), {
            onNone: () => Effect.succeed(O.none<Sha256Hex>()),
            onSome: (value) => privateReference(value).pipe(Effect.map(O.some)),
          }),
        }).pipe(
          Effect.mapError(
            () =>
              new SchemaIssue.InvalidValue({
                message: "Failed to migrate private identifiers from a legacy hook-pulse/v1 row",
              })
          ),
          Effect.map((privateRefs) => ({
            ...input,
            sessionId: privateRefs.sessionId,
            cwd: privateRefs.cwd,
            ...O.getSomesStruct({ transcriptPath: privateRefs.transcriptPath }),
          }))
        ),
      encode: (input) => Effect.succeed(input),
    })
  ),
  $I.annoteSchema("HookPulseV1FromLegacyRecord", {
    description: "Migration codec that pseudonymizes private identifiers in legacy hook-pulse/v1 ledger rows.",
  })
);

/**
 * Codec deriving a canonical hook-pulse record from a raw hook event and writer stamps.
 *
 * **Example** (Usage)
 * ```ts
 * import { HookPulseV1FromRawEvent } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const pulse = S.decodeUnknownEffect(HookPulseV1FromRawEvent)({
 *   event: {
 *     session_id: "session-1",
 *     hook_event_name: "PermissionRequest",
 *     cwd: "/workspace/beep-effect2",
 *     tool_name: "ExitPlanMode",
 *     transcript_path: "/tmp/claude/session-1.jsonl"
 *   },
 *   notifierRev: "spike-0",
 *   instrumentClass: "spike",
 *   agentKind: "claude-code",
 *   evidenceTier: "observed",
 *   ts: "2026-08-01T06:40:07.000Z"
 * })
 * console.log(pulse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseV1FromRawEvent = HookPulseRawEventInput.pipe(
  S.decodeTo(
    HookPulseV1,
    SchemaTransformation.transformOrFail<typeof HookPulseV1.Encoded, HookPulseRawEventInput>({
      decode: (input) =>
        Effect.all({
          sessionId: privateReference(input.event.session_id),
          cwd: privateReference(input.event.cwd),
          transcriptPath: privateReference(input.event.transcript_path),
        }).pipe(
          Effect.mapError(
            () =>
              new SchemaIssue.InvalidValue({
                message: "Failed to hash private hook-pulse identifiers",
              })
          ),
          Effect.map((privateRefs) => ({
            schemaVersion: HookPulseSchemaVersion.Enum["hook-pulse/v1"],
            ts: input.ts,
            sessionId: privateRefs.sessionId,
            agentKind: input.agentKind,
            hookEvent: input.event.hook_event_name,
            cwd: privateRefs.cwd,
            notifierRev: input.notifierRev,
            instrumentClass: input.instrumentClass,
            evidenceTier: clampDerivedEvidenceTier(input.evidenceTier),
            waitReason: deriveWaitReason(
              input.event.hook_event_name,
              input.event.tool_name,
              input.event.notification_type
            ),
            ...O.getSomesStruct({
              toolName: input.event.tool_name,
              toolUseId: input.event.tool_use_id,
              promptId: input.event.prompt_id,
              transcriptPath: O.some(privateRefs.transcriptPath),
              permissionMode: input.event.permission_mode,
              notificationType: O.filter(input.event.notification_type, isHookPulseNotificationType),
              durationMs: input.event.duration_ms,
              sessionEndReason: O.filter(input.event.reason, () =>
                HookPulseEvent.is.SessionEnd(input.event.hook_event_name)
              ),
            }),
          }))
        ),
      encode: (input) =>
        O.match(O.fromUndefinedOr(input.transcriptPath), {
          onNone: () =>
            Effect.fail(
              new SchemaIssue.InvalidValue({
                message: "Expected transcriptPath when encoding a canonical hook pulse as a raw hook event",
              })
            ),
          onSome: (transcriptPath) => {
            // toolName, toolUseId, and durationMs stay event-agnostic because harness versions emit them
            // inconsistently; tightening their ownership would risk rejecting legitimate telemetry rows.
            const event = HookPulseRawEvent.make({
              session_id: input.sessionId,
              hook_event_name: input.hookEvent,
              cwd: input.cwd,
              tool_name: O.fromUndefinedOr(input.toolName),
              tool_use_id: O.fromUndefinedOr(input.toolUseId),
              prompt_id: O.fromUndefinedOr(input.promptId),
              transcript_path: transcriptPath,
              permission_mode: O.fromUndefinedOr(input.permissionMode),
              notification_type: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.notificationType,
                input.hookEvent,
                O.fromUndefinedOr(input.notificationType)
              ),
              duration_ms: O.fromUndefinedOr(input.durationMs),
              reason: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.sessionEndReason,
                input.hookEvent,
                O.fromUndefinedOr(input.sessionEndReason)
              ),
            });

            return Bool.match(
              areHookPulseWaitReasonsEquivalent(
                input.waitReason,
                deriveWaitReason(event.hook_event_name, event.tool_name, event.notification_type)
              ),
              {
                onFalse: () =>
                  Effect.fail(
                    new SchemaIssue.InvalidValue({
                      message: "Expected waitReason to match the value derived from the encoded raw hook event",
                    })
                  ),
                onTrue: () =>
                  Effect.succeed(
                    HookPulseRawEventInput.make({
                      event,
                      notifierRev: input.notifierRev,
                      instrumentClass: input.instrumentClass,
                      agentKind: input.agentKind,
                      evidenceTier: clampDerivedEvidenceTier(input.evidenceTier),
                      ts: input.ts,
                    })
                  ),
              }
            );
          },
        }),
    })
  ),
  $I.annoteSchema("HookPulseV1FromRawEvent", {
    description: "Canonical hook-pulse codec that derives wait attribution from whitelisted raw event fields.",
  })
);

/**
 * Runtime type for {@link HookPulseV1FromRawEvent}.
 *
 * **Example** (Usage)
 * ```ts
 * import type { HookPulseV1FromRawEvent } from "@beep/repo-ai-metrics"
 *
 * const printPulse = (pulse: HookPulseV1FromRawEvent) => console.log(pulse)
 * console.log(printPulse)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseV1FromRawEvent = typeof HookPulseV1FromRawEvent.Type;
