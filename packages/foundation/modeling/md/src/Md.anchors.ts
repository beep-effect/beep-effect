/**
 * Verified text anchors for the Md nodes of a source map.
 *
 * **Details**
 *
 * `Md.syntax` records where each Md node came from in the parsed source.
 * This module turns that record into evidence: {@link anchorAt} reads the
 * node's source span through `positionAt`, slices the verified source text
 * there and proves the slice with `@beep/text`, so the result is a
 * `VerifiedTextAnchor` and never a bare offset pair. The module is a bridge
 * subpath like `Md.syntax`: it is not re-exported from the package root or
 * the `Md` namespace, so importers of `@beep/md` never load the parser.
 *
 * @since 0.0.0
 */

import { TextAnchor } from "@beep/text/TextAnchor";
import {
  VerifiedTextAnchorError,
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/text/VerifiedTextAnchor";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { positionAt } from "./Md.syntax.ts";
import type { Position } from "@beep/markdown/MarkdownNode";
import type { VerifiedSourceText, VerifiedTextAnchor } from "@beep/text/VerifiedTextAnchor";
import type { Document } from "./Md.model.ts";
import type { DocumentSafetyPathSegment } from "./Md.safe.ts";
import type { MdSourceMap } from "./Md.syntax.ts";

const isNatural = S.is(S.Natural);

const nonEmptyNaturalUtf16RangeOf = (position: Position): O.Option<readonly [number, number]> => {
  const start = position.start.offset;
  const end = position.end.offset;
  return isNatural(start) && isNatural(end) && start < end ? O.some([start, end]) : O.none();
};

const anchorAtImpl = Effect.fn("Md.anchorAt")(function* (
  map: MdSourceMap,
  document: Document,
  path: ReadonlyArray<DocumentSafetyPathSegment>,
  source: VerifiedSourceText
): Effect.fn.Return<O.Option<VerifiedTextAnchor>, VerifiedTextAnchorError> {
  const range = O.flatMap(positionAt(map, document, path), nonEmptyNaturalUtf16RangeOf);
  if (O.isNone(range)) {
    return O.none();
  }
  const [startChar, endChar] = range.value;
  const sourceText = source.sourceText;
  const mapRecordedForLongerText = endChar > Str.length(sourceText);
  if (mapRecordedForLongerText) {
    return yield* VerifiedTextAnchorError.fromReason("invalid-anchor");
  }
  const anchor = TextAnchor.make({ startChar, endChar, quote: Str.slice(startChar, endChar)(sourceText) });
  const verified = yield* verifyTextAnchorAgainstVerifiedSource(
    VerifyTextAnchorAgainstVerifiedSourceInput.make({ anchor, verifiedSource: source })
  );
  return O.some(verified);
});

/**
 * The verified text anchor of the Md node at a document path.
 *
 * **Details**
 *
 * The node's span comes from `positionAt`, so every condition under which
 * that returns `None` (a path that leaves the tree, a changed ancestor, a
 * node that is not the recorded subtree) gives `None` here too. A span with
 * no text, zero-width or synthetic, is `None` as well and never becomes an
 * empty anchor. Otherwise the UTF-16 offsets of the span are sliced from the
 * verified source and the anchor is proved with
 * `verifyTextAnchorAgainstVerifiedSource`, so its quote is exactly that
 * slice.
 *
 * **Gotchas**
 *
 * The source must be the text the map was recorded for. A span that ends
 * past the text fails with `invalid-anchor`, and so does one whose offsets
 * split a surrogate pair. A different text that is long enough still yields
 * an anchor over whatever sits at those offsets: the proof binds the slice to
 * the verified source, not to the Markdown that was parsed.
 *
 * **Example** (Anchor a paragraph)
 *
 * ```ts
 * import { anchorAt } from "@beep/md/Md.anchors"
 * import { parseResult } from "@beep/md/Md.parse"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { VerifySourceTextIdentityInput, verifySourceTextIdentity } from "@beep/text/VerifiedTextAnchor"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as Result from "effect/Result"
 *
 * const markdown = "# Title\n\nBody"
 * const digest = SourceTextDigest.make(
 *   "sha256:b7b510d34e84878ec3d4d2bdc287f223faef14f09c59bd3b51597c88a3d260c7"
 * )
 * const identity = SourceTextIdentity.make({
 *   extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
 *   locator: PosixPath.make("notes.md"),
 *   normalizationVersion: "1",
 *   scopeRef: "matter:example",
 *   sourceDigest: digest,
 *   sourceRef: "source:notes",
 *   textDigest: digest,
 * })
 * const bridged = Result.getOrThrow(parseResult(markdown))
 *
 * const program = Effect.gen(function* () {
 *   const source = yield* verifySourceTextIdentity(
 *     VerifySourceTextIdentityInput.make({ expectedSource: identity, source: identity, sourceText: markdown })
 *   )
 *   const anchor = yield* anchorAt(bridged.sourceMap, bridged.document, ["children", 1], source)
 *   return O.map(anchor, (verified) => verified.anchor.quote)
 * }).pipe(Effect.provide(Digest.layerWebCrypto))
 *
 * Effect.runPromise(program).then(console.log) // Some("Body")
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const anchorAt: {
  (
    document: Document,
    path: ReadonlyArray<DocumentSafetyPathSegment>,
    source: VerifiedSourceText
  ): (map: MdSourceMap) => Effect.Effect<O.Option<VerifiedTextAnchor>, VerifiedTextAnchorError>;
  (
    map: MdSourceMap,
    document: Document,
    path: ReadonlyArray<DocumentSafetyPathSegment>,
    source: VerifiedSourceText
  ): Effect.Effect<O.Option<VerifiedTextAnchor>, VerifiedTextAnchorError>;
} = dual(4, anchorAtImpl);
