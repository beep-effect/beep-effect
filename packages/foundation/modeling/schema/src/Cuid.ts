/**
 * CUID schema and deterministic seed services.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { Str } from "@beep/utils";
import { DateTimes } from "@beep/utils/DateTime";
import { Context, Crypto, Effect, Layer } from "effect";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";
import type * as PlatformError from "effect/PlatformError";

const $I = $SchemaId.create("Cuid");

/**
 * Produces a SHA-512 digest for the provided byte array.
 *
 * @example
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import { sha512 } from "@beep/schema/Cuid"
 *
 * const digest = await Effect.runPromise(
 *   sha512(new TextEncoder().encode("beep")).pipe(Effect.provide(BunCrypto.layer))
 * )
 * console.log(digest.byteLength) // 64
 * ```
 *
 * @effects
 * Reads the `Crypto` service to compute a digest; it performs no writes.
 *
 * @category utilities
 * @since 0.0.0
 */
export const sha512 = (data: Uint8Array): Effect.Effect<Uint8Array, PlatformError.PlatformError, Crypto.Crypto> =>
  Effect.flatMap(Crypto.Crypto, (crypto) => crypto.digest("SHA-512", data));

// Constants
const DEFAULT_LENGTH = 24;
const BIG_LENGTH = 32;
const INITIAL_COUNT_MAX = 476782367;

// Schema
/**
 * Branded schema for canonical CUID strings.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cuid } from "@beep/schema/Cuid"
 *
 * const id = S.decodeUnknownSync(Cuid)("a123")
 * console.log(id)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const Cuid = S.String.pipe(
  S.check(S.isPattern(/^[a-z][0-9a-z]+$/)),
  S.brand("@typed/id/CUID"),
  $I.annoteSchema("Cuid", {
    description: "Canonical CUID string beginning with a lowercase letter followed by lowercase base36 text.",
    toArbitrary: () => (fc) => fc.stringMatching(/^[a-z][0-9a-z]+$/).map((value) => value as Cuid),
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link Cuid}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import type { Cuid } from "@beep/schema/Cuid"
 * import { Cuid as CuidSchema } from "@beep/schema/Cuid"
 *
 * const id: Cuid = S.decodeUnknownSync(CuidSchema)("a123")
 * console.log(id)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type Cuid = typeof Cuid.Type;

/**
 * Type guard for {@link Cuid}.
 *
 * @example
 * ```ts
 * import { isCuid } from "@beep/schema/Cuid"
 *
 * console.log(isCuid("a123"))
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isCuid: (value: string) => value is Cuid = Cuid.is;

// Types
/**
 * Seed data used to produce a deterministic CUID value.
 *
 * @example
 * ```ts
 * import { CuidSeed } from "@beep/schema/Cuid"
 *
 * const seed = CuidSeed.make({ timestamp: 1, counter: 0, random: new Uint8Array([1]), fingerprint: "node" })
 * console.log(seed.counter)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CuidSeed extends S.Class<CuidSeed>($I`CuidSeed`)(
  {
    timestamp: S.Finite,
    counter: S.Int.check(S.isGreaterThanOrEqualTo(0)),
    random: S.Uint8Array,
    fingerprint: S.String,
  },
  $I.annote("CuidSeed", {
    description: "Seed data used to produce a deterministic CUID value.",
  })
) {}

/**
 * Service that produces deterministic CUID seeds.
 *
 * @example
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import { CuidState } from "@beep/schema/Cuid"
 *
 * const seed = await Effect.runPromise(
 *   CuidState.next.pipe(Effect.provide(CuidState.Default), Effect.provide(BunCrypto.layer))
 * )
 * console.log(seed.fingerprint.length)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export class CuidState extends Context.Service<CuidState>()("@beep/schema/Cuid/CuidState", {
  make: Effect.fn("CuidState.make")(function* (envData: string) {
    const { now } = yield* DateTimes;
    const crypto = yield* Crypto.Crypto;
    const initialBytes = yield* crypto.randomBytes(4);
    const initialValue =
      Math.abs((initialBytes[0] << 24) | (initialBytes[1] << 16) | (initialBytes[2] << 8) | initialBytes[3]) %
      INITIAL_COUNT_MAX;

    // Create fingerprint from environment data
    const envHash = yield* hash(envData);
    const fingerprint = Str.substring(0, BIG_LENGTH)(envHash);

    let counter = initialValue;

    const nextSeed = Effect.gen(function* () {
      const timestamp = yield* now;
      const random = yield* crypto.randomBytes(32);
      return CuidSeed.make({
        timestamp,
        counter: counter++,
        random,
        fingerprint,
      });
    });

    return yield* Effect.succeed(nextSeed);
  }),
}) {
  static readonly next = Effect.suspend(() => CuidState.use((nextSeed) => nextSeed));

  static readonly Default = Layer.effect(CuidState, CuidState.make("node")).pipe(Layer.provideMerge(DateTimes.Default));
}

/**
 * Effect that generates a branded {@link Cuid}.
 *
 * @example
 * ```ts
 * import * as BunCrypto from "@effect/platform-bun/BunCrypto"
 * import { Effect } from "effect"
 * import { cuid, CuidState } from "@beep/schema/Cuid"
 *
 * const id = await Effect.runPromise(
 *   cuid.pipe(Effect.provide(CuidState.Default), Effect.provide(BunCrypto.layer))
 * )
 * console.log(id.length)
 * ```
 *
 * @effects Requires {@link CuidState} and `effect/Crypto`; `CuidState.Default`
 * provides the clock-backed seed state while callers provide platform crypto.
 *
 * @category constructors
 * @since 0.0.0
 */
export const cuid: Effect.Effect<Cuid, PlatformError.PlatformError, CuidState | Crypto.Crypto> = Effect.flatMap(
  CuidState.next,
  cuidFromSeed
);

// Utilities
const ALPHABET_LENGTH = 26;
const ALPHABET_START_CODE = 97;
const encoder = new TextEncoder();

function createEntropy(length: number, random: Uint8Array): string {
  let entropy = "";
  let offset = 0;

  while (entropy.length < length) {
    const value = random[offset];
    entropy += Math.floor(value % 36).toString(36);
    offset = (offset + 1) % random.length;
  }

  return entropy;
}

function hash(input: string): Effect.Effect<string, PlatformError.PlatformError, Crypto.Crypto> {
  return Effect.map(sha512(encoder.encode(input)), (buffer) => {
    const view = new Uint8Array(buffer);
    let value = BigInt(0);
    for (const byte of view) {
      value = (value << BigInt(8)) + BigInt(byte);
    }
    // Drop the first character because it will bias the histogram to the left
    return Str.slice(1)(value.toString(36));
  });
}

function cuidFromSeed(seed: CuidSeed): Effect.Effect<Cuid, PlatformError.PlatformError, Crypto.Crypto> {
  return makeCuidFromSeed(seed);
}

const makeCuidFromSeed = Effect.fn("Schema.Cuid.cuidFromSeed")(function* ({
  counter,
  fingerprint,
  random,
  timestamp,
}: CuidSeed) {
  // First letter is always a random lowercase letter from the seed
  const firstLetter = String.fromCharCode((random[0] % ALPHABET_LENGTH) + ALPHABET_START_CODE);

  // Convert components to base36
  const time = timestamp.toString(36);
  const count = counter.toString(36);

  // Create entropy from remaining random bytes
  const salt = createEntropy(4, random.slice(1));

  // Hash all components together
  const hashInput = `${time}${salt}${count}${fingerprint}`;
  const hashed = yield* hash(hashInput);

  // Construct the final CUID
  const id = `${firstLetter}${Str.substring(0, DEFAULT_LENGTH - 1)(hashed)}`;

  return Cuid.make(id);
});
