/**
 * Attach helper statics to schema objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import { staticDescriptorInstaller } from "./internal/staticDescriptors.ts";

/**
 * The schema object returned by {@link withStatics}: the original schema with
 * its companion statics attached.
 *
 * Spelled as a named alias (rather than an inline `Schema & Statics`) so the
 * pipeable-signature analysis can relate the data-first and data-last returns.
 */
type WithStatics<Schema extends object, Statics extends Record<string, unknown>> = Schema & Statics;

/**
 * The data-last application step produced by {@link withStatics}.
 */
type WithStaticsTransform<Schema extends object, Statics extends Record<string, unknown>> = (
  schema: Schema
) => WithStatics<Schema, Statics>;

const attachStatics = <S extends object, M extends Record<string, unknown>>(
  schema: S,
  methods: (schema: S) => M
): WithStatics<S, M> => {
  const originalAnnotate = Reflect.get(schema, "annotate");
  const statics = methods(schema);
  staticDescriptorInstaller.install(schema, statics);

  if (P.isFunction(originalAnnotate)) {
    Reflect.defineProperty(schema, "annotate", {
      value(annotation: unknown) {
        return attachStatics(originalAnnotate.call(schema, annotation), methods);
      },
      enumerable: false,
      writable: false,
      configurable: true,
    });
  }

  return schema as S & M;
};

/**
 * Attach static methods to a schema object while preserving them across later
 * `annotate` calls.
 *
 * **Gotchas**
 *
 * Existing configurable properties may be replaced, identical statics are
 * ignored, and conflicting non-configurable properties raise an internal
 * tagged error. Use this for schema companion helpers that should travel with
 * the schema value instead of living as separate module-level functions.
 *
 * **Example** (Attach companion empty static)
 *
 * ```ts import.meta.vitest name="Attach companion empty static"
 * import { $SchemaId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 * import { withStatics } from "@beep/schema/SchemaUtils/withStatics"
 *
 * const $I = $SchemaId.create("Docs")
 * const MySchema = S.String.pipe(
 *   withStatics(() => ({
 *     empty: ""
 *   })),
 *   $I.annoteSchema("MySchema", {
 *     description: "A string schema with companion statics."
 *   })
 * )
 *
 * MySchema.empty // => ""
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const withStatics: {
  <S extends object, M extends Record<string, unknown>>(methods: (schema: S) => M): WithStaticsTransform<S, M>;
  <S extends object, M extends Record<string, unknown>>(schema: S, methods: (schema: S) => M): WithStatics<S, M>;
} = dual(2, attachStatics);
