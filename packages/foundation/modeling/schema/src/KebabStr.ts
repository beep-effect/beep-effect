/**
 * A module containing effect schemas for kebab-case strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { NonEmptyTrimmedStr } from "./String.ts";

const $I = $SchemaId.create("KebabStr");

/**
 * Branded kebab-case string schema with a lowercase leading letter.
 *
 * **Example** (Decode kebab-case string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { KebabCaseStr } from "@beep/schema"
 *
 * const value = S.decodeUnknownSync(KebabCaseStr)("my-role-2")
 * console.log(value) // "my-role-2"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const KebabCaseStr = NonEmptyTrimmedStr.pipe(
  S.check(
    S.isPattern(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/, {
      message: "Must be KebabCase format",
    })
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/).map((value) => value as NonEmptyTrimmedStr),
  })
  .pipe(
    S.brand("KebabCaseStr"),
    $I.annoteSchema("KebabCaseStr", {
      description: "A branded kebab-case string.",
    })
  );

/**
 * Type for {@link KebabCaseStr}.
 *
 * **Example** (Type a kebab-case string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { KebabCaseStr } from "@beep/schema"
 * import { KebabCaseStr as KebabCaseStrSchema } from "@beep/schema"
 *
 * const role: KebabCaseStr = S.decodeUnknownSync(KebabCaseStrSchema)("command-handler")
 * console.log(role)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KebabCaseStr = typeof KebabCaseStr.Type;
