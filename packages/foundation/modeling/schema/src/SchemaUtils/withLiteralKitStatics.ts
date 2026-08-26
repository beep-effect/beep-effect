/**
 * Reattach LiteralKit statics after a schema transformation or annotation.
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
  "Options" | "HashSet" | "is" | "Enum" | "pickOptions" | "omitOptions" | "$match" | "thunk" | "toTaggedUnion"
>;

/**
 * `LiteralKit` augments the underlying schema object with runtime helpers like
 * `Enum`, `Options`, `HashSet`, and `pickOptions`. Schema annotations rebuild
 * the schema, so those helpers need to be copied back onto the annotated value.
 *
 * **Example** (Reattach statics after pipe)
 *
 * ```ts import.meta.vitest name="Reattach statics after pipe"
 * import { LiteralKit } from "@beep/schema/LiteralKit"
 * import { withLiteralKitStatics } from "@beep/schema/SchemaUtils/withLiteralKitStatics"
 *
 * const StatusBase = LiteralKit(["draft", "published"])
 * const Status = StatusBase.pipe(withLiteralKitStatics(StatusBase))
 *
 * console.log(Status.Options.includes("published"))
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
      Options: literalKit.Options,
      HashSet: literalKit.HashSet,
      is: literalKit.is,
      Enum: literalKit.Enum,
      pickOptions: literalKit.pickOptions,
      omitOptions: literalKit.omitOptions,
      $match: literalKit.$match,
      thunk: literalKit.thunk,
      toTaggedUnion: literalKit.toTaggedUnion,
    })
  );
