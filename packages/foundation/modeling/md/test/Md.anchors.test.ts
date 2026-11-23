import { anchorAt } from "@beep/md/Md.anchors";
import { parseResult } from "@beep/md/Md.parse";
import { positionAt } from "@beep/md/Md.syntax";
import { PosixPath } from "@beep/schema/PosixPath";
import { Sha256HexFromBytes } from "@beep/schema/Sha256";
import { it } from "@beep/test-runner";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import {
  VerifiedTextAnchor,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/text/VerifiedTextAnchor";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CORPUS_INPUTS } from "./support/corpusInputs.ts";
import type { Position } from "@beep/markdown/MarkdownNode";
import type { DocumentSafetyPathSegment } from "@beep/md/Md.safe";
import type { MdFromSyntax } from "@beep/md/Md.syntax";

type NodePath = ReadonlyArray<DocumentSafetyPathSegment>;

const childrenOf = (node: unknown): ReadonlyArray<unknown> =>
  P.hasProperty(node, "children") && A.isArray(node.children) ? node.children : [];

const pathsBySourceMapOrdinal = (node: unknown, path: NodePath): ReadonlyArray<NodePath> => [
  path,
  ...A.flatMap(childrenOf(node), (child, index) => pathsBySourceMapOrdinal(child, [...path, "children", index])),
];

const utf8 = new TextEncoder();
const hashText = S.decodeUnknownEffect(Sha256HexFromBytes);
const isProof = S.is(VerifiedTextAnchor);

const verifiedSourceOf = Effect.fnUntraced(function* (text: string) {
  const hex = yield* hashText(utf8.encode(text));
  const digest = SourceTextDigest.make(`sha256:${hex}`);
  const identity = SourceTextIdentity.make({
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    locator: PosixPath.make("notes.md"),
    normalizationVersion: "1",
    scopeRef: "matter:example",
    sourceDigest: digest,
    sourceRef: "source:notes",
    textDigest: digest,
  });
  return yield* verifySourceTextIdentity(
    VerifySourceTextIdentityInput.make({ expectedSource: identity, source: identity, sourceText: text })
  );
});

const bridge = (markdown: string): MdFromSyntax => Result.getOrThrow(parseResult(markdown));

const hasText = (position: Position): boolean => position.start.offset < position.end.offset;

describe("@beep/md/Md.anchors", () => {
  it.layer(Digest.layerWebCrypto, { timeout: "60 seconds" })("over the bridge corpus", (it) => {
    it.effect(
      "anchors every mapped non-empty node at its own slice and gives None for the rest",
      Effect.fnUntraced(function* () {
        let anchored = 0;
        let empty = 0;
        for (const input of CORPUS_INPUTS) {
          const id = `${input.corpus}#${input.example}`;
          const bridged = Result.getOrThrow(parseResult(input.markdown, { dialect: input.dialect }));
          const source = yield* verifiedSourceOf(input.markdown);
          const paths = pathsBySourceMapOrdinal(bridged.document, []);
          for (const [ordinal, path] of paths.entries()) {
            const position = O.getOrThrow(positionAt(bridged.sourceMap, bridged.document, path));
            const anchor = yield* anchorAt(bridged.sourceMap, bridged.document, path, source);
            if (hasText(position)) {
              anchored += 1;
              const verified = O.getOrThrow(anchor);
              const { startChar, endChar, quote } = verified.anchor;
              expect([id, ordinal, isProof(verified), startChar, endChar, quote]).toStrictEqual([
                id,
                ordinal,
                true,
                position.start.offset,
                position.end.offset,
                Str.slice(position.start.offset, position.end.offset)(input.markdown),
              ]);
            } else {
              empty += 1;
              expect([id, ordinal, O.getOrUndefined(anchor)]).toStrictEqual([id, ordinal, undefined]);
            }
          }
        }
        expect(anchored).toBeGreaterThan(0);
        expect(empty).toBeGreaterThan(0);
      })
    );
  });

  it.layer(Digest.layerWebCrypto, { timeout: "5 seconds" })("one document", (it) => {
    const markdown = "# Title\n\nBody";
    const bridged = bridge(markdown);

    it.effect(
      "anchors a paragraph in both argument orders",
      Effect.fnUntraced(function* () {
        const source = yield* verifiedSourceOf(markdown);
        const first = yield* anchorAt(bridged.sourceMap, bridged.document, ["children", 1], source);
        const last = yield* pipe(bridged.sourceMap, anchorAt(bridged.document, ["children", 1], source));
        assertSome(
          O.map(first, (verified) => verified.anchor.quote),
          "Body"
        );
        assertSome(
          O.map(last, (verified) => verified.anchor.quote),
          "Body"
        );
      })
    );

    it.effect(
      "gives None for a path that leaves the tree and for a document the map was not recorded for",
      Effect.fnUntraced(function* () {
        const source = yield* verifiedSourceOf(markdown);
        const outside = yield* anchorAt(bridged.sourceMap, bridged.document, ["children", 7], source);
        assertNone(outside);
        const other = bridge("Other");
        const unrecorded = yield* anchorAt(bridged.sourceMap, other.document, ["children", 0], source);
        assertNone(unrecorded);
      })
    );

    it.effect(
      "refuses a source shorter than the map",
      Effect.fnUntraced(function* () {
        const source = yield* verifiedSourceOf("# Title");
        const error = yield* Effect.flip(anchorAt(bridged.sourceMap, bridged.document, ["children", 1], source));
        expect(error.reason).toBe("invalid-anchor");
      })
    );

    it.effect(
      "refuses a span that splits a surrogate pair of the verified text (parsed yz at 3..5 starts inside the verified emoji)",
      Effect.fnUntraced(function* () {
        const parsed = bridge("x\n\nyz");
        const source = yield* verifiedSourceOf("x\n\u{1F600}z");
        const error = yield* Effect.flip(anchorAt(parsed.sourceMap, parsed.document, ["children", 1], source));
        expect(error.reason).toBe("invalid-anchor");
      })
    );
  });
});
