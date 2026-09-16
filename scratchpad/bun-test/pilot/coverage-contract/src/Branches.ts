import * as P from "effect/Predicate";

/**
 * Expose a two-way branch for coverage-provider comparisons.
 *
 * **Example** (Observe choose)
 *
 * ```ts
 * import { choose } from "@beep/scratchpad/bun-test/pilot/coverage-contract/src/Branches"
 *
 * console.log(choose(true)) // 1
 * console.log(choose(false)) // 0
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const choose = (enabled: boolean): number => {
  if (!enabled) {
    return 0;
  }
  return 1;
};

/**
 * Copy input characters through a guarded loop used by the coverage fixture.
 *
 * **Example** (Observe guardedCharacters)
 *
 * ```ts
 * import { guardedCharacters } from "@beep/scratchpad/bun-test/pilot/coverage-contract/src/Branches"
 *
 * console.log(guardedCharacters("abc")) // abc
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const guardedCharacters = (input: string): string => {
  let cursor = 0;
  let output = "";
  while (cursor < input.length) {
    const character = input[cursor];
    if (!P.isString(character)) {
      break;
    }
    output += character;
    cursor += 1;
  }
  return output;
};

/**
 * Expose a nullish fallback branch for the coverage fixture.
 *
 * **Example** (Observe fallback)
 *
 * ```ts
 * import { fallback } from "@beep/scratchpad/bun-test/pilot/coverage-contract/src/Branches"
 *
 * console.log(fallback("ready")) // ready
 * console.log(fallback(undefined)) // uncovered
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const fallback = (input: string | undefined): string => input ?? "uncovered";
