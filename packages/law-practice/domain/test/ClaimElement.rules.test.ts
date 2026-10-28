import {
  antecedentPolicy,
  ClaimElementTree,
  claimNumberOfPath,
  decomposeClaim,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { assert, describe } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { failureFixtures, ruleFixtures } from "./claimElementFixtures.ts";
import type { PatentClaims } from "@beep/law-practice-domain/values/PatentDocument";

const segmentSample = Arbitrary.all({
  determiner: Arbitrary.schema(S.Literals(["a", "an", "the", "said", "at least one", "a plurality of"])),
  head: Arbitrary.schema(S.Literals(["sensor", "first sensor", "sensors", "lens", "housing"])),
  tail: Arbitrary.schema(S.Literals(["", " coupled to the sensor", " comprising:", " mounted in the housing"])),
});

const generatedClaim = Arbitrary.map(
  Arbitrary.array(segmentSample, { minLength: 1, maxLength: 6 }),
  (segments): PatentClaim => {
    const body = `${A.join(
      A.map(segments, ({ determiner, head, tail }) => `${determiner} ${head}${tail}`),
      "; "
    )}.`;
    return PatentClaim.cases.independent.make({
      claimNumber: 1,
      claimText: `A system comprising: ${body}`,
      preamble: "A system",
      transition: "comprising",
      body,
    });
  }
);

describe("ClaimElement rules", () => {
  it.effect("preserves unsupported possessives and reports explicit coverage findings", () =>
    Effect.gen(function* () {
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: "A device comprising a housing; its forward part; their tabs.",
        preamble: "A device",
        transition: "comprising",
        body: "a housing; its forward part; their tabs.",
      });
      const claims: PatentClaims = [claim];
      const tree = yield* decomposeClaim(claim, claims);
      const findings = antecedentPolicy([tree], claims);
      assert.deepStrictEqual(
        A.map(findings, (finding) => [finding.kind, finding.rule, finding.referring.anchor.quote]),
        [
          ["pattern-not-covered", "unsupported-determiner", "its forward part"],
          ["pattern-not-covered", "unsupported-determiner", "their tabs"],
        ]
      );
    })
  );

  it.effect("evaluates ordinary claim sets through one hundred multi-parent claims without budget abstention", () =>
    Effect.gen(function* () {
      const body = "a sensor; a controller; a housing; a lens; the sensor; the controller; the housing; the lens.";
      for (const claimCount of [10, 45, 100]) {
        const claims = A.map(
          A.range(1, claimCount),
          (claimNumber): PatentClaim =>
            claimNumber <= 4
              ? PatentClaim.cases.independent.make({
                  claimNumber,
                  claimText: `A system comprising: ${body}`,
                  preamble: "A system",
                  transition: "comprising",
                  body,
                })
              : PatentClaim.cases.dependent.make({
                  claimNumber,
                  claimReferences: [1, 2, 3, 4],
                  claimText: `The system of claims 1 through 4 wherein ${body}`,
                  preamble: "The system of claims 1 through 4",
                  transition: "wherein",
                  body,
                })
        );
        const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
        const findings = antecedentPolicy(trees, claims);
        assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
        assert.isTrue(A.every(findings, ({ rule }) => rule !== "chain-work-limit"));
        assert.isTrue(A.some(findings, ({ kind }) => kind === "ambiguous-antecedent"));
        assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
      }
    })
  );

  it.effect("abstains explicitly for a dense dependency DAG instead of expanding every path", () =>
    Effect.gen(function* () {
      const first = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: "A system comprising a sensor.",
        preamble: "A system",
        transition: "comprising",
        body: "a sensor.",
      });
      const claims = A.prepend(
        A.map(A.range(2, 25), (claimNumber) =>
          PatentClaim.cases.dependent.make({
            claimNumber,
            claimReferences: A.range(1, claimNumber - 1),
            claimText: `The system of claims 1 through ${claimNumber - 1} wherein the sensor operates.`,
            preamble: `The system of claims 1 through ${claimNumber - 1}`,
            transition: "wherein",
            body: "the sensor operates.",
          })
        ),
        first
      );
      const tree = yield* decomposeClaim(A.lastNonEmpty(claims), claims);
      const findings = antecedentPolicy([tree], claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(
        A.every(findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule === "chain-work-limit")
      );
      assert.deepStrictEqual(antecedentPolicy([tree], claims), findings);
    })
  );

  for (const fixture of [
    { label: "missing parent path copies", parentCount: 128, includeParents: false },
    { label: "resolved parent path copies", parentCount: 128, includeParents: true },
    { label: "accumulated advisory copies", parentCount: 90, includeParents: false },
  ]) {
    it.effect(`abstains when ${fixture.label} exhaust the shared work budget`, () =>
      Effect.gen(function* () {
        const evaluate = Effect.fn("ClaimElementRulesTest.evaluateWideDependencies")(function* (parentCount: number) {
          const parents = A.map(A.range(1, parentCount), (claimNumber) =>
            PatentClaim.cases.independent.make({
              claimNumber,
              claimText: "A system comprising a sensor.",
              preamble: "A system",
              transition: "comprising",
              body: "a sensor.",
            })
          );
          const claim = PatentClaim.cases.dependent.make({
            claimNumber: parentCount + 1,
            claimReferences: A.range(1, parentCount),
            claimText: `The system of claims 1 through ${parentCount} wherein the sensor operates.`,
            preamble: `The system of claims 1 through ${parentCount}`,
            transition: "wherein",
            body: "the sensor operates.",
          });
          const context = A.append(parents, claim);
          const tree = yield* decomposeClaim(claim, context);
          // A partial policy input is legitimate: unavailable parents must
          // produce semantic advisories until bounded enumeration is exhausted.
          const claims: PatentClaims = fixture.includeParents ? context : [claim];
          return { findings: antecedentPolicy([tree], claims), tree, claims };
        });
        const control = yield* evaluate(2);
        assert.isTrue(A.isReadonlyArrayNonEmpty(control.findings));
        assert.isTrue(
          A.every(control.findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule !== "chain-work-limit")
        );
        const bounded = yield* evaluate(fixture.parentCount);
        assert.isTrue(A.isReadonlyArrayNonEmpty(bounded.findings));
        assert.isTrue(
          A.every(bounded.findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule === "chain-work-limit")
        );
        // Repeating the call must allocate a fresh budget and produce the same
        // abstention, with no partial chain-specific advisories leaking out.
        assert.deepStrictEqual(antecedentPolicy([bounded.tree], bounded.claims), bounded.findings);
      })
    );
  }

  it.effect("caps dependency depth while preserving a resolvable linear-chain control", () =>
    Effect.gen(function* () {
      const first = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: "A system comprising a sensor; and a controller coupled to the sensor.",
        preamble: "A system",
        transition: "comprising",
        body: "a sensor; and a controller coupled to the sensor.",
      });
      const claims = A.prepend(
        A.map(A.range(2, 129), (claimNumber) =>
          PatentClaim.cases.dependent.make({
            claimNumber,
            claimReferences: [claimNumber - 1],
            claimText: `A system of claim ${claimNumber - 1} wherein a sensor; and a controller coupled to the sensor.`,
            preamble: `A system of claim ${claimNumber - 1}`,
            transition: "wherein",
            body: "a sensor; and a controller coupled to the sensor.",
          })
        ),
        first
      );
      const controlClaim = O.getOrThrow(A.findFirst(claims, ({ claimNumber }) => claimNumber === 64));
      const control = yield* decomposeClaim(controlClaim, claims);
      assert.deepStrictEqual(antecedentPolicy([control], claims), []);
      const deep = yield* decomposeClaim(A.lastNonEmpty(claims), claims);
      const findings = antecedentPolicy([deep], claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(
        A.every(findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule === "chain-work-limit")
      );
    })
  );

  it.effect("caps evaluation work across large inputs and resets the budget for a new invocation", () =>
    Effect.gen(function* () {
      const body = `${A.join(
        A.map(
          A.range(1, 32),
          (number) => `a sensor${number}; and a controller${number} coupled to the sensor${number}`
        ),
        "; "
      )}.`;
      const claims = A.map(A.range(1, 64), (claimNumber) =>
        PatentClaim.cases.independent.make({
          claimNumber,
          claimText: `A system comprising ${body}`,
          preamble: "A system",
          transition: "comprising",
          body,
        })
      );
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      for (const tree of trees) assert.deepStrictEqual(antecedentPolicy([tree], claims), []);
      const findings = antecedentPolicy(trees, claims);
      assert.isTrue(A.isReadonlyArrayNonEmpty(findings));
      assert.isTrue(
        A.every(findings, ({ kind, rule }) => kind === "pattern-not-covered" && rule === "chain-work-limit")
      );
      assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
      for (const tree of trees) assert.deepStrictEqual(antecedentPolicy([tree], claims), []);
    })
  );

  it.effect("abstains before building indexes when the complete index reservation exceeds the ceiling", () =>
    Effect.gen(function* () {
      const body = `${A.join(A.replicate("a sensor", 131_072), ";")} the sensor`;
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: body,
        preamble: "a sensor",
        transition: "comprising",
        body,
      });
      const tree = yield* S.decodeEffect(ClaimElementTree)({
        claimNumber: 1,
        producer: "rule",
        elements: [
          {
            path: "1",
            kind: "preamble-subject",
            anchor: { startChar: 0, endChar: body.length, quote: body },
            terms: A.append(
              A.map(A.range(0, 131_071), (index) => ({
                anchor: { startChar: index * 9, endChar: index * 9 + 8, quote: "a sensor" },
                determiner: "a",
                head: "sensor",
              })),
              {
                anchor: { startChar: 131_072 * 9, endChar: body.length, quote: "the sensor" },
                determiner: "the",
                head: "sensor",
              }
            ),
          },
        ],
        edges: [],
      });
      const findings = antecedentPolicy([tree], [claim]);
      assert.deepStrictEqual(
        A.map(findings, ({ rule }) => rule),
        ["chain-work-limit"]
      );
      assert.deepStrictEqual(antecedentPolicy([tree], [claim]), findings);
    })
  );

  it.effect("bounds global outside-chain candidate scans while preserving their first-candidate order", () =>
    Effect.gen(function* () {
      const introducedBody = `${A.join(A.replicate("a sensor", 50), "; ")}.`;
      const referringBody = `${A.join(A.replicate("the sensor", 32), "; ")}.`;
      const claims = A.append(
        A.map(A.range(1, 100), (claimNumber) =>
          PatentClaim.cases.independent.make({
            claimNumber,
            claimText: `A system comprising ${introducedBody}`,
            preamble: "A system",
            transition: "comprising",
            body: introducedBody,
          })
        ),
        PatentClaim.cases.independent.make({
          claimNumber: 101,
          claimText: `A system comprising ${referringBody}`,
          preamble: "A system",
          transition: "comprising",
          body: referringBody,
        })
      );
      const trees = yield* Effect.forEach(claims, (claim) => decomposeClaim(claim, claims));
      const findings = antecedentPolicy(trees, claims);
      const outside = A.filter(findings, (finding) => finding.kind === "antecedent-outside-chain");
      assert.isTrue(A.isReadonlyArrayNonEmpty(outside));
      const firstTerm = O.getOrThrow(
        A.findFirst(
          A.flatMap(A.headNonEmpty(trees).elements, (element) => element.terms),
          (term) => term.head === "sensor"
        )
      );
      for (const finding of outside) assert.deepStrictEqual(finding.introducing.anchor, firstTerm.anchor);
      assert.isTrue(A.some(findings, ({ rule }) => rule === "chain-work-limit"));
      assert.deepStrictEqual(antecedentPolicy(trees, claims), findings);
    })
  );

  for (const fixture of ruleFixtures) {
    it.effect(`fixture ${fixture.id}: ${fixture.rule}`, () =>
      Effect.gen(function* () {
        const trees = yield* Effect.forEach(fixture.trees, (expected) =>
          Effect.gen(function* () {
            const claim = O.getOrThrow(
              A.findFirst(fixture.context, ({ claimNumber }) => claimNumber === expected.claimNumber)
            );
            const actual = yield* decomposeClaim(claim, fixture.context);
            assert.isTrue(S.is(ClaimElementTree)(expected));
            // Preserve exact legacy assertions on their original surface. New functional
            // classifications, bare mentions and ancestor edges have separate exact tests.
            const localTerms = A.flatMap(actual.elements, (element) =>
              A.map(element.terms, (term) => ({ path: element.path, term }))
            );
            const legacy = yield* S.decodeEffect(ClaimElementTree)({
              ...actual,
              elements: A.map(actual.elements, (element) => {
                const prior = A.findFirst(expected.elements, (candidate) => candidate.path === element.path);
                return {
                  ...element,
                  kind:
                    element.kind === "functional-relation"
                      ? O.match(prior, { onNone: () => element.kind, onSome: (value) => value.kind })
                      : element.kind,
                  terms: A.filter(
                    element.terms,
                    (term) =>
                      term.determiner !== "bare" ||
                      O.exists(prior, (value) =>
                        A.some(
                          value.terms,
                          (candidate) =>
                            candidate.anchor.startChar === term.anchor.startChar && candidate.determiner === "bare"
                        )
                      )
                  ),
                };
              }),
              edges: A.filter(
                actual.edges,
                (edge) =>
                  edge.kind !== "functional" &&
                  (edge.kind !== "antecedent" ||
                    (claimNumberOfPath(edge.introducing.path) === actual.claimNumber &&
                      A.some(
                        localTerms,
                        (referring) =>
                          referring.path === edge.referring.path &&
                          referring.term.anchor.startChar === edge.referring.anchor.startChar &&
                          A.some(
                            localTerms,
                            (introducing) =>
                              introducing.path === edge.introducing.path &&
                              introducing.term.anchor.startChar === edge.introducing.anchor.startChar &&
                              introducing.term.head === referring.term.head
                          )
                      )))
              ),
            });
            assert.deepStrictEqual(legacy, expected);
            assert.isTrue(Equal.equals(legacy, expected));
            for (const element of actual.elements) {
              assert.strictEqual(
                Str.slice(element.anchor.startChar, element.anchor.endChar)(claim.claimText),
                element.anchor.quote
              );
              for (const term of element.terms)
                assert.strictEqual(
                  Str.slice(term.anchor.startChar, term.anchor.endChar)(claim.claimText),
                  term.anchor.quote
                );
            }
            return actual;
          })
        );
        assert.deepStrictEqual(antecedentPolicy(trees, fixture.claims), fixture.findings);
      })
    );
  }

  for (const fixture of failureFixtures) {
    it.effect(`fixture ${fixture.id}: ${fixture.rule}`, () =>
      Effect.gen(function* () {
        const error = yield* Effect.flip(decomposeClaim(fixture.claim, fixture.claims));
        assert.strictEqual(error._tag, "ClaimDecompositionError");
        assert.strictEqual(error.reason, fixture.reason);
        assert.strictEqual(error.claimNumber, fixture.claim.claimNumber);
      })
    );
  }

  it.effect("participle-boundary keeps -eed and short words in the head", () =>
    Effect.gen(function* () {
      const body = "a high speed sensor; and a bed frame coupled to the high speed sensor.";
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: `A system comprising: ${body}`,
        preamble: "A system",
        transition: "comprising",
        body,
      });
      const tree = yield* decomposeClaim(claim, [claim]);
      const heads = A.flatMap(tree.elements, ({ terms }) => A.map(terms, ({ head }) => head));
      assert.deepStrictEqual(heads, ["system", "high speed sensor", "bed frame", "high speed sensor"]);
      assert.deepStrictEqual(antecedentPolicy([tree], [claim]), []);
    })
  );

  it.effect.prop(
    "decomposes and checks the same claim identically twice",
    { claim: generatedClaim },
    ({ claim }) =>
      Effect.gen(function* () {
        const first = yield* decomposeClaim(claim, [claim]);
        const second = yield* decomposeClaim(claim, [claim]);
        assert.isTrue(Equal.equals(first, second));
        assert.deepStrictEqual(antecedentPolicy([first], [claim]), antecedentPolicy([second], [claim]));
      }),
    { arbitrary: fcRuns(50) }
  );
});
