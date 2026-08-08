/**
 * Shared HTML ASCII string operations.
 *
 * @internal
 * @since 0.0.0
 */
import { A } from "@beep/utils";
import { flow } from "effect/Function";
import * as Str from "effect/String";

const ASCII_UPPERCASE_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/**
 * Lowercases only ASCII uppercase characters.
 *
 * **Example** (Preserve non-ASCII casing)
 *
 * Internal call site
 * ```ts
 * import { toAsciiLowerCase } from "./Html.ascii.ts"
 *
 * console.log(toAsciiLowerCase("customÉ")) // "customÉ"
 * ```
 *
 * @internal
 * @category utilities
 * @since 0.0.0
 */
export const toAsciiLowerCase: (value: string) => string = flow(
  Str.split(""),
  A.map((character) => (Str.includes(character)(ASCII_UPPERCASE_CHARACTERS) ? Str.toLowerCase(character) : character)),
  A.join("")
);
