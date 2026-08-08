/**
 * A module containing effect schemas for snake_case strings.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import { NonEmptyTrimmedStr } from "./String.ts";

const $I = $SchemaId.create("SnakeStr");

/**
 * Branded snake_case string schema.
 *
 * **Example** (Decode snake_case string)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { SnakeCaseStr } from "@beep/schema"
 *
 * const value = S.decodeUnknownSync(SnakeCaseStr)("workflow_status_2")
 * console.log(value) // "workflow_status_2"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const SnakeCaseStr = NonEmptyTrimmedStr.pipe(
  S.check(
    S.isPattern(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/, {
      message: "Must be SnakeCase format",
    })
  )
)
  .annotate({
    toArbitrary: () => (fc) =>
      fc.stringMatching(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/).map((value) => value as NonEmptyTrimmedStr),
  })
  .pipe(
    S.brand("SnakeCaseStr"),
    $I.annoteSchema("SnakeCaseStr", {
      description: "A branded snake_case string.",
    })
  );

/**
 * Type for {@link SnakeCaseStr}.
 *
 * **Example** (Type a snake_case value)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import type { SnakeCaseStr } from "@beep/schema"
 * import { SnakeCaseStr as SnakeCaseStrSchema } from "@beep/schema"
 *
 * const key: SnakeCaseStr = S.decodeUnknownSync(SnakeCaseStrSchema)("workflow_status")
 * console.log(key)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type SnakeCaseStr = typeof SnakeCaseStr.Type;
