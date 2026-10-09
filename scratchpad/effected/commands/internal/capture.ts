import type { PlatformError } from "effect";
import { Data, Effect, Ref, Stream } from "effect";

/**
 * Raised when a captured stream exceeds its byte budget.
 *
 * @remarks
 * Internal and never exported from the package: `Run` maps it to the public
 * `CommandOutputError`. `Data.TaggedError` is appropriate precisely because it
 * never escapes — it is an in-process signal, not a contract.
 */
export class OutputTooLarge extends Data.TaggedError("OutputTooLarge")<{
	readonly limit: number;
}> {}

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
export const collectBounded = (
	stream: Stream.Stream<Uint8Array, PlatformError.PlatformError>,
	limit: number,
): Effect.Effect<string, PlatformError.PlatformError | OutputTooLarge> =>
	Effect.gen(function* () {
		const seen = yield* Ref.make(0);
		const bounded = Stream.mapEffect(stream, (chunk) =>
			Effect.flatMap(
				Ref.updateAndGet(seen, (total) => total + chunk.length),
				(total) => (total > limit ? Effect.fail(new OutputTooLarge({ limit })) : Effect.succeed(chunk)),
			),
		);
		return yield* Stream.mkString(Stream.decodeText(bounded));
	});
