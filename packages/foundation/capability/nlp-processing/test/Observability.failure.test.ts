import {
  CauseClassificationAttribute,
  NlpFailures,
  PackageAttribute,
} from "@beep/nlp-processing/NlpProcessing.instruments";
import { NlpToolkit } from "@beep/nlp-processing/Tools/NlpToolkit";
import { exportTools } from "@beep/nlp-processing/Tools/ToolExport";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Metric from "effect/Metric";
import * as O from "effect/Option";

const unused = () => Effect.die("handler is never reached");

const UnusedHandlers = NlpToolkit.toLayer({
  Analyze: unused,
  BagOfWords: unused,
  BowCosineSimilarity: unused,
  ChunkBySentences: unused,
  CorpusStats: unused,
  CreateCorpus: unused,
  DeleteCorpus: unused,
  DocumentStats: unused,
  ExtractEntities: unused,
  ExtractKeywords: unused,
  LearnCorpus: unused,
  LearnCustomEntities: unused,
  NGrams: unused,
  Paragraphize: unused,
  PhoneticMatch: unused,
  QueryCorpus: unused,
  RankByRelevance: unused,
  RemoveStopWords: unused,
  Sentences: unused,
  Stem: unused,
  TextSimilarity: unused,
  Tokenize: unused,
  TransformText: unused,
  TverskySimilarity: unused,
  WordCount: unused,
});

const failuresCounted = Effect.map(
  Metric.value(
    Metric.withAttributes(Metric.counter(NlpFailures.name), {
      [PackageAttribute]: "@beep/nlp-processing",
      [CauseClassificationAttribute]: "failure",
    })
  ),
  (state) => state.count
);

it.layer(UnusedHandlers, { timeout: "30 seconds" })("@beep/nlp-processing exported tool failures", (it) => {
  it.effect(
    "counts an exported tool call that fails to decode its arguments",
    Effect.fnUntraced(function* () {
      const tools = yield* exportTools;
      const tokenize = O.getOrThrow(A.findFirst(tools, (tool) => tool.name === "Tokenize"));
      const before = yield* failuresCounted;
      const refused = yield* tokenize.handle([42, 42, 42]).pipe(Effect.exit);
      refused.pipe(Exit.isFailure, assertTrue);
      expect((yield* failuresCounted) - before).toBe(1);
    })
  );
});
