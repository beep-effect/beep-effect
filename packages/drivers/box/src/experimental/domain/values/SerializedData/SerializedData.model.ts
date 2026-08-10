/**
 * Recursive serialized-data value schemas for Box payload fragments.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $BoxId.create("experimental/domain/values/SerializedData/SerializedData.model");

/**
 * Type-level namespace for {@link SerializedData} recursive encoded values.
 *
 * **Example** (Encoded nested map payload)
 *
 * ```ts
 * import type { SerializedData } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 *
 * const encoded: SerializedData.Encoded = {
 *   file: ["report.pdf", 1024, true, null]
 * }
 *
 * console.log(JSON.stringify(encoded))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SerializedData {
  /**
   * Encoded recursive payload accepted by {@link SerializedData}.
   *
   * **Example** (Encoded array payload)
   *
   * ```ts
   * import type { SerializedData } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
   *
   * const encoded: SerializedData.Encoded = ["report.pdf", 1024, true, null]
   *
   * console.log(Array.isArray(encoded))
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded =
    | undefined
    | null
    | boolean
    | number
    | string
    | SerializedDataList.Encoded
    | SerializedDataMap.Encoded;
}

/**
 * Recursive value schema for serializable Box payload fragments: primitives, lists, and string-keyed maps.
 *
 * **Example** (Decode and encode map)
 *
 * ```ts
 * import { SerializedData } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(SerializedData)({ name: "report.pdf", size: 1024 })
 * const encoded: SerializedData.Encoded = S.encodeSync(SerializedData)(decoded)
 *
 * console.log(JSON.stringify(encoded))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SerializedData = S.Union([
  S.Undefined,
  S.Null,
  S.Boolean,
  S.Finite,
  S.String,
  S.suspend((): S.Codec<SerializedDataList.Encoded> => SerializedDataList),
  S.suspend((): S.Codec<SerializedDataMap.Encoded> => SerializedDataMap),
]).pipe(
  $I.annoteSchema("SerializedData", {
    description:
      "Recursive value schema for serializable Box payload fragments: primitives, lists, and string-keyed maps.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link SerializedData}.
 *
 * **Example** (Decoded array runtime type)
 *
 * ```ts
 * import { SerializedData } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded: SerializedData = S.decodeUnknownSync(SerializedData)(["file.txt", 42, false])
 *
 * console.log(JSON.stringify(decoded))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SerializedData = typeof SerializedData.Type;

/**
 * Type-level namespace for {@link SerializedDataList} recursive encoded arrays.
 *
 * **Example** (Encoded list type usage)
 *
 * ```ts
 * import type { SerializedDataList } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 *
 * const encoded: SerializedDataList.Encoded = ["file.txt", 42, false]
 * console.log(encoded.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SerializedDataList {
  /**
   * Encoded readonly array accepted by {@link SerializedDataList}.
   *
   * **Example** (Encoded readonly array)
   *
   * ```ts
   * import type { SerializedDataList } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
   *
   * const encoded: SerializedDataList.Encoded = ["file.txt", 42, false]
   *
   * console.log(encoded.length)
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = readonly SerializedData.Encoded[];
}

/**
 * Value schema for arrays of serializable Box payload fragments.
 *
 * **Example** (Decode and encode list)
 *
 * ```ts
 * import { SerializedDataList } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(SerializedDataList)(["file.txt", 42, true])
 * const encoded: SerializedDataList.Encoded = S.encodeSync(SerializedDataList)(decoded)
 *
 * console.log(encoded.length)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SerializedDataList = S.Array(S.suspend((): S.Codec<SerializedData.Encoded> => SerializedData)).pipe(
  $I.annoteSchema("SerializedDataList", {
    description: "Value schema for arrays of serializable Box payload fragments.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link SerializedDataList}.
 *
 * **Example** (Decoded list runtime type)
 *
 * ```ts
 * import { SerializedDataList } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded: SerializedDataList = S.decodeUnknownSync(SerializedDataList)(["file.txt", 42, true])
 *
 * console.log(decoded.length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SerializedDataList = typeof SerializedDataList.Type;

/**
 * Type-level namespace for {@link SerializedDataMap} recursive encoded records.
 *
 * **Example** (Encoded map type usage)
 *
 * ```ts
 * import type { SerializedDataMap } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 *
 * const encoded: SerializedDataMap.Encoded = { name: "report.pdf", size: 1024 }
 *
 * console.log(JSON.stringify(encoded))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SerializedDataMap {
  /**
   * Encoded string-keyed record accepted by {@link SerializedDataMap}.
   *
   * **Example** (Encoded record keys count)
   *
   * ```ts
   * import type { SerializedDataMap } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
   *
   * const encoded: SerializedDataMap.Encoded = { name: "report.pdf", size: 1024 }
   *
   * console.log(Object.keys(encoded).length)
   * ```
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = {
    readonly [key: string]: SerializedData.Encoded;
  };
}

/**
 * Value schema for string-keyed maps of serializable Box payload fragments.
 *
 * **Example** (Decode and encode map)
 *
 * ```ts
 * import { SerializedDataMap } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownSync(SerializedDataMap)({ name: "report.pdf", size: 1024 })
 * const encoded: SerializedDataMap.Encoded = S.encodeSync(SerializedDataMap)(decoded)
 *
 * console.log(JSON.stringify(encoded))
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const SerializedDataMap = S.Record(
  S.String,
  S.suspend((): S.Codec<SerializedData.Encoded> => SerializedData)
).pipe(
  $I.annoteSchema("SerializedDataMap", {
    description: "Value schema for string-keyed maps of serializable Box payload fragments.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime value type decoded by {@link SerializedDataMap}.
 *
 * **Example** (Decoded map runtime type)
 *
 * ```ts
 * import { SerializedDataMap } from "@beep/box/experimental/domain/values/SerializedData/SerializedData.model"
 * import * as S from "effect/Schema"
 *
 * const decoded: SerializedDataMap = S.decodeUnknownSync(SerializedDataMap)({
 *   name: "report.pdf",
 *   size: 1024
 * })
 *
 * console.log(Object.keys(decoded).length)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type SerializedDataMap = typeof SerializedDataMap.Type;
