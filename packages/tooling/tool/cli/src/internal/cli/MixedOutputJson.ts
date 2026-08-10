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

// One forward pass tracks brace depth and string state; each time a top-level
// `{...}` span balances, the candidate is decoded immediately and only the
// latest decodable candidate is retained. Top-level spans are disjoint, so the
// combined slice-and-decode work stays O(n) over the whole input — accumulating
// spans in an immutable array (or rescanning backward per closing brace) is
// quadratic on outputs with many balanced objects and let a large untruncated
// subprocess buffer hang the CLI.
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

  return latest;
};
