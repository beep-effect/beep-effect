/**
 * Instrument declarations owned by `@beep/practice-kg-mcp`: the tool id and
 * tool failure reason attribute keys the strict tier exports, and the
 * coarsened process CPU and RSS gauges.
 *
 * **Details**
 *
 * The repo catalog command merges this file with every other package's
 * `*.instruments.ts` file, and the strict host builds its own catalog from it
 * at startup. Both keys are static: their values are the toolkit's tool names
 * and the literal failure reasons, which tests pin against the toolkit and the
 * failure-reason schema. This file imports only the catalog kernel so the
 * catalog command can load it cheaply.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PracticeKgMcpId } from "@beep/identity/packages";
import {
  AttributeKey,
  AttributeKeyName,
  InstrumentDeclarations,
  MetricInstrument,
  MetricName,
  PackageName,
  UcumUnit,
} from "@beep/observability/catalog";
import { LiteralKit } from "@beep/schema";
import * as O from "effect/Option";

const $I = $PracticeKgMcpId.create("telemetry/PracticeKgTelemetry.instruments");

const owner = PackageName.make("@beep/practice-kg-mcp");

/**
 * Name of one practice KG tool, the only span name the strict tier exports.
 *
 * **Example** (Check a tool id)
 *
 * ```ts
 * import { PracticeKgToolId } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgToolId.is.kg_find("kg_find")) // true
 * console.log(PracticeKgToolId.literals.length) // 12
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const PracticeKgToolId = LiteralKit([
  "claim_self_check",
  "kg_clients",
  "kg_docket_family",
  "kg_application_lookup",
  "kg_find",
  "corpus_search_text",
  "corpus_get_document",
  "email_search",
  "kg_candidate_claims",
  "kg_matter_lookup",
  "kg_correspondent_lookup",
  "kg_provenance",
]).pipe(
  $I.annoteSchema("PracticeKgToolId", {
    description: "Name of one practice knowledge-graph MCP tool.",
  })
);

/**
 * Runtime type for {@link PracticeKgToolId}.
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgToolId = typeof PracticeKgToolId.Type;

/**
 * Attribute key the strict gate writes a span's tool id to.
 *
 * **Example** (Read the tool key)
 *
 * ```ts
 * import { PracticeKgToolKey } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgToolKey) // "beep.practice_kg.tool"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgToolKey = AttributeKeyName.make("beep.practice_kg.tool");

/**
 * Attribute key a failed tool call's handler span carries its literal
 * failure reason under.
 *
 * **Example** (Read the failure reason key)
 *
 * ```ts
 * import { PracticeKgFailureReasonAttribute } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgFailureReasonAttribute) // "beep.practice_kg.failure_reason"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgFailureReasonAttribute = AttributeKeyName.make("beep.practice_kg.failure_reason");

/**
 * The `beep.practice_kg.process.cpu` gauge: the host's CPU use over the last
 * 5-minute window, as a percent of one core, floored to a 5% step.
 *
 * **Details**
 *
 * The host samples its CPU time every 10 seconds and records one value per
 * window; the strict gate then floors it again onto its value ladder. The
 * gauge has no labels.
 *
 * **Example** (Read the gauge name and unit)
 *
 * ```ts
 * import { PracticeKgProcessCpu } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgProcessCpu.name) // "beep.practice_kg.process.cpu"
 * console.log(PracticeKgProcessCpu.unit) // "%"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgProcessCpu = MetricInstrument.make({
  name: MetricName.make("beep.practice_kg.process.cpu"),
  owner,
  attributes: [],
  minTier: "shape-only",
  description: "Host CPU use over the last 5-minute window, percent of one core, floored to a 5% step.",
  kind: "gauge",
  unit: UcumUnit.make("%"),
});

/**
 * The `beep.practice_kg.process.rss` gauge: the host's largest resident set
 * size in the last 5-minute window, floored to a 32 MiB step.
 *
 * **Details**
 *
 * Sampled every 10 seconds, recorded once per window, and floored again by
 * the strict gate. No disk I/O counter is ever recorded. The gauge has no
 * labels.
 *
 * **Example** (Read the gauge name and unit)
 *
 * ```ts
 * import { PracticeKgProcessRss } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgProcessRss.name) // "beep.practice_kg.process.rss"
 * console.log(PracticeKgProcessRss.unit) // "By"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgProcessRss = MetricInstrument.make({
  name: MetricName.make("beep.practice_kg.process.rss"),
  owner,
  attributes: [],
  minTier: "shape-only",
  description: "Largest host resident set size in the last 5-minute window, floored to a 32 MiB step.",
  kind: "gauge",
  unit: UcumUnit.make("By"),
});

/**
 * Practice KG declarations: the tool id and failure reason keys, both
 * allowed at the `shape-only` tier with literal values only, and the process
 * CPU and RSS gauges.
 *
 * **Example** (Count the declared keys)
 *
 * ```ts
 * import { PracticeKgTelemetryInstruments } from "../../src/telemetry/PracticeKgTelemetry.instruments.ts"
 *
 * console.log(PracticeKgTelemetryInstruments.attributes.length) // 2
 * console.log(PracticeKgTelemetryInstruments.instruments.length) // 2
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PracticeKgTelemetryInstruments = InstrumentDeclarations.make({
  attributes: [
    AttributeKey.make({
      key: PracticeKgToolKey,
      type: "string",
      signals: ["span", "metric"],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(PracticeKgToolId.literals),
      owner,
      description: "Practice KG tool a span or metric point belongs to.",
    }),
    AttributeKey.make({
      key: PracticeKgFailureReasonAttribute,
      type: "string",
      signals: ["span"],
      cardinality: "static",
      minTier: "shape-only",
      values: O.some(["store-query-failed", "row-decode-failed", "invalid-input"]),
      owner,
      description: "Literal reason a practice KG tool call failed; never the failure message.",
    }),
  ],
  instruments: [PracticeKgProcessCpu, PracticeKgProcessRss],
});
