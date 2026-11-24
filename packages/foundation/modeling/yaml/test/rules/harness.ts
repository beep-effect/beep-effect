import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as R from "effect/Record";

// The shared per-rule fixture harness (#129): one harness, N rule fixture
// sets, each fixture a triple — input → expected diagnostics → expected
// fixed output where a fix exists. Uniform structure is the point: a
// per-rule bespoke test file is how a rule set drifts into thirteen
// dialects of "tested".
//
// The harness also carries the MUTATION PROOFS: for every rule it runs the
// dead-rule mutant (no diagnostics) and — where fixes are expected — the
// unfixing mutant (diagnostics without their fixes), and asserts each
// mutant fails the fixture set. A rule whose fixtures cannot fail is not
// tested.

import { StyleEvidence, YamlLint, YamlLintConfig, YamlLintDiagnostic, YamlRule } from "@beep/yaml";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as Result from "effect/Result";
import type { YamlLintRuleSetting, YamlStyleConflictError } from "@beep/yaml";
import type { LintContext } from "@beep/yaml/YamlLintRule";

/** Positional subset-match expectation for one diagnostic. */
export interface ExpectedDiagnostic {
  readonly character?: number;
  readonly length?: number;
  readonly line: number;
  readonly messageIncludes?: string;
  readonly severity?: "error" | "warning";
}

/** One rule fixture: input → expected diagnostics (→ fixed output). */
export interface RuleFixture {
  readonly expected: ReadonlyArray<ExpectedDiagnostic>;
  /**
   * Declares the input DELIBERATELY broken: the harness otherwise fails any
   * fixture whose input carries parse-validity errors, because an
   * expectation against a rejected document asserts nothing (the vacuous-
   * fixture trap). The guard is bidirectional — an opted-out fixture whose
   * input actually parses cleanly fails too, so opt-outs cannot go stale.
   */
  readonly expectsParseErrors?: boolean;
  /** Expected `YamlLint.fix` output; present only when the rule fixes this shape. */
  readonly fixed?: string;
  readonly input: string;
  readonly name: string;
  /** Config entry for the rule (defaults to `"error"`). */
  readonly setting?: YamlLintRuleSetting;
}

/**
 * Resolve a built-in rule by id, throwing a named error when absent — the
 * ONE lookup every rule test file shares, so a missing builtin fails the
 * test that uses it instead of surfacing as a module-collection error.
 */
export function builtin(id: string): YamlRule {
  const rule = O.getOrUndefined(A.findFirst(YamlLint.builtins, (r) => r.id === id));
  if (rule === undefined) {
    throw new Error(`builtin rule "${id}" is not in YamlLint.builtins`);
  }
  return rule;
}

const configFor = (rule: YamlRule, setting?: YamlLintRuleSetting): YamlLintConfig =>
  rule.id === "parse-validity"
    ? YamlLintConfig.make({ rules: {} })
    : YamlLintConfig.make({ rules: { [rule.id]: setting ?? "error" } });

const ruleFindings = (rule: YamlRule, fixture: RuleFixture, impl: YamlRule = rule): ReadonlyArray<YamlLintDiagnostic> =>
  A.filter(YamlLint.run(fixture.input, [impl], configFor(rule, fixture.setting)), (d) => d.rule === rule.id);

/** Register the uniform fixture suite (and mutation proofs) for one rule. */
export const testRule: {
  (fixtures: ReadonlyArray<RuleFixture>): (rule: YamlRule) => void;
  (rule: YamlRule, fixtures: ReadonlyArray<RuleFixture>): void;
} = dual(2, (rule: YamlRule, fixtures: ReadonlyArray<RuleFixture>): void => {
  describe(`rule ${rule.id}`, () => {
    for (const fixture of fixtures) {
      it(fixture.name, () => {
        // Parse-clean guard: expectations against a rejected document
        // assert nothing.
        const parseErrors = A.filter(
          YamlLint.run(
            fixture.input,
            A.filter(YamlLint.builtins, (r) => r.id === "parse-validity"),
            YamlLintConfig.make({ rules: {} })
          ),
          (d) => d.severity === "error"
        );
        if (fixture.expectsParseErrors === true) {
          assert.isAbove(parseErrors.length, 0, "fixture declares parse errors but its input parses cleanly");
        } else {
          assert.strictEqual(
            parseErrors.length,
            0,
            `fixture input must parse cleanly (or declare expectsParseErrors): ${A.join(
              A.map(parseErrors, (d) => `${d.line}:${d.character} ${d.message}`),
              " | "
            )}`
          );
        }
        const diagnostics = ruleFindings(rule, fixture);
        assert.strictEqual(
          diagnostics.length,
          fixture.expected.length,
          `expected ${fixture.expected.length} diagnostic(s), got ${diagnostics.length}: ${A.join(
            A.map(diagnostics, (d) => `${d.line}:${d.character} ${d.message}`),
            " | "
          )}`
        );
        A.forEach(fixture.expected, (expected, i) => {
          const actual = diagnostics[i];
          assert.isDefined(actual);
          assert.strictEqual(actual.line, expected.line, `diagnostic ${i} line`);
          if (expected.character !== undefined) {
            assert.strictEqual(actual.character, expected.character, `diagnostic ${i} character`);
          }
          if (expected.length !== undefined) {
            assert.strictEqual(actual.length, expected.length, `diagnostic ${i} length`);
          }
          if (expected.severity !== undefined) {
            assert.strictEqual(actual.severity, expected.severity, `diagnostic ${i} severity`);
          }
          if (expected.messageIncludes !== undefined) {
            assert.include(actual.message, expected.messageIncludes, `diagnostic ${i} message`);
          }
          // Every reported span must be inside the document.
          assert.isAtLeast(actual.offset, 0);
          assert.isAtMost(actual.offset + actual.length, fixture.input.length);
        });
        if (fixture.fixed !== undefined) {
          const result = YamlLint.fix(fixture.input, [rule], configFor(rule, fixture.setting));
          assertSuccess(result, fixture.fixed);
          if (Result.isSuccess(result)) {
            assert.strictEqual(result.success, fixture.fixed);
          }
        }
      });
    }

    it("mutation proof: the dead-rule mutant fails the fixture set", () => {
      const dead = YamlRule.make({
        id: rule.id,
        check: dual(2, (_ctx: LintContext, _options: unknown): Iterable<YamlLintDiagnostic> => []),
      });
      const discriminates = A.some(
        fixtures,
        (fixture) => fixture.expected.length !== ruleFindings(rule, fixture, dead).length
      );
      assert.isTrue(
        discriminates,
        "at least one fixture must expect a diagnostic, or a dead rule passes the whole set"
      );
    });

    const fixing = A.filter(fixtures, (f) => f.fixed !== undefined && f.fixed !== f.input);
    if (fixing.length > 0) {
      it("mutation proof: the unfixing mutant fails the fixed expectations", () => {
        const unfixing = YamlRule.make({
          id: rule.id,
          check: dual(
            2,
            (ctx: LintContext, options: unknown): Iterable<YamlLintDiagnostic> =>
              A.map([...rule.check(ctx, options)], ({ fix: _fix, ...rest }) => YamlLintDiagnostic.make(rest))
          ),
        });
        const discriminates = A.some(fixing, (fixture) => {
          const result = YamlLint.fix(fixture.input, [unfixing], configFor(rule, fixture.setting));
          return Result.isSuccess(result) && result.success !== fixture.fixed;
        });
        assert.isTrue(discriminates, "stripping fixes must change some fixture's fixed output");
      });
    }
  });
});

// ── Inference harness (#345) ────────────────────────────────────────────────

/** Expected strict-resolution outcome for one rule over an EMPTY base config. */
export type InferenceExpectation =
  | { readonly kind: "options"; readonly options: Record<string, unknown> }
  | { readonly kind: "none" }
  | { readonly kind: "conflict"; readonly dimension: string; readonly values: ReadonlyArray<unknown> };

/**
 * One inference fixture: N inputs observed and merged (the multi-file
 * evidence path) → the strict outcome, an optional explicit lenient pick
 * (required for conflict fixtures that assert a dominant), and optional
 * expected floors.
 */
export interface InferenceFixture {
  /** Expected floor values carried in the evidence for this rule. */
  readonly floors?: Record<string, number>;
  readonly inputs: ReadonlyArray<string>;
  /** Expected lenient entry; defaults to the strict outcome for non-conflict fixtures. */
  readonly lenient?: Record<string, unknown>;
  readonly name: string;
  readonly strict: InferenceExpectation;
}

const emptyBase = YamlLintConfig.make({ rules: {} });

const evidenceFor = (impl: YamlRule, inputs: ReadonlyArray<string>): StyleEvidence =>
  A.reduce(inputs, StyleEvidence.empty, (acc, input) => StyleEvidence.combine(acc, YamlLint.observe(input, [impl])));

type StrictResolution = Result.Result<YamlLintConfig, YamlStyleConflictError>;
type ConflictExpectation = Extract<InferenceExpectation, { readonly kind: "conflict" }>;
type StyleConflictCandidate = YamlStyleConflictError["conflicts"][number]["candidates"][number];

const assertFloors = (rule: YamlRule, evidence: StyleEvidence, floors: Record<string, number>): void => {
  for (const [dimension, value] of R.toEntries(floors)) {
    const floor = O.getOrUndefined(
      A.findFirst(evidence.floors, (f) => f.rule === rule.id && f.dimension === dimension)
    );
    assert.isDefined(floor, `expected a floor for ${rule.id}.${dimension}`);
    assert.strictEqual(floor?.value, value, `floor ${rule.id}.${dimension}`);
  }
};

// Every named spelling carries a real occurrence: a count and
// a position inside one of the observed inputs.
const assertRealOccurrence = (inputs: ReadonlyArray<string>, candidate: StyleConflictCandidate): void => {
  assert.isAtLeast(candidate.count, 1);
  assert.isAtLeast(candidate.offset, 0);
  assert.isTrue(
    A.some(inputs, (input) => candidate.offset <= input.length),
    "candidate position must fall inside an observed input"
  );
};

const assertStrictConflict = (
  rule: YamlRule,
  fixture: InferenceFixture,
  expectation: ConflictExpectation,
  strict: StrictResolution
): void => {
  assertFailure(strict, strict.pipe(Result.flip, Result.getOrThrow));
  if (!Result.isFailure(strict)) return;
  const conflict = O.getOrUndefined(
    A.findFirst(strict.failure.conflicts, (c) => c.rule === rule.id && c.dimension === expectation.dimension)
  );
  assert.isDefined(conflict, `expected a conflict on ${rule.id}.${expectation.dimension}`);
  if (conflict === undefined) return;
  assert.sameDeepMembers(
    A.map(conflict.candidates, (c) => c.value),
    [...expectation.values],
    "conflicting spellings"
  );
  for (const candidate of conflict.candidates) assertRealOccurrence(fixture.inputs, candidate);
};

const assertStrictResolved = (rule: YamlRule, expectation: InferenceExpectation, strict: StrictResolution): void => {
  assertSuccess(strict, Result.getOrThrow(strict));
  if (!Result.isSuccess(strict)) return;
  if (expectation.kind === "options") {
    assert.deepStrictEqual(strict.success.rules[rule.id], expectation.options);
  } else {
    assert.isUndefined(strict.success.rules[rule.id], "unobserved must fall back to defaults, not infer");
  }
};

// Lenient: an explicit expected pick, else it must agree with the
// strict outcome (unanimity implies the dominant IS the unanimous).
const assertLenient = (rule: YamlRule, fixture: InferenceFixture, evidence: StyleEvidence): void => {
  const lenient = YamlLint.resolveLenient(evidence, emptyBase);
  const expectation = fixture.strict;
  if (fixture.lenient !== undefined) {
    assert.deepStrictEqual(lenient.rules[rule.id], fixture.lenient);
  } else if (expectation.kind === "options") {
    assert.deepStrictEqual(lenient.rules[rule.id], expectation.options);
  } else if (expectation.kind === "none") {
    assert.isUndefined(lenient.rules[rule.id]);
  }
};

const checkInferenceFixture = (rule: YamlRule, fixture: InferenceFixture): void => {
  const evidence = evidenceFor(rule, fixture.inputs);
  if (fixture.floors !== undefined) assertFloors(rule, evidence, fixture.floors);
  const expectation = fixture.strict;
  const strict = YamlLint.resolveStrict(evidence, emptyBase);
  if (expectation.kind === "conflict") assertStrictConflict(rule, fixture, expectation, strict);
  else assertStrictResolved(rule, expectation, strict);
  assertLenient(rule, fixture, evidence);
};

/**
 * Register the uniform inference fixture suite (and the dead-infer mutation
 * proof) for one rule — the inference analog of {@link testRule}, so the
 * inferable rules cannot drift into bespoke dialects of "tested" either.
 */
export const testRuleInference: {
  (fixtures: ReadonlyArray<InferenceFixture>): (rule: YamlRule) => void;
  (rule: YamlRule, fixtures: ReadonlyArray<InferenceFixture>): void;
} = dual(2, (rule: YamlRule, fixtures: ReadonlyArray<InferenceFixture>): void => {
  describe(`rule ${rule.id} inference`, () => {
    for (const fixture of fixtures) {
      it(fixture.name, () => checkInferenceFixture(rule, fixture));
    }

    it("mutation proof: the dead-infer mutant fails the fixture set", () => {
      const dead = YamlRule.make({ id: rule.id, check: rule.check, infer: () => [] });
      const discriminates = A.some(fixtures, (fixture) => {
        const evidence = evidenceFor(dead, fixture.inputs);
        if (fixture.floors !== undefined && R.keys(fixture.floors).length > 0 && evidence.floors.length === 0) {
          return true;
        }
        const strict = YamlLint.resolveStrict(evidence, emptyBase);
        if (fixture.strict.kind === "conflict") return Result.isSuccess(strict);
        if (fixture.strict.kind === "options") {
          return Result.isSuccess(strict) && strict.success.rules[rule.id] === undefined;
        }
        return false;
      });
      assert.isTrue(
        discriminates,
        "at least one fixture must expect inferred options, a conflict or a floor — a dead infer hook passes the set otherwise"
      );
    });
  });
});
