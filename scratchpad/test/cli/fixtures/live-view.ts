import { dual } from "effect/Function";
// A live view module as a consumer writes one: its own file, importing Ink and React as values. Loaded only through
// CliUi.lazyView, so a test can tell whether a run loaded it.
import { Text } from "ink";
import type { ReactElement } from "react";
import { createElement } from "react";

export interface SyncState {
	readonly done: number;
}

(globalThis as { liveViewLoads?: number }).liveViewLoads =
	((globalThis as { liveViewLoads?: number }).liveViewLoads ?? 0) + 1;

const view: {
	(frame: number): (state: SyncState) => ReactElement;
	(state: SyncState, frame: number): ReactElement;
} = dual(2, (state: SyncState, frame: number): ReactElement =>
	createElement(Text, null, `INK done ${state.done} frame ${frame}`));

export default view;
