/**
 * A synchronous, dependency-free 64-bit FNV-1a hash.
 *
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Str from "effect/String";

const OFFSET_BASIS = BigInt("0xcbf29ce484222325");
const PRIME = BigInt("0x100000001b3");
const MASK = BigInt("0xffffffffffffffff");

const encoder = new TextEncoder();

/**
 * Hash a string's UTF-8 bytes with 64-bit FNV-1a and return 16 lowercase hex
 * digits.
 *
 * @since 0.0.0
 */
export const fnv1a64Hex = (text: string): string =>
  pipe(
    A.fromIterable(encoder.encode(text)),
    A.reduce(OFFSET_BASIS, (hash, byte) => ((hash ^ BigInt(byte)) * PRIME) & MASK),
    (hash) => hash.toString(16),
    Str.padStart(16, "0")
  );
