/**
 * The single wire contract for machine-readable schema-first policy findings.
 *
 * `beep lint schema-first` emits one JSON object per finding, prefixed with
 * {@link SchemaFirstPolicyIssuePrefix}, on stdout. Two consumers parse those
 * lines back: Yeet's quality issue index and AgentEffectiveness's eval scorer.
 * Historically all three carried their own private copy of the shape, and the
 * copies had already drifted (Yeet required `severity`/`remediation`, the scorer
 * made both optional). This module is the one schema so any future drift becomes
 * a type error instead of a silently dropped line.
 *
 * The optionality is reconciled to the union of what the copies accepted:
 * `severity` and `remediation` are optional here, so every currently-emitted
 * line (which always includes both) decodes, and the emitter's output is
 * representable unchanged.
 *
 * ## Severity divergence (preserved, not unified)
 *
 * The `[schema-first:issue]` emitter emits `"warning" | "error"`. The
 * `Laws/NoNativeRuntime` law severity domain independently spells the
 * non-blocking level `"warn"`. {@link SchemaFirstPolicySeverity} represents the
 * union (`warn`, `warning`, `error`) so both spellings are decodable today; it
 * deliberately does not collapse `warn` into `warning`. Unifying the spelling is
 * a separate decision recorded for a later wave.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { JsonStringCodec } from "../schema/JsonCodec.ts";

const $I = $RepoCliId.create("internal/quality/SchemaFirstPolicyFinding");

/**
 * Line prefix (including the trailing space) that marks a machine-readable
 * schema-first policy finding on `beep lint schema-first` stdout.
 *
 * **Example** (Prefix match on finding line)
 *
 * ```ts
 * import { SchemaFirstPolicyIssuePrefix } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 *
 * console.log("line".startsWith(SchemaFirstPolicyIssuePrefix))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SchemaFirstPolicyIssuePrefix = "[schema-first:issue] " as const;

/**
 * Severity vocabulary for schema-first policy findings.
 *
 * **Details**
 *
 * Represents both spellings observed across the quality lanes: the
 * `[schema-first:issue]` emitter uses `warning`/`error`, while the
 * `Laws/NoNativeRuntime` law severity domain spells the non-blocking level
 * `warn`. Both are retained; no spelling is silently unified.
 *
 * **Example** (Check warn and warning spellings)
 *
 * ```ts
 * import { SchemaFirstPolicySeverity } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 *
 * console.log(SchemaFirstPolicySeverity.is.warn("warn"))
 * console.log(SchemaFirstPolicySeverity.is.warning("warning"))
 * ```
 *
 * @category schema
 * @since 0.0.0
 */
export const SchemaFirstPolicySeverity = LiteralKit(["warn", "warning", "error"]).pipe(
  $I.annoteSchema("SchemaFirstPolicySeverity", {
    description:
      "Severity levels for schema-first policy findings; retains both the emitter 'warning' and law 'warn' spellings.",
  })
);

/**
 * One machine-readable schema-first policy finding line payload.
 *
 * **Details**
 *
 * The single decoded/encoded shape for `[schema-first:issue]` JSON. `severity`
 * and `remediation` are optional to reconcile the diverged consumer copies while
 * remaining a superset that decodes every currently-emitted line.
 *
 * **Example** (Make finding with remediation)
 *
 * ```ts
 * import { SchemaFirstPolicyFinding } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 *
 * const finding = SchemaFirstPolicyFinding.make({
 *   category: "schema-first-policy",
 *   ruleId: "SFV4-defaults",
 *   severity: "warning",
 *   file: "packages/example/src/Widget.ts",
 *   message: "Prefer schema defaults over a Defaults helper.",
 *   remediation: "Apply S.withConstructorDefault to the field."
 * })
 * console.log(finding.ruleId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SchemaFirstPolicyFinding extends S.Class<SchemaFirstPolicyFinding>($I`SchemaFirstPolicyFinding`)(
  {
    category: S.Literal("schema-first-policy"),
    ruleId: S.String,
    severity: S.optionalKey(SchemaFirstPolicySeverity),
    file: S.String,
    line: S.optionalKey(S.Finite),
    symbol: S.optionalKey(S.String),
    message: S.String,
    remediation: S.optionalKey(S.String),
  },
  $I.annote("SchemaFirstPolicyFinding", {
    description: "Machine-readable schema-first policy finding shared by the lint emitter and its consumers.",
  })
) {}

const codec = JsonStringCodec(SchemaFirstPolicyFinding);

/**
 * Decode the JSON payload of a schema-first policy finding, failing with a
 * `SchemaError` on malformed input.
 *
 * **Example** (Decode finding JSON payload)
 *
 * ```ts
 * import { decodeSchemaFirstPolicyFinding } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 * import { Effect } from "effect"
 *
 * const json = '{"category":"schema-first-policy","ruleId":"SFV4-defaults","file":"a.ts","message":"m"}'
 * console.log(Effect.runSync(decodeSchemaFirstPolicyFinding(json)).ruleId)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const decodeSchemaFirstPolicyFinding: (text: string) => Effect.Effect<SchemaFirstPolicyFinding, S.SchemaError> =
  codec.decode;

/**
 * Encode a schema-first policy finding into its compact JSON payload.
 *
 * **Example** (Encode finding to JSON)
 *
 * ```ts
 * import { encodeSchemaFirstPolicyFinding, SchemaFirstPolicyFinding } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 * import { Effect } from "effect"
 *
 * const finding = SchemaFirstPolicyFinding.make({
 *   category: "schema-first-policy",
 *   ruleId: "SFV4-defaults",
 *   file: "a.ts",
 *   message: "m"
 * })
 * console.log(Effect.runSync(encodeSchemaFirstPolicyFinding(finding)))
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export const encodeSchemaFirstPolicyFinding: (
  finding: SchemaFirstPolicyFinding
) => Effect.Effect<string, S.SchemaError> = codec.encode;

/**
 * Render a schema-first policy finding as a complete prefixed stdout line.
 *
 * **Details**
 *
 * Reproduces the emitter's line exactly: compact JSON prefixed by
 * {@link SchemaFirstPolicyIssuePrefix}.
 *
 * **Example** (Render prefixed stdout finding line)
 *
 * ```ts
 * import { renderSchemaFirstPolicyFindingLine, SchemaFirstPolicyFinding } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 * import { Effect } from "effect"
 *
 * const finding = SchemaFirstPolicyFinding.make({
 *   category: "schema-first-policy",
 *   ruleId: "SFV4-defaults",
 *   file: "a.ts",
 *   message: "m"
 * })
 * console.log(Effect.runSync(renderSchemaFirstPolicyFindingLine(finding)).startsWith("[schema-first:issue] "))
 * ```
 *
 * @param finding - The finding to render.
 * @returns The prefixed line for stdout.
 * @category codecs
 * @since 0.0.0
 */
export const renderSchemaFirstPolicyFindingLine = (
  finding: SchemaFirstPolicyFinding
): Effect.Effect<string, S.SchemaError> =>
  codec.encode(finding).pipe(Effect.map((json) => `${SchemaFirstPolicyIssuePrefix}${json}`));

/**
 * Parse a stdout line into a schema-first policy finding, dropping non-matching
 * or malformed lines.
 *
 * **Details**
 *
 * Returns `None` when the line lacks the {@link SchemaFirstPolicyIssuePrefix} or
 * when its JSON payload does not decode.
 *
 * **Example** (Parse issue line or noise)
 *
 * ```ts
 * import { decodeSchemaFirstPolicyFindingLine } from "@beep/repo-cli/internal/quality/SchemaFirstPolicyFinding"
 * import * as O from "effect/Option"
 *
 * const line = '[schema-first:issue] {"category":"schema-first-policy","ruleId":"r","file":"a.ts","message":"m"}'
 * console.log(O.isSome(decodeSchemaFirstPolicyFindingLine(line)))
 * console.log(O.isNone(decodeSchemaFirstPolicyFindingLine("noise")))
 * ```
 *
 * @param line - A single stdout line.
 * @returns The decoded finding when the line is a well-formed issue line.
 * @category codecs
 * @since 0.0.0
 */
export const decodeSchemaFirstPolicyFindingLine = (line: string): O.Option<SchemaFirstPolicyFinding> =>
  Str.startsWith(SchemaFirstPolicyIssuePrefix)(line)
    ? codec.decodeOption(Str.slice(SchemaFirstPolicyIssuePrefix.length)(line))
    : O.none();
