import { Document } from "@beep/md/Md.model";
import { parseResult } from "@beep/md/Md.parse";
import { render } from "@beep/md/Md.render";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import { BridgeDocumentArbitrary, normalizeBridgeDocument } from "./support/bridgeArbitrary.ts";

const ROUND_TRIP_OPTIONS = { youtube: true } as const;

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : [];

const tagsOf = (node: unknown): ReadonlyArray<string> => [
  ...(P.hasProperty(node, "_tag") && P.isString(node._tag) ? [node._tag] : []),
  ...A.flatMap(childrenOf(node), tagsOf),
];

const valuesOf = (node: unknown): ReadonlyArray<string> => [
  ...(P.hasProperty(node, "value") && P.isString(node.value) ? [node.value] : []),
  ...A.flatMap(childrenOf(node), valuesOf),
];

const encode = (document: Document): Document.Encoded => Result.getOrThrow(Document.encodeResult(document));

const roundTrip = (document: Document): Result.Result<Document, string> =>
  Result.flatMap(
    Result.mapError(render(document), (error) => `render failed: ${error._tag}`),
    (markdown) =>
      Result.mapBoth(parseResult(markdown, ROUND_TRIP_OPTIONS), {
        onFailure: (error) => `parse failed: ${error._tag}`,
        onSuccess: (bridged) => bridged.document,
      })
  );

describe("@beep/md/Md.syntax round trip", () => {
  it.prop(
    "re-parses rendered documents to their normalized form",
    [BridgeDocumentArbitrary],
    ([document]) => {
      const reparsed = Result.getOrThrow(roundTrip(document));
      expect(encode(reparsed)).toStrictEqual(encode(normalizeBridgeDocument(document)));
      return true;
    },
    { arbitrary: { ...fcRuns(200), seed: 2_022 } }
  );

  it.effect("keeps the generator inside the documented constraints", () =>
    Effect.gen(function* () {
      const documents = yield* Arbitrary.sampleEffect(BridgeDocumentArbitrary, { count: 200, seed: 2_022 });
      const tags = HashSet.fromIterable(A.flatMap(documents, tagsOf));
      for (const excluded of ["rawMarkdown", "embed"]) {
        expect(HashSet.has(tags, excluded)).toBe(false);
      }
      for (const covered of [
        "admonition",
        "youtube",
        "taskList",
        "table",
        "footnoteDefinition",
        "br",
        "rawHtml",
        "mathBlock",
        "inlineMath",
      ]) {
        expect(HashSet.has(tags, covered)).toBe(true);
      }
      const values = A.flatMap(documents, valuesOf);
      expect(A.filter(values, (value) => /[\r\0]/.test(value))).toStrictEqual([]);
      expect(
        A.some(values, (value) => /\$[a-z]/.test(value)),
        "the writer-escape word `$` that would open math reaches the property"
      ).toBe(true);
      expect(
        A.some(values, (value) => /&#?[a-z0-9]+;/.test(value)),
        "the writer-escape word `&` that would open a character reference reaches the property"
      ).toBe(true);
    })
  );
});
