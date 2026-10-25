/**
 * Pure building and rendering for the instrumentation catalog: harvested span
 * rows, the merged catalog check, the per-package shards and their generated
 * JSONC text, and the generated section of the observability standard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CommentStyle } from "@beep/managed-section/CommentStyle";
import { SectionId } from "@beep/managed-section/Section";
import { LiteralMarkerDialect, SectionDialect, SectionMarkers } from "@beep/managed-section/SectionDialect";
import { SectionDocument } from "@beep/managed-section/SectionDocument";
import * as Catalog from "@beep/observability/catalog";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CatalogBuild,
  FamilySpanCount,
  HarvestedSpan,
  INSTRUMENTATION_CATALOG_DIR,
  INSTRUMENTATION_CATALOG_GENERATED_BY,
  INSTRUMENTATION_CATALOG_SHARD_SUFFIX,
  InstrumentationCatalogDocument,
  InstrumentationCatalogShard,
} from "./Observability.schemas.ts";
import type { SpanHarvest } from "./Observability.schemas.ts";

const isConformingSpanName = S.is(Catalog.SpanName);
const decodeSpanInstrument = S.decodeUnknownOption(Catalog.SpanInstrument);
const encodeShard = S.encodeEffect(InstrumentationCatalogShard);
const encodeCompactJson = S.encodeEffect(S.fromJsonString(S.Unknown));

const HarvestedSpanOrder: Order.Order<HarvestedSpan> = Order.combine(
  Order.mapInput(Order.String, (row: HarvestedSpan) => row.name),
  Order.mapInput(Order.String, (row: HarvestedSpan) => row.owner)
);

const AttributeKeyOrder: Order.Order<Catalog.AttributeKey> = Order.mapInput(
  Order.String,
  (attribute: Catalog.AttributeKey) => attribute.key
);

const InstrumentOrder: Order.Order<Catalog.Instrument> = Order.combine(
  Order.mapInput(Order.String, Catalog.instrumentSignal),
  Order.mapInput(Order.String, (instrument: Catalog.Instrument) => instrument.name)
);

/**
 * Generated span section rows: one per (owner, name), sorted by name then
 * owner, with `conforms` set when the name is in `Concept(.Sub)*.action` form.
 *
 * **Example** (Collapse repeated sites)
 *
 * ```ts
 * import { PackageName } from "@beep/observability/catalog"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { SpanHarvest, SpanSite, harvestedSpans } from "@beep/repo-cli/commands/Observability"
 *
 * const site = SpanSite.make({
 *   name: "db.query",
 *   owner: PackageName.make("@beep/duckdb"),
 *   family: "driver",
 *   file: PosixPath.make("packages/drivers/duckdb/src/DuckDb.ts"),
 *   line: 1,
 *   callee: "Effect.withSpan"
 * })
 * const rows = harvestedSpans(SpanHarvest.make({ sites: [site, site], findings: [] }))
 * console.log(rows.length, rows[0]?.conforms) // 1 false
 * ```
 *
 * @param harvest - Discovered span sites from one or more source files.
 * @returns Rows deduplicated by owner and name, sorted by name then owner, with naming conformance recorded.
 * @category mapping
 * @since 0.0.0
 */
export const harvestedSpans = (harvest: SpanHarvest): ReadonlyArray<HarvestedSpan> =>
  A.sort(
    A.dedupeWith(
      A.map(harvest.sites, (site) =>
        HarvestedSpan.make({
          name: site.name,
          owner: site.owner,
          family: site.family,
          conforms: isConformingSpanName(site.name),
        })
      ),
      (left, right) => left.name === right.name && left.owner === right.owner
    ),
    HarvestedSpanOrder
  );

/**
 * Catalog span instrument for a harvested row, or `None` when the name is not
 * a valid span name at all (for example, surrounded by whitespace).
 *
 * **Example** (Convert a harvested row)
 *
 * ```ts
 * import { PackageName } from "@beep/observability/catalog"
 * import * as O from "effect/Option"
 * import { HarvestedSpan, harvestedSpanInstrument } from "@beep/repo-cli/commands/Observability"
 *
 * const row = HarvestedSpan.make({ name: "Parcels.read", owner: PackageName.make("@beep/parcels"), family: "slice", conforms: true })
 * console.log(O.map(harvestedSpanInstrument(row), (span) => span.origin)) // { _id: 'Option', _tag: 'Some', value: 'harvested' }
 * ```
 *
 * @param row - Harvested span row supplying its name, owner, family, and conformance flag.
 * @returns A shape-only internal catalog instrument, or None when the row cannot satisfy the catalog schema.
 * @category mapping
 * @since 0.0.0
 */
export const harvestedSpanInstrument = (row: HarvestedSpan): O.Option<Catalog.SpanInstrument> =>
  decodeSpanInstrument({
    _tag: "SpanInstrument",
    name: row.name,
    owner: row.owner,
    family: row.family,
    minTier: Catalog.TelemetryTier.Enum["shape-only"],
    description: "Harvested span literal.",
    kind: Catalog.SpanKind.Enum.internal,
    origin: Catalog.InstrumentOrigin.Enum.harvested,
    conforms: row.conforms,
  });

/**
 * Builds the generated document and merges it, reporting every conflict as a
 * rendered line.
 *
 * **Details**
 *
 * Declared attributes are sorted by key and declared instruments by signal
 * then name. Harvested rows that are not valid span names are reported as
 * conflicts instead of being dropped silently.
 *
 * **Example** (Build an empty catalog)
 *
 * ```ts
 * import { SpanHarvest, buildCatalog } from "@beep/repo-cli/commands/Observability"
 *
 * const built = buildCatalog(SpanHarvest.make({ sites: [], findings: [] }), [])
 * console.log(built.conflicts.length) // 0
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const buildCatalog: {
  (declarations: ReadonlyArray<Catalog.InstrumentDeclarations>): (harvest: SpanHarvest) => CatalogBuild;
  (harvest: SpanHarvest, declarations: ReadonlyArray<Catalog.InstrumentDeclarations>): CatalogBuild;
} = dual(2, (harvest: SpanHarvest, declarations: ReadonlyArray<Catalog.InstrumentDeclarations>): CatalogBuild => {
  const spans = harvestedSpans(harvest);
  const instruments = A.map(spans, (row) => ({ row, instrument: harvestedSpanInstrument(row) }));
  const invalid = A.flatMap(instruments, ({ row, instrument }) =>
    O.isNone(instrument) ? [`span "${row.name}" in ${row.owner} is not a valid span name`] : []
  );
  const merged = Catalog.mergeDeclarations(
    declarations,
    A.getSomes(A.map(instruments, ({ instrument }) => instrument))
  );
  const conflicts = Result.match(merged, {
    onSuccess: () => [],
    onFailure: (failures) => A.map(failures, Catalog.describeConflict),
  });
  const document = InstrumentationCatalogDocument.make({
    attributes: A.sort(
      A.flatMap(declarations, (file) => file.attributes),
      AttributeKeyOrder
    ),
    instruments: A.sort(
      A.flatMap(declarations, (file) => file.instruments),
      InstrumentOrder
    ),
    spans,
  });
  return CatalogBuild.make({ document, conflicts: [...invalid, ...conflicts] });
});

/**
 * Span counts per package family, in `PackageFamily` order, zeros included.
 *
 * **Example** (Count an empty section)
 *
 * ```ts
 * import { familySpanCounts } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(familySpanCounts([]).length) // 7
 * ```
 *
 * @param spans - Harvested span rows to count, including rows that fail naming conformance.
 * @returns Counts in package-family declaration order, including families with zero spans.
 * @category folding
 * @since 0.0.0
 */
export const familySpanCounts = (spans: ReadonlyArray<HarvestedSpan>): ReadonlyArray<FamilySpanCount> =>
  A.map(Catalog.PackageFamily.literals, (family) => {
    const rows = A.filter(spans, (row) => row.family === family);
    return FamilySpanCount.make({
      family,
      spans: A.length(rows),
      conforming: A.length(A.filter(rows, (row) => row.conforms)),
    });
  });

const renderArray = Effect.fn("Observability.renderArray")(function* (key: string, values: ReadonlyArray<unknown>) {
  if (A.isReadonlyArrayEmpty(values)) {
    return `  "${key}": []`;
  }
  const lines = yield* Effect.forEach(values, (value) => encodeCompactJson(value));
  return `  "${key}": [\n${A.join(
    A.map(lines, (line) => `    ${line}`),
    ",\n"
  )}\n  ]`;
});

/**
 * Repo-relative path of one package's catalog shard.
 *
 * **Example** (Locate a shard)
 *
 * ```ts
 * import { PackageName } from "@beep/observability/catalog"
 * import { shardPath } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(shardPath(PackageName.make("@beep/parcels"))) // "standards/instrumentation-catalog/@beep/parcels.generated.jsonc"
 * ```
 *
 * @param owner - Scoped package name that owns the shard.
 * @returns The shard path under the catalog directory, keeping the package scope as a folder.
 * @category formatting
 * @since 0.0.0
 */
export const shardPath = (owner: Catalog.PackageName): string =>
  `${INSTRUMENTATION_CATALOG_DIR}/${owner}${INSTRUMENTATION_CATALOG_SHARD_SUFFIX}`;

/**
 * Splits the whole catalog into one shard per owning package, sorted by
 * package name.
 *
 * **Details**
 *
 * A package gets a shard when it owns at least one attribute key, declared
 * instrument or harvested span. Each shard keeps the document's ordering, so
 * concatenating the shards' entries reproduces the document's entries.
 *
 * **Example** (Shard a two-package catalog)
 *
 * ```ts
 * import { PackageName } from "@beep/observability/catalog"
 * import { HarvestedSpan, InstrumentationCatalogDocument, shardCatalog } from "@beep/repo-cli/commands/Observability"
 *
 * const span = (name: string, owner: string) =>
 *   HarvestedSpan.make({ name, owner: PackageName.make(owner), family: "slice", conforms: true })
 * const shards = shardCatalog(
 *   InstrumentationCatalogDocument.make({
 *     attributes: [],
 *     instruments: [],
 *     spans: [span("Parcels.read", "@beep/parcels"), span("Box.list", "@beep/box")]
 *   })
 * )
 * console.log(shards.map((shard) => shard.package)) // ["@beep/box", "@beep/parcels"]
 * ```
 *
 * @param document - Whole catalog assembled by one run.
 * @returns One shard per owning package, in package-name order.
 * @category mapping
 * @since 0.0.0
 */
export const shardCatalog = (document: InstrumentationCatalogDocument): ReadonlyArray<InstrumentationCatalogShard> => {
  const attributes = A.groupBy(document.attributes, (attribute) => attribute.owner);
  const instruments = A.groupBy(document.instruments, (instrument) => instrument.owner);
  const spans = A.groupBy(document.spans, (row) => row.owner);
  const owners = A.sort(
    A.dedupe([
      ...A.map(document.attributes, (attribute) => attribute.owner),
      ...A.map(document.instruments, (instrument) => instrument.owner),
      ...A.map(document.spans, (row) => row.owner),
    ]),
    Str.Order
  );
  const of = <A>(groups: Record<string, ReadonlyArray<A>>, owner: string): ReadonlyArray<A> =>
    O.getOrElse(R.get(groups, owner), A.empty);
  return A.map(owners, (owner) =>
    InstrumentationCatalogShard.make({
      package: owner,
      attributes: of(attributes, owner),
      instruments: of(instruments, owner),
      spans: of(spans, owner),
    })
  );
};

/**
 * Renders one catalog shard as deterministic JSONC, one array entry per line
 * so diffs stay reviewable and unrelated additions merge line by line.
 *
 * **Example** (Render an empty shard)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { PackageName } from "@beep/observability/catalog"
 * import { InstrumentationCatalogShard, renderShardText } from "@beep/repo-cli/commands/Observability"
 *
 * const text = Effect.runSync(
 *   renderShardText(
 *     InstrumentationCatalogShard.make({ package: PackageName.make("@beep/parcels"), attributes: [], instruments: [], spans: [] })
 *   )
 * )
 * console.log(text.startsWith("// Generated by")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderShardText = Effect.fn("Observability.renderShardText")(function* (
  shard: InstrumentationCatalogShard
) {
  const encoded = yield* encodeShard(shard);
  const header = yield* Effect.forEach(
    [
      ["schemaVersion", encoded.schemaVersion],
      ["generatedBy", encoded.generatedBy],
      ["package", encoded.package],
    ] as const,
    ([key, value]) => Effect.map(encodeCompactJson(value), (json) => `  "${key}": ${json}`)
  );
  const attributes = yield* renderArray("attributes", encoded.attributes);
  const instruments = yield* renderArray("instruments", encoded.instruments);
  const spans = yield* renderArray("spans", encoded.spans);
  return `// Generated by ${INSTRUMENTATION_CATALOG_GENERATED_BY}. Do not edit manually.\n{\n${A.join(
    [...header, attributes, instruments, spans],
    ",\n"
  )}\n}\n`;
});

const STANDARD_SECTION_ID = SectionId.make({ key: "instrumentation-catalog", commentStyle: CommentStyle.html });

// The standard's markers predate `@beep/managed-section`, so they keep their
// literal spelling instead of the ruled `--- BEGIN <key> ... ---` form.
const STANDARD_DIALECT = LiteralMarkerDialect.make({
  phrase: SectionDialect.default.phrase,
  styles: [CommentStyle.html],
  markers: [
    SectionMarkers.make({
      key: STANDARD_SECTION_ID.key,
      begin: "BEGIN GENERATED: INSTRUMENTATION CATALOG",
      end: "END GENERATED: INSTRUMENTATION CATALOG",
    }),
  ],
});

/**
 * Opening marker of the generated section in the observability standard.
 *
 * **Example** (Read the opening marker)
 *
 * ```ts
 * import { STANDARD_SECTION_BEGIN } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(STANDARD_SECTION_BEGIN) // "<!-- BEGIN GENERATED: INSTRUMENTATION CATALOG -->"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const STANDARD_SECTION_BEGIN: string = STANDARD_DIALECT.beginMarker(STANDARD_SECTION_ID);

/**
 * Closing marker of the generated section in the observability standard.
 *
 * **Example** (Read the closing marker)
 *
 * ```ts
 * import { STANDARD_SECTION_END } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(STANDARD_SECTION_END) // "<!-- END GENERATED: INSTRUMENTATION CATALOG -->"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const STANDARD_SECTION_END: string = STANDARD_DIALECT.endMarker(STANDARD_SECTION_ID);

/**
 * Generated section of the observability standard: the naming rules the
 * catalog check enforces and where the catalog lives.
 *
 * **Details**
 *
 * The section carries no counts. Span and declaration totals change with
 * almost every pull request, so committing them made every open pull request
 * conflict with each merge; the command prints them instead.
 *
 * **Example** (Read the section markers)
 *
 * ```ts
 * import { STANDARD_SECTION, STANDARD_SECTION_BEGIN } from "@beep/repo-cli/commands/Observability"
 *
 * console.log(STANDARD_SECTION.startsWith(STANDARD_SECTION_BEGIN)) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const STANDARD_SECTION: string = A.join(
  [
    STANDARD_SECTION_BEGIN,
    "",
    `_Generated by \`${INSTRUMENTATION_CATALOG_GENERATED_BY}\`. Do not edit by hand._`,
    "",
    `The catalog is committed as one shard per owning package, \`${INSTRUMENTATION_CATALOG_DIR}/<package>${INSTRUMENTATION_CATALOG_SHARD_SUFFIX}\`, so pull requests that add spans in different packages do not conflict. Span counts per family are printed by \`bun run beep observability catalog --check\` rather than committed here.`,
    "",
    "Naming rules the catalog check enforces:",
    "",
    "- Domain spans, in every family, are named `Concept(.Sub)*.action`: PascalCase concept segments and a camelCase action, for example `Parcels.read`.",
    "- Protocol spans follow OpenTelemetry semantic conventions (`GET /route`, `gen_ai.*`) and are declared with `protocol: true`. Their identity is the owning package plus the name, so two packages may share one.",
    "- Every other span name is unique across packages. Names are static literals; a template literal with substitutions fails the check, and its variable part belongs in an attribute.",
    "- Harvested names that predate the domain form stay in the catalog with `conforms: false`; there is no mass rename.",
    "- Metric names are lowercase dotted `beep.<area>.<noun>` with a declared UCUM unit and no hand-written unit or `_total` suffix. One counter per concept carries a bounded `beep.outcome` attribute instead of one counter per outcome.",
    "- Event names are `Concept.event_happened`. Attribute keys are lowercase dotted and declared once, with their signals, cardinality and strictest allowed tier; metrics use only static or bounded keys.",
    "",
    STANDARD_SECTION_END,
  ],
  "\n"
);

const readStandardSection = (text: string) =>
  O.flatMap(Result.getSuccess(SectionDocument.parseResult(text, STANDARD_DIALECT)), (document) =>
    document.read(STANDARD_SECTION_ID)
  );

/**
 * Replaces the generated section between the markers, or `None` when the
 * standard does not hold exactly one well-formed generated section.
 *
 * **Details**
 *
 * The standard is read as a `@beep/managed-section` document with the
 * standard's literal markers, so a duplicated, orphaned, overlapping or
 * unterminated section, or a marker that does not own its line, is `None`
 * rather than a guess. The replacement body is rendered in the document's
 * line ending, and every byte outside the section is kept.
 *
 * **Example** (Replace a section)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { STANDARD_SECTION_BEGIN, STANDARD_SECTION_END, spliceStandardSection } from "@beep/repo-cli/commands/Observability"
 *
 * const doc = `intro\n${STANDARD_SECTION_BEGIN}\nold\n${STANDARD_SECTION_END}\noutro\n`
 * const next = spliceStandardSection(doc, `${STANDARD_SECTION_BEGIN}\nnew\n${STANDARD_SECTION_END}`)
 * console.log(O.map(next, (text) => text.includes("new"))) // { _id: 'Option', _tag: 'Some', value: true }
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const spliceStandardSection: {
  (section: string): (current: string) => O.Option<string>;
  (current: string, section: string): O.Option<string>;
} = dual(
  2,
  (current: string, section: string): O.Option<string> =>
    pipe(
      Result.getSuccess(SectionDocument.parseResult(current, STANDARD_DIALECT)),
      O.filter((document) => document.has(STANDARD_SECTION_ID)),
      O.flatMap((document) =>
        O.flatMap(readStandardSection(section), (declared) => Result.getSuccess(document.reconcile([declared])))
      ),
      O.map((reconciled) => reconciled.text)
    )
);
