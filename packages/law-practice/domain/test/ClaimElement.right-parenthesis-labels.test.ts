import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimElement,
  ClaimElementPath,
  ClaimElementTree,
  ClaimFiniteSourceProof,
  ClaimInputCollection,
  ClaimInputInspectionReport,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceElementPlan,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  ClaimTerm,
  compileClaimClauseRoles,
  decomposePreparedClaimRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";

// Explicit source-only controls; this map is not production lexical evidence.
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["comprising", ["VERB", "comprise"]],
  ["having", ["VERB", "have"]],
  ["and", ["CCONJ", "and"]],
  ["or", ["CCONJ", "or"]],
  ["is", ["AUX", "be"]],
  ["mounted", ["VERB", "mount"]],
  ["with", ["ADP", "with"]],
  ["each", ["DET", "each"]],
  ["of", ["ADP", "of"]],
  ["placing", ["VERB", "place"]],
  ["forming", ["VERB", "form"]]
);
const inputOf = (text: string) =>
  ClaimInputCollection.make({
    sourceKey: "right-parenthesis-source-control",
    records: [
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: 1,
        numberText: O.some("1"),
        sourceText: text,
        canonicalText: text,
      }),
    ],
  });
const evidenceFor = (text: string, joined = false) =>
  ClaimLexicalEvidence.cases.aligned.make({
    sourceKey: "right-parenthesis-source-control",
    sourceOrdinal: 1,
    qualifiedText: text,
    provider: "explicit-source-only",
    assetDigest: "no-provider-executed",
    tokens: A.map(
      A.fromIterable(
        Str.matchAll(joined ? /[a-z][.)](?=\s)|[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu : /[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(
          text
        )
      ),
      (match) => {
        const lower = Str.toLowerCase(match[0]);
        const [pos, lemma] = O.getOrElse(HashMap.get(lexical, lower), () => [
          O.isSome(Str.match(/^[\p{L}\p{N}]/u)(lower)) ? "NOUN" : "PUNCT",
          lower,
        ]);
        const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
        return ClaimLexicalToken.make({
          anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
          pos,
          lemma: O.some(lemma),
        });
      }
    ),
  });
const resultOf = Effect.fn("RightParenthesisTest.resultOf")(function* (text: string, joined = false) {
  const prepared = yield* prepareClaimInspection(inputOf(text));
  return yield* decomposePreparedClaimRoles(prepared, [evidenceFor(text, joined)]);
});
const planOf = Effect.fn("RightParenthesisTest.planOf")(function* (text: string, joined = false) {
  const result = yield* resultOf(text, joined);
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});

describe("source-proved right-parenthesis list labels", () => {
  it.effect("admits a complete composition list and retains its exact source labels", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a) a panel; b) a bracket; and c) a plate.");
      assert.deepStrictEqual(
        A.flatMap(plan.declarations, (d) => A.map(d.items, (i) => i.label.quote)),
        ["a)", "b)", "c)"]
      );
    })
  );
  it.effect("admits labelled procedure children under the existing steps-of header", () =>
    Effect.gen(function* () {
      const plan = yield* planOf(
        "A method comprising the steps of: a) placing a panel; b) forming a port; and c) placing a plate."
      );
      assert.deepStrictEqual(
        A.flatMap(plan.declarations, (d) => A.map(d.items, (i) => i.label.quote)),
        ["a)", "b)", "c)"]
      );
    })
  );
  for (const joined of [false, true]) {
    it.effect(`retains exact metadata and lower-rank references for ${joined ? "combined" : "split"} labels`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf("A system comprising: a) a panel; b) a bracket.", joined);
        const proofs = A.filter(plan.roles.certificates, (p) => p.kind === "label-boundary");
        assert.strictEqual(proofs.length, 2);
        assert.deepStrictEqual(
          A.map(proofs, (p) => [p.rank, p.item, p.markers.length]),
          [
            [-2, 0, 2],
            [-2, 1, 2],
          ]
        );
        for (const proof of proofs) {
          for (const ref of [
            proof.token,
            proof.scope,
            proof.governor,
            proof.colon,
            ...A.flatMap(proof.markers, (m) => [m.start, m.close]),
          ]) {
            const target = O.getOrThrow(A.get(plan.roles.certificates, ref.ordinal - 1));
            assert.strictEqual(target.rank, -3);
            assert.isBelow(target.ordinal, proof.ordinal);
          }
        }
        assert.deepStrictEqual(
          A.map(plan.nominals, (n) => n.core.quote),
          ["A system", "a panel", "a bracket"]
        );
        assert.isTrue(validateClaimSourceOwnership(plan, () => true));
      })
    );
  }
  for (const source of [
    "A method comprising the steps of: a) a panel; b) a bracket.",
    "A system comprising: x) a panel; b) a bracket.",
    "A system comprising: a) a panel; c) a bracket.",
    "A system comprising: a) a panel; b) a bracket; b) a plate.",
    "A system comprising: b) a panel; a) a bracket.",
    "A system comprising: a) a panel.",
    "A system comprising a) a panel; b) a bracket.",
    "A system comprising: a ) a panel; b) a bracket.",
    "A system comprising: a)a panel; b) a bracket.",
    "A system comprising: a) a panel, b) a bracket.",
    "A system comprising: a) a panel and b) a bracket.",
    "A system comprising: a) a panel; (b) a bracket.",
    "A system comprising: a) a panel; b. a bracket.",
    "A system comprising: i) a panel; ii) a bracket.",
    "A system comprising: a) a panel; b) a bracket including: i) a port; ii) a plate.",
    "A system comprising: a) a panel referring to step b); b) a bracket.",
    "A system comprising: (a) a panel; b) a bracket.",
    'A system comprising: "a) a panel; b) a bracket".',
    "A system comprising: a) ; b) a bracket.",
    "A system comprising: a) a panel; b) .",
    "A system comprising: a) a panel; b) a bracket ].",
    "A system comprising: a) a panel; b) a bracket (x].",
    "A system comprising: ) a panel; b) a bracket.",
  ])
    it.effect(`declines unproved punctuation: ${source}`, () =>
      Effect.gen(function* () {
        const result = yield* resultOf(source);
        assert.strictEqual(result.plans.length, 0);
      })
    );
  for (const source of [
    "A system comprising: (a) a panel; (b) a bracket.",
    "A system comprising: a. a panel; b. a bracket.",
    "A method comprising the steps of: placing a panel; forming a port.",
  ])
    it.effect(`retains the existing source path: ${source}`, () =>
      Effect.gen(function* () {
        const plan = yield* planOf(source);
        assert.strictEqual(A.filter(plan.roles.certificates, (p) => p.kind === "label-boundary").length, 0);
      })
    );

  it.effect("constructs the complete raw sequence witness without equal-rank edges", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a) a panel; b) a bracket.");
      const ref = (ordinal: number, slot: "token" | "scope") =>
        ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(ordinal), slot });
      const common = {
        scope: ref(3, "scope"),
        governor: ref(6, "token"),
        colon: ref(7, "token"),
        markers: [
          { start: ref(8, "token"), close: ref(9, "token") },
          { start: ref(13, "token"), close: ref(14, "token") },
        ],
      };
      assert.deepStrictEqual(
        A.filter(plan.roles.certificates, (p) => p.kind === "label-boundary"),
        [
          ClaimFiniteSourceProof.cases["label-boundary"].make({
            ordinal: ClaimSourceProofOrdinal.make(18),
            ...common,
            token: ref(9, "token"),
            item: 0,
          }),
          ClaimFiniteSourceProof.cases["label-boundary"].make({
            ordinal: ClaimSourceProofOrdinal.make(19),
            ...common,
            token: ref(14, "token"),
            item: 1,
          }),
        ]
      );
      assert.deepStrictEqual(
        A.map(plan.elements, (e) => ({
          ordinal: e.ordinal,
          parent: e.parent,
          kind: e.kind,
          extent: e.extent.quote,
          nominals: A.map(e.nominals, (n) => n.anchor.quote),
        })),
        [
          { ordinal: 1, parent: O.none(), kind: "preamble-subject", extent: "A system", nominals: ["A system"] },
          { ordinal: 2, parent: O.some(1), kind: "limitation", extent: "a panel", nominals: ["a panel"] },
          { ordinal: 3, parent: O.some(1), kind: "limitation", extent: "a bracket", nominals: ["a bracket"] },
        ]
      );
    })
  );
  it.effect("rejects every changed marker, owner, scope and lower-rank reference in both validators", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a) a panel; b) a bracket.");
      const proof = O.getOrThrow(A.findFirst(plan.roles.certificates, (p) => p.kind === "label-boundary"));
      if (proof.kind !== "label-boundary") throw new Error("expected label witness");
      const cyclic = ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "boundary" });
      const marker = O.getOrThrow(A.head(proof.markers));
      const variants = [
        { ...proof, token: cyclic },
        { ...proof, scope: proof.governor },
        { ...proof, governor: proof.colon },
        { ...proof, colon: proof.governor },
        { ...proof, item: -1 },
        { ...proof, item: 1 },
        { ...proof, markers: [] },
        { ...proof, markers: A.reverse(proof.markers) },
        { ...proof, markers: [{ ...marker, start: cyclic }, ...A.drop(proof.markers, 1)] },
        { ...proof, markers: [{ ...marker, close: proof.governor }, ...A.drop(proof.markers, 1)] },
        { ...proof, hiddenLowerRef: cyclic },
      ];
      const claim = O.getOrThrow(plan.roles.qualifiedClaim);
      const original = O.getOrThrow(plan.roles.originalLexicalInput);
      for (const variant of variants) {
        const certificates = A.map(plan.roles.certificates, (p) => (p.ordinal === proof.ordinal ? variant : p));
        assert.isFalse(
          validateClaimFiniteSourceProofsFromOriginalInput(claim, original, certificates, plan.roles.proofs, () => true)
        );
        const changed = ClaimSourceElementPlan.make({
          ...plan,
          roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates }),
        });
        if (!("hiddenLowerRef" in variant)) assert.isFalse(validateClaimSourceOwnership(changed, () => true));
      }
    })
  );
  it.effect("rejects orphan declarations, changed source labels and changed child membership", () =>
    Effect.gen(function* () {
      const plan = yield* planOf("A system comprising: a) a panel; b) a bracket.");
      const declaration = O.getOrThrow(A.head(plan.declarationPlans));
      if (declaration.kind !== "labelled") throw new Error("expected labelled declaration");
      const first = O.getOrThrow(A.head(declaration.items));
      const variants = [
        ClaimSourceElementPlan.make({ ...plan, declarations: [], declarationPlans: [] }),
        ClaimSourceElementPlan.make({ ...plan, declarationPlans: [{ ...declaration, owner: 2 }] }),
        ClaimSourceElementPlan.make({
          ...plan,
          declarationPlans: [{ ...declaration, items: [{ ...first, child: 3 }, ...A.drop(declaration.items, 1)] }],
        }),
        ClaimSourceElementPlan.make({
          ...plan,
          declarationPlans: [
            {
              ...declaration,
              items: [
                { ...first, label: TextAnchor.make({ ...first.label, quote: "b)" }) },
                ...A.drop(declaration.items, 1),
              ],
            },
          ],
        }),
        ClaimSourceElementPlan.make({
          ...plan,
          roles: ClaimClauseRolePlan.make({ ...plan.roles, originalLexicalInput: O.none() }),
        }),
      ];
      for (const variant of variants) assert.isFalse(validateClaimSourceOwnership(variant, () => true));
    })
  );
  it.effect("stops at every failed validator debit and retains the exact constructor boundary", () =>
    Effect.gen(function* () {
      for (const joined of [false, true]) {
        const plan = yield* planOf("A method comprising the steps of: a) placing a panel; b) forming a port.", joined);
        const claim = O.getOrThrow(plan.roles.qualifiedClaim);
        const original = O.getOrThrow(plan.roles.originalLexicalInput);
        if (original.status !== "aligned") throw new Error("expected aligned evidence");
        const compiled = O.getOrThrow(compileClaimClauseRoles(claim, original));
        const required = 262_144 - compiled.remainingWork;
        assertNone(
          compileClaimClauseRoles(
            claim,
            ClaimLexicalEvidence.cases.aligned.make({ ...original, lexicalWorkConsumed: 262_144 - required + 1 })
          )
        );
        const exact = O.getOrThrow(
          compileClaimClauseRoles(
            claim,
            ClaimLexicalEvidence.cases.aligned.make({ ...original, lexicalWorkConsumed: 262_144 - required })
          )
        );
        assert.strictEqual(exact.remainingWork, 0);
        assert.deepStrictEqual(exact.certificates, compiled.certificates);
        for (const validate of [
          (charge: (n: number) => boolean) => validateClaimSourceOwnership(plan, charge),
          (charge: (n: number) => boolean) =>
            validateClaimFiniteSourceProofsFromOriginalInput(
              claim,
              original,
              plan.roles.certificates,
              plan.roles.proofs,
              charge
            ),
        ]) {
          let calls = 0;
          assert.isTrue(
            validate(() => {
              calls++;
              return true;
            })
          );
          for (let prefix = 0; prefix < calls; prefix++) {
            let seen = 0;
            let failed = false;
            let after = 0;
            let firstFailure = "";
            let laterFailure = "";
            const accepted = validate(() => {
              if (failed) {
                after++;
                laterFailure = new Error().stack ?? "";
                return false;
              }
              if (seen++ === prefix) {
                failed = true;
                firstFailure = new Error().stack ?? "";
                return false;
              }
              return true;
            });
            assert.isFalse(accepted, `accepted failed prefix ${prefix}`);
            assert.strictEqual(after, 0, `charge after failed prefix ${prefix}: ${firstFailure}: ${laterFailure}`);
          }
        }
      }
    })
  );
  it.effect("delivers the complete pure inspection report without metadata terms", () =>
    Effect.gen(function* () {
      const text = "A system comprising: a) a panel; b) a bracket.";
      const input = inputOf(text);
      const prepared = yield* prepareClaimInspection(input);
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      if (qualification.status !== "context-ready") throw new Error("expected qualified source");
      const report = yield* inspectPreparedClaimRoles(prepared, [evidenceFor(text)]);
      const anchorOf = (quote: string) => {
        const startChar = O.getOrThrow(Str.indexOf(quote)(text));
        return TextAnchor.make({ startChar, endChar: startChar + quote.length, quote });
      };
      const root = ClaimElementPath.make("1");
      const left = ClaimElementPath.make("1.a");
      const right = ClaimElementPath.make("1.b");
      const tree = ClaimElementTree.make({
        claimNumber: 1,
        producer: "rule",
        elements: [
          ClaimElement.make({
            path: root,
            kind: "preamble-subject",
            anchor: anchorOf("A system"),
            terms: [ClaimTerm.make({ anchor: anchorOf("A system"), determiner: "a", head: "system" })],
          }),
          ClaimElement.make({
            path: left,
            kind: "limitation",
            anchor: anchorOf("a panel"),
            terms: [ClaimTerm.make({ anchor: anchorOf("a panel"), determiner: "a", head: "panel" })],
          }),
          ClaimElement.make({
            path: right,
            kind: "limitation",
            anchor: anchorOf("a bracket"),
            terms: [ClaimTerm.make({ anchor: anchorOf("a bracket"), determiner: "a", head: "bracket" })],
          }),
        ],
        edges: [
          { kind: "part-of", child: left, parent: root },
          { kind: "part-of", child: right, parent: root },
        ],
      });
      assert.deepStrictEqual(
        report,
        ClaimInputInspectionReport.make({
          input,
          indexStatus: "complete",
          records: [{ status: "complete", decomposition: { status: "decomposed", qualification, tree }, findings: [] }],
        })
      );
    })
  );
  it.effect("admits combined-token procedural labels through the same witnessed action path", () =>
    Effect.gen(function* () {
      const text = "A method comprising the steps of: a) placing a panel; b) forming a port; and c) placing a plate.";
      const plan = yield* planOf(text, true);
      const original = O.getOrThrow(plan.roles.originalLexicalInput);
      if (original.status !== "aligned") throw new Error("expected original aligned source");
      assert.isTrue(A.some(original.tokens, (t) => t.anchor.quote === "a)"));
      assert.deepStrictEqual(
        A.map(
          A.filter(plan.roles.predicates, (p) => p.kind === "gerund"),
          (p) => p.anchor.quote
        ),
        ["placing", "forming", "placing"]
      );
      assert.deepStrictEqual(
        A.flatMap(plan.declarations, (d) => A.map(d.items, (i) => i.label.quote)),
        ["a)", "b)", "c)"]
      );
    })
  );
  for (const { joined, mutation } of A.flatMap([false, true], (joined) =>
    A.map(["pos", "missing-lemma", "wrong-lemma", "bare-header-pos", "pos-without-position"] as const, (mutation) => ({
      joined,
      mutation,
    }))
  )) {
    it.effect(`rejects coherent action ${mutation} mutation with ${joined ? "combined" : "split"} labels`, () =>
      Effect.gen(function* () {
        const text =
          mutation === "bare-header-pos"
            ? "A method comprising: a) placing a panel; b) forming a port."
            : "A method comprising the steps of: a) placing a panel; b) forming a port.";
        const plan = yield* planOf(text, joined);
        const original = O.getOrThrow(plan.roles.originalLexicalInput);
        const claim = O.getOrThrow(plan.roles.qualifiedClaim);
        if (original.status !== "aligned") throw new Error("expected aligned input");
        const action = O.getOrThrow(A.findFirst(original.tokens, (t) => t.anchor.quote === "placing"));
        const token = ClaimLexicalToken.make({
          ...action,
          ...(mutation === "pos" || mutation === "bare-header-pos" || mutation === "pos-without-position"
            ? { pos: "NOUN" }
            : { lemma: mutation === "missing-lemma" ? O.none() : O.some("draw") }),
        });
        const input = ClaimLexicalEvidence.cases.aligned.make({
          ...original,
          tokens: A.map(original.tokens, (t) => (t.anchor.startChar === action.anchor.startChar ? token : t)),
        });
        const certificates = A.map(plan.roles.certificates, (p) =>
          p.kind === "token" && p.token.anchor.startChar === action.anchor.startChar
            ? ClaimFiniteSourceProof.cases.token.make({ ...p, token })
            : mutation === "pos-without-position" &&
                p.kind === "operator" &&
                p.extent.startChar === action.anchor.startChar
              ? ClaimFiniteSourceProof.cases.operator.make({ ...p, position: O.none() })
              : p
        );
        const changed = ClaimSourceElementPlan.make({
          ...plan,
          roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates, originalLexicalInput: O.some(input) }),
        });
        const prepared = yield* prepareClaimInspection(inputOf(text));
        const produced = yield* decomposePreparedClaimRoles(prepared, [input]);
        assert.deepStrictEqual(
          {
            producerPlans: produced.plans.length,
            ownership: validateClaimSourceOwnership(changed, () => true),
            finite: validateClaimFiniteSourceProofsFromOriginalInput(
              claim,
              input,
              certificates,
              plan.roles.proofs,
              () => true
            ),
          },
          { producerPlans: 0, ownership: false, finite: false }
        );
      })
    );
  }
});
