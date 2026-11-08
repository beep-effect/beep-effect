import {
  ClaimFiniteSourceProof,
  ClaimHeadTerminalEvidence,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  OriginalLexicalTokenOrdinal,
  validateClaimFiniteSourceProofs,
} from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import { roleEvidenceOf } from "./helpers/ClaimElementRoleInspection.ts";
import { assertClaimReservationPrefixes } from "./helpers/ClaimElementWorkAssertions.ts";

const lexical = HashMap.make(
  ["may", { pos: "AUX", lemma: "may" }],
  ["not", { pos: "PART", lemma: "not" }],
  ["fixed", { pos: "VERB", lemma: "fix" }],
  ["configured", { pos: "VERB", lemma: "configure" }],
  ["to", { pos: "PART", lemma: "to" }],
  ["rotate", { pos: "VERB", lemma: "rotate" }],
  ["quickly", { pos: "ADV", lemma: "quickly" }],
  ["including", { pos: "VERB", lemma: "include" }],
  ["that", { pos: "PRON", lemma: "that" }],
  ["which", { pos: "PRON", lemma: "which" }],
  ["plates", { pos: "NOUN", lemma: "plate" }],
  ["rotates", { pos: "VERB", lemma: "rotate" }],
  ["presses", { pos: "VERB", lemma: "press" }],
  ["its", { pos: "DET", lemma: "its" }],
  ["7x", { pos: "NUM", lemma: "7x" }],
  ["shafts", { pos: "NOUN", lemma: "shaft" }]
);
const registry = (body: string) => {
  const preamble = "A system";
  const transition = "comprising";
  const text = `${preamble} ${transition} ${body}`;
  const claim = PatentClaim.cases.independent.make({ claimNumber: 1, claimText: text, preamble, transition, body });
  const input = O.filter(A.head(roleEvidenceOf([text])), ClaimLexicalEvidence.guards.aligned).pipe(O.getOrThrow);
  const tokens = A.map(input.tokens, (token) =>
    O.getOrElse(
      O.map(HashMap.get(lexical, token.anchor.quote), (fields) =>
        ClaimLexicalToken.make({ ...token, pos: fields.pos, lemma: O.some(fields.lemma) })
      ),
      () => token
    )
  );
  const raw = A.map(tokens, (token, index) =>
    ClaimFiniteSourceProof.cases.token.make({
      ordinal: ClaimSourceProofOrdinal.make(index + 1),
      tokenOrdinal: OriginalLexicalTokenOrdinal.make(index + 1),
      token,
    })
  );
  const scope = (role: "preamble" | "transition" | "body", index: number, startChar: number, quote: string) =>
    ClaimFiniteSourceProof.cases.scope.make({
      ordinal: ClaimSourceProofOrdinal.make(raw.length + index),
      role,
      extent: TextAnchor.make({ startChar, endChar: startChar + quote.length, quote }),
    });
  const proofs = [
    ...raw,
    scope("preamble", 1, 0, preamble),
    scope("transition", 2, preamble.length + 1, transition),
    scope("body", 3, text.length - body.length, body),
  ];
  const tokenRef = (quote: string) => {
    const index = A.findFirstIndex(tokens, (token) => token.anchor.quote === quote).pipe(O.getOrThrow);
    return ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(index + 1), slot: "token" });
  };
  const bodyScope = ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(proofs.length), slot: "scope" });
  const transitionScope = ClaimSourceProofRef.make({
    ordinal: ClaimSourceProofOrdinal.make(proofs.length - 1),
    slot: "scope",
  });
  return { claim, tokens, proofs, tokenRef, bodyScope, transitionScope };
};

const rows = [
  { body: "a plate may rotate.", mode: "auxiliary-complement", raw: "rotate", governor: "may" },
  { body: "a plate is not fixed.", mode: "auxiliary-complement", raw: "fixed", governor: "is" },
  { body: "a plate configured to rotate.", mode: "infinitive-complement", raw: "rotate", governor: "to" },
  { body: "a plate configured to rotate.", mode: "infinitive-introducer", raw: "to", governor: "rotate" },
  { body: "a plate configured to quickly rotate.", mode: "infinitive-complement", raw: "rotate", governor: "to" },
  { body: "a plate configured to quickly rotate.", mode: "infinitive-introducer", raw: "to", governor: "rotate" },
] as const;

describe("verbal-boundary source witnesses", () => {
  it.effect("requires all three unique qualified source scopes", () =>
    Effect.sync(() => {
      const fixture = registry("a plate may rotate.");
      const validate = (proofs: ReadonlyArray<ClaimFiniteSourceProof>) =>
        validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, proofs, [], () => true);
      const preamble = A.findFirst(fixture.proofs, (proof) => proof.kind === "scope" && proof.role === "preamble").pipe(
        O.getOrThrow
      );
      const body = A.last(fixture.proofs).pipe(O.getOrThrow);
      assert.strictEqual(preamble.kind, "scope");
      assert.strictEqual(body.kind, "scope");
      if (preamble.kind !== "scope" || body.kind !== "scope") return;
      assert.isTrue(validate(fixture.proofs));
      assert.isFalse(validate(A.dropRight(fixture.proofs, 1)));
      const duplicate = ClaimFiniteSourceProof.cases.scope.make({ ...body, role: "preamble", extent: preamble.extent });
      assert.isFalse(validate(A.map(fixture.proofs, (proof) => (proof.ordinal === body.ordinal ? duplicate : proof))));
      assert.isTrue(validate(fixture.proofs));
    })
  );
  for (const row of rows)
    it.effect(`binds actual ${row.mode} words and rejects substituted source joins: ${row.body}`, () =>
      Effect.sync(() => {
        const fixture = registry(row.body);
        const validate = (proofs: ReadonlyArray<ClaimFiniteSourceProof>) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, proofs, [], () => true);
        assert.isTrue(validate(fixture.proofs));
        const proof = ClaimFiniteSourceProof.cases["verbal-boundary"].make({
          ordinal: ClaimSourceProofOrdinal.make(fixture.proofs.length + 1),
          mode: row.mode,
          token: fixture.tokenRef(row.raw),
          governor: fixture.tokenRef(row.governor),
          scope: fixture.bodyScope,
        });
        assert.isTrue(validate([...fixture.proofs, proof]));
        assertClaimReservationPrefixes((charge) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, [...fixture.proofs, proof], [], charge)
        )(row.mode);
        const corruptions = [
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, governor: proof.token }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, token: proof.governor }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, scope: fixture.transitionScope }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, token: fixture.bodyScope }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, governor: fixture.bodyScope }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({ ...proof, scope: fixture.tokenRef("plate") }),
          ClaimFiniteSourceProof.cases["verbal-boundary"].make({
            ...proof,
            governor: ClaimSourceProofRef.make({ ...proof.governor, slot: "core" }),
          }),
        ];
        for (const corrupted of corruptions) assert.isFalse(validate([...fixture.proofs, corrupted]));
        if (row.mode !== "auxiliary-complement") {
          const tokens = A.map(fixture.tokens, (token) =>
            token.anchor.quote === "rotate" ? ClaimLexicalToken.make({ ...token, lemma: O.some("turn") }) : token
          );
          const records = A.map(fixture.proofs, (record) =>
            record.kind === "token"
              ? ClaimFiniteSourceProof.cases.token.make({
                  ...record,
                  token: A.get(tokens, record.tokenOrdinal - 1).pipe(O.getOrThrow),
                })
              : record
          );
          assert.isTrue(validateClaimFiniteSourceProofs(fixture.claim, tokens, records, [], () => true));
          assert.isFalse(validateClaimFiniteSourceProofs(fixture.claim, tokens, [...records, proof], [], () => true));
        }
        assert.isTrue(validate([...fixture.proofs, proof]));
      })
    );
});

const boundaries = [
  { body: "a plate may rotate.", mode: "auxiliary", raw: "may" },
  { body: "a plate on a frame.", mode: "preposition", raw: "on" },
  { body: "a plate to the frame.", mode: "preposition", raw: "to" },
  { body: "a plate.", mode: "determiner", raw: "a" },
  { body: "a plate, a cover.", mode: "separator", raw: "," },
  { body: "a plate and a cover.", mode: "separator", raw: "and" },
  { body: "a plate.", mode: "terminal", raw: "." },
  { body: "a plate.", mode: "qualified-end", raw: "." },
  { body: "a plate including: a pin.", mode: "declaration", raw: "including" },
  { body: "a plate (12).", mode: "reference-label", raw: "(" },
  { body: "a plate that may rotate.", mode: "relative", raw: "that", successor: "may" },
  { body: "a plate which quickly rotates.", mode: "relative", raw: "which", successor: "rotates" },
  { body: "a plate quickly may rotate.", mode: "adjunct", raw: "quickly", successor: "may" },
  { body: "a plate not fixed on a frame.", mode: "adjunct", raw: "not", successor: "fixed" },
  { body: "a plate rotates a shaft.", mode: "finite", raw: "rotates" },
  { body: "a plate presses a shaft.", mode: "finite", raw: "presses" },
  { body: "plates rotate a shaft.", mode: "finite", raw: "rotate", nominal: "plates" },
  { body: "a plate mounted on a frame.", mode: "reduced", raw: "mounted" },
  { body: "a plate configured to rotate.", mode: "reduced", raw: "configured" },
] as const;

describe("independent nominal boundary witnesses", () => {
  for (const row of boundaries)
    it.effect(`verifies actual ${row.mode} premises: ${row.body}`, () =>
      Effect.sync(() => {
        const fixture = registry(row.body);
        const validate = (proofs: ReadonlyArray<ClaimFiniteSourceProof>) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, proofs, [], () => true);
        assert.isTrue(validate(fixture.proofs));
        const successor = "successor" in row ? O.some(fixture.tokenRef(row.successor)) : O.none();
        const proof = ClaimFiniteSourceProof.cases.boundary.make({
          ordinal: ClaimSourceProofOrdinal.make(fixture.proofs.length + 1),
          mode: row.mode,
          token: fixture.tokenRef(row.raw),
          scope: fixture.bodyScope,
          successor,
        });
        assert.isTrue(validate([...fixture.proofs, proof]));
        assertClaimReservationPrefixes((charge) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, [...fixture.proofs, proof], [], charge)
        )(`${row.mode}: ${row.body}`);
        const nominal = fixture.tokenRef("nominal" in row ? row.nominal : "plate");
        const corruptions = [
          ClaimFiniteSourceProof.cases.boundary.make({ ...proof, token: fixture.bodyScope }),
          ClaimFiniteSourceProof.cases.boundary.make({ ...proof, scope: nominal }),
          ClaimFiniteSourceProof.cases.boundary.make({ ...proof, scope: fixture.transitionScope }),
        ];
        for (const corrupted of corruptions) assert.isFalse(validate([...fixture.proofs, corrupted]));
        assert.isFalse(
          validate([...fixture.proofs, ClaimFiniteSourceProof.cases.boundary.make({ ...proof, token: nominal })])
        );
        assert.isTrue(validate([...fixture.proofs, proof]));
      })
    );
});

const openingRows = [
  { mode: "determiner", body: "a plate.", core: "a plate", first: "a", terminal: "plate", witness: "a" },
  { mode: "quantity", body: "two plates.", core: "two plates", first: "two", terminal: "plates", witness: "two" },
  { mode: "unknown-number", body: "7x plates.", core: "7x plates", first: "7x", terminal: "plates", witness: "7x" },
  { mode: "possessive", body: "its plate.", core: "its plate", first: "its", terminal: "plate", witness: "its" },
  { mode: "qualified-start", body: "plate.", core: "plate", first: "plate", terminal: "plate", witness: "plate" },
  {
    mode: "preposition-object",
    body: "a plate on the frame.",
    core: "the frame",
    first: "the",
    terminal: "frame",
    witness: "on",
  },
  {
    mode: "list-item",
    body: "a plate; the cover.",
    core: "the cover",
    first: "the",
    terminal: "cover",
    witness: ";",
    witnessMode: "separator",
  },
  {
    mode: "lexical-object",
    body: "a plate rotates quickly shafts.",
    core: "shafts",
    first: "shafts",
    terminal: "shafts",
    witness: "rotates",
    witnessMode: "finite",
    adjunct: "quickly",
  },
] as const;
type OpeningRow = (typeof openingRows)[number];
const openedHead = (row: OpeningRow) => {
  const fixture = registry(row.body);
  const proofs: Array<ClaimFiniteSourceProof> = [...fixture.proofs];
  const coreStart = A.get(fixture.tokens, fixture.tokenRef(row.first).ordinal - 1).pipe(O.getOrThrow).anchor.startChar;
  const closingBoundary = ClaimFiniteSourceProof.cases.boundary.make({
    ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
    mode: "terminal",
    token: fixture.tokenRef("."),
    scope: fixture.bodyScope,
    successor: O.none(),
  });
  proofs.push(closingBoundary);
  let evidence: ReadonlyArray<ClaimSourceProofRef> = [fixture.tokenRef(row.witness)];
  if (row.mode === "qualified-start") evidence = [fixture.bodyScope];
  if ("witnessMode" in row) {
    const boundary = ClaimFiniteSourceProof.cases.boundary.make({
      ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
      mode: row.witnessMode,
      token: fixture.tokenRef(row.witness),
      scope: fixture.bodyScope,
      successor: O.none(),
    });
    proofs.push(boundary);
    evidence = [ClaimSourceProofRef.make({ ordinal: boundary.ordinal, slot: "boundary" })];
    if ("adjunct" in row) evidence = [...evidence, fixture.tokenRef(row.adjunct)];
  }
  const opening = ClaimFiniteSourceProof.cases.opening.make({
    ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
    mode: row.mode,
    coreStart,
    scope: fixture.bodyScope,
    evidence,
  });
  proofs.push(opening);
  const core = TextAnchor.make({ startChar: coreStart, endChar: coreStart + row.core.length, quote: row.core });
  const closure = ClaimFiniteSourceProof.cases.closure.make({
    ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
    coreEnd: core.endChar,
    scope: fixture.bodyScope,
    boundary: O.some(ClaimSourceProofRef.make({ ordinal: closingBoundary.ordinal, slot: "boundary" })),
    gap: O.none(),
  });
  proofs.push(closure);
  const terminal = fixture.tokenRef(row.terminal);
  const head = A.get(fixture.tokens, terminal.ordinal - 1).pipe(O.getOrThrow).anchor;
  proofs.push(
    ClaimFiniteSourceProof.cases.head.make({
      ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
      core,
      head,
      terminal,
      opening: ClaimSourceProofRef.make({ ordinal: opening.ordinal, slot: "opening" }),
      closure: ClaimSourceProofRef.make({ ordinal: closure.ordinal, slot: "closure" }),
      terminalEvidence: ClaimHeadTerminalEvidence.cases["lexical-terminal"].make({}),
      tokens: A.filterMap(fixture.tokens, (token, index) =>
        token.anchor.startChar >= core.startChar && token.anchor.endChar <= core.endChar
          ? Result.succeed(
              ClaimSourceProofRef.make({ ordinal: ClaimSourceProofOrdinal.make(index + 1), slot: "token" })
            )
          : Result.failVoid
      ),
    })
  );
  return { fixture, opening, proofs };
};

describe("nominal opening source positions and ranked witnesses", () => {
  for (const row of openingRows)
    it.effect(`binds the actual ${row.mode} opening to a complete synthetic head`, () =>
      Effect.sync(() => {
        const { fixture, opening, proofs } = openedHead(row);
        const validate = (certificates: ReadonlyArray<ClaimFiniteSourceProof>) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, certificates, [], () => true);
        assert.isTrue(validate(proofs));
        assertClaimReservationPrefixes((charge) =>
          validateClaimFiniteSourceProofs(fixture.claim, fixture.tokens, proofs, [], charge)
        )(row.mode);
        const wrongFirst = row.mode === "qualified-start" ? fixture.tokenRef(row.first) : fixture.bodyScope;
        const corruptions = [
          ClaimFiniteSourceProof.cases.opening.make({ ...opening, evidence: [] }),
          ClaimFiniteSourceProof.cases.opening.make({
            ...opening,
            evidence: [wrongFirst, ...A.drop(opening.evidence, 1)],
          }),
          ClaimFiniteSourceProof.cases.opening.make({ ...opening, scope: fixture.tokenRef(row.first) }),
          ClaimFiniteSourceProof.cases.opening.make({ ...opening, scope: fixture.transitionScope }),
          ClaimFiniteSourceProof.cases.opening.make({ ...opening, coreStart: fixture.claim.claimText.length }),
        ];
        for (const corrupted of corruptions)
          assert.isFalse(validate(A.map(proofs, (proof) => (proof.ordinal === opening.ordinal ? corrupted : proof))));
        if (row.mode === "lexical-object") {
          const missingAdjunct = ClaimFiniteSourceProof.cases.opening.make({
            ...opening,
            evidence: A.take(opening.evidence, 1),
          });
          const foreignAdjunct = ClaimFiniteSourceProof.cases.opening.make({
            ...opening,
            evidence: [A.head(opening.evidence).pipe(O.getOrThrow), fixture.bodyScope],
          });
          for (const corrupted of [missingAdjunct, foreignAdjunct])
            assert.isFalse(validate(A.map(proofs, (proof) => (proof.ordinal === opening.ordinal ? corrupted : proof))));
        }
        assert.isTrue(validate(proofs));
      })
    );
});
