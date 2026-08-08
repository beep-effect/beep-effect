/**
 * Multi-select field rendering one `@beep/ui` `Switch` per option.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
"use client";

import { Switch } from "@beep/ui/components/switch";
import { MultiBooleanOptionField } from "../internal/FieldBinding.tsx";
import type React from "react";
import type { FieldOption } from "../core/Options.ts";

/**
 * Props for {@link MultiSwitchField}: label/description/options. The bound value
 * is the array of switched-on option values.
 *
 * **Example** (Notification multi-switch props)
 *
 * ```ts
 * import type { MultiSwitchFieldProps } from "@beep/form/fields/MultiSwitchField"
 *
 * const props = {
 *   label: "Notifications",
 *   options: [
 *     { value: "mentions", label: "Mentions" },
 *     { value: "releases", label: "Releases" },
 *   ],
 * } satisfies MultiSwitchFieldProps
 *
 * console.log(props.options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface MultiSwitchFieldProps {
  readonly description?: React.ReactNode | undefined;
  readonly label?: React.ReactNode | undefined;
  readonly options: ReadonlyArray<FieldOption>;
}

/**
 * Schema-bound switch list: the value is the array of switched-on option values.
 *
 * **Example** (Channels multi-switch form)
 *
 * ```tsx
 * import { Form, makeFormOptions, useAppForm } from "@beep/form"
 * import { MultiSwitchField } from "@beep/form/fields/MultiSwitchField"
 * import * as S from "effect/Schema"
 *
 * const ChannelsSchema = S.Struct({ channels: S.Array(S.String) })
 * const channelOptions = [
 *   { value: "mentions", label: "Mentions" },
 *   { value: "releases", label: "Releases" },
 * ]
 * const channelFormOptions = makeFormOptions({
 *   schema: ChannelsSchema,
 *   defaultValues: { channels: ["mentions"] },
 *   validateOn: "change",
 * })
 *
 * export function ChannelForm() {
 *   const form = useAppForm(channelFormOptions)
 *
 *   return (
 *     <form.AppForm>
 *       <Form onSubmit={() => form.handleSubmit()}>
 *         <form.AppField name="channels">
 *           {() => <MultiSwitchField label="Channels" options={channelOptions} />}
 *         </form.AppField>
 *       </Form>
 *     </form.AppForm>
 *   )
 * }
 *
 * console.log(channelFormOptions.defaultValues.channels.join(", ")) // "mentions"
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export const MultiSwitchField: React.FC<MultiSwitchFieldProps> = (props) => (
  <MultiBooleanOptionField {...props} Control={Switch} />
);
