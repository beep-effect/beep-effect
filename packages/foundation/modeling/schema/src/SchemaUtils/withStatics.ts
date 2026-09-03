/**
 * Attach helper statics to schema objects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { staticDescriptorInstaller } from "./internal/staticDescriptors.ts";

/**
 * The schema object returned by {@link withStatics}: the original schema with
 * its companion statics attached.
 *
 * Spelled as a named alias (rather than an inline `Schema & Statics`) so the
 * pipeable-signature analysis can relate the data-first and data-last returns.
 */
type WithStatics<Schema extends object, Statics extends Record<string, unknown>> = Schema & Statics;

const attachStatics = <S extends object, M extends Record<string, unknown>>(
  schema: S,
  methods: (schema: S) => M,
  schemaOwnedKeys: ReadonlyArray<string> = []
): WithStatics<S, M> => {
  const originalAnnotate = Reflect.get(schema, "annotate");
  const statics = methods(schema);
  const nextSchemaOwnedKeys = A.dedupe(
    A.appendAll(
      schemaOwnedKeys,
      A.filter(R.keys(statics), (key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(schema, key);
        return descriptor !== undefined && Object.is(Reflect.get(schema, key), Reflect.get(statics, key));
      })
    )
  );
  staticDescriptorInstaller.install(schema, statics, "legacy", undefined, (key) =>
    A.contains(nextSchemaOwnedKeys, key)
  );

  if (P.isFunction(originalAnnotate)) {
    Reflect.defineProperty(schema, "annotate", {
      value(annotation: unknown) {
        return attachStatics(originalAnnotate.call(schema, annotation), methods, nextSchemaOwnedKeys);
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
 * Existing configurable properties may be replaced, identical statics already
 * owned by the schema remain schema-owned across rebuilds, and conflicting
 * non-configurable properties raise an internal tagged error. Use this for
 * schema companion helpers that should travel with the schema value instead of
 * living as separate module-level functions.
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
  <S extends object, M extends Record<string, unknown>>(methods: (schema: S) => M): (schema: S) => WithStatics<S, M>;
  <S extends object, M extends Record<string, unknown>>(schema: S, methods: (schema: S) => M): WithStatics<S, M>;
} = dual(2, attachStatics);
