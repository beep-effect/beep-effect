import { identity } from "effect/Function";
import * as S from "effect/Schema";
import * as SchemaTransformation from "effect/SchemaTransformation";
import * as Str from "effect/String";

/**
 * Decode a string case-insensitively into a literal union; encode the canonical lowercase literal.
 *
 * **Example** (Decode a mixed-case enum value)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { caseInsensitiveLiterals } from "@beep/tsconfig/internal/caseInsensitiveLiterals";
 *
 * const Target = caseInsensitiveLiterals(S.Literals(["es2015", "esnext"]));
 * S.decodeUnknownSync(Target)("ES2015"); // "es2015"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const caseInsensitiveLiterals = <const L extends ReadonlyArray<string>>(literals: S.Literals<L>) =>
  S.String.pipe(
    S.decodeTo(
      literals,
      SchemaTransformation.transform({
        decode: Str.toLowerCase,
        encode: identity,
      })
    )
  );
