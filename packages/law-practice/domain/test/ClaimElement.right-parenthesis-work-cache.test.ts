import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimFiniteSourceProof,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceElementPlan,
  compileClaimClauseRoles,
  readSourceRightParenthesisList,
  validateClaimFiniteSourceProofsFromOriginalInput,
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
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

// Original synthetic lexical data is decoded by the existing finite-source fixture helper.
const rowOf = (body: string, joined: boolean, procedural = false, root = "system") => {
  const preamble = `A ${root}`;
  const suffix = procedural ? `the steps of: ${body}.` : `: ${body}.`;
  const source = `${preamble} comprising ${suffix}`;
  const words = (word: string): readonly [string, string] => {
    if (word === "comprising") return ["VERB", "comprise"];
    if (word === "placing") return ["VERB", "place"];
    if (word === "forming") return ["VERB", "form"];
    if (word === "a" || word === "the") return ["DET", word];
    if (word === "of") return ["ADP", word];
    return [O.isSome(Str.match(/^\p{L}/u)(word)) ? "NOUN" : "PUNCT", word];
  };
  return {
    source,
    qualifiedParts: { preamble, transition: "comprising" as const, body: suffix },
    tokens: A.map(
      A.fromIterable(
        Str.matchAll(joined ? /[a-z]\)(?=\s)|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu : /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(
          source
        )
      ),
      (match) => {
        const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
        const [pos, lemma] = words(Str.toLowerCase(match[0]));
        return { anchor: { startChar, endChar: startChar + match[0].length, quote: match[0] }, pos, lemma };
      }
    ),
  };
};
const planOf = Effect.fn("RightListMemo.plan")(function* (row: ReturnType<typeof rowOf>) {
  const result = yield* decomposeFiniteSourceFixture(row);
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});
const bounded = (initial = 262_144, denyAt = -1) => {
  let remaining = initial;
  let denied = false;
  let afterDenial = 0;
  const debits: Array<number> = [];
  return {
    charge: (amount: number): boolean => {
      if (denied) afterDenial++;
      remaining -= amount;
      const paid = !denied && remaining >= 0 && debits.length !== denyAt;
      debits.push(amount);
      if (!paid) denied = true;
      return paid;
    },
    debits,
    remaining: () => remaining,
    afterDenial: () => afterDenial,
  };
};
const originalOf = (plan: ClaimSourceElementPlan) => {
  const input = O.getOrThrow(plan.roles.originalLexicalInput);
  if (input.status !== "aligned") throw new Error("expected aligned original input");
  return input;
};
const validate = (plan: ClaimSourceElementPlan, meter: ReturnType<typeof bounded>): boolean =>
  validateClaimFiniteSourceProofsFromOriginalInput(
    O.getOrThrow(plan.roles.qualifiedClaim),
    originalOf(plan),
    plan.roles.certificates,
    plan.roles.proofs,
    meter.charge
  );
const baseDebit = (plan: ClaimSourceElementPlan): number =>
  originalOf(plan).tokens.length * 24 + plan.qualifiedText.length * 4 + 64;
const scanCount = (plan: ClaimSourceElementPlan, meter: ReturnType<typeof bounded>): number =>
  A.filter(meter.debits, (n) => n === baseDebit(plan)).length;

const assertDeniedPrefix = (
  run: (meter: ReturnType<typeof bounded>) => boolean,
  funded: ReturnType<typeof bounded>,
  prefix: number
): ReturnType<typeof bounded> => {
  const meter = bounded(262_144, prefix);
  assert.isFalse(run(meter), `accepted denial${prefix}`);
  assert.strictEqual(meter.afterDenial(), 0, `charge after denial${prefix}`);
  assert.strictEqual(meter.debits.length, prefix + 1, `wrong request count${prefix}`);
  assert.deepStrictEqual(meter.debits, A.take(funded.debits, prefix + 1), `different funded prefix${prefix}`);
  return meter;
};
const assertAllDeniedPrefixes = (
  run: (meter: ReturnType<typeof bounded>) => boolean,
  funded: ReturnType<typeof bounded>
): void => {
  for (let prefix = 0; prefix < funded.debits.length; prefix++) assertDeniedPrefix(run, funded, prefix);
};

for (const joined of [false, true]) {
  describe(`right-list memo ${joined ? "combined" : "split"}`, () => {
    it.effect(`shares one classification across boundaries and operators (${joined ? "combined" : "split"})`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf(
          rowOf("a) placing a plate; b) forming a port; c) placing a panel", joined, true, "method")
        );
        const meter = bounded();
        assert.isTrue(validate(plan, meter));
        assert.strictEqual(scanCount(plan, meter), 1);
        assert.strictEqual(A.filter(plan.roles.certificates, (p) => p.kind === "label-boundary").length, 3);
        assert.strictEqual(A.filter(plan.roles.certificates, (p) => p.kind === "operator").length, 4);
        assert.strictEqual(meter.afterDenial(), 0);
      })
    );
    it.effect(`admits26 complete flat labels within the existing allowance (${joined ? "combined" : "split"})`, () =>
      Effect.gen(function* () {
        const body = A.join(
          A.map(A.fromIterable("abcdefghijklmnopqrstuvwxyz"), (label) => `${label}) a plate`),
          "; "
        );
        const plan = yield* planOf(rowOf(body, joined));
        assert.strictEqual(plan.elements.length, 27);
        assert.strictEqual(A.filter(plan.roles.certificates, (p) => p.kind === "label-boundary").length, 26);
        const claim = O.getOrThrow(plan.roles.qualifiedClaim);
        const compiled = O.getOrThrow(compileClaimClauseRoles(claim, originalOf(plan)));
        const meter = bounded(compiled.remainingWork);
        assert.isTrue(validate(plan, meter));
        assert.strictEqual(scanCount(plan, meter), 1);
        assert.isAbove(plan.remainingWork, 0);
      })
    );
    it.effect(`rejects changed later proof fields after a warm hit (${joined ? "combined" : "split"})`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf(rowOf("a) a plate; b) a panel; c) a port", joined));
        const proof = O.getOrThrow(
          A.findFirst(plan.roles.certificates, (p) => p.kind === "label-boundary" && p.item === 1)
        );
        if (proof.kind !== "label-boundary") throw new Error("expected label witness");
        for (const changed of [
          { ...proof, governor: proof.colon },
          { ...proof, scope: proof.governor },
          { ...proof, item: 0 },
          { ...proof, markers: A.reverse(proof.markers) },
        ]) {
          const certificates = A.map(plan.roles.certificates, (p) => (p.ordinal === proof.ordinal ? changed : p));
          const altered = ClaimSourceElementPlan.make({
            ...plan,
            roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates }),
          });
          const meter = bounded();
          assert.isFalse(validate(altered, meter));
          assert.strictEqual(scanCount(plan, meter), 1);
          assert.isFalse(validateClaimSourceOwnership(altered, bounded().charge));
        }
      })
    );
    it.effect(`rechecks a later raw action after a warm hit (${joined ? "combined" : "split"})`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf(rowOf("a) placing a plate; b) forming a port", joined, true, "method"));
        const original = originalOf(plan);
        const raw = O.getOrThrow(A.findFirst(original.tokens, (t) => t.anchor.quote === "forming"));
        const token = ClaimLexicalToken.make({ ...raw, pos: "NOUN" });
        const input = ClaimLexicalEvidence.cases.aligned.make({
          ...original,
          tokens: A.map(original.tokens, (t) => (t.anchor.startChar === raw.anchor.startChar ? token : t)),
        });
        const certificates = A.map(plan.roles.certificates, (p) =>
          p.kind === "token" && p.token.anchor.startChar === raw.anchor.startChar
            ? ClaimFiniteSourceProof.cases.token.make({ ...p, token })
            : p
        );
        const altered = ClaimSourceElementPlan.make({
          ...plan,
          roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates, originalLexicalInput: O.some(input) }),
        });
        const meter = bounded();
        assert.isFalse(validate(altered, meter));
        assert.strictEqual(scanCount(plan, meter), 1);
        assert.isFalse(validateClaimSourceOwnership(altered, bounded().charge));
      })
    );
    it.effect(`stops every denied setup, scan, hit and proof debit (${joined ? "combined" : "split"})`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf(rowOf("a) placing a plate; b) forming a port", joined, true, "method"));
        const funded = bounded();
        assert.isTrue(validate(plan, funded));
        const spent = 262_144 - funded.remaining();
        const exact = bounded(spent);
        assert.isTrue(validate(plan, exact));
        assert.strictEqual(exact.remaining(), 0);
        assert.isFalse(validate(plan, bounded(spent - 1)));
        assertAllDeniedPrefixes((meter) => validate(plan, meter), funded);
        const fresh = bounded();
        assert.isTrue(validate(plan, fresh));
        assert.strictEqual(scanCount(plan, fresh), 1);
      })
    );
  });
}

describe("per-validation original right-list memo isolation", () => {
  it.effect("starts fresh across calls, claims, shifted offsets and tokenizations", () =>
    Effect.gen(function* () {
      const left = yield* planOf(rowOf("a) a plate; b) a panel", false));
      const right = yield* planOf(rowOf("a) a plate; b) a panel", true, false, "apparatus"));
      for (const plan of [left, left, right, left]) {
        const meter = bounded();
        assert.isTrue(validate(plan, meter));
        assert.strictEqual(scanCount(plan, meter), 1);
      }
      const wrong = ClaimSourceElementPlan.make({
        ...left,
        roles: ClaimClauseRolePlan.make({
          ...left.roles,
          qualifiedClaim: right.roles.qualifiedClaim,
          originalLexicalInput: right.roles.originalLexicalInput,
        }),
      });
      assert.isFalse(validate(wrong, bounded()));
    })
  );
  it.effect("isolates reentrant contexts and their real allowances", () =>
    Effect.gen(function* () {
      const outer = yield* planOf(rowOf("a) a plate; b) a panel", false));
      const inner = yield* planOf(rowOf("a) a port; b) a bracket", true, false, "apparatus"));
      const a = bounded();
      const b = bounded();
      let entered = false;
      const valid = validateClaimFiniteSourceProofsFromOriginalInput(
        O.getOrThrow(outer.roles.qualifiedClaim),
        originalOf(outer),
        outer.roles.certificates,
        outer.roles.proofs,
        (amount) => {
          const paid = a.charge(amount);
          if (paid && !entered && amount === baseDebit(outer)) {
            entered = true;
            assert.isTrue(validate(inner, b));
          }
          return paid;
        }
      );
      assert.isTrue(valid);
      assert.isTrue(entered);
      assert.strictEqual(scanCount(outer, a), 1);
      assert.strictEqual(scanCount(inner, b), 1);
    })
  );
  it.effect("distinguishes funded semantic None from denial and reuses that None", () =>
    Effect.gen(function* () {
      const row = rowOf("(a) placing a plate; (b) forming a port", false, true, "method");
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: row.source,
        ...row.qualifiedParts,
      });
      const input = ClaimLexicalEvidence.cases.aligned.make({
        sourceKey: "synthetic-none",
        sourceOrdinal: 1,
        qualifiedText: row.source,
        provider: "explicit-source-only",
        assetDigest: "no-provider",
        tokens: A.map(row.tokens, (t) =>
          ClaimLexicalToken.make({ ...t, anchor: TextAnchor.make(t.anchor), lemma: O.some(t.lemma) })
        ),
      });
      const roles = O.getOrThrow(compileClaimClauseRoles(claim, input));
      const base = input.tokens.length * 24 + claim.claimText.length * 4 + 64;
      const read = bounded();
      assertNone(readSourceRightParenthesisList(claim, input.tokens, read.charge));
      assert.isAbove(read.remaining(), 0);
      const run = (meter: ReturnType<typeof bounded>) =>
        validateClaimFiniteSourceProofsFromOriginalInput(claim, input, roles.certificates, roles.proofs, meter.charge);
      const funded = bounded();
      assert.isTrue(run(funded));
      assert.strictEqual(A.filter(funded.debits, (n) => n === base).length, 1);
      assert.strictEqual(A.filter(roles.certificates, (p) => p.kind === "label-boundary").length, 0);
      assert.strictEqual(A.filter(roles.certificates, (p) => p.kind === "operator").length, 3);
      assertAllDeniedPrefixes(run, funded);
      const fresh = bounded();
      assert.isTrue(run(fresh));
      assert.strictEqual(A.filter(fresh.debits, (n) => n === base).length, 1);
    })
  );
  it.effect("prepays setup8 and lookup2 and propagates their denials immediately", () =>
    Effect.gen(function* () {
      const plan = yield* planOf(rowOf("a) a plate; b) a panel; c) a port", false));
      const funded = bounded();
      assert.isTrue(validate(plan, funded));
      const baseIndex = O.getOrThrow(A.findFirstIndex(funded.debits, (n) => n === baseDebit(plan)));
      assert.strictEqual(O.getOrThrow(A.get(funded.debits, baseIndex - 2)), 2);
      assert.strictEqual(O.getOrThrow(A.get(funded.debits, baseIndex - 1)), 8);
      const strict = 3 * 16 + 32;
      const later =
        O.getOrThrow(
          A.findFirstIndex(
            funded.debits,
            (n, i) => i > baseIndex && n === strict && O.contains(A.get(funded.debits, i + 1), 2)
          )
        ) + 1;
      for (const index of [baseIndex - 2, baseIndex - 1, baseIndex, later]) {
        const denied = assertDeniedPrefix((meter) => validate(plan, meter), funded, index);
        assert.strictEqual(scanCount(plan, denied), index < baseIndex ? 0 : 1);
      }
    })
  );
});
