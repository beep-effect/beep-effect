/**
 * Linear-time JSON object recovery from mixed CLI output.
 *
 * @internal
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

const jsonObjectTextFromRight = (output: string): O.Option<string> => {
  let depth = 0;
  let closeIndex = -1;
  let inString = false;

  for (let cursor = Str.length(output) - 1; cursor >= 0; cursor -= 1) {
    const char = characterAt(output, cursor);
    if (depth > 0 && char === '"' && !isEscapedQuote(output, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "}") {
      if (depth === 0) {
        closeIndex = cursor;
      }
      depth += 1;
      continue;
    }
    if (char === "{" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
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
 * @internal
 * @since 0.0.0
 */
export const jsonObjectTextFromMixedOutput = (output: string): O.Option<string> => {
  let latest: O.Option<string> = O.none();
  let depth = 0;
  let openIndex = -1;
  let inString = false;
  const length = Str.length(output);

  for (let cursor = 0; cursor < length; cursor += 1) {
    const char = characterAt(output, cursor);
    if (depth > 0 && char === '"' && !isEscapedQuote(output, cursor)) {
      inString = !inString;
      continue;
    }
    if (inString) {
      continue;
    }
    if (char === "{") {
      if (depth === 0) {
        openIndex = cursor;
      }
      depth += 1;
      continue;
    }
    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0) {
        const candidate = Str.slice(openIndex, cursor + 1)(output);
        if (O.isSome(decodeJsonTextOption(candidate))) {
          latest = O.some(candidate);
        }
      }
    }
  }

  return depth > 0 && !inString ? O.orElse(jsonObjectTextFromRight(output), () => latest) : latest;
};
