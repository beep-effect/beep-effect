// fallow-ignore-file code-duplication -- consumer-local composition that replaces the retired `@beep/schema` `PosInt`; the upstream-first doctrine (standards/architecture/DECISIONS.md, 2026-09-29) forbids a shared replacement.
/**
 * Package-local positive integer schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PopplerId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $PopplerId.create("internal/PosInt");

/**
 * Integer greater than zero.
 *
 * @category schemas
 * @since 0.0.0
 */
export const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).annotate({
  identifier: $I`PosInt`,
  title: "PosInt",
  description: "An integer greater than zero.",
});

/**
 * Type for {@link PosInt}.
 *
 * @category models
 * @since 0.0.0
 */
export type PosInt = typeof PosInt.Type;
