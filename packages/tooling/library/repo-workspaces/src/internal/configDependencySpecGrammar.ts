import { $RepoWorkspacesId } from "@beep/identity/packages";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoWorkspacesId.create("internal/configDependencySpecGrammar");

/**
 * A `configDependencies` spec split into its two textual halves, neither validated.
 *
 * **Example** (Validate a version without an integrity suffix)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { ConfigDependencySpecParts } from "@beep/repo-workspaces/internal/configDependencySpecGrammar";
 *
 * console.log(S.is(ConfigDependencySpecParts)({ version: "1.0.0", integrity: undefined })) // true
 * console.log(S.is(ConfigDependencySpecParts)(null)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ConfigDependencySpecParts extends S.Opaque<ConfigDependencySpecParts, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The text before the first `+` (the whole spec when there is none). */
    version: S.String.pipe(
      $I.annoteKey("ConfigDependencySpecParts.version", {
        description: "The unvalidated text before the first plus sign, or the entire bare spec.",
      })
    ),
    /** The text after the first `+`, or `undefined` when the spec has no `+`. */
    integrity: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("ConfigDependencySpecParts.integrity", {
        description: "The unvalidated remaining text, explicitly undefined for a bare spec.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ConfigDependencySpecParts", {
      description: "The plain textual halves of a lenient config-dependency spec split.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ConfigDependencySpecParts {
  /**
   * The plain, unbranded encoded shape of a {@link ConfigDependencySpecParts}.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ConfigDependencySpecParts.Encoded;
}

/**
 * Splits a spec on its first `+`: `0.9.0+sha512-…` → `{ version: "0.9.0", integrity: "sha512-…" }`.
 *
 * **Details**
 *
 * Neither textual half is validated. The first `+` begins the integrity
 * component, rather than SemVer build metadata; later `+` characters remain
 * part of the integrity.
 *
 * **Example** (Preserve integrity plus signs)
 *
 * ```ts
 * import { splitConfigDependencySpec } from "@beep/repo-workspaces/internal/configDependencySpecGrammar"
 *
 * const parts = splitConfigDependencySpec("0.9.0+sha512-a+b")
 * console.log(parts.version) // 0.9.0
 * console.log(parts.integrity) // sha512-a+b
 * console.log(splitConfigDependencySpec("0.9.0").integrity) // undefined
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const splitConfigDependencySpec = (spec: string): ConfigDependencySpecParts =>
  O.match(Str.indexOf("+")(spec), {
    onNone: () => ConfigDependencySpecParts.make({ version: spec, integrity: undefined }),
    onSome: (plus) =>
      ConfigDependencySpecParts.make({ version: Str.slice(0, plus)(spec), integrity: Str.slice(plus + 1)(spec) }),
  });
