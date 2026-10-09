import type * as PlatformError from "effect/PlatformError";
import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import { dual } from "effect/Function";

const $I = $ScratchpadId.create("effected/commands/internal/capture");

/** Raised when a captured stream exceeds its byte budget; mapped by Run. */
export class OutputTooLarge extends S.TaggedError<OutputTooLarge>($I`OutputTooLarge`)("OutputTooLarge", {
 limit: S.Finite.annotateKey({ description: "The configured byte budget for this stream." }),
}, $I.annote("OutputTooLarge", { description: "A captured stream exceeded its byte budget." })) {}

/**
 * Collects a byte stream into a string, failing once more than `limit` bytes
 * have arrived.
 *
 * @remarks
 * The budget is enforced **during** accumulation, not after: checking the
 * length of an already-collected string would mean the memory was already
 * spent, which is the exact failure the budget exists to prevent. Counting is
 * on raw bytes, before decoding, because bytes are what the process actually
 * produced.
 */
export const collectBounded: {
	(limit: number): (stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>) => Effect.Effect<string, PlatformError.PlatformError | OutputTooLarge>;
	(stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>, limit: number): Effect.Effect<string, PlatformError.PlatformError | OutputTooLarge>;
} = dual(
	2,
	Effect.fnUntraced(function* (stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>, limit: number) {
		const seen = yield* Ref.make(0);
		const bounded = Stream.mapEffect(stream, (chunk) =>
			Effect.flatMap(
				Ref.updateAndGet(seen, (total) => total + chunk.length),
				(total) => (total > limit ? Effect.fail(OutputTooLarge.make({ limit })) : Effect.succeed(chunk)),
			),
		);
		return yield* bounded.pipe(Stream.decodeText, Stream.mkString);
	}),
);
