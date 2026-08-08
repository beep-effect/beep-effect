/**
 * Internal helpers for binding TanStack field state to `@beep/ui` controls.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { DateTimeUtcFromValid } from "@beep/schema/DateTimeUtcFromValid";
import { Field, FieldError, FieldLabel } from "@beep/ui/components/field";
import { DateTime } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { useFieldContext } from "../core/contexts.ts";
import { toFieldErrors } from "../core/Errors.ts";
import { FieldShell } from "./FieldShell.tsx";
import type React from "react";
import type { FieldErrorEntry } from "../core/Errors.ts";
import type { FieldOption } from "../core/Options.ts";

type FieldChromeProps = {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
};

type BoundFieldProps<TValue> = FieldChromeProps & {
  readonly children: (binding: BoundFieldState<TValue>) => React.ReactNode;
};

/**
 * Reads TanStack field state and normalizes errors for bound field controls.
 *
 * **Gotchas**
 *
 * TanStack owns the field value, blur/change handlers, and validation meta.
 * This hook only derives the `FieldError` shape and `aria-invalid` boolean
 * used by `@beep/ui` controls, so it must run inside a registered field
 * component context.
 *
 * **Example** (Bound username input)
 *
 * ```tsx
 * import { useBoundField } from "../../src/internal/FieldBinding.tsx"
 *
 * export const UsernameInput = () => {
 *   const { field, hasErrors } = useBoundField<string>()
 *
 *   return (
 *     <input
 *       id={field.name}
 *       name={field.name}
 *       value={field.state.value}
 *       onBlur={field.handleBlur}
 *       onChange={(event) => field.handleChange(event.target.value)}
 *       aria-invalid={hasErrors || undefined}
 *     />
 *   )
 * }
 *
 * console.log(UsernameInput)
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useBoundField = <TValue,>() => {
  const field = useFieldContext<TValue>();
  const errors = toFieldErrors(field.state.meta.errors);
  const hasErrors = A.isReadonlyArrayNonEmpty(errors);

  return { errors, field, hasErrors };
};

/**
 * Type returned by {@link useBoundField}.
 *
 * **Example** (Snapshot field state)
 *
 * ```ts
 * import type { BoundFieldState } from "../../src/internal/FieldBinding.tsx"
 *
 * export const fieldSnapshot = (state: BoundFieldState<string>) => ({
 *   hasErrors: state.hasErrors,
 *   name: state.field.name,
 *   value: state.field.state.value,
 * })
 *
 * console.log(fieldSnapshot.length) // 1
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BoundFieldState<TValue> = ReturnType<typeof useBoundField<TValue>>;

/**
 * Renders shared field chrome around a control bound to TanStack field state.
 *
 * **Details**
 *
 * The child render function receives the live TanStack field API. `BoundField`
 * supplies label, description, and normalized errors around that child but does
 * not store a separate copy of the field value.
 *
 * **Example** (Search field render child)
 *
 * ```tsx
 * import { BoundField } from "../../src/internal/FieldBinding.tsx"
 *
 * export const SearchFieldBody = (
 *   <BoundField<string> label="Search" description="Filters by customer name">
 *     {({ field, hasErrors }) => (
 *       <input
 *         id={field.name}
 *         name={field.name}
 *         value={field.state.value}
 *         onBlur={field.handleBlur}
 *         onChange={(event) => field.handleChange(event.target.value)}
 *         aria-invalid={hasErrors || undefined}
 *       />
 *     )}
 *   </BoundField>
 * )
 *
 * console.log(SearchFieldBody)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export function BoundField<TValue>({ children, description, label }: BoundFieldProps<TValue>): React.ReactElement {
  const binding = useBoundField<TValue>();

  return (
    <FieldShell htmlFor={binding.field.name} label={label} description={description} errors={binding.errors}>
      {children(binding)}
    </FieldShell>
  );
}

type FieldControlBinder<TValue, TBoundProps extends object> = (binding: BoundFieldState<TValue>) => TBoundProps;

type CreateBoundFieldOptions<TValue, TProps extends FieldChromeProps, TBoundProps extends object> = {
  readonly bindControl: FieldControlBinder<TValue, TBoundProps>;
  readonly Control: React.ComponentType<Omit<TProps, keyof FieldChromeProps> & TBoundProps>;
};

/**
 * Creates a field component by binding a primitive control to TanStack state.
 *
 * **Details**
 *
 * `bindControl` is the only place where TanStack field state becomes primitive
 * control props. The returned component still leaves value ownership with
 * TanStack and forwards non-chrome props to the primitive.
 *
 * **Example** (Create bound search field)
 *
 * ```tsx
 * import type React from "react"
 * import { createBoundField } from "../../src/internal/FieldBinding.tsx"
 * import type { BoundFieldState } from "../../src/internal/FieldBinding.tsx"
 *
 * type SearchFieldProps = {
 *   readonly description?: React.ReactNode | undefined
 *   readonly label?: React.ReactNode | undefined
 *   readonly placeholder?: string | undefined
 * }
 *
 * type SearchControlProps = {
 *   readonly "aria-invalid"?: boolean | undefined
 *   readonly id: string
 *   readonly name: string
 *   readonly onBlur: () => void
 *   readonly onValueChange: (value: string) => void
 *   readonly placeholder?: string | undefined
 *   readonly value: string
 * }
 *
 * const SearchControl: React.FC<SearchControlProps> = (props) => (
 *   <input
 *     id={props.id}
 *     name={props.name}
 *     value={props.value}
 *     placeholder={props.placeholder}
 *     onBlur={props.onBlur}
 *     onChange={(event) => props.onValueChange(event.target.value)}
 *     aria-invalid={props["aria-invalid"]}
 *   />
 * )
 *
 * const bindSearchControl = ({ field, hasErrors }: BoundFieldState<string>): SearchControlProps => ({
 *   id: field.name,
 *   name: field.name,
 *   value: field.state.value,
 *   onValueChange: field.handleChange,
 *   onBlur: field.handleBlur,
 *   "aria-invalid": hasErrors || undefined,
 * })
 *
 * export const SearchField = createBoundField<string, SearchFieldProps, SearchControlProps>({
 *   Control: SearchControl,
 *   bindControl: bindSearchControl,
 * })
 *
 * export const searchElement = <SearchField label="Search" placeholder="Customer name" />
 *
 * console.log(searchElement)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function createBoundField<TValue, TProps extends FieldChromeProps, TBoundProps extends object>({
  bindControl,
  Control,
}: CreateBoundFieldOptions<TValue, TProps, TBoundProps>): React.FC<TProps> {
  const BoundControlField: React.FC<TProps> = ({ description, label, ...props }) => (
    <BoundField<TValue> label={label} description={description}>
      {(binding) => <Control {...(props as Omit<TProps, keyof FieldChromeProps>)} {...bindControl(binding)} />}
    </BoundField>
  );

  return BoundControlField;
}

type NamedValueControlProps<TValue> = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly id: string;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onValueChange: (value: TValue) => void;
  readonly value: TValue;
};

/**
 * Binds controls that expose `value` and `onValueChange`.
 *
 * **Example** (Token field binding)
 *
 * ```tsx
 * import type React from "react"
 * import { bindNamedValueControl, createBoundField } from "../../src/internal/FieldBinding.tsx"
 *
 * type TokenFieldProps = {
 *   readonly description?: React.ReactNode | undefined
 *   readonly label?: React.ReactNode | undefined
 * }
 *
 * type TokenInputProps = {
 *   readonly "aria-invalid"?: boolean | undefined
 *   readonly id: string
 *   readonly name: string
 *   readonly onBlur: () => void
 *   readonly onValueChange: (value: string) => void
 *   readonly value: string
 * }
 *
 * const TokenInput: React.FC<TokenInputProps> = (props) => (
 *   <input
 *     id={props.id}
 *     name={props.name}
 *     value={props.value}
 *     onBlur={props.onBlur}
 *     onChange={(event) => props.onValueChange(event.target.value)}
 *     aria-invalid={props["aria-invalid"]}
 *   />
 * )
 *
 * export const TokenField = createBoundField<string, TokenFieldProps, TokenInputProps>({
 *   Control: TokenInput,
 *   bindControl: bindNamedValueControl<string>,
 * })
 *
 * console.log(TokenField)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const bindNamedValueControl = <TValue,>({
  field,
  hasErrors,
}: BoundFieldState<TValue>): NamedValueControlProps<TValue> => ({
  id: field.name,
  name: field.name,
  value: field.state.value,
  onValueChange: (value) => field.handleChange(value),
  onBlur: field.handleBlur,
  "aria-invalid": hasErrors || undefined,
});

type NamedChangeControlProps<TValue> = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly id: string;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onChange: React.ChangeEventHandler<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>;
  readonly value: TValue;
};

/**
 * Binds native string controls that report `ChangeEvent` values.
 *
 * **Example** (Notes textarea binding)
 *
 * ```tsx
 * import type React from "react"
 * import { bindStringChangeControl, createBoundField } from "../../src/internal/FieldBinding.tsx"
 *
 * type NotesFieldProps = {
 *   readonly description?: React.ReactNode | undefined
 *   readonly label?: React.ReactNode | undefined
 *   readonly placeholder?: string | undefined
 * }
 *
 * type NotesControlProps = ReturnType<typeof bindStringChangeControl> & {
 *   readonly placeholder?: string | undefined
 * }
 *
 * const NotesControl: React.FC<NotesControlProps> = (props) => (
 *   <textarea
 *     id={props.id}
 *     name={props.name}
 *     value={props.value}
 *     placeholder={props.placeholder}
 *     onBlur={props.onBlur}
 *     onChange={props.onChange}
 *     aria-invalid={props["aria-invalid"]}
 *   />
 * )
 *
 * export const NotesField = createBoundField<string, NotesFieldProps, ReturnType<typeof bindStringChangeControl>>({
 *   Control: NotesControl,
 *   bindControl: bindStringChangeControl,
 * })
 *
 * console.log(NotesField)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const bindStringChangeControl = ({
  field,
  hasErrors,
}: BoundFieldState<string>): NamedChangeControlProps<string> => ({
  id: field.name,
  name: field.name,
  value: field.state.value,
  onChange: (event) => field.handleChange(event.target.value),
  onBlur: field.handleBlur,
  "aria-invalid": hasErrors || undefined,
});

type UploadControlProps = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly inputId: string;
  readonly inputName: string;
  readonly onInputBlur: () => void;
  readonly onValueChange: (value: ReadonlyArray<File>) => void;
  readonly value: ReadonlyArray<File>;
};

/**
 * Binds upload primitives to file-array field values.
 *
 * **Example** (Documents upload field)
 *
 * ```tsx
 * import type React from "react"
 * import { bindUploadControl, createBoundField } from "../../src/internal/FieldBinding.tsx"
 *
 * type DocumentsFieldProps = {
 *   readonly accept?: string | undefined
 *   readonly description?: React.ReactNode | undefined
 *   readonly label?: React.ReactNode | undefined
 * }
 *
 * type UploadInputProps = ReturnType<typeof bindUploadControl> & {
 *   readonly accept?: string | undefined
 * }
 *
 * const UploadInput: React.FC<UploadInputProps> = (props) => (
 *   <input
 *     accept={props.accept}
 *     id={props.inputId}
 *     name={props.inputName}
 *     type="file"
 *     multiple
 *     onBlur={props.onInputBlur}
 *     onChange={(event) => {
 *       const files = event.currentTarget.files
 *       props.onValueChange(files === null ? [] : Array.from(files))
 *     }}
 *     aria-invalid={props["aria-invalid"]}
 *     data-file-count={props.value.length}
 *   />
 * )
 *
 * export const DocumentsField = createBoundField<
 *   ReadonlyArray<File>,
 *   DocumentsFieldProps,
 *   ReturnType<typeof bindUploadControl>
 * >({ Control: UploadInput, bindControl: bindUploadControl })
 *
 * console.log(DocumentsField)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const bindUploadControl = ({ field, hasErrors }: BoundFieldState<ReadonlyArray<File>>): UploadControlProps => ({
  inputId: field.name,
  inputName: field.name,
  value: field.state.value,
  onValueChange: (value) => field.handleChange(value),
  onInputBlur: field.handleBlur,
  "aria-invalid": hasErrors || undefined,
});

type PickerSlotProps = {
  readonly textField?: unknown;
};

type DateTimePickerControlProps = {
  readonly onValueChange: (value: DateTime.DateTime | null) => void;
  readonly slotProps: PickerSlotProps;
  readonly value: DateTime.DateTime | null;
};

type DateTimePickerFieldProps = FieldChromeProps & {
  readonly slotProps?: PickerSlotProps | undefined;
};

const decodeDateTimePickerValue = S.decodeUnknownOption(DateTimeUtcFromValid);

const toDateTimePickerValue = (value: unknown): DateTime.DateTime | null => {
  if (value === null || value === undefined) return null;
  if (DateTime.isDateTime(value)) return value;
  return O.match(decodeDateTimePickerValue(value), {
    onNone: () => null,
    onSome: (decoded) => decoded,
  });
};

const pickerTextFieldProps = (
  slotProps: PickerSlotProps | undefined,
  binding: BoundFieldState<DateTime.DateTime | null>
): PickerSlotProps => {
  const textFieldProps = P.isObject(slotProps?.textField) ? slotProps.textField : {};

  return {
    ...slotProps,
    textField: {
      ...textFieldProps,
      id: binding.field.name,
      name: binding.field.name,
      onBlur: binding.field.handleBlur,
      error: binding.hasErrors,
      "aria-invalid": binding.hasErrors || undefined,
    },
  };
};

/**
 * Creates a date/time picker field component bound to DateTime values.
 *
 * **Details**
 *
 * Picker primitives usually own popup/navigation state, while TanStack owns the
 * selected `DateTime | null` value. This factory injects the value handler and
 * text-field error props without taking over the picker popup.
 *
 * Date/time fields are intentionally type-side controls: pair them with schemas
 * such as `S.NullOr(S.toType(DateTimeUtcFromValid))`. The binding preserves
 * `DateTime.DateTime | null` values and decodes `DateTimeUtcFromValid`
 * compatible encoded defaults before they enter the picker.
 *
 * **Example** (Reminder picker field)
 *
 * ```tsx
 * import type React from "react"
 * import { createDateTimePickerField } from "../../src/internal/FieldBinding.tsx"
 * import type * as DateTime from "effect/DateTime"
 *
 * type PickerSlotProps = {
 *   readonly textField?: unknown
 * }
 *
 * type ReminderFieldProps = {
 *   readonly description?: React.ReactNode | undefined
 *   readonly label?: React.ReactNode | undefined
 *   readonly slotProps?: PickerSlotProps | undefined
 *   readonly timezone?: string | undefined
 * }
 *
 * type InlinePickerProps = {
 *   readonly onValueChange: (value: DateTime.DateTime | null) => void
 *   readonly slotProps: PickerSlotProps
 *   readonly timezone?: string | undefined
 *   readonly value: DateTime.DateTime | null
 * }
 *
 * const InlinePicker: React.FC<InlinePickerProps> = (props) => (
 *   <button
 *     type="button"
 *     data-has-value={props.value !== null}
 *     data-text-field-props={typeof props.slotProps.textField}
 *     onClick={() => props.onValueChange(props.value)}
 *   >
 *     {props.timezone ?? "Local time"}
 *   </button>
 * )
 *
 * export const ReminderField = createDateTimePickerField<ReminderFieldProps>(InlinePicker)
 *
 * console.log(ReminderField)
 * ```
 *
 * @category factories
 * @since 0.0.0
 */
export function createDateTimePickerField<TProps extends DateTimePickerFieldProps>(
  Control: React.ComponentType<Omit<TProps, keyof FieldChromeProps> & DateTimePickerControlProps>
): React.FC<TProps> {
  const BoundDateTimePickerField: React.FC<TProps> = ({ description, label, slotProps, ...props }) => (
    <BoundField<DateTime.DateTime | null> label={label} description={description}>
      {(binding) => (
        <Control
          {...(props as Omit<TProps, keyof FieldChromeProps>)}
          value={toDateTimePickerValue(binding.field.state.value)}
          onValueChange={(value) => binding.field.handleChange(value)}
          slotProps={pickerTextFieldProps(slotProps, binding)}
        />
      )}
    </BoundField>
  );

  return BoundDateTimePickerField;
}

type InlineBooleanFieldProps = FieldChromeProps & {
  readonly children: React.ReactNode;
  readonly errors: ReadonlyArray<FieldErrorEntry>;
  readonly hasErrors: boolean;
  readonly htmlFor: string;
};

/**
 * Renders compact chrome for inline boolean controls.
 *
 * **Example** (Accept terms checkbox)
 *
 * ```tsx
 * import { InlineBooleanField } from "../../src/internal/FieldBinding.tsx"
 *
 * export const AcceptTermsField = (
 *   <InlineBooleanField htmlFor="accept" label="Accept terms" errors={[]} hasErrors={false}>
 *     <input id="accept" name="accept" type="checkbox" />
 *   </InlineBooleanField>
 * )
 *
 * console.log(AcceptTermsField)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const InlineBooleanField: React.FC<InlineBooleanFieldProps> = ({
  children,
  errors,
  hasErrors,
  htmlFor,
  label,
}) => (
  <Field orientation="horizontal" data-invalid={hasErrors || undefined}>
    {children}
    {label !== undefined ? <FieldLabel htmlFor={htmlFor}>{label}</FieldLabel> : null}
    <FieldError errors={[...errors]} />
  </Field>
);

const updateSelectedValues = (
  value: ReadonlyArray<string>,
  optionValue: string,
  checked: boolean
): ReadonlyArray<string> =>
  checked ? A.filter(value, (selected) => selected !== optionValue) : A.append(value, optionValue);

type BooleanOptionControlProps = {
  readonly "aria-invalid"?: boolean | undefined;
  readonly checked: boolean;
  readonly disabled?: boolean | undefined;
  readonly id: string;
  readonly name: string;
  readonly onBlur: () => void;
  readonly onCheckedChange: (checked: boolean) => void;
};

type MultiBooleanOptionFieldProps = FieldChromeProps & {
  readonly Control: React.ComponentType<BooleanOptionControlProps>;
  readonly options: ReadonlyArray<FieldOption>;
};

/**
 * Renders a multi-option boolean field such as checkbox or switch groups.
 *
 * **Example** (Notification channels options)
 *
 * ```tsx
 * import type React from "react"
 * import { MultiBooleanOptionField } from "../../src/internal/FieldBinding.tsx"
 *
 * type BooleanToggleProps = {
 *   readonly "aria-invalid"?: boolean | undefined
 *   readonly checked: boolean
 *   readonly disabled?: boolean | undefined
 *   readonly id: string
 *   readonly name: string
 *   readonly onBlur: () => void
 *   readonly onCheckedChange: (checked: boolean) => void
 * }
 *
 * const BooleanToggle: React.FC<BooleanToggleProps> = (props) => (
 *   <input
 *     checked={props.checked}
 *     disabled={props.disabled}
 *     id={props.id}
 *     name={props.name}
 *     type="checkbox"
 *     onBlur={props.onBlur}
 *     onChange={(event) => props.onCheckedChange(event.target.checked)}
 *     aria-invalid={props["aria-invalid"]}
 *   />
 * )
 *
 * export const NotificationChannelsField = (
 *   <MultiBooleanOptionField
 *     Control={BooleanToggle}
 *     label="Notification channels"
 *     options={[
 *       { value: "email", label: "Email" },
 *       { value: "sms", label: "SMS", disabled: true },
 *     ]}
 *   />
 * )
 *
 * console.log(NotificationChannelsField)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const MultiBooleanOptionField: React.FC<MultiBooleanOptionFieldProps> = ({
  Control,
  description,
  label,
  options,
}) => (
  <BoundField<ReadonlyArray<string>> label={label} description={description}>
    {({ field, hasErrors }) =>
      options.map((option) => {
        const checked = A.contains(field.state.value, option.value);
        const id = `${field.name}-${option.value}`;

        return (
          <Field key={option.value} orientation="horizontal">
            <Control
              id={id}
              name={field.name}
              checked={checked}
              disabled={option.disabled}
              onCheckedChange={() => field.handleChange(updateSelectedValues(field.state.value, option.value, checked))}
              onBlur={field.handleBlur}
              aria-invalid={hasErrors || undefined}
            />
            <FieldLabel htmlFor={id}>{option.label}</FieldLabel>
          </Field>
        );
      })
    }
  </BoundField>
);
