import { MarkRange } from "@beep/nlp-processing/Core/Pattern";
import { BM25Norm } from "@beep/nlp-processing/Core/Vectorization";
import * as Schemas from "@beep/nlp-processing/Tools/_schemas";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { UnitInterval } from "@beep/schema/UnitInterval";
import { Position } from "@beep/text/OffsetUnit";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Tool from "effect/ai/Tool";
import * as Context from "effect/Context";
import { pipe } from "effect/Function";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const stackSchemas: ReadonlyArray<S.Top> = [
  Schemas.AiPhoneticAlgorithm,
  Schemas.AiToken,
  Schemas.AiAnalysis,
  Schemas.AiSentence,
  Schemas.AiKeyword,
  Schemas.AiDocumentStats,
  Schemas.AiSentenceChunk,
  Schemas.AiRankedText,
  Schemas.AiEntity,
  Schemas.AiNGram,
  Schemas.AiPhoneticMatch,
  Schemas.AiCorpusConfig,
  Schemas.AiCorpusSummary,
  Schemas.AiCorpusRankedDocument,
  Schemas.AiCorpusIdf,
  Schemas.AiCorpusMatrixShape,
  Schemas.AiCorpusStats,
  Position,
  UnitInterval,
  BM25Norm,
  MarkRange,
];

const stackDefinitions = pipe(
  stackSchemas,
  A.map((schema) => schema.pipe(S.toEncoded, S.toJsonSchemaDocument).definitions),
  A.reduce({}, (all: R.ReadonlyRecord<string, unknown>, definitions) => ({ ...all, ...definitions }))
);

const isToolLocal = (toolName: string) => (identifier: string) =>
  Str.startsWith(`@beep/nlp-processing/Tools/${toolName}/`)(identifier) ||
  Str.startsWith("@beep/nlp-processing/internal/")(identifier);

const writeTools = ["CreateCorpus", "LearnCorpus", "LearnCustomEntities", "DeleteCorpus"];

describe("NLP tools publish the stack types they expose", () => {
  it.each(R.keys(NlpToolkit.tools))("%s publishes stack types by their own JSON Schema", (name) => {
    const tool: Tool.Any = NlpToolkit.tools[name];
    for (const schema of [tool.parametersSchema, tool.successSchema]) {
      const definitions = S.toJsonSchemaDocument(schema).definitions;
      const shared = A.filter(R.keys(definitions), (identifier) => !isToolLocal(name)(identifier));
      for (const identifier of shared) {
        expect(R.has(stackDefinitions, identifier)).toBe(true);
        expect(definitions[identifier]).toEqual(stackDefinitions[identifier]);
      }
    }
  });

  it("the tools that expose spans publish them as Position", () => {
    const withPosition = pipe(
      R.toEntries(NlpToolkit.tools),
      A.filter(([, tool]) =>
        R.has(S.toJsonSchemaDocument(tool.successSchema).definitions, "@beep/text/OffsetUnit/Position")
      ),
      A.map(([name]) => name)
    );
    expect(A.sort(withPosition, Str.Order)).toEqual(["Analyze", "ExtractEntities", "Sentences", "Tokenize"]);
  });

  it.each(R.keys(NlpToolkit.tools))("%s carries the four hints", (name) => {
    const { annotations } = NlpToolkit.tools[name];
    const write = A.contains(writeTools, name);
    expect([
      Context.get(annotations, Tool.Readonly),
      Context.get(annotations, Tool.Destructive),
      Context.get(annotations, Tool.Idempotent),
      Context.get(annotations, Tool.OpenWorld),
    ]).toEqual([!write, name === "DeleteCorpus", !write, false]);
  });
});
