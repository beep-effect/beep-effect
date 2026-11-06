/** Bounded complete LF frames shared by citation native transports.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationEngineAbsoluteMaxima } from "@beep/law-practice-use-cases/server";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";

const $I = $LawPracticeServerId.create("internal/Citation/ByteFrames");
const Limit = S.Int.check(S.isBetween({ minimum: 1, maximum: CitationEngineAbsoluteMaxima.processMessageBytes })).pipe(
  $I.annoteSchema("Limit", { description: "Effective complete-frame byte ceiling, including terminal LF." })
);
/** Only closed server error constructors are injected; framing stays shared.
 * @internal @category services @since 0.0.0
 */
export interface CitationNativeFrameErrors<Invalid, Exceeded, Failed> {
  readonly exceeded: () => Exceeded;
  readonly failed: () => Failed;
  readonly invalid: () => Invalid;
}
/** Install one family's existing bounded reader without repeating its loop or
 * error translation. The source's platform error is deliberately discarded.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationNativeFrameReader = <Invalid, Exceeded, Failed>(
  errors: CitationNativeFrameErrors<Invalid, Exceeded, Failed>
) =>
  Effect.fn("Citation.readNativeFrames")(function* <SourceError>(
    source: Stream.Stream<Uint8Array, SourceError>,
    maximum: number,
    expected: 1 | 3,
    onFrame: (bytes: Uint8Array) => Effect.Effect<void, Invalid | Exceeded | Failed>
  ) {
    yield* readCitationByteFrames<SourceError, Invalid | Exceeded | Failed>(
      source,
      maximum,
      expected,
      onFrame,
      errors.invalid,
      errors.exceeded,
      errors.failed
    );
  });
/** Trusted transport error constructors and callback stay in the parent/worker
 * program. They are never request fields. Every copy and amortized buffer growth
 * stays within the complete-frame ceiling; one-byte fragmentation has fixed
 * bounded buffer state, not an unbounded list of chunk objects.
 * @internal @category operations @since 0.0.0
 */
export const readCitationByteFrames = Effect.fn("Citation.readByteFrames")(function* <SourceError, E>(
  source: Stream.Stream<Uint8Array, SourceError>,
  maximum: number,
  expected: 1 | 3,
  onFrame: (bytes: Uint8Array) => Effect.Effect<void, E>,
  invalid: () => E,
  exceeded: () => E,
  channelFailed: () => E
) {
  const limit = yield* S.decodeEffect(Limit)(maximum).pipe(Effect.mapError(invalid));
  let buffer = new Uint8Array(0);
  let used = 0;
  let frames = 0;
  const consumeByte = Effect.fnUntraced(function* (byte: number | undefined) {
    if (frames >= expected) return yield* Effect.fail(invalid());
    if (byte !== 10) {
      if (used + 1 >= limit) return yield* Effect.fail(exceeded());
      if (used === buffer.byteLength) {
        const next = new Uint8Array(Num.min(limit - 1, Num.max(1, buffer.byteLength * 2)));
        next.set(buffer);
        buffer = next;
      }
      buffer[used] = byte ?? 0;
      used++;
      return;
    }
    const complete = buffer.slice(0, used);
    yield* onFrame(complete);
    frames++;
    used = 0;
    buffer = new Uint8Array(0);
  });
  yield* Stream.runForEach(
    source.pipe(Stream.mapError(channelFailed)),
    Effect.fnUntraced(function* (chunk) {
      for (let index = 0; index < chunk.byteLength; index++) {
        if (index % 4096 === 0) yield* Effect.yieldNow;
        yield* consumeByte(chunk[index]);
      }
    })
  );
  if (frames !== expected || used !== 0) return yield* Effect.fail(invalid());
});
