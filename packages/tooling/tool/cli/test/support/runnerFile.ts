// A reader for the runner-file command format (`GITHUB_OUTPUT`, `GITHUB_ENV`),
// the way the Actions runner's `FileCommandManager` reads it: each entry is
// either one `name=value` line or a `name<<DELIMITER` heredoc block closed by
// a line holding exactly the delimiter. Whichever of `=` and `<<` comes first
// on the line decides the form. The parity tests compare what the commands
// wrote before and after the runner-file writes moved to `@beep/github-actions`
// at this level: the entries the runner reads, not the bytes.

import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

/** One entry as the runner reads it: a name and its value. */
export type RunnerFileEntry = readonly [name: string, value: string];

const heredocHeader = (line: string): O.Option<RunnerFileEntry> => {
  const marker = Str.indexOf("<<")(line);
  const equals = Str.indexOf("=")(line);
  if (O.isNone(marker) || (O.isSome(equals) && equals.value < marker.value)) return O.none();
  return O.some([Str.slice(0, marker.value)(line), Str.slice(marker.value + 2)(line)]);
};

const property = (line: string): RunnerFileEntry =>
  O.match(Str.indexOf("=")(line), {
    onNone: () => [line, ""],
    onSome: (index) => [Str.slice(0, index)(line), Str.slice(index + 1)(line)],
  });

/** Every entry of a runner file, in file order. A heredoc block left unclosed throws. */
export const parseRunnerFile = (text: string): ReadonlyArray<RunnerFileEntry> => {
  const lines = Str.split(Str.replaceAll("\r\n", "\n")(text), "\n");
  const entries: Array<RunnerFileEntry> = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index] ?? "";
    index += 1;
    if (Str.isEmpty(line)) continue;
    const header = heredocHeader(line);
    if (O.isNone(header)) {
      entries.push(property(line));
      continue;
    }
    const [name, delimiter] = header.value;
    const close = A.findFirstIndex(A.drop(lines, index), (candidate) => candidate === delimiter);
    if (O.isNone(close)) throw new Error(`unclosed heredoc block for ${name}`);
    entries.push([name, A.join(A.take(A.drop(lines, index), close.value), "\n")]);
    index += close.value + 1;
  }
  return entries;
};
