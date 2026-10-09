import type { FunctionComponent, ReactElement } from "react";
import { fromReact } from "./ink.ts";

/**
 * Swaps the element a mounted {@link holder} shows; `committed`, when given, is called once React has committed it.
 *
 * @internal
 */
export type HolderSwap = (next: ReactElement, committed?: () => void) => void;

/** What the holder shows, and who is waiting for it to be committed. */
interface Shown {
	readonly element: ReactElement;
	readonly committed: (() => void) | undefined;
}

/**
 * Props of {@link holder}.
 *
 * @internal
 */
export interface HolderProps {
	/** The element to show first. */
	readonly initial: ReactElement;
	/**
	 * Receives the function that swaps the shown element once the holder has mounted, and `undefined` once it has
	 * unmounted, so its owner never swaps into a tree that is gone.
	 */
	readonly bind: (swap: HolderSwap | undefined) => void;
}

/**
 * A component that shows one element and lets its owner swap it in place.
 *
 * @remarks
 * Everything above the holder stays mounted across a swap: the screen's error boundary, its context, the root keys
 * and the colour hold. Only the held subtree changes, so the screen's `ScreenControl` keeps meaning the same screen.
 * The swap function is handed over in a layout effect, before the first frame is written, and taken back in that
 * effect's cleanup. A swap is a state update, which React commits in a microtask rather than at once, so a swap can
 * ask to be told when its element is committed: the live view waits for that before it draws on or unmounts. Built on
 * the loaded React, like every kit component; the screen harness's `rerender` and the live view's pushes use it.
 *
 * @internal
 */
export const holder: () => FunctionComponent<HolderProps> = fromReact((react) => {
	const Holder = (props: HolderProps): ReactElement => {
		const [shown, setShown] = react.useState<Shown>(() => ({ element: props.initial, committed: undefined }));
		react.useLayoutEffect(() => {
			props.bind((element, committed) => setShown({ element, committed }));
			return () => props.bind(undefined);
		}, [props.bind]);
		react.useLayoutEffect(() => shown.committed?.(), [shown]);
		return shown.element;
	};
	Holder.displayName = "CliUiHolder";
	return Holder;
});

/**
 * The owner's side of a {@link holder}: the `bind` to hand it, and the swap it bound.
 *
 * @internal
 */
export interface HolderSlot {
	/** Pass as the holder's `bind`. */
	readonly bind: HolderProps["bind"];
	/** Whether a holder is mounted and bound: the step an owner waits on before its first swap. */
	readonly isBound: () => boolean;
	/**
	 * Swap the shown element; `false`, and nothing done, when no holder is bound (not yet mounted, or unmounted).
	 * `committed` is called once React has committed the element, or a later swap's, or at once when nothing was
	 * swapped, and also when the holder unmounts first: every waiter is released exactly once.
	 */
	readonly swap: (next: ReactElement, committed?: () => void) => boolean;
}

/**
 * A fresh {@link HolderSlot}.
 *
 * @internal
 */
export const holderSlot = (): HolderSlot => {
	let bound: HolderSwap | undefined;
	// Waiters for swaps not yet committed, oldest first. React commits only the latest of several swaps made before it
	// renders, so a commit releases its own waiter and every older one; an unmount releases them all.
	const pending: Array<() => void> = [];
	const release = (through: number): void => {
		for (const committed of pending.splice(0, through + 1)) committed();
	};
	return {
		bind: (swap) => {
			bound = swap;
			if (swap === undefined) release(pending.length - 1);
		},
		isBound: () => bound !== undefined,
		swap: (next, committed) => {
			if (bound === undefined) {
				committed?.();
				return false;
			}
			if (committed === undefined) {
				bound(next);
				return true;
			}
			const own = (): void => committed();
			pending.push(own);
			bound(next, () => {
				const at = pending.indexOf(own);
				if (at !== -1) release(at);
			});
			return true;
		},
	};
};
