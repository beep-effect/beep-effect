import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import { dual } from "effect/Function";

const assertClaimReservationPrefixesBody = (
  name: string,
  operation: (charge: (amount: number) => boolean) => boolean
) => {
  const reservations = A.empty<number>();
  assert.isTrue(
    operation((amount) => {
      reservations.push(amount);
      return true;
    }),
    name
  );
  assert.isAbove(reservations.length, 0, name);
  for (let failureAt = 0; failureAt < reservations.length; failureAt++) {
    const calls = A.empty<number>();
    const result = operation((amount) => {
      calls.push(amount);
      return calls.length <= failureAt;
    });
    assert.isFalse(result, `${name}: reservation ${failureAt}`);
    assert.strictEqual(calls.length, failureAt + 1, `${name}: no reservation after rejection ${failureAt}`);
    assert.deepStrictEqual(calls, A.take(reservations, failureAt + 1), `${name}: original reservation prefix`);
  }
};

/**
 * Every refused work request must reject the operation and end the exact funded request prefix.
 * **Example** (One atomic request)
 * ```ts
 * import { assertClaimReservationPrefixes } from "./ClaimElementWorkAssertions.ts"
 * assertClaimReservationPrefixes("one request", (charge) => charge(1))
 * ```
 * @category testing
 * @since 0.0.0
 */
export const assertClaimReservationPrefixes: {
  (operation: (charge: (amount: number) => boolean) => boolean): (name: string) => void;
  (name: string, operation: (charge: (amount: number) => boolean) => boolean): void;
} = dual(2, assertClaimReservationPrefixesBody);
