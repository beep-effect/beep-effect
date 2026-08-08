/**
 * The validation seam between effect `Schema` and `@tanstack/react-form`.
 *
 * `@beep/form` validates entirely through effect schemas: a schema is turned
 * into a Standard Schema via {@link toFormSchema} and handed to TanStack's
 * `validators`, which auto-detects it (via the `~standard` property) with no
 * adapter. This module centralizes that conversion plus the end-user message
 * hooks so call sites never reach for `Schema.toStandardSchemaV1` directly.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { dual } from "effect/Function";
import * as S from "effect/Schema";

/**
 * Options forwarded to `Schema.toStandardSchemaV1` — `leafHook` / `checkHook`
 * for end-user copy and `parseOptions` for decode behavior. Derived from the
 * underlying effect API so it stays in sync across upgrades.
 *
 * @example
 * ```ts
 * import type { ToFormSchemaOptions } from "@beep/form/core/FormSchema"
 *
 * const options = {
 *   parseOptions: { errors: "all" },
 * } satisfies ToFormSchemaOptions
 *
 * console.log(options.parseOptions.errors) // "all"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ToFormSchemaOptions = NonNullable<Parameters<typeof S.toStandardSchemaV1>[1]>;

/**
 * The Standard Schema view of an effect `Codec`, carrying both the decoded
 * `Type` and the wire `Encoded` shape.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { toFormSchema } from "@beep/form/core/FormSchema"
 * import type { FormSchema } from "@beep/form/core/FormSchema"
 *
 * const schema = S.Struct({ name: S.String })
 * const standard = toFormSchema(schema) satisfies FormSchema<{ readonly name: string }, { readonly name: string }>
 *
 * console.log(standard["~standard"].vendor) // "effect"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FormSchema<A, I> extends ReturnType<typeof S.toStandardSchemaV1<S.Codec<A, I>>> {}

/**
 * Converts an effect schema into the Standard Schema that TanStack validators
 * consume. Pass `leafHook`/`checkHook` to surface end-user copy instead of the
 * developer-oriented `Expected X, got Y` defaults.
 *
 * Standard Schema **input is the `Encoded` shape** and **output is the decoded
 * `Type`**; parse options default to `{ errors: "all" }` so a single field can
 * report multiple issues.
 *
 * @example
 * ```ts
 * import { pipe } from "effect"
 * import * as S from "effect/Schema"
 * import { toFormSchema } from "@beep/form/core/FormSchema"
 *
 * const schema = S.Struct({ name: S.String })
 * const standard = toFormSchema(schema)
 * const piped = pipe(schema, toFormSchema({ parseOptions: { errors: "all" } }))
 * console.log(standard["~standard"].vendor, piped["~standard"].vendor) // "effect" "effect"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const toFormSchema: {
  (options?: ToFormSchemaOptions): <A, I>(schema: S.Codec<A, I>) => FormSchema<A, I>;
  <A, I>(schema: S.Codec<A, I>, options?: ToFormSchemaOptions): FormSchema<A, I>;
} = dual(
  (args) => S.isSchema(args[0]),
  <A, I>(schema: S.Codec<A, I>, options?: ToFormSchemaOptions): FormSchema<A, I> =>
    S.toStandardSchemaV1(schema, options)
);
