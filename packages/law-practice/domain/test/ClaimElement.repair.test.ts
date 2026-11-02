import { decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizePatentClaims, PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";

const independent = (body: string) =>
  PatentClaim.cases.independent.make({
    claimNumber: 1,
    preamble: "A tester",
    transition: "comprising",
    body,
    claimText: `A tester comprising ${body}`,
  });

describe("source-preserving decomposition repair", () => {
  it.effect("keeps complete participial and long noun phrases and separates temporal language", () =>
    Effect.gen(function* () {
      const claim = independent(
        "an index detecting unit; a first scanning condition; a high resolution wide field optical imaging sensor; the metal interface part before deformation."
      );
      const tree = yield* decomposeClaim(claim, [claim]);
      const terms = A.flatMap(tree.elements, (element) => element.terms);
      assert.deepStrictEqual(
        A.map(terms, (term) => term.head),
        [
          "tester",
          "index detecting unit",
          "first scanning condition",
          "high resolution wide field optical imaging sensor",
          "metal interface part",
          "deformation",
        ]
      );
      for (const term of terms)
        assert.strictEqual(Str.slice(term.anchor.startChar, term.anchor.endChar)(claim.claimText), term.anchor.quote);
    })
  );

  it.effect("emits ordered functional parts that exactly reconstruct the original relation", () =>
    Effect.gen(function* () {
      const claim = independent("an optical sensing unit configured to detect light from a target.");
      const tree = yield* decomposeClaim(claim, [claim]);
      const relation = yield* Effect.fromOption(
        A.findFirst(tree.elements, (element) => element.kind === "functional-relation")
      );
      assert.deepStrictEqual(
        A.map(relation.terms, (term) => [term.anchor.quote, term.determiner, term.head]),
        [
          ["an optical sensing unit", "an", "optical sensing unit"],
          ["light", "bare", "light"],
          ["a target", "a", "target"],
        ]
      );
      const edge = yield* Effect.fromOption(A.findFirst(tree.edges, (edge) => edge.kind === "functional"));
      if (edge.kind !== "functional") return yield* Effect.die("Expected functional edge");
      assert.deepStrictEqual(
        A.map(edge.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote)),
        ["an optical sensing unit", " configured to detect ", "light", " from ", "a target"]
      );
      assert.strictEqual(
        A.join(
          A.map(edge.parts, (part) => (part.kind === "text" ? part.anchor.quote : part.term.anchor.quote)),
          ""
        ),
        relation.anchor.quote
      );
    })
  );

  it.effect("links a dependent term to its actual ancestor and ignores an unrelated introduction", () =>
    Effect.gen(function* () {
      const parent = independent("an optical sensing unit.");
      const unrelated = PatentClaim.cases.independent.make({ ...parent, claimNumber: 2 });
      const child = PatentClaim.cases.dependent.make({
        claimNumber: 3,
        claimReferences: [1],
        preamble: "The tester of claim 1",
        transition: "wherein",
        body: "the optical sensing unit is connected to a relay.",
        claimText: "The tester of claim 1 wherein the optical sensing unit is connected to a relay.",
      });
      const tree = yield* decomposeClaim(child, [unrelated, child, parent]);
      const links = A.filter(tree.edges, (edge) => edge.kind === "antecedent");
      assert.isTrue(
        A.some(
          links,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the optical sensing unit" &&
            edge.introducing.path === "1.a" &&
            edge.introducing.anchor.quote === "an optical sensing unit"
        )
      );
      assert.isFalse(A.some(links, (edge) => edge.kind === "antecedent" && Str.startsWith("2")(edge.introducing.path)));
    })
  );

  it.effect("accepts surface transition variants and uppercase wording without changing claim text", () =>
    Effect.gen(function* () {
      for (const surface of [
        "Wherein",
        "characterized in that",
        "characterised in that",
        "characterized by the fact that",
        "where",
        "in which",
      ]) {
        const text = `A tester ${surface} a sensor is connected to a relay.`;
        const claims = yield* normalizePatentClaims([["1", text]]);
        const claim = O.getOrThrow(A.head(claims));
        assert.strictEqual(claim.claimText, text);
        const tree = yield* decomposeClaim(claim, claims);
        assert.strictEqual(A.last(tree.elements).pipe(O.getOrThrow).anchor.quote, "a sensor is connected to a relay");
      }
    })
  );

  it.effect("does not invent an antecedent available on only one alternative dependency route", () =>
    Effect.gen(function* () {
      const first = independent("a sensor.");
      const other = PatentClaim.cases.independent.make({ ...independent("a relay."), claimNumber: 2 });
      const child = PatentClaim.cases.dependent.make({
        claimNumber: 3,
        claimReferences: [1, 2],
        preamble: "The tester of claim 1 or 2",
        transition: "wherein",
        body: "the sensor is connected to a relay.",
        claimText: "The tester of claim 1 or 2 wherein the sensor is connected to a relay.",
      });
      const tree = yield* decomposeClaim(child, [first, other, child]);
      assert.isFalse(
        A.some(tree.edges, (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the sensor")
      );
    })
  );

  it.effect("links repeated indefinite dependent subjects and unique one-modifier introductions", () =>
    Effect.gen(function* () {
      const parent = independent("an optical sensing unit.");
      const child = PatentClaim.cases.dependent.make({
        claimNumber: 2,
        claimReferences: [1],
        preamble: "A tester of claim 1",
        transition: "wherein",
        body: "the sensing unit is connected to a relay.",
        claimText: "A tester of claim 1 wherein the sensing unit is connected to a relay.",
      });
      const tree = yield* decomposeClaim(child, [parent, child]);
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" && edge.referring.anchor.quote === "A tester" && edge.introducing.path === "1"
        )
      );
      assert.isTrue(
        A.some(
          tree.edges,
          (edge) =>
            edge.kind === "antecedent" &&
            edge.referring.anchor.quote === "the sensing unit" &&
            edge.introducing.anchor.quote === "an optical sensing unit"
        )
      );
      const ambiguous = independent("an optical sensing unit; an acoustic sensing unit.");
      const uncertain = yield* decomposeClaim(child, [ambiguous, child]);
      assert.isFalse(
        A.some(
          uncertain.edges,
          (edge) => edge.kind === "antecedent" && edge.referring.anchor.quote === "the sensing unit"
        )
      );
    })
  );

  it.effect("rejects fabricated transition gaps and malformed self-dependencies", () =>
    Effect.gen(function* () {
      const original = independent("a sensor.");
      const error = yield* Effect.flip(
        decomposeClaim(PatentClaim.cases.independent.make({ ...original, claimText: "A tester XXX a sensor." }), [
          original,
        ])
      );
      assert.strictEqual(error.reason, "unsupported-claim-text");
      const invalid = yield* Effect.flip(
        normalizePatentClaims([["1", "The tester of claim 1 wherein a sensor is connected to a relay."]])
      );
      assert.strictEqual(invalid.reason, "invalid-claim");
    })
  );
});
