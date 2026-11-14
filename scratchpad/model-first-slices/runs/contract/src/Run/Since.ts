import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

/**
 * Fields added to an existing run event after it was first stored. Each
 * reads its default when an older stored event lacks the key (D22), so no
 * stored event is rewritten.
 *
 * **Example** (A field phase 3 added)
 * ```ts
 * import { Since } from "@proto/runs-contract/Run/Since";
 * import * as S from "effect/Schema";
 *
 * const released = Since.phase3(S.Int, 0);
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Since = {
  /** Added in phase 3; older stored events read `absent`. */
  phase3: <Schema extends S.Top>(schema: Schema, absent: Schema["Encoded"]) =>
    schema.pipe(S.withDecodingDefaultKey(Effect.succeed(absent))),
  /** Added in phase 7; older stored events read `absent`. */
  phase7: <Schema extends S.Top>(schema: Schema, absent: Schema["Encoded"]) =>
    schema.pipe(S.withDecodingDefaultKey(Effect.succeed(absent))),
};
