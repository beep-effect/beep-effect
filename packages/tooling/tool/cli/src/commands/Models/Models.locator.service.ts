/**
 * The per-grammar locator readers for `beep models`.
 *
 * **Details**
 *
 * One reader per {@link Locator} tag, each reading the text it is handed and
 * performing no I/O of its own. Every reader is line- or node-anchored rather
 * than whole-file, so a future writer can edit in place without rewriting a
 * file a machine appends to.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { A, O, P, pipe, R, Str } from "@beep/utils";
import { Effect, Layer, Match } from "effect";
import * as Context from "effect/Context";
import { XMLParser } from "fast-xml-parser";
import { parseDocument } from "yaml";
import { ModelsLocatorError } from "./Models.errors.ts";
import { parseJsonText } from "./Models.paths.ts";
import { extractGeneratedBlock } from "./Models.render.ts";
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
 * import { ModelsLocatorReader } from "@beep/repo-cli/commands/Models"
 * import * as Effect from "effect/Effect"
 *
 * const program = ModelsLocatorReader.use((reader) =>
 *   reader.read(
 *     { root: "repo", absolutePath: "/repo/a.ts", content: 'export const x = "y";' },
 *     {
 *       _tag: "ts-literal",
 *       binding: { role: "qa.judge", surface: "codex-plugin", field: "model" },
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

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const unquote = (value: string): string =>
  pipe(Str.trim(value), (trimmed) =>
    (Str.startsWith('"')(trimmed) && Str.endsWith('"')(trimmed)) ||
    (Str.startsWith("'")(trimmed) && Str.endsWith("'")(trimmed))
      ? Str.slice(1, Str.length(trimmed) - 1)(trimmed)
      : trimmed
  );

const isTableHeader = (line: string): boolean => Str.startsWith("[")(Str.trim(line));

const readKeyFromLines = (lines: ReadonlyArray<string>, key: string): O.Option<string> =>
  O.map(firstMatch(lines, new RegExp(`^\\s*${escapeRegExp(key)}\\s*=\\s*(.+?)\\s*$`)), unquote);

const topLevelLines = (content: string): ReadonlyArray<string> =>
  pipe(
    Str.split(content, "\n"),
    A.takeWhile((line) => !isTableHeader(line))
  );

const tableLines = (content: string, table: string): ReadonlyArray<string> =>
  pipe(
    Str.split(content, "\n"),
    A.dropWhile((line) => Str.trim(line) !== `[${table}]`),
    A.drop(1),
    A.takeWhile((line) => !isTableHeader(line))
  );

const functionLines = (content: string, name: string): ReadonlyArray<string> => {
  const opener = new RegExp(`^\\s*(?:function\\s+)?${escapeRegExp(name)}\\s*(?:\\(\\s*\\))?\\s*\\{`);
  return pipe(
    Str.split(content, "\n"),
    A.dropWhile((line) => !opener.test(line)),
    A.drop(1),
    A.takeWhile((line) => line !== "}")
  );
};

const readShellAssign = (content: string, variable: string, within: O.Option<string>): O.Option<string> =>
  firstMatch(
    pipe(
      within,
      O.map((name) => functionLines(content, name)),
      O.getOrElse(() => Str.split(content, "\n"))
    ),
    // `--model 'grok-4.6'` and `KEY=value` are the same shape once the
    // separator is allowed to be a space: the flag or variable name, then the
    // value.
    new RegExp(`${escapeRegExp(variable)}[= ]['"]?([^'"\\s]+)`)
  );

const readEnvKey = (content: string, key: string): O.Option<string> =>
  O.map(firstMatch(Str.split(content, "\n"), new RegExp(`^\\s*(?:export\\s+)?${escapeRegExp(key)}=(.*)$`)), unquote);

const readTsLiteral = (content: string, symbol: string): O.Option<string> =>
  firstMatch([content], new RegExp(`export\\s+const\\s+${escapeRegExp(symbol)}\\s*(?::[^=]+)?=\\s*"([^"]*)"`));

const isScalar = P.some<unknown>([P.isString, P.isNumber, P.isBoolean]);

const scalarText = (leaf: unknown): O.Option<string> => (isScalar(leaf) ? O.some(`${leaf}`) : O.none<string>());

const childrenOf = (node: unknown): O.Option<ReadonlyArray<unknown>> =>
  A.isArray(node) ? O.some(node) : O.none<ReadonlyArray<unknown>>();

const fieldsOf = (node: unknown): O.Option<Readonly<Record<string, unknown>>> =>
  P.isObjectOrArray(node) ? O.some(node as Readonly<Record<string, unknown>>) : O.none();

const walkPointer = (value: unknown, pointer: ReadonlyArray<string>): O.Option<string> =>
  pipe(
    pointer,
    A.reduce(O.some(value), (current: O.Option<unknown>, segment) =>
      O.flatMap(current, (node) => O.flatMap(fieldsOf(node), (fields) => O.fromNullishOr(fields[segment])))
    ),
    O.flatMap(scalarText)
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

const findAttribute = (node: unknown, query: AttributeQuery): O.Option<string> =>
  pipe(
    childrenOf(node),
    O.map((children) =>
      pipe(
        children,
        A.map((child) => findAttribute(child, query)),
        O.firstSomeOf
      )
    ),
    O.orElse(() =>
      O.map(fieldsOf(node), (fields) =>
        pipe(
          R.toEntries(fields),
          A.map(([key, value]) =>
            key === query.tag
              ? pipe(
                  O.getOrElse(childrenOf(value), (): ReadonlyArray<unknown> => [value]),
                  A.map((candidate) => attributeOfCandidate(candidate, query)),
                  O.firstSomeOf
                )
              : findAttribute(value, query)
          ),
          O.firstSomeOf
        )
      )
    ),
    O.flatten
  );

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

  const parsed = yield* Effect.try({
    try: () => xmlParser.parse(file.content) as unknown,
    catch: (cause) =>
      ModelsLocatorError.make({
        message: `Failed to parse XML in ${file.absolutePath}.`,
        path: file.absolutePath,
        cause,
      }),
  });

  return findAttribute(parsed, {
    tag: selector[1] ?? "",
    matchAttribute: selector[2] ?? "",
    matchValue: selector[3] ?? "",
    attribute,
  });
});

const makeLocatorReader = (): ModelsLocatorReaderShape => ({
  read: Effect.fnUntraced(function* (file: ModelsTargetFile, locator: Locator) {
    return yield* Match.value(locator).pipe(
      Match.tag("md-generated-block", ({ blockId }) => Effect.succeed(extractGeneratedBlock(file.content, blockId))),
      Match.tag("toml-top-level-key", ({ key }) => Effect.succeed(readKeyFromLines(topLevelLines(file.content), key))),
      Match.tag("toml-table-key", ({ table, key }) =>
        Effect.succeed(readKeyFromLines(tableLines(file.content, table), key))
      ),
      Match.tag("yaml-path", ({ path: yamlPath }) =>
        Effect.try({
          try: () => parseDocument(file.content).getIn([...yamlPath]) as unknown,
          catch: (cause) =>
            ModelsLocatorError.make({
              message: `Failed to parse YAML in ${file.absolutePath}.`,
              path: file.absolutePath,
              cause,
            }),
        }).pipe(Effect.map(scalarText))
      ),
      Match.tag("json-key", ({ pointer }) =>
        Effect.succeed(
          pipe(
            parseJsonText(file.content),
            O.flatMap((json) => walkPointer(json, pointer))
          )
        )
      ),
      Match.tag("env-key", ({ key }) => Effect.succeed(readEnvKey(file.content, key))),
      Match.tag("shell-assign", ({ variable, within }) =>
        Effect.succeed(readShellAssign(file.content, variable, within))
      ),
      Match.tag("xml-attribute", ({ elementSelector, attribute }) =>
        readXmlAttribute(file, elementSelector, attribute)
      ),
      Match.tag("xml-escaped-json-attribute", ({ elementSelector, attribute, jsonPointer }) =>
        readXmlAttribute(file, elementSelector, attribute).pipe(
          Effect.map(
            O.flatMap((raw) =>
              pipe(
                parseJsonText(raw),
                O.flatMap((json) => walkPointer(json, jsonPointer))
              )
            )
          )
        )
      ),
      Match.tag("ts-literal", ({ symbol }) => Effect.succeed(readTsLiteral(file.content, symbol))),
      Match.exhaustive
    );
  }),
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
  ModelsLocatorReader.of(makeLocatorReader())
);
