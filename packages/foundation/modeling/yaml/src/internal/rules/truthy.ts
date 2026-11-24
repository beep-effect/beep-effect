// truthy: the YAML 1.1 boolean trap. `yes`/`no`/`on`/`off` parse as
// STRINGS in YAML 1.2 but read as booleans to humans (the `on:` key of a
// workflow file is the canonical victim), and `True`/`FALSE` are booleans in
// spellings a config may not want. Flags plain scalars — keys included —
// whose spelling is in the 1.1 boolean family but not in `allowed`.
//
// Two value-preserving fixes: a real boolean respells to the allowed
// spelling of the same truth value; a string lookalike gets quoted so it
// reads as the string it already is. A tagged scalar (`!!bool`, `!!str`) is
// explicit intent and never flagged.

import { $YamlId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { YamlEdit } from "../../YamlEdit.ts";
import { YamlLintDiagnostic, YamlLintSeverity, YamlRule } from "../../YamlLintRule.ts";
import { positionAt, walkScalars } from "./util.ts";
import type { LintContext } from "../../YamlLintRule.ts";

const $I = $YamlId.create("internal/rules/truthy");

/**
 * **Details**
 *
 * Options for `truthy`: the `allowed` boolean spellings (default
 * `["true", "false"]`) and whether mapping keys are checked (`checkKeys`,
 * default `true` — the workflow `on:` key is the point).
 *
 * **Example** (Validate value-only boolean spelling checks)
 *
 * ```ts
 * import { truthyOptions } from "@beep/yaml/internal/rules/truthy"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(truthyOptions)({ allowed: ["true", "false"], checkKeys: false })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class truthyOptions extends S.Opaque<truthyOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    severity: S.optionalKey(YamlLintSeverity).pipe(
      $I.annoteKey("truthyOptions.severity", {
        description: "Reporting level for disallowed boolean-spelling findings, defaulting to `error`",
      })
    ),
    allowed: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("truthyOptions.allowed", {
        description:
          "Case-sensitive spellings exempted from YAML 1.1 boolean-family checks, defaulting to `true` and `false`",
      })
    ),
    checkKeys: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("truthyOptions.checkKeys", {
        description: "Whether mapping keys are checked for disallowed YAML 1.1 boolean spellings, defaulting to `true`",
      })
    ),
  }).pipe(
    $I.annoteSchema("truthyOptions", {
      description:
        'Options for `truthy`: the `allowed` boolean spellings (default `["true", "false"]`) and whether mapping keys are checked (`checkKeys`, default `true` — the workflow `on:` key is the point).',
    })
  )
) {}

/** The YAML 1.1 boolean family, per spelling case the 1.1 grammar admits. */
const TRUTHY = HashSet.fromIterable([
  "yes",
  "Yes",
  "YES",
  "no",
  "No",
  "NO",
  "on",
  "On",
  "ON",
  "off",
  "Off",
  "OFF",
  "true",
  "True",
  "TRUE",
  "false",
  "False",
  "FALSE",
]);

const TRUE_SET = HashSet.fromIterable(["yes", "on", "true"]);

/**
 * Reports YAML 1.1 truthy spellings outside the allowed list.
 *
 * **Details**
 *
 * Checks plain scalars, including mapping keys by default. YAML 1.2 treats
 * `yes`, `no`, `on`, and `off` as strings, while readers may interpret them
 * as booleans. Boolean spellings such as `True` and `FALSE` are also checked.
 *
 * **Gotchas**
 *
 * Fixes preserve the parsed value: a real boolean is respelled only when
 * the canonical spelling of the same truth value is allowed, and a string
 * lookalike is quoted. Tagged scalars express explicit intent and are never flagged.
 *
 * **Example** (Identify the boolean spelling rule)
 *
 * ```ts
 * import { truthy } from "@beep/yaml/internal/rules/truthy"
 *
 * console.log(truthy.id) // truthy
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const truthy = YamlRule.make({
  id: "truthy",
  check: dual(2, (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> => {
    const allowed = HashSet.fromIterable(
      P.hasProperty(options, "allowed") && S.is(truthyOptions.fields.allowed.schema)(options.allowed)
        ? options.allowed
        : ["true", "false"]
    );
    const checkKeys =
      P.hasProperty(options, "checkKeys") && S.is(truthyOptions.fields.checkKeys.schema)(options.checkKeys)
        ? options.checkKeys
        : true;
    const out: Array<YamlLintDiagnostic> = [];
    walkScalars(
      ctx.document.contents,
      "root",
      (scalar) => {
        if (scalar.style !== "plain" || scalar.tag !== undefined) return;
        const raw = Str.slice(scalar.offset, scalar.offset + scalar.length)(ctx.text);
        if (!HashSet.has(TRUTHY, raw) || HashSet.has(allowed, raw)) return;
        const pos = positionAt(ctx.lines, scalar.offset);
        const isBool = P.isBoolean(scalar.value);
        const truth = HashSet.has(TRUE_SET, Str.toLowerCase(raw));
        const respell = truth ? "true" : "false";
        // A real boolean respells when the canonical spelling is allowed; a
        // string lookalike gets quoted. Both preserve the parsed value.
        const fix = isBool
          ? HashSet.has(allowed, respell)
            ? YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: respell })
            : undefined
          : YamlEdit.make({ offset: scalar.offset, length: scalar.length, content: `"${raw}"` });
        out.push(
          YamlLintDiagnostic.make({
            rule: "truthy",
            severity: "error",
            message: `Truthy value "${raw}" is not in the allowed spellings`,
            offset: scalar.offset,
            length: scalar.length,
            line: pos.line,
            character: pos.character,
            ...O.getSomesStruct({ fix: O.fromUndefinedOr(fix) }),
          })
        );
      },
      !checkKeys
    );
    return out;
  }),
});
