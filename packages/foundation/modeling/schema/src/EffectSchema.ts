/**
 * Schema helpers for validating Effect runtime values.
 *
 * This module delegates runtime detection to `Effect.isEffect`, which is the
 * canonical guard provided by the Effect library.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity/packages";
import { Effect } from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("EffectSchema");
const effectAnnotations = {
  typeConstructor: {
    _tag: "@beep/schema/EffectSchema",
  },
  generation: {
    runtime: "EffectSchema",
    Type: "EffectSchema",
    importDeclaration: 'import { EffectSchema } from "@beep/schema/EffectSchema"',
  },
  expected: "Effect",
  description: "Schema for Effect runtime values.",
  toEquivalence:
    () =>
    <A extends Effect.Effect<unknown, unknown, unknown>>(self: A, that: A): boolean =>
      self === that,
  toFormatter: () => (): string => "[Effect]",
};

/**
 * Type guard that checks whether a value is an Effect runtime value.
 *
 * **Details**
 *
 * This reuses {@link Effect.isEffect}, the canonical Effect guard, so schema
 * validation stays aligned with the library's own effect detection semantics.
 *
 * **Example** (Check Effect runtime values)
 *
 * ```ts
 * import { Effect } from "effect"
 * import { isEffect } from "@beep/schema/EffectSchema"
 *
 * const program = Effect.succeed(1)
 *
 * console.log(isEffect(program)) // true
 * console.log(isEffect("hello")) // false
 * ```
 *
 * @param u - The value to test.
 * @returns Whether the value is an Effect runtime value.
 * @effects
 * Inspects the runtime value only; it does not execute the supplied Effect.
 * @category validation
 * @since 0.0.0
 */
export const isEffect = Effect.isEffect;
type SchemaStatics<Schema extends S.Top> = Omit<Schema, keyof Schema["Rebuild"] | keyof S.Top>;
type AnnotatedSchema<Schema extends S.Top> = Schema["Rebuild"] & SchemaStatics<Schema>;

/**
 * Declared schema for Effect runtime values.
 *
 * **Example** (Decode Effect runtime values)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { EffectSchema } from "@beep/schema/EffectSchema"
 *
 * const program = Effect.succeed("done")
 * const decoded = S.decodeUnknownSync(EffectSchema())(program)
 *
 * console.log(Effect.isEffect(decoded)) // true
 * ```
 *
 * @effects
 * Validates Effect runtime values without executing them.
 * @category validation
 * @since 0.0.0
 */
export const EffectSchema = <Success, Failure, Dependencies>(): AnnotatedSchema<
  S.declare<Effect.Effect<Success, Failure, Dependencies>, Effect.Effect<Success, Failure, Dependencies>>
> =>
  S.declare<Effect.Effect<Success, Failure, Dependencies>>(isEffect, effectAnnotations).pipe(
    $I.annoteSchema("EffectSchema", {
      description: "A schema that validates Effect runtime values.",
    })
  );

/**
 * {@inheritDoc EffectSchema}
 * @category models
 * @since 0.0.0
 */
export type EffectSchema<Success, Failure, Dependencies> = S.Schema.Type<
  ReturnType<typeof EffectSchema<Success, Failure, Dependencies>>
>;
