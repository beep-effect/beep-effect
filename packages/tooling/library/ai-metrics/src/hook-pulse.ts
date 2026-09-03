/**
 * Schema-first hook-pulse ledger contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, NonNegNum, SchemaUtils, Sha256Hex } from "@beep/schema";
import * as O from "@beep/utils/Option";
import { Config, Effect, SchemaIssue, SchemaTransformation } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Eq from "effect/Equal";
import * as S from "effect/Schema";
import { hashPrivateIdentifier } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("hook-pulse");

/**
 * Resolve the shared agent-evidence root beneath an XDG state home.
 *
 * **Details**
 *
 * `.claude/hooks/hook-pulse.sh` resolves the same root as
 * `${BEEP_AGENT_EVIDENCE_ROOT:-${XDG_STATE_HOME:-$HOME/.local/state}/beep/agent-evidence}`.
 * This helper is the TypeScript half of that one convention, not a second
 * definition of it: a shell writer and a replay reader that each hardcode the
 * path can drift silently, which is exactly the failure class the hook-pulse
 * ledger exists to rule out.
 *
 * **Example** (Resolving the root from an XDG state home)
 *
 * ```ts
 * import { agentEvidenceRoot } from "@beep/repo-ai-metrics"
 *
 * console.log(agentEvidenceRoot("/home/dev/.local/state"))
 * // /home/dev/.local/state/beep/agent-evidence
 * ```
 *
 * @param stateHome - XDG state home, i.e. `XDG_STATE_HOME` or `$HOME/.local/state`.
 * @returns The `beep/agent-evidence` root shared by every telemetry writer.
 * @category utilities
 * @since 0.0.0
 */
export const agentEvidenceRoot = (stateHome: string): string => `${stateHome}/beep/agent-evidence`;

/**
 * Resolve the hook-pulse NDJSON ledger directory under an agent-evidence root.
 *
 * **Details**
 *
 * The writer shards one file per UTC day per session inside this directory, so
 * concurrent sessions in sibling worktrees can never interleave lines. Every
 * file in it decodes as {@link HookPulseV1}; sibling non-`HookPulseV1` state such
 * as the kill-switch disarm-window log lives beside this directory rather than
 * inside it, which keeps replay able to treat the whole directory as one schema.
 *
 * **Example** (Locating the ledger under a resolved evidence root)
 *
 * ```ts
 * import { agentEvidenceRoot, hookPulseLedgerDir } from "@beep/repo-ai-metrics"
 *
 * console.log(hookPulseLedgerDir(agentEvidenceRoot("/home/dev/.local/state")))
 * // /home/dev/.local/state/beep/agent-evidence/hook-events
 * ```
 *
 * @param evidenceRoot - Agent-evidence root, e.g. from {@link agentEvidenceRoot}.
 * @returns The `hook-events` directory holding the sharded hook-pulse ledger.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseLedgerDir = (evidenceRoot: string): string => `${evidenceRoot}/hook-events`;

/**
 * Resolve the current disarm sentinel beneath an agent-evidence root.
 *
 * **Example** (Resolve the sentinel path)
 *
 * ```ts
 * import { hookPulseDisarmSentinelPath } from "@beep/repo-ai-metrics"
 *
 * console.log(hookPulseDisarmSentinelPath("/var/lib/beep/agent-evidence"))
 * ```
 *
 * @param evidenceRoot - Agent-evidence root containing the hook-pulse control files.
 * @returns Absolute path to the current disarm sentinel.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseDisarmSentinelPath = (evidenceRoot: string): string => `${evidenceRoot}/hook-pulse.disarmed`;

/**
 * Resolve the append-only disarm-window ledger beneath an agent-evidence root.
 *
 * **Example** (Resolve the disarm-window ledger)
 *
 * ```ts
 * import { hookPulseDisarmWindowsPath } from "@beep/repo-ai-metrics"
 *
 * console.log(hookPulseDisarmWindowsPath("/var/lib/beep/agent-evidence"))
 * ```
 *
 * @param evidenceRoot - Agent-evidence root containing the hook-pulse control files.
 * @returns Absolute path to the append-only disarm-window ledger.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseDisarmWindowsPath = (evidenceRoot: string): string =>
  `${evidenceRoot}/hook-pulse-disarm-windows.ndjson`;

/**
 * Version tag stamped on every hook-pulse disarm-window row.
 *
 * **Example** (Read the disarm-window version)
 *
 * ```ts
 * import { HookPulseDisarmWindowSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseDisarmWindowSchemaVersion.Enum["hook-pulse-disarm-window/v1"])
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HookPulseDisarmWindowSchemaVersion = LiteralKit(["hook-pulse-disarm-window/v1"]).pipe(
  $I.annoteSchema("HookPulseDisarmWindowSchemaVersion", {
    description: "Version identifiers accepted by the hook-pulse disarm-window ledger.",
  })
);

/**
 * Decoded version carried by a hook-pulse disarm-window row.
 *
 * @category models
 * @since 0.0.0
 */
export type HookPulseDisarmWindowSchemaVersion = typeof HookPulseDisarmWindowSchemaVersion.Type;

/**
 * Version tag stamped on every ledger row so a reader can refuse shards written by a contract it does not implement.
 *
 * **Details**
 *
 * The domain is closed at exactly the versions this module decodes. A shard
 * appended by a future writer therefore fails to decode rather than being read
 * with the wrong field meanings, which is the only safe outcome for an
 * append-only ledger nobody goes back and rewrites.
 *
 * **Example** (Refuse a shard written by a newer contract)
 *
 * ```ts
 * import { HookPulseSchemaVersion } from "@beep/repo-ai-metrics"
 *
 * const isCurrent = HookPulseSchemaVersion.is["hook-pulse/v1"]
 *
 * console.log(HookPulseSchemaVersion.Enum["hook-pulse/v1"]) // "hook-pulse/v1"
 * console.log(isCurrent("hook-pulse/v1")) // true
 * console.log(isCurrent("hook-pulse/v2")) // false
 * ```
 *
 * @see {@link HookPulseV1} for the record this version tag travels on.
 * @category models
 * @since 0.0.0
 */
export const HookPulseSchemaVersion = LiteralKit(["hook-pulse/v1"]).pipe(
  $I.annoteSchema("HookPulseSchemaVersion", {
    description: "Version identifiers accepted by the hook-pulse ledger contract.",
  })
);

/**
 * Decoded version literal carried by every hook-pulse ledger row.
 *
 * @see {@link HookPulseSchemaVersion} for the runtime schema, its guards, and its enum keys.
 * @category models
 * @since 0.0.0
 */
export type HookPulseSchemaVersion = typeof HookPulseSchemaVersion.Type;

/**
 * Coding-agent harness that produced a row, recorded because one ledger mixes rows from more than one harness.
 *
 * **Details**
 *
 * Wait measurements are comparable only within a single harness: each emits its
 * own hook vocabulary, so a Claude Code `PermissionRequest` and a Codex approval
 * prompt are different events wearing similar names. Naming the writer on every
 * row keeps a cross-harness comparison an explicit choice rather than an
 * accident of reading the whole directory at once.
 *
 * **Example** (Partition ledger rows by the harness that wrote them)
 *
 * ```ts
 * import { HookPulseAgentKind } from "@beep/repo-ai-metrics"
 *
 * const isClaudeCode = HookPulseAgentKind.is["claude-code"]
 *
 * console.log(HookPulseAgentKind.Options) // ["claude-code", "codex-cli"]
 * console.log(isClaudeCode(HookPulseAgentKind.Enum["claude-code"])) // true
 * console.log(isClaudeCode(HookPulseAgentKind.Enum["codex-cli"])) // false
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
 * Decoded harness literal identifying which coding agent appended a row.
 *
 * @see {@link HookPulseAgentKind} for the runtime schema and its per-harness guards.
 * @category models
 * @since 0.0.0
 */
export type HookPulseAgentKind = typeof HookPulseAgentKind.Type;

/**
 * Hook lifecycle events the sequence-break instrument records, one ledger row per event.
 *
 * **Details**
 *
 * The domain is closed so that a harness upgrade emitting an unfamiliar hook
 * name fails to decode instead of landing an uncategorized row. `PostToolUse`
 * and `PostToolUseFailure` are the two alternative terminal events for one tool
 * call: a call produces exactly one of them, so a reader that closes brackets on
 * `PostToolUse` alone leaves every failed call waiting forever.
 *
 * **Gotchas**
 *
 * `PreToolUse` is not a human-wait marker. It fires before every tool call,
 * including auto-approved ones, so counting it as waiting measures execution
 * rather than blocking. `PermissionRequest` is the event that actually starts a
 * human wait, and that distinction is the whole point of the instrument.
 *
 * **Example** (Separate the human-wait marker from the execution marker)
 *
 * ```ts
 * import { HookPulseEvent } from "@beep/repo-ai-metrics"
 *
 * const startsHumanWait = HookPulseEvent.is.PermissionRequest
 *
 * console.log(startsHumanWait(HookPulseEvent.Enum.PermissionRequest)) // true
 * console.log(startsHumanWait(HookPulseEvent.Enum.PreToolUse)) // false
 * console.log(HookPulseEvent.Options.length) // 9
 * ```
 *
 * @see {@link HookPulseWaitReason} for the attribution derived from these events.
 * @category models
 * @since 0.0.0
 */
export const HookPulseEvent = LiteralKit([
  "PreToolUse",
  "PermissionRequest",
  "PostToolUse",
  "PostToolUseFailure",
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
 * Decoded hook-event literal naming which lifecycle event a row records.
 *
 * @see {@link HookPulseEvent} for the runtime schema, its guards, and its exhaustive matcher.
 * @category models
 * @since 0.0.0
 */
export type HookPulseEvent = typeof HookPulseEvent.Type;

/**
 * Experimental role of the session that produced a row, recorded to keep the instrument out of its own baselines.
 *
 * **Details**
 *
 * A `spike` session was spent building or exercising the instrument, and a
 * `meta` session was spent reasoning about the measurement rather than doing
 * repo work; both have wait profiles unlike ordinary work. Default baselines
 * read `production` alone, but the other two stay on disk rather than being
 * dropped, because the ledger is raw history and a later question may want them.
 *
 * **Example** (Keep spike and meta sessions out of a baseline)
 *
 * ```ts
 * import { HookPulseInstrumentClass } from "@beep/repo-ai-metrics"
 *
 * const countsTowardBaseline = HookPulseInstrumentClass.$match({
 *   production: () => true,
 *   spike: () => false,
 *   meta: () => false
 * })
 *
 * console.log(countsTowardBaseline(HookPulseInstrumentClass.Enum.production)) // true
 * console.log(countsTowardBaseline(HookPulseInstrumentClass.Enum.spike)) // false
 * console.log(countsTowardBaseline(HookPulseInstrumentClass.Enum.meta)) // false
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
 * Decoded instrument-class literal marking whether a session belongs in default baselines.
 *
 * @see {@link HookPulseInstrumentClass} for the runtime schema and its exhaustive matcher.
 * @category models
 * @since 0.0.0
 */
export type HookPulseInstrumentClass = typeof HookPulseInstrumentClass.Type;

/**
 * Confidence a hook-pulse observation claims for itself, ordered from directly witnessed down to unknown.
 *
 * **Details**
 *
 * Tiers obey a weakest-link law: a record can never outrank the weakest input it
 * was computed from. `observed` is reserved for a value read straight out of a
 * hook payload; anything one inference removed is at best `derived`, and
 * `heuristic` or `unknown` inputs keep their tier rather than being promoted by
 * the step that consumed them.
 *
 * **Gotchas**
 *
 * A tier is a claim about provenance, not about correctness. A `derived` row can
 * be exactly right and an `observed` row can record a harness bug faithfully;
 * the tier only says how far the value sits from the raw payload.
 *
 * **Example** (Read the weakest-link ladder)
 *
 * ```ts
 * import { HookPulseEvidenceTier } from "@beep/repo-ai-metrics"
 *
 * const isObserved = HookPulseEvidenceTier.is.observed
 *
 * // Strongest first: a record clamps down this ladder, never up it.
 * console.log(HookPulseEvidenceTier.Options) // ["observed", "derived", "heuristic", "unknown"]
 * console.log(isObserved(HookPulseEvidenceTier.Enum.observed)) // true
 * console.log(isObserved(HookPulseEvidenceTier.Enum.derived)) // false
 * ```
 *
 * @see {@link HookPulseV1FromRawEvent} for the clamp that applies this law while deriving a canonical row.
 * @category models
 * @since 0.0.0
 */
export const HookPulseEvidenceTier = LiteralKit(["observed", "derived", "heuristic", "unknown"]).pipe(
  $I.annoteSchema("HookPulseEvidenceTier", {
    description: "Weakest-link evidence confidence attached to a hook-pulse record.",
  })
);

/**
 * Decoded evidence-tier literal stating how far a recorded value sits from the raw hook payload.
 *
 * @see {@link HookPulseEvidenceTier} for the runtime schema and the weakest-link law it encodes.
 * @category models
 * @since 0.0.0
 */
export type HookPulseEvidenceTier = typeof HookPulseEvidenceTier.Type;

/**
 * Current disarm state written by the hook-pulse operator switch.
 *
 * **Example** (Create a disarm sentinel)
 *
 * ```ts
 * import { HookPulseDisarmSentinel } from "@beep/repo-ai-metrics"
 *
 * const sentinel = HookPulseDisarmSentinel.make({
 *   disarmedAt: "2026-08-25T12:00:00.000Z",
 *   evidenceTier: "unknown",
 *   reason: "maintenance"
 * })
 * console.log(sentinel.reason)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseDisarmSentinel extends S.Class<HookPulseDisarmSentinel>($I`HookPulseDisarmSentinel`)(
  {
    disarmedAt: S.String,
    evidenceTier: S.Literal(HookPulseEvidenceTier.Enum.unknown),
    reason: S.String,
  },
  $I.annote("HookPulseDisarmSentinel", {
    description: "Current hook-pulse disarm state written by the operator switch.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(HookPulseDisarmSentinel));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(HookPulseDisarmSentinel));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(HookPulseDisarmSentinel));
  static readonly encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(HookPulseDisarmSentinel));
}

/**
 * Closed interval during which hook-pulse collection was disarmed.
 *
 * **Example** (Decode a disarm window)
 *
 * ```ts
 * import { HookPulseDisarmWindow } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * const window = S.decodeUnknownSync(HookPulseDisarmWindow)({
 *   disarmedAt: "2026-08-25T12:00:00.000Z",
 *   evidenceTier: "unknown",
 *   reason: "maintenance",
 *   rearmedAt: "2026-08-25T12:05:00.000Z",
 *   schemaVersion: "hook-pulse-disarm-window/v1"
 * })
 * console.log(window.rearmedAt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseDisarmWindow extends S.Class<HookPulseDisarmWindow>($I`HookPulseDisarmWindow`)(
  {
    disarmedAt: S.OptionFromNullOr(S.String),
    evidenceTier: S.Literal(HookPulseEvidenceTier.Enum.unknown),
    reason: S.OptionFromNullOr(S.String),
    rearmedAt: S.String,
    schemaVersion: HookPulseDisarmWindowSchemaVersion,
  },
  $I.annote("HookPulseDisarmWindow", {
    description: "One closed interval during which hook-pulse collection was disarmed.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(HookPulseDisarmWindow));
  static readonly decodeJsonResult = S.decodeUnknownResult(S.fromJsonString(HookPulseDisarmWindow));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(HookPulseDisarmWindow));
  static readonly encodeJsonResult = S.encodeUnknownResult(S.fromJsonString(HookPulseDisarmWindow));
}

/**
 * Attribution for why a session is blocked, so a stretch of wall-clock waiting can be charged to a cause.
 *
 * **Details**
 *
 * The value is derived from the hook event, tool name, and notification type
 * rather than asserted by the writer, which is what lets the schema check it.
 * `none` and `unknown` are not interchangeable: `none` means the event is not a
 * wait at all, while `unknown` means the row is a wait whose cause the
 * whitelisted payload did not identify. Collapsing them would quietly report
 * unattributed waiting as zero waiting.
 *
 * **Example** (Distinguish blocked events from events that are not waits)
 *
 * ```ts
 * import { HookPulseWaitReason } from "@beep/repo-ai-metrics"
 *
 * const isHumanWait = HookPulseWaitReason.$match({
 *   "plan-approval": () => true,
 *   "tool-permission": () => true,
 *   "idle-input": () => true,
 *   none: () => false,
 *   unknown: () => false
 * })
 *
 * console.log(isHumanWait(HookPulseWaitReason.Enum["plan-approval"])) // true
 * console.log(isHumanWait(HookPulseWaitReason.Enum.none)) // false
 * // An unattributed wait keeps its own reason rather than counting as zero waiting.
 * console.log(isHumanWait(HookPulseWaitReason.Enum.unknown)) // false
 * ```
 *
 * @see {@link HookPulseV1} for the invariant that recomputes this value and rejects a row that disagrees.
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
 * Decoded wait-reason literal charging a blocked stretch to a cause, or to no wait at all.
 *
 * @see {@link HookPulseWaitReason} for the runtime schema and the none-versus-unknown distinction.
 * @category models
 * @since 0.0.0
 */
export type HookPulseWaitReason = typeof HookPulseWaitReason.Type;

/**
 * Notification categories the writer keeps, chosen so a notification can be counted without keeping its text.
 *
 * **Details**
 *
 * A raw notification payload carries a `message`, which is content and never
 * reaches the ledger; this category is the only part that survives.
 * `idle_prompt` is the sole category that marks the human as the thing being
 * waited on, so it is the one that becomes an `idle-input` wait, while
 * `permission_prompt` accompanies a decision that `PermissionRequest` already
 * brackets.
 *
 * **Gotchas**
 *
 * A category outside this domain is dropped rather than rejected. A future
 * harness notification therefore decodes into a row whose `notificationType` is
 * absent and whose wait reason is `unknown`, which records the gap instead of
 * losing the event.
 *
 * **Example** (Recognize the idle category and ignore an unfamiliar one)
 *
 * ```ts
 * import { HookPulseNotificationType } from "@beep/repo-ai-metrics"
 *
 * const isIdlePrompt = HookPulseNotificationType.is.idle_prompt
 *
 * console.log(isIdlePrompt(HookPulseNotificationType.Enum.idle_prompt)) // true
 * console.log(isIdlePrompt(HookPulseNotificationType.Enum.permission_prompt)) // false
 * console.log(isIdlePrompt("future_notification_shape")) // false
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
 * Decoded notification-category literal retained in place of a notification message.
 *
 * @see {@link HookPulseNotificationType} for the runtime schema and the categories it recognizes.
 * @category models
 * @since 0.0.0
 */
export type HookPulseNotificationType = typeof HookPulseNotificationType.Type;

/**
 * Whitelisted, content-free projection of the hook payload a coding agent hands to its hook script.
 *
 * **Details**
 *
 * The payload a harness delivers carries `prompt`, `message`, `tool_input`,
 * `tool_response`, and `error`, every one of which is content. This schema names
 * only the fields the instrument needs, so the content is gone before anything
 * reaches disk. Privacy here is a property of what the type can represent rather
 * than of a downstream filter someone has to remember to run.
 *
 * **Gotchas**
 *
 * `tool_name` must be non-empty, not merely present. The shell writer treats
 * `""` as an absent tool and derives `unknown` for a `PermissionRequest`, while a
 * reader that accepted an empty string would derive `tool-permission` from the
 * same row. Both halves are internally consistent, so no invariant would catch
 * the disagreement; refusing the empty string is the only reading they share.
 *
 * **Example** (Content fields never survive the projection)
 *
 * ```ts
 * import { HookPulseRawEvent } from "@beep/repo-ai-metrics"
 * import { Result } from "effect"
 * const decode = HookPulseRawEvent.decodeResult
 *
 * const event = Result.getOrThrow(
 *   decode({
 *     session_id: "session-1",
 *     hook_event_name: "PermissionRequest",
 *     cwd: "/workspace/beep-effect2",
 *     tool_name: "ExitPlanMode",
 *     transcript_path: "/tmp/claude/session-1.jsonl",
 *     prompt: "content the ledger must never keep",
 *     tool_input: { command: "bun run check" }
 *   })
 * )
 *
 * console.log(event.tool_name) // O.some("ExitPlanMode")
 * console.log(Object.hasOwn(event, "prompt")) // false
 * console.log(Object.hasOwn(event, "tool_input")) // false
 * ```
 *
 * @see {@link HookPulseV1FromRawEvent} for the codec that turns this projection into a canonical row.
 * @category models
 * @since 0.0.0
 */
export class HookPulseRawEvent extends S.Class<HookPulseRawEvent>($I`HookPulseRawEvent`)(
  {
    session_id: S.NonEmptyString,
    hook_event_name: HookPulseEvent,
    cwd: S.String,
    // Non-empty rather than merely present: the shell writer maps `""` to an
    // absent `tool_name` and therefore derives `unknown` for a `PermissionRequest`,
    // while `derivePermissionWaitReason` reads `O.some("")` as a real tool and
    // derives `tool-permission`. Neither the wait-reason nor the owned-field
    // invariant can catch that divergence, because each half is internally
    // consistent. An empty tool name means nothing, so refusing it is the only
    // reading both halves can share.
    tool_name: S.OptionFromOptionalKey(S.NonEmptyString),
    tool_use_id: S.OptionFromOptionalKey(S.String),
    prompt_id: S.OptionFromOptionalKey(S.String),
    transcript_path: S.String,
    permission_mode: S.OptionFromOptionalKey(S.String),
    notification_type: S.OptionFromOptionalKey(S.String),
    duration_ms: S.OptionFromOptionalKey(NonNegNum),
    reason: S.OptionFromOptionalKey(S.String),
    is_interrupt: S.OptionFromOptionalKey(S.Boolean),
  },
  $I.annote("HookPulseRawEvent", {
    description: "Whitelisted non-content fields forwarded from a coding-agent hook payload.",
  })
) {
  static readonly decodeEffect = S.decodeUnknownEffect(HookPulseRawEvent);
  static readonly decodeResult = S.decodeUnknownResult(HookPulseRawEvent);
  static readonly encodeEffect = S.encodeUnknownEffect(HookPulseRawEvent);
}

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
    // A bracket *end*, not a human wait: the harness emits either PostToolUse or
    // PostToolUseFailure for a tool call, never both.
    PostToolUseFailure: HookPulseWaitReason.thunk.none,
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
const isSha256Hex = S.is(Sha256Hex);

/**
 * Salt the hook-pulse codecs hash private identifiers with, resolved exactly as `.claude/hooks/hook-pulse.sh` resolves its own.
 *
 * **Details**
 *
 * Three rungs, in the writer's order: `BEEP_HOOK_PULSE_HASH_SALT`, then
 * `BEEP_AI_METRICS_HASH_SALT`, then absent. The first salts this instrument
 * alone; the second is the repo-wide ai-metrics salt, so a machine that already
 * exports one groups hook rows under the same pseudonyms as the rest of the
 * stack. Absent resolves to `undefined`, which {@link hashPrivateIdentifier}
 * turns into `AI_METRICS_LOCAL_INSECURE_HASH_SALT` — the same constant the shell
 * falls back to, so an unconfigured clone produces digests both halves
 * reproduce.
 *
 * Read through `Config` rather than the environment directly because
 * `ConfigProvider` is a `Context.Reference` whose default is
 * `ConfigProvider.fromEnv()`. The requirement channel therefore stays `never`
 * and the codecs' types are unchanged, while a caller — a test, or a replay
 * pass reconciling against an archived corpus — can still pin an explicit
 * provider.
 *
 * **Gotchas**
 *
 * A whitespace-only first rung is a value, not an absence. It wins the
 * precedence contest and is only then collapsed to the insecure default; it
 * does not fall through to the second rung, and `${BEEP_HOOK_PULSE_HASH_SALT:-}`
 * in the shell does not fall through either. That lone input is where a shell
 * reading and a trim-first reading could disagree while both looked correct.
 *
 * Pinning a `ConfigProvider` that carries neither variable is the escape hatch
 * for replaying a pre-cutover corpus: it reproduces the library-default
 * digests those rows were written with, whatever the ambient environment
 * exports.
 *
 * **Example** (Pin the salt for a deterministic decode)
 *
 * ```ts
 * import { hookPulseHashSalt } from "@beep/repo-ai-metrics"
 * import { ConfigProvider, Effect } from "effect"
 *
 * const pinned = Effect.provideService(
 *   hookPulseHashSalt,
 *   ConfigProvider.ConfigProvider,
 *   ConfigProvider.fromEnv({ env: { BEEP_HOOK_PULSE_HASH_SALT: "fixture-salt" } })
 * )
 *
 * console.log(Effect.runSync(pinned)) // "fixture-salt"
 * ```
 *
 * @see {@link HookPulseV1FromRawEvent} for the codec that hashes with this salt.
 * @category utilities
 * @since 0.0.0
 */
export const hookPulseHashSalt: Config.Config<O.Option<string>> = Config.string("BEEP_HOOK_PULSE_HASH_SALT").pipe(
  Config.orElse(() => Config.string("BEEP_AI_METRICS_HASH_SALT")),
  Config.option
);

const privateReference = (value: string, hashSalt: O.Option<string>) =>
  isSha256Hex(value) ? Effect.succeed(value) : hashPrivateIdentifier(value, hashSalt).pipe(Effect.map(Sha256Hex.make));

// The salt is a per-decode constant, not a per-field one, so it is resolved once
// here and threaded down. `.claude/hooks/hook-pulse.sh` walks the identical
// precedence, and `hook-pulse-writer.test.ts` proves the two halves agree by
// running the real writer under a test salt and recomputing its digests here.
// A `ConfigError` is folded into the caller's hashing-failure issue: with
// `fromEnv` it is unreachable (all lookups are synchronous and absence is
// absorbed by `withDefault`), and a second issue message would claim a
// distinction the codec cannot actually observe.
const hookPulsePrivateReferences = Effect.fnUntraced(function* (input: {
  readonly cwd: string;
  readonly sessionId: string;
  readonly transcriptPath: O.Option<string>;
}) {
  const hashSalt = yield* hookPulseHashSalt;

  return yield* Effect.all({
    sessionId: privateReference(input.sessionId, hashSalt),
    cwd: privateReference(input.cwd, hashSalt),
    transcriptPath: O.match(input.transcriptPath, {
      onNone: () => Effect.succeed(O.none<Sha256Hex>()),
      onSome: (value) => privateReference(value, hashSalt).pipe(Effect.asSome),
    }),
  });
});

// Only fields semantically bound to exactly one event belong here. `toolName`,
// `toolUseId`, and `durationMs` are deliberately left unconstrained: their
// presence varies by harness version — a measured `PermissionRequest` carries
// `tool_name` but no `tool_use_id`, while `PreToolUse` and `PostToolUse` carry
// both — so binding them to an event would reject legitimate future rows, and
// rejecting rows costs real telemetry.
const HookPulseEventOwnedField = LiteralKit(["notificationType", "sessionEndReason", "isInterrupt"]).pipe(
  $I.annoteSchema("HookPulseEventOwnedField", {
    description: "Canonical hook-pulse fields whose meaning is owned by exactly one hook event.",
  })
);
type HookPulseEventOwnedField = typeof HookPulseEventOwnedField.Type;

const hookPulseEventOwningField = HookPulseEventOwnedField.$match({
  notificationType: HookPulseEvent.thunk.Notification,
  sessionEndReason: HookPulseEvent.thunk.SessionEnd,
  isInterrupt: HookPulseEvent.thunk.PostToolUseFailure,
});

const doesHookPulseEventOwnField = (field: HookPulseEventOwnedField, hookEvent: HookPulseEvent): boolean =>
  areHookPulseEventsEquivalent(hookEvent, hookPulseEventOwningField(field));

const filterHookPulseEventOwnedField = <A>(
  field: HookPulseEventOwnedField,
  hookEvent: HookPulseEvent,
  value: O.Option<A>
): O.Option<A> => O.filter(value, () => doesHookPulseEventOwnField(field, hookEvent));

// Owned fields no longer share one payload type — `isInterrupt` is boolean while
// its siblings are strings — so indexing by a union key yields a union of
// `Option`s that will not unify. The invariant below only asks whether a value is
// present, so it reads through this presence-only accessor rather than widening
// the union at each call site.
type HookPulseEventOwnedFieldValues = {
  readonly [Field in HookPulseEventOwnedField]: O.Option<unknown>;
};

const hookPulseEventOwnedFieldValue = (
  input: HookPulseEventOwnedFieldValues,
  field: HookPulseEventOwnedField
): O.Option<unknown> => input[field];

/**
 * Privacy-safe, schema-versioned record written once per coding-agent hook event.
 *
 * **Details**
 *
 * One row per event, appended as NDJSON by `.claude/hooks/hook-pulse.sh`, is the
 * instrument's raw history: every derived table is rebuilt from these rows, so a
 * row is never rewritten. Two invariants make the schema its own oracle against
 * the shell writer. The event-owned field invariant rejects `notificationType`
 * outside `Notification`, `sessionEndReason` outside `SessionEnd`, and
 * `isInterrupt` outside `PostToolUseFailure`. The wait-reason invariant
 * recomputes `waitReason` from `hookEvent`, `toolName`, and `notificationType`
 * and rejects a row that disagrees, which is what catches a jq derivation that
 * has drifted away from this contract.
 *
 * **Gotchas**
 *
 * A human wait starts at `PermissionRequest`, never at `PreToolUse`, which fires
 * before auto-approved calls too and therefore measures execution. The wait
 * bracket closes on `PostToolUse` or `PostToolUseFailure`, exactly one of which
 * a tool call produces, so a reader joining on `PostToolUse` alone never closes a
 * failed call.
 *
 * **Example** (Decode a plan-approval wait and watch a hand-edited attribution fail)
 *
 * ```ts
 * import { HookPulseV1 } from "@beep/repo-ai-metrics"
 * import { Result } from "effect"
 * const decode = HookPulseV1.decodeResult
 *
 * const row = {
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
 * }
 *
 * console.log(Result.getOrThrow(decode(row)).waitReason) // "plan-approval"
 * // waitReason is recomputed, so a writer cannot claim this request was not a wait.
 * console.log(Result.isFailure(decode({ ...row, waitReason: "none" }))) // true
 * // sessionEndReason belongs to SessionEnd and to no other event.
 * console.log(Result.isFailure(decode({ ...row, sessionEndReason: "prompt_input_exit" }))) // true
 * ```
 *
 * @see {@link HookPulseV1FromRawEvent} for deriving one of these rows from a raw hook payload.
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
    // Non-empty for the same reason `HookPulseRawEvent.tool_name` is, and it has
    // to be non-empty on *both* sides: a canonical row carrying `O.some("")`
    // decodes fine yet can never be encoded back to a raw event, so the drift
    // would reappear as a replay break instead of a decode failure.
    toolName: S.OptionFromOptionalKey(S.NonEmptyString),
    toolUseId: S.OptionFromOptionalKey(S.String),
    promptId: S.OptionFromOptionalKey(S.String),
    transcriptPath: S.OptionFromOptionalKey(Sha256Hex),
    permissionMode: S.OptionFromOptionalKey(S.String),
    notificationType: S.OptionFromOptionalKey(HookPulseNotificationType),
    durationMs: S.OptionFromOptionalKey(NonNegNum),
    sessionEndReason: S.OptionFromOptionalKey(S.String),
    // Separates "the human hit escape" from "the tool errored". The first is a
    // human action and belongs in a human-wait instrument; the raw `error`
    // string is content and is never represented here.
    isInterrupt: S.OptionFromOptionalKey(S.Boolean),
  }).check(
    S.makeFilterGroup(
      [
        S.makeFilter(
          (input) =>
            A.getSomes(
              A.map(HookPulseEventOwnedField.Options, (field) =>
                O.match(hookPulseEventOwnedFieldValue(input, field), {
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
) {
  static readonly decodeEffect = S.decodeUnknownEffect(HookPulseV1);
  static readonly encodeEffect = S.encodeUnknownEffect(HookPulseV1);
  static readonly decodeResult = S.decodeUnknownResult(HookPulseV1);
  static readonly encodeResult = S.encodeResult(HookPulseV1);
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(HookPulseV1));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(HookPulseV1));
  static readonly decodeJsonSync = S.decodeUnknownSync(S.fromJsonString(HookPulseV1));
  static readonly encodeJsonSync = S.encodeUnknownSync(S.fromJsonString(HookPulseV1));
}

// Deliberately without `isInterrupt`, and the omission is a dating argument
// rather than an oversight. "Legacy" here means exactly one thing: a row written
// before private identifiers were pseudonymized. `isInterrupt` and its only
// owning event `PostToolUseFailure` were both added *after* that change, so no
// row can be legacy-shaped and carry the field — declaring it would model a
// combination that cannot exist and would give a future reader the false
// impression that some legacy corpus distinguishes an interrupt from an error.
// The raw-identifier fields below stay raw for the mirror-image reason: raw is
// what a pre-pseudonymization row actually contains, and this codec exists to
// hash them on the way in.
const HookPulseLegacyV1Record = S.Struct({
  schemaVersion: S.Literal(HookPulseSchemaVersion.Enum["hook-pulse/v1"]),
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
 * **Example** (Migrate a legacy ledger row)
 *
 * ```ts
 * import { HookPulseV1FromLegacyRecord } from "@beep/repo-ai-metrics"
 * const migrate = HookPulseV1FromLegacyRecord.decodeUnknownEffect
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
        hookPulsePrivateReferences({
          cwd: input.cwd,
          sessionId: input.sessionId,
          transcriptPath: O.fromUndefinedOr(input.transcriptPath),
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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownEffect"])
);

/**
 * Codec turning a raw hook payload plus its writer stamps into a canonical hook-pulse row, and back again.
 *
 * **When to use**
 *
 * Use when a hook payload has to become a ledger row, or when a stored row has
 * to be replayed as the raw event that produced it.
 *
 * **Details**
 *
 * Decoding derives `waitReason` from the whitelisted raw fields instead of
 * copying a writer-supplied value, so a writer cannot assert an attribution its
 * payload does not support. Encoding reverses the projection and fails when
 * `transcriptPath` is absent or when the row disagrees with the attribution its
 * own encoded event would derive. Fields owned by one event are dropped in both
 * directions rather than forwarded, which is what keeps the two directions from
 * disagreeing about the same event: a decode that merely forwarded a misowned
 * field would hand the canonical schema a record it must reject, losing an
 * otherwise legitimate row over a field the ledger never wanted.
 *
 * **Gotchas**
 *
 * An `observed` raw event yields a `derived` row. That clamp is the weakest-link
 * law in code: the derivation sits one inference away from the payload, so it
 * cannot claim to have witnessed what it computed. `heuristic` and `unknown`
 * stay where they are, because the clamp only ever lowers a tier.
 *
 * **Example** (Derive wait attribution and clamp the evidence tier)
 *
 * ```ts
 * import { HookPulseV1FromRawEvent } from "@beep/repo-ai-metrics"
 * import { Result } from "effect"
 * const decode = HookPulseV1FromRawEvent.decodeUnknownResult
 *
 * const pulse = Result.getOrThrow(
 *   decode({
 *     event: {
 *       session_id: "session-1",
 *       hook_event_name: "PermissionRequest",
 *       cwd: "/workspace/beep-effect2",
 *       tool_name: "ExitPlanMode",
 *       transcript_path: "/tmp/claude/session-1.jsonl"
 *     },
 *     notifierRev: "spike-0",
 *     instrumentClass: "spike",
 *     agentKind: "claude-code",
 *     evidenceTier: "observed",
 *     ts: "2026-08-01T06:40:07.000Z"
 *   })
 * )
 *
 * // Derived from the tool name, never supplied by the writer.
 * console.log(pulse.waitReason) // "plan-approval"
 * // Clamped one step down from the observed tier the writer stamped.
 * console.log(pulse.evidenceTier) // "derived"
 * ```
 *
 * @see {@link HookPulseRawEvent} for the whitelisted payload this codec reads.
 * @category models
 * @since 0.0.0
 */
export const HookPulseV1FromRawEvent = HookPulseRawEventInput.pipe(
  S.decodeTo(
    HookPulseV1,
    SchemaTransformation.transformOrFail<typeof HookPulseV1.Encoded, HookPulseRawEventInput>({
      decode: (input) =>
        hookPulsePrivateReferences({
          cwd: input.event.cwd,
          sessionId: input.event.session_id,
          transcriptPath: O.some(input.event.transcript_path),
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
            // All three event-owned fields route through the ownership table so it is
            // the single source of truth in both directions. `notificationType`
            // previously carried only the enum filter, so a `notification_type` on a
            // non-Notification event failed the whole decode while its siblings
            // dropped the field — the codec's two directions disagreed.
            ...O.getSomesStruct({
              toolName: input.event.tool_name,
              toolUseId: input.event.tool_use_id,
              promptId: input.event.prompt_id,
              transcriptPath: privateRefs.transcriptPath,
              permissionMode: input.event.permission_mode,
              notificationType: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.notificationType,
                input.event.hook_event_name,
                O.filter(input.event.notification_type, isHookPulseNotificationType)
              ),
              durationMs: input.event.duration_ms,
              sessionEndReason: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.sessionEndReason,
                input.event.hook_event_name,
                input.event.reason
              ),
              isInterrupt: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.isInterrupt,
                input.event.hook_event_name,
                input.event.is_interrupt
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
              is_interrupt: filterHookPulseEventOwnedField(
                HookPulseEventOwnedField.Enum.isInterrupt,
                input.hookEvent,
                O.fromUndefinedOr(input.isInterrupt)
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
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownEffect", "decodeUnknownResult", "encodeResult", "encodeUnknownEffect"])
);

/**
 * Decoded side of the raw-event codec, which is the canonical row rather than the raw payload.
 *
 * @see {@link HookPulseV1FromRawEvent} for the codec itself and the derivations it performs.
 * @category models
 * @since 0.0.0
 */
export type HookPulseV1FromRawEvent = typeof HookPulseV1FromRawEvent.Type;
