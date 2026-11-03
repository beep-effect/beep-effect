import {
  AntecedentFinding,
  AntecedentFindingKind,
  AntecedentRuleId,
  ClaimElement,
  ClaimElementEdge,
  ClaimElementEdgeKind,
  ClaimElementProducer,
  ClaimElementTree,
  ClaimTerm,
  ClaimTermDeterminer,
  ClaimTermHead,
  ClaimTermRef,
} from "@beep/law-practice-domain/values/ClaimElement";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { constant, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

// Claim 1: "A system comprising an optical sensor and a processor configured to read the optical sensor."
// Claim 2: "The system of claim 1, wherein the lever is coupled to the processor."
const claimOneText = "A system comprising an optical sensor and a processor configured to read the optical sensor.";
const anchorIn = (text: string, quote: string, from = 0) => {
  const startChar = pipe(
    text,
    Str.slice(from),
    Str.indexOf(quote),
    O.map((index) => index + from),
    O.getOrElse(constant(-1))
  );
  return { startChar, endChar: startChar + quote.length, quote };
};

const systemAnchor = anchorIn(claimOneText, "A system");
const sensorAnchor = anchorIn(claimOneText, "an optical sensor");
const processorClauseAnchor = anchorIn(claimOneText, "a processor configured to read the optical sensor");
const processorAnchor = anchorIn(claimOneText, "a processor");
const sensorBackAnchor = anchorIn(claimOneText, "the optical sensor");
const connectAnchor = anchorIn(claimOneText, "configured to read");

const claimOneTree = {
  claimNumber: 1,
  producer: "rule",
  elements: [
    {
      path: "1",
      anchor: systemAnchor,
      kind: "preamble-subject",
      terms: [{ anchor: systemAnchor, determiner: "a", head: "system" }],
    },
    {
      path: "1.a",
      anchor: sensorAnchor,
      kind: "limitation",
      terms: [{ anchor: sensorAnchor, determiner: "an", head: "optical sensor" }],
    },
    {
      path: "1.b",
      anchor: processorClauseAnchor,
      kind: "functional-relation",
      terms: [
        { anchor: processorAnchor, determiner: "a", head: "processor" },
        { anchor: sensorBackAnchor, determiner: "the", head: "optical sensor" },
      ],
    },
  ],
  edges: [
    { kind: "part-of", child: "1.a", parent: "1" },
    { kind: "part-of", child: "1.b", parent: "1" },
    {
      kind: "antecedent",
      referring: { path: "1.b", anchor: sensorBackAnchor },
      introducing: { path: "1.a", anchor: sensorAnchor },
    },
    {
      kind: "functional",
      element: "1.b",
      parts: [
        { kind: "term", term: { path: "1.b", anchor: processorAnchor } },
        { kind: "text", anchor: connectAnchor },
        { kind: "term", term: { path: "1.b", anchor: sensorBackAnchor } },
      ],
    },
  ],
};

const leverRef = { path: "2", anchor: { startChar: 31, endChar: 40, quote: "the lever" } };
const introRef = { path: "1.a", anchor: sensorAnchor };
const siblingRef = { path: "3", anchor: { startChar: 31, endChar: 38, quote: "a lever" } };
const processorRef = { path: "1.b", anchor: processorAnchor };

const edgeFixtures = [
  { kind: "part-of", child: "1.a", parent: "1" },
  { kind: "depends-on-element", dependent: "2", ancestor: "1" },
  { kind: "antecedent", referring: { path: "2", anchor: sensorBackAnchor }, introducing: introRef },
  { kind: "functional", element: "1.b", parts: [{ kind: "text", anchor: connectAnchor }] },
] as const;

const findingFixtures = [
  { kind: "missing-antecedent", rule: "definite-without-introduction", referring: leverRef, chain: [2, 1] },
  {
    kind: "ambiguous-antecedent",
    rule: "definite-multiple-introductions",
    referring: leverRef,
    chain: [2, 1],
    candidates: [introRef, processorRef],
  },
  {
    kind: "antecedent-outside-chain",
    rule: "introduction-in-sibling-claim",
    referring: leverRef,
    chain: [2, 1],
    introducing: siblingRef,
  },
  {
    kind: "number-mismatch",
    rule: "plurality-referred-as-singular",
    referring: leverRef,
    chain: [2, 1],
    introducing: introRef,
  },
  { kind: "pattern-not-covered", rule: "no-rule-matched", referring: leverRef },
] as const;

const ClaimNumberSample = S.Int.check(S.isBetween({ minimum: 2, maximum: 40 }));
const StepSample = S.Int.check(S.isBetween({ minimum: 1, maximum: 3 }));
const OffsetSample = S.Int.check(S.isBetween({ minimum: 0, maximum: 500 }));
const limitationLetters = ["a", "b", "c", "d"] as const;

const anchorAt = (startChar: number, quote: string) => ({ startChar, endChar: startChar + quote.length, quote });

// The surface each determiner recites; a bare term recites none.
const surfaceOf = (determiner: ClaimTermDeterminer): string =>
  ({
    a: "a ",
    an: "an ",
    the: "the ",
    said: "said ",
    "at-least-one": "at least one ",
    "plurality-of": "a plurality of ",
    bare: "",
  })[determiner];

// A bare head must not open with a determiner word, or its quote would recite one.
const bareSafeHead = (head: string): string =>
  /^(?:a|an|the|said|at|one|plurality)(?:\s|$)/u.test(head) ? `x${head}` : head;

const termSample = Arbitrary.map(
  Arbitrary.all({
    determiner: Arbitrary.schema(ClaimTermDeterminer),
    head: Arbitrary.schema(ClaimTermHead),
  }),
  ({ determiner, head }) => ({ determiner, head: bareSafeHead(head) })
);

// Coherent claim-element trees: element paths derive from the claim number and
// edges are built only over those paths, so the coherence check always holds.
const coherentTreeInput = Arbitrary.map(
  Arbitrary.all({
    claimNumber: Arbitrary.schema(ClaimNumberSample),
    producer: Arbitrary.schema(ClaimElementProducer),
    firstTerm: termSample,
    restTerms: Arbitrary.array(termSample, { maxLength: limitationLetters.length - 1 }),
  }),
  ({ claimNumber, producer, firstTerm, restTerms }) => {
    const root = `${claimNumber}`;
    const preamble = anchorAt(0, "A system");
    const [, limitations] = A.mapAccum(
      A.prepend(restTerms, firstTerm),
      preamble.endChar + 2,
      (start, { determiner, head }, index) => {
        const term = anchorAt(start, `${surfaceOf(determiner)}${head}`);
        const text = anchorAt(term.endChar + 1, "linked");
        return [
          text.endChar + 2,
          { path: `${root}.${limitationLetters[index]}`, term: { anchor: term, determiner, head }, text },
        ] as const;
      }
    );
    const first = A.headNonEmpty(limitations);
    const last = A.lastNonEmpty(limitations);
    const elements = [
      {
        path: root,
        anchor: preamble,
        kind: "preamble-subject",
        terms: [{ anchor: preamble, determiner: "a", head: "system" }],
      },
      ...A.map(limitations, ({ path, term, text }) => ({
        path,
        anchor: anchorAt(term.anchor.startChar, `${term.anchor.quote} ${text.quote}`),
        kind: path === last.path ? "functional-relation" : "limitation",
        terms: [term],
      })),
    ];
    const edges = [
      ...A.map(limitations, ({ path }) => ({ kind: "part-of", child: path, parent: root })),
      { kind: "depends-on-element", dependent: root, ancestor: `${claimNumber - 1}` },
      {
        kind: "antecedent",
        referring: { path: last.path, anchor: last.term.anchor },
        introducing: { path: first.path, anchor: first.term.anchor },
      },
      {
        kind: "antecedent",
        referring: { path: first.path, anchor: first.term.anchor },
        introducing: { path: `${claimNumber - 1}.a`, anchor: anchorAt(0, "a cog") },
      },
      {
        kind: "functional",
        element: last.path,
        parts: [
          { kind: "term", term: { path: last.path, anchor: last.term.anchor } },
          { kind: "text", anchor: last.text },
        ],
      },
    ];
    return { claimNumber, producer, elements, edges };
  }
);

// Valid findings: the chain starts at the referring claim and strictly
// decreases; ambiguous candidates sit at distinct paths.
const validFindingInput = Arbitrary.map(
  Arbitrary.all({
    kind: Arbitrary.schema(AntecedentFindingKind),
    rule: Arbitrary.schema(AntecedentRuleId),
    claimNumber: Arbitrary.schema(ClaimNumberSample),
    steps: Arbitrary.array(Arbitrary.schema(StepSample), { maxLength: 4 }),
    quotes: Arbitrary.array(Arbitrary.schema(ClaimTermHead), { minLength: 3, maxLength: 3 }),
    offset: Arbitrary.schema(OffsetSample),
  }),
  ({ kind, rule, claimNumber, steps, quotes, offset }) => {
    const chain = A.reduce(steps, A.of(claimNumber), (built, step) =>
      A.lastNonEmpty(built) - step > 0 ? A.append(built, A.lastNonEmpty(built) - step) : built
    );
    const [referringQuote, firstQuote, secondQuote] = quotes;
    const referring = { path: `${claimNumber}.a`, anchor: anchorAt(offset, `the ${referringQuote}`) };
    const introducing = { path: `${claimNumber}.b`, anchor: anchorAt(offset, `a ${firstQuote}`) };
    const other = { path: `${claimNumber}.c`, anchor: anchorAt(offset, `a ${secondQuote}`) };
    return AntecedentFindingKind.match(kind, {
      "missing-antecedent": () => ({ kind, rule, referring, chain }),
      "ambiguous-antecedent": () => ({ kind, rule, referring, chain, candidates: [introducing, other] }),
      "antecedent-outside-chain": () => ({ kind, rule, referring, chain, introducing }),
      "number-mismatch": () => ({ kind, rule, referring, chain, introducing }),
      "pattern-not-covered": () => ({ kind, rule, referring }),
    });
  }
);

const decodeTree = S.decodeUnknownEffect(ClaimElementTree);
const decodeEdge = S.decodeUnknownEffect(ClaimElementEdge);
const decodeFinding = S.decodeUnknownEffect(AntecedentFinding);

const roundTrips = Effect.fn("roundTrips")(function* <A, I>(schema: S.Codec<A, I>, value: A) {
  const encoded = yield* S.encodeEffect(schema)(value);
  const decoded = yield* S.decodeUnknownEffect(schema)(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
});

const rejects =
  <A, I>(schema: S.Codec<A, I>) =>
  (input: unknown) =>
    Effect.map(Effect.exit(S.decodeUnknownEffect(schema)(input)), Exit.isFailure);

describe("ClaimElement", () => {
  it.effect("decodes and round-trips a claim-element tree", () =>
    Effect.gen(function* () {
      const tree = yield* decodeTree(claimOneTree);
      expect(tree.elements.length).toBe(3);
      expect(A.map(tree.edges, ({ kind }) => kind)).toEqual(["part-of", "part-of", "antecedent", "functional"]);
      const value1 = yield* S.encodeEffect(ClaimElementTree)(tree);
      expect(value1).toEqual(claimOneTree);
      yield* roundTrips(ClaimElementTree, tree);
    })
  );

  it.effect("rejects incoherent trees", () =>
    Effect.gen(function* () {
      const tree = rejects(ClaimElementTree);
      const results = yield* Effect.all([
        tree({ ...claimOneTree, elements: [{ ...claimOneTree.elements[0], path: "2" }], edges: [] }),
        tree({ ...claimOneTree, elements: [claimOneTree.elements[0], claimOneTree.elements[0]], edges: [] }),
        tree({ ...claimOneTree, edges: [{ kind: "part-of", child: "1.z", parent: "1" }] }),
        tree({ ...claimOneTree, elements: [] }),
        tree({ ...claimOneTree, producer: "model" }),
        // two terms of one element overlap
        tree({
          ...claimOneTree,
          edges: [],
          elements: [
            claimOneTree.elements[0],
            claimOneTree.elements[1],
            {
              ...claimOneTree.elements[2],
              terms: [
                { anchor: processorClauseAnchor, determiner: "a", head: "processor" },
                { anchor: processorAnchor, determiner: "a", head: "processor" },
              ],
            },
          ],
        }),
      ]);
      expect(results).toEqual(A.replicate(true, results.length));
    })
  );

  it.effect("rejects edges whose endpoints or shapes contradict the tree", () =>
    Effect.gen(function* () {
      const withEdge = (edge: unknown) => rejects(ClaimElementTree)({ ...claimOneTree, edges: [edge] });
      const sensorRef = { path: "1.b", anchor: sensorBackAnchor };
      const results = yield* Effect.all([
        // claim-local introducing path that names no element
        withEdge({ kind: "antecedent", referring: sensorRef, introducing: { path: "1.z", anchor: sensorAnchor } }),
        // introduction in a later claim
        withEdge({ kind: "antecedent", referring: sensorRef, introducing: { path: "3", anchor: sensorAnchor } }),
        // referring term outside this claim
        withEdge({ kind: "antecedent", referring: { path: "2", anchor: sensorBackAnchor }, introducing: introRef }),
        // referring anchor that names no term of its element
        withEdge({
          kind: "antecedent",
          referring: { path: "1.b", anchor: { startChar: 50, endChar: 53, quote: "abc" } },
          introducing: introRef,
        }),
        // dependency on the tree's own claim
        withEdge({ kind: "depends-on-element", dependent: "1.a", ancestor: "1" }),
        // dependency on a dangling element of the tree's own claim
        withEdge({ kind: "depends-on-element", dependent: "1.a", ancestor: "1.z" }),
        // dependency on a later claim
        withEdge({ kind: "depends-on-element", dependent: "1.a", ancestor: "5" }),
        // functional term part that names no element
        withEdge({
          kind: "functional",
          element: "1.b",
          parts: [{ kind: "term", term: { path: "1.q", anchor: processorAnchor } }],
        }),
        // functional term part that names a term of another element
        withEdge({
          kind: "functional",
          element: "1.b",
          parts: [{ kind: "term", term: { path: "1.a", anchor: sensorAnchor } }],
        }),
        // functional connecting text outside the element it is read from
        withEdge({
          kind: "functional",
          element: "1.b",
          parts: [{ kind: "text", anchor: anchorIn(claimOneText, "comprising") }],
        }),
        // functional edge read from a non-functional element
        withEdge({ kind: "functional", element: "1.a", parts: [{ kind: "text", anchor: connectAnchor }] }),
        // part-of self-loop
        withEdge({ kind: "part-of", child: "1", parent: "1" }),
        // part-of child not nested under its parent
        withEdge({ kind: "part-of", child: "1.a", parent: "1.b" }),
        // term outside its element's span
        rejects(ClaimElementTree)({
          ...claimOneTree,
          elements: [
            claimOneTree.elements[0],
            {
              ...claimOneTree.elements[1],
              terms: [{ anchor: processorAnchor, determiner: "a", head: "processor" }],
            },
            claimOneTree.elements[2],
          ],
          edges: [],
        }),
      ]);
      expect(results).toEqual(A.replicate(true, results.length));
    })
  );

  it.effect("accepts ancestor-side endpoints outside the tree", () =>
    Effect.gen(function* () {
      const tree = yield* decodeTree({
        claimNumber: 2,
        producer: "human",
        elements: [
          {
            path: "2",
            anchor: leverRef.anchor,
            kind: "limitation",
            terms: [{ anchor: leverRef.anchor, determiner: "the", head: "lever" }],
          },
        ],
        edges: [
          { kind: "depends-on-element", dependent: "2", ancestor: "1" },
          { kind: "antecedent", referring: leverRef, introducing: introRef },
        ],
      });
      expect(tree.claimNumber).toBe(2);
    })
  );

  it.effect("rejects malformed paths, heads, determiners, and anchors", () =>
    Effect.gen(function* () {
      const term = rejects(ClaimTerm);
      const termRef = rejects(ClaimTermRef);
      const results = yield* Effect.all([
        term({ anchor: sensorAnchor, determiner: "an", head: "Optical sensor" }),
        term({ anchor: sensorAnchor, determiner: "an", head: "optical  sensor" }),
        term({ anchor: sensorAnchor, determiner: "some", head: "optical sensor" }),
        term({ anchor: sensorAnchor, determiner: "the", head: "optical sensor" }),
        term({ anchor: sensorAnchor, determiner: "at-least-one", head: "optical sensor" }),
        term({ anchor: sensorAnchor, determiner: "bare", head: "optical sensor" }),
        term({ anchor: anchorAt(0, "a plurality of sensors"), determiner: "a", head: "plurality of sensors" }),
        term({ anchor: { startChar: 0, endChar: 3, quote: "an optical" }, determiner: "an", head: "x" }),
        termRef({ path: "b.ii", anchor: sensorAnchor }),
        termRef({ path: "0.a", anchor: sensorAnchor }),
      ]);
      expect(results).toEqual(A.replicate(true, results.length));
    })
  );

  it.effect("decodes every edge kind", () =>
    Effect.gen(function* () {
      const edges = yield* Effect.forEach(edgeFixtures, (edge) => decodeEdge(edge));
      expect(A.map(edges, ({ kind }) => kind)).toEqual(ClaimElementEdgeKind.literals);
    })
  );

  it.effect("decodes every finding kind", () =>
    Effect.gen(function* () {
      const findings = yield* Effect.forEach(findingFixtures, (finding) => decodeFinding(finding));
      expect(A.map(findings, ({ kind }) => kind)).toEqual(AntecedentFindingKind.literals);
      expect(A.every(findings, (finding) => finding.referring.anchor.quote === "the lever")).toBe(true);
    })
  );

  it.effect("decodes missing-antecedent and pattern-not-covered without an introducing span", () =>
    Effect.gen(function* () {
      const missing = yield* decodeFinding(findingFixtures[0]);
      const uncovered = yield* decodeFinding(findingFixtures[4]);
      expect("introducing" in missing).toBe(false);
      expect("candidates" in missing).toBe(false);
      expect("introducing" in uncovered).toBe(false);
      expect("chain" in uncovered).toBe(false);
    })
  );

  it.effect("rejects malformed findings", () =>
    Effect.gen(function* () {
      const finding = rejects(AntecedentFinding);
      const edge = rejects(ClaimElementEdge);
      const results = yield* Effect.all([
        finding({ ...findingFixtures[1], candidates: [introRef] }),
        finding({ ...findingFixtures[1], candidates: [] }),
        finding({ kind: "unsupported-claim", rule: "x", referring: leverRef }),
        finding({ kind: "missing-antecedent", rule: "x", chain: [2, 1] }),
        finding({ ...findingFixtures[0], rule: "Not Kebab" }),
        finding({ ...findingFixtures[0], chain: [] }),
        finding({ kind: "number-mismatch", rule: "x", referring: leverRef, chain: [2, 1] }),
        finding({ ...findingFixtures[0], chain: [7, 7, 9] }),
        finding({ ...findingFixtures[0], chain: [2, 7] }),
        finding({ ...findingFixtures[0], chain: [3, 1] }),
        finding({ ...findingFixtures[3], chain: [2, 2] }),
        finding({ ...findingFixtures[1], candidates: [introRef, introRef] }),
        edge({ kind: "contains", child: "1.a", parent: "1" }),
        edge({ kind: "functional", element: "1.b", parts: [] }),
      ]);
      expect(results).toEqual(A.replicate(true, results.length));
    })
  );

  it.effect("accepts ambiguous-antecedent with three candidates", () =>
    Effect.gen(function* () {
      const finding = yield* decodeFinding({
        ...findingFixtures[1],
        candidates: [introRef, processorRef, siblingRef],
      });
      expect(AntecedentFinding.guards["ambiguous-antecedent"](finding) && finding.candidates.length).toBe(3);
    })
  );

  it.effect.prop(
    "round-trips schema-derived claim terms",
    { term: Arbitrary.schema(ClaimTerm) },
    ({ term }) => roundTrips(ClaimTerm, term),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived claim elements",
    { element: Arbitrary.schema(ClaimElement) },
    ({ element }) => roundTrips(ClaimElement, element),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "round-trips schema-derived edges",
    { edge: Arbitrary.schema(ClaimElementEdge) },
    ({ edge }) => roundTrips(ClaimElementEdge, edge),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "decodes and round-trips generated valid findings",
    { input: validFindingInput },
    ({ input }) =>
      Effect.gen(function* () {
        const finding = yield* decodeFinding(input);
        const value2 = yield* S.encodeEffect(AntecedentFinding)(finding);
        expect(value2).toEqual(input);
        yield* roundTrips(AntecedentFinding, finding);
      }),
    { arbitrary: fcRuns(20) }
  );

  it.effect.prop(
    "decodes and round-trips generated coherent trees",
    { input: coherentTreeInput },
    ({ input }) =>
      Effect.gen(function* () {
        const tree = yield* decodeTree(input);
        const value3 = yield* S.encodeEffect(ClaimElementTree)(tree);
        expect(value3).toEqual(input);
        yield* roundTrips(ClaimElementTree, tree);
      }),
    { arbitrary: fcRuns(20) }
  );
});
