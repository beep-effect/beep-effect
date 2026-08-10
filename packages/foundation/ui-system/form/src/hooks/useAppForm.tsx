/**
 * The centralized `@beep/form` form hook.
 *
 * One {@link createFormHook} call registers every bound field component and the
 * form-level components, producing {@link useAppForm}, {@link withForm}, and
 * {@link withFieldGroup}. Apps call {@link useAppForm}; they never call
 * `createFormHook` themselves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { createFormHook } from "@tanstack/react-form";
import { SubmitButton } from "../components/SubmitButton.tsx";
import { fieldContext, formContext } from "../core/contexts.ts";
import { AutocompleteField } from "../fields/AutocompleteField.tsx";
import { CheckboxField } from "../fields/CheckboxField.tsx";
import { ColorField } from "../fields/ColorField.tsx";
import { ComboboxField } from "../fields/ComboboxField.tsx";
import { CountryField } from "../fields/CountryField.tsx";
import { DateField } from "../fields/DateField.tsx";
import { DateTimeField } from "../fields/DateTimeField.tsx";
import { EmojiField } from "../fields/EmojiField.tsx";
import { MultiCheckboxField } from "../fields/MultiCheckboxField.tsx";
import { MultiSelectField } from "../fields/MultiSelectField.tsx";
import { MultiSwitchField } from "../fields/MultiSwitchField.tsx";
import { NativeSelectField } from "../fields/NativeSelectField.tsx";
import { NumberField } from "../fields/NumberField.tsx";
import { OTPField } from "../fields/OTPField.tsx";
import { PhoneField } from "../fields/PhoneField.tsx";
import { RadioGroupField } from "../fields/RadioGroupField.tsx";
import { RatingField } from "../fields/RatingField.tsx";
import { SelectField } from "../fields/SelectField.tsx";
import { SliderField } from "../fields/SliderField.tsx";
import { SwitchField } from "../fields/SwitchField.tsx";
import { TextareaField } from "../fields/TextareaField.tsx";
import { TextField } from "../fields/TextField.tsx";
import { TimeField } from "../fields/TimeField.tsx";
import { ToggleField } from "../fields/ToggleField.tsx";
import { ToggleGroupField } from "../fields/ToggleGroupField.tsx";
import { UploadAvatarField } from "../fields/UploadAvatarField.tsx";
import { UploadBoxField } from "../fields/UploadBoxField.tsx";
import { UploadField } from "../fields/UploadField.tsx";

const formHook = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    Text: TextField,
    Number: NumberField,
    Date: DateField,
    DateTime: DateTimeField,
    Time: TimeField,
    Phone: PhoneField,
    Country: CountryField,
    Color: ColorField,
    Rating: RatingField,
    Emoji: EmojiField,
    Upload: UploadField,
    UploadAvatar: UploadAvatarField,
    UploadBox: UploadBoxField,
    Textarea: TextareaField,
    Checkbox: CheckboxField,
    Switch: SwitchField,
    Select: SelectField,
    NativeSelect: NativeSelectField,
    Combobox: ComboboxField,
    Autocomplete: AutocompleteField,
    MultiSelect: MultiSelectField,
    RadioGroup: RadioGroupField,
    Slider: SliderField,
    Toggle: ToggleField,
    ToggleGroup: ToggleGroupField,
    OTP: OTPField,
    MultiCheckbox: MultiCheckboxField,
    MultiSwitch: MultiSwitchField,
  },
  formComponents: {
    Submit: SubmitButton,
  },
});

/**
 * Creates a typed form instance with every `@beep/form` field/form component
 * pre-registered. Pair with the schema-first builders in
 * `@beep/form/core/FormOptions`.
 *
 * **Details**
 *
 * The returned form instance owns all TanStack form state and exposes the
 * registered field components through `form.AppField`. Field components should
 * be rendered inside `<form.AppForm>` so their provider-backed hooks resolve.
 *
 * **Example** (Schema-backed login form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import * as S from "effect/Schema"
 *
 * const LoginSchema = S.Struct({ email: S.String })
 * const loginOptions = makeFormOptions({
 *   schema: LoginSchema,
 *   defaultValues: { email: "" },
 *   validateOn: "change",
 * })
 *
 * export function LoginForm() {
 *   const form = useAppForm(loginOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="email">{(field) => <field.Text label="Email" />}</form.AppField>
 *         <form.Submit>Sign in</form.Submit>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(loginOptions.defaultValues.email) // ""
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const useAppForm = formHook.useAppForm;

/**
 * Builds a reusable sub-form component over a shared form instance.
 *
 * **Example** (Reusable profile sub-form)
 *
 * ```tsx
 * import { withForm } from "@beep/form/hooks/useAppForm"
 *
 * export const ProfileFields = withForm({
 *   defaultValues: { name: "" },
 *   props: { legend: "Profile" },
 *   render: ({ form, legend }) => (
 *     <fieldset>
 *       <legend>{legend}</legend>
 *       <form.AppField name="name">{(field) => <field.Text label="Name" />}</form.AppField>
 *     </fieldset>
 *   ),
 * })
 *
 * console.log(ProfileFields.name) // "Render"
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const withForm = formHook.withForm;

/**
 * Builds a reusable, remappable field-group component (address, password +
 * confirm, amount + currency, …).
 *
 * **Example** (Remappable address field group)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { withFieldGroup } from "@beep/form/hooks/useAppForm"
 * import * as S from "effect/Schema"
 *
 * const AddressFields = withFieldGroup({
 *   defaultValues: { line1: "", city: "" },
 *   props: { legend: "Mailing address" },
 *   render: ({ group, legend }) => (
 *     <fieldset>
 *       <legend>{legend}</legend>
 *       <group.AppField name="line1">{(field) => <field.Text label="Address" />}</group.AppField>
 *       <group.AppField name="city">{(field) => <field.Text label="City" />}</group.AppField>
 *     </fieldset>
 *   ),
 * })
 *
 * const CheckoutSchema = S.Struct({
 *   address: S.Struct({ line1: S.String, city: S.String }),
 * })
 * const checkoutOptions = makeFormOptions({
 *   schema: CheckoutSchema,
 *   defaultValues: { address: { line1: "", city: "" } },
 *   validateOn: "change",
 * })
 *
 * export function CheckoutForm() {
 *   const form = useAppForm(checkoutOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <AddressFields form={form} fields="address" legend="Mailing address" />
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(checkoutOptions.defaultValues.address.city) // ""
 * ```
 *
 * @category hooks
 * @since 0.0.0
 */
export const withFieldGroup = formHook.withFieldGroup;
