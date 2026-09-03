/**
 * Filesystem-backed evidence checks for package conformance ledgers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as Conformance from "@beep/schema/Conformance";
import { Effect, flow, Number as Num, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";

type CoverageEvidenceEntry = {
  readonly invariantId: string;
  readonly currentEnforcement: ReadonlyArray<Conformance.InvariantEnforcement>;
  readonly positiveTestIds: ReadonlyArray<string>;
  readonly negativeTestIds: ReadonlyArray<string>;
  readonly status: string;
};

const readText = Effect.fn("ConformanceLedger.readText")((url: URL) => Effect.tryPromise(() => Bun.file(url).text()));

const parseTestId = (
  testId: string
): O.Option<{
  readonly file: string;
  readonly slug: string;
}> => {
  const segments = Str.split(testId, "#");
  if (!Num.Equivalence(A.length(segments), 2)) {
    return O.none();
  }

  const file = A.headNonEmpty(segments);
  const slug = A.lastNonEmpty(segments);
  return Str.isNonEmpty(file) && Str.isNonEmpty(slug)
    ? O.some({
        file,
        slug,
      })
    : O.none();
};

const titleSlug = flow(Str.replace(/[^A-Za-z0-9]+/g, "-"), Str.replace(/^-+|-+$/g, ""));

const testDeclarationPattern =
  /^[\t ]*(?:it|test)(?:\.[A-Za-z]+)?\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|`((?:\\.|[^`\\])*)`)/gmu;

const declaredTestIds = (file: string, contents: string): ReadonlyArray<string> =>
  pipe(
    contents,
    Str.matchAll(testDeclarationPattern),
    A.fromIterable,
    A.map((match) => A.findFirst([match[1], match[2], match[3]], P.isString)),
    A.getSomes,
    A.map((title) => `${file}#${titleSlug(title)}`)
  );

const runtimeValidators: (enforcement: ReadonlyArray<Conformance.InvariantEnforcement>) => ReadonlyArray<string> = flow(
  A.filter(Conformance.InvariantEnforcement.guards.runtime),
  A.map(({ validator }) => validator)
);

const testSourceFor = (
  sources: ReadonlyArray<readonly [file: string, contents: string]>,
  file: string
): O.Option<string> =>
  pipe(
    sources,
    A.findFirst(([candidate]) => Str.Equivalence(candidate, file)),
    O.map(([, contents]) => contents)
  );

const testEvidenceIssues = Effect.fn("ConformanceLedger.testEvidenceIssues")(function* (
  packageRoot: URL,
  invariants: ReadonlyArray<Conformance.InvariantDescriptor>,
  coverage: ReadonlyArray<CoverageEvidenceEntry>
) {
  const invariantTestIds = pipe(
    invariants,
    A.flatMap(({ testIds }) => testIds),
    A.dedupe
  );
  const coverageTestIds = pipe(
    coverage,
    A.flatMap((entry) => A.appendAll(entry.positiveTestIds, entry.negativeTestIds)),
    A.dedupe
  );
  const referencedTestIds = pipe(A.appendAll(invariantTestIds, coverageTestIds), A.dedupe);
  const parsedTestIds = A.map(referencedTestIds, parseTestId);
  const malformedIssues = pipe(
    referencedTestIds,
    A.filter((testId) => O.isNone(parseTestId(testId))),
    A.map((testId) => `invariant test id is not a test-relative path and title slug: ${testId}`)
  );
  const referencedFiles = pipe(parsedTestIds, A.map(O.map(({ file }) => file)), A.getSomes, A.dedupe);
  const testSources = yield* Effect.forEach(
    referencedFiles,
    (file) => readText(new URL(file, packageRoot)).pipe(Effect.map((contents) => [file, contents] as const)),
    {
      concurrency: "unbounded",
    }
  );
  const actualTestIds = pipe(
    testSources,
    A.flatMap(([file, contents]) => declaredTestIds(file, contents))
  );
  const validatorReferenceIssues = A.flatMap(coverage, (entry) => {
    const citedFiles = pipe(
      A.appendAll(entry.positiveTestIds, entry.negativeTestIds),
      A.map((testId) => O.map(parseTestId(testId), ({ file }) => file)),
      A.getSomes,
      A.dedupe
    );

    return A.flatMap(runtimeValidators(entry.currentEnforcement), (validator) =>
      A.some(citedFiles, (file) => pipe(testSourceFor(testSources, file), O.exists(Str.includes(validator))))
        ? A.empty<string>()
        : [
            `cited tests do not reference runtime validator ${validator} for invariant ${entry.invariantId}; files=${A.join(
              citedFiles,
              ", "
            )}`,
          ]
    );
  });
  const negativeEvidenceIssues = A.flatMap(coverage, (entry) =>
    pipe(
      invariants,
      A.findFirst(({ id }) => Str.Equivalence(id, entry.invariantId)),
      O.match({
        onNone: A.empty<string>,
        onSome: (invariant) =>
          Str.Equivalence(entry.status, "covered") &&
          (Conformance.RequirementStrength.is.must(invariant.strength) ||
            Conformance.RequirementStrength.is.mustNot(invariant.strength)) &&
          A.some(entry.currentEnforcement, Conformance.InvariantEnforcement.guards.runtime) &&
          Num.Equivalence(A.length(entry.negativeTestIds), 0)
            ? [
                `covered runtime ${invariant.strength} invariant ${entry.invariantId} must cite at least one negative test`,
              ]
            : A.empty<string>(),
      })
    )
  );
  const missingIssues = pipe(
    referencedTestIds,
    A.filter((testId) => !A.contains(actualTestIds, testId)),
    A.map((testId) => `invariant test id does not match a declared test title: ${testId}`)
  );

  return A.flatten([malformedIssues, missingIssues, validatorReferenceIssues, negativeEvidenceIssues]);
});

/**
 * File-reading and declared-test evidence internals shared by the conformance-ledger validators.
 *
 * **Example** (Access the evidence validator)
 *
 * ```ts
 * import { conformanceLedgerEvidence } from "./ConformanceLedger.evidence.ts"
 *
 * console.log(conformanceLedgerEvidence.testEvidenceIssues)
 * ```
 *
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const conformanceLedgerEvidence = { readText, testEvidenceIssues };
