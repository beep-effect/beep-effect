import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  compileClaimClauseRoles,
  decomposeClaimInput,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "qualified-evidence-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const factsFor = (text: string): ReadonlyArray<ClaimLexicalToken> =>
  A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
    const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
    const lower = Str.toLowerCase(match[0]);
    const pos = A.contains(["a", "an", "the"], lower)
      ? "DET"
      : lower === "comprising"
        ? "VERB"
        : O.isSome(Str.match(/^[\p{L}\p{N}]+$/u)(lower))
          ? "NOUN"
          : "PUNCT";
    return ClaimLexicalToken.make({
      anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
      pos,
      lemma: O.some(lower),
    });
  });
const evidenceFor = (text: string) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "qualified-evidence-control",
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "injected-domain-control",
    assetDigest: "test-only",
    tokens: factsFor(text),
  });

describe("qualified source evidence and atomic projection", () => {
  it.effect("rejects wrong source identity, ordinal, stale text and duplicate evidence", () =>
    Effect.gen(function* () {
      const input = inputOf("A system comprising a sensor; the sensor.");
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const fact = evidenceFor(qualification.claim.claimText);
      const accepted = yield* decomposePreparedClaimRoles(prepared, [fact]);
      assert.strictEqual(accepted.plans.length, 1);
      const cases = [
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, sourceKey: "another-source" })],
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, sourceOrdinal: 2 })],
        [ClaimLexicalEvidence.cases.aligned.make({ ...fact, qualifiedText: `${fact.qualifiedText} ` })],
        [fact, fact],
      ];
      const old = yield* decomposeClaimInput(input);
      for (const evidence of cases) {
        const result = yield* decomposePreparedClaimRoles(prepared, evidence);
        assert.strictEqual(result.plans.length, 0);
        assert.deepStrictEqual(result.decompositions, old);
        const report = yield* inspectPreparedClaimRoles(prepared, evidence);
        assert.isTrue(
          A.every(
            report.records,
            (row) => row.status === "partial" && A.some(row.coverage, (issue) => issue.kind === "policy-uncovered")
          )
        );
        assert.deepStrictEqual(report.input, input);
      }
    })
  );
  it.effect("discards every projection of one source when its shared reservation is exhausted", () =>
    Effect.gen(function* () {
      const body = A.join(
        A.map(A.range(1, 200), (index) => `a component${index}`),
        "; "
      );
      const input = inputOf(`A system comprising ${body}.`);
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const result = yield* decomposePreparedClaimRoles(prepared, [evidenceFor(qualification.claim.claimText)]);
      assert.strictEqual(result.plans.length, 0);
      const legacy = yield* decomposeClaimInput(input);
      assert.deepStrictEqual(result.decompositions, legacy);
    })
  );
  it.effect("declines excessive bracket depth without admitting a partial role plan", () =>
    Effect.gen(function* () {
      const body = `${Str.repeat(129)("(")}a sensor${Str.repeat(129)(")")}`;
      const text = `A system comprising ${body}.`;
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: text,
        preamble: "A system",
        transition: "comprising",
        body,
      });
      assertNone(compileClaimClauseRoles(claim, evidenceFor(text)));
    })
  );
});
