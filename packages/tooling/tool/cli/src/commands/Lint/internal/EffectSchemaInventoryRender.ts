/**
 * Deterministic JSONL, digest, and `INDEX.md` rendering for the schema inventory fixture, plus
 * the byte comparison behind `--check`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Sha256HexFromBytes } from "@beep/schema";
import { A, Str } from "@beep/utils";
import { Effect, HashMap, HashSet, Number as Num, Order, pipe } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import {
  EffectSchemaInventoryDrift,
  EffectSchemaInventoryFile,
  EffectSchemaInventoryFixturePath,
  EffectSchemaInventoryIndexHeader,
  EffectSchemaInventoryReceipt,
  EffectSchemaInventoryRendered,
  encodeEffectSchemaInventoryRowJson,
} from "../EffectSchemaInventory.schemas.ts";
import { EffectSchemaInventoryError } from "../Lint.errors.ts";
import type { Sha256Hex } from "@beep/schema";
import type {
  EffectSchemaInventoryExtraction,
  EffectSchemaInventoryModuleRows,
  EffectSchemaInventoryPin,
  EffectSchemaInventoryRow,
} from "../EffectSchemaInventory.schemas.ts";

/** Module list source named in the index header. */
const MODULE_LIST_PATH = "packages/tooling/tool/cli/src/commands/Lint/internal/EffectSchemaInventoryModules.ts";

/** File name of the generated index inside the fixture directory. */
const INDEX_FILE = "INDEX.md";

const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encoder = new TextEncoder();
const localeOrder: Order.Order<string> = Order.make((self, that) => Str.localeCompare(that, ["en"])(self));

/**
 * JSONL file name of one module: its slug plus `.jsonl`.
 *
 * **Example** (Name a module's rows file)
 *
 * ```ts
 * import { effectSchemaInventoryJsonlName } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(effectSchemaInventoryJsonlName("effect-SchemaIssue")) // "effect-SchemaIssue.jsonl"
 * ```
 *
 * @param slug - Module slug from the module list.
 * @returns The file name inside the fixture directory.
 * @category utilities
 * @since 0.0.0
 */
export const effectSchemaInventoryJsonlName = (slug: string): string => `${slug}.jsonl`;

/**
 * UTF-8 byte length of a JSONL body.
 *
 * **Example** (Count a multi-byte character)
 *
 * ```ts
 * import { effectSchemaInventoryByteLength } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(effectSchemaInventoryByteLength("…")) // 3
 * ```
 *
 * @param text - JSONL body as rendered or read from disk.
 * @returns Its UTF-8 byte length, the unit of the index's Bytes column.
 * @category utilities
 * @since 0.0.0
 */
export const effectSchemaInventoryByteLength = (text: string): number => encoder.encode(text).byteLength;

/**
 * Render one module's rows as JSONL: one encoded row per line, newline-terminated, empty for no rows.
 *
 * **Example** (Render an empty module)
 *
 * ```ts
 * import { renderEffectSchemaInventoryJsonl } from "@beep/repo-cli/commands/Lint"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(renderEffectSchemaInventoryJsonl([])).then((body) => console.log(body === "")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderEffectSchemaInventoryJsonl = Effect.fn("EffectSchemaInventoryRender.jsonl")(function* (
  rows: ReadonlyArray<EffectSchemaInventoryRow>
) {
  const lines = yield* Effect.forEach(rows, (row) => encodeEffectSchemaInventoryRowJson(row)).pipe(
    EffectSchemaInventoryError.mapError("Unable to encode schema inventory rows")
  );
  return A.match(lines, { onEmpty: () => "", onNonEmpty: (nonEmpty) => `${A.join(nonEmpty, "\n")}\n` });
});

/**
 * Row digest recorded in `INDEX.md`: SHA-256 over the module JSONL bodies concatenated in
 * module-list order.
 *
 * **Details**
 *
 * Equivalent to piping the table's JSONL files, in table order, through `sha256sum`. An empty
 * module contributes no bytes.
 *
 * **Example** (Digest no bytes)
 *
 * ```ts
 * import { digestEffectSchemaInventoryJsonl } from "@beep/repo-cli/commands/Lint"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * Effect.runPromise(digestEffectSchemaInventoryJsonl([]).pipe(Effect.provide(NodeServices.layer))).then(console.log)
 * // "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const digestEffectSchemaInventoryJsonl = Effect.fn("EffectSchemaInventoryRender.digest")(function* (
  bodies: ReadonlyArray<string>
) {
  return yield* hashBytes(encoder.encode(A.join(bodies, ""))).pipe(
    EffectSchemaInventoryError.mapError("Unable to digest schema inventory rows")
  );
});

type GroupCount = readonly [key: string, count: number];

const groupCounts = (keys: ReadonlyArray<string>): ReadonlyArray<GroupCount> =>
  A.sort(
    A.map(R.toEntries(A.groupBy(keys, (key) => key)), ([key, members]): GroupCount => [key, members.length]),
    Order.mapInput(localeOrder, ([key]: GroupCount) => key)
  );

const kindCounts = (rows: ReadonlyArray<EffectSchemaInventoryRow>): ReadonlyArray<GroupCount> =>
  groupCounts(A.map(rows, (row) => row.kind));

const categoryCounts = (rows: ReadonlyArray<EffectSchemaInventoryRow>): ReadonlyArray<GroupCount> =>
  groupCounts(A.map(rows, (row) => O.getOrElse(row.category, () => "(untagged)")));

const renderCounts = (counts: ReadonlyArray<GroupCount>): string =>
  A.join(
    A.map(counts, ([key, count]) => `${key}: ${count}`),
    "; "
  );

const topCategoryOrder = Order.combine(
  Order.mapInput(Order.flip(Order.Number), ([, count]: GroupCount) => count),
  Order.mapInput(localeOrder, ([key]: GroupCount) => key)
);

/**
 * Render the committed `INDEX.md` from the pin, parser, digest, and each module's rows and bytes.
 *
 * **Details**
 *
 * The hosted fixture test calls this with the committed rows and compares bytes, so every total,
 * kind cell, and category cell in the index is re-derived in CI without an Effect checkout.
 *
 * **Example** (Render an index for no modules)
 *
 * ```ts
 * import { renderEffectSchemaInventoryIndex } from "@beep/repo-cli/commands/Lint"
 * import { Sha256Hex } from "@beep/schema/Sha256"
 *
 * const index = renderEffectSchemaInventoryIndex({
 *   pin: "df77fff9396fe31de72d1947ecb5b74f8cee89e1",
 *   parser: "6.0.2",
 *   digest: Sha256Hex.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"),
 *   modules: []
 * })
 * console.log(index.startsWith("# Schema inventory index")) // true
 * ```
 *
 * @param input - Pin, parser version, row digest, and each module's rows with its JSONL byte length, in module-list order.
 * @returns The exact `INDEX.md` text, ending in one newline.
 * @category formatting
 * @since 0.0.0
 */
export const renderEffectSchemaInventoryIndex = (input: {
  readonly pin: EffectSchemaInventoryPin;
  readonly parser: string;
  readonly digest: Sha256Hex;
  readonly modules: ReadonlyArray<readonly [rows: EffectSchemaInventoryModuleRows, bytes: number]>;
}): string => {
  const totalRows = A.reduce(input.modules, 0, (sum, [entry]) => sum + entry.rows.length);
  const totalBytes = A.reduce(input.modules, 0, (sum, [, bytes]) => sum + bytes);
  const top = pipe(
    A.findFirst(input.modules, ([entry]) => entry.module.module === "effect/Schema"),
    O.map(([entry]) =>
      pipe(
        categoryCounts(entry.rows),
        A.filter(([key]) => key !== "(untagged)"),
        A.sort(topCategoryOrder),
        A.take(15)
      )
    ),
    O.getOrElse(A.empty<GroupCount>)
  );
  const totalsRows = A.map(
    input.modules,
    ([entry, bytes]) =>
      `| [${entry.module.module}](${effectSchemaInventoryJsonlName(entry.module.slug)}) | ${entry.module.importable ? "yes" : "no"} | ${entry.rows.length} | ${bytes} |\n`
  );
  const kindRows = A.map(
    input.modules,
    ([entry]) =>
      `| ${entry.module.module} | ${renderCounts(kindCounts(entry.rows))} | ${renderCounts(categoryCounts(entry.rows))} |\n`
  );
  return A.join(
    [
      "# Schema inventory index\n\n",
      `Pin: \`${input.pin}\` (inventoryPin: root package.json catalog \`effect\`; sources read with \`git -C .repos/effect show <pin>:<file>\`). TypeScript parser: \`${input.parser}\`. Counts include direct public members at one level; barrel namespace re-exports are one row each and are not expanded. Module list: \`${MODULE_LIST_PATH}\`.\n\n`,
      `Row digest: \`${input.digest}\` (SHA-256 over the module JSONL files concatenated byte for byte in Module totals order).\n\n`,
      "Regenerate from repo root (offline):\n\n```sh\nbun run beep lint effect-schema-inventory --write\n```\n\n",
      "## Module totals\n\n",
      `Count verification: \`rg --no-ignore --no-heading -F -c '"sha":' ${EffectSchemaInventoryFixturePath}/*.jsonl\` (sum file counts). Bytes are UTF-8 JSONL byte lengths, excluding Markdown; byte sizes are not line counts.\n\n`,
      'Importable `no` marks provenance-only modules whose path effect\'s exports map nulls (`./internal/*`); their rows carry `"importable":false`.\n\n',
      "| Module | Importable | Rows | Bytes |\n| --- | --- | ---: | ---: |\n",
      ...totalsRows,
      `| **Total** | | **${totalRows}** | **${totalBytes}** |\n\n`,
      "## Per-module kinds and categories\n\n",
      'Every cell verified with `rg --no-ignore --no-heading -F -c \'"kind":"<kind>"\' <module.jsonl>` or `rg --no-ignore --no-heading -F -c \'"category":"<category>"\' <module.jsonl>`; untagged uses `\'"category":null\'`. The hosted fixture test re-renders this index from the committed rows and requires identical bytes.\n\n',
      "| Module | Kinds | Categories |\n| --- | --- | --- |\n",
      ...kindRows,
      "\n## Largest Schema.ts category groups\n\n",
      `Verification: \`rg --no-ignore --no-heading -F -c '"category":"<category>"' ${EffectSchemaInventoryFixturePath}/effect-Schema.jsonl\`; same independently verified groups above, ranked by count, lexical tie-break. Untagged members excluded.\n\n`,
      "| Category | Rows |\n| --- | ---: |\n",
      A.join(
        A.map(top, ([key, count]) => `| ${key} | ${count} |`),
        "\n"
      ),
      "\n",
    ],
    ""
  );
};

/**
 * Render every owned fixture file for one extraction: a JSONL file per module, then `INDEX.md`.
 *
 * **Example** (Render an empty extraction)
 *
 * ```ts
 * import { EffectSchemaInventoryExtraction, renderEffectSchemaInventory } from "@beep/repo-cli/commands/Lint"
 * import { NodeServices } from "@effect/platform-node"
 * import { Effect } from "effect"
 *
 * const extraction = EffectSchemaInventoryExtraction.make({ parser: "6.0.2", bareStarDeclarationsOmitted: 0, modules: [] })
 * const program = renderEffectSchemaInventory("df77fff9396fe31de72d1947ecb5b74f8cee89e1", extraction)
 * Effect.runPromise(program.pipe(Effect.provide(NodeServices.layer))).then((rendered) =>
 *   console.log(rendered.files.map((file) => file.name)) // ["INDEX.md"]
 * )
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderEffectSchemaInventory = Effect.fn("EffectSchemaInventoryRender.render")(function* (
  pin: EffectSchemaInventoryPin,
  extraction: EffectSchemaInventoryExtraction
) {
  const bodies = yield* Effect.forEach(extraction.modules, (entry) => renderEffectSchemaInventoryJsonl(entry.rows));
  const digest = yield* digestEffectSchemaInventoryJsonl(bodies);
  const modules = A.zip(extraction.modules, A.map(bodies, effectSchemaInventoryByteLength));
  const rows = A.flatMap(extraction.modules, (entry) => entry.rows);
  const index = renderEffectSchemaInventoryIndex({ pin, parser: extraction.parser, digest, modules });
  const receipt = EffectSchemaInventoryReceipt.make({
    pin,
    parser: extraction.parser,
    digest,
    modules: extraction.modules.length,
    rows: rows.length,
    bytes: A.reduce(modules, 0, (sum, [, bytes]) => sum + bytes),
    internalRows: A.filter(rows, (row) => row.internal).length,
    deprecatedRows: A.filter(rows, (row) => row.deprecated).length,
    bareStarDeclarationsOmitted: extraction.bareStarDeclarationsOmitted,
  });
  const files = A.append(
    A.map(A.zip(extraction.modules, bodies), ([entry, content]) =>
      EffectSchemaInventoryFile.make({ name: effectSchemaInventoryJsonlName(entry.module.slug), content })
    ),
    EffectSchemaInventoryFile.make({ name: INDEX_FILE, content: index })
  );
  return EffectSchemaInventoryRendered.make({ receipt, files });
});

const decodeIndexHeader = S.decodeEffect(EffectSchemaInventoryIndexHeader);
const PIN_LINE = /^Pin: `([0-9a-f]{40})`.* TypeScript parser: `([^`]+)`\./mu;
const DIGEST_LINE = /^Row digest: `([0-9a-f]{64})`/mu;

const capture = (text: string, pattern: RegExp, group: number): O.Option<string> =>
  pipe(
    text,
    Str.match(pattern),
    O.flatMap((match) => O.fromUndefinedOr(match[group]))
  );

/**
 * Read the pin, parser version, and row digest back from a committed `INDEX.md`.
 *
 * **Example** (Reject an index without a pin line)
 *
 * ```ts
 * import { readEffectSchemaInventoryIndexHeader } from "@beep/repo-cli/commands/Lint"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runPromiseExit(readEffectSchemaInventoryIndexHeader("# Schema inventory index\n")).then((exit) =>
 *   console.log(exit._tag) // "Failure"
 * )
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const readEffectSchemaInventoryIndexHeader = Effect.fn("EffectSchemaInventoryRender.readIndexHeader")(function* (
  index: string
) {
  const fields = O.all({
    pin: capture(index, PIN_LINE, 1),
    parser: capture(index, PIN_LINE, 2),
    digest: capture(index, DIGEST_LINE, 1),
  });
  if (O.isNone(fields))
    return yield* EffectSchemaInventoryError.new("INDEX.md lacks its Pin, TypeScript parser, or Row digest line.");
  return yield* decodeIndexHeader(fields.value).pipe(
    EffectSchemaInventoryError.mapError("INDEX.md header does not decode")
  );
});

const DISPLAY_LIMIT = 160;
const DISPLAY_LEAD = 40;

const firstDifferentColumn = (left: string, right: string): number =>
  pipe(
    A.findFirstIndex(
      Str.split(left, ""),
      (char, position) => !O.exists(Str.charAt(right, position), (other) => other === char)
    ),
    O.getOrElse(() => left.length)
  );

const staleDrift = (file: string, expected: string, actual: string): EffectSchemaInventoryDrift => {
  const left = Str.split(expected, "\n");
  const right = Str.split(actual, "\n");
  const index = pipe(
    A.findFirstIndex(left, (line, position) => !O.exists(A.get(right, position), (other) => other === line)),
    O.getOrElse(() => left.length)
  );
  const lineAt = (lines: ReadonlyArray<string>) => O.getOrElse(A.get(lines, index), () => "");
  const column = firstDifferentColumn(lineAt(left), lineAt(right));
  const start = Num.max(0, column - DISPLAY_LEAD);
  const window = (lines: ReadonlyArray<string>): string =>
    O.match(A.get(lines, index), {
      onNone: () => "<end of file>",
      onSome: (line) => `${start > 0 ? "…" : ""}${Str.slice(start, start + DISPLAY_LIMIT)(line)}`,
    });
  return EffectSchemaInventoryDrift.cases.stale.make({
    file,
    line: index + 1,
    column: column + 1,
    expected: window(left),
    actual: window(right),
  });
};

/**
 * Compare freshly rendered files with the committed fixture files, byte for byte.
 *
 * **Details**
 *
 * `actual` holds the fixture's owned files (`*.jsonl` and `INDEX.md`) keyed by name. Drift lists
 * missing and stale files in render order, then unexpected files by name.
 *
 * **Example** (Detect a stale index)
 *
 * ```ts
 * import { diffEffectSchemaInventoryFiles, EffectSchemaInventoryFile } from "@beep/repo-cli/commands/Lint"
 * import { HashMap } from "effect"
 *
 * const drift = diffEffectSchemaInventoryFiles(
 *   [EffectSchemaInventoryFile.make({ name: "INDEX.md", content: "a\nb\n" })],
 *   HashMap.make(["INDEX.md", "a\nc\n"])
 * )
 * console.log(drift[0]?._tag) // "stale"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const diffEffectSchemaInventoryFiles: {
  (
    actual: HashMap.HashMap<string, string>
  ): (expected: ReadonlyArray<EffectSchemaInventoryFile>) => ReadonlyArray<EffectSchemaInventoryDrift>;
  (
    expected: ReadonlyArray<EffectSchemaInventoryFile>,
    actual: HashMap.HashMap<string, string>
  ): ReadonlyArray<EffectSchemaInventoryDrift>;
} = dual(
  2,
  (
    expected: ReadonlyArray<EffectSchemaInventoryFile>,
    actual: HashMap.HashMap<string, string>
  ): ReadonlyArray<EffectSchemaInventoryDrift> => {
    const expectedNames = HashSet.fromIterable(A.map(expected, (file) => file.name));
    const changed = A.getSomes(
      A.map(expected, (file) =>
        O.match(HashMap.get(actual, file.name), {
          onNone: () => O.some(EffectSchemaInventoryDrift.cases.missing.make({ file: file.name })),
          onSome: (content) =>
            content === file.content ? O.none() : O.some(staleDrift(file.name, file.content, content)),
        })
      )
    );
    const unexpected = pipe(
      A.fromIterable(HashMap.keys(actual)),
      A.filter((name) => !HashSet.has(expectedNames, name)),
      A.sort(Order.String),
      A.map((file) => EffectSchemaInventoryDrift.cases.unexpected.make({ file }))
    );
    return A.appendAll(changed, unexpected);
  }
);

/**
 * One display line per drift case, for the `--check` failure report.
 *
 * **Example** (Describe a missing file)
 *
 * ```ts
 * import { EffectSchemaInventoryDrift, formatEffectSchemaInventoryDrift } from "@beep/repo-cli/commands/Lint"
 *
 * console.log(formatEffectSchemaInventoryDrift(EffectSchemaInventoryDrift.cases.missing.make({ file: "INDEX.md" })))
 * // "missing    INDEX.md"
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const formatEffectSchemaInventoryDrift: (drift: EffectSchemaInventoryDrift) => string =
  EffectSchemaInventoryDrift.match({
    missing: ({ file }) => `missing    ${file}`,
    stale: ({ file, line, column, expected, actual }) =>
      `stale      ${file}:${line}:${column}\n  expected: ${expected}\n  actual:   ${actual}`,
    unexpected: ({ file }) => `unexpected ${file}`,
  });
