/**
 * A module containing effect schemas for PascalCase strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { NonEmptyTrimmedStr } from "./String.ts";

const $I = $SchemaId.create("PascalStr");

/**
 * Branded PascalCase string schema.
 *
 * **Example** (Decode PascalCase string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { PascalCaseStr } from "@beep/schema"
 *
 * const value = S.decodeUnknownSync(PascalCaseStr)("WorkflowStatus")
 * console.log(value) // "WorkflowStatus"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const PascalCaseStr = NonEmptyTrimmedStr.pipe(
  S.check(
    S.isPattern(/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/, {
      message: "Must be PascalCase format",
    })
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[A-Z][a-z0-9]*(?:[A-Z][a-z0-9]*)*$/).map((value) => value as NonEmptyTrimmedStr),
  })
  .pipe(
    S.brand("PascalCaseStr"),
    $I.annoteSchema("PascalCaseStr", {
      description: "A branded PascalCase string.",
    })
  );

/**
 * Type for {@link PascalCaseStr}.
 *
 * **Example** (Type-annotated PascalCase decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { PascalCaseStr } from "@beep/schema"
 * import { PascalCaseStr as PascalCaseStrSchema } from "@beep/schema"
 *
 * const name: PascalCaseStr = S.decodeUnknownSync(PascalCaseStrSchema)("WorkflowStatus")
 * console.log(name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PascalCaseStr = typeof PascalCaseStr.Type;
