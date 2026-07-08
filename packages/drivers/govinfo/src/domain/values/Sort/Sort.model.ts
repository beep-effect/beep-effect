/**
 * The Sort value object module for the `@beep/govinfo` driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $GovinfoId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $GovinfoId.create("domain/values/Sort/Sort.model");

/**
 * Shared GovInfo search sort field.
 *
 * @remarks
 * GovInfo currently documents `score`, `publishdate`, `lastModified`, and
 * `title` as supported search sort fields. This schema keeps the field open so
 * new GovInfo sort fields can be represented without a package release.
 *
 * @example
 * ```ts
 * import { SortBase } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort = S.decodeUnknownSync(SortBase)({
 *   field: "publishdate"
 * });
 *
 * console.log(sort.field);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SortBase extends S.Class<SortBase>($I`SortBase`)(
  {
    field: S.NonEmptyString.annotateKey({
      description: "GovInfo search field used for ordering results.",
    }),
  },
  $I.annote("SortBase", {
    description: "Shared GovInfo search sort field.",
  })
) {}

/**
 * Companion namespace for {@link SortBase} encoded helpers.
 *
 * @example
 * ```ts
 * import { SortBase } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort: SortBase = S.decodeUnknownSync(SortBase)({ field: "publishdate" });
 * console.log(sort.field);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SortBase {
  /**
   * Encoded JSON shape accepted by {@link SortBase}.
   *
   * @example
   * ```ts
   * import { SortBase } from "@beep/govinfo/domain/values/Sort/Sort.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SortBase)({
   *   field: "lastModified"
   * });
   * const encoded: SortBase.Encoded = S.encodeSync(SortBase)(decoded);
   *
   * console.log(encoded.field);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SortBase.Encoded;
}

/**
 * Ascending GovInfo search sort directive.
 *
 * @example
 * ```ts
 * import { SortASC } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort = S.decodeUnknownSync(SortASC)({
 *   field: "title",
 *   sortOrder: "ASC"
 * });
 *
 * console.log(sort.sortOrder);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SortASC extends SortBase.extend<SortASC>($I`SortASC`)(
  {
    sortOrder: S.tag("ASC").annotateKey({
      description: "Ascending GovInfo search sort direction.",
    }),
  },
  $I.annote("SortASC", {
    description: "Ascending GovInfo search sort directive.",
  })
) {}

/**
 * Companion namespace for {@link SortASC} encoded helpers.
 *
 * @example
 * ```ts
 * import { SortASC } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort: SortASC = S.decodeUnknownSync(SortASC)({ field: "title", sortOrder: "ASC" });
 * console.log(sort.sortOrder);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SortASC {
  /**
   * Encoded JSON shape accepted by {@link SortASC}.
   *
   * @example
   * ```ts
   * import { SortASC } from "@beep/govinfo/domain/values/Sort/Sort.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SortASC)({
   *   field: "title",
   *   sortOrder: "ASC"
   * });
   * const encoded: SortASC.Encoded = S.encodeSync(SortASC)(decoded);
   *
   * console.log(encoded.sortOrder);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SortASC.Encoded;
}

/**
 * Descending GovInfo search sort directive.
 *
 * @remarks
 * GovInfo relevance sorting uses `field: "score"` with `sortOrder: "DESC"`;
 * ascending score ordering is not documented as supported by the API.
 *
 * @example
 * ```ts
 * import { SortDESC } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort = S.decodeUnknownSync(SortDESC)({
 *   field: "score",
 *   sortOrder: "DESC"
 * });
 *
 * console.log(sort.field);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export class SortDESC extends SortBase.extend<SortDESC>($I`SortDESC`)(
  {
    sortOrder: S.tag("DESC").annotateKey({
      description: "Descending GovInfo search sort direction.",
    }),
  },
  $I.annote("SortDESC", {
    description: "Descending GovInfo search sort directive.",
  })
) {}

/**
 * Companion namespace for {@link SortDESC} encoded helpers.
 *
 * @example
 * ```ts
 * import { SortDESC } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort: SortDESC = S.decodeUnknownSync(SortDESC)({ field: "score", sortOrder: "DESC" });
 * console.log(sort.field);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SortDESC {
  /**
   * Encoded JSON shape accepted by {@link SortDESC}.
   *
   * @example
   * ```ts
   * import { SortDESC } from "@beep/govinfo/domain/values/Sort/Sort.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(SortDESC)({
   *   field: "score",
   *   sortOrder: "DESC"
   * });
   * const encoded: SortDESC.Encoded = S.encodeSync(SortDESC)(decoded);
   *
   * console.log(encoded.field);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SortDESC.Encoded;
}

/**
 * GovInfo search sort directive tagged by `sortOrder`.
 *
 * @example
 * ```ts
 * import { Sort } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort = S.decodeUnknownSync(Sort)({
 *   field: "lastModified",
 *   sortOrder: "DESC"
 * });
 *
 * console.log(sort.sortOrder);
 * ```
 *
 * @category dtos
 * @since 0.0.0
 */
export const Sort = S.Union([SortASC, SortDESC]).pipe(
  S.toTaggedUnion("sortOrder"),
  $I.annoteSchema("Sort", {
    description: "GovInfo search sort directive tagged by sortOrder.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link Sort}.
 *
 * @example
 * ```ts
 * import { Sort } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort: Sort = S.decodeUnknownSync(Sort)({ field: "lastModified", sortOrder: "DESC" });
 * console.log(sort.sortOrder);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type Sort = typeof Sort.Type;

/**
 * Companion namespace for {@link Sort} encoded helpers.
 *
 * @example
 * ```ts
 * import { Sort } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import type { Sort as SortValue } from "@beep/govinfo/domain/values/Sort/Sort.model";
 * import * as S from "effect/Schema";
 *
 * const sort: SortValue = S.decodeUnknownSync(Sort)({ field: "lastModified", sortOrder: "DESC" });
 * console.log(sort.sortOrder);
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Sort {
  /**
   * Encoded JSON shape accepted by {@link Sort}.
   *
   * @example
   * ```ts
   * import { Sort } from "@beep/govinfo/domain/values/Sort/Sort.model";
   * import * as S from "effect/Schema";
   *
   * const decoded = S.decodeUnknownSync(Sort)({
   *   field: "publishdate",
   *   sortOrder: "DESC"
   * });
   * const encoded: Sort.Encoded = S.encodeSync(Sort)(decoded);
   *
   * console.log(encoded.sortOrder);
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Sort.Encoded;
}
