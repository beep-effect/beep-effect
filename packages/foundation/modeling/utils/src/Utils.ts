/**
 * Miscellaneous runtime utilities and structural comparison hooks.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as GlobalValue from "./GlobalValue.ts";

/**
 * Shared mutable state used while structural comparison hooks are active.
 *
 * **Gotchas**
 *
 * This is an experimental hook for custom test matchers. User code should prefer
 * the public comparison APIs instead of mutating this state directly.
 *
 * **Example** (Read enabled flag)
 *
 * ```ts
 * import { structuralRegionState } from "@beep/utils/Utils"
 *
 * const enabled = structuralRegionState.enabled
 * console.log(enabled)
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const structuralRegionState = GlobalValue.globalValue(
  "effect/Utils/isStructuralRegion",
  (): { enabled: boolean; tester: ((a: unknown, b: unknown) => boolean) | undefined } => ({
    enabled: false,
    tester: undefined,
  })
);

/**
 * Runs `body` with structural comparison hooks temporarily enabled.
 *
 * **Details**
 *
 * The previous enabled state and tester are restored in a `finally` block, so
 * nested or throwing bodies do not leak the temporary structural region.
 *
 * **Example** (Enable structural region)
 *
 * ```ts
 * import { structuralRegion, structuralRegionState } from "@beep/utils/Utils"
 *
 * const before = structuralRegionState.enabled
 * const inside = structuralRegion(() => structuralRegionState.enabled)
 * const after = structuralRegionState.enabled
 *
 * console.log([before, inside, after])
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const structuralRegion = <A>(body: () => A, tester?: (a: unknown, b: unknown) => boolean): A => {
  const current = structuralRegionState.enabled;
  const currentTester = structuralRegionState.tester;
  structuralRegionState.enabled = true;
  if (tester !== undefined) {
    structuralRegionState.tester = tester;
  }
  try {
    return body();
  } finally {
    structuralRegionState.enabled = current;
    structuralRegionState.tester = currentTester;
  }
};

/**
 * Re-export of all helpers from `effect/Utils`.
 *
 * @category utilities
 * @since 0.0.0
 */
export * from "effect/Utils";
