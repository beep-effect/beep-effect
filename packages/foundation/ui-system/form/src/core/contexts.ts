/**
 * Shared `@tanstack/react-form` field/form contexts.
 *
 * These are created once and shared between the field components (which read
 * {@link useFieldContext}) and the {@link useAppForm} factory (which receives
 * {@link fieldContext} / {@link formContext}). Keeping them in their own module
 * breaks the field/factory import cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { createFormHookContexts } from "@tanstack/react-form";

const contexts = createFormHookContexts();

/**
 * React context carrying the active field API to a registered field component.
 *
 * **Example** (Wire contexts into form hook)
 *
 * ```ts
 * import { createFormHook } from "@tanstack/react-form"
 * import { fieldContext } from "@beep/form/core/contexts"
 * import { formContext } from "@beep/form/core/contexts"
 *
 * const hook = createFormHook({
 *   fieldContext,
 *   formContext,
 *   fieldComponents: {},
 *   formComponents: {},
 * })
 *
 * console.log(typeof hook.useAppForm) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const fieldContext = contexts.fieldContext;

/**
 * Hook returning the active field API inside a registered field component.
 *
 * **Example** (Read active field name)
 *
 * ```tsx
 * import { useFieldContext } from "@beep/form/core/contexts"
 *
 * export function FieldNameLabel() {
 *   const field = useFieldContext<string>()
 *
 *   return <span>{field.name}</span>
 * }
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useFieldContext = contexts.useFieldContext;

/**
 * React context carrying the active form API to a registered form component.
 *
 * **Example** (Pass formContext to createFormHook)
 *
 * ```ts
 * import { createFormHook } from "@tanstack/react-form"
 * import { fieldContext } from "@beep/form/core/contexts"
 * import { formContext } from "@beep/form/core/contexts"
 *
 * const hook = createFormHook({
 *   fieldContext,
 *   formContext,
 *   fieldComponents: {},
 *   formComponents: {},
 * })
 *
 * console.log(typeof hook.withForm) // "function"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const formContext = contexts.formContext;

/**
 * Hook returning the active form API inside a registered form component.
 *
 * **Example** (Subscribe to isSubmitting state)
 *
 * ```tsx
 * import { useFormContext } from "@beep/form/core/contexts"
 *
 * export function SubmitStateLabel() {
 *   const form = useFormContext()
 *
 *   return (
 *     <form.Subscribe selector={(state) => state.isSubmitting}>
 *       {(isSubmitting) => <span>{isSubmitting ? "Saving" : "Ready"}</span>}
 *     </form.Subscribe>
 *   )
 * }
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useFormContext = contexts.useFormContext;
