import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimFiniteSourceProof,
  ClaimNominalCandidateState,
  ClaimSourceControlEvidence,
  ClaimSourceElementPlan,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  ClaimSourceTokenOwnership,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import controls from "./fixtures/claim-element/finite-clause-source-plans.json" with { type: "json" };
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

const admitted = Effect.fn("FiniteProof.admitted")(function* (name: string) {
  const row = O.getOrThrow(A.findFirst(controls.cases, (row) => row.case === name));
  const result = yield* decomposeFiniteSourceFixture(row);
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});
const validated = (plan: ClaimSourceElementPlan): boolean => {
  let remaining = 262_144;
  return validateClaimSourceOwnership(plan, (amount) => {
    remaining -= amount;
    return remaining >= 0;
  });
};
const certificatesOf = (
  plan: ClaimSourceElementPlan,
  patch: (proof: ClaimFiniteSourceProof) => ClaimFiniteSourceProof
): ClaimSourceElementPlan =>
  ClaimSourceElementPlan.make({
    ...plan,
    roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates: A.map(plan.roles.certificates, patch) }),
  });
const independent = "finite-one-PP-before-direct-object";

describe("finite source proofs reject corruption before public projection", () => {
  it.effect("rejects source-invalid core/head anchors and missing head membership", () =>
    Effect.gen(function* () {
      const plan = yield* admitted(independent);
      assert.strictEqual(validated(plan), true);
      const head = O.getOrThrow(A.findFirst(plan.roles.certificates, (p) => p.kind === "head"));
      const mutate = (
        patch: (proof: Extract<ClaimFiniteSourceProof, { readonly kind: "head" }>) => ClaimFiniteSourceProof
      ) => certificatesOf(plan, (p) => (p.ordinal === head.ordinal && p.kind === "head" ? patch(p) : p));
      assert.strictEqual(
        validated(
          mutate((p) =>
            ClaimFiniteSourceProof.cases.head.make({
              ...p,
              head: TextAnchor.make({ ...p.head, quote: Str.repeat(p.head.quote.length)("X") }),
            })
          )
        ),
        false
      );
      assert.strictEqual(
        validated(
          mutate((p) =>
            ClaimFiniteSourceProof.cases.head.make({
              ...p,
              head: TextAnchor.make({
                startChar: p.head.startChar,
                endChar: p.core.endChar + 1,
                quote: Str.slice(p.head.startChar, p.core.endChar + 1)(plan.qualifiedText),
              }),
            })
          )
        ),
        false
      );
      assert.strictEqual(
        validated(
          mutate((p) =>
            ClaimFiniteSourceProof.cases.head.make({
              ...p,
              core: TextAnchor.make({ ...p.core, quote: Str.repeat(p.core.quote.length)("X") }),
            })
          )
        ),
        false
      );
      assert.strictEqual(validated(mutate((p) => ClaimFiniteSourceProof.cases.head.make({ ...p, tokens: [] }))), false);
    })
  );
  it.effect("rejects wrong slots, cycles, missing references and conflicting qualified scopes", () =>
    Effect.gen(function* () {
      const plan = yield* admitted(independent);
      const first = O.getOrThrow(A.findFirst(plan.roles.certificates, (p) => p.kind === "head"));
      const body = O.getOrThrow(A.findFirst(plan.roles.certificates, (p) => p.kind === "scope" && p.role === "body"));
      const bad = [
        ClaimSourceProofRef.make({ ordinal: first.ordinal, slot: "core" }),
        ClaimSourceProofRef.make({
          ordinal: ClaimSourceProofOrdinal.make(plan.roles.certificates.length + 1),
          slot: "opening",
        }),
        ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(1), slot: "operator" }),
      ];
      for (const ref of bad)
        assert.strictEqual(
          validated(
            certificatesOf(plan, (p) =>
              p.ordinal === first.ordinal && p.kind === "head"
                ? ClaimFiniteSourceProof.cases.head.make({ ...p, opening: ref })
                : p
            )
          ),
          false
        );
      assert.strictEqual(
        validated(
          certificatesOf(plan, (p) =>
            p.kind === "opening" && p.coreStart === 0
              ? ClaimFiniteSourceProof.cases.opening.make({
                  ...p,
                  scope: ClaimSourceProofRef.make({ ordinal: body.ordinal, slot: "scope" }),
                })
              : p
          )
        ),
        false
      );
    })
  );
  it.effect("rejects missing/duplicated token rows, foreign quotes, wrong owners and scope-only public hiding", () =>
    Effect.gen(function* () {
      const plan = yield* admitted(independent);
      const row = O.getOrThrow(
        O.filter(
          A.head(plan.tokenOwnership),
          (entry): entry is Extract<typeof entry, { readonly kind: "public-core" }> => entry.kind === "public-core"
        )
      );
      const scope = O.getOrThrow(
        A.findFirst(plan.roles.certificates, (p) => p.kind === "scope" && p.role === "preamble")
      );
      const rows = [
        A.drop(plan.tokenOwnership, 1),
        [row, ...plan.tokenOwnership],
        A.map(plan.tokenOwnership, (r, i) =>
          i === 0
            ? ClaimSourceTokenOwnership.cases.control.make({
                token: row.token,
                extent: row.extent,
                evidence: ClaimSourceControlEvidence.cases.scope.make({
                  proof: ClaimSourceProofRef.make({ ordinal: scope.ordinal, slot: "scope" }),
                }),
              })
            : r
        ),
      ];
      for (const tokenOwnership of rows)
        assert.strictEqual(validated(ClaimSourceElementPlan.make({ ...plan, tokenOwnership })), false);
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...plan,
            tokenOwnership: [
              ClaimSourceTokenOwnership.cases["public-core"].make({ ...row, owner: 2 }),
              ...A.drop(plan.tokenOwnership, 1),
            ],
          })
        ),
        false
      );
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...plan,
            tokenOwnership: [
              ClaimSourceTokenOwnership.cases["public-core"].make({
                ...row,
                extent: TextAnchor.make({ ...row.extent, quote: "X" }),
              }),
              ...A.drop(plan.tokenOwnership, 1),
            ],
          })
        ),
        false
      );
    })
  );
  it.effect("rejects candidate omissions, duplicated public candidates and opaque-to-introduction promotion", () =>
    Effect.gen(function* () {
      const plan = yield* admitted(independent);
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...plan,
            roles: ClaimClauseRolePlan.make({ ...plan.roles, candidateStates: [] }),
          })
        ),
        false
      );
      const state = O.getOrThrow(A.head(plan.roles.candidateStates));
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...plan,
            roles: ClaimClauseRolePlan.make({ ...plan.roles, candidateStates: [state, ...plan.roles.candidateStates] }),
          })
        ),
        false
      );
      const opaque = yield* admitted("opaque-selector-binary");
      assert.strictEqual(validated(opaque), true);
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...opaque,
            roles: ClaimClauseRolePlan.make({ ...opaque.roles, opaqueSelections: [] }),
          })
        ),
        false
      );
      const promoted = A.map(opaque.roles.candidateStates, (state) =>
        state.kind === "proved" && state.use === "opaque"
          ? ClaimNominalCandidateState.cases.proved.make({ ...state, use: "public" })
          : state
      );
      assert.strictEqual(
        validated(
          ClaimSourceElementPlan.make({
            ...opaque,
            roles: ClaimClauseRolePlan.make({ ...opaque.roles, candidateStates: promoted }),
          })
        ),
        false
      );
    })
  );
});
