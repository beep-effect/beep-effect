/**
 * The one filter shape, shared by every read surface.
 *
 * One vocabulary means one thing to learn: a consumer who can express a
 * subscription can express a query and a projection without translating. It is
 * also what makes the filter-before-decode guarantee expressible — every field
 * here lives on the envelope **frame**, so matching never touches `data`.
 *
 * @since 0.1.0
 */
import type { DateTime } from "effect";
import type { EnvelopeFrame } from "./Envelope.ts";
import type { JsonlEvent } from "./JsonlEvent.ts";

/**
 * A filter over envelope fields.
 *
 * Every field is optional and they combine with AND. An omitted field does not
 * filter; an empty `events: []` or `scopes: []` matches nothing, which is the
 * honest reading of "restrict to this empty set" and is tested.
 *
 * @public
 */
export interface Slice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R> = JsonlEvent.Tag<R>> {
	/**
	 * Restrict to these event tags.
	 *
	 * Passing a literal array narrows the element type of the surface's stream to
	 * exactly those variants, so a projection over a slice is exhaustively
	 * checkable.
	 */
	readonly events?: ReadonlyArray<T> | undefined;
	/** Restrict to these partition keys. An envelope with no `scope` matches none of them. */
	readonly scopes?: ReadonlyArray<string> | undefined;
	/** Lower bound on `at`, **inclusive**. */
	readonly from?: DateTime.Utc | undefined;
	/**
	 * Upper bound on `at`, **exclusive**.
	 *
	 * Half-open so adjacent windows tile without double-delivering an envelope on
	 * the seam — which matters because `at` collisions are ordinary at
	 * millisecond resolution and universal under `TestClock`.
	 */
	readonly to?: DateTime.Utc | undefined;
}

/**
 * A {@link Slice} plus a resume point.
 *
 * @public
 */
export interface CursoredSlice<R extends JsonlEvent.Registry, T extends JsonlEvent.Tag<R> = JsonlEvent.Tag<R>>
	extends Slice<R, T> {
	/**
	 * Resume from this logical byte offset, **inclusive**.
	 *
	 * Offsets are post-BOM, matching every offset this package emits. Persist a
	 * processed envelope's `line.end` and pass it back to replay exactly the
	 * remainder: `end` is the start of the next line, so nothing is redelivered
	 * and nothing is skipped.
	 */
	readonly cursor?: number | undefined;
}

/**
 * Whether a frame satisfies a slice.
 *
 * Takes the **frame**, never a decoded envelope — that is what keeps matching
 * ahead of the payload schema on the read path.
 *
 * @internal
 */
export const matchesFrame = (frame: typeof EnvelopeFrame.Type, slice: Slice<never, never> | undefined): boolean => {
	if (slice === undefined) {
		return true;
	}
	if (slice.events !== undefined && !slice.events.includes(frame.event as never)) {
		return false;
	}
	if (slice.scopes !== undefined) {
		if (frame.scope === undefined || !slice.scopes.includes(frame.scope)) {
			return false;
		}
	}
	const millis = frame.at.epochMilliseconds;
	if (slice.from !== undefined && millis < slice.from.epochMilliseconds) {
		return false;
	}
	return !(slice.to !== undefined && millis >= slice.to.epochMilliseconds);

};
