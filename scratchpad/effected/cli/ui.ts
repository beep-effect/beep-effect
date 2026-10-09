/**
 * Interactive screens for a command-line program built on `effect/cli`, drawn with Ink.
 *
 * @remarks
 * `ink` and `react` are optional peers: install them to use this entrypoint. Importing it loads neither; they are
 * loaded when a screen first mounts. The package root never reaches this entrypoint, which a reachability test
 * pins.
 *
 * A TypeScript consumer also needs the types its declarations name: `@types/react` (an optional peer, since React
 * ships no types of its own) and `@types/node` (`UiStreams` is typed with Node's streams). Without `@types/react`,
 * a program compiled with `skipLibCheck` gets `any` for `Screen` and for every view, silently.
 *
 * @packageDocumentation
 */
export {
	CliUi,
	type CliUiFallbackOptions,
	type CliUiPromptOptions,
	type CliUiRunOptions,
	type Screen,
	type ScreenControl,
} from "./ui/CliUi.ts";
export type { LiveHandle, LiveOptions } from "./ui/CliUiLive.ts";
export {
	Confirm,
	type ConfirmAction,
	type ConfirmInitOptions,
	type ConfirmResult,
	type ConfirmScreenOptions,
	type ConfirmState,
	type ConfirmToggle,
	type ConfirmViewProps,
} from "./ui/Confirm.ts";
export { DocView, type DocViewProps } from "./ui/DocView.ts";
export { KeyHelp, type KeyHelpProps } from "./ui/KeyHelp.ts";
export { type Binding, type KeyHelpRow, KeyTable, type UseKeysOptions, useKeys } from "./ui/KeyTable.ts";
export {
	MultiSelect,
	type MultiSelectAction,
	type MultiSelectInitOptions,
	type MultiSelectItem,
	type MultiSelectScreenOptions,
	type MultiSelectSection,
	type MultiSelectState,
	type MultiSelectViewProps,
} from "./ui/MultiSelect.ts";
export {
	Select,
	type SelectAction,
	type SelectChoice,
	type SelectInitOptions,
	type SelectScreenOptions,
	type SelectState,
	type SelectViewProps,
} from "./ui/Select.ts";
export { type Tab, Tabs, type TabsAction, type TabsProps } from "./ui/Tabs.ts";
export {
	TextInput,
	type TextInputInitOptions,
	type TextInputScreenOptions,
	type TextInputState,
	type TextInputViewProps,
} from "./ui/TextInput.ts";
export { Toggle, type ToggleViewProps } from "./ui/Toggle.ts";
export { type KeyName, UiKey } from "./ui/UiKey.ts";
export { type UiContextValue, UiProvider, type UiProviderProps } from "./ui/UiProvider.ts";
export { UiStreams, type UiStreamsShape } from "./ui/UiStreams.ts";
export {
	type InkTextProps,
	Styled,
	type StyledProps,
	type TerminalSize,
	inkProps,
	useGlyphs,
	useTerminalSize,
	useTheme,
} from "./ui/UiTheme.ts";
export {
	Viewport,
	type ViewportMove,
	type ViewportRow,
	type ViewportState,
	type ViewportViewProps,
} from "./ui/Viewport.ts";
