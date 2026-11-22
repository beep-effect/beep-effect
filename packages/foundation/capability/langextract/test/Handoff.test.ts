import { AnnotationId } from "@beep/annotation/AnnotationId";
import { Generation, mintRunEntityId } from "@beep/annotation/Generation";
import { ExtractionDocument } from "@beep/annotation/Kinds";
import { iri } from "@beep/identity/Registry";
import { TermIri } from "@beep/identity/Term";
import { mintActivityId } from "@beep/jsonc/ActivityStart";
import { AlignmentSource, alignCandidates } from "@beep/langextract/Alignment";
import { ExtractionCandidate, GroundedExtraction, LangExtractRequest } from "@beep/langextract/Extraction";
import {
  decodeExtractionHandoff,
  ExtractionHandoff,
  encodeExtractionHandoff,
  extractionDocumentCodec,
  handoff,
  startExtraction,
} from "@beep/langextract/Handoff";
import { allowRemoteExtractionPolicyLayer, LangExtractService, layer } from "@beep/langextract/Service";
import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target";
import { Sha256PrefixedDigest } from "@beep/schema/Sha256";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { it } from "@beep/test-runner";
import { mintCaptureId } from "@beep/text/Capture";
import { mintOccurrenceId } from "@beep/text/Occurrence";
import { TextAnchor } from "@beep/text/TextAnchor";
import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as LanguageModel from "effect/ai/LanguageModel";
import * as Model from "effect/ai/Model";
import * as Response from "effect/ai/Response";
import * as Context from "effect/Context";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { sourceForText } from "./support/handoff.ts";

const personClass = TermIri.make(iri("semantica:person"));
const person = ExtractionTarget.make({
  name: "person",
  kind: "entity",
  annotates: TargetAnnotation.cases.Mention.make({ class: personClass, coreference: O.some("cluster") }),
});
const relation = ExtractionTarget.make({
  name: "relation",
  kind: "relation",
  annotates: TargetAnnotation.cases.Relation.make({
    subject: "subject",
    object: "object",
    predicate: "predicate",
    predicates: { knows: TermIri.make(iri("semantica:shows")), observes: TermIri.make(iri("semantica:selected")) },
    endpoint: TermIri.make(iri("semantica:relation-endpoint")),
  }),
});
const targets = [person, relation] as const;
const text = "Ada knows Bob. Ada greets Charles.";
const source = sourceForText(text);
const candidate = (label: string, value: string, attributes: Record<string, string> = {}) =>
  ExtractionCandidate.make({
    label,
    text: value,
    attributes: O.some(attributes),
    confidence: UnitInterval.makeOption(0.9),
  });
const candidates = [
  candidate("person", "Bob", { cluster: "people" }),
  candidate("person", "Charles", { cluster: "people" }),
  candidate("person", "BOB", { cluster: "people" }),
  candidate("relation", "Ada knows Bob.", { subject: "Ada", object: "Bob", predicate: "knows" }),
  candidate("relation", "Ada knows Bob.", { subject: "Ada", object: "Bob", predicate: "observes" }),
  candidate("unknown", "Bob"),
  candidate("person", "Nobody"),
  candidate("relation", "Ada knows Bob.", { subject: "Ada" }),
  candidate("relation", "Ada knows Bob.", { subject: "Ada", object: "Bob", predicate: "unknown" }),
  candidate("relation", "Ada knows Bob.", { subject: "Ada", object: "B0b", predicate: "knows" }),
];
const testLayer = Layer.mergeAll(
  Digest.layerWebCrypto,
  Layer.succeed(Model.ProviderName, "test-provider"),
  Layer.succeed(Model.ModelName, "stub-model")
);
const build = Effect.fn("HandoffTest.build")(function* (
  grounded: ReadonlyArray<GroundedExtraction> = alignCandidates(
    candidates,
    AlignmentSource.make({ sourceText: text, fuzzyThreshold: UnitInterval.make(1) })
  ),
  sourceText: string = text,
  overCap: ReadonlyArray<ExtractionCandidate> = A.empty<ExtractionCandidate>()
) {
  const capture = sourceForText(sourceText);
  const verified = yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({ expectedSource: capture, source: capture, sourceText })
  );
  const activity = yield* startExtraction({ prompt: "synthetic prompt", source: capture, started: 0 });
  return yield* handoff({ targets, verified, candidates: grounded, overCap, activity, at: DateTime.makeUnsafe(1) });
});
const decodeGeneration = S.decodeUnknownEffect(Generation);
const decodeHandoffType = S.decodeUnknownEffect(S.toType(ExtractionHandoff));
const canonicalize = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

class ModelCalls extends Context.Service<ModelCalls, Ref.Ref<number>>()(
  "@beep/langextract/test/Handoff.test/ModelCalls"
) {}
const mismatchModel = Model.make(
  "test-provider",
  "stub-model",
  Layer.effect(
    LanguageModel.LanguageModel,
    Effect.gen(function* () {
      const calls = yield* ModelCalls;
      const usage = Response.Usage.make({
        inputTokens: { cacheRead: undefined, cacheWrite: undefined, total: 0, uncached: 0 },
        outputTokens: { reasoning: undefined, text: 0, total: 0 },
      });
      return yield* LanguageModel.make({
        generateText: () =>
          Ref.update(calls, (count) => count + 1).pipe(
            Effect.as([
              Response.makePart("text", { text: '{"extractions":[]}' }),
              Response.makePart("finish", { reason: "stop", response: undefined, usage }),
            ])
          ),
        streamText: () => Stream.empty,
      });
    })
  )
).pipe(Layer.provideMerge(Layer.effect(ModelCalls, Ref.make(0))));
const mismatchLayer = layer.pipe(
  Layer.provideMerge(Layer.mergeAll(mismatchModel, allowRemoteExtractionPolicyLayer, testLayer))
);

describe("verified handoff", () => {
  it.layer(testLayer, { timeout: "10 seconds" })("document and readings", (it) => {
    it.effect(
      "P3-H the handoff names the capture with both digests, its scope and its pins",
      Effect.fnUntraced(function* () {
        expect((yield* build()).document.text).toEqual(source);
      })
    );
    it.effect(
      "P3-H every target is a verified receipt of the aligner's anchor",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        for (const [id, row] of h.document.anchors) {
          const yielded1 = yield* mintOccurrenceId(row);
          expect(yielded1).toBe(id);
          expect(row.receipt.source).toEqual(source);
          expect(Str.slice(row.receipt.anchor.startChar, row.receipt.anchor.endChar)(text)).toBe(
            row.receipt.anchor.quote
          );
        }
      })
    );
    it.effect(
      "P3-H the producer is an activity minted at start",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        expect(h.activity.start.operation).toBe(iri("operation:Extract"));
        expect(h.activity.start.pin).toEqual({ _tag: "Engine", engine: "test-provider", edition: "stub-model" });
        const yielded2 = yield* mintCaptureId(source);
        expect(h.activity.start.used).toEqual(HashSet.make(yielded2));
        const yielded3 = yield* mintActivityId(h.activity.start);
        expect(h.activity.id).toBe(yielded3);
        const expectedPromptDigest = Sha256PrefixedDigest.make(
          `sha256:${process.getBuiltinModule("node:crypto").createHash("sha256").update("synthetic prompt").digest("hex")}`
        );
        assertSome(h.activity.start.promptDigest, expectedPromptDigest);
        for (const generations of HashMap.values(h.document.attribution))
          for (const generation of generations) {
            expect(generation.activity).toBe(h.activity.id);
            expect(O.getOrThrow(generation.at).epochMilliseconds).toBeGreaterThanOrEqual(
              h.activity.start.started.epochMilliseconds
            );
          }
      })
    );
    it.effect(
      "P3-H readings keep the label, model text, attributes, tier and confidence",
      Effect.fnUntraced(function* () {
        const anchor = TextAnchor.make({ startChar: S.Natural.make(10), endChar: S.Natural.make(13), quote: "Bob" });
        const fields = {
          label: "person",
          text: "Bob",
          anchor,
          confidence: UnitInterval.makeOption(0.7),
          attributes: O.some({ cluster: "one" }),
        };
        const h = yield* build([
          GroundedExtraction.cases.match_exact.make(fields),
          GroundedExtraction.cases.match_lesser.make(fields),
          GroundedExtraction.cases.match_minimal_fold.make(fields),
          GroundedExtraction.cases.match_fuzzy.make(fields),
        ]);
        const readings = h.readings.pipe(HashMap.toValues, A.flatten);
        expect(A.map(readings, (reading) => reading.alignment)).toEqual([
          "match_exact",
          "match_lesser",
          "match_minimal_fold",
          "match_fuzzy",
        ]);
        expect(readings).toEqual(
          A.map(["match_exact", "match_lesser", "match_minimal_fold", "match_fuzzy"], (alignment, candidate) => ({
            candidate,
            label: fields.label,
            text: fields.text,
            attributes: fields.attributes,
            confidence: fields.confidence,
            alignment,
          }))
        );
        const aligned = alignCandidates(candidates, AlignmentSource.make({ sourceText: text }));
        const tail = [candidate("tail-person", "Bob", { source: "cap" }), candidate("tail-relation", "Ada")];
        const complete = yield* build(aligned, text, tail);
        const originals = A.appendAll(candidates, tail);
        const all = A.appendAll(complete.readings.pipe(HashMap.toValues, A.flatten), complete.residual);
        expect(all).toHaveLength(originals.length);
        for (const reading of all) {
          const original = A.getUnsafe(originals, reading.candidate);
          expect(reading.label).toBe(original.label);
          expect(reading.text).toBe(original.text);
          expect(reading.attributes).toEqual(original.attributes);
          expect(reading.confidence).toEqual(original.confidence);
          expect(reading.alignment).toBe(
            reading.candidate < aligned.length ? A.getUnsafe(aligned, reading.candidate).alignmentStatus : "unaligned"
          );
        }
      })
    );
    it.effect(
      "P3-H relation and coreference candidates are typed annotations",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const relations = A.filter(HashMap.toValues(h.document.annotations), (row) => row._tag === "RelationCandidate");
        expect(relations).toHaveLength(2);
        expect(relations[0]?.body.subject).toBe(relations[1]?.body.subject);
        const rel = O.getOrThrow(A.head(relations));
        expect(HashSet.size(rel.targets)).toBe(1);
        expect(HashMap.getUnsafe(h.document.annotations, rel.body.subject)._tag).toBe("Mention");
        expect(HashMap.getUnsafe(h.document.annotations, rel.body.object)._tag).toBe("Mention");
        const coref = O.getOrThrow(
          A.findFirst(HashMap.toValues(h.document.annotations), (row) => row._tag === "CorefCandidate")
        );
        const union = HashSet.fromIterable(
          A.flatMap(A.fromIterable(coref.body.members), (id) =>
            A.fromIterable(HashMap.getUnsafe(h.document.annotations, id).targets)
          )
        );
        expect(coref.targets).toEqual(union);
        expect(HashSet.size(coref.body.members)).toBe(2);
      })
    );
    it.effect(
      "P3-H no candidate is lost",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        expect(h.candidateCount).toBe(candidates.length);
        expect(A.map(h.residual, (candidate) => candidate.reason)).toEqual([
          "unmapped-label",
          "unaligned",
          "relation-attribute-missing",
          "unmapped-predicate",
          "relation-endpoint-unresolved",
        ]);
        const aligned = alignCandidates(
          candidates,
          AlignmentSource.make({ sourceText: text, fuzzyThreshold: UnitInterval.make(1) })
        );
        for (const candidate of h.residual) {
          const original = A.getUnsafe(aligned, candidate.candidate);
          if (original.alignmentStatus === "unaligned") assertNone(candidate.anchor);
          else assertSome(candidate.anchor, original.anchor);
        }
        const yielded4 = yield* decodeHandoffType({ ...h, residual: A.dropRight(h.residual, 1) }).pipe(
          Effect.isFailure
        );
        expect(yielded4).toBe(true);
        for (const index of [0, 99]) {
          const malformed = {
            ...h,
            residual: A.map(h.residual, (candidate, position) =>
              position === 0 ? { ...candidate, candidate: index } : candidate
            ),
          };
          const fails = yield* decodeHandoffType(malformed).pipe(Effect.isFailure);
          expect(fails).toBe(true);
        }
        const single = GroundedExtraction.cases.match_exact.make({
          label: "person",
          text: "Bob",
          anchor: TextAnchor.make({ startChar: S.Natural.make(10), endChar: S.Natural.make(13), quote: "Bob" }),
        });
        const withoutCluster = yield* build([single]);
        expect(HashMap.size(withoutCluster.document.annotations)).toBe(1);
        const evidenceText = "😀 Bob";
        const evidence = TextAnchor.make({
          startChar: S.Natural.make(0),
          endChar: S.Natural.make(evidenceText.length),
          quote: evidenceText,
        });
        for (const endpoints of [
          { subject: "\ud83d", object: "Bob" },
          { subject: "Bob", object: "\ud83d" },
          { subject: "", object: "Bob" },
        ]) {
          const badEndpoint = GroundedExtraction.cases.match_exact.make({
            label: "relation",
            text: evidenceText,
            anchor: evidence,
            attributes: O.some({ ...endpoints, predicate: "knows" }),
          });
          const unresolved = yield* build([badEndpoint], evidenceText);
          expect(unresolved.residual[0]?.reason).toBe("relation-endpoint-unresolved");
        }
        const capped = yield* build([], text, [candidate("person", "cap-skipped", { source: "cap" })]);
        expect(capped.candidateCount).toBe(1);
        expect(capped.residual[0]?.reason).toBe("over-extraction-cap");
        const empty = yield* build([]);
        expect(empty.candidateCount).toBe(0);
        const refused = yield* build([
          GroundedExtraction.cases.match_exact.make({
            label: "person",
            text: "Ada",
            anchor: TextAnchor.make({ startChar: S.Natural.make(1), endChar: S.Natural.make(4), quote: "Ada" }),
          }),
        ]);
        expect(refused.residual[0]?.reason).toBe("verification-refused");
      })
    );
    it.effect(
      "P3-H the checked wire refuses forged and repeated document keys",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const wire = yield* encodeExtractionHandoff(h);
        const forged = {
          ...wire,
          document: {
            ...wire.document,
            attribution: A.map(wire.document.attribution, ([key, generations]) => [
              key,
              A.map(generations, (generation) => ({
                ...generation,
                run: `sha256:${Str.repeat(64)("f")}`,
              })),
            ]),
          },
        };
        const refused = yield* decodeExtractionHandoff(forged).pipe(Effect.isFailure);
        expect(refused).toBe(true);
        const error = yield* decodeExtractionHandoff(forged).pipe(Effect.flip);
        expect(error._tag).toBe("DocumentKeyMismatch");
        const repeated = {
          ...wire,
          document: {
            ...wire.document,
            anchors: A.append(wire.document.anchors, A.getUnsafe(wire.document.anchors, 0)),
          },
        };
        const repeatedError = yield* decodeExtractionHandoff(repeated).pipe(Effect.flip);
        expect(repeatedError._tag).toBe("DocumentKeyRepeated");
      })
    );
    it.effect(
      "P3-H the checked wire refuses a consistently forged annotation key",
      Effect.fnUntraced(function* () {
        const h = yield* build(
          alignCandidates([candidate("person", "Bob")], AlignmentSource.make({ sourceText: text }))
        );
        const [originalId, annotation] = O.getOrThrow(h.document.annotations.pipe(HashMap.toEntries, A.head));
        const forgedId = AnnotationId.make(`sha256:${Str.repeat(64)("f")}`);
        const original = O.getOrThrow(
          HashMap.getUnsafe(h.document.attribution, originalId).pipe(A.fromIterable, A.head)
        );
        const run = yield* mintRunEntityId(forgedId, h.activity.id);
        const document = ExtractionDocument.make({
          ...h.document,
          annotations: HashMap.make([forgedId, annotation]),
          attribution: HashMap.make([forgedId, HashSet.make(Generation.make({ ...original, content: forgedId, run }))]),
        });
        const forged = ExtractionHandoff.make({
          ...h,
          document,
          readings: HashMap.make([forgedId, HashMap.getUnsafe(h.readings, originalId)]),
        });
        const wire = yield* encodeExtractionHandoff(forged);
        const refused = yield* decodeExtractionHandoff(wire).pipe(Effect.isFailure);
        expect(refused).toBe(true);
        const error = yield* decodeExtractionHandoff(wire).pipe(Effect.flip);
        expect(error._tag).toBe("DocumentKeyMismatch");
      })
    );
    it.effect(
      "P3-H the checked wire refuses readings that name no annotation",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const wire = yield* encodeExtractionHandoff(h);
        const unknown = `sha256:${Str.repeat(64)("f")}`;
        const malformed = {
          ...wire,
          readings: A.map(wire.readings, ([key, readings], index) => [index === 0 ? unknown : key, readings]),
        };
        const rejected = yield* decodeExtractionHandoff(malformed).pipe(Effect.isFailure);
        expect(rejected).toBe(true);
      })
    );
    it.effect(
      "P3-H the checked wire refuses a correctly minted generation of another activity",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const wire = yield* encodeExtractionHandoff(h);
        const other = yield* startExtraction({ prompt: "other generation", source, started: 0 });
        const attribution = yield* Effect.forEach(
          wire.document.attribution,
          ([key, generations]) =>
            Effect.forEach(
              generations,
              Effect.fnUntraced(function* (generation) {
                const original = yield* decodeGeneration(generation);
                const run = yield* mintRunEntityId(original.content, other.id);
                return { ...generation, activity: other.id, run };
              }),
              { concurrency: 1 }
            ).pipe(Effect.map((rows) => [key, rows] as const)),
          { concurrency: 1 }
        );
        const malformed = { ...wire, document: { ...wire.document, attribution } };
        // The document is valid on its own: only the handoff's activity check may refuse it.
        yield* extractionDocumentCodec.decode(malformed.document);
        const rejected = yield* decodeExtractionHandoff(malformed).pipe(Effect.isFailure);
        expect(rejected).toBe(true);
      })
    );
    it.effect(
      "P3-H the checked wire refuses both residual anchor inconsistencies",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const wire = yield* encodeExtractionHandoff(h);
        for (const alignment of ["match_exact", "unaligned"]) {
          const malformed = {
            ...wire,
            residual: A.map(wire.residual, (residual, index) => {
              const { anchor, ...fields } = residual;
              return index === 0
                ? { ...fields, alignment, ...(alignment === "unaligned" ? { anchor } : {}) }
                : residual;
            }),
          };
          const rejected = yield* decodeExtractionHandoff(malformed).pipe(Effect.isFailure);
          expect(rejected).toBe(true);
        }
      })
    );
    it.effect(
      "P3-H the handoff survives its checked codec",
      Effect.fnUntraced(function* () {
        const h = yield* build();
        const encoded = yield* encodeExtractionHandoff(h);
        const yielded5 = yield* decodeExtractionHandoff(encoded);
        expect(yielded5).toEqual(h);
        const reversed = ExtractionHandoff.make({
          ...h,
          readings: h.readings.pipe(HashMap.map(A.reverse), HashMap.toEntries, A.reverse, HashMap.fromIterable),
        });
        const yielded6 = yield* encodeExtractionHandoff(reversed);
        const yielded7 = yield* canonicalize(yielded6);
        const yielded8 = yield* canonicalize(encoded);
        expect(yielded7).toBe(yielded8);
        const otherActivity = yield* startExtraction({ prompt: "other prompt", source, started: 0 });
        const forged = ExtractionHandoff.make({ ...h, activity: { ...h.activity, start: otherActivity.start } });
        const forgedJson = yield* encodeExtractionHandoff(forged);
        const error = yield* decodeExtractionHandoff(forgedJson).pipe(Effect.flip);
        expect(error._tag).toBe("HandoffRefused");
        if (error._tag === "HandoffRefused") expect(error.reason).toBe("activity-id-mismatch");
        expect(A.map(encoded.readings, (entry) => entry[0])).toEqual(
          A.sort(
            A.map(encoded.readings, (entry) => entry[0]),
            Order.String
          )
        );
        const duplicate = { ...encoded, readings: A.append(encoded.readings, O.getOrThrow(A.head(encoded.readings))) };
        const repeated = yield* decodeExtractionHandoff(duplicate).pipe(Effect.flip);
        expect(repeated._tag).toBe("HandoffRefused");
        if (repeated._tag === "HandoffRefused") expect(repeated.reason).toBe("readings-key-repeated");
        const yielded9 = yield* decodeExtractionHandoff({}).pipe(Effect.isFailure);
        expect(yielded9).toBe(true);
      })
    );
  });
  it.layer(mismatchLayer, { timeout: "10 seconds" })("capture input", (it) => {
    it.effect(
      "P3-H a text that is not the capture fails the run",
      Effect.fnUntraced(function* () {
        const service = yield* LangExtractService;
        const request = LangExtractRequest.make({ source, targets, text: "different text" });
        const error = yield* service.extract(request).pipe(Effect.flip);
        expect(error.reason).toBe("source-text-mismatch");
        const calls = yield* ModelCalls;
        const count = yield* Ref.get(calls);
        expect(count).toBe(0);
      })
    );
  });
});
