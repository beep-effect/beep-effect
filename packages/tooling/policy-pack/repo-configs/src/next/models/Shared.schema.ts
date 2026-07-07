/**
 * Shared schemas for primitive Next.js configuration helper types.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoConfigsId } from "@beep/identity";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { Str } from "@beep/utils";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const $I = $RepoConfigsId.create("next/models/Shared.schema");

const FileSizeScale = LiteralKit(["k", "K", "m", "M", "g", "G", "t", "T", "p", "P"]);
const FileSizeByte = LiteralKit(["b", "B"]);

/**
 * File-size suffix accepted by Next.js size limit strings.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { FileSizeSuffix } from "@beep/repo-configs/next/models/Shared.schema"
 * const program = S.decodeUnknownEffect(FileSizeSuffix)("mb")
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const FileSizeSuffix = S.TemplateLiteral([FileSizeScale, FileSizeByte]).pipe(
  $I.annoteSchema("FileSizeSuffix", {
    description: "File-size suffix accepted by Next.js size limit strings.",
    documentation: "Matches Next.js FileSizeSuffix: one of k/K/m/M/g/G/t/T/p/P followed by b or B.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * File-size suffix accepted by Next.js size limit strings.
 *
 * @example
 * ```ts
 * import type { FileSizeSuffix } from "@beep/repo-configs/next/models/Shared.schema"
 * const suffix = "MB" satisfies FileSizeSuffix
 * console.log(suffix)
 * ```
 * @category models
 * @since 0.0.0
 */
export type FileSizeSuffix = typeof FileSizeSuffix.Type;

const NonNegativeSizeLimitNumber = S.Finite.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeSizeLimitNumber`,
    title: "Non-negative size limit number",
    description: "A numeric Next.js size limit must be zero or greater.",
  })
);
const SizeLimitText = S.TemplateLiteral([S.Finite, FileSizeSuffix]).check(
  S.makeFilter(P.not(Str.startsWith("-")), {
    identifier: $I`NonNegativeSizeLimitText`,
    title: "Non-negative size limit text",
    description: "A suffixed Next.js size limit must not start with a negative sign.",
  })
);

/**
 * Non-negative numeric or suffixed string size limit accepted by Next.js.
 *
 * @example
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { SizeLimit } from "@beep/repo-configs/next/models/Shared.schema"
 * const program = S.decodeUnknownEffect(SizeLimit)("2mb")
 * console.log(Effect.runPromise(program))
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const SizeLimit = S.Union([NonNegativeSizeLimitNumber, SizeLimitText]).pipe(
  $I.annoteSchema("SizeLimit", {
    description: "Non-negative numeric or suffixed string size limit accepted by Next.js.",
    documentation:
      "Matches Next.js SizeLimit shape while rejecting negative values that are not meaningful size limits.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Non-negative numeric or suffixed string size limit accepted by Next.js.
 *
 * @example
 * ```ts
 * import type { SizeLimit } from "@beep/repo-configs/next/models/Shared.schema"
 * const limit = "2mb" satisfies SizeLimit
 * console.log(limit)
 * ```
 * @category models
 * @since 0.0.0
 */
export type SizeLimit = typeof SizeLimit.Type;
