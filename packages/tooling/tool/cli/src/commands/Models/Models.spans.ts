/**
 * Grammar-specific owned spans for model projections.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Jsonc, JsoncParseOptions } from "@beep/jsonc/Jsonc";
import { A, O, Str } from "@beep/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, pipe } from "effect/Function";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Regex from "effect/RegExp";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { decodeTomlTextWith } from "../../internal/schema/TextCodec.ts";
import { ModelsLocatorError } from "./Models.errors.ts";
import { ModelsEligibilityResult, ModelsWriteSpan } from "./Models.manifest.schemas.ts";
import type { JsoncNode } from "@beep/jsonc/JsoncNode";
import type { Locator, ModelsLocatorWrite } from "./Models.manifest.schemas.ts";

const decodeToml = decodeTomlTextWith(S.decodeUnknownEffect(S.Record(S.String, S.Unknown)));

/**
 * Parse the entire TOML document before certifying or editing an owned value.
 *
 * **Example** (Validate native TOML)
 *
 * ```ts
 * import { modelsParseToml } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsParseToml('model = "example"')))
 * ```
 *
 * @param content - The complete native TOML document.
 * @returns The fully parsed native fields or a typed parse failure.
 * @category parsing
 * @since 0.0.0
 */
export const modelsParseToml = (content: string) =>
  decodeToml(content).pipe(ModelsLocatorError.mapError("Invalid TOML target."));

const unsupportedRemovalShape = "Unsupported removal shape: owned leaf must be a scalar TOML assignment.";

const removalShapeEligibility = (owned: O.Option<unknown>, remove: boolean | undefined) =>
  remove === true && O.exists(owned, P.isObjectOrArray)
    ? Effect.fail(ModelsEligibilityResult.cases["unsupported-removal-shape"].make({ message: unsupportedRemovalShape }))
    : Effect.void;

const encodeString = S.encodeEffect(S.fromJsonString(S.String));
const error = (message: string) => ModelsLocatorError.make({ message });

const strictJson = JsoncParseOptions.make({ disallowComments: true, allowTrailingComma: false });

// Duplicate keys are ambiguous ownership, including in unowned subtrees.
const duplicateJsonKeys = (node: JsoncNode): boolean => {
  const children = O.getOrElse(O.fromUndefinedOr(node.children), () => []);
  const names = A.map(children, (child) =>
    O.map(A.head(O.getOrElse(O.fromUndefinedOr(child.children), () => [])), (key) => key.value)
  );
  return (
    (node.type === "object" && A.length(A.dedupe(names)) !== A.length(names)) || A.some(children, duplicateJsonKeys)
  );
};

/**
 * Parse strict JSON once, retaining node offsets and rejecting duplicate keys.
 *
 * **Example** (Validate native JSON)
 *
 * ```ts
 * import { modelsParseJson } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsParseJson('{"model":"example"}')))
 * ```
 *
 * @param content - The complete native JSON document.
 * @returns A fully validated JSON tree with source offsets.
 * @category parsing
 * @since 0.0.0
 */
export const modelsParseJson = (content: string): Effect.Effect<JsoncNode, ModelsLocatorError> =>
  Jsonc.parseTreeResult(content, strictJson).pipe(
    Result.getSuccess,
    O.flatten,
    O.match({
      onNone: () => Effect.fail(error("Invalid JSON target.")),
      onSome: (tree) =>
        duplicateJsonKeys(tree) ? Effect.fail(error("Unsupported JSON form: duplicate keys.")) : Effect.succeed(tree),
    })
  );

/**
 * Read a decoded native leaf through a sequence of property names.
 *
 * **Example** (Read a parsed model)
 *
 * ```ts
 * import { modelsParsedLeaf } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as O from "effect/Option"
 * console.log(O.getOrThrow(modelsParsedLeaf({ model: "example" }, ["model"])))
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const modelsParsedLeaf: {
  (value: unknown, path: ReadonlyArray<string>): O.Option<unknown>;
  (path: ReadonlyArray<string>): (value: unknown) => O.Option<unknown>;
} = dual(
  2,
  (value: unknown, path: ReadonlyArray<string>): O.Option<unknown> =>
    A.reduce(path, O.some(value), (current, key) =>
      O.flatMap(current, (node) =>
        P.isObjectOrArray(node) && R.has(node as Readonly<Record<string, unknown>>, key)
          ? O.fromNullishOr((node as Readonly<Record<string, unknown>>)[key])
          : O.none()
      )
    )
);

/**
 * Name the format refused by the TOML/JSON-only native writer.
 *
 * **Example** (Identify a check-only YAML target)
 *
 * ```ts
 * import { modelsCheckOnlyFormat } from "@beep/repo-cli/commands/Models/Models.spans"
 * import { LocatorBinding } from "@beep/repo-cli/commands/Models"
 * import * as O from "effect/Option"
 * const format = modelsCheckOnlyFormat({
 *   _tag: "yaml-path", path: ["model"], render: { _tag: "verbatim" },
 *   binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" })
 * })
 * console.log(O.getOrElse(format, () => "writable")) // "YAML"
 * ```
 *
 * @param locator - The grammar whose write capability is being checked.
 * @returns The refused format name, or None for TOML/JSON.
 * @category utilities
 * @since 0.0.0
 */
export const modelsCheckOnlyFormat = (locator: Locator): O.Option<string> =>
  Match.value(locator).pipe(
    Match.tag("toml-top-level-key", "toml-table-key", "json-key", O.none<string>),
    Match.tag("yaml-path", () => O.some("YAML")),
    Match.tag("xml-attribute", "xml-escaped-json-attribute", () => O.some("XML")),
    Match.tag("shell-assign", "env-key", () => O.some("Shell")),
    Match.tag("ts-literal", () => O.some("TypeScript")),
    Match.tag("line-value", "md-generated-block", () => O.some("Text")),
    Match.exhaustive
  );

/**
 * Refuse excluded formats and mismatched extensions without accessing a target.
 *
 * **Example** (Preflight a TOML destination)
 *
 * ```ts
 * import { modelsWritePreflight } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsWritePreflight("config.toml", [])))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsWritePreflight = Effect.fn("Models.writePreflight")(function* (
  file: string,
  locators: ReadonlyArray<Locator>
) {
  const path = yield* Path.Path;
  if (A.isReadonlyArrayEmpty(locators)) return yield* error("Locator ownership must be non-empty.");
  for (const locator of locators) {
    const format = modelsCheckOnlyFormat(locator);
    if (O.isSome(format)) return yield* error(`${format.value} targets are check-only; edit by hand.`);
    const extension = locator._tag === "json-key" ? ".json" : ".toml";
    if (path.extname(file) !== extension)
      return yield* error(`Target format mismatch: ${locator._tag} requires a canonical ${extension} path.`);
  }
});

/**
 * Decode native bytes without replacing invalid UTF-8 or stripping a BOM.
 *
 * **Example** (Decode valid native bytes)
 *
 * ```ts
 * import { modelsNativeText } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsNativeText(new TextEncoder().encode("model=1"))))
 * ```
 *
 * @param bytes - Exact native file bytes.
 * @returns Lossless UTF-8 text or a typed decoding failure.
 * @category parsing
 * @since 0.0.0
 */
export const modelsNativeText = (bytes: Uint8Array) =>
  Effect.try({
    try: () => new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes),
    catch: () => error("Native configuration must be valid UTF-8; refusing byte normalization."),
  });

/**
 * Resolve and certify native ownership with one canonical-path and byte gate.
 *
 * **Details**
 * Recovery supplies a backup source while retaining the live canonical format.
 * Live removals accept an absent owned path as their satisfied post-state.
 * Set operations and recovery require parsed ownership. No lexical span or
 * journal assertion establishes ownership.
 *
 * **Example** (Check native eligibility)
 *
 * ```ts
 * import { modelsEligibility } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsEligibility("config.toml", [])))
 * ```
 *
 * @param file - The requested live target whose canonical extension owns the format.
 * @param writes - Every owned operation to validate, including removals.
 * @param sourceFile - The byte source, normally the live target or a recovery backup.
 * @param operation - Apply accepts completed removals; restore requires owned pre-images.
 * @returns A tagged eligibility outcome, with canonical identity and text on success.
 * @category parsing
 * @since 0.0.0
 */
export const modelsEligibility = Effect.fn("Models.eligibility")(function* (
  file: string,
  writes: ReadonlyArray<ModelsLocatorWrite>,
  sourceFile = file,
  operation: "apply" | "restore" = "apply"
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const cases = ModelsEligibilityResult.cases;
  return yield* Effect.gen(function* () {
    const locators = A.map(writes, (write) => write.locator);
    yield* modelsWritePreflight(file, locators).pipe(
      Effect.mapError(({ message }) => cases["ineligible-format"].make({ message }))
    );
    if (A.some(writes, (write) => write.remove === true && write.locator._tag !== "toml-top-level-key"))
      return yield* Effect.fail(
        cases["ineligible-format"].make({ message: "Removal owns only a top-level TOML assignment." })
      );
    const actual = yield* fs
      .realPath(file)
      .pipe(Effect.mapError(({ message }) => cases["not-canonical"].make({ message })));
    yield* modelsWritePreflight(actual, locators).pipe(
      Effect.mapError(({ message }) => cases["not-canonical"].make({ message }))
    );
    const bytes = yield* fs
      .readFile(sourceFile === file ? actual : sourceFile)
      .pipe(Effect.mapError(({ message }) => cases["io-error"].make({ message })));
    const content = yield* modelsNativeText(bytes).pipe(
      Effect.mapError(({ message }) => cases["invalid-bytes"].make({ message }))
    );
    const parsed = yield* Match.value(path.extname(actual)).pipe(
      Match.when(".json", () => modelsParseJson(content).pipe(Effect.map((tree) => tree.toValue()))),
      Match.orElse(() => modelsParseToml(content)),
      Effect.mapError(({ message }) => cases["parse-error"].make({ message }))
    );
    let removalsPresent = false;
    for (const { locator, remove } of writes) {
      const owned = Match.value(locator).pipe(
        Match.tag("toml-top-level-key", ({ key }) => modelsParsedLeaf(parsed, [key])),
        Match.tag("toml-table-key", ({ table, key }) => modelsParsedLeaf(parsed, [...Str.split(table, "."), key])),
        Match.tag("json-key", ({ pointer, fallbacks }) =>
          A.findFirst(
            A.map([pointer, ...fallbacks], (segments) => modelsParsedLeaf(parsed, segments)),
            O.isSome
          ).pipe(O.flatten)
        ),
        Match.orElse(() => O.none())
      );
      yield* removalShapeEligibility(owned, remove);
      removalsPresent = removalsPresent || (remove === true && O.isSome(owned));
      if (O.isNone(owned) && !(operation === "apply" && remove === true))
        return yield* Effect.fail(
          cases["absent-owned-path"].make({ message: "Owned path is absent from the parsed native document." })
        );
    }
    return cases.eligible.make({ actual, content, removalsPresent });
  }).pipe(Effect.catch(Effect.succeed));
});

// Decode only a single literal shell word. Concatenated quote components,
// expansions and unbalanced quoting need a shell AST owner and fail closed.
const shellWordValue = Effect.fnUntraced(function* (token: string) {
  if (/^'[^']*'$/.test(token)) return Str.slice(1, -1)(token);
  const doubleQuoted = /^"(?:\\.|[^"\\])*"$/.test(token);
  const value = doubleQuoted ? Str.slice(1, -1)(token) : token;
  if (/(?:^|[^\\])(?:\\\\)*[$`]/.test(value)) return yield* error("Unsupported shell form: expansion.");
  if (doubleQuoted) return Str.replace(/\\(["\\$`])/g, "$1")(value);
  if (!/^(?:\\.|[^'"\\])+$/.test(token))
    return yield* error("Unsupported shell form: concatenated or unbalanced quoting.");
  return Str.replace(/\\(.)/g, "$1")(token);
});

// Tokenize every word, including words outside the locator. If any part of a
// relevant line is outside this literal grammar, its value cannot prove sync.
const shellTokens = /[ \t]+|#[^\n]*$|&&|\|\||[;&|()]|(?:"(?:\\.|[^"\\\n])*"|'[^'\n]*'|\\[^\n]|[^'"\\\s;&|()<>])+/gy;
const unsupportedShell = "Unsupported shell form";

const shellControl = /^(?:&&|\|\||[;&|()])$/;

const shellLineTokens = (line: string) => {
  const tokens = new RegExp(shellTokens.source, "gy");
  const words: Array<string> = [];
  let consumed = 0;
  while (consumed < Str.length(line)) {
    const match = tokens.exec(line);
    if (match === null) return Tuple.make(words, O.some(Str.slice(consumed)(line)));
    const token = match[0];
    consumed = tokens.lastIndex;
    if (Str.startsWith("#")(token)) break;
    if (!/^[ \t]+$/.test(token)) words.push(token);
  }
  return Tuple.make(words, O.none<string>());
};

const shellTokenValue = Effect.fnUntraced(function* (token: string, variable: string) {
  const word = Str.startsWith(`${variable}=`)(token)
    ? Str.slice(Str.length(variable) + 1)(token)
    : Str.replace(/^[A-Za-z_][A-Za-z_0-9]*=/, "")(token);
  const literal = /^'[^']*'$|^"(?:\\.|[^"\\])*"$/.test(word);
  // Admit an explicit literal alphabet, rather than enumerating expansion
  // operators. Every other unquoted form is unsupported by construction.
  const bare = /^(?:\\.|[A-Za-z0-9_./:@+,=-])+$/.test(word) && !/^=/.test(word);
  const escapedBoundary = /\\[ \t;&|()<>]/.test(word);
  const code = shellControl.test(word) || /^[{}]$/.test(word);
  if (!literal && (escapedBoundary || (!bare && !code))) return O.none<string>();
  const prefix = Str.slice(0, Str.length(token) - Str.length(word))(token);
  return yield* shellWordValue(word).pipe(Effect.option, Effect.map(O.map((value) => `${prefix}${value}`)));
});

const ownedShellValue = (
  words: ReadonlyArray<string>,
  decoded: ReadonlyArray<O.Option<string>>,
  index: number,
  variable: string
) => {
  const token = O.getOrElse(A.get(words, index), () => "");
  const value = O.flatten(A.get(decoded, index));
  if (Str.startsWith(`${variable}=`)(token)) return O.map(value, Str.slice(Str.length(variable) + 1));
  if (!Str.startsWith("-")(variable)) return O.none<string>();
  if (token === variable) {
    const next = O.getOrElse(A.get(words, index + 1), () => "");
    return O.some(
      shellControl.test(next)
        ? unsupportedShell
        : O.getOrElse(O.flatten(A.get(decoded, index + 1)), () => unsupportedShell)
    );
  }
  if (new RegExp(`^${Regex.escape(variable)}=`).test(Str.replace(/\\(.)/g, "$1")(token)))
    return O.some(unsupportedShell);
  // A quoted/escaped option name is outside the canonical locator grammar.
  // Recognize its decoded identity and report it instead of dropping it.
  return O.exists(value, (word) => word === variable || Str.startsWith(`${variable}=`)(word))
    ? O.some(unsupportedShell)
    : O.none<string>();
};

const matchIndex = (match: RegExpExecArray): number => match.index;

const recognizedShellOffsets = (
  line: string,
  words: ReadonlyArray<string>,
  decoded: ReadonlyArray<O.Option<string>>,
  variable: string
) => {
  const recognized: Array<number> = [];
  let cursor = 0;
  let declaration = false;
  for (const [index, word] of A.entries(words)) {
    const pattern = new RegExp(Regex.escape(word), "g");
    pattern.lastIndex = cursor;
    const offset = O.getOrElse(O.map(O.fromNullishOr(pattern.exec(line)), matchIndex), constant(-1));
    cursor = offset + Str.length(word);
    if (shellControl.test(word)) declaration = false;
    if (/^(?:declare|typeset|local|unset)$/.test(word)) declaration = true;
    const value = ownedShellValue(words, decoded, index, variable);
    if (!declaration && O.exists(value, (word) => word !== unsupportedShell)) recognized.push(offset);
  }
  return recognized;
};

/**
 * Read literal assignment or flag words; unsupported relevant lines report drift.
 *
 * **Details**
 *
 * Every textual occurrence of the owned name must be a recognized assignment or flag.
 * Occurrences in comments and quoted data intentionally report unsupported drift.
 * The scanner accounts for every word on a physical line. A here-document or
 * unclosed quote makes the remaining document unsupported; no later line is
 * trusted after a containing form this grammar cannot resolve.
 *
 * **Example** (Decode an escaped assignment)
 *
 * ```ts
 * import { modelsShellWords } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsShellWords("MODEL=old", "MODEL"))) // true
 * ```
 *
 * @param content - Shell text to read.
 * @param variable - Exact assignment name or model flag.
 * @returns Literal values or explicit unsupported-form drift evidence.
 * @category utilities
 * @since 0.0.0
 */
export const modelsShellWords = Effect.fn("Models.shellWords")(function* (content: string, variable: string) {
  const values: Array<string> = [];
  let continued = false;
  let unsafeRemainder = false;
  let lineNumber = 0;
  for (const line of Str.split(content, "\n")) {
    lineNumber += 1;
    const [words, remainder] = shellLineTokens(line);
    const decoded = yield* Effect.forEach(words, (word) => shellTokenValue(word, variable), { concurrency: 1 });
    const owned = A.getSomes(A.map(words, (_, index) => ownedShellValue(words, decoded, index, variable)));
    const occurrences = A.fromIterable(Str.matchAll(new RegExp(Regex.escape(variable), "g"))(line));
    const recognized = recognizedShellOffsets(line, words, decoded, variable);
    const mentions = A.isReadonlyArrayNonEmpty(occurrences) || Str.includes(variable)(Str.replace(/[\\'"]/g, "")(line));
    const unmatched = A.some(occurrences, (match) => !A.contains(recognized, match.index));
    const unsupported =
      mentions &&
      (continued ||
        unsafeRemainder ||
        O.isSome(remainder) ||
        /\\$/.test(line) ||
        A.some(decoded, O.isNone) ||
        A.contains(owned, unsupportedShell) ||
        unmatched);
    unsafeRemainder = unsafeRemainder || O.exists(remainder, (rest) => /['"<]/.test(rest));
    continued = /\\$/.test(line);
    values.push(...(unsupported ? [`${unsupportedShell}: line ${lineNumber}`] : owned));
  }
  return values;
});

const unboundedShellScopeLine = (line: string) => {
  const [words, remainder] = shellLineTokens(line);
  return (
    O.isSome(remainder) ||
    A.some(words, (word) => !/^'[^']*'$|^"(?:\\.|[^"\\])*"$/.test(word) && /[{}]/.test(Str.replace(/\\./g, "")(word)))
  );
};

/**
 * Resolve one plain multiline function without dropping ambiguous body text.
 *
 * **Details**
 *
 * Owned inline, nested, duplicate and unterminated definitions are unsupported.
 * An absent definition yields an empty body; unsupported scope yields None.
 * Quoted or escaped braces are data and do not terminate a supported body.
 *
 * **Example** (Resolve a simple function)
 *
 * ```ts
 * import { modelsShellScope } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as O from "effect/Option"
 * const source = "route() {\nMODEL=old\n}\n"
 * console.log(O.isSome(modelsShellScope(source, "route", "MODEL"))) // true
 * ```
 *
 * @param content - Complete shell document.
 * @param name - Named function whose literal body is owned.
 * @param variable - Owned name used to exclude unrelated lines from scope checks.
 * @returns A supported body, an empty missing body, or None for unsupported scope.
 * @category utilities
 * @since 0.0.0
 */
export const modelsShellScope: {
  (content: string, name: string, variable: string): O.Option<string>;
  (name: string, variable: string): (content: string) => O.Option<string>;
} = dual(3, (content: string, name: string, variable: string): O.Option<string> => {
  if (!/^[A-Za-z_][A-Za-z0-9_-]*$/.test(name)) return O.none();
  const header = /^[ \t]*(?:function[ \t]+)?([A-Za-z_][A-Za-z0-9_-]*)[ \t]*(?:\([ \t]*\))?[ \t]*\{[ \t]*$/;
  const close = /^[ \t]*}[ \t]*$/;
  const lines = Str.split(content, "\n");
  const headers = A.getSomes(
    A.map(lines, (line, index) =>
      O.flatMap(O.fromNullishOr(header.exec(line)), (match) =>
        O.map(O.fromUndefinedOr(match[1]), (name) => Tuple.make(index, name))
      )
    )
  );
  const ends = A.getSomes(A.map(lines, (line, index) => (close.test(line) ? O.some(index) : O.none())));
  const aligned =
    A.length(headers) === A.length(ends) &&
    A.every(headers, ([start], index) => {
      const end = O.getOrElse(A.get(ends, index), () => -1);
      const next = O.getOrElse(
        O.map(A.get(headers, index + 1), ([start]) => start),
        () => A.length(lines)
      );
      return start < end && end < next;
    });
  const bounded = A.every(
    lines,
    (line) =>
      !unboundedShellScopeLine(line) ||
      header.test(line) ||
      close.test(line) ||
      (!Str.includes(variable)(Str.replace(/[\\'"]/g, "")(line)) && !Str.includes(name)(line))
  );
  if (!aligned || !bounded || A.length(A.filter(headers, ([, candidate]) => candidate === name)) > 1) return O.none();
  return O.match(
    A.findFirstIndex(headers, ([, candidate]) => candidate === name),
    {
      onNone: () => O.some(""),
      onSome: (index) =>
        O.flatMap(A.get(headers, index), ([start]) =>
          O.map(A.get(ends, index), (end) => A.join(A.slice(lines, { start: start + 1, end }), "\n"))
        ),
    }
  );
});

const span = (content: string, start: number, end: number, after: string) =>
  ModelsWriteSpan.make({
    start,
    end,
    before: Str.slice(start, end)(content),
    after,
  });

// Resolve regex captures with indices, never by searching for the captured value:
// a native file can contain the same token in several unowned places.
const captures = (content: string, pattern: RegExp, after: string): ReadonlyArray<ModelsWriteSpan> =>
  pipe(
    Str.matchAll(pattern)(content),
    A.fromIterable,
    A.map((match) =>
      pipe(
        O.fromUndefinedOr(match.indices),
        O.flatMap((indices) => O.fromUndefinedOr(indices[1])),
        O.map(([start, end]) => span(content, start, end, after))
      )
    ),
    A.getSomes
  );

const one = (
  spans: ReadonlyArray<ModelsWriteSpan>
): Effect.Effect<ReadonlyArray<ModelsWriteSpan>, ModelsLocatorError> =>
  A.length(spans) === 1 ? Effect.succeed(spans) : Effect.fail(error("Scalar locator is missing or ambiguous."));

const region = (content: string, start: number, end: number, pattern: RegExp, after: string) =>
  A.map(captures(Str.slice(start, end)(content), pattern, after), (entry) =>
    ModelsWriteSpan.make({
      ...entry,
      start: entry.start + start,
      end: entry.end + start,
    })
  );

const tableRegion = Effect.fn("Models.tableRegion")(
  (content: string, table: O.Option<string>): Effect.Effect<ReadonlyArray<number>, ModelsLocatorError> => {
    const headers = A.fromIterable(Str.matchAll(/^[ \t]*\[[^\n]+\][ \t]*(?:#[^\r\n]*)?\r?$/dgm)(content));
    if (O.isNone(table))
      return Effect.succeed([
        0,
        O.getOrElse(
          O.map(A.head(headers), (m) => O.getOrElse(O.fromUndefinedOr(m.index), () => 0)),
          () => Str.length(content)
        ),
      ]);
    const matches = A.filter(headers, (m) =>
      new RegExp(`^[ \\t]*\\[${Regex.escape(table.value)}\\][ \\t]*(?:#[^\\r\\n]*)?\\r?$`).test(m[0])
    );
    if (A.length(matches) !== 1) return Effect.fail(error("TOML table is missing or ambiguous."));
    const found = O.getOrThrow(A.head(matches));
    const end = O.getOrElse(
      O.map(
        A.findFirst(
          headers,
          (m) => O.getOrElse(O.fromUndefinedOr(m.index), () => 0) > O.getOrElse(O.fromUndefinedOr(found.index), () => 0)
        ),
        (m) => O.getOrElse(O.fromUndefinedOr(m.index), () => 0)
      ),
      () => Str.length(content)
    );
    return Effect.succeed([O.getOrElse(O.fromUndefinedOr(found.index), () => 0) + Str.length(found[0]), end]);
  }
);

const tomlSpans = Effect.fnUntraced(function* (
  content: string,
  key: string,
  table: O.Option<string>,
  after: string,
  expected: string
) {
  const parsed = yield* modelsParseToml(content);
  const leaf = modelsParsedLeaf(parsed, [...O.match(table, { onNone: () => [], onSome: Str.split(".") }), key]);
  if (O.contains(leaf, expected)) return [];
  const bounds = yield* tableRegion(content, table);
  const start = O.getOrElse(A.get(bounds, 0), () => 0);
  const end = O.getOrElse(A.get(bounds, 1), () => Str.length(content));
  const spans = yield* one(
    region(
      content,
      start,
      end,
      new RegExp(
        `^[ \\t]*${Regex.escape(key)}[ \\t]*=[ \\t]*("(?:\\\\.|[^"\\\\])*"|'[^']*'|[^#\\r\\n]+?)(?=[ \\t]*(?:#|\\r?$))`,
        "gmd"
      ),
      after
    )
  );
  return spans;
});

const jsonSpans = Effect.fnUntraced(function* (
  content: string,
  pointer: ReadonlyArray<string>,
  after: string,
  expected: string
) {
  const tree = yield* modelsParseJson(content);
  const node = A.reduce(pointer, O.some(tree), (current, segment) =>
    O.flatMap(current, (parent) => {
      const address: O.Option<string | number> =
        parent.type === "array" ? S.decodeOption(S.FiniteFromString)(segment) : O.some(segment);
      return O.flatMap(address, (key) => parent.find([key]));
    })
  );
  if (O.isNone(node) || node.value.type !== "string")
    return yield* error("JSON write requires an existing string at its primary pointer.");
  return node.value.value === expected
    ? []
    : [span(content, node.value.offset, node.value.offset + node.value.length, after)];
});

/**
 * Resolve the complete owned range set, rejecting missing or ambiguous addresses.
 * JSON fallbacks are read compatibility only: writes own the primary pointer.
 *
 * **Example** (Prepare a quoted model)
 *
 * ```ts
 * import { modelsWriteSpans } from "@beep/repo-cli/commands/Models/Models.spans"
 * import * as Effect from "effect/Effect"
 * console.log(typeof modelsWriteSpans === "function")
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsWriteSpans = Effect.fn("Models.writeSpans")(function* (
  content: string,
  request: ModelsLocatorWrite
): Effect.fn.Return<ReadonlyArray<ModelsWriteSpan>, ModelsLocatorError> {
  const checkOnly = modelsCheckOnlyFormat(request.locator);
  if (O.isSome(checkOnly)) return yield* error(`${checkOnly.value} targets are check-only; edit by hand.`);
  if (request.remove === true) {
    if (request.locator._tag !== "toml-top-level-key")
      return yield* error("Removal owns only a top-level TOML assignment.");
    const ownedKey = request.locator.key;
    const bounds = yield* tableRegion(content, O.none());
    const end = O.getOrElse(A.get(bounds, 1), () => Str.length(content));
    const parsed = yield* modelsParseToml(content).pipe(ModelsLocatorError.mapError("Invalid TOML removal target."));
    if (!R.has(parsed, ownedKey)) return [];
    if (P.isObjectOrArray(parsed[ownedKey])) return yield* error(unsupportedRemovalShape);
    // Match the source spelling, then use the TOML parser to establish key identity.
    const assignments = captures(
      Str.slice(0, end)(content),
      /(^[ \t]*(?:[\w-]+|"(?:\\.|[^"\\])*"|'[^']*')[ \t]*=[^\r\n]*(?:\r?\n|$))/dgm,
      ""
    );
    const matches = yield* Effect.filter(
      assignments,
      Effect.fnUntraced(function* (entry) {
        const key = Str.slice(
          0,
          O.getOrElse(Str.indexOf("=")(entry.before), () => 0)
        )(entry.before);
        const fields = yield* modelsParseToml(`${key}= true`).pipe(
          ModelsLocatorError.mapError("Cannot resolve TOML removal key.")
        );
        return O.contains(R.get(fields, ownedKey), true);
      })
    );
    return yield* one(matches);
  }
  const quoted = yield* encodeString(request.expected).pipe(ModelsLocatorError.mapError("Cannot encode scalar."));
  const expected = request.expected;
  return yield* Match.value(request.locator).pipe(
    Match.tag("toml-top-level-key", ({ key }) => tomlSpans(content, key, O.none(), quoted, expected)),
    Match.tag("toml-table-key", ({ key, table }) => tomlSpans(content, key, O.some(table), quoted, expected)),
    Match.tag("json-key", ({ pointer }) => jsonSpans(content, pointer, quoted, expected)),
    Match.orElse(() => Effect.fail(error("Target is check-only; edit by hand.")))
  );
});

/**
 * Apply disjoint, drift-fenced spans; every byte outside those ranges survives.
 *
 * **Example** (Preserve an unowned suffix)
 *
 * ```ts
 * import { modelsApplySpans } from "@beep/repo-cli/commands/Models/Models.spans"
 * import { ModelsEligibilityResult, ModelsWriteSpan } from "@beep/repo-cli/commands/Models/Models.manifest.schemas"
 * import * as Effect from "effect/Effect"
 * console.log(Effect.isEffect(modelsApplySpans("abc", [ModelsWriteSpan.make({ start: 1, end: 2, before: "b", after: "B" })])))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsApplySpans = Effect.fn("Models.applySpans")(function* (
  content: string,
  spans: ReadonlyArray<ModelsWriteSpan>
) {
  const ordered = A.sort(
    spans,
    Order.mapInput(Order.Number, (entry: ModelsWriteSpan) => entry.start)
  );
  let cursor = 0;
  let output = "";
  for (const entry of ordered) {
    if (
      entry.start < cursor ||
      entry.end < entry.start ||
      entry.end > Str.length(content) ||
      Str.slice(entry.start, entry.end)(content) !== entry.before
    )
      return yield* error("Owned spans overlap, leave the file, or have drifted.");
    output += Str.slice(cursor, entry.start)(content) + entry.after;
    cursor = entry.end;
  }
  return output + Str.slice(cursor)(content);
});
