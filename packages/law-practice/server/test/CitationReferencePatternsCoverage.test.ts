import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationReferenceNames } from "@beep/law-practice-server/internal/Citation/ReferenceNames";
import {
  CitationReferencePatternConfiguration,
  verifyCitationReferencePatternConfiguration,
} from "@beep/law-practice-server/internal/Citation/ReferencePatterns";
import { makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import { expect } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ownCitationTestConfiguration } from "./CitationConfigurationOwnership.fixtures.ts";
import { makeCitationTestScaffoldBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  makeCitationReferenceNameMetadata,
  readCitationGeneratedReferenceSource,
} from "./CitationReferenceNames.fixtures.ts";
import {
  makeCitationReferencePatternsAtBoundary,
  readCitationReferenceTemplate,
} from "./CitationReferencePatterns.fixtures.ts";
import { citationTokenizerTestLayer } from "./CitationTokenizer.fixtures.ts";

const Names = S.fromJsonString(S.Struct({ disallowedNames: S.Array(S.String) }));
const install = Effect.fnUntraced(function* () {
  const corpus = yield* readCitationGeneratedReferenceSource().pipe(Effect.flatMap(S.decodeEffect(Names)));
  const template = yield* readCitationReferenceTemplate();
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const budget = yield* makeCitationTextBudget(limits);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const configuration = { patterns: template.patterns, disallowedNames: corpus.disallowedNames };
  const tampered = { ...configuration, patterns: { ...template.patterns, rejection: template.patterns.pinPrefix } };
  return { limits, budget, unicode, configuration, tampered, names: corpus.disallowedNames };
});
const refuses = Effect.fnUntraced(function* <A, E, R>(body: Effect.Effect<A, E, R>, expected: object) {
  const failure = yield* Effect.flip(body);
  expect(failure).toMatchObject(expected);
});
const plaintiffOnly = (plaintiff: Parameters<typeof makeCitationReferenceNameMetadata>[0]["plaintiff"]) =>
  makeCitationReferenceNameMetadata({
    plaintiff,
    defendant: null,
    resolvedCaseNameShort: null,
    resolvedCaseName: null,
  });

it.layer(citationTokenizerTestLayer, { excludeTestServices: true })("reference pattern refusals", (it) => {
  it.effect("refuses an invalid policy and an altered exclusion list of the pinned length", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { budget, names, limits } = yield* install();
        const policy = yield* makeCitationReferenceNames({}, names).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding({}).pipe(Effect.map((bind) => ({ ...stage, collect: bind(stage.collect) })))
          ),
          Effect.provideService(CitationTextBudget, budget),
          Effect.flip
        );
        expect(policy).toMatchObject({ _tag: "CitationReferenceNamesFailure", reason: "invalid-policy" });
        const altered = A.map(names, (name, index) => (index === 0 ? "different" : name));
        strictEqual(altered.length, 93);
        const mismatch = yield* makeCitationReferenceNames(limits, altered).pipe(
          Effect.flatMap((stage) =>
            makeCitationTestScaffoldBinding(limits).pipe(
              Effect.map((bind) => ({ ...stage, collect: bind(stage.collect) }))
            )
          ),
          Effect.provideService(CitationTextBudget, budget),
          Effect.flip
        );
        expect(mismatch).toMatchObject({ _tag: "CitationReferenceNamesFailure", reason: "invalid-configuration" });
      })
    )
  );

  it.effect("refuses invalid policy, configuration and unauthenticated templates", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { budget, configuration, limits, tampered } = yield* install();
        const run = (policy: unknown, input: unknown) =>
          makeCitationReferencePatternsAtBoundary(policy, input).pipe(
            Effect.provideService(CitationTextBudget, budget)
          );
        const invalidPolicy = { _tag: "CitationReferencePatternFailure", reason: "invalid-policy" };
        const invalidConfiguration = { _tag: "CitationReferencePatternFailure", reason: "invalid-configuration" };
        yield* refuses(run({}, configuration), invalidPolicy);
        yield* refuses(run(limits, {}), invalidConfiguration);
        yield* refuses(run(limits, tampered), invalidConfiguration);
        const owned = yield* ownCitationTestConfiguration(CitationReferencePatternConfiguration, tampered);
        yield* refuses(verifyCitationReferencePatternConfiguration(limits, owned), invalidConfiguration);
      })
    )
  );

  it.effect("rejects an oversized enclosing ledger before allocating and owns copied templates", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { budget, configuration, limits } = yield* install();
        const refused = yield* makeCitationReferencePatternsAtBoundary(
          { ...limits, producedTextUtf16: budget.maximum - 1 },
          configuration
        ).pipe(Effect.provideService(CitationTextBudget, budget), Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationReferencePatternFailure", reason: "invalid-policy" });
        const used = yield* budget.snapshot;
        expect(used).toBe(0);
        const ownedConfiguration = yield* ownCitationTestConfiguration(
          CitationReferencePatternConfiguration,
          configuration
        );
        const owned = yield* verifyCitationReferencePatternConfiguration(limits, ownedConfiguration);
        expect(owned).toEqual(configuration);
        expect(owned.patterns.pinPrefix).not.toBe(configuration.patterns.pinPrefix);
        expect(owned.patterns.pinPrefix.bytes).not.toBe(configuration.patterns.pinPrefix.bytes);
        expect(owned.disallowedNames).not.toBe(configuration.disallowedNames);
      })
    )
  );

  it.effect("escapes a leading metacharacter word and refuses an oversized literal before assembly", () =>
    withCitationTestInvocation(
      Effect.gen(function* () {
        const { budget, configuration, limits, unicode } = yield* install();
        const builder = yield* makeCitationReferencePatternsAtBoundary(limits, configuration).pipe(
          Effect.provideService(CitationTextBudget, budget)
        );
        const name = yield* unicode.fromText("Abc $de");
        const built = yield* builder.build(plaintiffOnly(name.storage), "markup");
        const pattern = yield* Effect.fromOption(built);
        const text = yield* unicode.fromStorage(pattern.pattern);
        assertTrue(pipe(text.text, Str.includes("Abc\\s+\\$de")));
        const patternUtf16 =
          A.reduce(R.values(configuration.patterns), 0, (n, p) => Num.max(n, p.bytes.length / p.width)) + 32;
        const small = yield* makeCitationReferencePatternsAtBoundary({ ...limits, patternUtf16 }, configuration).pipe(
          Effect.provideService(CitationTextBudget, budget)
        );
        const long = yield* unicode.fromText(`A${Str.repeat(patternUtf16 + 1)("b")}`);
        const refused = yield* small.build(plaintiffOnly(long.storage), "pin").pipe(Effect.flip);
        expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
      })
    )
  );
});
