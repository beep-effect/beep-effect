import * as P from "effect/Predicate";

export const choose = (enabled: boolean): number => {
  if (!enabled) {
    return 0;
  }
  return 1;
};

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

export const fallback = (input: string | undefined): string => input ?? "uncovered";
