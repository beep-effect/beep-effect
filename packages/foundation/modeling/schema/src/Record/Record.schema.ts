/**
 * Shared string-keyed record schema exports.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";
import * as SchemaUtils from "../SchemaUtils/index.ts";

const $I = $SchemaId.create("Record");

/**
 * Schema for object records with string keys and unknown values.
 *
 * **Example** (Decoding an object record)
 *
 * ```ts
 * import { UnknownRecord } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownSync(UnknownRecord)
 *
 * const value = decode({ enabled: true, count: 1 })
 * console.log(value)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const UnknownRecord = S.Record(S.String, S.Unknown).pipe(
  $I.annoteSchema("UnknownRecord", {
    description: "A record of unknown values",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownOption"])
);

/**
 * Runtime type extracted from the {@link UnknownRecord} schema.
 *
 * **Example** (Typing an object record)
 *
 * ```ts
 * import type { UnknownRecord } from "@beep/schema"
 *
 * const value: UnknownRecord = { enabled: true, count: 1 }
 * console.log(value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UnknownRecord = typeof UnknownRecord.Type;
