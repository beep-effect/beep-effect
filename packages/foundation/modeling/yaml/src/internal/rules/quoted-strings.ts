import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import { StyleVote, YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { requoteScalarText } from "../requote.ts";
import { positionAt, walkScalars } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";
import type { YamlScalar } from "../../YamlNode.ts";

const $I = $YamlId.create("internal/rules/quoted-strings");

/**
 * Validates quote-style preferences and whether plain string scalars require quotes.
 *
 * **Details**
 *
 * Options for `quoted-strings`: the preferred `quoteType` (default
 * `"double"`) and whether plain string scalars are `required` to be quoted
 * at all (default `false` — only already-quoted scalars are policed).
 *
 * **Example** (Validate required single quotes)
 *
 * ```ts
 * import { quotedStringsOptions } from "@beep/yaml/internal/rules/quoted-strings"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(quotedStringsOptions)({ quoteType: "single", required: true })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class quotedStringsOptions extends S.Opaque<quotedStringsOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("quotedStringsOptions.severity", {
        description: "Reporting level for string-quoting findings, defaulting to `error`",
      })
    ),
    quoteType: S.optionalKey(S.Literals(["single", "double"])).pipe(
      $I.annoteKey("quotedStringsOptions.quoteType", {
        description:
          "Required quote style for quoted string values and sequence items, excluding mapping keys and defaulting to `double`",
      })
    ),
    required: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("quotedStringsOptions.required", {
        description:
          "Whether plain string values and sequence items must be quoted, excluding mapping keys and defaulting to `false`",
      })
    ),
  }).pipe(
    $I.annoteSchema("quotedStringsOptions", {
      description:
        'Options for `quoted-strings`: the preferred `quoteType` (default `"double"`) and whether plain string scalars are `required` to be quoted at all (default `false` — only already-quoted scalars are policed).',
    })
  )
) {}

// decision: shared-requote-modes
const safeQuoteFix: {
  (ctx: LintContext, scalar: YamlScalar, quote: '"' | "'"): YamlEdit | undefined;
  (scalar: YamlScalar, quote: '"' | "'"): (ctx: LintContext) => YamlEdit | undefined;
} = dual(3, (ctx: LintContext, scalar: YamlScalar, quote: '"' | "'"): YamlEdit | undefined =>
  O.getOrUndefined(
    O.map(requoteScalarText(ctx.text, scalar, quote, "conservative"), (content) =>
      YamlEdit.make({ offset: scalar.offset, length: scalar.length, content })
    )
  )
);

/**
 * Enforces quote-style policy for string value scalars and sequence items.
 *
 * **Details**
 *
 * Mapping keys are outside this rule's scope. Already-quoted string values
 * vote their quote style during inference; plain scalars do not vote.
 *
 * **Gotchas**
 *
 * A quote swap or wrap has a fix only when it preserves the parsed value:
 * the scalar must be single-line, without escapes, target-style quote
 * characters, tags, or anchors. Otherwise the diagnostic has no fix.
 *
 * **Example** (Identify the string quoting rule)
 *
 * ```ts
 * import { quotedStrings } from "@beep/yaml/internal/rules/quoted-strings"
 *
 * console.log(quotedStrings.id) // quoted-strings
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const quotedStrings = YamlRule.make({
  id: "quoted-strings",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const quoteType =
      P.hasProperty(options, "quoteType") && S.is(quotedStringsOptions.fields.quoteType.schema)(options.quoteType)
        ? options.quoteType
        : "double";
    const required =
      P.hasProperty(options, "required") && S.is(quotedStringsOptions.fields.required.schema)(options.required)
        ? options.required
        : false;
    const quote = quoteType === "double" ? '"' : "'";
    const wrongStyle = quoteType === "double" ? "single-quoted" : "double-quoted";
    const out: Array<YamlLintDiagnostic> = [];
    walkScalars(
      ctx.document.contents,
      "root",
      (scalar) => {
        if (!P.isString(scalar.value)) return;
        if (scalar.style === wrongStyle) {
          const fix = safeQuoteFix(ctx, scalar, quote);
          const pos = positionAt(ctx.lines, scalar.offset);
          out.push(
            YamlLintDiagnostic.make({
              rule: "quoted-strings",
              severity: "error",
              message: `String should use ${quoteType} quotes`,
              offset: scalar.offset,
              length: scalar.length,
              line: pos.line,
              character: pos.character,
              ...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
            })
          );
          return;
        }
        if (required && scalar.style === "plain" && scalar.length > 0) {
          const fix = safeQuoteFix(ctx, scalar, quote);
          const pos = positionAt(ctx.lines, scalar.offset);
          out.push(
            YamlLintDiagnostic.make({
              rule: "quoted-strings",
              severity: "error",
              message: `String should be quoted (${quoteType})`,
              offset: scalar.offset,
              length: scalar.length,
              line: pos.line,
              character: pos.character,
              ...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
            })
          );
        }
      },
      true
    );
    return out;
  }),
  infer: (ctx) => {
    const out: Array<StyleVote> = [];
    walkScalars(
      ctx.document.contents,
      "root",
      (scalar) => {
        if (!P.isString(scalar.value)) return;
        if (scalar.style !== "single-quoted" && scalar.style !== "double-quoted") return;
        const pos = positionAt(ctx.lines, scalar.offset);
        out.push(
          StyleVote.make({
            dimension: "quoteType",
            value: scalar.style === "single-quoted" ? "single" : "double",
            offset: scalar.offset,
            length: scalar.length,
            line: pos.line,
            character: pos.character,
          })
        );
      },
      true
    );
    return out;
  },
});
