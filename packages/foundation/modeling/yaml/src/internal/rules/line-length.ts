import { $YamlId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { StyleFloor, YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { nonNegativeIntegerOption } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";

const $I = $YamlId.create("internal/rules/line-length");

/**
 * Configure the maximum permitted line width.
 *
 * **Details**
 *
 * Options for `line-length`. `max` defaults to 120 — the kit-native line
 * width (the yamllint id is recognizable; the option surface and defaults
 * are ours).
 *
 * **Example** (Decode line-length options)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { lineLengthOptions } from "@beep/yaml/internal/rules/line-length";
 *
 * const options = S.decodeUnknownSync(lineLengthOptions)({ max: 80 });
 * console.log(options.max) // 80
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class lineLengthOptions extends S.Opaque<lineLengthOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("lineLengthOptions.severity", {
        description: "Reporting level for excessive line-length findings, defaulting to `error`",
      })
    ),
    max: S.optionalKey(nonNegativeIntegerOption).pipe(
      $I.annoteKey("lineLengthOptions.max", {
        description: "Maximum line length in UTF-16 code units, excluding the line terminator, defaulting to 120",
      })
    ),
  }).pipe(
    $I.annoteSchema("lineLengthOptions", {
      description:
        "Options for `line-length`. `max` defaults to 120 — the kit-native line width (the yamllint id is recognizable; the option surface and defaults are ours).",
    })
  )
) {}

const DEFAULT_MAX = 120;

/**
 * Report lines longer than the configured maximum.
 *
 * **Details**
 *
 * Lengths count UTF-16 code units and exclude line terminators. Inference
 * records the longest observed line as a floor; the configured maximum
 * remains default-driven.
 *
 * **Gotchas**
 *
 * There is no fix: shortening a line requires reflowing content, which is
 * formatting.
 *
 * **Example** (Find an overlong line)
 *
 * ```ts
 * import { lineLength } from "@beep/yaml/internal/rules/line-length";
 * import { YamlLint, YamlLintConfig } from "@beep/yaml/YamlLint";
 *
 * const config = YamlLintConfig.make({
 *   rules: { "line-length": { max: 5 } },
 * });
 * const diagnostics = YamlLint.run("name: Ada\n", [lineLength], config);
 * console.log(diagnostics.length) // 1
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const lineLength = YamlRule.make({
  id: "line-length",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const max =
      P.hasProperty(options, "max") && S.is(lineLengthOptions.fields.max.schema)(options.max)
        ? options.max
        : DEFAULT_MAX;
    const out: Array<YamlLintDiagnostic> = [];
    for (const line of ctx.lines) {
      if (line.text.length > max) {
        out.push(
          YamlLintDiagnostic.make({
            rule: "line-length",
            severity: "error",
            message: `Line is longer than ${max} characters (${line.text.length})`,
            offset: line.offset + max,
            length: line.text.length - max,
            line: line.number,
            character: max,
          })
        );
      }
    }
    return out;
  }),
  infer: (ctx) => {
    let longest = 0;
    for (const line of ctx.lines) {
      if (line.text.length > longest) longest = line.text.length;
    }
    return longest > 0 ? [StyleFloor.make({ dimension: "max", value: longest })] : [];
  },
});
