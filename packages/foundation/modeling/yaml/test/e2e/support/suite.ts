/**
 * Test data loader for the official yaml-test-suite.
 *
 * Reads raw fixture files from the vendored corpus at
 * `test/fixtures/yaml-test-suite/` (pinned to data-2022-01-17 — see
 * VENDORED.md there). Vite's glob import inlines every case file's raw text at
 * transform time, so the loader never touches a filesystem at test time.
 */

import * as A from "effect/Array";
import { identity } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

/** Glob-key prefix shared by every suite fixture. */
const SUITE_PREFIX = "../../fixtures/yaml-test-suite/";

/**
 * Raw text of every case file, keyed by its glob path. The four-character
 * top-level class keeps the `name/` and `tags/` symlink indexes out, exactly as
 * the former directory walk skipped symlinked entries.
 */
const suiteFiles: Record<string, string> = {
  ...import.meta.glob<string>(
    "../../fixtures/yaml-test-suite/[0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z]/{===,in.yaml,in.json,out.yaml,test.event,error}",
    { query: "?raw", import: "default", eager: true }
  ),
  ...import.meta.glob<string>(
    "../../fixtures/yaml-test-suite/[0-9A-Z][0-9A-Z][0-9A-Z][0-9A-Z]/*/{===,in.yaml,in.json,out.yaml,test.event,error}",
    { query: "?raw", import: "default", eager: true }
  ),
};

/** A single yaml-test-suite test case. */
export interface TestCase {
  /** Expected parse event stream from `test.event`. */
  events: string;
  /** 4-character test ID (e.g., "229Q"). */
  id: string;
  /** True if the `error` file is present (YAML should be rejected). */
  isError: boolean;
  /** True if `in.json` contains multiple top-level JSON values (multi-document stream). */
  isMultiDocument: boolean;
  /** Parsed expected JSON output (if `in.json` exists). */
  json?: unknown;
  /** Human-readable test name from the `===` file. */
  name: string;
  /** Expected re-serialized YAML (if `out.yaml` exists). */
  outYaml?: string | undefined;
  /** Raw YAML input from `in.yaml`. */
  yaml: string;
}

/** Result of parsing a JSON fixture file. */
interface ParsedJson {
  /** True if the file contained multiple top-level JSON values. */
  isMultiDocument: boolean;
  /** The parsed value: single value for single-doc, array for multi-doc. */
  value: unknown;
}

/** Mutable scanner state for a composite (object/array) JSON value. */
interface CompositeScan {
  depth: number;
  inString: boolean;
  isEscaped: boolean;
}

const isWhitespace = (src: string, i: number): boolean => /\s/.test(src[i] ?? "");

function skipWhitespace(src: string, i: number): number {
  let j = i;
  while (j < src.length && isWhitespace(src, j)) j++;
  return j;
}

/** Advance the scanner over one character inside a JSON string. */
function stepInString(state: CompositeScan, c: string | undefined): void {
  if (state.isEscaped) state.isEscaped = false;
  else if (c === "\\") state.isEscaped = true;
  else if (c === '"') state.inString = false;
}

/** Advance the scanner over one character outside strings; true when the value closes. */
function stepOutsideString(state: CompositeScan, c: string | undefined): boolean {
  if (c === '"') {
    state.inString = true;
    return false;
  }
  if (c === "{" || c === "[") {
    state.depth++;
    return false;
  }
  if (c !== "}" && c !== "]") return false;
  state.depth--;
  return state.depth === 0;
}

/** End index (exclusive) of the object/array starting at `start`, or -1 when unterminated. */
function compositeEnd(src: string, start: number): number {
  const state: CompositeScan = { depth: 0, inString: false, isEscaped: false };
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (state.inString) stepInString(state, c);
    else if (stepOutsideString(state, c)) return i + 1;
  }
  return -1;
}

/** End index (exclusive) of the quoted string starting at `start`. */
function quotedEnd(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length) {
    if (src[i] === "\\" && i + 1 < src.length) {
      i += 2;
    } else if (src[i] === '"') {
      return i + 1;
    } else {
      i++;
    }
  }
  return i;
}

/** End index (exclusive) of an unquoted token: number, true, false, null. */
function bareEnd(src: string, start: number): number {
  let i = start;
  while (i < src.length && !isWhitespace(src, i)) i++;
  return i;
}

/** End index (exclusive) of the JSON value starting at `start`, or -1 when unterminated. */
function valueEnd(src: string, start: number): number {
  const ch = src[start];
  if (ch === "{" || ch === "[") return compositeEnd(src, start);
  if (ch === '"') return quotedEnd(src, start);
  return bareEnd(src, start);
}

/**
 * Parse a JSON file that may contain multiple top-level JSON values
 * (one per YAML document in multi-document streams).
 * Returns a single value if there's only one, or an array of values for multi-doc.
 */
function parseMultiJson(text: string): ParsedJson {
  const values: unknown[] = [];
  const src = Str.trim(text);
  let i = skipWhitespace(src, 0);

  while (i < src.length) {
    const end = valueEnd(src, i);
    if (end === -1) break;
    values.push(Result.getOrThrowWith(S.decodeResult(S.fromJsonString(S.Unknown))(Str.slice(i, end)(src)), identity));
    i = skipWhitespace(src, end);
  }

  const isMultiDocument = values.length > 1;
  return {
    value: isMultiDocument ? values : values[0],
    isMultiDocument,
  };
}

/** Raw text of `file` inside the case directory `id`, when the file exists. */
const caseFile = (id: string, file: string): O.Option<string> => R.get(suiteFiles, `${SUITE_PREFIX}${id}/${file}`);

/** Build the test case whose files live under the case directory `id`. */
function loadCase(id: string, yaml: string): TestCase {
  const parsed = O.map(caseFile(id, "in.json"), parseMultiJson);
  return {
    id,
    name: O.match(caseFile(id, "==="), { onNone: () => id, onSome: Str.trim }),
    yaml,
    events: O.getOrElse(caseFile(id, "test.event"), () => ""),
    json: O.getOrUndefined(O.map(parsed, (result) => result.value)),
    outYaml: O.getOrUndefined(caseFile(id, "out.yaml")),
    isError: O.isSome(caseFile(id, "error")),
    isMultiDocument: O.exists(parsed, (result) => result.isMultiDocument),
  };
}

/**
 * Load all test cases from the yaml-test-suite data directory.
 *
 * Handles both flat test directories (e.g., `229Q/in.yaml`) and
 * multi-case directories with numbered subdirectories (e.g., `3RLN/00/`, `3RLN/01/`).
 */
export function loadAllTestCases(): TestCase[] {
  const cases = A.map(
    A.filter(R.toEntries(suiteFiles), ([path]) => Str.endsWith("/in.yaml")(path)),
    ([path, text]) => loadCase(Str.slice(SUITE_PREFIX.length, -"/in.yaml".length)(path), text)
  );
  if (A.isReadonlyArrayEmpty(cases)) {
    throw new Error(`yaml-test-suite not found under ${SUITE_PREFIX}.`);
  }

  return cases.sort((a, b) => Str.localeCompare(b.id)(a.id));
}
