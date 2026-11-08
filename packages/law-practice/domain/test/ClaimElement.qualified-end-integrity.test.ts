import { validateClaimSourceOwnership } from "@beep/law-practice-domain/test";
import {
  ClaimClauseRolePlan,
  ClaimFiniteSourceProof,
  ClaimSourceElementPlan,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  validateClaimFiniteSourceProofs,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { it } from "@beep/test-runner";
import { assert } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { roleEvidenceOf, rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";
import { assertClaimReservationPrefixes } from "./helpers/ClaimElementWorkAssertions.ts";

const fixtureFor = Effect.fn("QualifiedEndTest.fixture")(function* (text: string) {
  const result = yield* rolePlansOf([text]);
  const source = A.head(result.plans).pipe(O.getOrThrow).sourcePlan;
  const claim = source.roles.qualifiedClaim.pipe(O.getOrThrow);
  const input = O.filter(A.head(roleEvidenceOf([text])), (e) => e.status === "aligned").pipe(O.getOrThrow);
  const proofs = source.roles.certificates;
  const head = O.filter(
    A.findFirst(proofs, (p) => p.kind === "head" && p.core.quote === "a cover plate"),
    ClaimFiniteSourceProof.guards.head
  ).pipe(O.getOrThrow);
  const closure = O.filter(A.get(proofs, head.closure.ordinal - 1), ClaimFiniteSourceProof.guards.closure).pipe(
    O.getOrThrow
  );
  const cover = O.filter(
    A.findFirst(proofs, (p) => p.kind === "token" && p.token.anchor.quote === "cover"),
    ClaimFiniteSourceProof.guards.token
  ).pipe(O.getOrThrow);
  const plate = O.filter(
    A.findFirst(proofs, (p) => p.kind === "token" && p.token.anchor.quote === "plate"),
    ClaimFiniteSourceProof.guards.token
  ).pipe(O.getOrThrow);
  const validate = (certificates: ReadonlyArray<ClaimFiniteSourceProof>) =>
    validateClaimFiniteSourceProofs(claim, input.tokens, certificates, source.roles.proofs, () => true);
  const withCertificates = (certificates: ReadonlyArray<ClaimFiniteSourceProof>) =>
    ClaimSourceElementPlan.make({ ...source, roles: ClaimClauseRolePlan.make({ ...source.roles, certificates }) });
  assert.isTrue(validate(proofs));
  assert.isTrue(validateClaimSourceOwnership(source, () => true));
  return { text, source, claim, input, proofs, head, closure, cover, plate, validate, withCertificates };
});
type Fixture = Effect.Success<ReturnType<typeof fixtureFor>>;
const truncateHead = (fixture: Fixture) => (certificates: ReadonlyArray<ClaimFiniteSourceProof>) => {
  const { text, head, cover, plate } = fixture;
  const closure = O.filter(A.get(certificates, head.closure.ordinal - 1), ClaimFiniteSourceProof.guards.closure).pipe(
    O.getOrThrow
  );
  const fakeClosure = ClaimFiniteSourceProof.cases.closure.make({
    ...closure,
    coreEnd: cover.token.anchor.endChar,
    gap: O.some(
      TextAnchor.make({
        startChar: cover.token.anchor.endChar,
        endChar: plate.token.anchor.startChar,
        quote: Str.slice(cover.token.anchor.endChar, plate.token.anchor.startChar)(text),
      })
    ),
  });
  const fakeHead = ClaimFiniteSourceProof.cases.head.make({
    ...head,
    core: TextAnchor.make({
      startChar: head.core.startChar,
      endChar: cover.token.anchor.endChar,
      quote: Str.slice(head.core.startChar, cover.token.anchor.endChar)(text),
    }),
    head: cover.token.anchor,
    terminal: ClaimSourceProofRef.make({ ordinal: cover.ordinal, slot: "token" }),
    tokens: A.filter(head.tokens, (ref) => ref.ordinal !== plate.ordinal),
  });
  return A.map(certificates, (p) =>
    p.ordinal === head.ordinal ? fakeHead : p.ordinal === closure.ordinal ? fakeClosure : p
  );
};

it.effect("rejects an interior qualified-end token before it can certify a truncated head", () =>
  Effect.gen(function* () {
    const fixture = yield* fixtureFor("A system comprising a cover plate.");
    const { proofs, closure, plate, validate } = fixture;
    const boundary = O.filter(
      O.flatMap(closure.boundary, (ref) => A.get(proofs, ref.ordinal - 1)),
      ClaimFiniteSourceProof.guards.boundary
    ).pipe(O.getOrThrow);
    const fakeBoundary = ClaimFiniteSourceProof.cases.boundary.make({
      ...boundary,
      mode: "qualified-end",
      token: ClaimSourceProofRef.make({ ordinal: plate.ordinal, slot: "token" }),
    });
    const metadataOnly = A.map(proofs, (p) => (p.ordinal === boundary.ordinal ? fakeBoundary : p));
    assert.isFalse(validate(metadataOnly));
    const truncated = truncateHead(fixture)(metadataOnly);
    assert.isFalse(validateClaimSourceOwnership(fixture.withCertificates(truncated), () => true));
    assert.isFalse(validate(truncated), "the finite head proof cannot certify the truncated nominal a cover");
    assert.isTrue(validate(proofs));
  })
);

it.effect("joins a punctuationless qualified end to the whole scope and stops on every refused debit", () =>
  Effect.gen(function* () {
    const fixture = yield* fixtureFor("A system comprising a cover plate");
    const { proofs, head, closure, plate, cover, claim, input, source, validate } = fixture;
    const boundary = ClaimFiniteSourceProof.cases.boundary.make({
      ordinal: ClaimSourceProofOrdinal.make(proofs.length + 1),
      mode: "qualified-end",
      token: ClaimSourceProofRef.make({ ordinal: plate.ordinal, slot: "token" }),
      scope: closure.scope,
      successor: O.none(),
    });
    const closing = ClaimFiniteSourceProof.cases.closure.make({
      ...closure,
      boundary: O.some(ClaimSourceProofRef.make({ ordinal: boundary.ordinal, slot: "boundary" })),
    });
    const coherent = [...A.map(proofs, (p) => (p.ordinal === closing.ordinal ? closing : p)), boundary];
    assert.strictEqual(head.core.endChar, claim.claimText.length);
    assert.isTrue(validate(coherent));
    const complete = fixture.withCertificates(coherent);
    assert.isTrue(validateClaimSourceOwnership(complete, () => true));
    assertClaimReservationPrefixes("qualified-end whole head", (charge) =>
      validateClaimFiniteSourceProofs(claim, input.tokens, coherent, source.roles.proofs, charge)
    );
    assertClaimReservationPrefixes("qualified-end complete ownership", (charge) =>
      validateClaimSourceOwnership(complete, charge)
    );
    const interior = A.map(coherent, (p) =>
      p.ordinal === boundary.ordinal
        ? ClaimFiniteSourceProof.cases.boundary.make({
            ...boundary,
            token: ClaimSourceProofRef.make({ ordinal: cover.ordinal, slot: "token" }),
          })
        : p
    );
    assert.isFalse(validate(interior));
    const truncated = truncateHead(fixture)(coherent);
    assert.isFalse(validate(truncated), "a last nominal token is not the start of the qualified end");
    assert.isFalse(validateClaimSourceOwnership(fixture.withCertificates(truncated), () => true));
    assert.isTrue(validate(coherent));
  })
);
