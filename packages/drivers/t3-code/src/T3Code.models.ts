/**
 * Projections of the installed T3 MCP thread contracts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $T3CodeId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $T3CodeId.create("T3Code.models");
const Id = S.NonEmptyString.check(S.isMaxLength(512));
const RunStatus = LiteralKit([
  "preparing",
  "queued",
  "starting",
  "running",
  "waiting",
  "completed",
  "interrupted",
  "failed",
  "cancelled",
  "rolled_back",
]);
const Status = S.Union([S.Literal("idle"), RunStatus]);
const RuntimeMode = LiteralKit(["approval-required", "auto-accept-edits", "auto", "full-access"]);
const InteractionMode = LiteralKit(["default", "plan"]);

/**
 * One effective provider option reported by T3.
 * **Example** (Validate a T3CodeOption projection)
 * ```ts
 * import { T3CodeOption } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeOption)({ id: "effort", value: "medium" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeOption extends S.Class<T3CodeOption>($I`T3CodeOption`)(
  { id: Id, value: S.Union([S.String, S.Boolean]) },
  $I.annote("T3CodeOption", { description: "One effective provider option reported by T3." })
) {}

/**
 * Provider instance and model selected by the host.
 * **Example** (Validate a T3CodeModelSelection projection)
 * ```ts
 * import { T3CodeModelSelection } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeModelSelection)({ instanceId: "codex", model: "gpt-6.1-sol" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeModelSelection extends S.Class<T3CodeModelSelection>($I`T3CodeModelSelection`)(
  { instanceId: Id, model: Id, options: T3CodeOption.pipe(S.Array, S.optionalKey) },
  $I.annote("T3CodeModelSelection", { description: "Provider instance and model selected by the host." })
) {}

/**
 * Live host configuration; native permission readback requires separate evidence.
 * **Example** (Validate a T3CodeConfiguration projection)
 * ```ts
 * import { T3CodeConfiguration } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeConfiguration)({ threadId: "owned", modelSelection: { instanceId: "codex", model: "gpt-6.1-sol" }, runtimeMode: "full-access", interactionMode: "default" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeConfiguration extends S.Class<T3CodeConfiguration>($I`T3CodeConfiguration`)(
  {
    threadId: Id,
    modelSelection: T3CodeModelSelection,
    runtimeMode: RuntimeMode,
    interactionMode: InteractionMode,
  },
  $I.annote("T3CodeConfiguration", {
    description: "Live host configuration; native permission readback requires separate evidence.",
  })
) {}

/**
 * Workspace binding from an exact project read.
 * **Example** (Validate a T3CodeProject projection)
 * ```ts
 * import { T3CodeProject } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeProject)({ id: "project", workspaceRoot: "/owned/work" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeProject extends S.Class<T3CodeProject>($I`T3CodeProject`)(
  { id: Id, workspaceRoot: S.NonEmptyString },
  $I.annote("T3CodeProject", { description: "Workspace binding from an exact project read." })
) {}

/**
 * Owned thread projection without invented native session identity.
 * **Example** (Validate a T3CodeThread projection)
 * ```ts
 * import { T3CodeThread } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeThread)({ threadId: "owned", projectId: "project", status: "idle", latestRunId: null, activeRunId: null, providerInstanceId: "codex", model: "gpt-6.1-sol", runtimeMode: "full-access", interactionMode: "default", worktreePath: null })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeThread extends S.Class<T3CodeThread>($I`T3CodeThread`)(
  {
    threadId: Id,
    projectId: Id,
    status: Status,
    latestRunId: S.NullOr(Id),
    activeRunId: S.NullOr(Id),
    providerInstanceId: Id,
    model: Id,
    runtimeMode: RuntimeMode,
    interactionMode: InteractionMode,
    worktreePath: S.NullOr(S.String),
  },
  $I.annote("T3CodeThread", { description: "Owned thread projection without invented native session identity." })
) {}

/**
 * Exact run identity and lifecycle reported by the host.
 * **Example** (Validate a T3CodeRun projection)
 * ```ts
 * import { T3CodeRun } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeRun)({ runId: "run", ordinal: 1, status: "completed", providerInstanceId: "codex", model: "gpt-6.1-sol", requestedAt: "2026-10-09", startedAt: null, completedAt: null })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeRun extends S.Class<T3CodeRun>($I`T3CodeRun`)(
  {
    runId: Id,
    ordinal: S.Int.check(S.isGreaterThan(0)),
    status: RunStatus,
    providerInstanceId: Id,
    model: Id,
    requestedAt: S.String,
    startedAt: S.NullOr(S.String),
    completedAt: S.NullOr(S.String),
  },
  $I.annote("T3CodeRun", { description: "Exact run identity and lifecycle reported by the host." })
) {}

/**
 * Bounded timeline item with source and run provenance.
 * **Example** (Validate a T3CodeItem projection)
 * ```ts
 * import { T3CodeItem } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeItem)({ position: 0, visibility: "local", sourceThreadId: "owned", itemId: "item", runId: null, messageId: null, type: "message", status: "completed", text: "done", textTruncated: false })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeItem extends S.Class<T3CodeItem>($I`T3CodeItem`)(
  {
    position: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    visibility: S.Literals(["local", "inherited", "synthetic"]),
    sourceThreadId: Id,
    itemId: Id,
    runId: S.NullOr(Id),
    messageId: S.NullOr(Id),
    type: S.String,
    status: S.String,
    text: S.NullOr(S.String.check(S.isMaxLength(50000))),
    textTruncated: S.Boolean,
  },
  $I.annote("T3CodeItem", { description: "Bounded timeline item with source and run provenance." })
) {}

/**
 * Bounded thread read including recent runs and timeline pagination.
 * **Example** (Validate a T3CodeRead projection)
 * ```ts
 * import { T3CodeRead } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeRead)({ thread: { threadId: "owned", projectId: "project", status: "idle", latestRunId: null, activeRunId: null, providerInstanceId: "codex", model: "gpt-6.1-sol", runtimeMode: "full-access", interactionMode: "default", worktreePath: null }, recentRuns: [], items: [], nextPosition: null, hasMore: false })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeRead extends S.Class<T3CodeRead>($I`T3CodeRead`)(
  {
    thread: T3CodeThread,
    recentRuns: S.Array(T3CodeRun).check(S.isMaxLength(50)),
    items: S.Array(T3CodeItem).check(S.isMaxLength(100)),
    nextPosition: S.NullOr(S.Int),
    hasMore: S.Boolean,
  },
  $I.annote("T3CodeRead", { description: "Bounded thread read including recent runs and timeline pagination." })
) {}

/**
 * Queue submission receipt; acceptance alone is not model consumption.
 * **Example** (Validate a T3CodeSend projection)
 * ```ts
 * import { T3CodeSend } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeSend)({ threadId: "owned", messageId: "message", runId: "run", status: "queued", delivery: "queued" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeSend extends S.Class<T3CodeSend>($I`T3CodeSend`)(
  { threadId: Id, messageId: Id, runId: Id, status: Status, delivery: S.Literals(["started", "queued"]) },
  $I.annote("T3CodeSend", { description: "Queue submission receipt; acceptance alone is not model consumption." })
) {}

/**
 * Exact run observation; timeout does not cancel generation.
 * **Example** (Validate a T3CodeWait projection)
 * ```ts
 * import { T3CodeWait } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeWait)({ threadId: "owned", runId: "run", status: "completed", timedOut: false })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeWait extends S.Class<T3CodeWait>($I`T3CodeWait`)(
  { threadId: Id, runId: S.NullOr(Id), status: Status, timedOut: S.Boolean },
  $I.annote("T3CodeWait", { description: "Exact run observation; timeout does not cancel generation." })
) {}

/**
 * Interrupt acceptance is separate from a terminal interrupted observation.
 * **Example** (Validate a T3CodeInterrupt projection)
 * ```ts
 * import { T3CodeInterrupt } from "@beep/t3-code"
 * import * as S from "effect/Schema"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.runSync(S.decodeUnknownEffect(T3CodeInterrupt)({ threadId: "owned", runId: "run", status: "interrupt_requested" })))
 * ```
 * @category models
 * @since 0.0.0
 */
export class T3CodeInterrupt extends S.Class<T3CodeInterrupt>($I`T3CodeInterrupt`)(
  {
    threadId: Id,
    runId: S.NullOr(Id),
    status: S.Literals([
      "interrupt_requested",
      "no_active_run",
      "completed",
      "failed",
      "cancelled",
      "interrupted",
      "rolled_back",
    ]),
  },
  $I.annote("T3CodeInterrupt", {
    description: "Interrupt acceptance is separate from a terminal interrupted observation.",
  })
) {}
