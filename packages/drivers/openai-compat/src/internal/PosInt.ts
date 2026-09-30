/**
 * Positive integer schema shared by this package's modules.
 *
 * **Details**
 *
 * `@beep/schema` retired its branded `PosInt` in favor of upstream
 * `effect/Schema`, which has no named positive-integer schema, so the package
 * names the composition once here instead of repeating it at each use.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
// fallow-ignore-file code-duplication -- consumer-local composition that replaces the retired `@beep/schema` `PosInt`; the upstream-first doctrine (standards/architecture/DECISIONS.md, 2026-09-29) forbids a shared replacement.

import { $OpenaiCompatId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $OpenaiCompatId.create("internal/PosInt");

/**
 * Integer greater than zero, for counts, limits, sizes and one-based
 * positions.
 *
 * **Details**
 *
 * The upstream composition `S.Int.check(S.isGreaterThan(0))`: decoding and
 * `PosInt.make` reject zero, negatives and non-integers. The decoded type is
 * `number`; no brand is attached.
 *
 * **Example** (Build a positive limit)
 *
 * ```ts
 * import { PosInt } from "./PosInt.ts"
 *
 * const limit = PosInt.make(25)
 * console.log(limit) // 25
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  identifier: $I`PosInt`,
  title: "PosInt",
  description: "An integer greater than zero.",
});

/**
 * Decoded type of {@link PosInt}: a plain `number`.
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export type PosInt = typeof PosInt.Type;
