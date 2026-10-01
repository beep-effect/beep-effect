/**
 * Reattach LiteralKit keyed helpers after a schema derivation that builds a new schema.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { withStatics } from "./withStatics.ts";
import type { A } from "@beep/utils";
import type { SchemaAST } from "effect";
import type { LiteralKit as LiteralKitSchema } from "../LiteralKit/index.ts";

type LiteralKitStatics<L extends A.NonEmptyReadonlyArray<SchemaAST.LiteralValue>> = Pick<
  LiteralKitSchema<L>,
  "is" | "Enum" | "$match" | "toTaggedUnion"
>;

/**
 * Copies a kit's keyed helpers (`is`, `Enum`, `$match`, `toTaggedUnion`) onto
 * a schema derived from it.
 *
 * **Details**
 *
 * A `LiteralKit` keeps its helpers across `annotate`, `annotateKey`, and
 * `check` on its own. This decorator is for derivations that build a new
 * schema, such as `S.brand(...)`, where the result is no longer the kit. The
 * literal tuple is not copied: read it from the kit, `Base.literals`.
 *
 * **Example** (Reattach helpers after a brand)
 *
 * ```ts
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import { withLiteralKitStatics } from "@beep/schema/SchemaUtils/withLiteralKitStatics"
 * import * as S from "effect/Schema"
 *
 * const StatusBase = LiteralKit(["draft", "published"])
 * const Status = StatusBase.pipe(S.brand("Status"), withLiteralKitStatics(StatusBase))
 *
 * console.log(Status.is.published("published"), StatusBase.literals.length)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const withLiteralKitStatics = <const L extends A.NonEmptyReadonlyArray<SchemaAST.LiteralValue>>(
  literalKit: LiteralKitSchema<L>
): (<S extends object>(schema: S) => S & LiteralKitStatics<L>) =>
  withStatics(
    (): LiteralKitStatics<L> => ({
      is: literalKit.is,
      Enum: literalKit.Enum,
      $match: literalKit.$match,
      toTaggedUnion: literalKit.toTaggedUnion,
    })
  );
