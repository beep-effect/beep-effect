/** Allocation-free traversal of owned JavaScript text points for HTML framing.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

/** Visit original points and stop immediately on a false result. Yield before
 * the first point and every 4096 UTF-16 units, retaining the HTML scan cadence.
 * The visitor is a local synchronous operation, never request or worker data.
 * @internal @category operations @since 0.0.0
 */
export const visitCitationTextPoints = Effect.fn("Citation.visitTextPoints")(function* (
  text: string,
  visit: (point: number) => boolean
) {
  let nextYield = 0;
  for (let index = 0; index < Str.length(text); ) {
    if (index >= nextYield) {
      yield* Effect.yieldNow;
      nextYield = index + 4096;
    }
    const point = O.getOrElse(Str.codePointAt(text, index), () => 0);
    if (!visit(point)) return false;
    index += point > 0xffff ? 2 : 1;
  }
  return true;
});
