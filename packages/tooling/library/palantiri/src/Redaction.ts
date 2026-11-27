/**
 * Redaction for the free text a parcel carries, so no parcel ever serves an
 * address or a home-absolute path.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { flow } from "effect/Function";
import * as Str from "effect/String";

const EMAIL_FROM_RUN_START = /(?<![^\s@<>()"',;:])[^\s@<>()"',;:]+@[^\s@<>()"',;:]+/g;
const HOME_PATH = /(?:\/home|\/Users)\/[^\s/]+|\/root(?=\/|\s|$)/g;

/**
 * Redact free text for a parcel: email addresses become `[email]`, any other
 * `@` is dropped, and home-absolute paths start with `$HOME`.
 *
 * **Details**
 *
 * Session notes and inbox excerpts are written by people and agents, so they
 * can name an address or a local path. A parcel never carries `@`, so a
 * consumer can assert that no address leaked; a scoped package name such as
 * `@beep/palantiri` reads `beep/palantiri`.
 *
 * **Example** (Redact a note)
 *
 * ```ts
 * import { redactText } from "@beep/palantiri/Redaction"
 *
 * console.log(redactText("mailed me@example.com from /home/someone/work about @beep/palantiri"))
 * // "mailed [email] from $HOME/work about beep/palantiri"
 * ```
 *
 * @param text - The free text.
 * @returns The redacted text.
 * @category formatting
 * @since 0.0.0
 */
export const redactText: (text: string) => string = flow(
  Str.replaceAll(EMAIL_FROM_RUN_START, "[email]"),
  Str.replaceAll("@", ""),
  Str.replaceAll(HOME_PATH, "$$HOME")
);
