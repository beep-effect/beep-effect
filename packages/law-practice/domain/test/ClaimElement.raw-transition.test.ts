import { rawClaimTransitionScope } from "@beep/law-practice-domain/test";
import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  compileClaimClauseRoles,
  prepareClaimInspection,
  validateClaimFiniteSourceProofs,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const meter = (initial = 262_144) => {
  let remaining = initial;
  let failed = false;
  let callsAfterFailure = 0;
  const charge = (amount: number) => {
    if (failed) callsAfterFailure++;
    remaining -= amount;
    failed = remaining < 0;
    return !failed;
  };
  return { charge, remaining: () => remaining, callsAfterFailure: () => callsAfterFailure };
};
const fallbackPos = (lower: string): ClaimLexicalToken["pos"] => {
  if (O.isSome(Str.match(/^\d+$/u)(lower))) return "NUM";
  return O.isSome(Str.match(/^[\p{L}\p{N}]+$/u)(lower)) ? "NOUN" : "PUNCT";
};
const injectedPos = (lower: string): ClaimLexicalToken["pos"] => {
  if (A.contains(["a", "an", "the"], lower)) return "DET";
  if (A.contains(["further", "essentially"], lower)) return "ADV";
  if (A.contains(["is", "being"], lower)) return "AUX";
  if (A.contains(["where", "wherein", "that", "which"], lower)) return "SCONJ";
  if (A.contains(["of", "in", "by"], lower)) return "ADP";
  if (
    A.contains(
      [
        "comprising",
        "comprises",
        "comprised",
        "including",
        "includes",
        "having",
        "consisting",
        "characterized",
        "characterised",
        "fixed",
      ],
      lower
    )
  )
    return "VERB";
  return fallbackPos(lower);
};
const facts = (text: string) =>
  A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
    const lower = Str.toLowerCase(match[0]);
    const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
    return ClaimLexicalToken.make({
      anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
      pos: injectedPos(lower),
      lemma: O.some(A.contains(["is", "being"], lower) ? "be" : lower),
    });
  });
const evidenceFor = (claim: PatentClaim) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "raw-transition-controls",
    sourceOrdinal: 2,
    qualifiedText: claim.claimText,
    provider: "injected-source-only",
    assetDigest: "no-provider-executed",
    tokens: facts(claim.claimText),
  });
const qualify = Effect.fn("RawTransitionTest.qualify")(function* (text: string) {
  const input = ClaimInputCollection.make({
    sourceKey: "raw-transition-controls",
    records: A.map(A.make("A system comprising a sensor.", text), (canonicalText, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: canonicalText,
        canonicalText,
      })
    ),
  });
  const prepared = yield* prepareClaimInspection(input);
  return O.getOrThrow(A.get(prepared.qualifications, 1));
});
const claimFor = (raw: string, canonical: PatentClaim["transition"], preamble = "A system") =>
  PatentClaim.cases.independent.make({
    claimNumber: 2,
    claimText: `${preamble} ${raw} a sensor.`,
    preamble,
    transition: canonical,
    body: "a sensor.",
  });

const forms: ReadonlyArray<readonly [string, PatentClaim["transition"]]> = [
  ["comprising", "comprising"],
  ["comprises", "comprising"],
  ["comprised of", "comprising"],
  ["including", "including"],
  ["includes", "including"],
  ["having", "having"],
  ["consisting of", "consisting of"],
  ["consisting essentially of", "consisting essentially of"],
  ["wherein", "wherein"],
  ["where", "wherein"],
  ["Wherein", "wherein"],
  ["characterized in that", "wherein"],
  ["characterised in that", "wherein"],
  ["characterized by the fact that", "wherein"],
  ["characterised by", "wherein"],
  ["is characterized by", "wherein"],
  ["being characterized by the steps of", "wherein"],
  ["in which", "wherein"],
  ["in which method", "wherein"],
  ["further comprising", "comprising"],
  [", further comprising", "comprising"],
  ["further wherein", "wherein"],
  ["further including", "including"],
];

describe("existing normalizer grammar retains exact raw transition scopes", () => {
  for (const [raw, canonical] of forms) {
    it.effect(`preserves ${raw} with canonical ${canonical}`, () =>
      Effect.gen(function* () {
        const claim = claimFor(raw, canonical);
        const qualification = yield* qualify(claim.claimText);
        assert.strictEqual(qualification.status, "context-ready");
        if (qualification.status !== "context-ready") return;
        assert.deepStrictEqual(qualification.claim, claim);
        const work = meter();
        const scope = O.getOrThrow(rawClaimTransitionScope(claim, work.charge));
        assert.deepStrictEqual(
          scope,
          TextAnchor.make({
            startChar: claim.preamble.length + 1,
            endChar: claim.preamble.length + 1 + raw.length,
            quote: raw,
          })
        );
        assert.isTrue(work.remaining() < 262_144);
        const evidence = evidenceFor(claim);
        const plan = O.getOrThrow(compileClaimClauseRoles(claim, evidence));
        const sourceScope = O.getOrThrow(
          A.findFirst(plan.certificates, (proof) => proof.kind === "scope" && proof.role === "transition")
        );
        assert.strictEqual(sourceScope.kind, "scope");
        if (sourceScope.kind !== "scope") return;
        assert.deepStrictEqual(sourceScope.extent, scope);
        assert.isTrue(
          validateClaimFiniteSourceProofs(claim, evidence.tokens, plan.certificates, plan.proofs, meter().charge)
        );
        assert.isTrue(
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            evidence,
            plan.certificates,
            plan.proofs,
            meter().charge
          )
        );
      })
    );
  }
  it.effect("keeps the canonical prefix optimization equivalent around commas and defining clauses", () =>
    Effect.gen(function* () {
      const earlyComma = PatentClaim.cases.dependent.make({
        claimNumber: 2,
        claimReferences: [1],
        claimText: "The system of claim 1, the sensor comprising a panel is fixed.",
        preamble: "The system of claim 1, the sensor",
        transition: "comprising",
        body: "a panel is fixed.",
      });
      assertNone(rawClaimTransitionScope(earlyComma, meter().charge));
      const overridden = PatentClaim.cases.independent.make({
        claimNumber: 2,
        claimText: "A system wherein a sensor; characterized in that a panel.",
        preamble: "A system",
        transition: "wherein",
        body: "a sensor; characterized in that a panel.",
      });
      assertNone(rawClaimTransitionScope(overridden, meter().charge));
      const firstCannotBeOverridden = PatentClaim.cases.independent.make({
        claimNumber: 2,
        claimText: "A system comprising a sensor; characterized in that a panel.",
        preamble: "A system",
        transition: "comprising",
        body: "a sensor; characterized in that a panel.",
      });
      const qualified = yield* qualify(firstCannotBeOverridden.claimText);
      assert.strictEqual(qualified.status, "context-ready");
      if (qualified.status !== "context-ready") return;
      assert.deepStrictEqual(qualified.claim, firstCannotBeOverridden);
      assert.strictEqual(
        O.getOrThrow(rawClaimTransitionScope(firstCannotBeOverridden, meter().charge)).quote,
        "comprising"
      );
    })
  );
  it.effect("keeps UTF-16 offsets through a supplementary preamble character", () =>
    Effect.gen(function* () {
      const claim = claimFor("where", "wherein", "A 🚀 system");
      const scope = O.getOrThrow(rawClaimTransitionScope(claim, meter().charge));
      assert.strictEqual(scope.startChar, 12);
      assert.strictEqual(scope.quote, "where");
      assert.strictEqual(Str.slice(scope.startChar, scope.endChar)(claim.claimText), scope.quote);
    })
  );
  it.effect("uses existing comma-dependent eligibility rather than the comma mapping alone", () =>
    Effect.gen(function* () {
      const text = "The system of claim 1, a sensor is fixed.";
      const qualification = yield* qualify(text);
      assert.strictEqual(qualification.status, "context-ready");
      if (qualification.status !== "context-ready") return;
      const scope = O.getOrThrow(rawClaimTransitionScope(qualification.claim, meter().charge));
      assert.strictEqual(scope.quote, ",");
      for (const source of [
        "A system, a sensor is fixed.",
        "The system of claim 1, a sensor.",
        "The system of claim 1 or, a sensor is fixed.",
      ]) {
        const rejected = yield* qualify(source);
        assert.isFalse(rejected.status === "context-ready");
      }
    })
  );
  it.effect("rejects wrong source fields and quoted or bracketed fake governing words", () =>
    Effect.gen(function* () {
      const base = claimFor("where", "wherein");
      const mismatched = [
        PatentClaim.cases.independent.make({ ...base, transition: "comprising" }),
        PatentClaim.cases.independent.make({ ...base, preamble: "A" }),
        PatentClaim.cases.independent.make({ ...base, body: "sensor." }),
        claimFor("where", "wherein", 'A "system'),
        claimFor("where", "wherein", "A (system"),
        claimFor("arbitrary where", "wherein"),
      ];
      for (const claim of mismatched) assertNone(rawClaimTransitionScope(claim, meter().charge));
    })
  );
  it.effect("rejects fabricated canonical, truncated and foreign raw scope certificates", () =>
    Effect.gen(function* () {
      const claim = claimFor(", further comprising", "comprising");
      const evidence = evidenceFor(claim);
      const plan = O.getOrThrow(compileClaimClauseRoles(claim, evidence));
      const original = O.getOrThrow(
        A.findFirst(plan.certificates, (proof) => proof.kind === "scope" && proof.role === "transition")
      );
      if (original.kind !== "scope") throw new Error("transition scope missing");
      const end = original.extent.endChar;
      const bad = [
        TextAnchor.make({ startChar: end - 10, endChar: end, quote: "comprising" }),
        TextAnchor.make({
          startChar: original.extent.startChar,
          endChar: original.extent.startChar + 7,
          quote: "wherein",
        }),
        TextAnchor.make({ ...original.extent, quote: Str.toUpperCase(original.extent.quote) }),
      ];
      for (const extent of bad) {
        const corrupt = A.map(plan.certificates, (proof) =>
          proof.ordinal === original.ordinal ? { ...original, extent } : proof
        );
        assert.isFalse(validateClaimFiniteSourceProofs(claim, evidence.tokens, corrupt, plan.proofs, meter().charge));
        assert.isFalse(
          validateClaimFiniteSourceProofsFromOriginalInput(claim, evidence, corrupt, plan.proofs, meter().charge)
        );
      }
    })
  );
  it.effect("retains Unicode trim semantics and rejects overlapping qualified fields", () =>
    Effect.gen(function* () {
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 2,
        claimText: "A system\u00a0comprising\u2003a sensor.",
        preamble: "A system",
        transition: "comprising",
        body: "a sensor.",
      });
      const scope = O.getOrThrow(rawClaimTransitionScope(claim, meter().charge));
      assert.strictEqual(scope.quote, "comprising");
      assert.strictEqual(Str.slice(scope.startChar, scope.endChar)(claim.claimText), "comprising");
      const overlapping = PatentClaim.cases.independent.make({
        ...claim,
        preamble: claim.claimText,
        body: claim.claimText,
      });
      const charges: Array<number> = [];
      const work = meter();
      const result = rawClaimTransitionScope(overlapping, (amount) => {
        charges.push(amount);
        return work.charge(amount);
      });
      assertNone(result);
      assert.isTrue(A.every(charges, (amount) => amount >= 0));
      for (const whitespace of ["\u00a0", "\u2003", "\u2028", "\ufeff"]) {
        const nonNormalized = PatentClaim.cases.independent.make({
          ...claim,
          body: `${whitespace}a sensor.`,
          claimText: `A system comprising ${whitespace}a sensor.`,
        });
        assertNone(rawClaimTransitionScope(nonNormalized, meter().charge));
      }
    })
  );
  it.effect("keeps curly apostrophe continuation Unicode-aware while anchors remain UTF-16", () =>
    Effect.gen(function* () {
      const protectedClaim = PatentClaim.cases.independent.make({
        claimNumber: 2,
        claimText: "A ‘system’𐐀 where a sensor. end’",
        preamble: "A ‘system’𐐀",
        transition: "wherein",
        body: "a sensor. end’",
      });
      assertNone(rawClaimTransitionScope(protectedClaim, meter().charge));
      const outside = claimFor("where", "wherein", "A ‘system’🚀");
      const scope = O.getOrThrow(rawClaimTransitionScope(outside, meter().charge));
      assert.strictEqual(Str.slice(scope.startChar, scope.endChar)(outside.claimText), "where");
    })
  );
  it.effect("skips a protected implicit comma without masking a real dependent comma", () =>
    Effect.gen(function* () {
      const quoted = claimFor("comprising", "comprising", 'A "claim 1, the sensor is fixed" system');
      const scope = O.getOrThrow(rawClaimTransitionScope(quoted, meter().charge));
      assert.strictEqual(scope.quote, "comprising");
      assert.strictEqual(scope.startChar, quoted.preamble.length + 1);
      const realComma = PatentClaim.cases.independent.make({
        claimNumber: 2,
        claimText: "The system of claim 1, the sensor comprising a panel is fixed.",
        preamble: "The system of claim 1, the sensor",
        transition: "comprising",
        body: "a panel is fixed.",
      });
      assertNone(rawClaimTransitionScope(realComma, meter().charge));
    })
  );
  it.effect("stops metered selection on its first failure without resetting allowance", () =>
    Effect.gen(function* () {
      const claim = claimFor("where", "wherein");
      for (const limit of [0, 1, 64, 128]) {
        const work = meter(limit);
        assertNone(rawClaimTransitionScope(claim, work.charge));
        assert.strictEqual(work.callsAfterFailure(), 0);
        assert.isTrue(work.remaining() < 0);
      }
      const healthy = meter();
      assertSome(
        rawClaimTransitionScope(claim, healthy.charge),
        TextAnchor.make({ startChar: 9, endChar: 14, quote: "where" })
      );
    })
  );
});
