/**
 * Preserve caller-owned schema statics across Effect annotation rebuilds.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

// This module is initialized by Id.ts before its identity composers exist.
class SchemaStaticPreservationError extends S.TaggedError<
  SchemaStaticPreservationError,
  { readonly brand: unique symbol }
>()(
  "SchemaStaticPreservationError",
  { message: S.String },
  {
    title: "Schema static preservation error",
    description: "A rebuilt schema rejected a custom static property descriptor.",
  }
) {}

/**
 * Rebuilt schema with the original schema's additional static members.
 *
 * @category models
 * @since 0.0.0
 */
export type Preserved<Schema extends S.Top> = Schema["Rebuild"] & Omit<Schema, keyof Schema["Rebuild"] | keyof S.Top>;

const SCHEMA_PROTOCOL_KEYS: ReadonlyArray<PropertyKey> = [
  "~effect/Schema/Schema",
  "annotate",
  "annotateKey",
  "ast",
  "check",
  "make",
  "makeEffect",
  "makeOption",
  "pipe",
  "rebuild",
];

/**
 * Copy additional own property descriptors without replacing rebuilt members.
 *
 * **Details**
 *
 * Reflect preserves symbol keys, accessors and descriptor flags without reading
 * getter values. Effect protocol members remain owned by the rebuilt schema.
 *
 * **Example** (Retain a static through the public annotation API)
 *
 * ```ts import.meta.vitest name="Retain a static through the public annotation API"
 * import { $SchemaId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const source = S.String.annotate({})
 * Reflect.defineProperty(source, "empty", { value: "" })
 * const annotated = source.pipe($SchemaId.annoteSchema("StringWithEmpty"))
 * Reflect.get(annotated, "empty") // => ""
 * ```
 *
 * @throws A tagged invariant defect when the rebuilt schema rejects a custom static descriptor.
 * @category combinators
 * @since 0.0.0
 */
export const preserve: {
  <Annotated extends S.Top, Schema extends S.Top>(
    source: Schema & (Annotated extends Schema["Rebuild"] ? unknown : never),
    annotated: Annotated
  ): Preserved<Schema>;
  <Annotated extends S.Top>(
    annotated: Annotated
  ): <Schema extends S.Top>(
    source: Schema & (Annotated extends Schema["Rebuild"] ? unknown : never)
  ) => Preserved<Schema>;
} = dual(2, <Schema extends S.Top>(source: Schema, annotated: Schema["Rebuild"]): Preserved<Schema> => {
  for (const key of Reflect.ownKeys(source)) {
    if (A.contains(SCHEMA_PROTOCOL_KEYS, key) || Reflect.getOwnPropertyDescriptor(annotated, key) !== undefined) {
      continue;
    }

    const descriptor = Reflect.getOwnPropertyDescriptor(source, key);

    if (descriptor !== undefined && !Reflect.defineProperty(annotated, key, descriptor)) {
      // Synchronous invariant boundary: never return a falsely preserved schema.
      throw SchemaStaticPreservationError.make({
        message: "Cannot preserve a custom static on the rebuilt schema.",
      });
    }
  }

  return annotated as Preserved<Schema>;
});
