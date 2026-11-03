import {
  ModelValueArtifact,
  TokenizerExtractorsArtifact,
} from "@beep/law-practice-use-cases/internal/citationOracleJson";
import { CitationOracleArtifact } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const ObjectText = S.fromJsonString(S.JsonObject);
const ArrayText = S.JsonObject.pipe(S.Array, S.fromJsonString);

it.effect.prop("preserves exact coherent bytes for both artifact alternatives", [S.JsonObject], ([value]) =>
  Effect.gen(function* () {
    const modelRaw = ` \n${yield* S.encodeEffect(ObjectText)(value)}\n `;
    const tokenizerRaw = ` \n${yield* S.encodeEffect(ArrayText)([value])}\n `;
    const modelWire: typeof ModelValueArtifact.Encoded = { kind: "model-value", payload: modelRaw };
    const tokenizerWire: typeof TokenizerExtractorsArtifact.Encoded = {
      kind: "tokenizer-extractors",
      payload: tokenizerRaw,
    };
    const model = yield* S.decodeEffect(ModelValueArtifact)(modelWire);
    const tokenizer = yield* S.decodeEffect(TokenizerExtractorsArtifact)(tokenizerWire);
    expect(model.payload.raw).toBe(modelRaw);
    expect(tokenizer.payload.raw).toBe(tokenizerRaw);
    expect(yield* S.encodeEffect(CitationOracleArtifact)(model)).toEqual(modelWire);
    expect(yield* S.encodeEffect(CitationOracleArtifact)(tokenizer)).toEqual(tokenizerWire);
  })
);

it.effect("rejects a forged derived value while retaining the raw source bytes", () =>
  Effect.gen(function* () {
    const model = ModelValueArtifact.make({ payload: { raw: '{"value":1}', value: { value: 2 } } });
    const tokenizer = TokenizerExtractorsArtifact.make({ payload: { raw: '[{"value":1}]', value: [{ value: 2 }] } });
    expect((yield* Effect.flip(S.encodeEffect(CitationOracleArtifact)(model)))._tag).toBe("SchemaError");
    expect((yield* Effect.flip(S.encodeEffect(CitationOracleArtifact)(tokenizer)))._tag).toBe("SchemaError");
  })
);
