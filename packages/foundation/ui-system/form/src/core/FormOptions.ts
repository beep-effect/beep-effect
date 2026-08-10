/**
 * Schema-first `formOptions` builders for `@tanstack/react-form`.
 *
 * Every builder turns an effect schema into TanStack `formOptions`: the schema
 * is the single source of validation (via {@link toFormSchema}) and, optionally,
 * of default values (via {@link getDefaultFormValues}). TanStack owns all form
 * state; these helpers only assemble its options.
 *
 * Validation slot routing honours the effect-to-Standard Schema boundary: a schema
 * that decodes **synchronously** uses the sync slot (`onChange`/`onBlur`/
 * `onSubmit`), while an **async-capable** schema must use the async slot
 * (`*Async`) because effect's `validate` returns a `Promise` that the sync slot
 * rejects. Pass `async: true` for async-capable schemas.
 *
 * Default values live on TanStack's form-state side, so they are always the
 * schema's encoded input shape (`I`). Submit helpers decode those encoded
 * values before invoking callbacks that ask for the schema `Type` (`A`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $FormId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { formOptions } from "@tanstack/react-form";
import * as S from "effect/Schema";
import { getEncodedDefaultFormValues } from "./Defaults.ts";
import { toFormSchema } from "./FormSchema.ts";
import type { ToFormSchemaOptions } from "./FormSchema.ts";

const $I = $FormId.create("core/FormOptions");

/**
 * Validation events supported by TanStack validator routing.
 *
 * **Example** (Checking blur membership)
 *
 * ```ts
 * import { ValidateOn } from "@beep/form/core/FormOptions"
 *
 * console.log(ValidateOn.is.blur("blur")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ValidateOn = LiteralKit(["change", "blur", "submit"]).pipe(
  $I.annoteSchema("ValidateOn", {
    description: "Validation events supported by TanStack form validator routing.",
  })
);

/**
 * Which validation event the schema runs on.
 *
 * **Example** (Typing ValidateOn as blur)
 *
 * ```ts
 * import type { ValidateOn } from "@beep/form/core/FormOptions"
 *
 * const validateOn: ValidateOn = "blur"
 * console.log(validateOn) // "blur"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ValidateOn = typeof ValidateOn.Type;

interface BaseParams<A, I> {
  /** Route to the async validator slot for async-capable schemas; defaults to `false`. */
  readonly async?: boolean;
  /** End-user message + parse options forwarded to the Standard Schema. */
  readonly messages?: ToFormSchemaOptions;
  /** The effect schema validating (and typing) the form. */
  readonly schema: S.Codec<A, I>;
  /** Validation event; defaults to `"submit"`. */
  readonly validateOn?: ValidateOn;
}

const buildValidators = <A, I>(
  standard: ReturnType<typeof toFormSchema<A, I>>,
  validateOn: ValidateOn,
  async: boolean
) =>
  ValidateOn.$match(validateOn, {
    change: () => (async ? { onChangeAsync: standard } : { onChange: standard }),
    blur: () => (async ? { onBlurAsync: standard } : { onBlur: standard }),
    submit: () => (async ? { onSubmitAsync: standard } : { onSubmit: standard }),
  });

/**
 * Base builder: wires a schema's Standard Schema into TanStack `validators` on
 * the chosen slot, with caller-supplied default values.
 *
 * **Gotchas**
 *
 * `defaultValues` must match the schema's encoded input shape. This is visible
 * for transform schemas such as `S.NumberFromString`: the field stores a
 * string while validation and submit decoding produce a number.
 *
 * **Example** (NumberFromString default values)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { makeFormOptions } from "@beep/form/core/FormOptions"
 *
 * const schema = S.Struct({ count: S.NumberFromString })
 * const options = makeFormOptions({
 *   schema,
 *   defaultValues: { count: "1" },
 *   validateOn: "change",
 * })
 *
 * console.log(options.defaultValues.count) // "1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeFormOptions = <A, I>(
  params: BaseParams<A, I> & {
    readonly defaultValues: I;
  }
) =>
  formOptions({
    defaultValues: params.defaultValues,
    validators: buildValidators(
      toFormSchema(params.schema, params.messages),
      params.validateOn ?? "submit",
      params.async ?? false
    ),
  });

/**
 * Like {@link makeFormOptions}, but derives `defaultValues` from a schema's
 * constructor defaults and encodes them back to the field/wire shape when not
 * supplied.
 *
 * **Details**
 *
 * Constructor defaults are decoded `Type` values, while TanStack
 * `defaultValues` are encoded form values. This helper performs that encode
 * step so transform schemas can still use schema-first defaults.
 *
 * **Example** (Schema-derived default values)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { formOptionsWithDefaults } from "@beep/form/core/FormOptions"
 *
 * const schema = S.Struct({
 *   name: S.String.pipe(S.withConstructorDefault(Effect.succeed(""))),
 * })
 * const options = formOptionsWithDefaults({ schema })
 * console.log(options.defaultValues) // { name: "" }
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const formOptionsWithDefaults = <A, I>(
  params: BaseParams<A, I> & {
    readonly defaultValues?: I;
  }
) =>
  makeFormOptions({
    ...params,
    defaultValues: params.defaultValues ?? getEncodedDefaultFormValues(params.schema),
  });

/**
 * Builder whose `onSubmit` receives the decoded **`Type`**: the encoded form
 * values are decoded through the schema (`decodeUnknownPromise`) before the
 * callback runs. Named for what `onSubmit` receives (decoded value) — contrast
 * {@link formOptionsWithSubmitEffect}.
 *
 * **Example** (Decoded Type in onSubmit)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { formOptionsWithSubmit } from "@beep/form/core/FormOptions"
 *
 * const schema = S.Struct({ count: S.NumberFromString })
 * const options = formOptionsWithSubmit({
 *   schema,
 *   defaultValues: { count: "1" },
 *   onSubmit: (value) => {
 *     console.log(value.count + 1) // 2
 *   },
 * })
 *
 * console.log(options.defaultValues.count) // "1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const formOptionsWithSubmit = <A, I>(
  params: BaseParams<A, I> & {
    readonly defaultValues: I;
    readonly onSubmit: (value: A) => void | Promise<void>;
  }
) => {
  const decode = S.decodeUnknownPromise(params.schema);
  return formOptions({
    ...makeFormOptions(params),
    onSubmit: ({ value }: { readonly value: I }) => decode(value).then((decoded) => params.onSubmit(decoded)),
  });
};

/**
 * Builder whose `onSubmit` receives the decode **`Effect`**: the caller runs it
 * in their own runtime (e.g. bridging to an effect atom mutation — the
 * sanctioned TanStack-to-atom boundary). Named for what `onSubmit` receives (an
 * `Effect`) — contrast {@link formOptionsWithSubmit}.
 *
 * **Example** (Effect-based submit handler)
 *
 * ```ts
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { formOptionsWithSubmitEffect } from "@beep/form/core/FormOptions"
 *
 * const schema = S.Struct({ count: S.NumberFromString })
 * const options = formOptionsWithSubmitEffect({
 *   schema,
 *   defaultValues: { count: "1" },
 *   onSubmit: (effect) =>
 *     Effect.runPromise(effect.pipe(Effect.map((value) => value.count + 1))).then((next) => {
 *       console.log(next) // 2
 *     }),
 * })
 *
 * console.log(options.defaultValues.count) // "1"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const formOptionsWithSubmitEffect = <A, I>(
  params: BaseParams<A, I> & {
    readonly defaultValues: I;
    readonly onSubmit: (
      value: ReturnType<ReturnType<typeof S.decodeUnknownEffect<S.Codec<A, I>>>>
    ) => void | Promise<void>;
  }
) => {
  const decode = S.decodeUnknownEffect(params.schema);
  return formOptions({
    ...makeFormOptions(params),
    onSubmit: ({ value }: { readonly value: I }) => params.onSubmit(decode(value)),
  });
};
