import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  compileClaimClauseRoles,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { ClaimNominalPolicyRole } from "@beep/law-practice-domain/values/ClaimElement";

// Explicit synthetic lexical witnesses only; never a production vocabulary.
const facts = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["comprising", ["VERB", "comprise"]],
  ["in", ["ADP", "in"]],
  ["with", ["ADP", "with"]],
  ["depressed", ["ADJ", "depressed"]],
  ["provided", ["VERB", "provide"]],
  ["is", ["AUX", "be"]],
  ["and", ["CCONJ", "and"]],
  ["or", ["CCONJ", "or"]],
  ["and/or", ["CCONJ", "and/or"]],
  ["one", ["NUM", "one"]],
  ["two", ["NUM", "two"]],
  ["zero", ["NUM", "zero"]],
  ["eleven", ["NUM", "eleven"]],
  ["sensors", ["NOUN", "sensor"]],
  ["more", ["ADJ", "more"]],
  ["at", ["ADP", "at"]],
  ["least", ["ADJ", "least"]]
);
const inputFor = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "recurrence-admission-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const evidenceFor = (text: string) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "recurrence-admission-control",
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "explicit-source-only-no-model",
    assetDigest: "injected-source-control",
    tokens: A.map(A.fromIterable(Str.matchAll(/and\/or|[\p{L}\p{N}-]+|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
      const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
      const lower = Str.toLowerCase(match[0]);
      const fallback: readonly [string, string] = O.isSome(Str.match(/^\d+$/u)(lower))
        ? ["NUM", lower]
        : O.isSome(Str.match(/\p{L}/u)(lower))
          ? ["NOUN", lower]
          : ["PUNCT", lower];
      const [pos, lemma] = O.getOrElse(HashMap.get(facts, lower), () => fallback);
      return ClaimLexicalToken.make({
        anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
        pos,
        lemma: O.some(lemma),
      });
    }),
  });
const compile = Effect.fn("RecurrenceAdmission.compile")(function* (text: string) {
  const prepared = yield* prepareClaimInspection(inputFor(text));
  const qualification = O.getOrThrow(A.head(prepared.qualifications));
  assert.strictEqual(qualification.status, "context-ready");
  if (qualification.status !== "context-ready") return yield* Effect.die("source control did not qualify");
  assert.strictEqual(qualification.claim.claimText, text);
  const evidence = evidenceFor(text);
  const result = yield* decomposePreparedClaimRoles(prepared, [evidence]);
  return { prepared, evidence, result };
});
const assertAtomicDecline = Effect.fn("RecurrenceAdmission.atomicDecline")(function* (text: string) {
  const { prepared, evidence, result } = yield* compile(text);
  assert.deepStrictEqual(result.plans, []);
  const legacy = yield* decomposePreparedClaimRoles(prepared, []);
  assert.deepStrictEqual(result.decompositions, legacy.decompositions);
  const report = yield* inspectPreparedClaimRoles(prepared, [evidence]);
  const row = O.getOrThrow(A.head(report.records));
  assert.strictEqual(row.status, "partial");
  assert.deepStrictEqual(report.input, prepared.input);
});

describe("reviewed recurrence admission repairs", () => {
  it.effect("declines missing preceding VP tokens without defecting the public compiler or inspection", () =>
    Effect.gen(function* () {
      for (const prefix of [
        "In plate depressed in a housing, a system",
        "In a plate depressed in a housing, a system",
      ]) {
        const text = `${prefix} comprising a cover.`;
        const claim = PatentClaim.cases.independent.make({
          claimNumber: 1,
          claimText: text,
          preamble: prefix,
          transition: "comprising",
          body: "a cover.",
        });
        assert.strictEqual(O.isNone(compileClaimClauseRoles(claim, evidenceFor(text))), true);
        yield* assertAtomicDecline(text);
      }
    })
  );
  it.effect("retains existing NP-initial and real VP-owned PP positives", () =>
    Effect.gen(function* () {
      for (const body of [
        "a plate depressed in the housing",
        "the unit is provided with a plate depressed in the housing",
      ]) {
        const { result } = yield* compile(`A system comprising ${body}.`);
        assert.strictEqual(result.plans.length, 1);
        const source = O.getOrThrow(A.head(result.plans)).sourcePlan;
        const nominal = O.getOrThrow(A.findFirst(source.nominals, (nominal) => nominal.core.quote === "a plate"));
        assert.strictEqual(nominal.outer.quote, "a plate depressed in the housing");
        assert.strictEqual(
          A.some(
            source.frames,
            (frame) =>
              frame.attachment === "relative" &&
              O.exists(frame.subject, (subject) => subject.startChar === nominal.core.startChar)
          ),
          true
        );
      }
    })
  );
  it.effect("declines mixed and higher-arity group continuations atomically", () =>
    Effect.gen(function* () {
      for (const ending of [
        "and panel",
        "or panel",
        "and/or panel",
        "and a panel",
        ", and panel",
        ", panel",
        "(4) and panel",
      ]) {
        yield* assertAtomicDecline(`A system comprising a plate or cover ${ending}.`);
      }
    })
  );
  it.effect("retains binary groups, renewed articles and separate semicolon scope", () =>
    Effect.gen(function* () {
      const binary = yield* compile("A system comprising a plate or cover.");
      const plan = O.getOrThrow(A.head(binary.result.plans)).sourcePlan;
      assert.deepStrictEqual(
        A.map(plan.elements, (element) => A.map(element.nominals, (nominal) => nominal.anchor.quote)),
        [["A system"], ["a plate or cover"]]
      );
      for (const body of ["a plate or a cover", "a plate or cover; a panel"]) {
        const { result } = yield* compile(`A system comprising ${body}.`);
        assert.strictEqual(result.plans.length, 1);
        assert.strictEqual(O.getOrThrow(A.head(result.plans)).sourcePlan.elements.length, 3);
      }
    })
  );
  it.effect("keeps unproved NUM-leading regular plurals unknown with the whole prefix", () =>
    Effect.gen(function* () {
      for (const prefix of ["one", "zero", "eleven"]) {
        const text = `A system comprising ${prefix} sensors.`;
        const { prepared, evidence, result } = yield* compile(text);
        const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
        const nominal = O.getOrThrow(
          A.findFirst(plan.nominals, (nominal) => nominal.core.quote === `${prefix} sensors`)
        );
        assert.strictEqual(nominal.head.quote, `${prefix} sensors`);
        assert.strictEqual(nominal.nominal.role, "unknown");
        assert.deepStrictEqual(
          A.filter(plan.proofs, (proof) => proof.kind === "quantity"),
          []
        );
        const report = yield* inspectPreparedClaimRoles(prepared, [evidence]);
        const row = O.getOrThrow(A.head(report.records));
        assert.strictEqual(row.status, "partial");
        if (row.status !== "unchecked")
          assert.strictEqual(
            A.some(
              row.findings,
              (finding) =>
                finding.rule === "unsupported-determiner" && finding.referring.anchor.quote === `${prefix} sensors`
            ),
            true
          );
      }
    })
  );
  it.effect("preserves proved cardinals, explicit quantities and unprefixed generic plurals", () =>
    Effect.gen(function* () {
      const controls: ReadonlyArray<readonly [string, string, ClaimNominalPolicyRole, number]> = [
        ["two sensors", "sensors", "quantified-introduction", 1],
        ["at least one sensor", "sensor", "unknown", 1],
        ["one or more sensors", "sensors", "unknown", 1],
        ["sensors", "sensors", "generic-plural", 0],
      ];
      for (const [body, head, role, certificates] of controls) {
        const { prepared, evidence, result } = yield* compile(`A system comprising ${body}.`);
        const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
        const nominal = O.getOrThrow(A.last(plan.nominals));
        assert.strictEqual(nominal.head.quote, head);
        assert.strictEqual(nominal.nominal.role, role);
        assert.strictEqual(A.filter(plan.proofs, (proof) => proof.kind === "quantity").length, certificates);
        const report = yield* inspectPreparedClaimRoles(prepared, [evidence]);
        assert.strictEqual(O.getOrThrow(A.head(report.records)).status, "complete");
      }
    })
  );
});
