import { makeDocumentCodec } from "@beep/annotation/AnnotationDocument";
import { Mention, OaDocument, OaKinds, Word } from "@beep/annotation/Kinds";
import { merge as mergeDocuments } from "@beep/annotation/Merge";
import {
  decodeOa,
  encodeOa,
  ImportActivity,
  ImportedActivity,
  instanceHash,
  instanceIri,
  normalize,
  OaEncodeRefused,
  OaRejection,
} from "@beep/annotation/rdf/OaCodec";
import { fcRuns } from "@beep/fc-runs";
import { IRI } from "@beep/identity/Iri";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import * as Rdf from "@beep/rdf/Rdf";
import { ContentHash } from "@beep/schema/ContentHash";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { anchoredOn, textDigestOf } from "@beep/text/Arbitrary";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import { resolve } from "@beep/text/Resolution";
import { QuoteSelector } from "@beep/text/Selector";
import { SourceTextExtractor, SourceTextIdentity, SourceTextLocator } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/text/VerifiedTextAnchor";
import { expect } from "@effect/vitest";
import { assertEquals, assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { constant } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import {
  activityIdOf,
  annotationIdOf,
  generationOf,
  importActivityIdOf,
  importedActivityIdOf,
  oaDocumentCase,
  oaInputCase,
  oaSource,
  occurrenceIdOf,
  oaQuads as Q,
  sha256,
} from "../support/generators.ts";
import type { Generation } from "@beep/annotation/Generation";
import type { VerifiedSourceText } from "@beep/text/VerifiedTextAnchor";

const runs = { arbitrary: fcRuns(100) };

const encode = encodeOa(OaKinds);

const decode = decodeOa(OaKinds);

const codec = makeDocumentCodec({ schema: OaDocument, kinds: OaKinds });

const verify = (source: SourceTextIdentity, sourceText: string) =>
  verifySourceTextIdentity(VerifySourceTextIdentityInput.make({ expectedSource: source, source, sourceText }));

const inputDigest = Sha256PrefixedDigest.make(`sha256:${Str.repeat(64)("c")}`);

const importActivityOf = (sourceDigest: Sha256PrefixedDigest) =>
  ImportActivity.make({ sourceDigest, importedAt: DateTime.makeUnsafe(1_700_000_000_000) });

const targetsOf = (row: Anchored) => Effect.map(mintOccurrenceId(row), (id) => HashSet.make(id));

const quadSet = (dataset: Rdf.Dataset): HashSet.HashSet<string> =>
  HashSet.fromIterable(A.map(dataset.quads, Rdf.serializeQuad));

const nifNamespace = "http://persistence.uni-leipzig.org/nlp2rdf/ontologies/nif-core#";

const isNifQuad = (quad: Rdf.Quad): boolean =>
  Str.startsWith(nifNamespace)(quad.predicate.value) || Str.startsWith(nifNamespace)(quad.object.value);

const hasBlankNode = (quad: Rdf.Quad): boolean =>
  quad.subject.termType === "BlankNode" || quad.object.termType === "BlankNode";

// The input quads a rejected annotation reaches through the profile's links, read independently of the codec: its
// own quads, its targets', their selectors', its runs', and the prov:Activity typing of the activities it or a run
// names.
const reachedFrom = (quads: ReadonlyArray<Rdf.Quad>, subject: Rdf.Term): ReadonlyArray<Rdf.Quad> => {
  const defaults = A.filter(quads, (q) => q.graph.termType === "DefaultGraph");
  const key = Rdf.serializeTerm;
  const objects = (from: ReadonlyArray<Rdf.Term>, predicate: string): ReadonlyArray<Rdf.Term> =>
    A.flatMap(defaults, (q) =>
      q.predicate.value === predicate && A.some(from, (node) => key(node) === key(q.subject)) ? [q.object] : []
    );
  const targets = objects([subject], term.hasTarget);
  const runs = A.flatMap(defaults, (q) =>
    q.predicate.value === term.specializationOf && key(q.object) === key(subject) ? [q.subject] : []
  );
  const nodes = HashSet.fromIterable(A.map([subject, ...targets, ...objects(targets, term.hasSelector), ...runs], key));
  const activities = HashSet.fromIterable(A.map(objects([subject, ...runs], term.wasGeneratedBy), key));
  return A.filter(
    defaults,
    (q) =>
      HashSet.has(nodes, key(q.subject)) ||
      (q.predicate.value === iri("rdf:type") &&
        q.object.value === iri("prov:Activity") &&
        HashSet.has(activities, key(q.subject)))
  );
};

// `resolve` of each anchors row's quote, by occurrence id.
const resolutions = (text: string, document: OaDocument) =>
  HashMap.map(document.anchors, (row) =>
    resolve(text, QuoteSelector.make({ exact: Anchored.quote(row), prefix: O.none(), suffix: O.none() }))
  );

const L26 =
  "L2-6 the OA codec round-trips the declared profile, normalizes third-party input, converts code-point offsets and preserves resolve";

// The fixture text: an astral character before the last word, so code points and code units differ there.
const fixtureText = "Alpha beta. Gamma 😀 delta.";

const fixtureSource = SourceTextIdentity.make({
  scopeRef: "matter:example",
  sourceRef: "source:oa-fixture",
  locator: SourceTextLocator.make("documents/oa-fixture.txt"),
  sourceDigest: textDigestOf(sha256)("oa-fixture bytes"),
  textDigest: textDigestOf(sha256)(fixtureText),
  extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
  normalizationVersion: "raw/1",
});

const T0 = 1_763_510_400_000;
const T1 = 1_763_510_401_000;

const term = {
  Annotation: iri("oa:Annotation"),
  SpecificResource: iri("oa:SpecificResource"),
  position: iri("oa:TextPositionSelector"),
  quote: iri("oa:TextQuoteSelector"),
  hasTarget: iri("oa:hasTarget"),
  hasSource: iri("oa:hasSource"),
  hasSelector: iri("oa:hasSelector"),
  hasBody: iri("oa:hasBody"),
  start: iri("oa:start"),
  end: iri("oa:end"),
  exact: iri("oa:exact"),
  prefix: iri("oa:prefix"),
  wasGeneratedBy: iri("prov:wasGeneratedBy"),
  specializationOf: iri("prov:specializationOf"),
  generatedAtTime: iri("prov:generatedAtTime"),
  created: iri("dcterms:created"),
  creator: iri("dcterms:creator"),
  generator: iri("as:generator"),
  Mention: iri("annotation:Mention"),
  Sentence: iri("annotation:Sentence"),
  Word: iri("annotation:Word"),
  Title: iri("annotation:Title"),
  Section: iri("annotation:Section"),
  claim: iri("office-action:claim"),
};

const annotationNode = (label: string) => Q.named(`https://example.org/annotation/${label}`);

const annotationOf = (subject: Rdf.Subject, kind: O.Option<string>): ReadonlyArray<Rdf.Quad> => [
  Q.type(subject, term.Annotation),
  ...A.map(A.fromOption(kind), (klass) => Q.type(subject, klass)),
];

const targetOf = (
  subject: Rdf.Subject,
  target: Rdf.Subject,
  selectors: ReadonlyArray<Rdf.Quad>,
  source: string = oaSource
): ReadonlyArray<Rdf.Quad> => [
  Q.quad(subject, term.hasTarget, target),
  Q.type(target, term.SpecificResource),
  Q.quad(target, term.hasSource, Q.named(source)),
  ...selectors,
];

const positionOf = (target: Rdf.Subject, label: string, start: Rdf.ObjectTerm, end: Rdf.ObjectTerm) => {
  const selector = Q.blank(label);
  return [
    Q.quad(target, term.hasSelector, selector),
    Q.type(selector, term.position),
    Q.quad(selector, term.start, start),
    Q.quad(selector, term.end, end),
  ];
};

const quoteOf = (
  target: Rdf.Subject,
  label: string,
  exact: Rdf.ObjectTerm,
  ...extra: ReadonlyArray<readonly [string, Rdf.ObjectTerm]>
) => {
  const selector = Q.blank(label);
  return [
    Q.quad(target, term.hasSelector, selector),
    Q.type(selector, term.quote),
    Q.quad(selector, term.exact, exact),
    ...A.map(extra, ([predicate, object]) => Q.quad(selector, predicate, object)),
  ];
};

// A quote-only target on one word of the fixture text.
const wordTarget = (subject: Rdf.Subject, label: string, word: string, source: string = oaSource) =>
  targetOf(subject, Q.blank(`t-${label}`), quoteOf(Q.blank(`t-${label}`), `q-${label}`, Q.string(word)), source);

type Fixture = {
  readonly name: string;
  readonly quads: ReadonlyArray<Rdf.Quad>;
  readonly rejected: ReadonlyArray<readonly [Rdf.Subject, OaRejection["reason"]]>;
  readonly annotations: number;
  readonly residual: (input: ReadonlyArray<Rdf.Quad>) => ReadonlyArray<Rdf.Quad>;
};

const alice = Q.named("https://example.org/agent/alice");
const bob = Q.named("https://example.org/agent/bob");
const software = Q.named("https://example.org/software/reader");
const activity = Q.named("https://example.org/activity/1");

const sentence = Q.blank("sentence");
const sentenceTarget = Q.blank("sentence-target");
const mention = annotationNode("mention");
const generated = annotationNode("generated");
const twoRuns = annotationNode("two-runs");
const runA = Q.blank("run-a");
const runB = Q.blank("run-b");
const conflictA = annotationNode("conflict-a");
const conflictB = annotationNode("conflict-b");
const nifAnnotation = annotationNode("nif");
const nifTarget = Q.named("https://example.org/target/nif");
const unknown = annotationNode("unknown");
const untyped = annotationNode("untyped");
const elsewhere = annotationNode("elsewhere");
const emptyMention = annotationNode("empty-mention");
const bodiedTitle = annotationNode("bodied-title");
const untargeted = annotationNode("untargeted");
const sourceless = annotationNode("sourceless");
const fragmentOnly = annotationNode("fragment-only");
const doubleTyped = annotationNode("double-typed");
const startless = annotationNode("startless");
const twoPrefixes = annotationNode("two-prefixes");
const iriPrefix = annotationNode("iri-prefix");
const outOfRange = annotationNode("out-of-range");
const twoTimes = annotationNode("two-times");
const runConflict = annotationNode("run-conflict");
const runConflictRun = Q.blank("run-conflict-run");
const native = annotationNode("native");
const blankActivity = annotationNode("blank-activity");
const badTime = annotationNode("bad-time");
const idle = annotationNode("idle");
const idleRun = Q.blank("idle-run");
const sharedAccepted = annotationNode("shared-accepted");
const sharedRejected = annotationNode("shared-rejected");
const sharedTarget = Q.named("https://example.org/target/shared");
const sharedActivity = Q.named("https://example.org/activity/shared");

// Stated times at the edges of the four-digit year, by annotation label: the lexical form, its kind and word, and
// the instant it names (none for a literal outside the xsd:dateTime lexical or value space).
const edgeTimes: ReadonlyArray<readonly [string, string, string, string, O.Option<number>]> = [
  ["offset-past-9999", "9999-12-31T23:59:59-14:00", term.Word, "Gamma", O.some(253_402_351_199_000)],
  ["year-10000", "10000-01-01T13:59:59.5Z", term.Word, "delta", O.some(253_402_351_199_500)],
  ["year-minus-1", "-0001-12-31T23:59:59.99999Z", term.Word, "Alpha", O.some(-62_167_219_200_001)],
  ["year-0", "0000-01-01T00:00:00Z", term.Word, "beta", O.some(-62_167_219_200_000)],
  ["signed-year", "+010000-01-01T00:00:00.000Z", term.Title, "Alpha", O.none()],
  ["padded-year", "02024-01-01T00:00:00Z", term.Title, "Gamma", O.none()],
  ["no-such-day", "2024-02-30T00:00:00Z", term.Title, "beta", O.none()],
  ["past-the-range", "1000000-01-01T00:00:00Z", term.Title, "delta", O.none()],
];

const all = (input: ReadonlyArray<Rdf.Quad>) => input;

const none = (): ReadonlyArray<Rdf.Quad> => [];

const fixtures: ReadonlyArray<Fixture> = [
  {
    name: "a blank-node sentence with a position-only target, unattributed, with dcterms:created",
    quads: [
      ...annotationOf(sentence, O.some(term.Sentence)),
      ...targetOf(sentence, sentenceTarget, positionOf(sentenceTarget, "p", Q.integer(0), Q.integer(11))),
      Q.quad(sentence, term.created, Q.time(T1)),
    ],
    rejected: [],
    annotations: 1,
    residual: none,
  },
  {
    name: "a creator-only mention with a quote-only target",
    quads: [
      ...annotationOf(mention, O.some(term.Mention)),
      Q.quad(mention, term.hasBody, Q.named(term.claim)),
      ...wordTarget(mention, "mention", "Gamma"),
      Q.quad(mention, term.creator, alice),
    ],
    rejected: [],
    annotations: 1,
    residual: none,
  },
  {
    name: "a generator-only word with a stated time and a prefixed quote beside its position",
    quads: [
      ...annotationOf(generated, O.some(term.Word)),
      ...targetOf(generated, Q.blank("generated-target"), [
        ...positionOf(Q.blank("generated-target"), "gp", Q.integer(20), Q.integer(25)),
        ...quoteOf(Q.blank("generated-target"), "gq", Q.string("delta"), [term.prefix, Q.string("😀 ")]),
      ]),
      Q.quad(generated, term.generator, software),
      Q.quad(generated, term.generatedAtTime, Q.time(T0)),
    ],
    rejected: [],
    annotations: 1,
    residual: none,
  },
  {
    name: "two creators on two runs with two times",
    quads: [
      ...annotationOf(twoRuns, O.some(term.Title)),
      ...wordTarget(twoRuns, "two-runs", "Alpha"),
      Q.quad(runA, term.specializationOf, twoRuns),
      Q.quad(runA, term.creator, alice),
      Q.quad(runA, term.generatedAtTime, Q.time(T0)),
      Q.quad(runB, term.specializationOf, twoRuns),
      Q.quad(runB, term.creator, bob),
      Q.quad(runB, term.created, Q.time(T1)),
    ],
    rejected: [],
    annotations: 1,
    residual: none,
  },
  {
    name: "a time conflict across two annotations of equal content",
    quads: [
      ...annotationOf(conflictA, O.some(term.Word)),
      ...wordTarget(conflictA, "conflict-a", "beta"),
      Q.quad(conflictA, term.wasGeneratedBy, activity),
      Q.quad(conflictA, term.generatedAtTime, Q.time(T0)),
      ...annotationOf(conflictB, O.some(term.Word)),
      ...wordTarget(conflictB, "conflict-b", "beta"),
      Q.quad(conflictB, term.wasGeneratedBy, activity),
      Q.type(activity, iri("prov:Activity")),
    ],
    rejected: [
      [conflictA, "time-conflict"],
      [conflictB, "time-conflict"],
    ],
    annotations: 0,
    residual: all,
  },
  {
    name: "NIF triples on a target and a quad in a named graph",
    quads: [
      ...annotationOf(nifAnnotation, O.some(term.Sentence)),
      ...targetOf(nifAnnotation, nifTarget, positionOf(nifTarget, "np", Q.integer(12), Q.integer(17))),
      Q.type(nifTarget, iri("nif:Sentence")),
      Q.quad(nifTarget, iri("nif:beginIndex"), Q.integer(12)),
      Rdf.makeQuad(
        nifTarget,
        Q.named(iri("rdf:type")),
        Rdf.MakeQuadOptionsInput.make({ object: Q.named(term.Annotation), graph: Q.named("https://example.org/graph") })
      ),
    ],
    rejected: [],
    annotations: 1,
    residual: (input) => A.takeRight(input, 3),
  },
  {
    name: "an unknown kind, a missing kind and another source",
    quads: [
      ...annotationOf(unknown, O.some(term.Section)),
      ...wordTarget(unknown, "unknown", "Alpha"),
      ...annotationOf(untyped, O.none()),
      ...wordTarget(untyped, "untyped", "Alpha"),
      ...annotationOf(elsewhere, O.some(term.Word)),
      ...wordTarget(elsewhere, "elsewhere", "Alpha", "https://example.org/other"),
    ],
    rejected: [
      [elsewhere, "other-source"],
      [unknown, "unknown-kind"],
      [untyped, "unknown-kind"],
    ],
    annotations: 0,
    residual: all,
  },
  {
    name: "bodies its kind does not read",
    quads: [
      ...annotationOf(emptyMention, O.some(term.Mention)),
      Q.quad(emptyMention, term.hasBody, Q.string("not a class")),
      ...wordTarget(emptyMention, "empty-mention", "Alpha"),
      ...annotationOf(bodiedTitle, O.some(term.Title)),
      Q.quad(bodiedTitle, term.hasBody, Q.named(term.claim)),
      ...wordTarget(bodiedTitle, "bodied-title", "Alpha"),
    ],
    rejected: [
      [bodiedTitle, "body-refused"],
      [emptyMention, "body-refused"],
    ],
    annotations: 0,
    residual: all,
  },
  {
    name: "targets without one verified anchor",
    quads: [
      ...annotationOf(untargeted, O.some(term.Word)),
      ...annotationOf(sourceless, O.some(term.Word)),
      Q.quad(sourceless, term.hasTarget, Q.blank("sourceless-target")),
      ...quoteOf(Q.blank("sourceless-target"), "sourceless-q", Q.string("Alpha")),
      ...annotationOf(fragmentOnly, O.some(term.Word)),
      ...targetOf(fragmentOnly, Q.blank("fragment-target"), [
        Q.quad(Q.blank("fragment-target"), term.hasSelector, Q.blank("fragment")),
        Q.type(Q.blank("fragment"), iri("oa:FragmentSelector")),
      ]),
      ...annotationOf(doubleTyped, O.some(term.Word)),
      ...targetOf(doubleTyped, Q.blank("double-target"), [
        ...positionOf(Q.blank("double-target"), "double", Q.integer(0), Q.integer(5)),
        Q.type(Q.blank("double"), term.quote),
      ]),
      ...annotationOf(startless, O.some(term.Word)),
      ...targetOf(startless, Q.blank("startless-target"), [
        ...positionOf(Q.blank("startless-target"), "startless-p", Q.string("zero"), Q.integer(5)),
      ]),
      ...annotationOf(twoPrefixes, O.some(term.Word)),
      ...targetOf(
        twoPrefixes,
        Q.blank("two-prefixes-target"),
        quoteOf(
          Q.blank("two-prefixes-target"),
          "two-prefixes-q",
          Q.string("beta"),
          [term.prefix, Q.string("a ")],
          [term.prefix, Q.string("Alpha ")]
        )
      ),
      ...annotationOf(iriPrefix, O.some(term.Word)),
      ...targetOf(
        iriPrefix,
        Q.blank("iri-prefix-target"),
        quoteOf(Q.blank("iri-prefix-target"), "iri-prefix-q", Q.string("beta"), [term.prefix, Q.named(term.claim)])
      ),
      ...annotationOf(outOfRange, O.some(term.Word)),
      ...targetOf(
        outOfRange,
        Q.blank("out-target"),
        positionOf(Q.blank("out-target"), "out", Q.integer(20), Q.integer(90))
      ),
    ],
    rejected: [
      [doubleTyped, "target-refused"],
      [fragmentOnly, "target-refused"],
      [iriPrefix, "target-refused"],
      [outOfRange, "target-refused"],
      [sourceless, "target-refused"],
      [startless, "target-refused"],
      [twoPrefixes, "target-refused"],
      [untargeted, "target-refused"],
    ],
    annotations: 0,
    residual: all,
  },
  {
    name: "two times on one annotation and on one run",
    quads: [
      ...annotationOf(twoTimes, O.some(term.Word)),
      ...wordTarget(twoTimes, "two-times", "Alpha"),
      Q.quad(twoTimes, term.generatedAtTime, Q.time(T0)),
      Q.quad(twoTimes, term.generatedAtTime, Q.time(T1)),
      ...annotationOf(runConflict, O.some(term.Word)),
      ...wordTarget(runConflict, "run-conflict", "beta"),
      Q.quad(runConflictRun, term.specializationOf, runConflict),
      Q.quad(runConflictRun, term.creator, alice),
      Q.quad(runConflictRun, term.created, Q.time(T0)),
      Q.quad(runConflictRun, term.created, Q.time(T1)),
    ],
    rejected: [
      [runConflict, "time-conflict"],
      [twoTimes, "time-conflict"],
    ],
    annotations: 0,
    residual: all,
  },
  {
    name: "an instance-form native activity, a blank activity, a time that is not an xsd:dateTime and an idle run",
    quads: [
      ...annotationOf(native, O.some(term.Word)),
      ...wordTarget(native, "native", "Gamma"),
      Q.quad(native, term.wasGeneratedBy, Q.named(instanceIri(activityIdOf("native")))),
      ...annotationOf(blankActivity, O.some(term.Word)),
      ...wordTarget(blankActivity, "blank-activity", "delta"),
      Q.quad(blankActivity, term.wasGeneratedBy, Q.blank("some-activity")),
      ...annotationOf(badTime, O.some(term.Word)),
      ...wordTarget(badTime, "bad-time", "Alpha"),
      Q.quad(badTime, term.creator, alice),
      Q.quad(badTime, term.generatedAtTime, Q.string("yesterday")),
      ...annotationOf(idle, O.some(term.Word)),
      ...wordTarget(idle, "idle", "beta"),
      Q.quad(idle, term.creator, bob),
      Q.quad(idle, term.created, Q.time(T0)),
      Q.quad(idleRun, term.specializationOf, idle),
      Q.quad(idleRun, term.generatedAtTime, Q.time(T1)),
    ],
    rejected: [],
    annotations: 4,
    residual: (input) =>
      A.filter(
        input,
        (q) =>
          (q.object.termType === "BlankNode" && q.predicate.value === term.wasGeneratedBy) ||
          (q.object.termType === "Literal" && q.object.value === "yesterday") ||
          q.subject.value === idleRun.value
      ),
  },
  {
    name: "a rejected annotation that shares its target and its activity with an accepted one",
    quads: [
      ...annotationOf(sharedAccepted, O.some(term.Word)),
      ...targetOf(sharedAccepted, sharedTarget, quoteOf(sharedTarget, "shared-q", Q.string("beta"))),
      Q.quad(sharedAccepted, term.wasGeneratedBy, sharedActivity),
      Q.type(sharedActivity, iri("prov:Activity")),
      ...annotationOf(sharedRejected, O.some(term.Section)),
      Q.quad(sharedRejected, term.hasTarget, sharedTarget),
      Q.quad(sharedRejected, term.wasGeneratedBy, sharedActivity),
    ],
    rejected: [[sharedRejected, "unknown-kind"]],
    annotations: 1,
    // Everything but the accepted annotation's own quads: the shared target, selector and activity typing included.
    residual: (input) => A.filter(input, (q) => q.subject.value !== sharedAccepted.value),
  },
  {
    name: "times at the edges of the four-digit year, and literals outside the xsd:dateTime lexical or value space",
    quads: A.flatMap(edgeTimes, ([label, lexical, kind, word]) => [
      ...annotationOf(annotationNode(label), O.some(kind)),
      ...wordTarget(annotationNode(label), label, word),
      Q.quad(annotationNode(label), term.creator, alice),
      Q.quad(annotationNode(label), term.generatedAtTime, Q.lexicalTime(lexical)),
    ]),
    rejected: [],
    annotations: edgeTimes.length,
    residual: (input) =>
      A.filter(input, (q) =>
        A.some(edgeTimes, ([, lexical, , , instant]) => O.isNone(instant) && q.object.value === lexical)
      ),
  },
];

const fixtureOptions = (text: VerifiedSourceText) => ({
  source: oaSource,
  text,
  importActivity: importActivityOf(inputDigest),
});

it.layer(Digest.layerWebCrypto, { timeout: "60 seconds" })("@beep/annotation OA codec", (it) => {
  it.effect.prop(
    `${L26}: a document over the OA kinds decodes from its encoding`,
    [oaDocumentCase],
    ([generatedCase]) =>
      Effect.gen(function* () {
        const { text: sourceText, document, importedActivities, sourceDigest } = generatedCase;
        const text = yield* verify(document.text, sourceText);
        const options = { source: oaSource, text, importActivity: importActivityOf(sourceDigest) };
        const dataset = Result.getOrThrow(encode({ document, importedActivities }, options));
        expect(A.filter(dataset.quads, hasBlankNode)).toStrictEqual([]);
        const decoded = yield* decode(dataset, options);
        assertEquals(decoded.document, document);
        assertEquals(decoded.importedActivities, importedActivities);
        expect(decoded.rejected).toStrictEqual([]);
        expect(A.every(decoded.residual.quads, isNifQuad)).toBe(true);
        assertEquals(resolutions(sourceText, decoded.document), resolutions(sourceText, document));
        // The encoder's output is already in normal form.
        const normalized = yield* normalize(dataset, options);
        assertEquals(quadSet(normalized), quadSet(dataset));
      }),
    runs
  );

  it.effect.prop(
    `${L26}: third-party input encodes after decoding to its normal form`,
    [oaInputCase],
    ([input]) =>
      Effect.gen(function* () {
        const text = yield* verify(input.source, input.text);
        const options = fixtureOptions(text);
        const decoded = yield* decode(input.dataset, options);
        const encoded = Result.getOrThrow(encode(decoded, options));
        const normalized = yield* normalize(input.dataset, options);
        assertEquals(quadSet(encoded), quadSet(normalized));
        const inputQuads = quadSet(input.dataset);
        expect(A.every(decoded.residual.quads, (q) => HashSet.has(inputQuads, Rdf.serializeQuad(q)))).toBe(true);
        // Every quad a rejected annotation reaches stays in the residual, so the residual rejects it again.
        const residual = quadSet(decoded.residual);
        for (const rejection of decoded.rejected) {
          const missing = A.filter(
            reachedFrom(input.dataset.quads, rejection.subject),
            (q) => !HashSet.has(residual, Rdf.serializeQuad(q))
          );
          expect(A.map(missing, Rdf.serializeQuad)).toStrictEqual([]);
        }
        const reread = yield* decode(decoded.residual, options);
        expect(reread.rejected).toStrictEqual(decoded.rejected);
        const again = yield* decode(encoded, options);
        assertEquals(again.document, decoded.document);
        assertEquals(resolutions(input.text, again.document), resolutions(input.text, decoded.document));
      }),
    runs
  );

  it.effect(
    `${L26}: the fixtures normalize, reject and keep their residual as listed`,
    Effect.fnUntraced(function* () {
      const text = yield* verify(fixtureSource, fixtureText);
      const options = fixtureOptions(text);
      for (const fixture of fixtures) {
        const dataset = Rdf.makeDataset(fixture.quads);
        const decoded = yield* decode(dataset, options);
        const encoded = Result.getOrThrow(encode(decoded, options));
        const normalized = yield* normalize(dataset, options);
        expect([fixture.name, Rdf.areDatasetsEquivalent(encoded, normalized)]).toStrictEqual([fixture.name, true]);
        expect([fixture.name, decoded.rejected]).toStrictEqual([
          fixture.name,
          A.map(fixture.rejected, ([subject, reason]) => OaRejection.make({ subject, reason })),
        ]);
        expect([fixture.name, HashMap.size(decoded.document.annotations)]).toStrictEqual([
          fixture.name,
          fixture.annotations,
        ]);
        assertEquals(quadSet(decoded.residual), quadSet(Rdf.makeDataset(fixture.residual(fixture.quads))));
        const again = yield* decode(encoded, options);
        expect([fixture.name, Equal.equals(again.document, decoded.document)]).toStrictEqual([fixture.name, true]);
      }
    })
  );

  it.effect(
    `${L26}: attribution reads each form, and unattributed input takes the import activity`,
    Effect.fnUntraced(function* () {
      const text = yield* verify(fixtureSource, fixtureText);
      const options = fixtureOptions(text);
      const generationsOf = Effect.fnUntraced(function* (fixture: number) {
        const decoded = yield* decode(Rdf.makeDataset(A.getUnsafe(fixtures, fixture).quads), options);
        return {
          decoded,
          generations: A.flatMap(decoded.document.attribution.pipe(HashMap.values, A.fromIterable), A.fromIterable),
        };
      });
      const stated = (generation: Generation) => O.map(generation.at, DateTime.toEpochMillis);

      const unattributed = yield* generationsOf(0);
      assertEquals(
        A.map(unattributed.generations, (g) => [g.activity, stated(g)]),
        [[importActivityIdOf(inputDigest), O.some(T1)]]
      );
      assertEquals(unattributed.decoded.importedActivities, HashMap.empty());

      const creator = ImportedActivity.cases.Creator.make({ agent: IRI.make(alice.value) });
      const creatorOnly = yield* generationsOf(1);
      assertEquals(
        A.map(creatorOnly.generations, (g) => [g.activity, stated(g)]),
        [[importedActivityIdOf(creator), O.none()]]
      );
      assertEquals(creatorOnly.decoded.importedActivities, HashMap.make([importedActivityIdOf(creator), creator]));

      const generator = ImportedActivity.cases.Generator.make({ agent: IRI.make(software.value) });
      const generatorOnly = yield* generationsOf(2);
      assertEquals(
        generatorOnly.decoded.importedActivities,
        HashMap.make([importedActivityIdOf(generator), generator])
      );
      assertEquals(A.map(generatorOnly.generations, stated), [O.some(T0)]);

      const twoCreators = yield* generationsOf(3);
      const bobCreator = ImportedActivity.cases.Creator.make({ agent: IRI.make(bob.value) });
      expect(HashMap.size(twoCreators.decoded.importedActivities)).toBe(2);
      expect(
        A.sort(
          A.map(twoCreators.generations, (g) => `${g.activity} ${O.getOrElse(stated(g), () => 0)}`),
          Order.String
        )
      ).toStrictEqual(
        A.sort([`${importedActivityIdOf(creator)} ${T0}`, `${importedActivityIdOf(bobCreator)} ${T1}`], Order.String)
      );

      // An xsd:dateTime past year 9999 or before year 1 is a time; a literal outside the lexical or value space is none.
      const edges = yield* generationsOf(12);
      const shown = (instant: O.Option<number>) => O.match(instant, { onNone: () => "none", onSome: (m) => `${m}` });
      expect(
        A.sort(
          A.map(edges.generations, (g) => shown(stated(g))),
          Order.String
        )
      ).toStrictEqual(
        A.sort(
          A.map(edgeTimes, ([, , , , instant]) => shown(instant)),
          Order.String
        )
      );
      const mixed = yield* generationsOf(10);
      const activities = HashSet.fromIterable(A.map(mixed.generations, (g) => g.activity));
      expect(HashSet.has(activities, activityIdOf("native"))).toBe(true);
      // The blank activity is no statement, so that annotation takes the import activity.
      expect(HashSet.has(activities, importActivityIdOf(inputDigest))).toBe(true);
    })
  );

  it.effect(
    `${L26}: offsets are code points on the wire and a split surrogate is refused`,
    Effect.fnUntraced(function* () {
      const astral = "A😀B";
      const source = SourceTextIdentity.make({ ...fixtureSource, textDigest: textDigestOf(sha256)(astral) });
      const text = yield* verify(source, astral);
      const options = { source: oaSource, text, importActivity: importActivityOf(inputDigest) };
      const b = anchoredOn(source, astral, { start: 3, end: 4 });
      const wordOnB = yield* targetsOf(b);
      const document = yield* codec.assemble({
        text: source,
        generation: { activity: activityIdOf("astral"), at: O.some(DateTime.makeUnsafe(T0)) },
        anchors: [b],
        annotations: [OaKinds.Word.case.make({ targets: wordOnB, body: Word.make({}) })],
      });
      const dataset = Result.getOrThrow(encode({ document, importedActivities: HashMap.empty() }, options));
      const offsets = A.flatMap(dataset.quads, (q) =>
        q.predicate.value === term.start || q.predicate.value === term.end ? [q.object.value] : []
      );
      expect(A.sort(offsets, Order.String)).toStrictEqual(["2", "3"]);
      const decoded = yield* decode(dataset, options);
      assertEquals(decoded.document, document);
      expect(
        A.map(decoded.document.anchors.pipe(HashMap.values, A.fromIterable), (row) => row.receipt.anchor.startChar)
      ).toStrictEqual([3]);

      // A third-party position selector at code points 2..3 reads back as UTF-16 3..4.
      const reader = annotationNode("astral");
      const thirdParty = Rdf.makeDataset([
        ...annotationOf(reader, O.some(term.Word)),
        ...targetOf(
          reader,
          Q.blank("astral-target"),
          positionOf(Q.blank("astral-target"), "ap", Q.integer(2), Q.integer(3))
        ),
      ]);
      const read = yield* decode(thirdParty, options);
      assertEquals(read.document.anchors, document.anchors);

      // A forged row, keyed by a seeded id through the bare schema: minting refuses a quote that is not well formed.
      const forged = (anchor: TextAnchor) => {
        const id = occurrenceIdOf(anchor.quote);
        const forgedWord = OaKinds.Word.case.make({ targets: HashSet.make(id), body: Word.make({}) });
        const content = annotationIdOf(forgedWord);
        const forgedDocument = OaDocument.make({
          text: source,
          anchors: HashMap.make([
            id,
            Anchored.make({ receipt: TextAnchorVerificationReceipt.make({ anchor, source }) }),
          ]),
          annotations: HashMap.make([content, forgedWord]),
          attribution: HashMap.make([
            content,
            HashSet.make(generationOf({ content, activity: activityIdOf("astral"), at: O.none() })),
          ]),
        });
        return encode({ document: forgedDocument, importedActivities: HashMap.empty() }, options);
      };
      // UTF-16 2..4 splits the surrogate pair of the emoji.
      const split = forged(TextAnchor.make({ startChar: 2, endChar: 4, quote: Str.slice(2, 4)(astral) }));
      assertEquals(split, Result.fail(OaEncodeRefused.make({ reason: "split-boundary" })));
      // A quote that is not the text it ranges over is not a receipt over this text.
      const mismatched = forged(TextAnchor.make({ startChar: 0, endChar: 1, quote: "Z" }));
      assertEquals(mismatched, Result.fail(OaEncodeRefused.make({ reason: "capture-mismatch" })));
      // Another text is another capture.
      const other = yield* verify(fixtureSource, fixtureText);
      assertEquals(
        encode({ document, importedActivities: HashMap.empty() }, { source: oaSource, text: other }),
        Result.fail(OaEncodeRefused.make({ reason: "capture-mismatch" }))
      );
    })
  );

  it.effect(
    `${L26}: a stated time outside years 0000 to 9999 is written as an xsd:dateTime and survives the codec`,
    Effect.fnUntraced(function* () {
      const text = yield* verify(fixtureSource, fixtureText);
      const options = fixtureOptions(text);
      const row = anchoredOn(fixtureSource, fixtureText, { start: 12, end: 17 });
      const word = OaKinds.Word.case.make({ targets: yield* targetsOf(row), body: Word.make({}) });
      // Each instant with the lexical form the encoder writes for it: no `+`, four or more year digits.
      const written: ReadonlyArray<readonly [number, string]> = [
        [-8_640_000_000_000_000, "-271821-04-20T00:00:00.000Z"],
        [-62_198_755_200_000, "-0001-01-01T00:00:00.000Z"],
        [-62_167_219_200_000, "0000-01-01T00:00:00.000Z"],
        [253_402_300_799_999, "9999-12-31T23:59:59.999Z"],
        [253_402_300_800_000, "10000-01-01T00:00:00.000Z"],
        [8_640_000_000_000_000, "275760-09-13T00:00:00.000Z"],
      ];
      const parts = yield* Effect.forEach(
        written,
        ([millis], index) =>
          codec.assemble({
            text: fixtureSource,
            generation: { activity: activityIdOf(`edge-${index}`), at: O.some(DateTime.makeUnsafe(millis)) },
            anchors: [row],
            annotations: [word],
          }),
        { concurrency: 1 }
      );
      const empty = OaDocument.make({
        text: fixtureSource,
        anchors: HashMap.empty(),
        annotations: HashMap.empty(),
        attribution: HashMap.empty(),
      });
      const document = yield* Effect.reduce(parts, constant(empty), (merged, part) =>
        Effect.fromResult(mergeDocuments(merged, part))
      );
      const dataset = Result.getOrThrow(encode({ document, importedActivities: HashMap.empty() }, options));
      const literals = A.flatMap(dataset.quads, (q) =>
        q.predicate.value === term.generatedAtTime ? [q.object.value] : []
      );
      expect(A.sort(literals, Order.String)).toStrictEqual(
        A.sort(
          A.map(written, ([, lexical]) => lexical),
          Order.String
        )
      );
      const decoded = yield* decode(dataset, options);
      assertEquals(decoded.document, document);
      expect(A.every(decoded.residual.quads, isNifQuad)).toBe(true);
    })
  );

  it.effect(
    `${L26}: an imported activity's IRI survives the round trip beside a native generation`,
    Effect.fnUntraced(function* () {
      const text = yield* verify(fixtureSource, fixtureText);
      const options = fixtureOptions(text);
      const row = anchoredOn(fixtureSource, fixtureText, { start: 12, end: 17 });
      const imported = ImportedActivity.cases.Activity.make({ iri: IRI.make(activity.value) });
      const importedId = importedActivityIdOf(imported);
      const targets = yield* targetsOf(row);
      const claim = OaKinds.Mention.case.make({ targets, body: Mention.make({ class: TermIri.make(term.claim) }) });
      const parts = (generation: { readonly activity: typeof importedId; readonly at: O.Option<DateTime.Utc> }) =>
        codec.assemble({ text: fixtureSource, generation, anchors: [row], annotations: [claim] });
      const nativePart = yield* parts({ activity: activityIdOf("native"), at: O.some(DateTime.makeUnsafe(T0)) });
      const importedPart = yield* parts({ activity: importedId, at: O.none() });
      const importPart = yield* parts({
        activity: importActivityIdOf(inputDigest),
        at: O.some(DateTime.makeUnsafe(T1)),
      });
      const merged = Result.getOrThrow(
        Result.flatMap(
          Result.flatMap(Result.succeed(nativePart), (d) => mergeDocuments(d, importedPart)),
          (d) => mergeDocuments(d, importPart)
        )
      );
      const importedActivities = HashMap.make([importedId, imported]);
      const dataset = Result.getOrThrow(encode({ document: merged, importedActivities }, options));
      expect(
        A.some(dataset.quads, (q) => q.predicate.value === term.wasGeneratedBy && q.object.value === activity.value)
      ).toBe(true);
      const decoded = yield* decode(dataset, options);
      assertEquals(decoded.document, merged);
      assertEquals(decoded.importedActivities, importedActivities);
      assertNone(instanceHash(IRI.make(activity.value)));
      const hash = ContentHash.make(`sha256:${Str.repeat(64)("a")}`);
      assertEquals(instanceHash(instanceIri(hash)), O.some(hash));
      assertNone(instanceHash(IRI.make(`${instanceIri(hash)}/position`)));
    })
  );

  it.effect(
    `${L26}: an empty input decodes to an empty document and normalizes to an empty dataset`,
    Effect.fnUntraced(function* () {
      const text = yield* verify(fixtureSource, fixtureText);
      const options = fixtureOptions(text);
      const decoded = yield* decode(Rdf.makeDataset([]), options);
      expect(HashMap.size(decoded.document.annotations)).toBe(0);
      const normalized = yield* normalize(Rdf.makeDataset([]), options);
      expect(normalized.quads).toStrictEqual([]);
    })
  );
});
