/**
 * Unknown-value schema with schema-bound decode and encode runners.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("Unknown");

/**
 * Accepts any value while exposing every supported schema codec runner as a
 * static method.
 *
 * **When to use**
 *
 * Use when an intentionally untyped boundary still needs consistent Effect,
 * Promise, Sync, Exit, Result, Option, or JSON-string codec entry points.
 *
 * **Details**
 *
 * Direct codecs preserve the unknown value. Methods ending in
 * `FromJsonString` parse or serialize JSON and accept per-call JSON and schema
 * parse options.
 *
 * **Gotchas**
 *
 * This schema does not validate the shape of a value. Prefer a more specific
 * schema as soon as the boundary contract is known, and prefer Effect-returning
 * codecs over throwing Sync codecs in library code.
 *
 * **Example** (Encode unknown data as formatted JSON)
 *
 * ```ts import.meta.vitest name="Encode unknown data as formatted JSON"
 * import { Unknown } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const input = { name: "Ada", active: true }
 * const encoded = await Effect.runPromise(
 *   Unknown.encodeUnknownEffectFromJsonString(input, { space: 2 })
 * )
 *
 * console.log(encoded)
 * ```
 *
 * @see {@link S.Unknown} for the underlying top schema.
 * @see {@link SchemaUtils.withEffectCodecStatics} for the preferred Effect codec group.
 * @category schemas
 * @since 0.0.0
 */
export const Unknown = S.Unknown.pipe(
  SchemaUtils.withEffectCodecStatics,
  SchemaUtils.withPromiseCodecStatics,
  SchemaUtils.withSyncCodecStatics,
  SchemaUtils.withExitCodecStatics,
  SchemaUtils.withResultCodecStatics,
  SchemaUtils.withOptionCodecStatics,
  $I.annoteSchema("Unknown", {
    description:
      "An unknown-value schema with Effect, Promise, Sync, Exit, Result, Option, and JSON-string codec statics.",
  })
);

/**
 * Decoded value accepted and returned by {@link Unknown}.
 *
 * @see {@link Unknown} for the runtime schema and its schema-bound codec runners.
 * @category type-level
 * @since 0.0.0
 */
export type Unknown = typeof Unknown.Type;
