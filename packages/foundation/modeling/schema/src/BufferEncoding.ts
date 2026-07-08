/**
 * A schema module for BufferEncoding string literal's
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { LiteralKit } from "./LiteralKit/index.ts";

const $I = $SchemaId.create("BufferEncoding");

/**
 * Schema for Node.js `BufferEncoding` string literals (`"utf8"`, `"hex"`, `"base64"`, etc.).
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BuffEncoding } from "@beep/schema/BufferEncoding"
 *
 * const encoding = S.decodeUnknownSync(BuffEncoding)("utf8")
 * console.log(encoding) // "utf8"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const BuffEncoding = LiteralKit([
  "ascii",
  "utf8",
  "utf-8",
  "utf16le",
  "utf-16le",
  "ucs2",
  "ucs-2",
  "base64",
  "base64url",
  "latin1",
  "binary",
  "hex",
]).pipe(
  $I.annoteSchema("BuffEncoding", {
    description: "A BufferEncoding string literal",
  })
);

/**
 * {@inheritDoc BuffEncoding}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BuffEncoding } from "@beep/schema/BufferEncoding"
 *
 * const enc: BuffEncoding = S.decodeUnknownSync(BuffEncoding)("hex")
 * console.log(enc) // "hex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BuffEncoding = typeof BuffEncoding.Type;

/**
 * {@inheritDoc BuffEncoding}
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { BuffEncoding } from "@beep/schema/BufferEncoding"
 *
 * const enc: BufferEncoding = S.decodeUnknownSync(BuffEncoding)("hex")
 * console.log(enc) // "hex"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type BufferEncoding = BuffEncoding;
