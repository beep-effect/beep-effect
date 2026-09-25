/**
 * Strict, content-free contracts for the local chat-first end-to-end harness.
 *
 * **Details**
 *
 * These models carry fixture observations only. Product text and entity
 * payloads never leave the harness. Python forbids unknown keys.
 *
 * **Gotchas**
 *
 * Effect strips unknown keys unless decode is called with
 * `{ onExcessProperty: "error" }`. Use that option to match `extra='forbid'`.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import { atLeastCheck, betweenCheck, intAtLeast, intBetween, Model, pg } from "./Port.ts";

const $I = $ScratchpadId.create("beep/ChatFirstE2e");

/**
 * Named harness fixture.
 *
 * **Example** (Decode the cold-start fixture)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EFixtureCase } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EFixtureCase)("cold_start"))
 * console.log(decoded) // "cold_start"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstE2EFixtureCase = LiteralKit([
  "enabled",
  "question",
  "disabled_control",
  "unreachable_control",
  "cold_start",
]).pipe(
  $I.annoteSchema("ChatFirstE2EFixtureCase", {
    description: "Chat-first harness fixture case.",
  }),
);

/**
 * Decoded harness fixture case.
 *
 * @see {@link ChatFirstE2EFixtureCase} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstE2EFixtureCase = typeof ChatFirstE2EFixtureCase.Type;

/**
 * Whether the harness control endpoint answers.
 *
 * **Example** (Decode an unreachable control)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EControlEndpointMode } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EControlEndpointMode)("unreachable"))
 * console.log(decoded) // "unreachable"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstE2EControlEndpointMode = LiteralKit(["reachable", "unreachable"]).pipe(
  $I.annoteSchema("ChatFirstE2EControlEndpointMode", {
    description: "Harness control endpoint: reachable or unreachable.",
  }),
);

/**
 * Decoded control-endpoint mode.
 *
 * @see {@link ChatFirstE2EControlEndpointMode} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstE2EControlEndpointMode = typeof ChatFirstE2EControlEndpointMode.Type;

/**
 * Shell the harness expects the client to show.
 *
 * **Example** (Decode the chat-first shell)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EExpectedShell } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EExpectedShell)("chat_first"))
 * console.log(decoded) // "chat_first"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ChatFirstE2EExpectedShell = LiteralKit(["legacy", "chat_first"]).pipe(
  $I.annoteSchema("ChatFirstE2EExpectedShell", {
    description: "Expected client shell: legacy or chat_first.",
  }),
);

/**
 * Decoded expected shell.
 *
 * @see {@link ChatFirstE2EExpectedShell} for the runtime schema.
 * @category type-level
 * @since 0.0.0
 */
export type ChatFirstE2EExpectedShell = typeof ChatFirstE2EExpectedShell.Type;

const fixtureCaseColumn = (column: string) =>
  ChatFirstE2EFixtureCase.pipe(pg.text(), pg.columnName(column));

/**
 * Request that loads one harness fixture.
 *
 * **Example** (Decode a question fixture)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EPrepareRequest } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ChatFirstE2EPrepareRequest)({ fixtureCase: "question" }),
 * )
 * console.log(decoded.fixtureCase) // "question"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatFirstE2EPrepareRequest extends Model<ChatFirstE2EPrepareRequest>("ChatFirstE2EPrepareRequest")(
  {
    fixtureCase: fixtureCaseColumn("fixture_case"),
  },
  $I.annote("ChatFirstE2EPrepareRequest", {
    description: "Loads one content-free chat-first harness fixture.",
  }),
) {}

/**
 * Encoded form of {@link ChatFirstE2EPrepareRequest}.
 *
 * @see {@link ChatFirstE2EPrepareRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstE2EPrepareRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstE2EPrepareRequest>;
}

/**
 * Advances the harness clock by a bounded number of seconds.
 *
 * **Details**
 *
 * `seconds` is from 1 through 172800 (two days).
 *
 * **Example** (Accept one second)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EAdvanceRequest } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ChatFirstE2EAdvanceRequest)({ seconds: 1 }))
 * console.log(decoded.seconds) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatFirstE2EAdvanceRequest extends Model<ChatFirstE2EAdvanceRequest>("ChatFirstE2EAdvanceRequest")(
  {
    seconds: intBetween("seconds", 1, 172800),
  },
  $I.annote("ChatFirstE2EAdvanceRequest", {
    description: "Advances the harness clock by 1 to 172800 seconds.",
  }),
  (columns) => [betweenCheck("seconds", 1, 172800)(columns.seconds)],
) {}

/**
 * Encoded form of {@link ChatFirstE2EAdvanceRequest}.
 *
 * @see {@link ChatFirstE2EAdvanceRequest} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstE2EAdvanceRequest {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstE2EAdvanceRequest>;
}

/**
 * Shape-only observations from one harness fixture.
 *
 * **Details**
 *
 * Product text and entity payloads never leave here. Counts are zero or
 * greater. `fixtureRevision` is at least 1.
 *
 * **Example** (Decode a legacy shell snapshot)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ChatFirstE2EFixtureSnapshot } from "./ChatFirstE2e.ts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(ChatFirstE2EFixtureSnapshot)({
 *     fixtureCase: "disabled_control",
 *     fixtureRevision: 1,
 *     expectedShell: "legacy",
 *     controlEndpointMode: "unreachable",
 *     advancedSeconds: 0,
 *     materializedIntentCount: 0,
 *     readyIntentCount: 0,
 *     proactiveIntentCount: 0,
 *     pendingDeferralCount: 0,
 *   }),
 * )
 * console.log(decoded.expectedShell) // "legacy"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ChatFirstE2EFixtureSnapshot extends Model<ChatFirstE2EFixtureSnapshot>("ChatFirstE2EFixtureSnapshot")(
  {
    fixtureCase: fixtureCaseColumn("fixture_case"),
    fixtureRevision: intAtLeast("fixture_revision", 1),
    expectedShell: ChatFirstE2EExpectedShell.pipe(pg.text(), pg.columnName("expected_shell")),
    controlEndpointMode: ChatFirstE2EControlEndpointMode.pipe(pg.text(), pg.columnName("control_endpoint_mode")),
    advancedSeconds: intAtLeast("advanced_seconds", 0),
    materializedIntentCount: intAtLeast("materialized_intent_count", 0),
    readyIntentCount: intAtLeast("ready_intent_count", 0),
    proactiveIntentCount: intAtLeast("proactive_intent_count", 0),
    pendingDeferralCount: intAtLeast("pending_deferral_count", 0),
  },
  $I.annote("ChatFirstE2EFixtureSnapshot", {
    description: "Content-free observations of one chat-first harness fixture.",
  }),
  (columns) => [
    atLeastCheck("fixture_revision", 1)(columns.fixtureRevision),
    atLeastCheck("advanced_seconds", 0)(columns.advancedSeconds),
    atLeastCheck("materialized_intent_count", 0)(columns.materializedIntentCount),
    atLeastCheck("ready_intent_count", 0)(columns.readyIntentCount),
    atLeastCheck("proactive_intent_count", 0)(columns.proactiveIntentCount),
    atLeastCheck("pending_deferral_count", 0)(columns.pendingDeferralCount),
  ],
) {}

/**
 * Encoded form of {@link ChatFirstE2EFixtureSnapshot}.
 *
 * @see {@link ChatFirstE2EFixtureSnapshot} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ChatFirstE2EFixtureSnapshot {
  export type Encoded = S.Codec.Encoded<typeof ChatFirstE2EFixtureSnapshot>;
}
