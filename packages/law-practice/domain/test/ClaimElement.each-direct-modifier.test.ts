import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimElement,
  ClaimElementPath,
  ClaimElementTree,
  ClaimFiniteSourceProof,
  ClaimFrameArgument,
  ClaimInputCollection,
  ClaimInputInspectionReport,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimPredicateSpan,
  ClaimSourceElementPlan,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  ClaimTerm,
  compileClaimClauseRoles,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
  validateClaimFiniteSourceProofsFromOriginalInput,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { decomposeFiniteSourceFixture } from "./helpers/ClaimElementFiniteSource.ts";

// Synthetic source controls only; this vocabulary is injected test evidence.
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["of", ["ADP", "of"]],
  ["from", ["ADP", "from"]],
  ["each", ["DET", "each"]],
  ["comprising", ["VERB", "comprise"]],
  ["located", ["VERB", "locate"]],
  ["panels", ["NOUN", "panel"]],
  ["members", ["NOUN", "member"]],
  ["placed", ["VERB", "place"]],
  ["positioned", ["VERB", "position"]],
  ["locates", ["VERB", "locate"]],
  ["locating", ["VERB", "locate"]],
  ["is", ["AUX", "be"]],
  ["was", ["AUX", "be"]],
  ["by", ["ADP", "by"]],
  ["and", ["CCONJ", "and"]]
);
const fixtureOf = (body: string) => {
  const source = `A system comprising ${body}.`;
  return {
    source,
    qualifiedParts: { preamble: "A system", transition: "comprising", body: `${body}.` },
    tokens: A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+|[^\s\p{L}\p{N}]/gu)(source)), (match) => {
      const lower = Str.toLowerCase(match[0]);
      const [pos, lemma] = O.getOrElse(HashMap.get(lexical, lower), () => [
        O.isSome(Str.match(/^\p{L}/u)(lower)) ? "NOUN" : "PUNCT",
        lower,
      ]);
      const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
      return { anchor: { startChar, endChar: startChar + match[0].length, quote: match[0] }, pos, lemma };
    }),
  };
};

describe("source-proved each plus regular participle and direct nominal", () => {
  it.effect("retains the independently closed quantity nominal control", () =>
    Effect.gen(function* () {
      const result = yield* decomposeFiniteSourceFixture(fixtureOf("a plurality of panels"));
      assert.strictEqual(result.plans.length, 1);
      const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
      assert.deepStrictEqual(
        A.map(plan.elements, (element) => ({
          kind: element.kind,
          quote: element.extent.quote,
          nominals: A.map(element.nominals, (nominal) => nominal.anchor.quote),
        })),
        [
          { kind: "preamble-subject", quote: "A system", nominals: ["A system"] },
          { kind: "limitation", quote: "a plurality of panels", nominals: ["a plurality of panels"] },
        ]
      );
    })
  );
  it.effect("admits a comma-delimited distributive modifier without treating its operator as nominal evidence", () =>
    Effect.gen(function* () {
      const result = yield* decomposeFiniteSourceFixture(
        fixtureOf("a plurality of panels, each located a distance from a wall")
      );
      assert.strictEqual(result.plans.length, 1);
      const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
      assert.deepStrictEqual(
        A.map(plan.elements, (element) => ({
          kind: element.kind,
          quote: element.extent.quote,
          nominals: A.map(element.nominals, (nominal) => nominal.anchor.quote),
        })),
        [
          { kind: "preamble-subject", quote: "A system", nominals: ["A system"] },
          {
            kind: "functional-relation",
            quote: "a plurality of panels, each located a distance from a wall",
            nominals: ["a plurality of panels", "a distance", "a wall"],
          },
        ]
      );
    })
  );
});

const body = "a plurality of panels, each located a distance from a wall";
const positivePlan = Effect.fn("EachDirectTest.positivePlan")(function* () {
  const result = yield* decomposeFiniteSourceFixture(fixtureOf(body));
  assert.strictEqual(result.plans.length, 1);
  return O.getOrThrow(A.head(result.plans)).sourcePlan;
});
const anchorOf = (quote: string): TextAnchor => {
  const source = fixtureOf(body).source;
  const startChar = O.getOrThrow(Str.indexOf(quote)(source));
  return TextAnchor.make({ startChar, endChar: startChar + quote.length, quote });
};
const meter = () => {
  let remaining = 262_144;
  return (amount: number) => {
    remaining -= amount;
    return remaining >= 0;
  };
};
const distributive = (plan: ClaimSourceElementPlan) =>
  O.getOrThrow(
    A.findFirst(
      plan.roles.certificates,
      (p): p is Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }> =>
        p.kind === "operator" && p.mode === "distributive"
    )
  );
const certificateRef = (plan: ClaimSourceElementPlan, kind: ClaimFiniteSourceProof["kind"], quote: string) => {
  const proof = O.getOrThrow(
    A.findFirst(
      plan.roles.certificates,
      (p) =>
        p.kind === kind &&
        (p.kind === "token" ? p.token.anchor.quote === quote : p.kind === "head" ? p.core.quote === quote : false)
    )
  );
  return ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: kind === "token" ? "token" : "core" });
};
const changedProof = (plan: ClaimSourceElementPlan, proof: ClaimFiniteSourceProof): ClaimSourceElementPlan =>
  ClaimSourceElementPlan.make({
    ...plan,
    roles: ClaimClauseRolePlan.make({
      ...plan.roles,
      certificates: A.map(plan.roles.certificates, (p) => (p.ordinal === proof.ordinal ? proof : p)),
    }),
  });

describe("distributive source witness and consumers", () => {
  it.effect("retains complete rank1 source edges, neutral predicate, witnessed arguments and EACH metadata", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      const proof = distributive(plan);
      const subject = certificateRef(plan, "head", "a plurality of panels");
      const direct = certificateRef(plan, "head", "a distance");
      const token = certificateRef(plan, "token", "located");
      const each = certificateRef(plan, "token", "each");
      const comma = O.getOrThrow(
        A.findFirst(
          plan.roles.certificates,
          (p) =>
            p.kind === "boundary" &&
            O.exists(
              A.get(plan.roles.certificates, p.token.ordinal - 1),
              (t) => t.kind === "token" && t.token.anchor.quote === ","
            )
        )
      );
      const scope = O.getOrThrow(A.findFirst(plan.roles.certificates, (p) => p.kind === "scope" && p.role === "body"));
      assert.deepStrictEqual(
        proof,
        ClaimFiniteSourceProof.cases.operator.make({
          ordinal: proof.ordinal,
          mode: "distributive",
          extent: anchorOf("located"),
          headRole: "predicate",
          lexical: [token],
          subject: O.some(subject),
          position: O.some(each),
          head: {
            kind: "distributive-direct",
            token,
            scope: ClaimSourceProofRef.make({ ordinal: scope.ordinal, slot: "scope" }),
            comma: ClaimSourceProofRef.make({ ordinal: comma.ordinal, slot: "boundary" }),
            each,
            direct,
          },
        })
      );
      if (proof.head.kind !== "distributive-direct") throw new Error("expected typed distributive witness");
      const refs = [
        proof.head.token,
        ...proof.lexical,
        ...O.toArray(proof.subject),
        ...O.toArray(proof.position),
        proof.head.scope,
        proof.head.comma,
        proof.head.each,
        proof.head.direct,
      ];
      assert.strictEqual(refs.length, 8);
      assert.deepStrictEqual(
        A.map(refs, (ref) => O.getOrThrow(A.get(plan.roles.certificates, ref.ordinal - 1)).rank),
        [-3, -3, 0, -3, -3, -2, -3, 0]
      );
      plan.roles.originalLexicalInput.pipe(O.isSome, assertTrue);
      assert.deepStrictEqual(
        O.getOrThrow(A.findFirst(plan.roles.predicates, (p) => p.anchor.quote === "located")),
        ClaimPredicateSpan.make({
          anchor: anchorOf("located"),
          kind: "distributive",
        })
      );
      const frame = O.getOrThrow(A.findFirst(plan.frames, (f) => A.some(f.predicates, (p) => p.quote === "located")));
      assert.deepStrictEqual(frame.arguments, [
        ClaimFrameArgument.make({
          role: "subject",
          nominal: anchorOf("a plurality of panels"),
          predicate: O.some(anchorOf("located")),
          ownerNominal: O.none(),
        }),
        ClaimFrameArgument.make({
          role: "object",
          nominal: anchorOf("a distance"),
          predicate: O.some(anchorOf("located")),
          ownerNominal: O.none(),
        }),
        ClaimFrameArgument.make({
          role: "prepositional-complement",
          nominal: anchorOf("a wall"),
          predicate: O.some(anchorOf("located")),
          ownerNominal: O.none(),
        }),
      ]);
      assert.deepStrictEqual(frame.subject, O.some(anchorOf("a plurality of panels")));
      const ownership = O.getOrThrow(A.findFirst(plan.tokenOwnership, (t) => t.extent.quote === "each"));
      assert.deepStrictEqual(ownership, {
        kind: "control",
        token: each,
        extent: anchorOf("each"),
        evidence: {
          kind: "operator-position",
          proof: ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "operator" }),
        },
      });
      assert.isTrue(validateClaimSourceOwnership(plan, meter()));
    })
  );
  for (const [owner, verb, object] of [
    ["a plurality of members", "positioned", "a gap"],
    ["a plurality of panels", "placed", "a cover"],
  ])
    it.effect(`licenses original source predication without a voice decision: ${verb}`, () =>
      Effect.gen(function* () {
        const result = yield* decomposeFiniteSourceFixture(fixtureOf(`${owner}, each ${verb} ${object}`));
        assert.strictEqual(result.plans.length, 1);
        const plan = O.getOrThrow(A.head(result.plans)).sourcePlan;
        assert.strictEqual(distributive(plan).mode, "distributive");
        assert.isTrue(validateClaimSourceOwnership(plan, meter()));
      })
    );
  const declined = [
    "a plurality of panels and a plurality of members, each located a distance",
    "each panel located a distance",
    "a plurality of panels each located a distance",
    "a plurality of panels, each located",
    "a plurality of panels, each located from a wall",
    "a plurality of panels, each locates a distance",
    "a plurality of panels, each locating a distance",
    "a plurality of panels, each is located a distance",
    "a plurality of panels, each was located by a wall",
    "a plurality of panels; each located a distance",
    '"a plurality of panels, each located a distance"',
    "(a plurality of panels, each located a distance)",
    "a plurality of panels, (each located a distance)",
    "a plurality of panels, each located (a distance)",
    "a plurality of panels, each located a distance]",
    'a plurality of panels, each located "a distance',
  ];
  for (const text of declined)
    it.effect(`does not fabricate the new witness for a different or unsupported construction: ${text}`, () =>
      Effect.gen(function* () {
        const result = yield* decomposeFiniteSourceFixture(fixtureOf(text));
        for (const entry of result.plans)
          assert.isFalse(
            A.some(entry.sourcePlan.roles.certificates, (p) => p.kind === "operator" && p.mode === "distributive")
          );
      })
    );
  it.effect("rejects direct corruption of every actual witness edge and its mode", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      const proof = distributive(plan);
      if (proof.head.kind !== "distributive-direct") throw new Error("expected typed witness");
      const cycle = ClaimSourceProofRef.make({ ordinal: proof.ordinal, slot: "operator" });
      const raw = certificateRef(plan, "token", "located");
      const wrongSubject = certificateRef(plan, "head", "A system");
      const variants = [
        { ...proof, subject: O.some(wrongSubject) },
        { ...proof, subject: O.some(cycle) },
        { ...proof, position: O.some(raw) },
        { ...proof, lexical: [proof.head.each] },
        { ...proof, mode: "reduced" as const },
        { ...proof, head: { kind: "singleton" as const, token: raw } },
        ...A.map(["token", "scope", "comma", "each", "direct"] as const, (field) => ({
          ...proof,
          head: { ...proof.head, [field]: cycle },
        })),
        { ...proof, head: { ...proof.head, direct: O.getOrThrow(proof.subject) } },
        { ...proof, head: { ...proof.head, comma: proof.head.each } },
      ];
      const claim = O.getOrThrow(plan.roles.qualifiedClaim);
      const original = O.getOrThrow(plan.roles.originalLexicalInput);
      const hiddenReference = { ...proof, head: { ...proof.head, hiddenReference: cycle } };
      assert.isFalse(
        validateClaimFiniteSourceProofsFromOriginalInput(
          claim,
          original,
          A.map(plan.roles.certificates, (p) => (p.ordinal === proof.ordinal ? hiddenReference : p)),
          plan.roles.proofs,
          meter()
        )
      );
      let variantIndex = 0;
      for (const variant of variants) {
        const corrupted = changedProof(plan, variant);
        assert.isFalse(validateClaimSourceOwnership(corrupted, meter()), `corruption ${variantIndex}`);
        assert.isFalse(
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            original,
            corrupted.roles.certificates,
            corrupted.roles.proofs,
            meter()
          ),
          `finite corruption ${variantIndex}`
        );
        variantIndex++;
      }
    })
  );
  it.effect("requires the witnessed source subject/direct roles in the final frame", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      for (const role of ["subject", "object"]) {
        const frames = A.map(plan.frames, (frame) => ({
          ...frame,
          arguments: A.filter(frame.arguments, (a) => a.role !== role),
        }));
        assert.isFalse(validateClaimSourceOwnership(ClaimSourceElementPlan.make({ ...plan, frames }), meter()));
      }
    })
  );
  it.effect("rejects removed or retagged neutral predicates, orphan certificates and foreign binding rules", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      const proof = distributive(plan);
      const removed = ClaimSourceElementPlan.make({
        ...plan,
        roles: ClaimClauseRolePlan.make({
          ...plan.roles,
          predicates: A.filter(plan.roles.predicates, (p) => p.kind !== "distributive"),
        }),
      });
      assert.isFalse(validateClaimSourceOwnership(removed, meter()));
      for (const kind of ["finite", "adjectival"] as const) {
        const altered = ClaimSourceElementPlan.make({
          ...plan,
          roles: ClaimClauseRolePlan.make({
            ...plan.roles,
            predicates: A.map(plan.roles.predicates, (p) => (p.kind === "distributive" ? { ...p, kind } : p)),
          }),
        });
        assert.isFalse(validateClaimSourceOwnership(altered, meter()));
      }
      for (const rule of ["auxiliary-complement", "scalar-participle", "reduced-modifier"] as const) {
        const operatorBindings = A.map(plan.operatorBindings, (binding) => ({
          ...binding,
          head: O.map(binding.head, (head) => (head.certificate.ordinal === proof.ordinal ? { ...head, rule } : head)),
        }));
        assert.isFalse(
          validateClaimSourceOwnership(ClaimSourceElementPlan.make({ ...plan, operatorBindings }), meter())
        );
      }
      const owner = O.getOrThrow(A.get(plan.roles.certificates, O.getOrThrow(proof.subject).ordinal - 1));
      if (owner.kind !== "head") throw new Error("expected source Head0");
      const duplicate = ClaimFiniteSourceProof.cases.head.make({
        ...owner,
        ordinal: ClaimSourceProofOrdinal.make(plan.roles.certificates.length + 1),
      });
      const ambiguous = ClaimSourceElementPlan.make({
        ...plan,
        roles: ClaimClauseRolePlan.make({ ...plan.roles, certificates: A.append(plan.roles.certificates, duplicate) }),
      });
      assert.isFalse(validateClaimSourceOwnership(ambiguous, meter()));
      assert.isFalse(
        validateClaimFiniteSourceProofsFromOriginalInput(
          O.getOrThrow(plan.roles.qualifiedClaim),
          O.getOrThrow(plan.roles.originalLexicalInput),
          ambiguous.roles.certificates,
          ambiguous.roles.proofs,
          meter()
        )
      );
    })
  );
  it.effect("charges the complete constructor under the existing source allowance", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      const claim = O.getOrThrow(plan.roles.qualifiedClaim);
      const original = O.getOrThrow(plan.roles.originalLexicalInput);
      if (original.status !== "aligned") throw new Error("expected aligned original source");
      const compiled = O.getOrThrow(compileClaimClauseRoles(claim, original));
      const required = 262_144 - compiled.remainingWork;
      assert.isAbove(required, 0);
      for (const available of [0, 1, required - 1]) {
        const input = ClaimLexicalEvidence.cases.aligned.make({
          ...original,
          lexicalWorkConsumed: 262_144 - available,
        });
        assertNone(compileClaimClauseRoles(claim, input));
      }
      const exact = ClaimLexicalEvidence.cases.aligned.make({ ...original, lexicalWorkConsumed: 262_144 - required });
      const atBoundary = O.getOrThrow(compileClaimClauseRoles(claim, exact));
      assert.strictEqual(atBoundary.remainingWork, 0);
      assert.deepStrictEqual(atBoundary.certificates, compiled.certificates);
    })
  );
  it.effect("stops at every failed charge prefix of direct ownership validation", () =>
    Effect.gen(function* () {
      const plan = yield* positivePlan();
      const claim = O.getOrThrow(plan.roles.qualifiedClaim);
      const original = O.getOrThrow(plan.roles.originalLexicalInput);
      const validators = [
        (charge: (amount: number) => boolean) => validateClaimSourceOwnership(plan, charge),
        (charge: (amount: number) => boolean) =>
          validateClaimFiniteSourceProofsFromOriginalInput(
            claim,
            original,
            plan.roles.certificates,
            plan.roles.proofs,
            charge
          ),
      ];
      for (const validate of validators) {
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
          let afterFailure = 0;
          let afterFailureSite = "";
          let firstFailureSite = "";
          const valid = validate(() => {
            if (failed) {
              afterFailure++;
              afterFailureSite = new Error("after failure").stack ?? "unknown";
            }
            if (seen++ === prefix) {
              failed = true;
              firstFailureSite = new Error("first failure").stack ?? "unknown";
              return false;
            }
            return !failed;
          });
          assert.isFalse(valid, `accepted failed prefix ${prefix}`);
          assert.strictEqual(
            afterFailure,
            0,
            `work after failed prefix ${prefix}: ${firstFailureSite}: ${afterFailureSite}`
          );
        }
      }
    })
  );
  it.effect("produces a complete pure inspection report with EACH excluded from nominal evidence", () =>
    Effect.gen(function* () {
      const fixture = fixtureOf(body);
      const input = ClaimInputCollection.make({
        sourceKey: "each-direct-report",
        records: [
          ClaimInputRecord.cases.text.make({
            sourceOrdinal: 1,
            numberText: O.some("1"),
            sourceText: fixture.source,
            canonicalText: fixture.source,
          }),
        ],
      });
      const prepared = yield* prepareClaimInspection(input);
      const evidence = ClaimLexicalEvidence.cases.aligned.make({
        sourceKey: input.sourceKey,
        sourceOrdinal: 1,
        qualifiedText: fixture.source,
        provider: "explicit-synthetic-only",
        assetDigest: "no-provider",
        tokens: A.map(fixture.tokens, (t) =>
          ClaimLexicalToken.make({ ...t, anchor: TextAnchor.make(t.anchor), lemma: O.fromNullOr(t.lemma) })
        ),
      });
      const report = yield* inspectPreparedClaimRoles(prepared, [evidence]);
      assert.strictEqual(report.indexStatus, "complete");
      const record = O.getOrThrow(A.head(report.records));
      assert.strictEqual(record.status, "complete");
      if (record.status === "unchecked") return;
      assert.deepStrictEqual(record.findings, []);
      assert.strictEqual(record.decomposition.status, "decomposed");
      assert.deepStrictEqual(report.input, input);
      if (record.decomposition.status !== "decomposed") return;
      const rootPath = yield* S.decodeEffect(ClaimElementPath)("1");
      const childPath = yield* S.decodeEffect(ClaimElementPath)("1.a");
      const qualification = O.getOrThrow(A.head(prepared.qualifications));
      if (qualification.status !== "context-ready") throw new Error("expected qualified source");
      const root = ClaimElement.make({
        path: rootPath,
        kind: "preamble-subject",
        anchor: anchorOf("A system"),
        terms: [ClaimTerm.make({ anchor: anchorOf("A system"), determiner: "a", head: "system" })],
      });
      const element = ClaimElement.make({
        path: childPath,
        kind: "functional-relation",
        anchor: anchorOf(body),
        terms: [
          ClaimTerm.make({ anchor: anchorOf("a plurality of panels"), determiner: "plurality-of", head: "panels" }),
          ClaimTerm.make({ anchor: anchorOf("a distance"), determiner: "a", head: "distance" }),
          ClaimTerm.make({ anchor: anchorOf("a wall"), determiner: "a", head: "wall" }),
        ],
      });
      const tree = ClaimElementTree.make({
        claimNumber: 1,
        producer: "rule",
        elements: [root, element],
        edges: [
          { kind: "part-of", child: childPath, parent: rootPath },
          {
            kind: "functional",
            element: childPath,
            parts: [
              { kind: "term", term: { path: childPath, anchor: anchorOf("a plurality of panels") } },
              { kind: "text", anchor: anchorOf(", each located ") },
              { kind: "term", term: { path: childPath, anchor: anchorOf("a distance") } },
              { kind: "text", anchor: anchorOf(" from ") },
              { kind: "term", term: { path: childPath, anchor: anchorOf("a wall") } },
            ],
          },
        ],
      });
      assert.deepStrictEqual(
        report,
        ClaimInputInspectionReport.make({
          input,
          indexStatus: "complete",
          records: [
            {
              status: "complete",
              decomposition: { status: "decomposed", qualification, tree },
              findings: [],
            },
          ],
        })
      );
    })
  );
});
