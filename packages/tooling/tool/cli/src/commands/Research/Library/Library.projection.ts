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
import * as Match from "effect/Match";
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
class Packet extends S.Opaque<Packet, { readonly brand: unique symbol }>()(
  S.Struct({
    initiative: S.Struct({ id: S.String, title: S.String }),
  }).pipe($I.annoteSchema("TopicPacket", { description: "Minimal packet topic metadata." }))
) {}

const PacketJson = S.fromJsonString(Packet);

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
export class LibraryTopic extends S.Opaque<LibraryTopic, { readonly brand: unique symbol }>()(
  S.Struct({
    id: S.String,
    initiativeId: S.String.pipe(
      S.withConstructorDefault(Effect.succeed("")),
      S.withDecodingDefaultKey(Effect.succeed(""))
    ),
    title: S.String,
  }).pipe($I.annoteSchema("LibraryTopic", { description: "Packet identifier and preferred title." }))
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
        .pipe(Effect.flatMap(S.decodeUnknownEffect(PacketJson)), Effect.option);
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
 * Evidence keys are source IDs or `sourceId@revision` for version assessments.
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
    Match.value(value).pipe(
      Match.when(P.isBoolean, (v) => Rdf.makeLiteral(`${v}`, XSD_BOOLEAN.value)),
      Match.when(P.isNumber, (v) => Rdf.makeLiteral(`${v}`, XSD_INTEGER.value)),
      Match.orElse((v) => Rdf.makeLiteral(P.isString(v) ? v : "", XSD_STRING.value))
    );
  const recordId = (name: string, record: unknown, fallback: string, owner: string) =>
    Match.value(name).pipe(
      Match.when("Artifact", () => `${fallback}/${text(record, "sha256")}`),
      Match.when(
        "SourceVersion",
        () => `${owner}@${text(record, "revision")}/${encodeURIComponent(text(record, "canonicalUrl"))}`
      ),
      Match.orElse(() => O.getOrElse(O.filter(O.some(text(record, "id")), Str.isNonEmpty), () => fallback))
    );
  const reference = (name: string, key: string, value: unknown): Rdf.ObjectTerm => {
    if (!P.isString(value)) return literal(value);
    const matched = HashMap.get(key === "intakeId" ? intakeNodes : known, value);
    if (A.contains(["derivedId", "intakeId"], key) && O.isSome(matched)) return matched.value;
    const ref = libraryReferenceClass(name, key);
    if (O.isNone(ref) || !Str.isNonEmpty(value)) return literal(value);
    if (ref.value === "Source") return O.getOrElse(HashMap.get(sourcesByAlias, value), () => iri("Source", value));
    return iri(ref.value, value);
  };
  const projectEvidence = (
    cls: AssembledClass,
    record: unknown,
    subject: Rdf.NamedNode,
    sourceId: string,
    owner: string
  ) => {
    if (cls.name === "SourceVersion")
      quads.push(Rdf.makeQuad(subject, nn(`${Prov.PROV_NAMESPACE}specializationOf`), iri("Source", owner)));
    const category = HashMap.get(
      evidence,
      cls.name === "SourceVersion" ? `${owner}@${text(record, "revision")}` : sourceId
    );
    if (A.contains(["Source", "SourceVersion"], cls.name) && O.isSome(category))
      quads.push(Rdf.makeQuad(subject, nn($I.create("effectiveCategory").iri), literal(category.value)));
  };
  const project = (cls: AssembledClass, record: unknown, fallback: string, owner: string): Rdf.NamedNode => {
    const sourceId = cls.name === "Source" ? text(record, "id") : owner;
    const id = recordId(cls.name, record, fallback, owner);
    const subject = iri(cls.name, id);
    quads.push(Rdf.makeQuad(subject, RDF_TYPE, nn(cls.iri)));
    const projectPredicate = (predicate: AssembledClass["predicates"][number]) => {
      const raw = get(record, predicate.key);
      if (raw === undefined) return;
      const values = A.isArray(raw) ? raw : [raw];
      A.forEach(values, (value, index) => {
        const object =
          predicate.kind === "object" && O.isSome(predicate.rangeIri)
            ? project(
                O.getOrThrow(A.findFirst(assembled.classes, (c) => c.iri === O.getOrThrow(predicate.rangeIri))),
                value,
                `${id}/${predicate.key}/${index}`,
                sourceId
              )
            : reference(cls.name, predicate.key, value);
        quads.push(Rdf.makeQuad(subject, nn(predicate.termIri), object));
      });
    };
    A.forEach(cls.predicates, projectPredicate);
    projectEvidence(cls, record, subject, sourceId, owner);
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
  const findingTopics = (finding: LibraryCatalog["findings"][number]) =>
    A.forEach(finding.topicIds, (id) => {
      const matches = A.filter(topics, (topic) => topic.id === id || topic.initiativeId === id);
      const targets = A.isReadonlyArrayNonEmpty(matches) ? A.map(matches, (topic) => topic.id) : [id];
      A.forEach(targets, (target) =>
        quads.push(Rdf.makeQuad(iri("Finding", finding.id), Skos.SKOS_RELATED, nn(topicIri(target))))
      );
    });
  A.forEach(catalog.findings, findingTopics);
  let seen = HashSet.empty<string>();
  const unique = A.filter(quads, (quad) => {
    const key = Rdf.serializeQuad(quad);
    if (HashSet.has(seen, key)) return false;
    seen = HashSet.add(seen, key);
    return true;
  });
  return Rdf.makeDataset(Rdf.sortDatasetQuads(Rdf.makeDataset(unique)));
});
