/**
 * Render the schema index as Markdown slices, and render schema idiom hints
 * as the advisory message the hook and `beep schema-idioms hint` print.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as SemVer from "effect/SemVer";
import * as Str from "effect/String";
import { SchemaIdiomsLookupTopic, SchemaIndexEntry, SchemaIndexFile, SchemaIndexSlice } from "./SchemaIdioms.model.ts";
import type { SchemaIdiomHint } from "./SchemaIdiomHints.model.ts";
import type { SchemaGetterEntry, SchemaIndex } from "./SchemaIdioms.model.ts";

/**
 * Directory, relative to the repository root, that holds the generated slices.
 *
 * **Example** (Locate the index)
 *
 * ```ts import.meta.vitest name="Locate the index"
 * import { SCHEMA_INDEX_DIRECTORY } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SCHEMA_INDEX_DIRECTORY // => ".claude/skills/schema-first-development/references/schema-index"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SCHEMA_INDEX_DIRECTORY = ".claude/skills/schema-first-development/references/schema-index";

/**
 * Most hints one message lists before it summarises the rest.
 *
 * **Example** (Read the cap)
 *
 * ```ts import.meta.vitest name="Read the cap"
 * import { SCHEMA_IDIOM_HINT_LIMIT } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * SCHEMA_IDIOM_HINT_LIMIT // => 8
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const SCHEMA_IDIOM_HINT_LIMIT = 8;

const TYPE_TEXT_LIMIT = 60;

const TAKES_A_SCHEMA_CATEGORIES = HashSet.make(
  "constructors",
  "schemas",
  "combinators",
  "transforming",
  "branding",
  "filtering"
);

const SKIPPED_GETTER_CATEGORIES = HashSet.make("models", "guards");

const SINGLE_MEMBER = /^\{ readonly ([A-Za-z_$][\w$]*): [^;]+;? \}$/;

const WIRE_SLICES: Readonly<Record<string, SchemaIndexSlice>> = {
  string: "wire-string",
  number: "wire-number",
  bigint: "wire-bigint",
  Date: "wire-date",
};

const SLICE_TITLES: Readonly<Record<SchemaIndexSlice, string>> = {
  "wire-string": "string on the wire",
  "wire-number": "number on the wire",
  "wire-bigint": "bigint on the wire",
  "wire-date": "Date on the wire",
  "wire-other": "other wire shapes",
  "checks-collections": "checks on collections and other inputs",
  "takes-a-schema": "constructors and combinators that take a schema",
  getters: "named getters and transformations",
};

const SLICE_HOLDS: Readonly<Record<SchemaIndexSlice, string>> = {
  "wire-string": "Schemas that read a string, and checks on strings.",
  "wire-number": "Schemas that read a number, and checks on numbers.",
  "wire-bigint": "Schemas that read a bigint, and checks on bigints.",
  "wire-date": "Schemas that read a JavaScript Date, and checks on Dates.",
  "wire-other": "Schemas whose encoded side is any other shape, with that shape shown.",
  "checks-collections": "Checks whose input is a collection, a sized or lengthed value, or another non-primitive.",
  "takes-a-schema": "Constructors and combinators whose result depends on the schema passed in.",
  getters: "Named `effect/SchemaGetter` and `effect/SchemaTransformation` values for `S.decodeTo` and friends.",
};

const kindRank: Readonly<Record<SchemaIndexEntry["kind"], number>> = { codec: 0, check: 1, combinator: 2 };

const byKindThenName: Order.Order<SchemaIndexEntry> = Order.combine(
  Order.mapInput(Order.Number, (entry: SchemaIndexEntry) => kindRank[entry.kind]),
  Order.mapInput(Order.String, (entry: SchemaIndexEntry) => entry.name)
);

/**
 * Shorten type text for one index line: a single-member object type reads as
 * `has .member`, and text over 60 characters is cut with an ellipsis.
 *
 * **Example** (Shorten type text)
 *
 * ```ts import.meta.vitest name="Shorten type text"
 * import { shortTypeText } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * shortTypeText("{ readonly size: number; }") // => "has .size"
 * shortTypeText("Duration.Duration") // => "Duration.Duration"
 * ```
 *
 * @param text - Normalized checker type text.
 * @returns At most 60 characters of text for one index line.
 * @category formatting
 * @since 0.0.0
 */
export const shortTypeText = (text: string): string => {
  const member = pipe(
    O.fromNullishOr(SINGLE_MEMBER.exec(text)),
    O.flatMap((match) => A.get(match, 1))
  );
  const shown = O.match(member, { onNone: () => text, onSome: (name) => `has .${name}` });
  return Str.length(shown) > TYPE_TEXT_LIMIT ? `${Str.slice(0, TYPE_TEXT_LIMIT - 3)(shown)}…` : shown;
};

const wireSlice = (encoded: string): O.Option<SchemaIndexSlice> => R.get(WIRE_SLICES, encoded);

/**
 * The slice an index entry renders into, or none for a combinator outside the
 * schema-taking categories.
 *
 * **Example** (Place a codec)
 *
 * ```ts import.meta.vitest name="Place a codec"
 * import { SchemaIndexCodec, sliceOfEntry } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * const entry = SchemaIndexCodec.make({
 *   kind: "codec",
 *   name: "DurationFromMillis",
 *   decoded: "Duration.Duration",
 *   encoded: "number",
 *   summary: O.none(),
 *   category: O.some("schemas"),
 * })
 * O.getOrThrow(sliceOfEntry(entry)) // => "wire-number"
 * ```
 *
 * @param entry - One index entry.
 * @returns The slice that lists it.
 * @category formatting
 * @since 0.0.0
 */
export const sliceOfEntry = (entry: SchemaIndexEntry): O.Option<SchemaIndexSlice> =>
  SchemaIndexEntry.match(entry, {
    codec: (codec) => O.orElseSome(wireSlice(codec.encoded), () => SchemaIndexSlice.Enum["wire-other"]),
    check: (check) => O.orElseSome(wireSlice(check.input), () => SchemaIndexSlice.Enum["checks-collections"]),
    combinator: (combinator) =>
      O.exists(combinator.category, (category) => !HashSet.has(TAKES_A_SCHEMA_CATEGORIES, category))
        ? O.none()
        : O.some(SchemaIndexSlice.Enum["takes-a-schema"]),
  });

const summarySuffix = (summary: O.Option<string>): string =>
  O.match(summary, { onNone: () => "", onSome: (text) => `: ${text}` });

const entryLine = (slice: SchemaIndexSlice, entry: SchemaIndexEntry): string =>
  SchemaIndexEntry.match(entry, {
    codec: (codec) => {
      const wire = slice === "wire-other" ? ` (wire ${shortTypeText(codec.encoded)})` : "";
      const arrow = codec.decoded === codec.encoded ? "" : ` → ${shortTypeText(codec.decoded)}`;
      return `- S.${codec.name}${wire}${arrow}${summarySuffix(codec.summary)}`;
    },
    check: (check) => {
      const input = slice === "checks-collections" ? ` on ${shortTypeText(check.input)}` : "";
      return `- S.${check.name} (check${input})${summarySuffix(check.summary)}`;
    },
    combinator: (combinator) => `- S.${combinator.name}${summarySuffix(combinator.summary)}`,
  });

const getterLine = (getter: SchemaGetterEntry): string =>
  `- ${getter.module}.${getter.name}${summarySuffix(getter.summary)}`;

const isRenderedGetter = (getter: SchemaGetterEntry): boolean =>
  !O.exists(getter.category, (category) => HashSet.has(SKIPPED_GETTER_CATEGORIES, category));

const generatedNotice = (index: SchemaIndex): string =>
  `Generated from effect ${SemVer.format(index.effectVersion)} by \`bun run beep schema-idioms index --write\`. Do not edit by hand.`;

const sliceFile = (index: SchemaIndex, slice: SchemaIndexSlice, lines: ReadonlyArray<string>): SchemaIndexFile =>
  SchemaIndexFile.make({
    file: `${slice}.md`,
    entries: A.length(lines),
    content: A.join(
      [`# effect/Schema index: ${SLICE_TITLES[slice]}`, "", generatedNotice(index), "", ...lines, ""],
      "\n"
    ),
  });

const readmeFile = (index: SchemaIndex, slices: ReadonlyArray<SchemaIndexFile>): SchemaIndexFile =>
  SchemaIndexFile.make({
    file: "README.md",
    entries: 0,
    content: A.join(
      [
        "# effect/Schema index",
        "",
        generatedNotice(index),
        "",
        "What the installed `effect/Schema` ships, grouped by the wire (encoded) type a schema reads, so a field that arrives as a number is one lookup: `bun run beep schema-idioms lookup number`. Topics: `string`, `number`, `bigint`, `date`, `other`, `collections`, `constructors`, `getters`.",
        "",
        "`bun run beep schema-idioms index --check` fails when these files differ from what the installed effect would generate, and the repo-cli test `schema-idioms-index.test.ts` makes the same comparison. No CI lane runs `--check` itself: after an Effect bump, run `bun run beep schema-idioms index --write` and commit the result.",
        "",
        "| Slice | Entries | Holds |",
        "| --- | --- | --- |",
        ...A.map(
          A.zip(SchemaIndexSlice.literals, slices),
          ([slice, file]) => `| [${file.file}](${file.file}) | ${file.entries} | ${SLICE_HOLDS[slice]} |`
        ),
        "",
      ],
      "\n"
    ),
  });

/**
 * Render the index into its slice files and a README, in a fixed order with
 * no timestamps or paths.
 *
 * **Example** (Render an empty index)
 *
 * ```ts import.meta.vitest name="Render an empty index"
 * import { renderSchemaIndexFiles, SchemaIndex } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as A from "effect/Array"
 * import * as SemVer from "effect/SemVer"
 *
 * const effectVersion = SemVer.make({ major: 4, minor: 1, patch: 5 })
 * const files = renderSchemaIndexFiles(SchemaIndex.make({ effectVersion, entries: [], getters: [] }))
 * A.length(files) // => 9
 * ```
 *
 * @param index - The extracted index.
 * @returns The eight slices, then `README.md`.
 * @category formatting
 * @since 0.0.0
 */
export const renderSchemaIndexFiles = (index: SchemaIndex): ReadonlyArray<SchemaIndexFile> => {
  const sorted = A.sort(index.entries, byKindThenName);
  const slices = A.map(SchemaIndexSlice.literals, (slice) =>
    slice === "getters"
      ? sliceFile(index, slice, A.map(A.filter(index.getters, isRenderedGetter), getterLine))
      : sliceFile(
          index,
          slice,
          A.map(
            A.filter(sorted, (entry) => O.contains(sliceOfEntry(entry), slice)),
            (entry) => entryLine(slice, entry)
          )
        )
  );
  return A.append(slices, readmeFile(index, slices));
};

/**
 * The slice file a `beep schema-idioms lookup` topic prints.
 *
 * **Example** (Map topics to files)
 *
 * ```ts import.meta.vitest name="Map topics to files"
 * import { lookupSliceFile } from "@beep/repo-cli/commands/SchemaIdioms"
 *
 * lookupSliceFile("number") // => "wire-number.md"
 * lookupSliceFile("constructors") // => "takes-a-schema.md"
 * ```
 *
 * @param topic - A wire type or a role topic.
 * @returns The slice file name inside {@link SCHEMA_INDEX_DIRECTORY}.
 * @category formatting
 * @since 0.0.0
 */
export const lookupSliceFile = (topic: SchemaIdiomsLookupTopic): string =>
  `${SchemaIdiomsLookupTopic.match(topic, {
    string: () => "wire-string",
    number: () => "wire-number",
    bigint: () => "wire-bigint",
    date: () => "wire-date",
    other: () => "wire-other",
    collections: () => "checks-collections",
    constructors: () => "takes-a-schema",
    getters: () => "getters",
  })}.md`;

const hintLine = (hint: SchemaIdiomHint): string => {
  const identifier = O.match(hint.schemaIdentifier, { onNone: () => "", onSome: (name) => ` (${name})` });
  const shipped = A.join(
    A.map(hint.shipped, (name) => `S.${name}`),
    " · "
  );
  return `L${hint.line} ${hint.field}${identifier}: the name reads as ${hint.readsAs} but the schema decodes to a primitive. Shipped: ${shipped}`;
};

/**
 * Render hints as the advisory message: a header, at most
 * {@link SCHEMA_IDIOM_HINT_LIMIT} hint lines, an "and N more" line when
 * capped, and the lookup command for each wire type involved.
 *
 * **Example** (Render one hint)
 *
 * ```ts import.meta.vitest name="Render one hint"
 * import { renderSchemaIdiomHintMessage, SchemaIdiomHint } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 *
 * const hint = SchemaIdiomHint.make({
 *   line: 3,
 *   field: "port",
 *   schemaIdentifier: O.none(),
 *   kind: "port",
 *   readsAs: "a port",
 *   wire: "number",
 *   shipped: ["Port"],
 * })
 * const lines = Str.split(renderSchemaIdiomHintMessage([hint]), "\n")
 * lines[1] // => "L3 port: the name reads as a port but the schema decodes to a primitive. Shipped: S.Port"
 * ```
 *
 * @param hints - Hints in line order; only the first {@link SCHEMA_IDIOM_HINT_LIMIT} are listed.
 * @returns Newline-joined text: the advisory header, the hint lines and one lookup command per wire type.
 * @category formatting
 * @since 0.0.0
 */
export const renderSchemaIdiomHintMessage = (hints: A.NonEmptyReadonlyArray<SchemaIdiomHint>): string => {
  const shown = A.take(hints, SCHEMA_IDIOM_HINT_LIMIT);
  const hidden = A.length(hints) - A.length(shown);
  const wires = A.dedupe(A.map(hints, (hint) => hint.wire));
  return A.join(
    [
      "[schema-idiom] Advisory: effect/Schema may already ship these. Skip any line that does not fit the domain.",
      ...A.map(shown, hintLine),
      ...(hidden > 0 ? [`and ${hidden} more`] : []),
      `More by wire type: ${A.join(
        A.map(wires, (wire) => `bun run beep schema-idioms lookup ${wire}`),
        " · "
      )}`,
    ],
    "\n"
  );
};

/**
 * Render hints as the advisory message, or none when there are no hints.
 *
 * **Example** (Render no hints)
 *
 * ```ts import.meta.vitest name="Render no hints"
 * import { renderSchemaIdiomHints } from "@beep/repo-cli/commands/SchemaIdioms"
 * import * as O from "effect/Option"
 *
 * O.isNone(renderSchemaIdiomHints([])) // => true
 * ```
 *
 * @param hints - Hints in line order.
 * @returns The message of {@link renderSchemaIdiomHintMessage}, or none.
 * @category formatting
 * @since 0.0.0
 */
export const renderSchemaIdiomHints = (hints: ReadonlyArray<SchemaIdiomHint>): O.Option<string> =>
  A.match(hints, { onEmpty: O.none, onNonEmpty: flow(renderSchemaIdiomHintMessage, O.some) });
