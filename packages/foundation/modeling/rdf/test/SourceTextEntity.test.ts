import { instanceIri } from "@beep/rdf/InstanceIri";
import { Literal, makeDataset, makeLiteral, makeNamedNode, makeQuad, Quad } from "@beep/rdf/Rdf";
import { fromDataset, SourceTextEntityRefused, toDataset } from "@beep/rdf/SourceTextEntity";
import { it } from "@beep/test-runner";
import { mintCaptureId } from "@beep/text/Capture";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { expect } from "@effect/vitest";
import { assertEquals } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { Dataset } from "@beep/rdf/Rdf";

const textTerm = (name: string) => makeNamedNode(`https://beep-effect.com/ns/text/${name}`);

const scopeRef = "matter:example";

const encoded: typeof SourceTextIdentity.Encoded = {
  scopeRef,
  sourceRef: "source:example",
  locator: "documents/source.txt",
  sourceDigest: `sha256:${Str.repeat(64)("a")}`,
  textDigest: `sha256:${Str.repeat(64)("b")}`,
  extractor: { name: "utf8", version: "1" },
  normalizationVersion: "1",
};

const decodeIdentity = S.decodeEffect(SourceTextIdentity);

const quadsOf = (dataset: Dataset): ReadonlyArray<Quad> => A.fromIterable(dataset.quads);

const withoutPredicate = (dataset: Dataset, name: string): Dataset =>
  makeDataset(A.filter(quadsOf(dataset), (quad) => quad.predicate.value !== textTerm(name).value));

const replacing = (dataset: Dataset, name: string, object: Quad["object"]): Dataset =>
  makeDataset(
    A.map(quadsOf(dataset), (quad) =>
      quad.predicate.value === textTerm(name).value
        ? Quad.make({ subject: quad.subject, predicate: quad.predicate, object, graph: quad.graph })
        : quad
    )
  );

const refusal = (dataset: Dataset, scope: string = scopeRef) =>
  Effect.map(Effect.flip(fromDataset(scope)(dataset)), (error) =>
    error._tag === "SourceTextEntityRefused" ? error.reason : error._tag
  );

it.layer(Digest.layerWebCrypto)("@beep/rdf/SourceTextEntity", (it) => {
  it.effect("projects to a prov:Entity at the capture id and round-trips under the same scope", () =>
    Effect.gen(function* () {
      const identity = yield* decodeIdentity(encoded);
      const dataset = yield* toDataset(identity);
      const captureId = yield* mintCaptureId(identity);
      const subjects = HashSet.map(dataset.quads, (quad) => quad.subject.value);
      expect(A.fromIterable(subjects)).toStrictEqual([instanceIri(captureId)]);
      expect(HashSet.size(dataset.quads)).toBe(9);
      const decoded = yield* fromDataset(scopeRef)(dataset);
      assertEquals(decoded, identity);
    })
  );

  it.effect("refuses a tampered digest and a decode under another scope", () =>
    Effect.gen(function* () {
      const identity = yield* decodeIdentity(encoded);
      const dataset = yield* toDataset(identity);
      const tampered = replacing(dataset, "sourceDigest", makeLiteral(`sha256:${Str.repeat(64)("c")}`));
      const malformed = replacing(dataset, "sourceDigest", makeLiteral("not-a-digest"));
      const typed = replacing(dataset, "sourceRef", Literal.typed("source:example", "https://example.test/type"));
      const reasons = yield* Effect.all(
        [refusal(tampered), refusal(dataset, "matter:other"), refusal(malformed), refusal(typed)],
        { concurrency: 1 }
      );
      expect(reasons).toStrictEqual([
        "integrityMismatch",
        "integrityMismatch",
        "integrityMismatch",
        "integrityMismatch",
      ]);
    })
  );

  it.effect("refuses missing, repeated and unknown quads", () =>
    Effect.gen(function* () {
      const identity = yield* decodeIdentity(encoded);
      const dataset = yield* toDataset(identity);
      const captureId = yield* mintCaptureId(identity);
      const subject = makeNamedNode(instanceIri(captureId));
      const extra = makeDataset([...quadsOf(dataset), makeQuad(subject, textTerm("unknown"), makeLiteral("x"))]);
      const repeated = makeDataset([...quadsOf(dataset), makeQuad(subject, textTerm("locator"), makeLiteral("b.txt"))]);
      const noEntity = makeDataset(
        A.filter(quadsOf(dataset), (quad) => quad.object.value !== "http://www.w3.org/ns/prov#Entity")
      );
      const reasons = yield* Effect.all(
        [refusal(withoutPredicate(dataset, "locator")), refusal(repeated), refusal(extra), refusal(noEntity)],
        { concurrency: 1 }
      );
      expect(reasons).toStrictEqual(["missingField", "duplicateField", "unknownQuad", "missingField"]);
    })
  );

  it.effect("refuses a dataset with no capture subject or two", () =>
    Effect.gen(function* () {
      const identity = yield* decodeIdentity(encoded);
      const dataset = yield* toDataset(identity);
      const otherIdentity = yield* decodeIdentity({ ...encoded, sourceRef: "source:other" });
      const other = yield* toDataset(otherIdentity);
      const reasons = yield* Effect.all(
        [
          refusal(
            makeDataset(A.filter(quadsOf(dataset), (quad) => quad.object.value !== textTerm("SourceTextCapture").value))
          ),
          refusal(makeDataset([...quadsOf(dataset), ...quadsOf(other)])),
        ],
        { concurrency: 1 }
      );
      expect(reasons).toStrictEqual(["notACapture", "notACapture"]);
      expect(SourceTextEntityRefused.make({ reason: "notACapture" }).reason).toBe("notACapture");
    })
  );
});
