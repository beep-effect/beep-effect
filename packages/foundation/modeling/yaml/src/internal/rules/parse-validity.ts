import { $YamlId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { YamlLintDiagnostic, YamlRule } from "../../YamlLintRule.ts";
import type { LintContext } from "../../YamlLintRule.ts";

const $I = $YamlId.create("internal/rules/parse-validity");

/**
 * Validates the empty options object for the always-on parse-validity rule.
 *
 * **Details**
 *
 * parse-validity accepts no options; the config layer additionally rejects
 * every attempt to set a severity or `"off"` on this rule.
 *
 * **Example** (Validate empty parse-validity options)
 *
 * ```ts
 * import { parseValidityOptions } from "@beep/yaml/internal/rules/parse-validity"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(parseValidityOptions)({})) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class parseValidityOptions extends S.Opaque<parseValidityOptions, { readonly brand: unique symbol }>()(
  S.Struct({}).pipe(
    $I.annoteSchema("parseValidityOptions", {
      description:
        'parse-validity accepts no options; the config layer additionally rejects any attempt to set a severity or `"off"` on this rule.',
    })
  )
) {}

/**
 * Bridges recovered parser diagnostics into the always-on parse-validity lint rule.
 *
 * **Details**
 *
 * Engine errors remain lint errors, and engine warnings remain warnings.
 * This bridge lets linting report findings on documents that do not parse.
 * Duplicate-key policy belongs to the configurable key-duplicates rule.
 *
 * **Example** (Identify the mandatory parser rule)
 *
 * ```ts
 * import { parseValidity } from "@beep/yaml/internal/rules/parse-validity"
 *
 * console.log(parseValidity.id) // parse-validity
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const parseValidity = YamlRule.make({
  id: "parse-validity",
  check: dual(
    2,
    (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => [
      ...A.map(ctx.document.errors, (d) =>
        YamlLintDiagnostic.make({
          rule: "parse-validity",
          severity: "error",
          message: d.message,
          offset: d.offset,
          length: d.length,
          line: d.line,
          character: d.character,
        })
      ),
      ...A.map(ctx.document.warnings, (d) =>
        YamlLintDiagnostic.make({
          rule: "parse-validity",
          severity: "warning",
          message: d.message,
          offset: d.offset,
          length: d.length,
          line: d.line,
          character: d.character,
        })
      ),
    ]
  ),
});
