import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/cli/internal/isExitCode");

const ExitCode = S.Int.check(S.isBetween({ minimum: 0, maximum: 255 })).annotate(
  $I.annote("ExitCode", { description: "A POSIX process exit status: an integer from 0 through 255." }),
);

/**
 * Whether `code` is an exit status a POSIX process can carry: an integer in
 * `0..255`. `NaN`, fractions and out-of-range values all fail — a relational
 * check alone would admit `NaN`.
 *
 * **Example** (Validate POSIX exit status bounds)
 *
 * ```ts
 * import { isExitCode } from "@beep/scratchpad/effected/cli/internal/isExitCode"
 *
 * console.log(isExitCode(255)) // true
 * console.log(isExitCode(256)) // false
 * console.log(isExitCode(Number.NaN)) // false
 * ```
 *
 * @internal
 * @category predicates
 * @since 0.0.0
 */
export const isExitCode: (code: number) => boolean = S.is(ExitCode);
