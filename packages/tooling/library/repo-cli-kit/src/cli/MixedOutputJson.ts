/**
 * Linear-time JSON object recovery from mixed CLI output.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const decodeJsonTextOption = S.decodeUnknownOption(S.fromJsonString(S.Unknown));

const characterAt = (text: string, index: number): string | undefined => O.getOrUndefined(Str.charAt(text, index));

const isEscapedQuote = (output: string, index: number): boolean => {
  let backslashCount = 0;
  for (let cursor = index - 1; cursor >= 0 && characterAt(output, cursor) === "\\"; cursor -= 1) {
    backslashCount += 1;
  }
  return backslashCount % 2 === 1;
};

const scansAsStringCharacter = (
  output: string,
  index: number,
  char: string | undefined,
  state: { depth: number; inString: boolean }
): boolean => {
  if (state.depth > 0 && char === '"' && !isEscapedQuote(output, index)) {
    state.inString = !state.inString;
    return true;
  }
  return state.inString;
};

const jsonObjectTextFromRight = (output: string): O.Option<string> => {
  const state = { depth: 0, inString: false };
  let closeIndex = -1;

  for (let cursor = Str.length(output) - 1; cursor >= 0; cursor -= 1) {
    const char = characterAt(output, cursor);
    if (scansAsStringCharacter(output, cursor, char, state)) {
      continue;
    }
    if (char === "}") {
      if (state.depth === 0) {
        closeIndex = cursor;
      }
      state.depth += 1;
      continue;
    }
    if (char === "{" && state.depth > 0) {
      state.depth -= 1;
      if (state.depth === 0) {
        const candidate = Str.slice(cursor, closeIndex + 1)(output);
        if (O.isSome(decodeJsonTextOption(candidate))) {
          return O.some(candidate);
        }
      }
    }
  }

  return O.none();
};

// The forward pass decodes disjoint top-level spans and retains only the latest.
// If an unmatched opening brace leaves a later object nested, one bounded reverse
// pass decodes disjoint spans from the end. Accumulating spans (or rescanning per
// closing brace) is quadratic on balanced-object floods and let a large
// untruncated subprocess buffer hang the CLI.
/**
 * Extract the last decodable top-level JSON object from mixed command output.
 *
 * **Details**
 *
 * Text outside objects (log lines, progress output) is skipped, braces inside
 * JSON strings are ignored, and a span that does not decode as JSON is passed
 * over. The scan is linear in the length of `output`.
 *
 * **Example** (Recover a report printed after log lines)
 *
 * ```ts
 * import { jsonObjectTextFromMixedOutput } from "@beep/repo-cli-kit/cli/MixedOutputJson"
 * import * as O from "effect/Option"
 *
 * const output = 'starting {not json}\n{"ok":true}\ndone'
 *
 * console.log(O.getOrUndefined(jsonObjectTextFromMixedOutput(output))) // {"ok":true}
 * ```
 *
 * @param output - Captured command output that may mix text and JSON.
 * @returns The text of the last top-level object that decodes, if any.
 * @category parsing
 * @since 0.0.0
 */
export const jsonObjectTextFromMixedOutput = (output: string): O.Option<string> => {
  let latest: O.Option<string> = O.none();
  const state = { depth: 0, inString: false };
  let openIndex = -1;
  const length = Str.length(output);

  for (let cursor = 0; cursor < length; cursor += 1) {
    const char = characterAt(output, cursor);
    if (scansAsStringCharacter(output, cursor, char, state)) {
      continue;
    }
    if (char === "{") {
      if (state.depth === 0) {
        openIndex = cursor;
      }
      state.depth += 1;
      continue;
    }
    if (char === "}" && state.depth > 0) {
      state.depth -= 1;
      if (state.depth === 0) {
        const candidate = Str.slice(openIndex, cursor + 1)(output);
        if (O.isSome(decodeJsonTextOption(candidate))) {
          latest = O.some(candidate);
        }
      }
    }
  }

  return state.depth > 0 ? O.orElse(jsonObjectTextFromRight(output), () => latest) : latest;
};
