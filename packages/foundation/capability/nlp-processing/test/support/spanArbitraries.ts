import { Document } from "@beep/nlp-processing/Core/Document";
import { Sentence } from "@beep/nlp-processing/Core/Sentence";
import { Token } from "@beep/nlp-processing/Core/Token";
import { AiAnalysis, AiEntity, AiSentence, AiToken } from "@beep/nlp-processing/Tools/_schemas";
import { Position } from "@beep/text/OffsetUnit";
import * as Arbitrary from "effect/Arbitrary";
import * as Chunk from "effect/Chunk";
import * as S from "effect/Schema";
import * as Struct from "effect/Struct";
import type { ExtractEntities } from "@beep/nlp-processing/Tools/ExtractEntities";
import type { Sentences } from "@beep/nlp-processing/Tools/Sentences";
import type { Tokenize } from "@beep/nlp-processing/Tools/Tokenize";

const between = (minimum: number, maximum: number) => Arbitrary.schema(S.Int.check(S.isBetween({ minimum, maximum })));

const listOf = <A>(item: Arbitrary.Arbitrary<A>) => Arbitrary.array(item, { maxLength: 4 });

const utf16SpanArbitrary = Arbitrary.map(Arbitrary.all([between(0, 10_000), between(1, 500)]), ([start, width]) =>
  Position.make({ unit: "utf16-code-unit", start, end: start + width })
);

export const tokenArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(Token.fields, ["span"]))), utf16SpanArbitrary]),
  ([fields, span]) => Token.make({ ...fields, span })
);

export const sentenceArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(Sentence.fields, ["tokens"]))), listOf(tokenArbitrary)]),
  ([fields, tokens]) => Sentence.make({ ...fields, tokens: Chunk.fromIterable(tokens) })
);

export const documentArbitrary = Arbitrary.map(
  Arbitrary.all([
    Arbitrary.schema(S.Struct(Struct.omit(Document.fields, ["tokens", "sentences"]))),
    listOf(tokenArbitrary),
    listOf(sentenceArbitrary),
  ]),
  ([fields, tokens, sentences]) =>
    Document.make({ ...fields, tokens: Chunk.fromIterable(tokens), sentences: Chunk.fromIterable(sentences) })
);

export const aiTokenArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiToken.fields, ["span"]))), utf16SpanArbitrary]),
  ([fields, span]) => AiToken.make({ ...fields, span })
);

export const aiSentenceArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiSentence.fields, ["span"]))), utf16SpanArbitrary]),
  ([fields, span]) => AiSentence.make({ ...fields, span })
);

export const aiEntityArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiEntity.fields, ["span"]))), utf16SpanArbitrary]),
  ([fields, span]) => AiEntity.make({ ...fields, span })
);

export const aiAnalysisArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiAnalysis.fields, ["tokens"]))), listOf(aiTokenArbitrary)]),
  ([fields, tokens]) => AiAnalysis.make({ ...fields, tokens })
);

const count = between(0, 1_000);

const labels = S.String.pipe(S.Array, Arbitrary.schema);

const encodedSpanArbitrary = Arbitrary.map(utf16SpanArbitrary, ({ start, end }) => ({
  _tag: "Position" as const,
  unit: "utf16-code-unit" as const,
  start,
  end,
}));

const encodedAiTokenArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiToken.fields, ["span"]))), encodedSpanArbitrary]),
  ([fields, span]) => ({ ...fields, span })
);

const encodedAiSentenceArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiSentence.fields, ["span"]))), encodedSpanArbitrary]),
  ([fields, span]) => ({ ...fields, span })
);

const encodedAiEntityArbitrary = Arbitrary.map(
  Arbitrary.all([Arbitrary.schema(S.Struct(Struct.omit(AiEntity.fields, ["span"]))), encodedSpanArbitrary]),
  ([fields, span]) => ({ ...fields, span })
);

export const tokenizeSuccessArbitrary: Arbitrary.Arbitrary<typeof Tokenize.successSchema.Type> = Arbitrary.map(
  Arbitrary.all([count, listOf(encodedAiTokenArbitrary)]),
  ([tokenCount, tokens]) => ({ tokenCount, tokens })
);

export const sentencesSuccessArbitrary: Arbitrary.Arbitrary<typeof Sentences.successSchema.Type> = Arbitrary.map(
  Arbitrary.all([count, listOf(encodedAiSentenceArbitrary)]),
  ([sentenceCount, sentences]) => ({ sentenceCount, sentences })
);

export const extractEntitiesSuccessArbitrary: Arbitrary.Arbitrary<typeof ExtractEntities.successSchema.Type> =
  Arbitrary.map(
    Arbitrary.all({
      allEntities: listOf(encodedAiEntityArbitrary),
      allEntityCount: count,
      customEntities: listOf(encodedAiEntityArbitrary),
      customEntityCount: count,
      customEntityTypes: labels,
      entities: listOf(encodedAiEntityArbitrary),
      entityCount: count,
      entityTypes: labels,
    }),
    (success) => success
  );
