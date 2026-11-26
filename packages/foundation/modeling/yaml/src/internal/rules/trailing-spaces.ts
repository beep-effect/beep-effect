import { $YamlId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { YamlEdit } from "../../YamlEdit.ts";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { insideScalarSpan } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";

const $I = $YamlId.create("internal/rules/trailing-spaces");

/**
 * Validates the reporting severity for trailing-whitespace findings.
 *
 * **Details**
 *
 * Options for `trailing-spaces` contain severity only — nothing to tune.
 *
 * **Example** (Validate warning-level whitespace reports)
 *
 * ```ts
 * import { trailingSpacesOptions } from "@beep/yaml/internal/rules/trailing-spaces"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(trailingSpacesOptions)({ severity: "warning" })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class trailingSpacesOptions extends S.Opaque<trailingSpacesOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("trailingSpacesOptions.severity", {
        description: "Reporting level for trailing-whitespace findings, defaulting to `error`",
      })
    ),
  }).pipe(
    $I.annoteSchema("trailingSpacesOptions", {
      description: "Options for `trailing-spaces` (severity only — nothing to tune).",
    })
  )
) {}

/**
 * Reports trailing spaces or tabs at the end of a line, with a deleting fix.
 *
 * **Details**
 *
 * Fix spans use source coordinates and leave line terminators intact,
 * including CRLF terminators.
 *
 * **Gotchas**
 *
 * Trailing whitespace inside scalar content is preserved because it is
 * part of the parsed value; a layout rule and its fix must not corrupt values.
 *
 * **Example** (Identify the whitespace cleanup rule)
 *
 * ```ts
 * import { trailingSpaces } from "@beep/yaml/internal/rules/trailing-spaces"
 *
 * console.log(trailingSpaces.id) // trailing-spaces
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const trailingSpaces = YamlRule.make({
  id: "trailing-spaces",
  check: dual(2, (ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => {
    const out: Array<YamlLintDiagnostic> = [];
    for (const line of ctx.lines) {
      const match = /[ \t]+$/.exec(line.text);
      if (match === null) continue;
      const runOffset = line.offset + match.index;
      // decision: layout-rules-skip-scalar-content
      if (insideScalarSpan(ctx.tokens, runOffset)) continue;
      out.push(
        YamlLintDiagnostic.make({
          rule: "trailing-spaces",
          severity: "error",
          message: "Trailing whitespace",
          offset: runOffset,
          length: match[0].length,
          line: line.number,
          character: match.index,
          fix: YamlEdit.make({ offset: runOffset, length: match[0].length, content: "" }),
        })
      );
    }
    return out;
  }),
});
