/**
 * Rung-1 proof for the legal position relator policy.
 *
 * Every fixture is hand-constructed and slice-isolated: no other slice is
 * booted, no app runtime layer is used, and the policy layer has no
 * dependencies at all, because admission is a schema question, both views are
 * pure derivations, and the screen reads only the values it is handed.
 *
 * The algebra suites run the derivations over the whole eight-member domain
 * rather than over sampled kinds, and every orbit assertion is made against the
 * `pickOptions`-derived subdomains so the proof cannot drift from the
 * vocabulary it is about.
 */

import * as LawPracticeDomain from "@beep/law-practice-domain";
import {
  AdvantagePositionKind,
  correlativePosition,
  DeonticPositionKind,
  HohfeldPosition,
  HohfeldPositionKind,
  isDeonticPositionKind,
  LegalActContent,
  LegalScopeContext,
  legalActContentEquivalence,
  oppositePosition,
  PotestativePositionKind,
} from "@beep/law-practice-domain";
import {
  LegalOppositionCandidateInput,
  LegalPositionRelatorPolicy,
  LegalPositionRelatorPolicyLive,
} from "@beep/law-practice-use-cases/LegalPositionRelatorPolicy";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import { productEntityFixtureInput } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Effect, Equal } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as R from "effect/Record";

const ACT = "enter the land";
const NORM = { designation: "cl. 4.1" };

/** The eight positions, one per kind, all over the same act. */
const everyPosition = A.map(HohfeldPositionKind.Options, (kind) =>
  HohfeldPosition.make({
    content: LegalActContent.make({ description: ACT, polarity: "act" }),
    kind,
  })
);

/**
 * The four kinds reachable from one position under the two derivations. Four
 * applications suffice because the derivations commute and are involutive, so
 * the group they generate has order four.
 */
const orbitKinds = (position: HohfeldPosition) =>
  HashSet.fromIterable([
    position.kind,
    correlativePosition(position).kind,
    oppositePosition(position).kind,
    correlativePosition(oppositePosition(position)).kind,
  ]);

// ---------------------------------------------------------------------------
// Relator fixtures
// ---------------------------------------------------------------------------

type ScopeInput = {
  readonly material: ReadonlyArray<string>;
  readonly quantitative: ReadonlyArray<string>;
  readonly subjective: ReadonlyArray<string>;
  readonly temporal: ReadonlyArray<string>;
  readonly territorial: ReadonlyArray<string>;
};

const LESSEE_SCOPE: ScopeInput = {
  material: ["the demised premises", "the yard"],
  quantitative: ["unlimited"],
  subjective: ["the lessor", "the lessor's agents"],
  temporal: ["the term of the lease"],
  territorial: ["US-CA", "US-NV"],
};

const LESSOR_SCOPE: ScopeInput = {
  material: ["the demised premises", "the cellar"],
  quantitative: ["unlimited"],
  subjective: ["the lessor", "the lessor's successors"],
  temporal: ["the term of the lease", "the holdover period"],
  territorial: ["US-CA"],
};

/** Same as {@link LESSOR_SCOPE} except that no territory is shared. */
const ELSEWHERE_SCOPE: ScopeInput = { ...LESSOR_SCOPE, territorial: ["US-NY"] };

const roleInput = (name: string, player: number) => ({
  admittedPlayerKinds: ["natural-person"],
  name,
  player,
  sourceNorm: NORM,
});

type RelatorOptions = {
  readonly bearer: readonly [string, number];
  readonly counterparty: readonly [string, number];
  readonly id: number;
  readonly polarity: "act" | "omission";
  readonly positionKind: string;
  readonly scope: ScopeInput;
};

/** One encoded stored relation, as a record store would hand it over. */
const relatorInput = (options: RelatorOptions) => ({
  ...productEntityFixtureInput(LawPractice.LegalPositionRelatorId.entityType, options.id),
  assertingInterpreter: { kind: "User", userId: 1 },
  bearer: roleInput(options.bearer[0], options.bearer[1]),
  content: { description: ACT, polarity: options.polarity },
  counterparty: roleInput(options.counterparty[0], options.counterparty[1]),
  grounding: { foundingExercise: null, producingExercise: options.id },
  positionKind: options.positionKind,
  scope: options.scope,
  sourceNorm: NORM,
});

/** X's stored privilege to enter, held against Y. */
const PRIVILEGE_TO_ENTER = relatorInput({
  bearer: ["lessee", 1],
  counterparty: ["lessor", 2],
  id: 1,
  polarity: "act",
  positionKind: "privilege",
  scope: LESSEE_SCOPE,
});

/**
 * Y's stored claim that X enter, held against X. X's `duty(enter+)` is the
 * derived correlative of this record — `duty` is never a stored kind.
 */
const CLAIM_THAT_X_ENTERS = relatorInput({
  bearer: ["lessor", 2],
  counterparty: ["lessee", 1],
  id: 2,
  polarity: "act",
  positionKind: "claim",
  scope: LESSOR_SCOPE,
});

/** Y's stored claim that X refrain from entering, held against X. */
const CLAIM_THAT_X_REFRAINS = relatorInput({
  bearer: ["lessor", 2],
  counterparty: ["lessee", 1],
  id: 3,
  polarity: "omission",
  positionKind: "claim",
  scope: LESSOR_SCOPE,
});

/** As {@link CLAIM_THAT_X_REFRAINS}, but recorded for a territory X's privilege does not reach. */
const CLAIM_THAT_X_REFRAINS_ELSEWHERE = relatorInput({
  bearer: ["lessor", 2],
  counterparty: ["lessee", 1],
  id: 4,
  polarity: "omission",
  positionKind: "claim",
  scope: ELSEWHERE_SCOPE,
});

/** Every field a relation cannot be read without, refused one at a time. */
const REQUIRED_RELATOR_FIELDS: ReadonlyArray<keyof typeof PRIVILEGE_TO_ENTER> = [
  "assertingInterpreter",
  "bearer",
  "content",
  "counterparty",
  "grounding",
  "positionKind",
  "scope",
  "sourceNorm",
];

// ---------------------------------------------------------------------------
// The algebra, by exhaustion over all eight positions
// ---------------------------------------------------------------------------

describe("LegalPositionRelatorPolicy — the derivations over the closed eight-member domain", () => {
  it.effect("are total: every kind maps into the domain under both derivations", () =>
    Effect.sync(() => {
      expect(A.length(everyPosition)).toBe(8);
      const reached = HashSet.fromIterable(
        A.flatMap(everyPosition, (position) => [correlativePosition(position).kind, oppositePosition(position).kind])
      );
      expect(Equal.equals(reached, HohfeldPositionKind.HashSet)).toBe(true);
    })
  );

  it.effect("are involutive: applying either derivation twice returns the position it started from", () =>
    Effect.sync(() => {
      for (const position of everyPosition) {
        expect(Equal.equals(correlativePosition(correlativePosition(position)), position)).toBe(true);
        expect(Equal.equals(oppositePosition(oppositePosition(position)), position)).toBe(true);
      }
    })
  );

  it.effect("commute: correlative after opposite is opposite after correlative", () =>
    Effect.sync(() => {
      for (const position of everyPosition) {
        expect(
          Equal.equals(correlativePosition(oppositePosition(position)), oppositePosition(correlativePosition(position)))
        ).toBe(true);
      }
    })
  );

  it.effect("generate exactly the two four-member orbits, each closed within its own subdomain", () =>
    Effect.sync(() => {
      for (const position of everyPosition) {
        const orbit = orbitKinds(position);
        const expected = isDeonticPositionKind(position.kind)
          ? DeonticPositionKind.HashSet
          : PotestativePositionKind.HashSet;
        expect(HashSet.size(orbit)).toBe(4);
        expect(Equal.equals(orbit, expected)).toBe(true);
      }
    })
  );

  it.effect("leave no advantage-side kind whose opposite is also advantage-side", () =>
    Effect.sync(() => {
      const stored = A.filter(everyPosition, (position) => HashSet.has(AdvantagePositionKind.HashSet, position.kind));
      expect(A.length(stored)).toBe(4);
      for (const position of stored) {
        expect(HashSet.has(AdvantagePositionKind.HashSet, oppositePosition(position).kind)).toBe(false);
      }
    })
  );
});

describe("LegalPositionRelatorPolicy — kind and content move together, or not at all", () => {
  it.effect("opposite moves kind and polarity in one application, leaving the act description alone", () =>
    Effect.sync(() => {
      for (const position of everyPosition) {
        const opposite = oppositePosition(position);
        expect(opposite.kind).not.toBe(position.kind);
        expect(opposite.content.polarity).not.toBe(position.content.polarity);
        expect(opposite.content.description).toBe(position.content.description);
      }
    })
  );

  it.effect("correlative moves kind with the content left exactly as recorded", () =>
    Effect.sync(() => {
      for (const position of everyPosition) {
        const correlative = correlativePosition(position);
        expect(correlative.kind).not.toBe(position.kind);
        expect(legalActContentEquivalence(correlative.content, position.content)).toBe(true);
      }
    })
  );

  it.effect("cannot be applied to a kind alone or to content alone", () =>
    Effect.sync(() => {
      // @ts-expect-error - the derivation is defined over (kind, content); a kind-only map is unrepresentable.
      const kindOnly: (kind: HohfeldPositionKind) => HohfeldPositionKind = oppositePosition;
      // @ts-expect-error - the derivation is defined over (kind, content); a content-only map is unrepresentable.
      const contentOnly: (content: LegalActContent) => LegalActContent = oppositePosition;
      // @ts-expect-error - the correlative derivation is likewise defined only over the pair.
      const correlativeKindOnly: (kind: HohfeldPositionKind) => HohfeldPositionKind = correlativePosition;
      expect(typeof kindOnly).toBe("function");
      expect(typeof contentOnly).toBe("function");
      expect(typeof correlativeKindOnly).toBe("function");
    })
  );

  it.effect("expose no half-derivation on the domain surface", () =>
    Effect.sync(() => {
      const halves = ["correlativeKind", "oppositeKind", "negatedPolarity"];
      const exported: [
        Extract<keyof typeof LawPracticeDomain, "correlativeKind" | "oppositeKind" | "negatedPolarity">,
      ] extends [never]
        ? true
        : false = true;
      expect(exported).toBe(true);
      expect(A.filter(halves, (half) => Object.hasOwn(LawPracticeDomain, half))).toEqual([]);
    })
  );
});

// ---------------------------------------------------------------------------
// Admission
// ---------------------------------------------------------------------------

describe("LegalPositionRelatorPolicy — admission", () => {
  layer(LegalPositionRelatorPolicyLive)((it) => {
    it.effect("admits a complete advantage-side record", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const relator = yield* policy.admit(PRIVILEGE_TO_ENTER);
        expect(relator.positionKind).toBe("privilege");
        expect(relator.bearer.player).toBe(1);
        expect(relator.counterparty.player).toBe(2);
      })
    );

    it.effect("refuses a record missing any one required field, naming the field it refused", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const refusals = yield* Effect.forEach(REQUIRED_RELATOR_FIELDS, (field) =>
          policy.admit(R.remove(PRIVILEGE_TO_ENTER, field)).pipe(
            Effect.flip,
            Effect.map((error) => ({ field, message: error.message, tag: error._tag }))
          )
        );

        expect(A.length(refusals)).toBe(A.length(REQUIRED_RELATOR_FIELDS));
        for (const refusal of refusals) {
          expect(refusal.tag).toBe("LegalPositionRelatorAdmissionError");
          expect(refusal.message).toContain(`["${refusal.field}"]`);
        }
      })
    );

    it.effect("refuses a burden-side stored position kind", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const refusal = yield* policy.admit({ ...PRIVILEGE_TO_ENTER, positionKind: "duty" }).pipe(Effect.flip);
        expect(refusal._tag).toBe("LegalPositionRelatorAdmissionError");
        expect(refusal.message).toContain(`["positionKind"]`);
      })
    );
  });
});

// ---------------------------------------------------------------------------
// One stored relation, both views
// ---------------------------------------------------------------------------

describe("LegalPositionRelatorPolicy — one stored relation, every other reading derived", () => {
  layer(LegalPositionRelatorPolicyLive)((it) => {
    it.effect("derives both views from a single record, and neither view is storable", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const stored = yield* policy.admit(PRIVILEGE_TO_ENTER);

        const correlative = policy.correlativeView(stored);
        const opposite = policy.oppositeView(stored);

        // The cross-party reading: same relation, other end, content untouched.
        expect(correlative.viewKind).toBe("correlative");
        expect(correlative.relator).toBe(stored.id);
        expect(correlative.bearer.player).toBe(stored.counterparty.player);
        expect(correlative.counterparty.player).toBe(stored.bearer.player);
        expect(correlative.position.kind).toBe("noRight");
        expect(legalActContentEquivalence(correlative.position.content, stored.content)).toBe(true);

        // The same-party negation: roles stay put, kind and polarity move together.
        expect(opposite.viewKind).toBe("opposite");
        expect(opposite.relator).toBe(stored.id);
        expect(opposite.bearer.player).toBe(stored.bearer.player);
        expect(opposite.counterparty.player).toBe(stored.counterparty.player);
        expect(opposite.position.kind).toBe("duty");
        expect(opposite.position.content.polarity).toBe("omission");
        expect(opposite.position.content.description).toBe(stored.content.description);

        // Both views are burden-side, so neither could ever have been stored,
        // and the one stored relation is exactly what it was.
        expect(HashSet.has(AdvantagePositionKind.HashSet, correlative.position.kind)).toBe(false);
        expect(HashSet.has(AdvantagePositionKind.HashSet, opposite.position.kind)).toBe(false);
        expect(stored.positionKind).toBe("privilege");
        expect(stored.content.polarity).toBe("act");
      })
    );
  });
});

// ---------------------------------------------------------------------------
// The scope-overlap-and-opposition check
// ---------------------------------------------------------------------------

describe("LegalPositionRelatorPolicy — scope overlap and prima facie opposition", () => {
  layer(LegalPositionRelatorPolicyLive)((it) => {
    it.effect("emits nothing for Hohfeld's coexisting privilege(enter) and duty(enter)", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const privilege = yield* policy.admit(PRIVILEGE_TO_ENTER);
        const claim = yield* policy.admit(CLAIM_THAT_X_ENTERS);

        // X's duty(enter+) is the derived correlative of Y's stored claim, and
        // it lands on the same kind as X's own opposite view — but on the other
        // polarity, which is exactly why the two coexist.
        const opposite = policy.oppositeView(privilege);
        const correlative = policy.correlativeView(claim);
        expect(opposite.position.kind).toBe("duty");
        expect(correlative.position.kind).toBe("duty");
        expect(opposite.bearer.player).toBe(correlative.bearer.player);
        expect(opposite.position.content.polarity).toBe("omission");
        expect(correlative.position.content.polarity).toBe("act");

        expect(HashSet.size(policy.screenForOpposition([privilege, claim]))).toBe(0);
      })
    );

    it.effect("emits exactly one candidate for a genuinely opposite pair within an overlapping scope", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const privilege = yield* policy.admit(PRIVILEGE_TO_ENTER);
        const claim = yield* policy.admit(CLAIM_THAT_X_REFRAINS);

        const opposite = policy.oppositeView(privilege);
        const correlative = policy.correlativeView(claim);
        expect(opposite.position.kind).toBe(correlative.position.kind);
        expect(legalActContentEquivalence(opposite.position.content, correlative.position.content)).toBe(true);

        // The whole emission is asserted, not one sampled member: exactly one
        // candidate, carrying the unordered pair and the values that qualified it.
        const expected = LegalOppositionCandidateInput.make({
          act: ACT,
          overlappingScope: LegalScopeContext.make({
            material: HashSet.make("the demised premises"),
            quantitative: HashSet.make("unlimited"),
            subjective: HashSet.make("the lessor"),
            temporal: HashSet.make("the term of the lease"),
            territorial: HashSet.make("US-CA"),
          }),
          relators: HashSet.make(privilege.id, claim.id),
        });

        const candidates = policy.screenForOpposition([privilege, claim]);
        expect(HashSet.size(candidates)).toBe(1);
        expect(Equal.equals(candidates, HashSet.make(expected))).toBe(true);
      })
    );

    it.effect("emits nothing for an opposite pair whose scopes miss on a single axis", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const privilege = yield* policy.admit(PRIVILEGE_TO_ENTER);
        const claim = yield* policy.admit(CLAIM_THAT_X_REFRAINS_ELSEWHERE);

        const opposite = policy.oppositeView(privilege);
        const correlative = policy.correlativeView(claim);
        expect(opposite.position.kind).toBe(correlative.position.kind);
        expect(legalActContentEquivalence(opposite.position.content, correlative.position.content)).toBe(true);

        expect(HashSet.size(policy.screenForOpposition([privilege, claim]))).toBe(0);
      })
    );

    it.effect("emits one unordered candidate per pair however the relations are ordered", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const privilege = yield* policy.admit(PRIVILEGE_TO_ENTER);
        const claim = yield* policy.admit(CLAIM_THAT_X_REFRAINS);

        const forwards = policy.screenForOpposition([privilege, claim]);
        const backwards = policy.screenForOpposition([claim, privilege]);
        expect(HashSet.size(backwards)).toBe(1);
        expect(Equal.equals(forwards, backwards)).toBe(true);
      })
    );

    it.effect("emits nothing for a single relation, which is never opposed to itself", () =>
      Effect.gen(function* () {
        const policy = yield* LegalPositionRelatorPolicy;
        const privilege = yield* policy.admit(PRIVILEGE_TO_ENTER);
        expect(HashSet.size(policy.screenForOpposition([privilege]))).toBe(0);
        expect(HashSet.size(policy.screenForOpposition([]))).toBe(0);
      })
    );
  });
});
