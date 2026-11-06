import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalProviderIdentity,
  inspectClaimInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import {
  ClaimInspection,
  claimInspectionWithLexicalEvidence,
  UsptoClaimInputs,
  UsptoClaimsError,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { CharPosition, Token, TokenIndex } from "@beep/nlp/Core/Token";
import { Tokenization, TokenizationError } from "@beep/nlp-processing/Core/Tokenization";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";

const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "lexical-boundary-test",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const tokensOf = (text: string): ReadonlyArray<Token> =>
  A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)), (match, index) => {
    const start = O.getOrThrow(O.fromUndefinedOr(match.index));
    const spelling = match[0];
    const lower = Str.toLowerCase(spelling);
    const pos =
      lower === "a" || lower === "the"
        ? "DET"
        : lower === "comprising"
          ? "VERB"
          : O.isSome(Str.match(/^[\p{L}\p{N}]+$/u)(spelling))
            ? "NOUN"
            : "PUNCT";
    return Token.make({
      text: spelling,
      index: TokenIndex.make(index),
      start: CharPosition.make(start),
      end: CharPosition.make(start + spelling.length),
      tags: [],
      pos: O.some(pos),
      lemma: O.some(lower),
    });
  });
const inspectionLayer = (tokenize: (text: string) => Effect.Effect<ReadonlyArray<Token>, TokenizationError>) =>
  claimInspectionWithLexicalEvidence(
    ClaimLexicalProviderIdentity.make({ provider: "injected-boundary-test", assetDigest: "test-facts-only" })
  ).pipe(
    Layer.provide(
      Layer.succeed(
        Tokenization,
        Tokenization.of({
          tokenize,
          sentences: Effect.fn("LexicalBoundary.unusedSentences")(() =>
            Effect.fail(TokenizationError.make({ operation: "sentences", cause: "unused" }))
          ),
          document: Effect.fn("LexicalBoundary.unusedDocument")(() =>
            Effect.fail(TokenizationError.make({ operation: "document", cause: "unused" }))
          ),
          tokenCount: Effect.fn("LexicalBoundary.unusedCount")(() =>
            Effect.fail(TokenizationError.make({ operation: "tokenCount", cause: "unused" }))
          ),
        })
      )
    ),
    Layer.provide(
      Layer.succeed(UsptoClaimInputs, {
        inputs: Effect.fn("LexicalBoundary.noAcquisition")(() =>
          Effect.fail(UsptoClaimsError.make({ reason: "unavailable", message: "No acquisition." }))
        ),
      })
    )
  );

const inspectWith = Effect.fn("LexicalBoundary.inspectWith")(function* (
  input: ClaimInputCollection,
  layer: ReturnType<typeof inspectionLayer>
) {
  const context = yield* Layer.build(layer);
  return yield* ClaimInspection.use((service) => service.inspect(input)).pipe(Effect.provideContext(context));
});

describe("source-aligned lexical capability boundary", () => {
  it.effect(
    "annotates normalized qualified text and retains the original ledger",
    Effect.fnUntraced(function* () {
      const input = inputOf("A   system comprising a sensor; the sensor.");
      const seen: Array<string> = [];
      const tokenize = Effect.fn("LexicalBoundary.tokenize")((text: string) => {
        seen.push(text);
        return Effect.succeed(tokensOf(text));
      });
      const report = yield* inspectWith(input, inspectionLayer(tokenize));
      assert.deepStrictEqual(report.input, input);
      const row = O.getOrThrow(A.head(report.records));
      assert.notStrictEqual(row.status, "unchecked");
      if (row.status === "unchecked") return;
      assert.deepStrictEqual(seen, [row.decomposition.qualification.claim.claimText]);
      assert.strictEqual(row.findings.length, 0);
    })
  );
  it.effect(
    "rejects gapped, duplicate, missing and unknown token facts atomically",
    Effect.fnUntraced(function* () {
      const input = inputOf("A system comprising a sensor; the missing sensor.");
      const legacy = yield* inspectClaimInput(input);
      for (const mutate of [
        (_: ReadonlyArray<Token>) => [],
        (tokens: ReadonlyArray<Token>) => A.drop(tokens, 1),
        (tokens: ReadonlyArray<Token>) => A.prepend(tokens, O.getOrThrow(A.head(tokens))),
        (tokens: ReadonlyArray<Token>) => A.map(tokens, (token) => Token.make({ ...token, pos: O.none() })),
        (tokens: ReadonlyArray<Token>) => A.map(tokens, (token) => Token.make({ ...token, pos: O.some("UNKNOWN") })),
      ]) {
        const tokenize = Effect.fn("LexicalBoundary.badFacts")((text: string) =>
          Effect.succeed(mutate(tokensOf(text)))
        );
        const report = yield* inspectWith(input, inspectionLayer(tokenize));
        const row = O.getOrThrow(A.head(report.records));
        const old = O.getOrThrow(A.head(legacy.records));
        assert.strictEqual(row.status, "partial");
        if (row.status === "unchecked" || old.status === "unchecked") return;
        assert.deepStrictEqual(row.decomposition.tree, old.decomposition.tree);
        assert.deepStrictEqual(row.findings, old.findings);
        assert.isTrue(row.status === "partial" && A.some(row.coverage, (issue) => issue.kind === "policy-uncovered"));
      }
    })
  );
  it.effect(
    "keeps typed tokenizer failure as partial without erasing substantive findings",
    Effect.fnUntraced(function* () {
      const input = inputOf("A system comprising a sensor; the missing panel.");
      const tokenize = Effect.fn("LexicalBoundary.unavailable")((_text: string) =>
        Effect.fail(TokenizationError.make({ operation: "tokenize", cause: "Unavailable test provider." }))
      );
      const report = yield* inspectWith(input, inspectionLayer(tokenize));
      const row = O.getOrThrow(A.head(report.records));
      assert.strictEqual(row.status, "partial");
      assert.isTrue(
        row.status === "partial" && A.some(row.findings, (finding) => finding.kind === "missing-antecedent")
      );
    })
  );
});
