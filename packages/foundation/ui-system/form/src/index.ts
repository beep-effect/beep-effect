/**
 * `@beep/form` — a schema-first, effect-first form substrate built on
 * `@tanstack/react-form` and bound to `@beep/ui` primitives.
 *
 * **Details**
 *
 * The schema is the single source of both validation and default values.
 * TanStack owns all form/field/validation/submission state; non-form field
 * state uses scoped atoms. Field components are consumed through the
 * {@link useAppForm} factory (`<form.AppField>{(field) => <field.Text/>}`);
 * import individual field components from the `@beep/form/fields/*` subpath when
 * needed directly.
 *
 * **Example** (Import form option helpers)
 *
 * ```ts
 * import { makeFormOptions, toFormSchema } from "@beep/form"
 *
 * console.log(typeof makeFormOptions, typeof toFormSchema)
 * ```
 *
 * @packageDocumentation \@beep/form
 * @since 0.0.0
 */

/**
 * Native `<form>` wrapper that stops default submission and delegates.
 *
 * **Example** (Import Form component)
 *
 * ```ts
 * import { Form } from "@beep/form"
 *
 * console.log(typeof Form)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export * from "./components/Form.tsx";
/**
 * Submit button bound to the active form's submission state.
 *
 * **Example** (Import SubmitButton component)
 *
 * ```ts
 * import { SubmitButton } from "@beep/form"
 *
 * console.log(typeof SubmitButton)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export * from "./components/SubmitButton.tsx";
/**
 * Shared TanStack field/form contexts.
 *
 * **Example** (Import useFieldContext utility)
 *
 * ```ts
 * import { useFieldContext } from "@beep/form"
 *
 * console.log(typeof useFieldContext)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "./core/contexts.ts";
/**
 * Schema-first default form values via `schema.make({})`.
 *
 * **Example** (Import getDefaultFormValues)
 *
 * ```ts
 * import { getDefaultFormValues } from "@beep/form"
 *
 * console.log(typeof getDefaultFormValues)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./core/Defaults.ts";
/**
 * Mapping TanStack field errors into the `@beep/ui` `FieldError` shape.
 *
 * **Example** (Import toFieldErrors mapper)
 *
 * ```ts
 * import { toFieldErrors } from "@beep/form"
 *
 * console.log(typeof toFieldErrors)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./core/Errors.ts";
/**
 * Schema-first `formOptions` builders for `@tanstack/react-form`.
 *
 * **Example** (Import makeFormOptions builder)
 *
 * ```ts
 * import { makeFormOptions } from "@beep/form"
 *
 * console.log(typeof makeFormOptions)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./core/FormOptions.ts";
/**
 * The validation seam between effect `Schema` and `@tanstack/react-form`.
 *
 * **Example** (Import toFormSchema converter)
 *
 * ```ts
 * import { toFormSchema } from "@beep/form"
 *
 * console.log(typeof toFormSchema)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export * from "./core/FormSchema.ts";
/**
 * The option model shared by selection fields.
 *
 * **Example** (Create a FieldOption)
 *
 * ```ts
 * import type { FieldOption } from "@beep/form"
 *
 * const option: FieldOption = { value: "a", label: "Alpha" }
 * console.log(option.value)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export * from "./core/Options.ts";
/**
 * Field path formatting, reading, writing, and dirty-path predicates.
 *
 * **Example** (Convert schema path to field path)
 *
 * ```ts
 * import { Path } from "@beep/form"
 *
 * console.log(Path.schemaPathToFieldPath(["items", 0, "name"])) // "items[0].name"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export * as Path from "./core/Path.ts";
/**
 * The centralized `useAppForm` factory plus `withForm` / `withFieldGroup`.
 *
 * **Example** (Import useAppForm factory)
 *
 * ```ts
 * import { useAppForm } from "@beep/form"
 *
 * console.log(typeof useAppForm)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export * from "./hooks/useAppForm.tsx";
