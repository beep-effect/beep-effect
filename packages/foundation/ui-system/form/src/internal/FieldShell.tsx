/**
 * Shared field layout: label, control, description, and errors.
 *
 * Internal to `@beep/form` (not part of the public export map). Standard
 * top-labelled fields (text, number, select, slider, …) render through this;
 * inline controls (checkbox, switch) compose their own layout.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@beep/ui/components/field";
import * as A from "effect/Array";
import type React from "react";
import type { FieldErrorEntry } from "../core/Errors.ts";

/**
 * Props for {@link FieldShell}.
 *
 * **Example** (Satisfying FieldShellProps object)
 *
 * ```tsx
 * import type { FieldShellProps } from "../../src/internal/FieldShell.tsx"
 *
 * const props = {
 *   children: <input id="name" name="name" />,
 *   errors: [{ message: "Required" }],
 *   htmlFor: "name",
 *   label: "Name",
 * } satisfies FieldShellProps
 *
 * console.log(props.errors[0]?.message) // "Required"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface FieldShellProps {
  readonly children: React.ReactNode;
  readonly description?: React.ReactNode | undefined;
  readonly errors: ReadonlyArray<FieldErrorEntry>;
  readonly htmlFor: string;
  readonly label?: React.ReactNode | undefined;
  readonly orientation?: "vertical" | "horizontal" | "responsive" | undefined;
}

/**
 * Renders the shared field chrome around a bound control.
 *
 * **Example** (FieldShell wrapping an input)
 *
 * ```tsx
 * import { FieldShell } from "../../src/internal/FieldShell.tsx"
 *
 * export const NameFieldShell = (
 *   <FieldShell htmlFor="name" label="Name" errors={[{ message: "Required" }]}>
 *     <input id="name" name="name" />
 *   </FieldShell>
 * )
 *
 * console.log(NameFieldShell.props.errors.length) // 1
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const FieldShell: React.FC<FieldShellProps> = ({
  htmlFor,
  label,
  description,
  errors,
  orientation,
  children,
}) => (
  <Field orientation={orientation} data-invalid={A.isReadonlyArrayNonEmpty(errors) || undefined}>
    {label !== undefined ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : null}
    {children}
    {description !== undefined ? <FieldDescription>{description}</FieldDescription> : null}
    <FieldError errors={[...errors]} />
  </Field>
);
