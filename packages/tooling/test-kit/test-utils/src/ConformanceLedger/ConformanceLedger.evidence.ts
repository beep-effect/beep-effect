import { Effect, flow, pipe } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Str from "effect/String";
import type * as Conformance from "@beep/schema/Conformance";

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

const declaredTestIds = Effect.fn("ConformanceLedger.declaredTestIds")(function* (packageRoot: URL, file: string) {
  const contents = yield* readText(new URL(file, packageRoot));

  return pipe(
    contents,
    Str.matchAll(testDeclarationPattern),
    A.fromIterable,
    A.map((match) => A.findFirst([match[1], match[2], match[3]], P.isString)),
    A.getSomes,
    A.map((title) => `${file}#${titleSlug(title)}`)
  );
});

const testEvidenceIssues = Effect.fn("ConformanceLedger.testEvidenceIssues")(function* (
  packageRoot: URL,
  invariants: ReadonlyArray<Conformance.InvariantDescriptor>
) {
  const referencedTestIds = pipe(
    invariants,
    A.flatMap(({ testIds }) => testIds),
    A.dedupe
  );
  const parsedTestIds = A.map(referencedTestIds, parseTestId);
  const malformedIssues = pipe(
    referencedTestIds,
    A.filter((testId) => O.isNone(parseTestId(testId))),
    A.map((testId) => `invariant test id is not a test-relative path and title slug: ${testId}`)
  );
  const referencedFiles = pipe(parsedTestIds, A.map(O.map(({ file }) => file)), A.getSomes, A.dedupe);
  const actualTestIds = yield* Effect.forEach(referencedFiles, (file) => declaredTestIds(packageRoot, file), {
    concurrency: "unbounded",
  }).pipe(Effect.map(A.flatten));
  const missingIssues = pipe(
    referencedTestIds,
    A.filter((testId) => !A.contains(actualTestIds, testId)),
    A.map((testId) => `invariant test id does not match a declared test title: ${testId}`)
  );

  return A.appendAll(malformedIssues, missingIssues);
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
