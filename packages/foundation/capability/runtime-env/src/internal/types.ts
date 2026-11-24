/**
 * The plain environment record every detector reads.
 *
 * **Details**
 *
 * Every detector under `src/internal/` is a pure function of one of these, never of `process.env`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RuntimeEnvId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $RuntimeEnvId.create("internal/types");

/**
 * **Example** (Validate an environment record)
 *
 * ```ts
 * import { Env } from "@beep/runtime-env/internal/types";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(Env)({ CI: "1", NO_COLOR: undefined })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Env = S.Record(S.String, S.UndefinedOr(S.String)).pipe(
  $I.annoteSchema("Env", {
    description: "A plain environment record: variable name to value, undefined reads as unset.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type Env = typeof Env.Type;
