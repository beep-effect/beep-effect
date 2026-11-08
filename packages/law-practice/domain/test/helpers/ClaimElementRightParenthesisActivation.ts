import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimElementTree,
  ClaimFiniteSourceProof,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceElementPlan,
  ClaimSourceFrame,
  ClaimSourceProof,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { Sha256HexFromBytes } from "@beep/schema";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import historical from "../fixtures/claim-element/recurrence-source-plans.json" with { type: "json" };
import activation from "../fixtures/claim-element/right-parenthesis-synthetic-activation-v1.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./ClaimElementFiniteSource.ts";
import type { ClaimRoleDecomposition } from "@beep/law-practice-domain/values/ClaimElement";

const activated = S.Struct({
  schemaVersion: S.Literal("right-parenthesis-synthetic-source-activation/v1"),
  historicalCase: S.Literal("bare-label-deferred"),
  historicalFixtureSha256: S.NonEmptyString,
  historicalParsedJsonSha256: S.NonEmptyString,
  historicalCaseSha256: S.NonEmptyString,
  historicalCaseCanonicalJson: S.NonEmptyString,
  historicalRows: S.Int,
  otherHistoricalRows: S.Int,
  featureCommits: S.Array(S.NonEmptyString),
  source: S.NonEmptyString,
  expected: S.Json,
  finiteCertificates: S.Array(ClaimFiniteSourceProof),
  completeFrames: S.Array(ClaimSourceFrame),
  sourceProofs: S.Array(ClaimSourceProof),
  publicTree: ClaimElementTree,
});
const jsonText = S.fromJsonString(S.Json);
const hashText = S.decodeEffect(Sha256HexFromBytes);
const hash = (text: string) => hashText(new TextEncoder().encode(text));
const funded = () => {
  let remaining = 262_144;
  return (amount: number): boolean => {
    remaining -= amount;
    return remaining >= 0;
  };
};
const finite = (plan: ClaimSourceElementPlan): boolean =>
  validateClaimFiniteSourceProofsFromOriginalInput(
    O.getOrThrow(plan.roles.qualifiedClaim),
    O.getOrThrow(plan.roles.originalLexicalInput),
    plan.roles.certificates,
    plan.roles.proofs,
    funded()
  );
const assertRejected = (plan: ClaimSourceElementPlan): void => {
  assert.isFalse(finite(plan));
  assert.isFalse(validateClaimSourceOwnership(plan, funded()));
};
const assertWitnessMutations = (plan: ClaimSourceElementPlan): void => {
  const proof = O.getOrThrow(A.findFirst(plan.roles.certificates, (proof) => proof.kind === "label-boundary"));
  if (proof.kind !== "label-boundary") throw new Error("expected complete source-label witness");
  for (const variant of [
    { ...proof, governor: proof.colon },
    { ...proof, markers: A.reverse(proof.markers) },
  ])
    assertRejected(
      ClaimSourceElementPlan.make({
        ...plan,
        roles: ClaimClauseRolePlan.make({
          ...plan.roles,
          certificates: A.map(plan.roles.certificates, (p) => (p.ordinal === proof.ordinal ? variant : p)),
        }),
      })
    );
};
const assertRawMutation = Effect.fn("RightParenthesisActivation.rawMutation")(function* (plan: ClaimSourceElementPlan) {
  const original = O.getOrThrow(plan.roles.originalLexicalInput);
  if (original.status !== "aligned") throw new Error("expected original aligned input");
  const raw = O.getOrThrow(A.findFirst(original.tokens, (token) => token.anchor.quote === "plate"));
  const token = ClaimLexicalToken.make({ ...raw, pos: "VERB" });
  const input = ClaimLexicalEvidence.cases.aligned.make({
    ...original,
    tokens: A.map(original.tokens, (old) => (old.anchor.startChar === raw.anchor.startChar ? token : old)),
  });
  const certificates = A.map(plan.roles.certificates, (proof) =>
    proof.kind === "token" && proof.token.anchor.startChar === raw.anchor.startChar
      ? ClaimFiniteSourceProof.cases.token.make({ ...proof, token })
      : proof
  );
  assertRejected(
    ClaimSourceElementPlan.make({
      ...plan,
      roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates, originalLexicalInput: O.some(input) }),
    })
  );
  const row = O.getOrThrow(A.findFirst(historical.fixtures, (row) => row.case === activation.historicalCase));
  const changed = yield* decomposeFiniteSourceFixture({
    source: row.qualifiedText,
    qualifiedParts: row.qualifiedParts,
    tokens: A.map(row.lexicalEvidence.tokens, (old) =>
      old.anchor.startChar === raw.anchor.startChar ? { ...old, pos: "VERB" } : old
    ),
  });
  assert.deepStrictEqual(changed.plans, []);
});

/**
 * Check the single locally reviewed synthetic activation while retaining its
 * historical declined row and all other historical expectations unchanged.
 * **Example** (Check a reviewed source decomposition)
 * ```ts
 * import { assertRightParenthesisActivation } from "./helpers/ClaimElementRightParenthesisActivation.ts"
 * console.log(typeof assertRightParenthesisActivation) // "function"
 * ```
 * @category testing
 * @since 0.0.0
 */
export const assertRightParenthesisActivation = Effect.fn("RightParenthesisActivation.check")(function* (
  result: ClaimRoleDecomposition
) {
  const overlay = yield* S.decodeUnknownEffect(activated)(activation);
  assert.deepStrictEqual([overlay.historicalRows, overlay.otherHistoricalRows], [54, 53]);
  assert.strictEqual(historical.fixtures.length, overlay.historicalRows);
  assert.strictEqual(
    A.filter(historical.fixtures, (row) => row.case !== overlay.historicalCase).length,
    overlay.otherHistoricalRows
  );
  assert.deepStrictEqual(overlay.featureCommits, [
    "500bf31833a78b501a3b2d9eddd43b5e5f174ad4",
    "3b62e4725843ffcee0fdc63b9968e625a3942d0d",
  ]);
  assert.strictEqual(
    overlay.historicalFixtureSha256,
    "30c157e028651b63ac6074be1d8bfbca01887a6c215b6a077e79446f57648e07"
  );
  const historicalText = yield* S.encodeEffect(jsonText)(historical);
  const historicalHash = yield* hash(historicalText);
  assert.strictEqual(historicalHash, overlay.historicalParsedJsonSha256);
  const original = yield* S.decodeEffect(jsonText)(overlay.historicalCaseCanonicalJson);
  const originalHash = yield* hash(overlay.historicalCaseCanonicalJson);
  assert.strictEqual(originalHash, overlay.historicalCaseSha256);
  const row = O.getOrThrow(A.findFirst(historical.fixtures, (row) => row.case === overlay.historicalCase));
  assert.deepStrictEqual<unknown>(original, row);
  assert.strictEqual(row.outcome, "declined");
  assert.strictEqual(row.qualifiedText, overlay.source);
  assert.strictEqual(result.plans.length, 1);
  const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
  assert.deepStrictEqual(plan.frames, overlay.completeFrames);
  assert.deepStrictEqual(plan.roles.certificates, overlay.finiteCertificates);
  assert.deepStrictEqual(plan.roles.proofs, overlay.sourceProofs);
  assert.deepStrictEqual(plan.proofs, overlay.sourceProofs);
  const decomposition = O.getOrThrow(A.head(result.decompositions));
  assert.strictEqual(decomposition.status, "decomposed");
  if (decomposition.status !== "decomposed") throw new Error("expected activated source tree");
  assert.deepStrictEqual(decomposition.tree, overlay.publicTree);
  assert.isTrue(finite(plan));
  assert.isTrue(validateClaimSourceOwnership(plan, funded()));
  assertWitnessMutations(plan);
  yield* assertRawMutation(plan);
});
