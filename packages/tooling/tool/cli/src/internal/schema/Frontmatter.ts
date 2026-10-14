/**
 * Markdown frontmatter extraction shared by the reflection-artifact lint and
 * the skill frontmatter check.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";

const normalizeNewlines = Str.replace(/\r\n/g, "\n");

/**
 * Extract the YAML text between a leading `---` fence and the next `---` line.
 *
 * **Details**
 *
 * CRLF line endings are normalized first. The fence must open at the very
 * start of the document; a document without a closing fence yields `None`.
 *
 * **Example** (Read the YAML block of a skill file)
 *
 * ```ts
 * import { extractFrontmatter } from "@beep/repo-cli/test/SharedInternals"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(extractFrontmatter("---\nname: yeet\n---\n\n# Body\n"))) // "name: yeet"
 * console.log(O.isNone(extractFrontmatter("# No frontmatter\n"))) // true
 * ```
 *
 * @param raw - Full Markdown document text.
 * @returns The trimmed YAML text, or `None` when no complete fence exists.
 * @category parsers
 * @since 0.0.0
 */
export const extractFrontmatter = (raw: string): O.Option<string> => {
  const normalized = normalizeNewlines(raw);
  if (!Str.startsWith("---")(normalized)) {
    return O.none();
  }
  const rest = Str.slice(3)(normalized);
  return pipe(
    Str.indexOf("\n---")(rest),
    O.map((endIndex) => Str.trim(Str.slice(0, endIndex)(rest)))
  );
};
