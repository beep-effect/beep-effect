/**
 * A single entry in the tab-group color palette.
 *
 * `id` is the value stored on `ITabGroup.color` and serialized in
 * `SerializedTabGroup.color`. `value` is any CSS color expression — a hex
 * literal, an rgb()/hsl()/oklch() function, or a `var(...)` reference.
 *
 * The default palette ships with `var(--dv-tab-group-color-${id})` values so
 * themes can override the defaults purely in CSS. User-supplied palettes
 * typically use raw color literals.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import {A, O, P, pipe} from "@beep/utils";
import * as S from "effect/Schema";
import {SchemaUtils} from "@beep/schema";
import {HashMap} from "effect";

const $I = $ScratchpadId.create("dockview/TabGroupAccent.model");

export class DockviewTabGroupColorEntry extends S.Class<DockviewTabGroupColorEntry>($I`DockviewTabGroupColorEntry`)({
	id: S.String,
	value: S.String,
	label: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("DockviewTabGroupColorEntry", {
	description: "A single entry in the tab-group color palette",
})) {

	static readonly new = ({
		id,
		value,
		label,
	}: {
		readonly id: string;
		readonly value: string;
		readonly label?: undefined | string
	}): DockviewTabGroupColorEntry => DockviewTabGroupColorEntry.make({
		id,
		value,
		label: O.fromNullishOr(label),
	})
}

export const DEFAULT_TAB_GROUP_COLORS: A.NonEmptyReadonlyArray<DockviewTabGroupColorEntry> = pipe([
	{
		id: 'grey',
		value: 'var(--dv-tab-group-color-grey)',
		label: 'Grey',
	},
	{
		id: 'blue',
		value: 'var(--dv-tab-group-color-blue)',
		label: 'Blue',
	},
	{
		id: 'red',
		value: 'var(--dv-tab-group-color-red)',
		label: 'Red',
	},
	{
		id: 'yellow',
		value: 'var(--dv-tab-group-color-yellow)',
		label: 'Yellow',
	},
	{
		id: 'green',
		value: 'var(--dv-tab-group-color-green)',
		label: 'Green',
	},
	{
		id: 'pink',
		value: 'var(--dv-tab-group-color-pink)',
		label: 'Pink',
	},
	{
		id: 'purple',
		value: 'var(--dv-tab-group-color-purple)',
		label: 'Purple',
	},
	{
		id: 'cyan',
		value: 'var(--dv-tab-group-color-cyan)',
		label: 'Cyan',
	},
	{
		id: 'orange',
		value: 'var(--dv-tab-group-color-orange)',
		label: 'Orange',
	},
], A.mapNonEmptyReadonly(DockviewTabGroupColorEntry.new))

/**
 * Runtime palette for tab-group color accents.
 *
 * Resolves a stored `color` string to a CSS color expression, with three
 * fall-through modes:
 *   1. `id` matches an entry → entry's `value`
 *   2. `id` doesn't match → `id` itself (raw CSS literal pass-through)
 *   3. `id` is empty or undefined → undefined (caller skips assignment)
 *
 * When `enabled` is false the palette returns undefined for everything; this
 * is the `tabGroupAccent: 'off'` opt-out path.
 */

export class TabGroupColorPalette extends S.Class<TabGroupColorPalette>($I`TabGroupColorPalette`)({
	_: S.Struct({
		entries: DockviewTabGroupColorEntry.pipe(S.Array, S.mutableKey),
		byId: S.HashMap(S.String, DockviewTabGroupColorEntry).pipe(S.mutableKey),
		enabled: S.Boolean.pipe(SchemaUtils.withKeyDefaults(true), S.mutableKey),
	}),
}, $I.annote("TabGroupColorPalette", {
	description: "Runtime palette for tab-group color accents.",
})) {
	static readonly new = (
		entries: ReadonlyArray<DockviewTabGroupColorEntry>,
		enabled?: undefined | boolean,
	) => TabGroupColorPalette.make({
		_: {
			entries: A.slice(entries),
			byId: HashMap.fromIterable(A.map(entries, (e) => [
				e.id,
				e,
			])), ...(P.isNotUndefined(enabled)
				? {enabled: enabled}
				: {}),
		},
	})

	get enabled() {
		return this._.enabled
	}

	set enabled(value: boolean) {
		this._.enabled = value
	}


	/**
	 * Replace the entry list in place. Used by `updateOptions` so that
	 * existing palette references (held by chips, indicators, etc.) see
	 * the new palette without needing to be re-wired.
	 */
	setEntries(entries: readonly DockviewTabGroupColorEntry[]): void {
		this._.entries = A.slice(entries)
		this._.byId = HashMap.fromIterable(A.map(
			entries,
			(e) => [
				e.id,
				e,
			],
		))
	}

	entries(): readonly DockviewTabGroupColorEntry[] {
		return this._.entries
	}

	has(id: string): boolean {
		return HashMap.has(this._.byId, id)
	}

	get(id: string): O.Option<DockviewTabGroupColorEntry> {
		return HashMap.get(this._.byId, id)
	}

	/** First entry's id; used as the default when a color is unset. */
	defaultId(): O.Option<string> {
		return A.head(this._.entries).pipe(O.map((e) => e.id))
	}
}