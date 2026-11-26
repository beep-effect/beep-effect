import { ClaimCoreInvalid, makeClaimArrows } from "@beep/epistemics/ClaimCore";
import { ClaimId, makeClaimCore } from "@beep/epistemics/ClaimCore.schema";
import {
  makeNanopubCodec,
  mintNanopubId,
  NanopubAgentPreimage,
  NanopubForeign,
  NanopubPreimage,
  NanopubRefused,
  nanopubIris,
  PublicationMetadata,
} from "@beep/epistemics/rdf/NanopubCodec";
import { IRI } from "@beep/identity/Iri";
import { $EpistemicsId } from "@beep/identity/packages";
import { iri, mint } from "@beep/identity/Registry";
import * as Rdf from "@beep/rdf/Rdf";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { OccurrenceId } from "@beep/text/Occurrence";
import { expect, expectTypeOf } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { activity, arrows, Claims, Core, coreAt } from "./support/Claims.ts";

const codec = makeNanopubCodec({ binding: Claims });
const samePublication = S.toEquivalence(codec.NanopubPublication);
const occurrence = (hex: string) => OccurrenceId.make(`sha256:${Str.repeat(64)(hex)}`);
const node = (value: string) => Rdf.makeNamedNode(value);
const publisher = IRI.make("https://example.org/publisher");
const generatedDigest = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("d")}`);
const metadataAt = (at: number, sourceDigest = O.none<Sha256PrefixedDigest>()) =>
  PublicationMetadata.make({ publisher, publishedAt: DateTime.makeUnsafe(at), sourceDigest });

const listOf = (dataset: Rdf.Dataset): ReadonlyArray<Rdf.Quad> => A.fromIterable(dataset.quads);

const quadsOf = (dataset: Rdf.Dataset): ReadonlyArray<string> =>
  A.sort(A.map(listOf(dataset), Rdf.serializeQuad), Str.Order);

const datasetOf = (quads: Iterable<Rdf.Quad>) => Rdf.makeDataset(quads);

const withQuads = (dataset: Rdf.Dataset, extra: Iterable<Rdf.Quad>) => datasetOf([...dataset.quads, ...extra]);

const without = (dataset: Rdf.Dataset, predicate: string) =>
  datasetOf(A.filter(listOf(dataset), (q) => q.predicate.value !== predicate));

const mapQuads = (dataset: Rdf.Dataset, f: (quad: Rdf.Quad) => Rdf.Quad) => datasetOf(A.map(listOf(dataset), f));

const renamed = (from: string, to: string) => (value: string) => (value === from ? to : value);

const rename = (dataset: Rdf.Dataset, from: string, to: string) => {
  const swap = renamed(from, to);
  return mapQuads(dataset, (q) =>
    Rdf.Quad.make({
      subject: Rdf.NamedNode.is(q.subject) ? node(swap(q.subject.value)) : q.subject,
      predicate: q.predicate,
      object: Rdf.NamedNode.is(q.object) ? node(swap(q.object.value)) : q.object,
      graph: Rdf.NamedNode.is(q.graph) ? node(swap(q.graph.value)) : q.graph,
    })
  );
};

const replaceObject = (dataset: Rdf.Dataset, predicate: string, object: Rdf.ObjectTerm) =>
  mapQuads(dataset, (q) => (q.predicate.value === predicate ? Rdf.Quad.make({ ...q, object }) : q));

const replaceGraph = (dataset: Rdf.Dataset, predicate: string, graph: Rdf.GraphTerm) =>
  mapQuads(dataset, (q) => (q.predicate.value === predicate ? Rdf.Quad.make({ ...q, graph }) : q));

const replaceSubject = (dataset: Rdf.Dataset, predicate: string, subject: Rdf.Subject) =>
  mapQuads(dataset, (q) => (q.predicate.value === predicate ? Rdf.Quad.make({ ...q, subject }) : q));

const quadOf = (dataset: Rdf.Dataset, predicate: string) =>
  O.getOrThrow(A.findFirst(listOf(dataset), (q) => q.predicate.value === predicate));

const P = {
  type: iri("rdf:type"),
  hasAssertion: iri("np:hasAssertion"),
  hasProvenance: iri("np:hasProvenance"),
  hasPublicationInfo: iri("np:hasPublicationInfo"),
  coreJson: iri("epistemic:coreJson"),
  sourceDigest: iri("epistemic:sourceDigest"),
  wasGeneratedBy: iri("prov:wasGeneratedBy"),
  wasAttributedTo: iri("prov:wasAttributedTo"),
  publisherTerm: iri("dcterms:publisher"),
  created: iri("dcterms:created"),
};

const json = iri("rdf:JSON");
const xsdString = iri("xsd:string");
const defaultGraph = Rdf.DefaultGraph.make({ termType: "DefaultGraph", value: "" });

const baseCore = () =>
  Core.make({
    ...coreAt({ at: 10 }),
    supportAtCreation: HashSet.make(occurrence("1"), occurrence("2")),
  });

const publish = Effect.fnUntraced(function* (core: Core, metadata: PublicationMetadata) {
  const claim = yield* arrows.mint(core);
  const record = Claims.ClaimRecord.make({ claim, core });
  const publication = codec.NanopubPublication.make({ record, metadata });
  const dataset = yield* codec.encode(publication);
  const id = yield* mintNanopubId(claim, metadata);
  return { publication, dataset, iris: nanopubIris(id), id };
});

const reasonOf = (result: { readonly _tag: string }) =>
  S.is(NanopubRefused)(result) ? result.reason : S.is(NanopubForeign)(result) ? "foreign" : result._tag;

const outcomes = Effect.fnUntraced(function* (input: Rdf.Dataset) {
  const decoded = yield* codec.decode(input);
  const normalized = yield* codec.normalize(input);
  return [reasonOf(decoded), reasonOf(normalized)];
});

const accepted = Effect.fnUntraced(function* (input: Rdf.Dataset) {
  const decoded = yield* codec.decode(input);
  if (decoded._tag !== "Accepted") return yield* Effect.die(`expected Accepted, got ${reasonOf(decoded)}`);
  return decoded;
});

it.layer(Digest.layerWebCrypto, { timeout: "60 seconds" })("nanopublication adapter", (it) => {
  it.effect("verifies both declared goldens and an independent SHA-256 over their canonical bytes", () =>
    Effect.gen(function* () {
      yield* NanopubPreimage.verifyGolden();
      yield* NanopubAgentPreimage.verifyGolden();
      const crypto = yield* Digest.Digest;
      const sha = Effect.fnUntraced(function* (text: string) {
        const bytes = yield* crypto.digest(Digest.sha256, new TextEncoder().encode(text));
        return `sha256:${Hex.encode(bytes)}`;
      });
      const publication = yield* sha(
        `["nanopub/v1","sha256:${Str.repeat(64)("a")}",{"publishedAt":1000,"publisher":"https://example.org/publisher"}]`
      );
      const agent = yield* sha('["nanopub-agent/v1",{"_tag":"Person","principal":"fixture"}]');
      expect([publication, agent]).toStrictEqual([NanopubPreimage.golden.hash, NanopubAgentPreimage.golden.hash]);
    })
  );

  it.effect("writes one head, assertion, provenance and pubinfo graph under five distinct derived names", () =>
    Effect.gen(function* () {
      const { dataset, iris, id } = yield* publish(baseCore(), metadataAt(1000));
      const names = [iris.publication, iris.head, iris.assertion, iris.provenance, iris.pubinfo];
      expect(HashSet.size(HashSet.fromIterable(names))).toBe(5);
      expect(iris.publication).toBe(mint("instance", Str.replace("sha256:", "sha256-")(id)));
      expect(A.dedupe(A.map(listOf(dataset), (q) => q.graph.value)).length).toBe(4);
      expect(HashSet.size(dataset.quads)).toBe(9);
      const core = quadOf(dataset, P.coreJson);
      expect(core.graph.value).toBe(iris.assertion);
      expect(Rdf.Literal.is(core.object) && Rdf.Literal.datatypeOf(core.object).value).toBe(json);
      const provenance = quadOf(dataset, P.wasGeneratedBy);
      expect([provenance.subject.value, provenance.graph.value]).toStrictEqual([iris.assertion, iris.provenance]);
      expect(quadOf(dataset, P.wasAttributedTo).subject.value).toBe(iris.assertion);
      expect(quadOf(dataset, P.publisherTerm).subject.value).toBe(iris.publication);
      expect(HashSet.some(dataset.quads, (q) => q.predicate.value === P.sourceDigest)).toBe(false);
    })
  );

  it.effect("decode(encode(record)) is the record and encode(decode(s).accepted) is normalize(s)", () =>
    Effect.gen(function* () {
      const digest = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("c")}`);
      const cases = [
        baseCore(),
        Core.make({
          ...baseCore(),
          valid: { _tag: "Interval", validFrom: DateTime.makeUnsafe(5), validTo: O.some(DateTime.makeUnsafe(50)) },
        }),
        Core.make({ ...baseCore(), valid: { _tag: "Interval", validFrom: DateTime.makeUnsafe(5), validTo: O.none() } }),
      ];
      for (const core of cases) {
        for (const metadata of [metadataAt(1000), metadataAt(2000, O.some(digest))]) {
          const { publication, dataset } = yield* publish(core, metadata);
          const decoded = yield* accepted(dataset);
          expect(S.is(codec.NanopubDecodeResult)(decoded)).toBe(true);
          expect(samePublication(decoded.accepted, publication)).toBe(true);
          expect(HashSet.size(decoded.residual.quads)).toBe(0);
          const reencoded = yield* codec.encode(decoded.accepted);
          const normalized = yield* codec.normalize(dataset);
          expect(normalized._tag).toBe("Normalized");
          if (normalized._tag !== "Normalized") return;
          expect(quadsOf(reencoded)).toStrictEqual(quadsOf(normalized.dataset));
          expect(quadsOf(reencoded)).toStrictEqual(quadsOf(dataset));
        }
      }
    })
  );

  it.effect.prop(
    "generated publications round-trip and normalize to their own encoding",
    [
      S.Int.check(S.isBetween({ minimum: 1, maximum: 1_000_000 })),
      S.Int.check(S.isBetween({ minimum: 0, maximum: 4_102_444_800_000 })),
      S.Boolean,
    ],
    ([subject, at, withDigest]) =>
      Effect.gen(function* () {
        const core = coreAt({ at: 10, subject });
        const digest = withDigest ? O.some(generatedDigest) : O.none();
        const { publication, dataset } = yield* publish(core, metadataAt(at, digest));
        const decoded = yield* accepted(datasetOf(A.reverse(listOf(dataset))));
        expect(samePublication(decoded.accepted, publication)).toBe(true);
        const normalized = yield* codec.normalize(datasetOf([...dataset.quads, ...dataset.quads]));
        expect(normalized._tag === "Normalized" && quadsOf(normalized.dataset)).toStrictEqual(quadsOf(dataset));
      }),
    { arbitrary: { runs: 25 } }
  );

  it.effect("reordered and repeated identical quads decode and normalize to one quad set", () =>
    Effect.gen(function* () {
      const { publication, dataset } = yield* publish(baseCore(), metadataAt(1000));
      const reordered = datasetOf(A.reverse(listOf(dataset)));
      const repeated = withQuads(dataset, dataset.quads);
      for (const input of [reordered, repeated]) {
        const decoded = yield* accepted(input);
        expect(samePublication(decoded.accepted, publication)).toBe(true);
        expect(HashSet.size(decoded.residual.quads)).toBe(0);
        const normalized = yield* codec.normalize(input);
        expect(normalized._tag === "Normalized" && quadsOf(normalized.dataset)).toStrictEqual(quadsOf(dataset));
      }
    })
  );

  it.effect("two support orders encode to one dataset", () =>
    Effect.gen(function* () {
      const forward = Core.make({
        ...coreAt({ at: 10 }),
        supportAtCreation: HashSet.make(occurrence("1"), occurrence("2")),
      });
      const backward = Core.make({
        ...coreAt({ at: 10 }),
        supportAtCreation: HashSet.make(occurrence("2"), occurrence("1")),
      });
      const left = yield* publish(forward, metadataAt(1000));
      const right = yield* publish(backward, metadataAt(1000));
      expect(quadsOf(left.dataset)).toStrictEqual(quadsOf(right.dataset));
    })
  );

  it.effect("round-trips a typed caller proposition through its own codec", () =>
    Effect.gen(function* () {
      const Typed = makeClaimCore({
        $I: $EpistemicsId.create("test/NanopubAdapter/Typed"),
        proposition: S.Struct({
          observedAt: S.DateTimeUtcFromMillis,
          note: S.OptionFromOptionalKey(S.NonEmptyString),
        }),
        ids: {
          logicalKey: (p) => `observed:${DateTime.toEpochMillis(p.observedAt)}`,
          scope: S.NonEmptyString,
          principal: S.NonEmptyString,
          action: S.NonEmptyString,
          revision: S.NonEmptyString,
        },
      });
      const typed = makeNanopubCodec({ binding: Typed });
      const typedArrows = makeClaimArrows(Typed);
      const samePublished = S.toEquivalence(typed.NanopubPublication);
      for (const note of [O.none<string>(), O.some("noted")]) {
        const core = Typed.ClaimCore.make({
          proposition: { observedAt: DateTime.makeUnsafe(7), note },
          logicalKey: "observed:7",
          supportAtCreation: HashSet.empty(),
          derivedFrom: HashSet.empty(),
          supersedes: O.none(),
          generatedBy: activity,
          assertedBy: Typed.AgentRef.cases.Organization.make({ organization: "office" }),
          valid: { _tag: "Unknown" },
          knowledgeStart: DateTime.makeUnsafe(10),
          scope: "fixture",
        });
        const claim = yield* typedArrows.mint(core);
        const publication = typed.NanopubPublication.make({
          record: Typed.ClaimRecord.make({ claim, core }),
          metadata: metadataAt(1000),
        });
        const dataset = yield* typed.encode(publication);
        const literal = quadOf(dataset, P.coreJson).object;
        expect(Rdf.Literal.is(literal) && Str.includes('"observedAt":7')(literal.value)).toBe(true);
        const decoded = yield* typed.decode(dataset);
        expect(decoded._tag === "Accepted" && samePublished(decoded.accepted, publication)).toBe(true);
      }
    })
  );

  it.effect("keeps foreign predicates and token-looking triples residual, never in the record", () =>
    Effect.gen(function* () {
      const { publication, dataset, iris } = yield* publish(baseCore(), metadataAt(1000));
      const claim = quadOf(dataset, P.coreJson).subject;
      const token = node("https://example.org/ns/humanAdmissionToken");
      const extra = [
        Rdf.Quad.make({
          subject: node(iris.publication),
          predicate: node(iri("rdfs:label")),
          object: Rdf.Literal.typed("label", xsdString),
          graph: node(iris.pubinfo),
        }),
        Rdf.Quad.make({
          subject: claim,
          predicate: token,
          object: Rdf.Literal.typed(`sha256:${Str.repeat(64)("e")}`, xsdString),
          graph: node(iris.assertion),
        }),
        Rdf.Quad.make({
          subject: node(iris.assertion),
          predicate: node("https://example.org/ns/admittedBy"),
          object: node("https://example.org/person/1"),
          graph: node(iris.provenance),
        }),
        Rdf.Quad.make({
          subject: node(iris.assertion),
          predicate: node(P.type),
          object: node("https://example.org/ns/Assertion"),
          graph: node(iris.head),
        }),
        Rdf.makeQuad(node("https://example.org/other"), token, node("https://example.org/value")),
      ];
      const input = withQuads(dataset, extra);
      const decoded = yield* accepted(input);
      expect(samePublication(decoded.accepted, publication)).toBe(true);
      expect(quadsOf(decoded.residual)).toStrictEqual(quadsOf(datasetOf(extra)));
      const normalized = yield* codec.normalize(input);
      expect(normalized._tag === "Normalized" && quadsOf(normalized.dataset)).toStrictEqual(quadsOf(dataset));
      expect(normalized._tag === "Normalized" && quadsOf(normalized.residual)).toStrictEqual(quadsOf(datasetOf(extra)));
    })
  );

  it.effect("rejects foreign publication names as import metadata with the original input", () =>
    Effect.gen(function* () {
      const { dataset, iris } = yield* publish(baseCore(), metadataAt(1000));
      const foreign = [
        [iris.publication, "https://example.org/np/1"],
        [iris.head, "https://example.org/np/1/head"],
        [iris.assertion, "https://example.org/np/1/assertion"],
        [iris.provenance, "https://example.org/np/1/provenance"],
        [iris.pubinfo, "https://example.org/np/1/pubinfo"],
      ] as const;
      const input = A.reduce(foreign, dataset, (current, [from, to]) => rename(current, from, to));
      const decoded = yield* codec.decode(input);
      expect(S.is(NanopubForeign)(decoded) && decoded.publication).toBe("https://example.org/np/1");
      expect(S.is(NanopubForeign)(decoded) && quadsOf(decoded.input)).toStrictEqual(quadsOf(input));
      const got = yield* outcomes(input);
      expect(got).toStrictEqual(["foreign", "foreign"]);
    })
  );

  it.effect("refuses a foreign-named dataset that fails a profile check, in decode and normalize", () =>
    Effect.gen(function* () {
      const { dataset, iris } = yield* publish(baseCore(), metadataAt(1000));
      const foreign = A.reduce(
        [
          [iris.publication, "https://example.org/np/1"],
          [iris.head, "https://example.org/np/1/head"],
          [iris.assertion, "https://example.org/np/1/assertion"],
          [iris.provenance, "https://example.org/np/1/provenance"],
          [iris.pubinfo, "https://example.org/np/1/pubinfo"],
        ] as const,
        dataset,
        (current, [from, to]) => rename(current, from, to)
      );
      const headOnly = datasetOf(A.filter(foreign.quads, (q) => q.graph.value === "https://example.org/np/1/head"));
      const cases = [
        [headOnly, "invalid-core"],
        [without(foreign, P.wasAttributedTo), "provenance-mismatch"],
        [without(foreign, P.created), "invalid-publication-metadata"],
      ] as const;
      for (const [input, reason] of cases) {
        const got = yield* outcomes(input);
        expect([reason, got]).toStrictEqual([reason, [reason, reason]]);
        const decoded = yield* codec.decode(input);
        expect(S.is(NanopubRefused)(decoded) && decoded.input.quads).toStrictEqual(input.quads);
      }
    })
  );

  it.effect("requires an owner core that encodes to an object carrying assertedBy", () =>
    Effect.sync(() => {
      const stringCore = { ...Claims, ClaimCore: S.fromJsonString(Claims.ClaimCore) };
      expectTypeOf<typeof stringCore.ClaimCore>().not.toExtend<
        Parameters<typeof makeNanopubCodec>[0]["binding"]["ClaimCore"]
      >();
      expectTypeOf<typeof Claims.ClaimCore>().toExtend<
        Parameters<typeof makeNanopubCodec>[0]["binding"]["ClaimCore"]
      >();
    })
  );

  it.effect("refuses a stale publication id after publisher and time edits, in decode and normalize", () =>
    Effect.gen(function* () {
      const { dataset } = yield* publish(baseCore(), metadataAt(1000));
      const publisherEdit = replaceObject(dataset, P.publisherTerm, node("https://example.org/other-publisher"));
      const timeEdit = replaceObject(
        dataset,
        P.created,
        Rdf.Literal.typed(DateTime.formatIso(DateTime.makeUnsafe(2000)), iri("xsd:dateTime"))
      );
      for (const input of [publisherEdit, timeEdit]) {
        const got = yield* outcomes(input);
        expect(got).toStrictEqual(["stale-publication-id", "stale-publication-id"]);
        const decoded = yield* codec.decode(input);
        expect(S.is(NanopubRefused)(decoded) && quadsOf(decoded.input)).toStrictEqual(quadsOf(input));
      }
    })
  );

  it.effect("refuses one wrong derived graph IRI in decode and normalize", () =>
    Effect.gen(function* () {
      const { dataset, iris, id } = yield* publish(baseCore(), metadataAt(1000));
      const wrong = mint("instance", Str.replace("sha256:", "sha256-")(id), "information");
      const input = rename(dataset, iris.pubinfo, wrong);
      const got = yield* outcomes(input);
      expect(got).toStrictEqual(["wrong-derived-iri", "wrong-derived-iri"]);
    })
  );

  it.effect("refuses a wrong core hash, mismatched provenance, graph collision and a missing head edge", () =>
    Effect.gen(function* () {
      const { dataset, iris } = yield* publish(baseCore(), metadataAt(1000));
      const literal = quadOf(dataset, P.coreJson).object;
      const coreText = Rdf.Literal.is(literal) ? literal.value : "";
      const wrongCore = replaceObject(
        dataset,
        P.coreJson,
        Rdf.Literal.typed(Str.replace('"text":"subject 1"', '"text":"subject 1 edited"')(coreText), json)
      );
      const agent = replaceObject(dataset, P.wasAttributedTo, node("https://example.org/agent/2"));
      const generation = replaceObject(dataset, P.wasGeneratedBy, node("https://example.org/activity/2"));
      const collision = rename(dataset, iris.provenance, iris.assertion);
      const missing = without(dataset, P.hasProvenance);
      const cases = [
        [wrongCore, "core-hash-mismatch"],
        [agent, "provenance-mismatch"],
        [generation, "provenance-mismatch"],
        [without(dataset, P.wasAttributedTo), "provenance-mismatch"],
        [collision, "graph-collision"],
        [missing, "missing-head-edge"],
      ] as const;
      for (const [input, reason] of cases) {
        const got = yield* outcomes(input);
        expect([reason, got]).toStrictEqual([reason, [reason, reason]]);
      }
    })
  );

  it.effect("refuses datasets outside the profile's head structure with the original input", () =>
    Effect.gen(function* () {
      const { dataset, iris } = yield* publish(baseCore(), metadataAt(1000));
      const other = yield* publish(coreAt({ at: 10, subject: 2 }), metadataAt(1000));
      const typeQuad = quadOf(dataset, P.type);
      const cases = [
        [datasetOf([]), "publication-count"],
        [withQuads(dataset, other.dataset.quads), "publication-count"],
        [replaceSubject(dataset, P.type, Rdf.makeBlankNode("publication")), "blank-publication"],
        [replaceGraph(dataset, P.type, defaultGraph), "default-graph"],
        [withQuads(dataset, [Rdf.Quad.make({ ...typeQuad, graph: node(iris.assertion) })]), "graph-mixing"],
        [
          datasetOf(
            A.map(listOf(dataset), (q) =>
              q.graph.value === iris.head ? Rdf.Quad.make({ ...q, graph: defaultGraph }) : q
            )
          ),
          "default-graph",
        ],
        [
          withQuads(dataset, [Rdf.makeQuad(node(iris.publication), node(P.type), Rdf.Literal.typed("x", xsdString))]),
          "Accepted",
        ],
        [
          withQuads(dataset, [
            Rdf.Quad.make({ ...quadOf(dataset, P.hasAssertion), object: node("https://example.org/other") }),
          ]),
          "head-cardinality",
        ],
        [replaceObject(dataset, P.hasAssertion, Rdf.makeBlankNode("assertion")), "blank-graph-name"],
        [replaceObject(dataset, P.hasAssertion, Rdf.Literal.typed("assertion", xsdString)), "missing-head-edge"],
        [replaceGraph(dataset, P.wasGeneratedBy, Rdf.makeBlankNode("graph")), "blank-graph-name"],
        [replaceGraph(dataset, P.coreJson, node(iris.provenance)), "graph-mixing"],
        [
          withQuads(dataset, [
            Rdf.Quad.make({
              subject: node("https://example.org/other"),
              predicate: node(P.hasAssertion),
              object: node(iris.assertion),
              graph: node(iris.head),
            }),
          ]),
          "head-cardinality",
        ],
      ] as const;
      for (const [input, reason] of cases) {
        const got = yield* outcomes(input);
        expect([reason, got]).toStrictEqual([reason, [reason, reason === "Accepted" ? "Normalized" : reason]]);
      }
    })
  );

  it.effect("refuses an unsupported core and malformed publication metadata, never a partial record", () =>
    Effect.gen(function* () {
      const { dataset } = yield* publish(baseCore(), metadataAt(1000));
      const coreQuad = quadOf(dataset, P.coreJson);
      const literal = coreQuad.object;
      const coreText = Rdf.Literal.is(literal) ? literal.value : "";
      const cases = [
        [without(dataset, P.coreJson), "invalid-core"],
        [
          withQuads(dataset, [Rdf.Quad.make({ ...coreQuad, subject: node("https://example.org/claim/2") })]),
          "invalid-core",
        ],
        [replaceSubject(dataset, P.coreJson, Rdf.makeBlankNode("claim")), "invalid-core"],
        [replaceObject(dataset, P.coreJson, node("https://example.org/core")), "invalid-core"],
        [replaceObject(dataset, P.coreJson, Rdf.Literal.typed("{", json)), "invalid-core"],
        [replaceObject(dataset, P.coreJson, Rdf.Literal.typed(`${coreText} `, json)), "invalid-core"],
        [replaceObject(dataset, P.coreJson, Rdf.Literal.typed(coreText, xsdString)), "invalid-core"],
        [replaceSubject(dataset, P.coreJson, node("https://example.org/claim/1")), "core-hash-mismatch"],
        [without(dataset, P.publisherTerm), "invalid-publication-metadata"],
        [
          replaceObject(dataset, P.publisherTerm, Rdf.Literal.typed("publisher", xsdString)),
          "invalid-publication-metadata",
        ],
        [replaceObject(dataset, P.created, node("https://example.org/time")), "invalid-publication-metadata"],
        [
          replaceObject(dataset, P.created, Rdf.Literal.typed("not a time", iri("xsd:dateTime"))),
          "invalid-publication-metadata",
        ],
        [
          replaceObject(dataset, P.created, Rdf.Literal.typed("1970-01-01T00:00:01Z", iri("xsd:dateTime"))),
          "invalid-publication-metadata",
        ],
        [
          withQuads(dataset, [
            Rdf.Quad.make({
              ...quadOf(dataset, P.publisherTerm),
              predicate: node(P.sourceDigest),
              object: Rdf.Literal.typed("sha256:not-a-digest", xsdString),
            }),
          ]),
          "invalid-publication-metadata",
        ],
      ] as const;
      for (const [input, reason] of cases) {
        const got = yield* outcomes(input);
        expect([reason, got]).toStrictEqual([reason, [reason, reason]]);
      }
      const digest = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("f")}`);
      const twoDigests = yield* publish(baseCore(), metadataAt(1000, O.some(digest)));
      const doubled = withQuads(twoDigests.dataset, [
        Rdf.Quad.make({
          ...quadOf(twoDigests.dataset, P.sourceDigest),
          object: Rdf.Literal.typed(`sha256:${Str.repeat(64)("0")}`, xsdString),
        }),
      ]);
      const doubledOutcome = yield* outcomes(doubled);
      expect(doubledOutcome).toStrictEqual(["invalid-publication-metadata", "invalid-publication-metadata"]);
      const dropped = yield* outcomes(without(twoDigests.dataset, P.sourceDigest));
      expect(dropped).toStrictEqual(["stale-publication-id", "stale-publication-id"]);
      const otherDigest = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("0")}`);
      const swapped = replaceObject(twoDigests.dataset, P.sourceDigest, Rdf.Literal.typed(otherDigest, xsdString));
      const swappedOutcome = yield* outcomes(swapped);
      expect(swappedOutcome).toStrictEqual(["stale-publication-id", "stale-publication-id"]);
      const republished = yield* publish(baseCore(), metadataAt(1000, O.some(otherDigest)));
      expect(republished.id).not.toBe(twoDigests.id);
      const reread = yield* accepted(republished.dataset);
      expect(reread.publication).toBe(republished.id);
      assertSome(reread.accepted.metadata.sourceDigest, otherDigest);
    })
  );

  it.effect("refuses to encode a record whose key does not re-mint from its core", () =>
    Effect.gen(function* () {
      const record = Claims.ClaimRecord.make({
        claim: ClaimId.make(`sha256:${Str.repeat(64)("b")}`),
        core: baseCore(),
      });
      const error = yield* codec
        .encode(codec.NanopubPublication.make({ record, metadata: metadataAt(1000) }))
        .pipe(Effect.flip);
      expect(S.is(ClaimCoreInvalid)(error) && error.reason).toBe("key-mismatch");
    })
  );
});
