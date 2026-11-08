import {
  ModelValueArtifact,
  TokenizerExtractorsArtifact,
} from "@beep/law-practice-use-cases/internal/citationOracleJson";
import { CitationOracleArtifact, CitationOracleLedgerProofPlan } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ObjectText = S.fromJsonString(S.JsonObject);
const ArrayText = S.JsonObject.pipe(S.Array, S.fromJsonString);
const decodeProofPlan = S.decodeUnknownEffect(CitationOracleLedgerProofPlan);

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
    const encodedModel = yield* S.encodeEffect(CitationOracleArtifact)(model);
    const encodedTokenizer = yield* S.encodeEffect(CitationOracleArtifact)(tokenizer);
    expect(encodedModel).toEqual(modelWire);
    expect(encodedTokenizer).toEqual(tokenizerWire);
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

it.effect("accepts unique ledger bindings and requires complete-case evidence for completion", () =>
  Effect.gen(function* () {
    const sha256 = Str.repeat(64)("a");
    const proof = {
      command: "fixture complete-case proof",
      result: "passed",
      scope: "complete-case",
      operation: "extract",
      evidencePath: "fixture/evidence.json",
      evidenceSha256: sha256,
      targetTests: [{ path: "fixture/target.test.ts", sha256, name: "complete case" }],
      references: [{ path: "fixture/source.json", sha256 }],
    };
    const complete = {
      workflowState: "complete",
      cases: [{ id: "case/first", observationSha256: sha256 }],
      rationale: "The complete case has direct execution evidence.",
      proof,
    };
    const ready = {
      ...complete,
      workflowState: "ready",
      cases: [{ id: "case/second", observationSha256: sha256 }],
      proof: { ...proof, scope: "stage" },
    };
    const accepted = yield* decodeProofPlan({
      schemaVersion: "citation-ledger-proof-plan/v1",
      bindings: [complete, ready],
    });
    expect(accepted.bindings).toHaveLength(2);
    const empty = yield* decodeProofPlan({ schemaVersion: "citation-ledger-proof-plan/v1", bindings: [] });
    expect(empty.bindings).toEqual([]);

    // Duplicate identities must fail even when each individual binding is valid.
    const duplicate = yield* decodeProofPlan({
      schemaVersion: "citation-ledger-proof-plan/v1",
      bindings: [complete, { ...ready, cases: complete.cases }],
    }).pipe(Effect.flip);
    expect(duplicate._tag).toBe("SchemaError");

    // A successful stage can prepare a case, but cannot assert complete-case parity.
    const stageOnly = yield* decodeProofPlan({
      schemaVersion: "citation-ledger-proof-plan/v1",
      bindings: [{ ...complete, proof: { ...proof, scope: "stage" } }],
    }).pipe(Effect.flip);
    expect(stageOnly._tag).toBe("SchemaError");
  })
);
