/**
 * The per-grammar locator readers for `beep models`.
 *
 * **Details**
 *
 * One reader per {@link Locator} tag, each reading the text it is handed and
 * performing no I/O of its own. TOML and JSON readers parse the complete document before resolving a leaf.
 * Span editors retain original spelling after parsed-value comparisons. Shell, YAML and XML values are hints only;
 * consumers always require manual verification and never certify them clean.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, P, pipe, R, Str } from "@beep/utils";
import { YamlDocument } from "@beep/yaml/YamlDocument";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { constFalse, dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Regex from "effect/RegExp";
import * as Tuple from "effect/Tuple";
import { XMLParser } from "fast-xml-parser";
import { SyntaxValidator } from "fast-xml-validator";
import { getNodeValue } from "jsonc-parser";
import { ModelsLocatorError } from "./Models.errors.ts";
import { extractGeneratedBlock } from "./Models.render.ts";
import {
  modelsParsedLeaf,
  modelsParseJson,
  modelsParseToml,
  modelsShellScope,
  modelsShellWords,
} from "./Models.spans.ts";
import type { YamlPath } from "@beep/yaml/YamlEdit";
import type { YamlNode } from "@beep/yaml/YamlNode";
import type { Locator } from "./Models.manifest.schemas.ts";
import type { ModelsTargetFile } from "./Models.paths.ts";

const $I = $RepoCliId.create("commands/Models/Models.locator.service");

const firstMatch = (lines: ReadonlyArray<string>, pattern: RegExp): O.Option<string> =>
  pipe(
    lines,
    A.map((line) => O.fromNullishOr(pattern.exec(line))),
    O.firstSomeOf,
    O.flatMap((match) => O.fromNullishOr(match[1]))
  );

/**
 * Reads the value a locator currently points at.
 *
 * @category services
 * @since 0.0.0
 */
export interface ModelsLocatorReaderShape {
  readonly read: (file: ModelsTargetFile, locator: Locator) => Effect.Effect<O.Option<string>, ModelsLocatorError>;
}

/**
 * Per-grammar readers for every locator tag.
 *
 * **Example** (Describe a locator read)
 *
 * ```ts
 * import { LocatorBinding, ModelsLocatorReader, ModelsTargetFile } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsLocatorReader.use((reader) =>
 *   reader.read(
 *     ModelsTargetFile.make({ root: "repo", absolutePath: "/repo/a.ts", content: 'export const x = "y";' }),
 *     {
 *       _tag: "ts-literal",
 *       binding: LocatorBinding.make({ role: "qa.judge", surface: "codex-plugin", field: "model" }),
 *       render: { _tag: "verbatim" },
 *       symbol: "x"
 *     }
 *   )
 * )
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ModelsLocatorReader extends Context.Service<ModelsLocatorReader, ModelsLocatorReaderShape>()(
  $I`ModelsLocatorReader`
) {}

/**
 * Read shell drift without authorizing a shell write.
 *
 * **Details**
 *
 * Only one distinct literal can establish synchronization. Conflicting values
 * carry unsupported-form drift, so a joined display can never equal a scalar
 * expectation and hide an incorrect occurrence.
 *
 * **Example** (Read an assignment)
 *
 * ```ts
 * import { modelsReadShellAssign } from "@beep/repo-cli/commands/Models/Models.locator.service"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * console.log(Effect.isEffect(modelsReadShellAssign("MODEL=old", "MODEL", O.none())))
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const modelsReadShellAssign: {
  (content: string, variable: string, within: O.Option<string>): Effect.Effect<O.Option<string>>;
  (variable: string, within: O.Option<string>): (content: string) => Effect.Effect<O.Option<string>>;
} = dual(
  3,
  Effect.fn("Models.readShellAssign")(function* (content: string, variable: string, within: O.Option<string>) {
    // Scope extraction cannot erase an ambiguous containing shell document,
    // such as a function-looking block inside a here-document or open quote.
    const allWords = yield* modelsShellWords(content, variable);
    const words =
      O.isSome(within) && !A.some(allWords, Str.startsWith("Unsupported shell form"))
        ? yield* O.match(modelsShellScope(content, within.value, variable), {
            onNone: () =>
              Effect.succeed([
                `Unsupported shell form: line ${A.length(
                  Str.split(
                    Str.slice(
                      0,
                      O.getOrElse(Str.indexOf(variable)(content), () => 0)
                    )(content),
                    "\n"
                  )
                )}; ambiguous function scope`,
              ]),
            onSome: (body) => modelsShellWords(body, variable),
          })
        : allWords;
    const unsupported = A.findFirst(words, Str.startsWith("Unsupported shell form"));
    if (O.isSome(unsupported)) return unsupported;
    return pipe(
      words,
      A.dedupe,
      A.match({
        onEmpty: O.none<string>,
        onNonEmpty: (values) =>
          O.some(
            A.length(values) === 1
              ? A.headNonEmpty(values)
              : `Unsupported shell form: conflicting values ${A.join(values, ", ")}`
          ),
      })
    );
  })
);

const readTsLiteral = (content: string, symbol: string): O.Option<string> =>
  firstMatch([content], new RegExp(`export\\s+const\\s+${Regex.escape(symbol)}\\s*(?::[^=]+)?=\\s*"([^"]*)"`));

// Literal delimiters keep this read-only locator bounded to named examples
// and doctrine spellings (R9). Keep every distinct value, so a mixed file
// cannot look current just because its first occurrence is current.
const readLineValues = (content: string, linePrefix: string, before: string, after: string): O.Option<string> => {
  const valuesOnLine = (line: string): ReadonlyArray<string> => {
    const values: Array<string> = [];
    let cursor = 0;
    const opening = new RegExp(Regex.escape(before), "g");
    const closing = new RegExp(Regex.escape(after), "g");
    while (cursor < Str.length(line)) {
      opening.lastIndex = cursor;
      const openingMatch = opening.exec(line);
      if (openingMatch === null) break;
      const valueStart = openingMatch.index + Str.length(before);
      closing.lastIndex = valueStart;
      const closingMatch = closing.exec(line);
      if (closingMatch === null) break;
      const end = closingMatch.index;
      values.push(Str.slice(valueStart, end)(line));
      cursor = end + Str.length(after);
    }
    return values;
  };
  const values = pipe(
    Str.split(content, "\n"),
    A.filter(Str.startsWith(linePrefix)),
    A.flatMap(valuesOnLine),
    A.dedupe
  );
  return A.isReadonlyArrayNonEmpty(values) ? O.some(A.join(values, ", ")) : O.none();
};

const isScalar = P.some<unknown>([P.isString, P.isNumber, P.isBoolean]);

const scalarText = (leaf: unknown): O.Option<string> => (isScalar(leaf) ? O.some(`${leaf}`) : O.none<string>());

const childrenOf = (node: unknown): O.Option<ReadonlyArray<unknown>> =>
  A.isArray(node) ? O.some(node) : O.none<ReadonlyArray<unknown>>();

const fieldsOf = (node: unknown): O.Option<Readonly<Record<string, unknown>>> =>
  P.isObjectOrArray(node) ? O.some(node as Readonly<Record<string, unknown>>) : O.none();

const walkPointer = (value: unknown, pointer: ReadonlyArray<string>): O.Option<string> =>
  O.filter(modelsParsedLeaf(value, pointer), P.isString);

const readTomlPath = (text: string, path: ReadonlyArray<string>) =>
  modelsParseToml(text).pipe(
    Effect.map((value) => walkPointer(value, path)),
    Effect.orElseSucceed(() => O.some("Unsupported TOML form: invalid document."))
  );

const readJsonPointer = (
  text: string,
  pointer: ReadonlyArray<string>,
  fallbacks: ReadonlyArray<ReadonlyArray<string>>
) =>
  modelsParseJson(text).pipe(
    Effect.map((tree) => {
      const json = getNodeValue(tree);
      return A.reduce(fallbacks, walkPointer(json, pointer), (found, fallback) =>
        O.orElse(found, () => walkPointer(json, fallback))
      );
    }),
    Effect.catch((cause) =>
      Effect.succeedSome(
        Str.startsWith("Unsupported JSON form:")(cause.message)
          ? cause.message
          : `Unsupported JSON form: ${cause.message}`
      )
    )
  );

// Reconcile every textual name occurrence with ranges independently established
// by a simple-form reader. Comments and quoted name tokens deliberately fail.
const unsupportedOccurrence = (
  content: string,
  names: ReadonlyArray<string>,
  ranges: ReadonlyArray<readonly [number, number]>,
  format: string
): O.Option<string> => {
  const unmatched = A.findFirst(
    A.flatMap(A.dedupe(names), (name) => A.fromIterable(Str.matchAll(new RegExp(Regex.escape(name), "g"))(content))),
    (match) =>
      !A.some(ranges, ([start, end]) => start <= (match.index ?? 0) && (match.index ?? 0) + Str.length(match[0]) <= end)
  );
  return O.map(
    unmatched,
    (match) => `Unsupported ${format} form: line ${A.length(Str.split(Str.slice(0, match.index)(content), "\n"))}`
  );
};

// Only simple block mappings are modeled: block maps with plain scalar keys
// and non-block scalars, with no anchor or tag. Sequences and aliases are not.
const isSimpleYamlNode = (node: YamlNode): boolean =>
  Match.valueTags(node, {
    YamlMap: (map) =>
      map.style === "block" &&
      P.isUndefined(map.anchor) &&
      P.isUndefined(map.tag) &&
      A.every(map.items, (pair) => pair.key._tag === "YamlScalar" && pair.key.style === "plain"),
    YamlScalar: (scalar) =>
      scalar.style !== "block-literal" &&
      scalar.style !== "block-folded" &&
      P.isUndefined(scalar.anchor) &&
      P.isUndefined(scalar.tag),
    YamlSeq: constFalse,
    YamlAlias: constFalse,
  });

// Whether a composed YAML subtree holds only the simple forms, mapping keys
// included (the nodes the retired `visit` check reached). Only a simple map has
// children to descend into, so the walk stops at the first unsupported node.
const isSimpleYamlTree = (node: YamlNode): boolean =>
  isSimpleYamlNode(node) &&
  (node._tag !== "YamlMap" ||
    A.every(
      node.items,
      (pair) => isSimpleYamlTree(pair.key) && (P.isNull(pair.value) || isSimpleYamlTree(pair.value))
    ));

const yamlNodeAt = (document: YamlDocument, path: YamlPath): O.Option<YamlNode> =>
  pipe(
    O.fromNullishOr(document.contents),
    O.flatMap((root) => root.find(path))
  );

// The source range of every key along `path`, in one descent from `node`; it
// ends at the first segment that is not a key of a mapping.
const yamlKeyRanges = (node: YamlNode | null, path: YamlPath): ReadonlyArray<readonly [number, number]> =>
  pipe(
    A.head(path),
    O.flatMap((segment) =>
      P.isNotNull(node) && node._tag === "YamlMap"
        ? A.findFirst(node.items, ({ key }) => key._tag === "YamlScalar" && key.value === segment)
        : O.none()
    ),
    O.match({
      onNone: A.empty<readonly [number, number]>,
      onSome: ({ key, value }) =>
        A.prepend(yamlKeyRanges(value, A.drop(path, 1)), Tuple.make(key.offset, key.offset + key.length)),
    })
  );

const readYamlPath = (content: string, path: YamlPath): Effect.Effect<O.Option<string>> =>
  YamlDocument.parseAll(content).pipe(
    Effect.option,
    Effect.map((documents) => {
      const names = A.map(path, (segment) => `${segment}`);
      // No aliases, anchors, tags, flow collections, complex keys, block
      // scalars or multiple documents; every reported diagnostic fails closed.
      const document = O.flatMap(documents, (parsed) => (A.length(parsed) === 1 ? A.head(parsed) : O.none()));
      const supported = O.filter(
        document,
        (parsed) =>
          A.isReadonlyArrayEmpty(parsed.errors) &&
          A.isReadonlyArrayEmpty(parsed.warnings) &&
          (P.isNull(parsed.contents) || isSimpleYamlTree(parsed.contents))
      );
      const ranges = O.match(supported, {
        onNone: A.empty<readonly [number, number]>,
        onSome: (parsed) => yamlKeyRanges(parsed.contents, path),
      });
      const unsupported = unsupportedOccurrence(content, names, ranges, "YAML");
      if (O.isSome(unsupported)) return unsupported;
      return pipe(
        document,
        O.flatMap((parsed) => yamlNodeAt(parsed, path)),
        O.flatMap((node) => (node._tag === "YamlScalar" ? scalarText(node.value) : O.none<string>()))
      );
    })
  );

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  parseAttributeValue: false,
  processEntities: true,
});

const selectorPattern = /^([A-Za-z0-9_:.-]+)\[([A-Za-z0-9_:.-]+)="([^"]*)"\]$/;

interface AttributeQuery {
  readonly attribute: string;
  readonly matchAttribute: string;
  readonly matchValue: string;
  readonly tag: string;
}

const attributeOfCandidate = (candidate: unknown, query: AttributeQuery): O.Option<string> =>
  pipe(
    fieldsOf(candidate),
    O.filter((fields) => fields[`@_${query.matchAttribute}`] === query.matchValue),
    O.flatMap((fields) => O.fromNullishOr(fields[`@_${query.attribute}`])),
    O.flatMap(scalarText)
  );

const findAttributes = (node: unknown, query: AttributeQuery): ReadonlyArray<string> => {
  const children = childrenOf(node);
  if (O.isSome(children)) return A.flatMap(children.value, (child) => findAttributes(child, query));
  return O.match(fieldsOf(node), {
    onNone: () => [],
    onSome: (fields) =>
      A.flatMap(R.toEntries(fields), ([key, value]) =>
        key === query.tag
          ? A.getSomes(
              A.map(
                O.getOrElse(childrenOf(value), (): ReadonlyArray<unknown> => [value]),
                (candidate) => attributeOfCandidate(candidate, query)
              )
            )
          : findAttributes(value, query)
      ),
  });
};

const xmlAttributeRanges = (
  token: string,
  offset: number,
  ownsElement: boolean,
  matchAttribute: string,
  attribute: string
) => {
  const ranges: Array<readonly [number, number]> = [];
  const attributes = /([A-Za-z_][\w:.-]*)\s*=\s*("[^"<]*"|'[^'<]*')/g;
  for (const candidate of Str.matchAll(attributes)(token)) {
    if (candidate[1] !== matchAttribute && candidate[1] !== attribute) continue;
    const start = offset + (candidate.index ?? 0);
    ranges.push([start, start + Str.length(candidate[1])]);
    if (ownsElement) ranges.push([start, start + Str.length(candidate[0])]);
  }
  return ranges;
};

const xmlOccurrenceRanges = (content: string, tag: string, matchAttribute: string, attribute: string) => {
  const ranges: Array<readonly [number, number]> = [];
  const tokens = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<[^>]*>/g;
  const simple = /^<\/?[A-Za-z_][\w:.-]*(?:\s+[A-Za-z_][\w:.-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>$/;
  for (const token of Str.matchAll(tokens)(content)) {
    if (!simple.test(token[0])) continue;
    const offset = token.index ?? 0;
    const element = /^<\/?([A-Za-z_][\w:.-]*)(?=[\s/>])/.exec(token[0]);
    const ownsElement = element?.[1] === tag;
    if (ownsElement) {
      const start = offset + O.getOrThrow(Str.indexOf(tag)(token[0]));
      ranges.push([start, start + Str.length(tag)]);
    }
    ranges.push(...xmlAttributeRanges(token[0], offset, ownsElement, matchAttribute, attribute));
  }
  return ranges;
};

const readXmlAttribute = Effect.fnUntraced(function* (
  file: ModelsTargetFile,
  elementSelector: string,
  attribute: string
) {
  const selector = selectorPattern.exec(elementSelector);
  if (selector === null) {
    return yield* ModelsLocatorError.make({
      message: `Unsupported element selector "${elementSelector}"; expected tag[attribute="value"].`,
      path: file.absolutePath,
    });
  }

  const tag = selector[1] ?? "";
  const matchAttribute = selector[2] ?? "";
  const matchValue = selector[3] ?? "";
  const names = [tag, matchAttribute, matchValue, attribute];
  // Complete simple tags only: comments, CDATA, processing instructions,
  // prefix/qualified names and arbitrary quoted data cannot account for ownership.
  const ranges = xmlOccurrenceRanges(file.content, tag, matchAttribute, attribute);
  const unsupported = unsupportedOccurrence(file.content, names, ranges, "XML");
  if (O.isSome(unsupported)) return unsupported;
  if (SyntaxValidator.validate(file.content) !== true) return O.some("Unsupported XML form: line 1");
  const parsed = yield* Effect.try({
    try: () => xmlParser.parse(file.content) as unknown,
    catch: () => ModelsLocatorError.make({ message: "Unsupported XML form: line 1", path: file.absolutePath }),
  }).pipe(Effect.option);
  if (O.isNone(parsed)) return O.some("Unsupported XML form: line 1");
  const values = A.dedupe(findAttributes(parsed.value, { tag, matchAttribute, matchValue, attribute }));
  return A.length(values) > 1
    ? O.some(`Unsupported XML form: line 1; conflicting values ${A.join(values, ", ")}`)
    : A.head(values);
});

/**
 * Pointer segment that stands for the bound model id.
 *
 * **Details**
 *
 * A JSON pointer that addresses a per-model entry (Claude Code's
 * `modelSettings[<model>]`) writes this token instead of a literal id, so the
 * key follows the binding when the seed or an adopted manifest moves it.
 * {@link bindLocatorModel} substitutes it before the read.
 *
 * **Example** (Address the bound model's effort)
 *
 * ```ts
 * import { BOUND_MODEL_SEGMENT } from "@beep/repo-cli/commands/Models"
 *
 * console.log(["modelSettings", BOUND_MODEL_SEGMENT, "effortLevel"].join(".")) // "modelSettings.{model}.effortLevel"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BOUND_MODEL_SEGMENT = "{model}";

const bindSegments = (segments: ReadonlyArray<string>, modelId: string): ReadonlyArray<string> =>
  A.map(segments, (segment) => (segment === BOUND_MODEL_SEGMENT ? modelId : segment));

/**
 * Resolve {@link BOUND_MODEL_SEGMENT} in a locator's JSON pointers to the bound model id.
 *
 * **Details**
 *
 * Only `json-key` locators carry pointers; every other locator is returned
 * unchanged. The check calls this with the binding the locator names, so a
 * per-model pointer always reads the entry the client applies.
 *
 * **Example** (Bind a per-model effort pointer)
 *
 * ```ts
 * import { BOUND_MODEL_SEGMENT, bindLocatorModel, Locator } from "@beep/repo-cli/commands/Models"
 * import * as S from "effect/Schema"
 *
 * const locator = S.decodeUnknownSync(Locator)({
 *   _tag: "json-key",
 *   binding: { role: "orchestrator", surface: "claude-code", field: "effort" },
 *   render: { _tag: "verbatim" },
 *   pointer: ["modelSettings", BOUND_MODEL_SEGMENT, "effortLevel"],
 *   fallbacks: [["effortLevel"]],
 * })
 * const bound = bindLocatorModel(locator, "claude-opus-5-6")
 * console.log(bound._tag === "json-key" ? bound.pointer.join(".") : "") // "modelSettings.claude-opus-5-6.effortLevel"
 * ```
 *
 * @param locator - The locator to resolve.
 * @param modelId - The model id of the binding the locator names.
 * @returns The locator with every bound-model segment replaced.
 * @category utilities
 * @since 0.0.0
 */
export const bindLocatorModel: {
  (modelId: string): (locator: Locator) => Locator;
  (locator: Locator, modelId: string): Locator;
} = dual(
  2,
  (locator: Locator, modelId: string): Locator =>
    locator._tag === "json-key"
      ? {
          ...locator,
          pointer: bindSegments(locator.pointer, modelId),
          fallbacks: A.map(locator.fallbacks, (fallback) => bindSegments(fallback, modelId)),
        }
      : locator
);

/**
 * Read one model locator from supplied text without filesystem access.
 *
 * **Example** (Read a plain YAML scalar)
 *
 * ```ts
 * import { modelsReadLocator } from "@beep/repo-cli/commands/Models/Models.locator.service"
 * import { LocatorBinding, ModelsTargetFile } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 * const read = modelsReadLocator(
 *   ModelsTargetFile.make({ root: "home", absolutePath: "synthetic.yaml", content: "model: old\n" }),
 *   { _tag: "yaml-path", path: ["model"], render: { _tag: "verbatim" },
 *     binding: LocatorBinding.make({ role: "codex.heavy", surface: "codex-cli", field: "model" }) }
 * )
 * console.log(Effect.isEffect(read)) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const modelsReadLocator = Effect.fn("Models.readLocator")(function* (file: ModelsTargetFile, locator: Locator) {
  return yield* Match.value(locator).pipe(
    Match.tag("md-generated-block", ({ blockId }) => Effect.succeed(extractGeneratedBlock(file.content, blockId))),
    Match.tag("toml-top-level-key", ({ key }) => readTomlPath(file.content, [key])),
    Match.tag("toml-table-key", ({ table, key }) => readTomlPath(file.content, [...Str.split(table, "."), key])),
    Match.tag("yaml-path", ({ path: yamlPath }) => readYamlPath(file.content, yamlPath)),
    Match.tag("json-key", ({ pointer, fallbacks }) => readJsonPointer(file.content, pointer, fallbacks)),
    Match.tag("env-key", ({ key }) => modelsReadShellAssign(file.content, key, O.none())),
    Match.tag("shell-assign", ({ variable, within }) => modelsReadShellAssign(file.content, variable, within)),
    Match.tag("xml-attribute", ({ elementSelector, attribute }) => readXmlAttribute(file, elementSelector, attribute)),
    Match.tag("xml-escaped-json-attribute", ({ elementSelector, attribute, jsonPointer }) =>
      readXmlAttribute(file, elementSelector, attribute).pipe(
        Effect.flatMap(
          O.match({
            onNone: () => Effect.succeedNone,
            onSome: (raw) =>
              Str.startsWith("Unsupported XML form")(raw)
                ? Effect.succeedSome(raw)
                : readJsonPointer(raw, jsonPointer, []),
          })
        )
      )
    ),
    Match.tag("ts-literal", ({ symbol }) => Effect.succeed(readTsLiteral(file.content, symbol))),
    Match.tag("line-value", ({ linePrefix, before, after }) =>
      Effect.succeed(readLineValues(file.content, linePrefix, before, after))
    ),
    Match.exhaustive
  );
});

/**
 * Live locator reader; it reads text it is handed and performs no I/O.
 *
 * **Example** (Confirm the layer)
 *
 * ```ts
 * import { ModelsLocatorReaderLive } from "@beep/repo-cli/commands/Models"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(ModelsLocatorReaderLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ModelsLocatorReaderLive: Layer.Layer<ModelsLocatorReader> = Layer.succeed(
  ModelsLocatorReader,
  ModelsLocatorReader.of({ read: modelsReadLocator })
);
