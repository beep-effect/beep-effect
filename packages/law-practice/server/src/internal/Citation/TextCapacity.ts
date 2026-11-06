/** Shared exclusion for bounded native text producers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Semaphore from "effect/Semaphore";

const $I = $LawPracticeServerId.create("internal/Citation/TextCapacity");
class Borrowed extends Context.Reference<HashSet.HashSet<symbol>>($I`Borrowed`, {
  defaultValue: () => HashSet.empty(),
}) {}
/** Effect owns permit acquisition, cleanup and inherited context. A borrowing
 * producer and its children cannot reenter the same ledger; unrelated callers
 * wait for cleanup. Different authorities can be nested. No timer or waiter loop.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationTextCapacity = Effect.fn("Citation.makeTextCapacity")(function* <Invalid>(
  invalid: () => Invalid
) {
  const permit = yield* Semaphore.make(1);
  const token = Symbol("citation-text-capacity");
  const exclusive = Effect.fnUntraced(function* <A, E, R>(body: Effect.Effect<A, E, R>) {
    const borrowed = yield* Borrowed;
    if (HashSet.has(borrowed, token)) return yield* Effect.fail(invalid());
    return yield* permit.withPermit(body);
  });
  const borrow = <A, E, R>(body: Effect.Effect<A, E, R>) =>
    exclusive(
      Effect.flatMap(Borrowed, (borrowed) => Effect.provideService(body, Borrowed, HashSet.add(borrowed, token)))
    );
  return { exclusive, borrow };
});
