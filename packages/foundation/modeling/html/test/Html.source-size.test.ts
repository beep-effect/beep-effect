import { inspectSourceSizeList, SourceSizeAnalysis, SourceSizeIssue } from "@beep/html/Html.source-size";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSuccess, strictEqual } from "@effect/vitest/utils";
import { Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const isSourceSizeAnalysis = S.is(SourceSizeAnalysis);
const isSourceSizeIssue = S.is(SourceSizeIssue);
const sourceSizeResultEquivalence = S.toEquivalence(S.Result(SourceSizeAnalysis, S.Array(SourceSizeIssue)));

type IssueCode = SourceSizeIssue["code"];

const expectValid = (value: string, usesAuto = false): void => {
  assertSuccess(
    Result.map(inspectSourceSizeList(value), (analysis) => ({
      usesAuto: analysis.usesAuto,
      hasEntries: analysis.entryCount > 0,
    })),
    { usesAuto, hasEntries: true }
  );
};

const expectInvalid = (value: string, code: IssueCode): void => {
  assertFailure(
    Result.mapError(inspectSourceSizeList(value), (issues) => issues[0]?.code),
    code
  );
};

describe("@beep/html source-size author conformance", () => {
  it("returns schema-owned analyses and diagnostics", () => {
    const valid = inspectSourceSizeList("(max-width: 30em) 100vw, 50vw");
    assertSuccess(valid, SourceSizeAnalysis.make({ entryCount: 2, usesAuto: false }));
    expect(isSourceSizeAnalysis(valid.success)).toBe(true);
    expect(valid.success.entryCount).toBe(2);
    expect(valid.success.usesAuto).toBe(false);

    const invalid = inspectSourceSizeList("10%");
    assertFailure(
      Result.mapError(invalid, (issues) => ({
        schemaOwned: isSourceSizeIssue(issues[0]),
        code: issues[0]?.code,
      })),
      { schemaOwned: true, code: "invalidSourceSize" }
    );
  });

  it("accepts every current CSS length-unit family and literal unitless zero", () => {
    for (const unit of [
      "cm",
      "mm",
      "Q",
      "in",
      "pt",
      "pc",
      "px",
      "em",
      "rem",
      "ex",
      "rex",
      "cap",
      "rcap",
      "ch",
      "rch",
      "ic",
      "ric",
      "lh",
      "rlh",
      "vw",
      "svw",
      "lvw",
      "dvw",
      "vh",
      "svh",
      "lvh",
      "dvh",
      "vi",
      "svi",
      "lvi",
      "dvi",
      "vb",
      "svb",
      "lvb",
      "dvb",
      "vmin",
      "svmin",
      "lvmin",
      "dvmin",
      "vmax",
      "svmax",
      "lvmax",
      "dvmax",
      "cqw",
      "cqh",
      "cqi",
      "cqb",
      "cqmin",
      "cqmax",
    ]) {
      expectValid(`1${unit}`);
    }

    expectValid("0");
    expectValid("-0");
    expectValid("+0");
    expectValid("1.5rem");
    expectValid("1e2px");
  });

  it("accepts WHATWG conditional lists and CSS whitespace or comments", () => {
    for (const value of [
      "100vw",
      "(max-width: 30em) 100vw, 50vw",
      "(width > 30em) calc(50vw - 1rem), 100vw",
      "not (color) 80vw, 40rem",
      "((color) or (monochrome)) 80vw, 40rem",
      "(future-feature: 1foo) 80vw, 40rem",
      "/* before */ 100vw /* after */",
      "(max-width: 30em)/**/100vw,/**/50vw",
      "(max-width: 30em) calc(100vw - 1rem), min(80rem, 100vw)",
      "CALC(1PX + 2px)",
      "MIN(1PX, 2px)",
    ]) {
      expectValid(value);
    }
  });

  it("enforces the exact raw first-entry form and placement of auto", () => {
    for (const value of ["auto", "AUTO", "auto, 100vw", "AUTO,(max-width: 30em) 100vw, 50vw"]) {
      expectValid(value, true);
    }

    for (const value of [
      " auto",
      "auto ",
      "auto ,100vw",
      "auto/*comment*/,100vw",
      "\\61 uto",
      "100vw, auto",
      "auto, auto",
      "(width > 10px) auto, 100vw",
    ]) {
      expectInvalid(value, "invalidAuto");
    }
  });

  it("rejects malformed list structure instead of browser processing recovery", () => {
    for (const value of [
      "",
      " ",
      "/**/",
      ",",
      ", 100vw",
      "100vw,",
      "100vw,, 50vw",
      "100vw, 50vw",
      "(max-width: 30em) 100vw",
    ]) {
      expectInvalid(value, "invalidList");
    }

    expectInvalid("(max-width: 30em), 100vw", "invalidSourceSize");
  });

  it("rejects negative literals, percentages, numbers, unknown units, and non-math functions", () => {
    for (const value of [
      "-1px",
      "10%",
      "1",
      "1furlong",
      "calc(50% - 1rem)",
      "calc(0 + 5px)",
      "calc(1px + 1s)",
      "calc(garbage)",
      "calc(1px + var(--gap))",
      "var(--size)",
      "env(safe-area-inset-left)",
      "anchor-size(width)",
    ]) {
      expectInvalid(value, "invalidSourceSize");
    }
  });

  it("type-checks the complete CSS Values Level 4 math-function families", () => {
    for (const value of [
      "calc(33vw - 100px)",
      "calc(-5px)",
      "calc(1px * 1s / 1s)",
      "calc(1px / 1px * 2rem)",
      "calc(1Hz / 1Hz * 1px)",
      "calc(1dpi / 1dpi * 1px)",
      "calc(1fr / 1fr * 1px)",
      "min(100vw, 60rem)",
      "max(20rem, 10vw)",
      "clamp(20rem, 50vw, 80rem)",
      "clamp(1px + 1px, 3px, 5px)",
      "clamp(none, 50vw, 80rem)",
      "clamp(20rem, 50vw, none)",
      "round(10px, 3px)",
      "round(up, 10px, 3px)",
      "round(line-width, 0.1px)",
      "mod(10px, 3px)",
      "rem(10px, 3px)",
      "calc(sin(1) * 1px)",
      "calc(cos(1rad) * 1px)",
      "calc(tan(.25turn) * 1px)",
      "calc(asin(1) / 1deg * 1px)",
      "calc(acos(1) / 1deg * 1px)",
      "calc(atan(1) / 1deg * 1px)",
      "calc(atan2(1px, 1px) / 1deg * 1px)",
      "calc(pow(2, 3) * 1px)",
      "calc(sqrt(4) * 1px)",
      "hypot(3px, 4px)",
      "calc(log(8, 2) * 1px)",
      "calc(exp(1) * 1px)",
      "abs(-10px)",
      "calc(sign(-10px) * 1px)",
      "calc((pi + e) * 1px)",
      "calc(infinity * 1px)",
      "calc(NaN * 1px)",
    ]) {
      expectValid(value);
    }
  });

  it("rejects math functions with invalid grammar, arity, or numeric types", () => {
    for (const value of [
      "calc()",
      "calc(1px, 2px)",
      "calc(1px+2px)",
      "calc(1px +2px)",
      "calc(1px+ 2px)",
      "calc(1px * 1px)",
      "min()",
      "min(1px, 1s)",
      "clamp(1px, 2px)",
      "clamp(none, none, 1px)",
      "round(1px)",
      "round(1px, 1s)",
      "round(1px, 2px, 3px)",
      "round(line-width, 1)",
      "mod(1px)",
      "mod(1px, 1s)",
      "sin()",
      "sin(1px)",
      "asin(1deg)",
      "atan2(1px)",
      "atan2(1px, 1s)",
      "pow(1px, 2)",
      "sqrt(1px)",
      "hypot(1px, 1s)",
      "log(1, 2, 3)",
      "exp(1px)",
      "abs()",
      "sign(1px, 2px)",
      "calc([1px])",
      "calc(1px *)",
      "future-math(1px)",
    ]) {
      expectInvalid(value, "invalidSourceSize");
    }

    expectInvalid("calc(1px", "invalidCss");
    expectInvalid("\\", "invalidCss");
  });

  it("matches Chromium's adversarial calc whitespace and ASCII-folding outcomes", () => {
    expectValid("calc(1px /**/+/**/ 2px)");

    for (const value of [
      "calc(1px/**/+/**/2px)",
      "calc(1px/**/+ /**/2px)",
      "calc(1px /**/+/**/2px)",
      "calc(1\u212AHz / 1kHz * 1px)",
    ]) {
      expectInvalid(value, "invalidSourceSize");
    }
  });

  it("accepts media conditions but rejects media types, general-enclosed, and mixed operators", () => {
    for (const value of [
      "screen 100vw, 50vw",
      "only screen and (color) 100vw, 50vw",
      "(width:) 100vw, 50vw",
      "(unknown-future(foo)) 100vw, 50vw",
      "foo(bar) 100vw, 50vw",
      "(color) and (width > 10px) or (height > 10px) 100vw, 50vw",
    ]) {
      expectInvalid(value, "invalidMediaCondition");
    }
  });

  it("accepts Chromium-supported 33, 64, and 100 term, argument, and nesting depths", () => {
    for (const count of [33, 64, 100]) {
      const terms = A.join(A.replicate("1px", count), " + ");
      const arguments_ = A.join(A.replicate("1px", count), ",");
      let nested = "1px";
      for (let depth = 0; depth < count; depth += 1) nested = `calc(${nested})`;

      expectValid(`calc(${terms})`);
      expectValid(`min(${arguments_})`);
      expectValid(nested);
    }
  });

  it("handles a large Chromium-supported argument list without validator-only work limits", () => {
    const arguments_ = A.join(A.replicate("1px", 2_048), ",");
    expectValid(`min(${arguments_})`);
  });

  it.prop(
    "accepts generated nonnegative literal lengths",
    [
      Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(0), S.isLessThanOrEqualTo(1_000_000))),
      Arbitrary.schema(S.Literals(["px", "rem", "vw", "cqw"])),
    ],
    ([value, unit]) => {
      expectValid(`${value}${unit}`);

      return true;
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "rejects generated negative literal lengths",
    [
      Arbitrary.schema(S.Int.check(S.isGreaterThanOrEqualTo(1), S.isLessThanOrEqualTo(1_000_000))),
      Arbitrary.schema(S.Literals(["px", "rem", "vw"])),
    ],
    ([value, unit]) => {
      expectInvalid(`-${value}${unit}`, "invalidSourceSize");

      return true;
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "is deterministic and total for arbitrary Unicode and UTF-16 input",
    [Arbitrary.schema(S.String.check(S.isMaxLength(256)))],
    ([input]) => {
      const first = inspectSourceSizeList(input);
      const second = inspectSourceSizeList(input);
      strictEqual(Result.isSuccess(first), Result.isSuccess(second));
      expect(sourceSizeResultEquivalence(first, second)).toBe(true);
      if (Result.isFailure(first) && Result.isFailure(second)) {
        expect(first.failure[0]?.code).toBe(second.failure[0]?.code);
      }

      return true;
    },
    { arbitrary: fcRuns(250) }
  );
});
