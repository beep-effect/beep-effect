// fallow-ignore-file code-duplication -- consumer-local PosInt composition replacing the retired `@beep/schema` export; the upstream-first ruling (standards/architecture/DECISIONS.md, 2026-09-29) forbids a shared helper. Owner: @beep/poppler. Exit: delete this file and import upstream when effect/Schema ships a positive-integer schema, or when that ruling admits a shared export.
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
 * @category schemas
 * @since 0.0.0
 */
export const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" })).pipe(
  $I.annoteSchema("PosInt", {
    description: "An integer greater than zero.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type PosInt = typeof PosInt.Type;
