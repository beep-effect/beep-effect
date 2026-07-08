/**
 * Tier-gate dispatch wrapper.
 *
 * `McpSchema.EnabledWhen` filters `tools/list` only — `tools/call` dispatch
 * never re-checks it (verified `McpServer.ts:255-262` vs. the shared
 * `filterByClient` helper at `McpServer.ts:1490-1512`, used generically by
 * every MCP list endpoint, not just `tools/list`). A client that already
 * knows a tool's name can call it even if that tool was filtered out of its
 * tool list. This module's dispatch wrapper is the real security boundary: a
 * `ClaimGate`-shaped (refusal-as-value, error channel `never`, fail-closed;
 * pattern: `packages/epistemic/use-cases/src/ClaimGate/ClaimGate.ports.ts:42-47`)
 * gate that wraps `tools/call` dispatch and produces a sanitized audit
 * record — shaped for the `UsageRecord.metadata` jsonb sink
 * (`packages/epistemic/domain/src/entities/UsageRecord/UsageRecord.model.ts:95-97`;
 * persistence wiring is consumer-side) — for every gated or refused call.
 *
 * The paired `enabledWhenApprovedTool` helper only ever affects `tools/list`
 * visibility; it must never be relied upon as the enforcement point.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $McpKitId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Context, Data, DateTime, Effect } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as McpSchema from "effect/unstable/ai/McpSchema";
import * as AiTool from "effect/unstable/ai/Tool";
import type * as O from "effect/Option";
import type * as P from "effect/Predicate";

const $I = $McpKitId.create("TierGate");

const TierGateOutcomeTag = LiteralKit(["approved", "refused"]);

/**
 * Outcome discriminant carried by {@link TierGateAuditRecord}, mirroring
 * {@link TierGateVerdict}'s own tag so a persisted audit record is
 * self-describing independent of the verdict it was extracted from.
 *
 * @example
 * ```ts
 * import { TierGateOutcome } from "@beep/mcp-kit"
 *
 * const outcome = TierGateOutcome.Enum.approved
 * console.log(TierGateOutcome.is.approved(outcome))
 * // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TierGateOutcome = TierGateOutcomeTag.pipe(
  $I.annoteSchema("TierGateOutcome", {
    description: "Outcome discriminant carried by TierGateAuditRecord: approved or refused.",
  })
);

/**
 * Runtime type for {@link TierGateOutcome}.
 *
 * @example
 * ```ts
 * import { TierGateOutcome } from "@beep/mcp-kit"
 * import type { TierGateOutcome as TierGateOutcomeType } from "@beep/mcp-kit"
 *
 * const outcome: TierGateOutcomeType = TierGateOutcome.Enum.refused
 * console.log(outcome)
 * // "refused"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TierGateOutcome = typeof TierGateOutcome.Type;

/**
 * Sanitized audit record written for **every** gated `tools/call` dispatch —
 * approved and refused alike, per Q7 (`explorations/mcp-auth-gated-registration/DECISIONS.md:157`:
 * "Each gated call is audited"). Shaped as a plain JSON-serializable record
 * so it can be stored directly in the `UsageRecord.metadata` jsonb column;
 * persistence wiring belongs to the consumer.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import { TierGateAuditRecord } from "@beep/mcp-kit"
 *
 * const audit = TierGateAuditRecord.make({
 *   tool: "delete_document",
 *   outcome: "refused",
 *   reason: "Tool is destructive and not present in the approved-tools policy.",
 *   destructive: true,
 *   toolCallId: O.none(),
 *   occurredAt: "2026-07-01T00:00:00.000Z"
 * })
 * console.log(audit.tool)
 * // "delete_document"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TierGateAuditRecord extends S.Class<TierGateAuditRecord>($I`TierGateAuditRecord`)(
  {
    tool: S.NonEmptyString.annotateKey({
      description: "Name of the dispatched or refused tool.",
    }),
    outcome: TierGateOutcome.annotateKey({
      description: "Whether this gated call was approved or refused.",
    }),
    reason: S.NonEmptyString.annotateKey({
      description: "Human-readable reason for the outcome.",
    }),
    destructive: S.Boolean.annotateKey({
      description: "Whether the tool is annotated as destructive.",
    }),
    toolCallId: S.OptionFromNullOr(S.NonEmptyString).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Caller-supplied tool call identifier, when available.",
      })
    ),
    occurredAt: S.NonEmptyString.annotateKey({
      description: "ISO-8601 timestamp at which the outcome was decided.",
    }),
  },
  $I.annote("TierGateAuditRecord", {
    description: "Sanitized audit record written for every gated tools/call dispatch, approved or refused.",
  })
) {
  static readonly is = S.is(TierGateAuditRecord);
}

/**
 * Typed verdict returned by the tier gate, discriminated on `verdict`. Both
 * `approved` and `refused` verdicts carry a {@link TierGateAuditRecord} — Q7
 * requires every gated call to be audited, not only refusals.
 *
 * @example
 * ```ts
 * import { TierGateVerdict } from "@beep/mcp-kit"
 * import * as S from "effect/Schema"
 *
 * const verdict = S.decodeUnknownSync(TierGateVerdict)({
 *   verdict: "approved",
 *   audit: {
 *     tool: "search_documents",
 *     outcome: "approved",
 *     reason: "Tool is read-only and non-destructive; no approval required.",
 *     destructive: false,
 *     toolCallId: null,
 *     occurredAt: "2026-07-01T00:00:00.000Z"
 *   }
 * })
 * console.log(verdict.verdict)
 * // "approved"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TierGateVerdict = TierGateOutcomeTag.toTaggedUnion("verdict")({
  approved: { audit: TierGateAuditRecord },
  refused: { audit: TierGateAuditRecord },
}).pipe(
  $I.annoteSchema("TierGateVerdict", {
    description: "Typed approved/refused verdict returned by the tier gate; both cases carry an audit record.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link TierGateVerdict}.
 *
 * @example
 * ```ts
 * import * as O from "effect/Option"
 * import type { TierGateVerdict } from "@beep/mcp-kit"
 *
 * const approved: TierGateVerdict = {
 *   verdict: "approved",
 *   audit: {
 *     tool: "search_documents",
 *     outcome: "approved",
 *     reason: "Tool is read-only and non-destructive; no approval required.",
 *     destructive: false,
 *     toolCallId: O.none(),
 *     occurredAt: "2026-07-01T00:00:00.000Z"
 *   }
 * }
 * console.log(approved.verdict)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type TierGateVerdict = typeof TierGateVerdict.Type;

/**
 * The minimal description of a `tools/call` dispatch the gate needs to
 * decide: the tool being invoked (carrying its `Tool.Destructive` and other
 * annotations) and an optional caller-supplied tool call identifier.
 *
 * @category models
 * @since 0.0.0
 */
export interface ToolCallRequest {
  readonly tool: AiTool.Any;
  readonly toolCallId: O.Option<string>;
}

/**
 * Service shape for the tier gate: evaluate a `tools/call` dispatch request
 * and return a typed approved/refused verdict. Refusal is a value
 * ({@link TierGateVerdict}), never an error — mirrors the `ClaimGate` total-
 * engine pattern.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import type { TierGateShape } from "@beep/mcp-kit"
 * import { TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit"
 *
 * const approvedAudit = TierGateAuditRecord.make({
 *   tool: "search_documents",
 *   outcome: "approved",
 *   reason: "Tool is read-only and non-destructive; no approval required.",
 *   destructive: false,
 *   toolCallId: O.none(),
 *   occurredAt: "2026-07-01T00:00:00.000Z"
 * })
 *
 * const shape: TierGateShape = {
 *   evaluate: () => Effect.succeed(TierGateVerdict.make({ verdict: "approved", audit: approvedAudit }))
 * }
 *
 * strictEqual(typeof shape.evaluate, "function")
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface TierGateShape {
  readonly evaluate: (request: ToolCallRequest) => Effect.Effect<TierGateVerdict>;
}

/**
 * Tier gate service tag.
 *
 * @example
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { TierGate, TierGateAuditRecord, TierGateVerdict } from "@beep/mcp-kit"
 *
 * const approvedAudit = TierGateAuditRecord.make({
 *   tool: "search_documents",
 *   outcome: "approved",
 *   reason: "Tool is read-only and non-destructive; no approval required.",
 *   destructive: false,
 *   toolCallId: O.none(),
 *   occurredAt: "2026-07-01T00:00:00.000Z"
 * })
 *
 * const hasEvaluate = Effect.runSync(
 *   Effect.gen(function* () {
 *     const gate = yield* TierGate
 *     return typeof gate.evaluate === "function"
 *   }).pipe(
 *     Effect.provideService(
 *       TierGate,
 *       TierGate.of({ evaluate: () => Effect.succeed(TierGateVerdict.make({ verdict: "approved", audit: approvedAudit })) })
 *     )
 *   )
 * )
 *
 * strictEqual(hasEvaluate, true)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class TierGate extends Context.Service<TierGate, TierGateShape>()($I`TierGate`) {}

/**
 * Policy consulted by {@link fromApprovedToolsPolicy}: the tool names
 * explicitly approved to dispatch regardless of their destructive
 * annotation.
 *
 * @example
 * ```ts
 * import { TierGatePolicy } from "@beep/mcp-kit"
 *
 * const policy = TierGatePolicy.make({ approvedTools: ["delete_document"] })
 * console.log(policy.approvedTools)
 * // ["delete_document"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TierGatePolicy extends S.Class<TierGatePolicy>($I`TierGatePolicy`)(
  {
    approvedTools: S.Array(S.NonEmptyString).annotateKey({
      description: "Tool names explicitly approved to dispatch regardless of their destructive annotation.",
    }),
  },
  $I.annote("TierGatePolicy", {
    description: "Policy consulted by fromApprovedToolsPolicy: tool names explicitly approved to dispatch.",
  })
) {}

// `Tool.Destructive` is a `Context.Reference` (default `constTrue`), so
// `Context.get` already resolves the fail-closed default for unannotated
// tools without throwing (references never raise "service not found",
// unlike plain `Context.Service` keys). `Context.getOrElse` is used anyway
// so the fail-closed default is explicit in this module's own source, not
// only inherited silently from `effect/unstable/ai/Tool`'s definition.
const isDestructive = (tool: AiTool.Any): boolean =>
  Context.getOrElse(tool.annotations, AiTool.Destructive, () => true);

// `Tool.Readonly` defaults false. A non-destructive annotation alone is only
// a weak hint; bypassing approval requires an explicit read-only assertion too.
const isReadOnly = (tool: AiTool.Any): boolean => Context.getOrElse(tool.annotations, AiTool.Readonly, () => false);

const isPolicyApproved = (policy: TierGatePolicy, tool: AiTool.Any): boolean =>
  (isReadOnly(tool) && !isDestructive(tool)) || A.contains(policy.approvedTools, tool.name);

const auditReason = (approved: boolean, destructive: boolean, readOnly: boolean): string => {
  if (!approved) {
    return destructive
      ? "Tool is destructive and not present in the approved-tools policy."
      : "Tool is not marked read-only; approval required.";
  }
  if (destructive) {
    return "Destructive tool explicitly approved by policy.";
  }
  return readOnly
    ? "Tool is read-only and non-destructive; no approval required."
    : "Tool explicitly approved by policy.";
};

/**
 * Builds a fail-closed {@link TierGateShape} from an approved-tools policy.
 * Tools pass without explicit approval only when they are marked both
 * `Tool.Readonly: true` and `Tool.Destructive: false`. Destructive tools,
 * unannotated tools, and non-read-only writes pass only when explicitly named
 * in `policy.approvedTools`. Every call produces a
 * {@link TierGateAuditRecord}, approved or refused (Q7).
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Tool } from "effect/unstable/ai"
 * import { fromApprovedToolsPolicy } from "@beep/mcp-kit"
 *
 * const writeTool = Tool.make("delete_document").annotate(Tool.Destructive, true)
 * const gate = fromApprovedToolsPolicy({ approvedTools: [] })
 *
 * const verdict = Effect.runSync(gate.evaluate({ tool: writeTool, toolCallId: O.none() }))
 * console.log(verdict.verdict)
 * // "refused"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const fromApprovedToolsPolicy = (policy: TierGatePolicy): TierGateShape => ({
  evaluate: (request) =>
    Effect.map(DateTime.now, (now) => {
      const destructive = isDestructive(request.tool);
      const readOnly = isReadOnly(request.tool);
      const approved = isPolicyApproved(policy, request.tool);
      const audit = TierGateAuditRecord.make({
        tool: request.tool.name,
        outcome: approved ? "approved" : "refused",
        reason: auditReason(approved, destructive, readOnly),
        destructive,
        toolCallId: request.toolCallId,
        occurredAt: DateTime.formatIso(now),
      });
      return approved
        ? TierGateVerdict.make({ verdict: "approved", audit })
        : TierGateVerdict.make({ verdict: "refused", audit });
    }),
});

/**
 * The result of dispatching a `tools/call` request through the tier gate:
 * `Dispatched` when the gate approved the call and the wrapped effect ran,
 * carrying both its result and the approval's {@link TierGateAuditRecord};
 * `Refused` when the gate refused fail-closed, carrying the refusal's audit
 * record. The wrapped effect never runs on the refused path. Every dispatch
 * — approved or refused — carries an audit record (Q7).
 *
 * @category models
 * @since 0.0.0
 */
export type TierGateDispatchResult<A> = Data.TaggedEnum<{
  readonly Dispatched: { readonly value: A; readonly audit: TierGateAuditRecord };
  readonly Refused: { readonly audit: TierGateAuditRecord };
}>;

interface TierGateDispatchResultDefinition extends Data.TaggedEnum.WithGenerics<1> {
  readonly taggedEnum: TierGateDispatchResult<this["A"]>;
}

/**
 * Tagged-enum constructors and matchers for {@link TierGateDispatchResult}.
 *
 * @category constructors
 * @since 0.0.0
 */
export const TierGateDispatchResult = Data.taggedEnum<TierGateDispatchResultDefinition>();

/**
 * Wraps a `tools/call` dispatch effect with the tier gate. Evaluates the
 * gate first; on `refused`, the wrapped effect never runs and the refusal
 * (with its audit record) is returned as a value. On `approved`, the wrapped
 * effect runs and both its result and the approval's audit record are
 * returned as a value. The gate's own evaluation never fails; the wrapper's
 * error channel is exactly the wrapped effect's error channel.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as O from "effect/Option"
 * import { Tool } from "effect/unstable/ai"
 * import { dispatchWithTierGate, fromApprovedToolsPolicy, TierGate } from "@beep/mcp-kit"
 *
 * const writeTool = Tool.make("delete_document").annotate(Tool.Destructive, true)
 * const gate = fromApprovedToolsPolicy({ approvedTools: [] })
 *
 * const program = dispatchWithTierGate(
 *   { tool: writeTool, toolCallId: O.none() },
 *   Effect.succeed("deleted")
 * ).pipe(Effect.provideService(TierGate, TierGate.of(gate)))
 *
 * const result = Effect.runSync(program)
 * console.log(result._tag)
 * // "Refused"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const dispatchWithTierGate = Effect.fn("dispatchWithTierGate")(function* <A, E, R>(
  request: ToolCallRequest,
  onApproved: Effect.Effect<A, E, R>
) {
  const gate = yield* TierGate;
  const verdict = yield* gate.evaluate(request);
  return yield* TierGateVerdict.match(verdict, {
    approved: ({ audit }) => Effect.map(onApproved, (value) => TierGateDispatchResult.Dispatched({ value, audit })),
    refused: ({ audit }) => Effect.succeed(TierGateDispatchResult.Refused({ audit })),
  });
});

/**
 * Annotates a tool with `McpSchema.EnabledWhen`, hiding it from `tools/list`
 * when the approved-tools policy would refuse it. **This affects list
 * visibility only** — `tools/call` dispatch never re-checks
 * `EnabledWhen` (verified `McpServer.ts:255-262`). Always pair this with
 * {@link dispatchWithTierGate}, which is the real enforcement boundary.
 *
 * @example
 * ```ts
 * import { Tool } from "effect/unstable/ai"
 * import { withEnabledWhenApprovedTool } from "@beep/mcp-kit"
 *
 * const writeTool = Tool.make("delete_document").annotate(Tool.Destructive, true)
 * const listed = withEnabledWhenApprovedTool(writeTool, { approvedTools: [] })
 * console.log(listed.name)
 * // "delete_document"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withEnabledWhenApprovedTool: {
  (policy: TierGatePolicy): <T extends AiTool.Any>(tool: T) => T;
  <T extends AiTool.Any>(tool: T, policy: TierGatePolicy): T;
} = dual(2, <T extends AiTool.Any>(tool: T, policy: TierGatePolicy): T => {
  const predicate: P.Predicate<unknown> = () => isPolicyApproved(policy, tool);
  // `Tool#annotate` returns the widened `Tool<Name, Config, Requirements>`
  // shape rather than the caller's specific `T`; the annotation itself does
  // not change `Name`/`Config`/`Requirements`, so re-narrowing here is sound.
  return tool.annotate(McpSchema.EnabledWhen, predicate) as T;
});
