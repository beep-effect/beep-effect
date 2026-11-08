import { antecedentPolicy, decomposeClaim } from "@beep/law-practice-domain/values/ClaimElement";
import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument";
import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Str from "effect/String";
import { inspectRoleTexts } from "./helpers/ClaimElementRoleInspection.ts";
import type { ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";

// Every claim text is synthetic. Padding lengths place one invocation's work
// boundary inside a specific reservation; each case keeps a control input
// that differs only in size and still yields its ordinary verdict.
const pad = (character: string, length: number): string => Str.repeat(length)(character);

type Row = readonly [kind: string, rule: string, path: string, quote: string];
const findingsOf = (report: ClaimInputInspectionReport): ReadonlyArray<Row> =>
  A.flatMap(report.records, (record) =>
    record.status === "unchecked"
      ? []
      : A.map(record.findings, ({ kind, rule, referring }): Row => [kind, rule, referring.path, referring.anchor.quote])
  );
const limited = (report: ClaimInputInspectionReport, path: string): boolean =>
  A.some(
    findingsOf(report),
    ([kind, rule, findingPath]) => kind === "pattern-not-covered" && rule === "chain-work-limit" && findingPath === path
  );

// Source-role input budget: the role index declines as a whole, so every
// checked record falls back to explicit policy-uncovered coverage.
const plateClaim = (length: number): string => `A system comprising a plate${pad("x", length)}.`;
const roleBudgetTexts = (length: number, tail: ReadonlyArray<string>): A.NonEmptyReadonlyArray<string> =>
  A.appendAll(A.prepend(A.replicate(plateClaim(6000), 5), plateClaim(length)), tail);
const allPolicyUncovered = (report: ClaimInputInspectionReport): boolean =>
  A.every(
    report.records,
    (record) => record.status === "partial" && A.some(record.coverage, (issue) => issue.kind === "policy-uncovered")
  );
const allComplete = (report: ClaimInputInspectionReport): boolean =>
  A.every(report.records, (record) => record.status === "complete");

describe("role-aware inspection abstains when source-role reservation is exhausted", () => {
  const plate = ["A system comprising a plate."];
  const cases: ReadonlyArray<readonly [name: string, length: number, tail: ReadonlyArray<string>]> = [
    ["dependency propagation", 2399, plate],
    ["context-ready scan", 2400, plate],
    ["context budget", 2408, plate],
    ["nominal quote reservation", 2425, plate],
    ["public candidate quote", 2432, plate],
    ["candidate state slot", 2456, plate],
    ["plan header", 2457, plate],
    ["private candidate", 2426, ["A system comprising a plate is formed of plastic."]],
    ["alternative branch quotes", 2411, ["A system comprising a sensor or valve."]],
    ["alternative branch slots", 2416, ["A system comprising a sensor or valve."]],
    [
      "proof slots",
      2361,
      ["The system of claim 1, wherein the plate is mounted.", "A system comprising a sensor or valve."],
    ],
  ];
  for (const [name, length, tail] of cases)
    it.effect(`declines source roles at the ${name}`, () =>
      Effect.gen(function* () {
        const control = yield* inspectRoleTexts(roleBudgetTexts(2000, plate));
        assert.isTrue(allComplete(control));
        const report = yield* inspectRoleTexts(roleBudgetTexts(length, tail));
        assert.strictEqual(report.records.length, 7 + tail.length - 1);
        assert.isTrue(allPolicyUncovered(report));
        const repeated = yield* inspectRoleTexts(roleBudgetTexts(length, tail));
        assert.deepStrictEqual(repeated, report);
      })
    );
});

// Deep dependency chain: the final claim repeats one referring term.
const deepTexts = (references: number, depth: number): A.NonEmptyReadonlyArray<string> =>
  A.prepend(
    A.map(A.range(2, depth), (number) => {
      const body = number === depth ? `${A.join(A.replicate("the sensor1", references), "; ")}.` : `a sensor${number}.`;
      return `A system of claim ${number - 1} wherein ${body}`;
    }),
    "A system comprising a sensor1."
  );
// An alternative source branch and a private description candidate in claim 1.
const alternativeTexts = (head: number, privateCore = 0): A.NonEmptyReadonlyArray<string> => [
  `A system comprising a sensor or valve; a plate${pad("z", privateCore)} is formed of plastic.`,
  `The system of claim 1, wherein the valve${pad("x", head)} is mounted.`,
];
// An independent filler claim drains work before claim 3 scans claim 1's branch.
const filler = (references: number): string =>
  `A system comprising a plate; ${A.join(A.replicate("the plate", references), "; ")}.`;
const drainedAlternativeTexts = (core: number): A.NonEmptyReadonlyArray<string> => [
  `A system comprising a sensor${pad("y", core)} or valve.`,
  filler(23),
  "The system of claim 1, wherein the valve is mounted.",
];
const aliasTexts = (references: number, head: number): A.NonEmptyReadonlyArray<string> => [
  "A system comprising a motion vector list (MVL).",
  filler(references),
  `The system of claim 1, wherein the cover${pad("x", head)} is mounted; MVL is mounted.`,
];

describe("role-aware antecedent reads abstain at every work reservation", () => {
  it.effect("deep chains abstain at alias, lookup and role-scan reservations", () =>
    Effect.gen(function* () {
      const control = yield* inspectRoleTexts(deepTexts(10, 64));
      assert.deepStrictEqual(findingsOf(control), []);
      for (const [references, depth] of [
        [42, 64],
        [45, 64],
        [82, 30],
      ] as const) {
        const report = yield* inspectRoleTexts(deepTexts(references, depth));
        const rows = findingsOf(report);
        // Earlier references keep their clean verdict; the budget stops a later one.
        assert.isFalse(A.some(rows, ([, , path]) => path === `${depth}.a`));
        assert.isTrue(A.isReadonlyArrayNonEmpty(rows));
        assert.isTrue(
          A.every(
            rows,
            ([kind, rule, path]) =>
              kind === "pattern-not-covered" && rule === "chain-work-limit" && Str.startsWith(`${depth}.`)(path)
          )
        );
      }
    })
  );
  it.effect("alternative and private route scans abstain instead of resolving", () =>
    Effect.gen(function* () {
      const control = yield* inspectRoleTexts(alternativeTexts(100));
      assert.deepStrictEqual(
        A.filter(findingsOf(control), ([, , path]) => path === "2.a"),
        [["missing-antecedent", "definite-without-introduction", "2.a", `the valve${pad("x", 100)}`]]
      );
      for (const [head, privateCore] of [
        [420, 8],
        [420, 12],
        [420, 14],
        [450, 0],
        [600, 0],
      ] as const) {
        const report = yield* inspectRoleTexts(alternativeTexts(head, privateCore));
        assert.isTrue(limited(report, "2.a"));
        assert.isFalse(A.some(findingsOf(report), ([kind]) => kind === "missing-antecedent"));
      }
    })
  );
  it.effect("a drained invocation abstains while scanning an earlier alternative branch", () =>
    Effect.gen(function* () {
      const control = yield* inspectRoleTexts(drainedAlternativeTexts(0));
      assert.deepStrictEqual(
        A.filter(findingsOf(control), ([, , path]) => path === "3.a"),
        [["pattern-not-covered", "source-role-unresolved", "3.a", "the valve"]]
      );
      for (const core of [169, 170]) {
        const report = yield* inspectRoleTexts(drainedAlternativeTexts(core));
        assert.isTrue(limited(report, "3.a"));
      }
    })
  );
  it.effect("an acronym reference abstains while its alias donor route is reserved", () =>
    Effect.gen(function* () {
      const control = yield* inspectRoleTexts(aliasTexts(0, 0));
      assert.isFalse(A.some(findingsOf(control), ([, , path]) => path === "3.b"));
      for (const head of [390, 396]) {
        const report = yield* inspectRoleTexts(aliasTexts(52, head));
        assert.isTrue(limited(report, "3.b"));
        assert.isTrue(A.some(findingsOf(report), ([kind, , path]) => kind === "missing-antecedent" && path === "3.a"));
      }
    })
  );
});

describe("source-prefix acronym aliases", () => {
  it.effect("resolves a bare acronym through its explicit source expansion", () =>
    Effect.gen(function* () {
      const report = yield* inspectRoleTexts([
        "A system comprising a motion vector list (MVL).",
        "The system of claim 1, wherein MVL is mounted.",
      ]);
      assert.deepStrictEqual(
        A.map(report.records, ({ status }) => status),
        ["complete", "complete"]
      );
      assert.deepStrictEqual(findingsOf(report), []);
    })
  );
  it.effect("does not let an unrelated acronym-shaped reference borrow an expansion", () =>
    Effect.gen(function* () {
      const report = yield* inspectRoleTexts([
        "A system comprising a motion vector list (MVL).",
        "The system of claim 1, wherein MVL sensor is mounted.",
      ]);
      assert.deepStrictEqual(findingsOf(report), [
        ["pattern-not-covered", "unsupported-determiner", "2.a", "MVL sensor"],
      ]);
    })
  );
  it.effect("keeps a same-claim acronym before its expansion unresolved", () =>
    Effect.gen(function* () {
      const report = yield* inspectRoleTexts(["A system comprising MVL coupled to a motion vector list (MVL)."]);
      assert.isTrue(
        A.some(
          findingsOf(report),
          ([kind, rule, , quote]) =>
            kind === "pattern-not-covered" && quote === "MVL" && rule === "unsupported-determiner"
        )
      );
    })
  );
});

describe("source-role reference shapes", () => {
  it.effect("reads a demonstrative reference through its stripped head", () =>
    Effect.gen(function* () {
      const resolved = yield* inspectRoleTexts([
        "A system comprising a plate.",
        "The system of claim 1, wherein this plate is mounted.",
      ]);
      assert.deepStrictEqual(findingsOf(resolved), []);
      const missing = yield* inspectRoleTexts([
        "A system comprising a plate.",
        "The system of claim 1, wherein this cover is mounted.",
      ]);
      assert.deepStrictEqual(findingsOf(missing), [
        ["missing-antecedent", "definite-without-introduction", "2.a", "this cover"],
      ]);
    })
  );
  it.effect("skips a route claim without a source plan while checking private candidates", () =>
    Effect.gen(function* () {
      const report = yield* inspectRoleTexts([
        "A system comprising a plate is formed of plastic.",
        "The system of claim 1, wherein the plate is formed of one of foam or wood.",
        "The system of claim 2, wherein the plate is mounted.",
      ]);
      assert.deepStrictEqual(findingsOf(report), []);
      assert.isTrue(allPolicyUncovered(report));
    })
  );
});

describe("ambiguous introductions", () => {
  it.effect("lists every same-head introduction as a candidate", () =>
    Effect.gen(function* () {
      const body = "a sensor; a sensor; a sensor; the sensor.";
      const claim = PatentClaim.cases.independent.make({
        claimNumber: 1,
        claimText: `A system comprising ${body}`,
        preamble: "A system",
        transition: "comprising",
        body,
      });
      const tree = yield* decomposeClaim(claim, [claim]);
      const findings = antecedentPolicy([tree], [claim]);
      assert.deepStrictEqual(
        A.map(findings, (finding) =>
          finding.kind === "ambiguous-antecedent"
            ? [finding.rule, A.map(finding.candidates, ({ anchor }) => anchor.startChar)]
            : [finding.rule, []]
        ),
        [["multiple-introductions", [20, 30, 40]]]
      );
    })
  );
});
