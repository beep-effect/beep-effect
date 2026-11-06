/**
 * Rebuildable RDF projection of the decoded catalog and packet topics.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import * as Rdf from "@beep/rdf/Rdf";
import * as Dcat from "@beep/rdf/Vocab/Dcat";
import * as Prov from "@beep/rdf/Vocab/Prov";
import { RDF_TYPE } from "@beep/rdf/Vocab/Rdf";
import * as Skos from "@beep/rdf/Vocab/Skos";
import { XSD_BOOLEAN, XSD_INTEGER, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { assembleLibraryOntology, libraryReferenceClass } from "./Library.ontology.ts";
import type { AssembledClass } from "@beep/ontology";
import type { LibraryCatalog } from "./Library.schemas.ts";

const $I = $RepoCliId.create("commands/Research/Library/Library.schemas");
const topicIri = (id: string) => $I.create(`Topic/${id}`).iri;
const get = (value: unknown, key: string): unknown => (P.hasProperty(value, key) ? value[key] : undefined);
const text = (value: unknown, key: string): string => {
  const item = get(value, key);
  return P.isString(item) ? item : "";
};
class Packet extends S.Class<Packet, { readonly brand: unique symbol }>($I`TopicPacket`)(
  {
    initiative: S.Struct({ id: S.String, title: S.String }),
  },
  $I.annote("TopicPacket", { description: "Minimal packet topic metadata." })
) {}

/**
 * Packet-backed SKOS concept metadata.
 * **Example** (Construct topic metadata)
 * ```ts
 * import { LibraryTopic } from "@beep/repo-cli/commands/Research/Library/Library.projection"
 * console.log(LibraryTopic.make({ id: "goals/example", title: "Example" }).id)
 * ```
 * @category models
 * @since 0.0.0
 */
export class LibraryTopic extends S.Class<LibraryTopic, { readonly brand: unique symbol }>($I`LibraryTopic`)(
  {
    id: S.String,
    initiativeId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    title: S.String,
  },
  $I.annote("LibraryTopic", { description: "Packet identifier and preferred title." })
) {}

/**
 * Read packet manifests without admitting their unrelated fields.
 * **Example** (Prepare topic discovery)
 * ```ts
 * import { libraryTopics } from "@beep/repo-cli/commands/Research/Library/Library.projection"
 * console.log(libraryTopics("/repo").pipe !== undefined)
 * ```
 * @category use-cases
 * @since 0.0.0
 */
export const libraryTopics = Effect.fn("Library.topics")(function* (repoRoot: string, reportWarnings = true) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const topics: Array<LibraryTopic> = [];
  let warnings = 0;
  for (const kind of ["goals", "explorations"]) {
    const directory = path.join(repoRoot, kind);
    const entries = yield* fs.readDirectory(directory).pipe(Effect.orElseSucceed(() => []));
    for (const slug of A.sort(entries, Str.Order)) {
      const packet = yield* fs
        .readFileString(path.join(directory, slug, "ops/manifest.json"))
        .pipe(Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(Packet))), Effect.option);
      if (O.isNone(packet)) {
        warnings++;
        continue;
      }
      topics.push(
        LibraryTopic.make({
          id: `${kind}/${slug}`,
          initiativeId: packet.value.initiative.id,
          title: packet.value.initiative.title,
        })
      );
    }
  }
  if (warnings > 0 && reportWarnings === true)
    yield* Effect.logWarning(`library topics: skipped=${warnings} unreadable manifests`);
  return topics;
});

/**
 * Project decoded catalog records using predicate IRIs supplied by the fold.
 * **Details**
 * Evidence keys are source IDs or sourceId@revision for version assessments.
 * Intake anchors become references only when the catalog contains the anchor.
 * **Example** (Inspect projection)
 * ```ts
 * import { catalogDataset } from "@beep/repo-cli/commands/Research/Library/Library.projection"
 * console.log(catalogDataset)
 * ```
 * @category projections
 * @since 0.0.0
 */
export const catalogDataset = Effect.fn("Library.catalogDataset")(function* (
  catalog: LibraryCatalog,
  topics: ReadonlyArray<LibraryTopic> = [],
  evidence: HashMap.HashMap<string, string> = HashMap.empty()
) {
  const assembled = yield* assembleLibraryOntology();
  const quads: Array<Rdf.Quad> = [];
  const nn = Rdf.makeNamedNode;
  const classByName = (name: string) => O.getOrThrow(A.findFirst(assembled.classes, (cls) => cls.name === name));
  const iri = (name: string, id: string) => nn(`${classByName(name).iri}/${encodeURIComponent(id)}`);
  const known = HashMap.fromIterable(
    A.flatMap(
      [
        ["Source", catalog.sources],
        ["Report", catalog.documents],
        ["Finding", catalog.findings],
        ["Capture", catalog.captures],
        ["Occurrence", catalog.occurrences],
        ["ModelRun", catalog.modelRuns],
        ["Intake", catalog.intakes],
        ["Derivation", catalog.derivations],
      ] satisfies ReadonlyArray<readonly [string, ReadonlyArray<{ readonly id: string }>]>,
      ([name, records]) =>
        A.map(records, (record) => [record.id, iri(name, record.id)] satisfies readonly [string, Rdf.NamedNode])
    )
  );
  const sourcesByAlias = HashMap.fromIterable(
    A.flatMap(catalog.sources, (source) =>
      A.map(
        [source.id, ...source.aliasIds],
        (id) => [id, iri("Source", source.id)] satisfies readonly [string, Rdf.NamedNode]
      )
    )
  );
  const intakeNodes = HashMap.fromIterable(
    A.map(catalog.intakes, (intake) => [intake.id, iri("Intake", intake.id)] satisfies readonly [string, Rdf.NamedNode])
  );
  const literal = (value: unknown): Rdf.Literal =>
    P.isBoolean(value)
      ? Rdf.makeLiteral(value ? "true" : "false", XSD_BOOLEAN.value)
      : P.isNumber(value)
        ? Rdf.makeLiteral(`${value}`, XSD_INTEGER.value)
        : Rdf.makeLiteral(P.isString(value) ? value : "", XSD_STRING.value);
  const project = (cls: AssembledClass, record: unknown, fallback: string, owner: string): Rdf.NamedNode => {
    const sourceId = cls.name === "Source" ? text(record, "id") : owner;
    const id =
      cls.name === "Artifact"
        ? `${fallback}/${text(record, "sha256")}`
        : cls.name === "SourceVersion"
          ? `${owner}@${text(record, "revision")}/${encodeURIComponent(text(record, "canonicalUrl"))}`
          : Str.isNonEmpty(text(record, "id"))
            ? text(record, "id")
            : fallback;
    const subject = iri(cls.name, id);
    quads.push(Rdf.makeQuad(subject, RDF_TYPE, nn(cls.iri)));
    for (const predicate of cls.predicates) {
      const raw = get(record, predicate.key);
      if (raw === undefined) continue;
      const values = A.isArray(raw) ? raw : [raw];
      for (const [index, value] of A.map(values, (v, i) => [i, v] satisfies readonly [number, unknown])) {
        let object: Rdf.ObjectTerm;
        if (predicate.kind === "object" && O.isSome(predicate.rangeIri)) {
          const rangeIri = predicate.rangeIri.value;
          const child = O.getOrThrow(A.findFirst(assembled.classes, (c) => c.iri === rangeIri));
          object = project(child, value, `${id}/${predicate.key}/${index}`, sourceId);
        } else {
          const ref = libraryReferenceClass(cls.name, predicate.key);
          const matched = P.isString(value)
            ? HashMap.get(predicate.key === "intakeId" ? intakeNodes : known, value)
            : O.none();
          const contextual = A.contains(["derivedId", "intakeId"], predicate.key);
          object =
            contextual && O.isSome(matched)
              ? matched.value
              : O.isSome(ref) && P.isString(value) && Str.isNonEmpty(value)
                ? ref.value === "Source"
                  ? O.getOrElse(HashMap.get(sourcesByAlias, value), () => iri("Source", value))
                  : iri(ref.value, value)
                : literal(value);
        }
        quads.push(Rdf.makeQuad(subject, nn(predicate.termIri), object));
      }
    }
    if (cls.name === "SourceVersion")
      quads.push(Rdf.makeQuad(subject, nn(`${Prov.PROV_NAMESPACE}specializationOf`), iri("Source", owner)));
    const category = HashMap.get(
      evidence,
      cls.name === "SourceVersion" ? `${owner}@${text(record, "revision")}` : sourceId
    );
    if (A.contains(["Source", "SourceVersion"], cls.name) && O.isSome(category))
      quads.push(Rdf.makeQuad(subject, nn($I.create("effectiveCategory").iri), literal(category.value)));
    return subject;
  };
  const catalogNode = project(classByName("Catalog"), catalog, "catalog/library.json", "");
  quads.push(Rdf.makeQuad(catalogNode, RDF_TYPE, Dcat.DCAT_DATASET));
  const distribution = nn($I.create("Distribution/catalog/library.json").iri);
  quads.push(
    Rdf.makeQuad(catalogNode, Dcat.DCAT_DISTRIBUTION_PREDICATE, distribution),
    Rdf.makeQuad(distribution, RDF_TYPE, Dcat.DCAT_DISTRIBUTION)
  );
  for (const [name, records] of [
    ["Report", catalog.documents],
    ["Source", catalog.sources],
    ["Qualification", catalog.qualifications],
  ] satisfies ReadonlyArray<readonly [string, ReadonlyArray<{ readonly id: string }>]>) {
    for (const [index, record] of A.map(records, (v, i) => [i, v] satisfies readonly [number, { readonly id: string }]))
      quads.push(Rdf.makeQuad(iri(name, record.id), nn($I.create("catalogIndex").iri), literal(index)));
  }
  for (const run of catalog.modelRuns) {
    const agent = nn($I.create(`SoftwareAgent/${encodeURIComponent(run.model)}/${encodeURIComponent(run.effort)}`).iri);
    quads.push(
      Rdf.makeQuad(agent, RDF_TYPE, Prov.PROV_SOFTWARE_AGENT),
      Rdf.makeQuad(iri("ModelRun", run.id), Prov.PROV_WAS_ASSOCIATED_WITH, agent)
    );
  }
  const scheme = nn($I.create("Topic").iri);
  quads.push(Rdf.makeQuad(scheme, RDF_TYPE, Skos.SKOS_CONCEPT_SCHEME));
  for (const topic of topics) {
    const concept = nn(topicIri(topic.id));
    quads.push(
      Rdf.makeQuad(concept, RDF_TYPE, Skos.SKOS_CONCEPT),
      Rdf.makeQuad(concept, Skos.SKOS_IN_SCHEME, scheme),
      Rdf.makeQuad(concept, Skos.SKOS_PREF_LABEL, literal(topic.title))
    );
  }
  for (const finding of catalog.findings) {
    for (const id of finding.topicIds) {
      const matches = A.filter(topics, (topic) => topic.id === id || topic.initiativeId === id);
      const targets = A.isReadonlyArrayNonEmpty(matches) ? A.map(matches, (topic) => topic.id) : [id];
      for (const target of targets)
        quads.push(Rdf.makeQuad(iri("Finding", finding.id), Skos.SKOS_RELATED, nn(topicIri(target))));
    }
  }
  let seen = HashSet.empty<string>();
  const unique = A.filter(quads, (quad) => {
    const key = Rdf.serializeQuad(quad);
    if (HashSet.has(seen, key)) return false;
    seen = HashSet.add(seen, key);
    return true;
  });
  return Rdf.makeDataset(Rdf.sortDatasetQuads(Rdf.makeDataset(unique)));
});
