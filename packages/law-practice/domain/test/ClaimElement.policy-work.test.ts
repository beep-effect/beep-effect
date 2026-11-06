import { antecedentPolicy, ClaimElementTree, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";

const independent = (claimNumber: number, body: string) =>
  PatentClaim.cases.independent.make({
    claimNumber,
    claimText: `A system comprising ${body}`,
    preamble: "A system",
    transition: "comprising",
    body,
  });
const dependent = (claimNumber: number, claimReferences: A.NonEmptyReadonlyArray<number>, body: string) => {
  const preamble = `The system of claims ${A.join(
    A.map(claimReferences, (number) => `${number}`),
    " or "
  )}`;
  return PatentClaim.cases.dependent.make({
    claimNumber,
    claimReferences,
    claimText: `${preamble} wherein ${body}`,
    preamble,
    transition: "wherein",
    body,
  });
};
const treesOf = Effect.fn("PolicyWorkTest.treesOf")((claims: PatentClaims) =>
  Effect.forEach(claims, (claim) => decomposeClaim(claim, claims))
);

const deepClaims = (referenceCount: number, depth = 64): PatentClaims =>
  A.prepend(
    A.map(A.range(2, depth), (number) => {
      const preamble = `A system of claim ${number - 1}`;
      const body =
        number === depth ? `${A.join(A.replicate("the sensor1", referenceCount), "; ")}.` : `a sensor${number}.`;
      return PatentClaim.cases.dependent.make({
        claimNumber: number,
        claimReferences: [number - 1],
        claimText: `${preamble} wherein ${body}`,
        preamble,
        transition: "wherein",
        body,
      });
    }),
    independent(1, "a sensor1.")
  );

describe("bounded antecedent policy preparation", () => {
  it.effect("retains every unsupported bare warning without wasting candidate scans", () =>
    Effect.gen(function* () {
      const body = `${A.join(
        A.map(A.range(1, 180), (number) => `material${number}`),
        "; "
      )}; the absent sensor.`;
      const claims: PatentClaims = [independent(1, body)];
      const trees = yield* treesOf(claims);
      const findings = antecedentPolicy(trees, claims);
      assert.strictEqual(
        A.countBy(findings, ({ rule }) => rule === "unsupported-determiner"),
        180
      );
      assert.isTrue(
        A.some(
          findings,
          ({ kind, referring }) => kind === "missing-antecedent" && referring.anchor.quote === "the absent sensor"
        )
      );
      assert.isFalse(A.some(findings, ({ rule }) => rule === "chain-work-limit"));
      assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
    })
  );
  it.effect("reuses prepared terms across repeated references on one deep supported chain", () =>
    Effect.gen(function* () {
      const claims = deepClaims(80);
      const trees = yield* treesOf(claims);
      assert.deepStrictEqual(antecedentPolicy(trees, claims), []);
      assert.deepStrictEqual(antecedentPolicy(trees, claims), []);
    })
  );
  it.effect("keeps charging matching scans after a prepared-chain cache hit", () =>
    Effect.gen(function* () {
      const claims = deepClaims(100);
      const trees = yield* treesOf(claims);
      const findings = antecedentPolicy(trees, claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(A.every(findings, ({ rule }) => rule === "chain-work-limit"));
      assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
    })
  );
  it.effect("bounds completeness scans on sparse-term deep-chain policy inputs", () =>
    Effect.gen(function* () {
      for (const fixture of [
        { depth: 100, references: 20, limited: false },
        // A sparse chain still pays for preparing its complete ordered route.
        // A single reference must abstain if preparation itself exceeds the allowance.
        { depth: 120, references: 1, limited: true },
        { depth: 120, references: 60, limited: true },
      ]) {
        const claims = deepClaims(fixture.references, fixture.depth);
        const first = yield* decomposeClaim(A.headNonEmpty(claims), claims);
        const last = yield* decomposeClaim(A.lastNonEmpty(claims), claims);
        // Valid policy inputs can contain decomposed source-owned elements with
        // no recognized terms. They still participate in the completeness scan.
        const middle = yield* Effect.forEach(A.dropRight(A.drop(claims, 1), 1), (claim) =>
          S.decodeEffect(ClaimElementTree)({
            claimNumber: claim.claimNumber,
            producer: "rule",
            elements: [
              {
                path: `${claim.claimNumber}`,
                kind: "preamble-subject",
                anchor: { startChar: 0, endChar: claim.claimText.length, quote: claim.claimText },
                terms: [],
              },
            ],
            edges: [],
          })
        );
        const trees = A.append(A.prepend(middle, first), last);
        const findings = antecedentPolicy(trees, claims);
        if (fixture.limited) {
          assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
          assert.isTrue(A.every(findings, ({ rule }) => rule === "chain-work-limit"));
        } else assert.deepStrictEqual(findings, []);
        assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
      }
    })
  );
  it.effect("abstains on a dense source even when its dependency chain is short, then recovers", () =>
    Effect.gen(function* () {
      // Repeated, separately anchored introductions model dense source-owned
      // input without depending on the rule decomposer's recognition limits.
      // This fixture size exercises bounded preparation, not a public term limit.
      const mentions = 87_376;
      const phrase = "a sensor1";
      const body = `${A.join(A.replicate(phrase, mentions), "; ")}.`;
      const parent = independent(1, body);
      const ordinary = deepClaims(1, 3);
      const ordinaryTrees = yield* treesOf(ordinary);
      const claims = A.prepend(A.drop(ordinary, 1), parent);
      const start = "A system comprising ".length;
      const dense = yield* S.decodeEffect(ClaimElementTree)({
        claimNumber: 1,
        producer: "rule",
        elements: [
          {
            path: "1",
            kind: "limitation",
            anchor: { startChar: start, endChar: parent.claimText.length, quote: body },
            terms: A.makeBy(mentions, (index) => {
              const startChar = start + index * (phrase.length + 2);
              return {
                anchor: { startChar, endChar: startChar + phrase.length, quote: phrase },
                determiner: "a",
                head: "sensor1",
              };
            }),
          },
        ],
        edges: [],
      });
      // Descendant text and ancestry are unchanged by the parent's additional
      // introductions, so retain their ordinary source-owned decomposition.
      const trees = A.prepend(A.drop(ordinaryTrees, 1), dense);
      const findings = antecedentPolicy(trees, claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(
        A.every(findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule === "chain-work-limit")
      );
      assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);

      assert.deepStrictEqual(antecedentPolicy(ordinaryTrees, ordinary), []);
    })
  );
  it.effect("preserves ordered alternative-chain advisories and mixed bare coverage", () =>
    Effect.gen(function* () {
      const claims: PatentClaims = [
        independent(1, "a sensor."),
        independent(2, "a lens."),
        dependent(3, [1, 2], "the sensor; its handle; the lens."),
      ];
      const trees = yield* treesOf(claims);
      const findings = antecedentPolicy(trees, claims);
      assert.deepStrictEqual(
        A.map(findings, ({ kind, rule, referring }) => [kind, rule, referring.anchor.quote]),
        [
          ["antecedent-outside-chain", "outside-chain", "the sensor"],
          ["pattern-not-covered", "unsupported-determiner", "its handle"],
          ["antecedent-outside-chain", "outside-chain", "the lens"],
        ]
      );
      const outside = A.filter(findings, (finding) => finding.kind === "antecedent-outside-chain");
      assert.deepStrictEqual(
        A.map(outside, ({ chain }) => chain),
        [
          [3, 2],
          [3, 1],
        ]
      );
    })
  );
  it.effect("keeps missing-claim and unresolved-parent outcomes ahead of term preparation", () =>
    Effect.gen(function* () {
      const parent = independent(1, "a sensor.");
      const child = dependent(2, [1], "the sensor; its handle.");
      const tree = yield* decomposeClaim(child, [parent, child]);
      const missingClaim = antecedentPolicy([tree], [parent]);
      assert.isTrue(A.every(missingClaim, ({ rule }) => rule === "tree-without-claim"));
      const unresolved = antecedentPolicy([tree], [child]);
      assert.deepStrictEqual(
        A.map(unresolved, ({ rule, referring }) => [rule, referring.anchor.quote]),
        [
          ["chain-unresolvable", "The system"],
          ["chain-unresolvable", "the sensor"],
          ["unsupported-determiner", "its handle"],
        ]
      );
    })
  );
  it.effect("does not leak prepared candidates or exhausted state between invocations", () =>
    Effect.gen(function* () {
      const first: PatentClaims = [independent(1, "a sensor; the sensor.")];
      const second: PatentClaims = [independent(1, "the sensor.")];
      const firstTrees = yield* treesOf(first);
      const secondTrees = yield* treesOf(second);
      assert.deepStrictEqual(antecedentPolicy(firstTrees, first), []);
      const missing = antecedentPolicy(secondTrees, second);
      assert.isTrue(A.some(missing, ({ kind }) => kind === "missing-antecedent"));
      assert.deepStrictEqual(antecedentPolicy(firstTrees, first), []);
    })
  );
  it.effect("does not bypass dense-path limits even when bare terms are present", () =>
    Effect.gen(function* () {
      const claims: PatentClaims = A.prepend(
        A.map(A.range(2, 25), (number) => dependent(number, A.range(1, number - 1), "the sensor; its handle.")),
        independent(1, "a sensor.")
      );
      const last = O.getOrThrow(A.last(claims));
      const tree = yield* decomposeClaim(last, claims);
      const findings = antecedentPolicy([tree], claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(A.every(findings, ({ rule }) => rule === "chain-work-limit"));
    })
  );
});
