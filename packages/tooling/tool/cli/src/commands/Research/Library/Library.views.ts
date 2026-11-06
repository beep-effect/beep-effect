/**
 * Ordered SPARQL read models over a disposable catalog projection.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Rdf from "@beep/rdf/Rdf";
import { XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import { findRepoRoot } from "@beep/repo-utils";
import { LiteralKit } from "@beep/schema";
import { SparqlQueryRequest, SparqlQueryService } from "@beep/semantic-web/services/sparql-query";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LibraryError } from "./Library.errors.ts";
import { libraryEffectiveCaptures, libraryEffectiveCategory } from "./Library.evidence.ts";
import { LibraryDispositionImportPayload, libraryDispositionValid } from "./Library.import.ts";
import { catalogDataset, libraryTopics } from "./Library.projection.ts";
import {
  LibraryArtifact,
  LibraryCapture,
  LibraryDocument,
  LibraryOccurrence,
  LibraryQualification,
  LibrarySource,
} from "./Library.schemas.ts";
import type { LibraryTopic } from "./Library.projection.ts";
import type { LibraryCatalog } from "./Library.schemas.ts";

const LibraryDispositionImportPayloadJson = S.fromJsonString(LibraryDispositionImportPayload);

const $I = $RepoCliId.create("commands/Research/Library/Library.views");
const ViewKind = LiteralKit(["Report", "Source", "Capture", "Qualification", "Claim", "Occurrence", "Artifact"]).pipe(
  $I.annoteSchema("ViewKind", { description: "Library projection read-model partitions." })
);
const iri = (key: string) => $I.create(key).iri;
const model = $RepoCliId.create("commands/Research/Library/Library.schemas");
const entity = (kind: string, id: string) => Rdf.makeNamedNode(`${model.create(kind).iri}/${encodeURIComponent(id)}`);
const entityTerm = (kind: string, id: string) => Rdf.serializeTerm(entity(kind, id));
const prefixes = `PREFIX v: <${iri("term")}/> PREFIX lib: <${model.iri}/>`;
const visible = (includePrivate: boolean) => (includePrivate ? "" : 'FILTER NOT EXISTS { ?record v:private "true" }');
const selectRecords = (kind: string) =>
  `${prefixes} SELECT ?payload ?category ?readable WHERE { ?record a lib:${kind}; v:payload ?payload; lib:catalogIndex ?order . OPTIONAL { ?record v:displayCategory ?category } OPTIONAL { ?record lib:effectiveCategory ?category } OPTIONAL { ?record v:readable ?readable } $VISIBILITY } ORDER BY ?order`;
/**
 * Reports in immutable catalog order.
 * **Example** (Inspect reportIndex)
 * ```ts
 * import { reportIndex } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(reportIndex.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const reportIndex = selectRecords("Report");
/**
 * Sources with effective categories in catalog order.
 * **Example** (Inspect sourceIndex)
 * ```ts
 * import { sourceIndex } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(sourceIndex.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const sourceIndex = selectRecords("Source");
/**
 * Route qualification receipts in catalog order.
 * **Example** (Inspect qualificationIndex)
 * ```ts
 * import { qualificationIndex } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(qualificationIndex.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const qualificationIndex = selectRecords("Qualification");
/**
 * Visible citation occurrences in catalog order.
 * **Example** (Inspect occurrenceIndex)
 * ```ts
 * import { occurrenceIndex } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(occurrenceIndex.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const occurrenceIndex = selectRecords("Occurrence");
/**
 * Historical capture attempts in catalog order.
 * **Example** (Inspect captureIndex)
 * ```ts
 * import { captureIndex } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(captureIndex.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const captureIndex = selectRecords("Capture");
/**
 * Citation occurrences for one report.
 * **Example** (Inspect reportOccurrences)
 * ```ts
 * import { reportOccurrences } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(reportOccurrences("example").length)
 * ```
 * @param id - Report identity whose citation occurrences are selected.
 * @returns SPARQL query selecting visible occurrences for the report.
 * @category queries
 * @since 0.0.0
 */
export const reportOccurrences = (id: string) =>
  Str.replace(
    "$VISIBILITY",
    `?record lib:documentId ${entityTerm("Report", id)} . $VISIBILITY`
  )(selectRecords("Occurrence"));
/**
 * Direct source backlinks, respecting document and source privacy.
 * **Example** (Inspect sourceBacklinks)
 * ```ts
 * import { sourceBacklinks } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(sourceBacklinks("example").length)
 * ```
 * @param id - Source identity whose direct citation backlinks are selected.
 * @returns SPARQL query selecting visible occurrences citing the source.
 * @category queries
 * @since 0.0.0
 */
export const sourceBacklinks = (id: string) =>
  Str.replace(
    "$VISIBILITY",
    `?record lib:sourceId ${entityTerm("Source", id)} . $VISIBILITY`
  )(selectRecords("Occurrence"));
/**
 * Capture receipts for one source in append order.
 * **Example** (Inspect sourceCaptures)
 * ```ts
 * import { sourceCaptures } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(sourceCaptures("example").length)
 * ```
 * @param id - Source identity whose capture receipts are selected.
 * @returns SPARQL query selecting visible captures in catalog order.
 * @category queries
 * @since 0.0.0
 */
export const sourceCaptures = (id: string) =>
  Str.replace(
    "$VISIBILITY",
    `?record lib:sourceId ${entityTerm("Source", id)} . $VISIBILITY`
  )(selectRecords("Capture"));
/**
 * Visible artifact uses for one capture.
 * **Example** (Inspect captureArtifacts)
 * ```ts
 * import { captureArtifacts } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(captureArtifacts("example").length)
 * ```
 * @param id - Capture identity whose artifact uses are selected.
 * @returns SPARQL query selecting visible artifacts attached to the capture.
 * @category queries
 * @since 0.0.0
 */
export const captureArtifacts = (id: string) =>
  Str.replace(
    "$VISIBILITY",
    `${entityTerm("Capture", id)} lib:artifacts ?record . $VISIBILITY`
  )(selectRecords("Artifact"));
/**
 * Repositories sharing the selected source repository.
 * **Example** (Inspect relatedRepositories)
 * ```ts
 * import { relatedRepositories } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(relatedRepositories("source").length)
 * ```
 * @param id - Source identity used to find its repository peers.
 * @returns SPARQL query selecting other visible sources for the same repository.
 * @category queries
 * @since 0.0.0
 */
export const relatedRepositories = (id: string) =>
  `${prefixes} SELECT ?payload WHERE { ${entityTerm("Source", id)} lib:repository ?repository . FILTER (?repository != "") ?record a lib:Source; lib:kind "github-repository"; lib:repository ?repository; v:payload ?payload; lib:catalogIndex ?order . FILTER (?record != ${entityTerm("Source", id)}) $VISIBILITY } ORDER BY ?order`;
/**
 * Indirect repository provenance through other visible sources.
 * **Example** (Inspect indirectBacklinks)
 * ```ts
 * import { indirectBacklinks } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(indirectBacklinks("source").length)
 * ```
 * @param id - Repository source identity whose indirect citations are selected.
 * @returns SPARQL query selecting visible occurrences citing related sources.
 * @category queries
 * @since 0.0.0
 */
export const indirectBacklinks = (id: string) =>
  `${prefixes} SELECT ?payload WHERE { ${entityTerm("Source", id)} lib:kind "github-repository"; lib:repository ?repository . FILTER (?repository != "") ?related a lib:Source; lib:repository ?repository . FILTER (?related != ${entityTerm("Source", id)}) ?record a lib:Occurrence; lib:sourceId ?related; v:payload ?payload; lib:catalogIndex ?order . $VISIBILITY } ORDER BY ?order`;
/**
 * Capture, qualification, source and required-version counts grouped independently.
 * **Example** (Inspect statusCounts)
 * ```ts
 * import { statusCounts } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(statusCounts.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const statusCounts = `${prefixes} SELECT ?kind ?category (COUNT(*) AS ?count) WHERE {
  { ?record a lib:Capture; lib:status ?category . BIND("Capture" AS ?kind) }
  UNION { ?record a lib:Qualification; lib:status ?category . BIND("Qualification" AS ?kind) }
  UNION { ?record a lib:Source; lib:effectiveCategory ?category . BIND("Source" AS ?kind) }
  UNION { ?record v:kind "Claim"; v:category ?category . BIND("Claim" AS ?kind) }
  $VISIBILITY
} GROUP BY ?kind ?category`;
/**
 * Private records counted independently of the requested visibility.
 * **Example** (Inspect privatePartition)
 * ```ts
 * import { privatePartition } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(privatePartition.length)
 * ```
 * @category queries
 * @since 0.0.0
 */
export const privatePartition = `${prefixes} SELECT ?kind (COUNT(*) AS ?count) WHERE {
  VALUES (?class ?kind) { (lib:Report "Report") (lib:Source "Source") (lib:Artifact "Artifact") (lib:Occurrence "Occurrence") }
  ?record a ?class; v:private "true" .
} GROUP BY ?kind`;
/**
 * Schema-encoded record payload and optional capture presentation metadata.
 * **Example** (Inspect LibraryViewRow)
 * ```ts
 * import { LibraryViewRow } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(LibraryViewRow.fields)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryViewRow extends S.Opaque<LibraryViewRow, { readonly brand: unique symbol }>()(
  S.Struct({ payload: S.String, category: S.optionalKey(S.String), readable: S.optionalKey(S.String) }).pipe(
    $I.annoteSchema("LibraryViewRow", {
      description: "Schema-encoded record payload and optional capture presentation metadata.",
    })
  )
) {}
/**
 * Decoded non-negative grouped count.
 * **Example** (Inspect LibraryCountRow)
 * ```ts
 * import { LibraryCountRow } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(LibraryCountRow.fields)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryCountRow extends S.Opaque<LibraryCountRow, { readonly brand: unique symbol }>()(
  S.Struct({ kind: ViewKind, category: S.optionalKey(S.String), count: S.FiniteFromString }).pipe(
    $I.annoteSchema("LibraryCountRow", { description: "Decoded non-negative grouped count." })
  )
) {}
/**
 * Execute a SELECT and decode lexical RDF bindings through its row schema.
 * **Example** (Inspect runView)
 * ```ts
 * import { runView } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(runView !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const runView = Effect.fn("Library.runView")(function* <T, I>(
  dataset: Rdf.Dataset,
  query: string,
  row: S.Codec<T, I>,
  includePrivate = false
) {
  const service = yield* SparqlQueryService;
  const result = yield* service
    .execute(
      SparqlQueryRequest.make({
        dataset,
        profile: "select",
        query: Str.replace("$VISIBILITY", visible(includePrivate))(query),
      })
    )
    .pipe(Effect.mapError((cause) => LibraryError.make({ message: "Cannot execute library view", cause })));
  if (result.profile !== "select")
    return yield* LibraryError.make({ message: "Library view requires SELECT rows", cause: result.profile });
  return yield* Effect.forEach(result.rows, (binding) =>
    S.decodeUnknownEffect(row)(R.map(binding, (term) => term.value)).pipe(
      Effect.mapError((cause) => LibraryError.make({ message: "Cannot decode library view row", cause }))
    )
  );
});
/**
 * Decode schema-encoded payloads selected by an ordered view.
 * **Example** (Inspect viewRecords)
 * ```ts
 * import { viewRecords } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(viewRecords !== undefined)
 * ```
 * @category decoding
 * @since 0.0.0
 */
export const viewRecords = Effect.fn("Library.viewRecords")(function* <T, I>(
  dataset: Rdf.Dataset,
  query: string,
  schema: S.Codec<T, I>,
  includePrivate = false
) {
  const rows = yield* runView(dataset, query, LibraryViewRow, includePrivate);
  return yield* Effect.forEach(rows, (row) =>
    S.decodeEffect(S.fromJsonString(schema))(row.payload).pipe(
      Effect.mapError((cause) => LibraryError.make({ message: "Cannot decode selected library record", cause }))
    )
  );
});
const captureDisplayCategory = Effect.fnUntraced(function* (
  root: string,
  catalog: LibraryCatalog,
  capture: LibraryCapture
) {
  if (capture.status !== "blocked") return capture.status;
  const source = A.findFirst(catalog.sources, (s) => s.id === capture.sourceId);
  if (O.isNone(source)) return capture.status;
  const valid = yield* libraryDispositionValid(root, catalog, source.value, capture).pipe(
    Effect.orElseSucceed(() => false)
  );
  if (!valid) return capture.status;
  const artifact = A.findFirst(capture.artifacts, (a) => a.role === "reviewed-disposition");
  if (O.isNone(artifact)) return capture.status;
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const review = yield* fs
    .readFileString(path.resolve(root, artifact.value.path))
    .pipe(Effect.flatMap(S.decodeEffect(LibraryDispositionImportPayloadJson)), Effect.option);
  return O.getOrElse(
    O.map(
      O.filter(review, (r) => A.contains(["ambiguous", "incomplete", "tool-blocked"], r.disposition)),
      (r) => r.disposition
    ),
    () => capture.status
  );
});

/**
 * Assess filesystem evidence once and build one immutable dataset for a command.
 * **Example** (Inspect libraryViewDataset)
 * ```ts
 * import { libraryViewDataset } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(libraryViewDataset !== undefined)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const libraryViewDataset = Effect.fn("Library.viewDataset")(function* (
  root: string,
  catalog: LibraryCatalog,
  topics?: ReadonlyArray<LibraryTopic>
) {
  let evidence = HashMap.empty<string, string>();
  let readable = HashSet.empty<string>();
  const claims: Array<{ readonly sourceId: string; readonly revision: string; readonly category: string }> = [];
  const sourceEvidence = Effect.fnUntraced(function* (source: LibrarySource) {
    const current = yield* libraryEffectiveCaptures(root, catalog, source);
    evidence = HashMap.set(evidence, source.id, libraryEffectiveCategory(A.map(current, (claim) => claim.category)));
    A.forEach(current, (claim) => {
      evidence = HashMap.set(evidence, `${source.id}@${claim.revision}`, claim.category);
      claims.push({ sourceId: source.id, revision: claim.revision, category: claim.category });
      if (claim.category === "readable" && claim.capture !== null) readable = HashSet.add(readable, claim.capture.id);
    });
  });
  yield* Effect.forEach(catalog.sources, sourceEvidence);
  const repoRoot = yield* findRepoRoot().pipe(
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot resolve library topic repository", cause }))
  );
  const packetTopics =
    topics ??
    (yield* libraryTopics(repoRoot, false).pipe(
      Effect.mapError((cause) => LibraryError.make({ message: "Cannot discover library topics", cause }))
    ));
  const dataset = yield* catalogDataset(catalog, packetTopics, evidence).pipe(
    Effect.mapError((cause) => LibraryError.make({ message: "Cannot project library views", cause }))
  );
  const quads = A.fromIterable(dataset.quads);
  const privateSources = HashSet.fromIterable(
    A.flatMap(
      A.filter(catalog.sources, (source) => source.accessClass === "private"),
      (source: LibrarySource) => [source.id, ...source.aliasIds]
    )
  );
  const privateDocuments = HashSet.fromIterable(
    A.map(
      A.filter(catalog.documents, (document) => document.accessClass === "private"),
      (document) => document.id
    )
  );
  const addMetadata = (node: Rdf.NamedNode, metadata: Readonly<Record<string, string>>) =>
    A.forEach(R.toEntries(metadata), ([key, value]) =>
      quads.push(
        Rdf.makeQuad(node, Rdf.makeNamedNode(`${iri("term")}/${key}`), Rdf.makeLiteral(value, XSD_STRING.value))
      )
    );
  let sequence = 0;
  const add = <T, I>(
    kind: string,
    records: ReadonlyArray<T>,
    schema: S.Codec<T, I>,
    metadata: (record: T, index: number) => Readonly<Record<string, string>>
  ) =>
    Effect.forEach(
      records,
      Effect.fnUntraced(function* (record, order) {
        const meta = metadata(record, order);
        const id = meta.nodeId ?? (P.hasProperty(record, "id") && P.isString(record.id) ? record.id : `${sequence++}`);
        const node = entity(kind, id);
        const payload = yield* S.encodeEffect(S.fromJsonString(schema))(record).pipe(
          Effect.mapError((cause) => LibraryError.make({ message: "Cannot encode library view record", cause }))
        );
        quads.push(
          Rdf.makeQuad(
            node,
            Rdf.makeNamedNode(model.create("catalogIndex").iri),
            Rdf.makeLiteral(meta.order ?? `${order}`, XSD_INTEGER.value)
          )
        );
        const { nodeId: _nodeId, order: _order, ...annotations } = meta;
        addMetadata(node, { payload, private: "false", ...annotations });
      })
    );
  yield* add("Report", catalog.documents, LibraryDocument, (d) => ({
    id: d.id,
    private: `${HashSet.has(privateDocuments, d.id)}`,
  }));
  yield* add("Source", catalog.sources, LibrarySource, (s) => ({
    id: s.id,
    sourceKind: s.kind,
    repository: s.repository,
    private: `${HashSet.has(privateSources, s.id)}`,
  }));
  yield* add("Occurrence", catalog.occurrences, LibraryOccurrence, (o) => ({
    source: o.sourceId,
    document: o.documentId,
    private: `${HashSet.has(privateSources, o.sourceId) || HashSet.has(privateDocuments, o.documentId)}`,
  }));
  yield* add("Qualification", catalog.qualifications, LibraryQualification, (q) => ({ category: q.status }));
  for (const [captureOrder, capture] of A.map(
    catalog.captures,
    (c, i) => [i, c] satisfies readonly [number, LibraryCapture]
  )) {
    const category = yield* captureDisplayCategory(root, catalog, capture);
    yield* add("Capture", [capture], LibraryCapture, (c) => ({
      source: c.sourceId,
      id: c.id,
      order: `${captureOrder}`,
      private: `${HashSet.has(privateSources, c.sourceId)}`,
      category: c.status,
      displayCategory: category,
      readable: `${HashSet.has(readable, c.id)}`,
    }));
    yield* add("Artifact", capture.artifacts, LibraryArtifact, (a, index) => ({
      nodeId: `${capture.id}/artifacts/${index}/${a.sha256}`,
      capture: capture.id,
      private: `${a.accessClass === "private" || HashSet.has(privateSources, capture.sourceId)}`,
    }));
  }
  yield* add("Artifact", catalog.artifacts, LibraryArtifact, (a, index) => ({
    nodeId: `catalog/library.json/artifacts/${index}/${a.sha256}`,
    private: `${a.accessClass === "private"}`,
  }));
  for (const qualification of catalog.qualifications)
    yield* add("Artifact", qualification.evidence, LibraryArtifact, (a, index) => ({
      nodeId: `${qualification.id}/evidence/${index}/${a.sha256}`,
      private: `${a.accessClass === "private"}`,
    }));
  for (const finding of catalog.findings)
    quads.push(
      Rdf.makeQuad(
        entity("Finding", finding.id),
        Rdf.makeNamedNode(`${iri("term")}/private`),
        Rdf.makeLiteral(`${HashSet.has(privateSources, finding.sourceId)}`, XSD_STRING.value)
      )
    );
  // Claims include legacy sources with no explicit versions array.
  A.forEach(claims, (claim) => {
    const node = Rdf.makeNamedNode(iri(`row/${sequence++}`));
    addMetadata(node, {
      kind: "Claim",
      category: claim.category,
      private: `${HashSet.has(privateSources, claim.sourceId)}`,
    });
  });
  return Rdf.makeDataset(quads);
});

/**
 * Select current readable captures first, retaining append order within each group.
 * **Example** (Inspect capture order query)
 * ```ts
 * import { orderedSourceCaptures } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(orderedSourceCaptures("source").length)
 * ```
 * @param id - Source identity whose captures are ordered by readability.
 * @returns SPARQL query selecting current readable captures first, then catalog order.
 * @category queries
 * @since 0.0.0
 */
export const orderedSourceCaptures = (id: string) =>
  Str.replace("ORDER BY ?order", "ORDER BY DESC(?readable) ?order")(sourceCaptures(id));

/**
 * Select only validated current readable captures for one source.
 * **Example** (Inspect current capture query)
 * ```ts
 * import { readableSourceCaptures } from "@beep/repo-cli/commands/Research/Library/Library.views"
 * console.log(readableSourceCaptures("source").length)
 * ```
 * @param id - Source identity whose current readable captures are selected.
 * @returns SPARQL query selecting only validated current readable captures.
 * @category queries
 * @since 0.0.0
 */
export const readableSourceCaptures = (id: string) =>
  Str.replace("$VISIBILITY", '?record v:readable "true" . $VISIBILITY')(sourceCaptures(id));
