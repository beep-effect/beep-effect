import { TextAnchor } from "@beep/provenance";
import { NonNegativeInt } from "@beep/schema";
import { Effect, Layer, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { DocumentId } from "@/schema/Ids";
import { Chunk, makeChunkId } from "@/schema/Text";
import { Canonicalizer } from "@/services/Canonicalizer";
import { Chunker } from "@/services/Chunker";
import type { ChunkKind } from "@/schema/Text";

class Candidate {
  readonly kind: ChunkKind;
  readonly startChar: number;
  readonly endChar: number;

  constructor(kind: ChunkKind, startChar: number, endChar: number) {
    this.kind = kind;
    this.startChar = startChar;
    this.endChar = endChar;
  }
}

const CR = 13;
const LF = 10;
const SPACE = 32;
const TAB = 9;
const HASH = 35;
const DOT = 46;
const EXCLAMATION = 33;
const QUESTION = 63;
const SENTENCE_TERMINATORS = [DOT, EXCLAMATION, QUESTION];

const codeUnitIsWhitespace = (code: number): boolean => code === SPACE || code === TAB || code === CR || code === LF;

const isWhitespaceAt = (text: string, index: number): boolean =>
  Str.charCodeAt(text, index).pipe(O.exists(codeUnitIsWhitespace));

const firstContentOffset = (text: string, start: number, end: number): number => {
  let offset = start;
  while (offset < end && isWhitespaceAt(text, offset)) {
    offset += 1;
  }
  return offset;
};

const lastContentOffset = (text: string, start: number, end: number): number => {
  let offset = end;
  while (offset > start && isWhitespaceAt(text, offset - 1)) {
    offset -= 1;
  }
  return offset;
};

const isMarkdownHeading = (text: string, start: number, end: number): boolean => {
  let offset = start;
  let hashes = 0;
  while (offset < end && hashes < 6 && Str.charCodeAt(text, offset).pipe(O.contains(HASH))) {
    hashes += 1;
    offset += 1;
  }
  return hashes > 0 && offset < end && isWhitespaceAt(text, offset);
};

const isSentenceBoundary = (text: string, offset: number, end: number): boolean => {
  const next = offset + 1;
  return (
    Str.charCodeAt(text, offset).pipe(O.exists((code) => A.contains(SENTENCE_TERMINATORS, code))) &&
    (next >= end || isWhitespaceAt(text, next))
  );
};

const appendSentence = (sentences: Array<Candidate>, start: number, end: number): void => {
  if (start < end) {
    sentences.push(new Candidate("sentence", start, end));
  }
};

const sentenceCandidates = (text: string, start: number, end: number): ReadonlyArray<Candidate> => {
  const sentences: Array<Candidate> = [];
  let sentenceStart = firstContentOffset(text, start, end);
  let offset = sentenceStart;

  while (offset < end) {
    if (isSentenceBoundary(text, offset, end)) {
      appendSentence(sentences, sentenceStart, offset + 1);
      sentenceStart = firstContentOffset(text, offset + 1, end);
      offset = sentenceStart;
    } else {
      offset += 1;
    }
  }

  appendSentence(sentences, sentenceStart, lastContentOffset(text, sentenceStart, end));

  return A.match(A.drop(sentences, 1), {
    onEmpty: () => [],
    onNonEmpty: () => sentences,
  });
};

const paragraphCandidates = (text: string, start: number, end: number): ReadonlyArray<Candidate> => {
  const contentStart = firstContentOffset(text, start, end);
  const contentEnd = lastContentOffset(text, contentStart, end);
  if (contentStart >= contentEnd) {
    return [];
  }
  if (isMarkdownHeading(text, contentStart, contentEnd)) {
    return [new Candidate("heading", contentStart, contentEnd)];
  }
  return A.match(sentenceCandidates(text, contentStart, contentEnd), {
    onEmpty: () => [new Candidate("paragraph", contentStart, contentEnd)],
    onNonEmpty: (sentences) => sentences,
  });
};

const appendParagraph = (candidates: Array<Candidate>, text: string, start: number, end: number): void => {
  candidates.push(...paragraphCandidates(text, start, end));
};

const newlineWidthAt = (text: string, offset: number): number =>
  Str.charCodeAt(text, offset).pipe(
    O.map((code) =>
      Match.value(code).pipe(
        Match.when(CR, () => (Str.charCodeAt(text, offset + 1).pipe(O.contains(LF)) ? 2 : 1)),
        Match.when(LF, () => 1),
        Match.orElse(() => 0)
      )
    ),
    O.getOrElse(() => 0)
  );

const closeScannedLine = (
  candidates: Array<Candidate>,
  text: string,
  paragraphStart: number,
  lineStart: number,
  lineEnd: number,
  newlineEnd: number
): number => {
  const contentStart = firstContentOffset(text, lineStart, lineEnd);
  const contentEnd = lastContentOffset(text, contentStart, lineEnd);
  return Match.value({
    blank: contentStart >= lineEnd,
    heading: isMarkdownHeading(text, contentStart, contentEnd),
  }).pipe(
    Match.when({ blank: true }, () => {
      appendParagraph(candidates, text, paragraphStart, lineStart);
      return newlineEnd;
    }),
    Match.when({ heading: true }, () => {
      appendParagraph(candidates, text, paragraphStart, lineStart);
      candidates.push(new Candidate("heading", contentStart, contentEnd));
      return newlineEnd;
    }),
    Match.orElse(() => paragraphStart)
  );
};

const closeFinalLine = (
  candidates: Array<Candidate>,
  text: string,
  paragraphStart: number,
  lineStart: number,
  textEnd: number
): number => {
  const contentStart = firstContentOffset(text, lineStart, textEnd);
  const contentEnd = lastContentOffset(text, contentStart, textEnd);
  return Match.value(isMarkdownHeading(text, contentStart, contentEnd)).pipe(
    Match.when(true, () => {
      appendParagraph(candidates, text, paragraphStart, lineStart);
      candidates.push(new Candidate("heading", contentStart, contentEnd));
      return textEnd;
    }),
    Match.orElse(() => paragraphStart)
  );
};

/**
 * Finds chunk ranges without copying or normalizing canonical separators.
 *
 * @category parsing
 * @since 0.0.0
 */
const locateChunkCandidates = (text: string): ReadonlyArray<Candidate> => {
  const candidates: Array<Candidate> = [];
  const textEnd = Str.length(text);
  let paragraphStart = 0;
  let lineStart = 0;
  let offset = 0;

  while (offset < textEnd) {
    Match.value(newlineWidthAt(text, offset)).pipe(
      Match.when(0, () => {
        offset += 1;
      }),
      Match.orElse((newlineWidth) => {
        const newlineEnd = offset + newlineWidth;
        paragraphStart = closeScannedLine(candidates, text, paragraphStart, lineStart, offset, newlineEnd);
        lineStart = newlineEnd;
        offset = newlineEnd;
      })
    );
  }

  paragraphStart = closeFinalLine(candidates, text, paragraphStart, lineStart, textEnd);
  appendParagraph(candidates, text, paragraphStart, textEnd);
  return candidates;
};

const makeChunker = Effect.gen(function* () {
  const canonicalizer = yield* Canonicalizer;

  return Chunker.of({
    chunk: Effect.fn("Chunker.chunk")(function* (canonical) {
      const document = DocumentId.make(canonical.identity.sourceRef);
      const candidates = locateChunkCandidates(canonical.text);
      const chunks = yield* Effect.forEach(
        candidates,
        Effect.fnUntraced(function* (candidate, ordinal) {
          const anchor = TextAnchor.make({
            endChar: NonNegativeInt.make(candidate.endChar),
            quote: Str.slice(candidate.startChar, candidate.endChar)(canonical.text),
            startChar: NonNegativeInt.make(candidate.startChar),
          });
          const receipt = yield* canonicalizer.verify(canonical, anchor);
          const id = yield* Effect.fromResult(makeChunkId({ document, anchor, receipt })).pipe(Effect.orDie);
          return Chunk.make({
            anchor,
            document,
            id,
            kind: candidate.kind,
            ordinal: NonNegativeInt.make(ordinal),
            receipt,
          });
        }),
        { concurrency: 1 }
      );

      return yield* A.match(chunks, {
        onEmpty: () => Effect.die("Canonical parsed text produced no chunks."),
        onNonEmpty: Effect.succeed,
      });
    }),
  });
});

/**
 * Exact-offset C0 chunker over the shared canonicalizer.
 *
 * **Example** (Inspect the layer)
 *
 * ```ts
 * import { ChunkerLive } from "@/layers/ChunkerLive"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(ChunkerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ChunkerLive = Layer.effect(Chunker, makeChunker);
