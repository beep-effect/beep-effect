/**
 * The nanopublication adapter of `@beep/epistemics`: one checked claim record
 * and its explicit publication metadata written as a four-graph
 * nanopublication, and a declared profile of such datasets read back.
 *
 * **Details**
 *
 * The profile is restricted, not a reader of arbitrary third-party RDF. A
 * head graph links one assertion, provenance and publication-info graph
 * through the `np:` terms. The assertion carries the canonical encoded core as
 * one `epistemic:coreJson` literal typed `rdf:JSON`; the provenance graph
 * names the generating activity and the asserting agent with the assertion
 * graph as subject; publication info names the publisher, the publication
 * time and an optional source digest with the publication as subject.
 *
 * - {@link mintNanopubId} hashes the claim id and the canonical publication
 *   metadata under `nanopub/v1`; {@link nanopubIris} derives the publication
 *   and its four graph names from that id.
 * - `decode` rechecks the core, re-mints the claim id, recomputes the
 *   publication id and compares all five names byte for byte. Foreign names
 *   are rejected import metadata and failed integrity is a refusal, both with
 *   the original input. Quads outside the profile stay residual.
 * - `normalize` runs only after the same checks and sorts and deduplicates the
 *   accepted profile quads, so `encode(decode(s).accepted)` and
 *   `normalize(s)` are one quad set.
 *
 * No hash of RDF is computed, and admission or token data never enter the
 * profile. This subpath is the only module of the package that reaches
 * `@beep/rdf`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { $EpistemicsId } from "@beep/identity/packages";
import { iri, mint } from "@beep/identity/Registry";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { definePreimage } from "@beep/jsonc/Mint";
import { instanceHash, instanceIri } from "@beep/rdf/InstanceIri";
import * as Rdf from "@beep/rdf/Rdf";
import { ContentHash, DomainTag } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ClaimCoreInvalid, ClaimId, ClaimPreimage, makeClaimRecords } from "../ClaimCore.ts";
import type { PreimageMintError } from "@beep/jsonc/Mint";
import type { ActivityId } from "@beep/schema/ContentHash";
import type * as Digest from "effect/crypto/Digest";
import type { makeClaimArrows } from "../ClaimCore.ts";
import type { SchemaIdentity } from "../Factory/index.ts";

const $I = $EpistemicsId.create("rdf/NanopubCodec");

/**
 * The `nanopub/v1` content address of one publication: a claim id and its
 * canonical publication metadata.
 *
 * **Example** (Brand a publication digest)
 *
 * ```ts
 * import { NanopubId } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NanopubId)(`sha256:${"a".repeat(64)}`))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubId = ContentHash.pipe(
  S.brand("NanopubId"),
  $I.annoteSchema("NanopubId", {
    description: "The nanopub/v1 content address of a claim id and its canonical publication metadata.",
  })
);

/**
 * Decoded type of {@link NanopubId}.
 *
 * @category models
 * @since 0.0.0
 */
export type NanopubId = typeof NanopubId.Type;

/**
 * Explicit publication metadata: who published, when, and the digest of the
 * source the publication was made from, if any. No field has a default.
 *
 * **Example** (Make publication metadata)
 *
 * ```ts
 * import { PublicationMetadata } from "@beep/epistemics/rdf/NanopubCodec"
 * import { IRI } from "@beep/identity/Iri"
 * import * as DateTime from "effect/DateTime"
 * import * as O from "effect/Option"
 *
 * const metadata = PublicationMetadata.make({
 *   publisher: IRI.make("https://example.org/publisher"),
 *   publishedAt: DateTime.makeUnsafe(1000),
 *   sourceDigest: O.none(),
 * })
 * console.log(metadata.publisher)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PublicationMetadata extends S.Opaque<PublicationMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    publisher: IRI.annotateKey({ description: "The IRI of the publishing agent." }),
    publishedAt: S.DateTimeUtcFromMillis.annotateKey({ description: "When the publication was made." }),
    sourceDigest: S.OptionFromOptionalKey(Sha256PrefixedDigest).annotateKey({
      description: "The SHA-256 of the source the publication was made from; omitted when there is none.",
    }),
  }).pipe(
    $I.annoteSchema("PublicationMetadata", {
      description: "Publisher, publication time and optional source digest of one nanopublication.",
    })
  )
) {}

/**
 * The `nanopub/v1` preimage over a claim id and its encoded publication
 * metadata, with its committed golden vector.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts
 * import { NanopubPreimage } from "@beep/epistemics/rdf/NanopubCodec"
 *
 * console.log(NanopubPreimage.domainTag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubPreimage = definePreimage({
  domainTag: DomainTag.make("nanopub/v1"),
  schema: S.Tuple([ClaimId, PublicationMetadata]),
  golden: {
    preimage: [
      "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      { publisher: "https://example.org/publisher", publishedAt: 1000 },
    ],
    hash: ContentHash.make("sha256:9dc83c31afa5a7ea916e6b251bab9295a8b0ee6ad02b2c46a2ec59343595d8a5"),
  },
});

/**
 * The `nanopub-agent/v1` preimage over one encoded asserting agent: the
 * provenance graph names the agent by the instance IRI of this hash.
 *
 * **Example** (Read the domain tag)
 *
 * ```ts
 * import { NanopubAgentPreimage } from "@beep/epistemics/rdf/NanopubCodec"
 *
 * console.log(NanopubAgentPreimage.domainTag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubAgentPreimage = definePreimage({
  domainTag: DomainTag.make("nanopub-agent/v1"),
  schema: S.Tuple([S.Json]),
  golden: {
    preimage: [{ _tag: "Person", principal: "fixture" }],
    hash: ContentHash.make("sha256:1b83e19ee6c45de593bd100226e92600e4b95eb14e1d652d36df79758ae81afe"),
  },
});

/**
 * Mint the publication id of a claim and its metadata under `nanopub/v1`.
 *
 * **Example** (Mint a publication id)
 *
 * ```ts
 * import { ClaimId } from "@beep/epistemics/ClaimCore"
 * import { mintNanopubId, PublicationMetadata } from "@beep/epistemics/rdf/NanopubCodec"
 * import { IRI } from "@beep/identity/Iri"
 * import * as Digest from "effect/crypto/Digest"
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 *
 * const id = mintNanopubId(
 *   ClaimId.make(`sha256:${"a".repeat(64)}`),
 *   PublicationMetadata.make({
 *     publisher: IRI.make("https://example.org/publisher"),
 *     publishedAt: DateTime.makeUnsafe(1000),
 *     sourceDigest: O.none(),
 *   })
 * ).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(typeof id)
 * ```
 *
 * @param claim - The checked claim id.
 * @param metadata - The explicit publication metadata.
 * @returns The publication id.
 * @category constructors
 * @since 0.0.0
 */
export const mintNanopubId = Effect.fn("NanopubCodec.mintNanopubId")(function* (
  claim: ClaimId,
  metadata: PublicationMetadata
): Effect.fn.Return<NanopubId, PreimageMintError, Digest.Digest> {
  const hash = yield* NanopubPreimage.mint([claim, metadata]);
  return NanopubId.make(hash);
});

/**
 * The five pairwise-distinct names one publication id derives: the
 * publication and its head, assertion, provenance and publication-info graphs.
 *
 * **Example** (Read a derived graph name)
 *
 * ```ts
 * import { NanopubId, nanopubIris } from "@beep/epistemics/rdf/NanopubCodec"
 *
 * console.log(nanopubIris(NanopubId.make(`sha256:${"a".repeat(64)}`)).assertion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NanopubIris extends S.Opaque<NanopubIris, { readonly brand: unique symbol }>()(
  S.Struct({
    publication: IRI.annotateKey({ description: "The publication, typed np:Nanopublication in the head." }),
    head: IRI.annotateKey({ description: "The head graph." }),
    assertion: IRI.annotateKey({ description: "The assertion graph." }),
    provenance: IRI.annotateKey({ description: "The provenance graph." }),
    pubinfo: IRI.annotateKey({ description: "The publication-info graph." }),
  }).pipe(
    $I.annoteSchema("NanopubIris", {
      description: "The publication and four graph names derived from one publication id.",
    })
  )
) {}

const instanceSegment = Str.replace("sha256:", "sha256-");

/**
 * Derive the publication IRI and its four graph names from a publication id.
 *
 * **Example** (Derive the publication IRI)
 *
 * ```ts
 * import { NanopubId, nanopubIris } from "@beep/epistemics/rdf/NanopubCodec"
 *
 * console.log(nanopubIris(NanopubId.make(`sha256:${"a".repeat(64)}`)).publication)
 * ```
 *
 * @param id - The publication id.
 * @returns The five derived names.
 * @category constructors
 * @since 0.0.0
 */
export const nanopubIris = (id: NanopubId): NanopubIris => {
  const graph = (name: string) => IRI.make(mint("instance", instanceSegment(id), name));
  return NanopubIris.make({
    publication: instanceIri(id),
    head: graph("head"),
    assertion: graph("assertion"),
    provenance: graph("provenance"),
    pubinfo: graph("pubinfo"),
  });
};

/**
 * The registry terms of the declared nanopublication profile.
 *
 * **Example** (Check a profile term)
 *
 * ```ts
 * import { NanopubProfileTerm } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NanopubProfileTerm)("np:hasAssertion"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubProfileTerm = LiteralKit([
  "rdf:type",
  "rdf:JSON",
  "np:Nanopublication",
  "np:hasAssertion",
  "np:hasProvenance",
  "np:hasPublicationInfo",
  "epistemic:coreJson",
  "epistemic:sourceDigest",
  "prov:wasGeneratedBy",
  "prov:wasAttributedTo",
  "dcterms:publisher",
  "dcterms:created",
  "xsd:dateTime",
  "xsd:string",
]).pipe($I.annoteSchema("NanopubProfileTerm", { description: "The registry terms of the nanopublication profile." }));

/**
 * Type for {@link NanopubProfileTerm}.
 *
 * @category models
 * @since 0.0.0
 */
export type NanopubProfileTerm = typeof NanopubProfileTerm.Type;

/**
 * Why a dataset is not an accepted publication of the declared profile.
 *
 * **Example** (Check a refusal reason)
 *
 * ```ts
 * import { NanopubRefusal } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NanopubRefusal)("stale-publication-id"))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubRefusal = LiteralKit([
  "blank-graph-name",
  "publication-count",
  "blank-publication",
  "default-graph",
  "missing-head-edge",
  "head-cardinality",
  "graph-collision",
  "graph-mixing",
  "wrong-derived-iri",
  "invalid-core",
  "core-hash-mismatch",
  "provenance-mismatch",
  "invalid-publication-metadata",
  "stale-publication-id",
]).pipe(
  $I.annoteSchema("NanopubRefusal", {
    description: "Why a dataset is refused as a publication of the declared nanopublication profile.",
  })
);

/**
 * Type for {@link NanopubRefusal}.
 *
 * @category models
 * @since 0.0.0
 */
export type NanopubRefusal = typeof NanopubRefusal.Type;

/**
 * A refused dataset, with its reason and the original input.
 *
 * **Example** (Refuse an empty dataset)
 *
 * ```ts
 * import { NanopubRefused } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as Rdf from "@beep/rdf/Rdf"
 *
 * console.log(NanopubRefused.make({ reason: "publication-count", input: Rdf.makeDataset([]) })._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NanopubRefused extends S.Opaque<NanopubRefused, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Refused", {
    reason: NanopubRefusal,
    input: Rdf.Dataset,
  }).pipe(
    $I.annoteSchema("NanopubRefused", {
      description: "A dataset outside the profile or failing integrity, kept as the input gave it.",
    })
  )
) {}

/**
 * A well-formed publication whose name is not a native instance IRI: rejected
 * import metadata, never an accepted native-profile publication.
 *
 * **Example** (Reject a foreign publication)
 *
 * ```ts
 * import { NanopubForeign } from "@beep/epistemics/rdf/NanopubCodec"
 * import { IRI } from "@beep/identity/Iri"
 * import * as Rdf from "@beep/rdf/Rdf"
 *
 * const foreign = NanopubForeign.make({
 *   publication: IRI.make("https://example.org/np/1"),
 *   input: Rdf.makeDataset([]),
 * })
 * console.log(foreign._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NanopubForeign extends S.Opaque<NanopubForeign, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Foreign", {
    publication: IRI.annotateKey({ description: "The foreign publication name as the input wrote it." }),
    input: Rdf.Dataset,
  }).pipe(
    $I.annoteSchema("NanopubForeign", {
      description: "A publication under a foreign name, rejected as import metadata with its original input.",
    })
  )
) {}

/**
 * The normal form of an accepted publication: its profile quads sorted and
 * deduplicated, and the residual kept apart.
 *
 * **Example** (Make an empty normal form)
 *
 * ```ts
 * import { NanopubNormalized } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as Rdf from "@beep/rdf/Rdf"
 *
 * const normal = NanopubNormalized.make({ dataset: Rdf.makeDataset([]), residual: Rdf.makeDataset([]) })
 * console.log(normal._tag)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NanopubNormalized extends S.Opaque<NanopubNormalized, { readonly brand: unique symbol }>()(
  S.TaggedStruct("Normalized", {
    dataset: Rdf.Dataset,
    residual: Rdf.Dataset,
  }).pipe(
    $I.annoteSchema("NanopubNormalized", {
      description: "The sorted, deduplicated profile quads of an accepted publication and its residual.",
    })
  )
) {}

/**
 * A normal form, a foreign publication or a refusal.
 *
 * **Example** (Match a normalize result)
 *
 * ```ts
 * import { NanopubNormalizeResult, NanopubRefused } from "@beep/epistemics/rdf/NanopubCodec"
 * import * as Rdf from "@beep/rdf/Rdf"
 *
 * const result: NanopubNormalizeResult = NanopubRefused.make({
 *   reason: "publication-count",
 *   input: Rdf.makeDataset([]),
 * })
 * console.log(NanopubNormalizeResult.guards.Refused(result))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const NanopubNormalizeResult = S.Union([NanopubNormalized, NanopubForeign, NanopubRefused]).pipe(
  $I.annoteSchema("NanopubNormalizeResult", {
    description: "The normal form of an accepted publication, a foreign publication or a refusal.",
  }),
  S.toTaggedUnion("_tag")
);

/**
 * Type for {@link NanopubNormalizeResult}.
 *
 * @category models
 * @since 0.0.0
 */
export type NanopubNormalizeResult = typeof NanopubNormalizeResult.Type;

const node = (value: string): Rdf.NamedNode => Rdf.makeNamedNode(value);

const term = (curie: NanopubProfileTerm): Rdf.NamedNode => node(iri(curie));

const V = {
  type: term("rdf:type"),
  Nanopublication: term("np:Nanopublication"),
  hasAssertion: term("np:hasAssertion"),
  hasProvenance: term("np:hasProvenance"),
  hasPublicationInfo: term("np:hasPublicationInfo"),
  coreJson: term("epistemic:coreJson"),
  sourceDigest: term("epistemic:sourceDigest"),
  wasGeneratedBy: term("prov:wasGeneratedBy"),
  wasAttributedTo: term("prov:wasAttributedTo"),
  publisher: term("dcterms:publisher"),
  created: term("dcterms:created"),
};

const json = iri("rdf:JSON");
const xsdDateTime = iri("xsd:dateTime");
const xsdString = iri("xsd:string");

const GraphRole = LiteralKit(["head", "assertion", "provenance", "pubinfo"]).pipe(
  $I.annoteSchema("GraphRole", { description: "The four named graphs of one nanopublication." })
);

type GraphRole = typeof GraphRole.Type;

const homeOf = HashMap.make(
  [V.hasAssertion.value, GraphRole.Enum.head],
  [V.hasProvenance.value, GraphRole.Enum.head],
  [V.hasPublicationInfo.value, GraphRole.Enum.head],
  [V.coreJson.value, GraphRole.Enum.assertion],
  [V.wasGeneratedBy.value, GraphRole.Enum.provenance],
  [V.wasAttributedTo.value, GraphRole.Enum.provenance],
  [V.publisher.value, GraphRole.Enum.pubinfo],
  [V.created.value, GraphRole.Enum.pubinfo],
  [V.sourceDigest.value, GraphRole.Enum.pubinfo]
);

const isPublicationType = (quad: Rdf.Quad): boolean =>
  quad.predicate.value === V.type.value &&
  Rdf.NamedNode.is(quad.object) &&
  quad.object.value === V.Nanopublication.value;

const profileHome = (quad: Rdf.Quad): O.Option<GraphRole> =>
  isPublicationType(quad) ? O.some(GraphRole.Enum.head) : HashMap.get(homeOf, quad.predicate.value);

const quad = (subject: Rdf.Subject, predicate: Rdf.NamedNode, object: Rdf.ObjectTerm, graph: IRI): Rdf.Quad =>
  Rdf.Quad.make({ subject, predicate, object, graph: node(graph) });

const keyOf = (quads: ReadonlyArray<Rdf.Quad>): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(quads, Rdf.serializeQuad));

const dedupeQuads = (quads: ReadonlyArray<Rdf.Quad>): ReadonlyArray<Rdf.Quad> =>
  A.dedupeWith(quads, (left, right) => Rdf.serializeQuad(left) === Rdf.serializeQuad(right));

const decodeTime = S.decodeUnknownOption(S.DateTimeUtcFromString);
const decodeDigest = S.decodeUnknownOption(Sha256PrefixedDigest);

const headQuads = (iris: NanopubIris): ReadonlyArray<Rdf.Quad> => {
  const publication = node(iris.publication);
  return [
    quad(publication, V.type, V.Nanopublication, iris.head),
    quad(publication, V.hasAssertion, node(iris.assertion), iris.head),
    quad(publication, V.hasProvenance, node(iris.provenance), iris.head),
    quad(publication, V.hasPublicationInfo, node(iris.pubinfo), iris.head),
  ];
};

const assertionQuad = (iris: NanopubIris, claim: Rdf.NamedNode, coreText: string): Rdf.Quad =>
  quad(claim, V.coreJson, Rdf.Literal.typed(coreText, json), iris.assertion);

const provenanceQuads = (iris: NanopubIris, generatedBy: ActivityId, agent: IRI): ReadonlyArray<Rdf.Quad> => [
  quad(node(iris.assertion), V.wasGeneratedBy, node(instanceIri(generatedBy)), iris.provenance),
  quad(node(iris.assertion), V.wasAttributedTo, node(agent), iris.provenance),
];

const pubinfoQuads = (iris: NanopubIris, metadata: PublicationMetadata): ReadonlyArray<Rdf.Quad> => {
  const publication = node(iris.publication);
  return [
    quad(publication, V.publisher, node(metadata.publisher), iris.pubinfo),
    quad(
      publication,
      V.created,
      Rdf.Literal.typed(DateTime.formatIso(metadata.publishedAt), xsdDateTime),
      iris.pubinfo
    ),
    ...A.map(A.fromOption(metadata.sourceDigest), (digest) =>
      quad(publication, V.sourceDigest, Rdf.Literal.typed(digest, xsdString), iris.pubinfo)
    ),
  ];
};

const single = <A>(values: ReadonlyArray<A>): O.Option<A> => (A.length(values) === 1 ? A.head(values) : O.none());

const objectsOf = (quads: ReadonlyArray<Rdf.Quad>, predicate: Rdf.NamedNode): ReadonlyArray<Rdf.ObjectTerm> =>
  A.map(
    A.filter(quads, (q) => q.predicate.value === predicate.value),
    (q) => q.object
  );

const literalValue = (value: Rdf.ObjectTerm): O.Option<string> =>
  Rdf.Literal.is(value) ? O.some(value.value) : O.none();

const readMetadata = (quads: ReadonlyArray<Rdf.Quad>): O.Option<PublicationMetadata> => {
  const digests = objectsOf(quads, V.sourceDigest);
  return O.map(
    O.all({
      publisher: pipe(
        single(objectsOf(quads, V.publisher)),
        O.filter(Rdf.NamedNode.is),
        O.map((publisher) => publisher.value)
      ),
      publishedAt: pipe(single(objectsOf(quads, V.created)), O.flatMap(literalValue), O.flatMap(decodeTime)),
      sourceDigest: A.isReadonlyArrayEmpty(digests)
        ? O.some(O.none())
        : pipe(single(digests), O.flatMap(literalValue), O.flatMap(decodeDigest), O.map(O.some)),
    }),
    PublicationMetadata.make
  );
};

const sameTerm = (left: Rdf.Term, right: Rdf.Term): boolean => Rdf.serializeTerm(left) === Rdf.serializeTerm(right);

const isBlank = S.is(Rdf.BlankNode);

const sameIris = S.toEquivalence(NanopubIris);

const headEdge = (headEdges: ReadonlyArray<Rdf.Quad>, predicate: Rdf.NamedNode): Result.Result<IRI, NanopubRefusal> => {
  const targets = A.dedupeWith(objectsOf(headEdges, predicate), sameTerm);
  return O.match(single(targets), {
    onNone: () => Result.fail(A.isReadonlyArrayEmpty(targets) ? "missing-head-edge" : "head-cardinality"),
    onSome: (target) =>
      Rdf.NamedNode.is(target)
        ? Result.succeed(target.value)
        : Result.fail(isBlank(target) ? "blank-graph-name" : "missing-head-edge"),
  });
};

const AssertedByJson = S.Struct({ assertedBy: S.Json });
const decodeAssertedBy = S.decodeUnknownEffect(AssertedByJson);

/**
 * Bind the nanopublication profile to an owner's claim core.
 *
 * **Details**
 *
 * `encode` takes a checked claim record and explicit publication metadata and
 * refuses a record whose key does not re-mint from its core. `decode` returns
 * an accepted publication with its residual, a foreign publication or a
 * refusal, each with the original input where it is not accepted. `normalize`
 * returns the accepted profile quads sorted and deduplicated, or the same
 * foreign or refused value.
 *
 * **Example** (Bind the codec to an owner core)
 *
 * ```ts
 * import { makeClaimCore } from "@beep/epistemics/ClaimCore.schema"
 * import { makeNanopubCodec } from "@beep/epistemics/rdf/NanopubCodec"
 * import { $ScratchpadId } from "@beep/identity/packages"
 * import * as S from "effect/Schema"
 *
 * const binding = makeClaimCore({ $I: $ScratchpadId.create("Claims"), proposition: S.NonEmptyString,
 *   ids: { logicalKey: (p) => p, scope: S.NonEmptyString, principal: S.NonEmptyString,
 *     action: S.NonEmptyString, revision: S.NonEmptyString } })
 * console.log(typeof makeNanopubCodec({ binding }).decode)
 * ```
 *
 * @param options - The owner binding whose claim core the profile carries.
 * @returns The profile schemas and the encode, decode and normalize arrows.
 * @category factories
 * @since 0.0.0
 */
export const makeNanopubCodec = <CoreCodec extends Parameters<typeof makeClaimArrows>[0]["ClaimCore"]>(options: {
  readonly binding: { readonly $I: SchemaIdentity; readonly ClaimCore: CoreCodec };
}) => {
  const { $I: owner, ClaimCore } = options.binding;
  const { ClaimRecord } = makeClaimRecords({ $I: owner, core: ClaimCore });
  type Core = CoreCodec["Type"];
  const NanopubPublication = S.Struct({ record: ClaimRecord, metadata: PublicationMetadata }).pipe(
    owner.annoteSchema("NanopubPublication", {
      description: "A checked claim record and the explicit metadata of its publication.",
    })
  );
  const NanopubAccepted = S.TaggedStruct("Accepted", {
    accepted: NanopubPublication,
    publication: NanopubId,
    residual: Rdf.Dataset,
  }).pipe(
    owner.annoteSchema("NanopubAccepted", {
      description: "An accepted profile publication, its recomputed id and the quads outside the profile.",
    })
  );
  const NanopubDecodeResult = S.Union([NanopubAccepted, NanopubForeign, NanopubRefused]).pipe(
    owner.annoteSchema("NanopubDecodeResult", {
      description: "An accepted publication, a foreign publication or a refusal.",
    }),
    S.toTaggedUnion("_tag")
  );
  type Publication = typeof NanopubPublication.Type;
  const CoreJson = S.toCodecJson(ClaimCore);
  const encodeCore = S.encodeEffect(CoreJson);
  const decodeCoreText = S.decodeUnknownEffect(S.fromJsonString(CoreJson));
  const canonical = Effect.fnUntraced(function* (core: Core) {
    const encoded = yield* encodeCore(core);
    const text = yield* JsoncFingerprint.canonicalize(encoded);
    const claimHash = yield* ClaimPreimage.mint([encoded]);
    const { assertedBy } = yield* decodeAssertedBy(encoded);
    const agentHash = yield* NanopubAgentPreimage.mint([assertedBy]);
    return { text, claim: ClaimId.make(claimHash), agent: instanceIri(agentHash) };
  });

  const encode = Effect.fn("NanopubCodec.encode")(function* (publication: Publication) {
    const { record, metadata } = publication;
    const { text, claim, agent } = yield* canonical(record.core);
    if (!Eq.equals(claim, record.claim)) return yield* ClaimCoreInvalid.make({ reason: "key-mismatch" });
    const id = yield* mintNanopubId(claim, metadata);
    const iris = nanopubIris(id);
    yield* Effect.annotateCurrentSpan({ "claim.id": claim, "nanopub.publication": iris.publication });
    return Rdf.makeDataset([
      ...headQuads(iris),
      assertionQuad(iris, node(instanceIri(claim)), text),
      ...provenanceQuads(iris, record.core.generatedBy, agent),
      ...pubinfoQuads(iris, metadata),
    ]);
  });

  const read = Effect.fnUntraced(function* (input: Rdf.Dataset) {
    const refused = (reason: NanopubRefusal) => NanopubRefused.make({ reason, input });
    const quads = A.fromIterable(input.quads);
    if (A.some(quads, (q) => isBlank(q.graph))) return refused("blank-graph-name");
    const typed = A.filter(quads, isPublicationType);
    const subject = single(
      A.dedupeWith(
        A.map(typed, (q) => q.subject),
        sameTerm
      )
    );
    if (O.isNone(subject)) return refused("publication-count");
    if (!Rdf.NamedNode.is(subject.value)) return refused("blank-publication");
    const publication = subject.value;
    const headGraph = single(
      A.dedupeWith(
        A.map(typed, (q) => q.graph),
        sameTerm
      )
    );
    if (O.isNone(headGraph)) return refused("graph-mixing");
    if (!Rdf.NamedNode.is(headGraph.value)) return refused("default-graph");
    const head = headGraph.value.value;
    const headEdges = A.filter(quads, (q) => q.graph.value === head && q.subject.value === publication.value);
    const edges = Result.all({
      assertion: headEdge(headEdges, V.hasAssertion),
      provenance: headEdge(headEdges, V.hasProvenance),
      pubinfo: headEdge(headEdges, V.hasPublicationInfo),
    });
    if (Result.isFailure(edges)) return refused(edges.failure);
    const iris = NanopubIris.make({ publication: publication.value, head, ...edges.success });
    const names = [iris.publication, iris.head, iris.assertion, iris.provenance, iris.pubinfo];
    if (HashSet.size(HashSet.fromIterable(names)) !== A.length(names)) return refused("graph-collision");
    const native = instanceHash(iris.publication);
    if (O.isNone(native)) return NanopubForeign.make({ publication: iris.publication, input });
    const publicationId = NanopubId.make(native.value);
    if (!sameIris(iris, nanopubIris(publicationId))) return refused("wrong-derived-iri");
    const roles: HashMap.HashMap<string, GraphRole> = HashMap.make(
      [iris.head, GraphRole.Enum.head],
      [iris.assertion, GraphRole.Enum.assertion],
      [iris.provenance, GraphRole.Enum.provenance],
      [iris.pubinfo, GraphRole.Enum.pubinfo]
    );
    const placed = A.getSomes(
      A.map(quads, (q) =>
        O.map(O.all([HashMap.get(roles, q.graph.value), profileHome(q)]), ([role, home]) => ({ quad: q, role, home }))
      )
    );
    if (A.some(placed, ({ role, home }) => role !== home)) return refused("graph-mixing");
    const profile = dedupeQuads(A.map(placed, ({ quad }) => quad));
    const inRole = (role: GraphRole) => A.filter(profile, (q) => O.contains(HashMap.get(roles, q.graph.value), role));
    if (!Eq.equals(keyOf(inRole("head")), keyOf(headQuads(iris)))) return refused("head-cardinality");
    const claimQuad = single(inRole("assertion"));
    if (O.isNone(claimQuad) || !Rdf.NamedNode.is(claimQuad.value.subject)) return refused("invalid-core");
    const claimNode = claimQuad.value.subject;
    const coreText = literalValue(claimQuad.value.object);
    if (O.isNone(coreText)) return refused("invalid-core");
    const core = yield* Effect.option(decodeCoreText(coreText.value));
    if (O.isNone(core)) return refused("invalid-core");
    const checked = yield* canonical(core.value);
    if (Rdf.serializeQuad(assertionQuad(iris, claimNode, checked.text)) !== Rdf.serializeQuad(claimQuad.value))
      return refused("invalid-core");
    if (!O.contains(instanceHash(claimNode.value), checked.claim)) return refused("core-hash-mismatch");
    const expectedProvenance = provenanceQuads(iris, core.value.generatedBy, checked.agent);
    if (!Eq.equals(keyOf(inRole("provenance")), keyOf(expectedProvenance))) return refused("provenance-mismatch");
    const pubinfoProfile = inRole("pubinfo");
    const metadata = readMetadata(pubinfoProfile);
    if (O.isNone(metadata) || !Eq.equals(keyOf(pubinfoProfile), keyOf(pubinfoQuads(iris, metadata.value))))
      return refused("invalid-publication-metadata");
    const recomputed = yield* mintNanopubId(checked.claim, metadata.value);
    if (!Eq.equals(recomputed, publicationId)) return refused("stale-publication-id");
    const consumed = keyOf(profile);
    return {
      _tag: "Read" as const,
      accepted: NanopubPublication.make({
        record: ClaimRecord.make({ claim: checked.claim, core: core.value }),
        metadata: metadata.value,
      }),
      publication: publicationId,
      profile,
      residual: Rdf.makeDataset(A.filter(quads, (q) => !HashSet.has(consumed, Rdf.serializeQuad(q)))),
    };
  });

  const decode = Effect.fn("NanopubCodec.decode")(function* (input: Rdf.Dataset) {
    yield* Effect.annotateCurrentSpan("nanopub.quad_count", HashSet.size(input.quads));
    const reading = yield* read(input);
    if (reading._tag !== "Read") return reading;
    return NanopubAccepted.make({
      accepted: reading.accepted,
      publication: reading.publication,
      residual: reading.residual,
    });
  });

  const normalize = Effect.fn("NanopubCodec.normalize")(function* (input: Rdf.Dataset) {
    yield* Effect.annotateCurrentSpan("nanopub.quad_count", HashSet.size(input.quads));
    const reading = yield* read(input);
    if (reading._tag !== "Read") return reading;
    return NanopubNormalized.make({ dataset: Rdf.makeDataset(reading.profile), residual: reading.residual });
  });

  return { NanopubPublication, NanopubAccepted, NanopubDecodeResult, encode, decode, normalize };
};
