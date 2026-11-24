/**
 * Instrument declarations owned by `@beep/repo-ai-metrics`: the
 * agent-attribution keys that say which harness, provider, account, route,
 * model role, emitter, lane and session produced a telemetry record.
 *
 * **Details**
 *
 * The repo catalog command merges this file with every other package's
 * `*.instruments.ts` file. The closed value lists are exported as literal
 * domains so harness wrappers stamp the same spellings the catalog checks.
 * `beep.lane` and `beep.session` are unbounded, so they never appear as metric
 * labels; the catalog's unbounded-label check enforces this. No AI semantics
 * move into `@beep/observability`: this package depends on its catalog
 * schemas, never the reverse.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  PackageName,
  SignalKind,
} from "@beep/observability/catalog";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";
import type * as A from "effect/Array";

const $I = $RepoAiMetricsId.create("AiMetrics.instruments");

const owner = PackageName.make("@beep/repo-ai-metrics");

/**
 * **Example** (Read a harness spelling)
 *
 * ```ts
 * import { AgentHarness } from "@beep/repo-ai-metrics/AiMetrics.instruments"
 *
 * console.log(AgentHarness.Enum["claude-code"]) // "claude-code"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentHarness = LiteralKit([
  "claude-code",
  "codex-cli",
  "cursor-cli",
  "grok-build",
  "grok-bot",
  "muse-code",
  "junie-cli",
  "ci",
  "webapp",
]).pipe(
  $I.annoteSchema("AgentHarness", {
    description: "Agent harness that ran a session.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AgentHarness = typeof AgentHarness.Type;

/**
 * **Example** (Read a provider spelling)
 *
 * ```ts
 * import { AgentProvider } from "@beep/repo-ai-metrics/AiMetrics.instruments"
 *
 * console.log(AgentProvider.Enum.anthropic) // "anthropic"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentProvider = LiteralKit(["anthropic", "openai", "xai", "cursor", "meta", "jetbrains"]).pipe(
  $I.annoteSchema("AgentProvider", {
    description: "Model provider that served an agent request.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AgentProvider = typeof AgentProvider.Type;

/**
 * **Example** (Read a route spelling)
 *
 * ```ts
 * import { AgentRoute } from "@beep/repo-ai-metrics/AiMetrics.instruments"
 *
 * console.log(AgentRoute.Enum["cursor-seat"]) // "cursor-seat"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AgentRoute = LiteralKit(["direct", "proxy", "cursor-seat", "grok-build", "junie"]).pipe(
  $I.annoteSchema("AgentRoute", {
    description: "Route an agent request took to its provider.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type AgentRoute = typeof AgentRoute.Type;

/**
 * **Example** (Read an emitter spelling)
 *
 * ```ts
 * import { TelemetryEmitter } from "@beep/repo-ai-metrics/AiMetrics.instruments"
 *
 * console.log(TelemetryEmitter.Enum.transcript) // "transcript"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const TelemetryEmitter = LiteralKit(["native", "wrapper", "proxy", "hook", "transcript"]).pipe(
  $I.annoteSchema("TelemetryEmitter", {
    description: "Component that emitted an agent telemetry record.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type TelemetryEmitter = typeof TelemetryEmitter.Type;

const everySignal: A.NonEmptyReadonlyArray<SignalKind> = [
  SignalKind.Enum.span,
  SignalKind.Enum.metric,
  SignalKind.Enum.log,
];
const traceSignals: A.NonEmptyReadonlyArray<SignalKind> = [SignalKind.Enum.span, SignalKind.Enum.log];

/**
 * Agent-attribution declarations: `beep.harness`, `beep.provider`,
 * `beep.provider_account`, `beep.route`, `beep.model_role`, `beep.emitter`,
 * `beep.lane` and `beep.session`.
 *
 * **Details**
 *
 * Harness, provider, route and emitter are closed, static and allowed at
 * `shape-only`. Provider account and model role are bounded open values that
 * need `standard`; a provider account is an ordinal or salted hash, never an
 * email. Lane and session are unbounded, need `standard`, and are carried
 * only on spans and logs; a session is a salted hash of the native session id.
 *
 * **Example** (List the attribution keys)
 *
 * ```ts
 * import { AiMetricsInstruments } from "@beep/repo-ai-metrics/AiMetrics.instruments"
 *
 * console.log(AiMetricsInstruments.attributes.length) // 8
 * console.log(AiMetricsInstruments.attributes[0]?.key) // "beep.harness"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const AiMetricsInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: AttributeKeyName.make("beep.harness"),
      type: "string",
      signals: everySignal,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(AgentHarness.literals),
      owner,
      description: "Agent harness that ran the session.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.provider"),
      type: "string",
      signals: everySignal,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(AgentProvider.literals),
      owner,
      description: "Model provider that served the request.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.provider_account"),
      type: "string",
      signals: everySignal,
      cardinality: "bounded",
      minTier: "standard",
      owner,
      description: "Provider account as an ordinal or salted hash, never an email address.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.route"),
      type: "string",
      signals: everySignal,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(AgentRoute.literals),
      owner,
      description: "Route the request took to its provider.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.model_role"),
      type: "string",
      signals: everySignal,
      cardinality: "bounded",
      minTier: "standard",
      owner,
      description: "Model manifest role id the request ran under.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.emitter"),
      type: "string",
      signals: everySignal,
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(TelemetryEmitter.literals),
      owner,
      description: "Component that emitted the record.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.lane"),
      type: "string",
      signals: traceSignals,
      cardinality: "unbounded",
      minTier: "standard",
      owner,
      description: "Work lane the session ran in.",
    }),
    AttributeKey.make({
      key: AttributeKeyName.make("beep.session"),
      type: "string",
      signals: traceSignals,
      cardinality: "unbounded",
      minTier: "standard",
      owner,
      description: "Salted hash of the native agent session id.",
    }),
  ],
});
