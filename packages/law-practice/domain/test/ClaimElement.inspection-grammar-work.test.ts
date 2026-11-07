import { it } from "@beep/test-runner";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { inspectPlainTexts, inspectRoleTexts, rolePlansOf } from "./helpers/ClaimElementRoleInspection.ts";
import type { ClaimInputInspectionReport } from "@beep/law-practice-domain/values/ClaimElement";

// Every claim text is synthetic.
type Summary = readonly [statuses: ReadonlyArray<string>, findings: ReadonlyArray<readonly [string, string]>];
const summarize = (report: ClaimInputInspectionReport): Summary => [
  A.map(report.records, ({ status }) => status),
  A.flatMap(report.records, (record) =>
    record.status === "unchecked"
      ? []
      : A.map(record.findings, ({ rule, referring }): readonly [string, string] => [rule, referring.anchor.quote])
  ),
];

describe("inspection grammar boundary plans", () => {
  const cases: ReadonlyArray<readonly [texts: A.NonEmptyReadonlyArray<string>, expected: Summary]> = [
    [
      ["A system comprising a sensor; the sensor's housing is mounted."],
      [["complete"], [["definite-without-introduction", "the sensor's housing"]]],
    ],
    [["A system comprising a plate, wherein the claim 1 is mounted."], [["complete"], []]],
    [
      ["A system comprising a sensor; the sensors have a housing."],
      [["complete"], [["determiner-number-mismatch", "the sensors"]]],
    ],
    [["A system comprising a plurality of sensors has a housing."], [["complete"], []]],
    [["A system comprising a sensor in a housing of a frame."], [["complete"], []]],
    [
      ["A system comprising a plate.", "The system wherein a cover is mounted."],
      [["complete", "complete"], [["outside-chain", "The system"]]],
    ],
    [
      ["A system comprising a sensor; said sensors have a housing; the valves have a cover."],
      [
        ["complete"],
        [
          ["determiner-number-mismatch", "said sensors"],
          ["definite-without-introduction", "the valves"],
        ],
      ],
    ],
    [
      ["A system comprising a sensor; a valve; the sensor and valve is coupled to the frame."],
      [
        ["partial"],
        [
          ["unsupported-determiner", "valve"],
          ["definite-without-introduction", "the frame"],
        ],
      ],
    ],
    [
      ["A system comprising a sensor configured to detect a signal; the sensor is coupled to each other."],
      [["complete"], []],
    ],
    [["A system comprising a sensor; a frame; the sensor is perpendicular to the frame."], [["complete"], []]],
    [["A system comprising a frame; a sensor mounted perpendicular to the frame."], [["complete"], []]],
    [["A system comprising a sensor perpendicular to the claim 1."], [["complete"], []]],
    [
      ['A system comprising a sensor configured to "detect" a signal.'],
      [["partial"], [["unsupported-determiner", '"detect"']]],
    ],
    [
      ["A system comprising a sensor.", "The system of claim 1, wherein a plurality of sensors has a housing."],
      [["complete", "complete"], []],
    ],
    [
      ["A system comprising a sensor.", "The system of claim 1, wherein each sensor has a housing."],
      [["complete", "partial"], [["unsupported-determiner", "each sensor"]]],
    ],
    [
      ["A system comprising a sensor.", "The system of claim 1, wherein the sensors have a housing."],
      [["complete", "complete"], [["determiner-number-mismatch", "the sensors"]]],
    ],
    [
      ["A system comprising a sensor.", "The system of claim 1, wherein the units have a housing."],
      [["complete", "complete"], [["definite-without-introduction", "the units"]]],
    ],
    [
      ["A system comprising a sensor; a valve; the valve's housing and the sensor's housing; the housing."],
      [
        ["complete"],
        [
          ["definite-without-introduction", "the valve's housing"],
          ["definite-without-introduction", "the sensor's housing"],
          ["definite-without-introduction", "the housing"],
        ],
      ],
    ],
    [["A system comprising a heating and cooling a plate."], [["complete"], []]],
    [["A sensor mounted is comprising a plate."], [["complete"], []]],
    [["A sensor typically is comprising a plate."], [["complete"], []]],
  ];
  for (const [texts, expected] of cases)
    it.effect(`inspects ${A.join(texts, " / ")}`, () =>
      Effect.gen(function* () {
        const report = yield* inspectPlainTexts(texts);
        assert.deepStrictEqual(summarize(report), expected);
      })
    );
  it.effect("keeps source-role ownership verdicts for possessive and part-location heads", () =>
    Effect.gen(function* () {
      const possessive = yield* inspectRoleTexts(["A system comprising a sensor; the sensor's housing is mounted."]);
      assert.deepStrictEqual(summarize(possessive), [
        ["complete"],
        [["definite-without-introduction", "the sensor's housing"]],
      ]);
      const location = yield* inspectRoleTexts(["A system comprising a sensor in a housing of a frame."]);
      assert.deepStrictEqual(summarize(location), [["partial"], []]);
      const implicit = yield* inspectRoleTexts([
        "A system comprising a plate.",
        "The system wherein a cover is mounted.",
      ]);
      assert.deepStrictEqual(summarize(implicit), [["complete", "complete"], [["outside-chain", "The system"]]]);
    })
  );
});

// One claim with 107 limitations; `short` of them use a shorter name, which
// leaves more compiler work for the source projection.
const limitationTexts = (short: number): A.NonEmptyReadonlyArray<string> => [
  `A system comprising ${A.join(
    A.map(A.range(0, 106), (index) => (index < short ? `a p${index}` : `a plate${index}`)),
    "; "
  )}.`,
];

describe("source projection work", () => {
  it.effect("declines the projected plan when path or term projection exhausts compiler work", () =>
    Effect.gen(function* () {
      const control = yield* rolePlansOf(limitationTexts(20));
      assert.strictEqual(control.plans.length, 1);
      for (const short of [8, 12]) {
        const result = yield* rolePlansOf(limitationTexts(short));
        assert.deepStrictEqual(result.plans, []);
        assert.deepStrictEqual(
          A.map(result.decompositions, ({ status }) => status),
          ["decomposed"]
        );
      }
    })
  );
});
