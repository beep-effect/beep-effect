/**
 * The one filter shape, shared by every read surface.
 *
 * One vocabulary means one thing to learn: a consumer who can express a
 * subscription can express a query and a projection without translating. It is
 * also what makes the filter-before-decode guarantee expressible — every field
 * here lives on the envelope **frame**, so matching never touches `data`.
 *
 * @packageDocumentation
 * @since 0.0.0
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
 * **Gotchas**
 *
 * Empty arrays are not "no restriction" — they match nothing. `to` is exclusive
 * so adjacent windows tile without double-delivering an envelope on the seam,
 * which matters because `at` collisions are ordinary at millisecond resolution
 * and universal under `TestClock`. Matching reads frame fields only; decoding
 * first and filtering afterwards inverts the package's cost guarantee.
 *
 * @see {@link EnvelopeFrame} for the frame fields this filter actually reads.
 * @see {@link Envelope.decodeSelectedResult} for filter-before-payload-decode.
 * @public
 * @category models
 * @since 0.0.0
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
 * Resume a historical or live read from a persisted byte cursor.
 *
 * Persist a processed envelope's `line.end` — not `line.offset` — and pass it
 * back as `cursor` so replay starts at the next line: nothing is redelivered
 * and nothing is skipped. Offsets are post-BOM, matching every offset this
 * package emits.
 *
 * @see {@link Slice} for the filter fields this resume point combines with.
 * @see {@link EnvelopeFrame} for the frame matching still happens against.
 * @public
 * @category models
 * @since 0.0.0
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
 * **Gotchas**
 *
 * Fields combine with AND. `events: []` and `scopes: []` match nothing. An
 * omitted `slice` matches everything. `to` is exclusive (`millis >= to` fails).
 * An envelope with no `scope` matches no `scopes` restriction. Persist
 * `line.end`, not `line.offset`, when turning a match into a resume cursor.
 *
 * **Example** (Empty events, missing scope, half-open `to`)
 *
 * ```ts
 * import { EnvelopeFrame } from "@beep/scratchpad/jsonl"
 * import { DateTime, Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownResult(EnvelopeFrame)({
 *   at: "2026-01-15T12:00:00.000Z",
 *   event: "mail-received",
 *   data: null,
 * })
 * if (Result.isSuccess(decoded)) {
 *   const frame = decoded.success
 *   const seam = DateTime.makeUnsafe("2026-01-15T12:00:00.000Z")
 *   console.log(matchesFrame(frame, undefined)) // true
 *   console.log(matchesFrame(frame, { events: [] })) // false
 *   console.log(matchesFrame(frame, { events: ["mail-received"] })) // true
 *   console.log(matchesFrame(frame, { scopes: ["inbox"] })) // false
 *   console.log(matchesFrame(frame, { to: seam })) // false
 * }
 * ```
 *
 * @see {@link EnvelopeFrame} for the frame fields this predicate reads.
 * @see {@link Slice} for the AND-combined filter this implements.
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const matchesFrame = (frame: EnvelopeFrame, slice: Slice<never, never> | undefined): boolean => {
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
