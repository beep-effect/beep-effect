import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { conformanceLedgerEvidence } from "./ConformanceLedger.evidence.ts";
import { conformanceLedgerSchemas } from "./ConformanceLedger.schema.ts";
import type * as Conformance from "@beep/schema/Conformance";

const {
  decodeAnnotationType,
  decodeCoverageLedger,
  decodeInvariantsLedger,
  decodeInventoryLedger,
  decodeSourcesLedger,
  enforcementArrayEquivalence,
  invariantArrayEquivalence,
  profileArrayEquivalence,
  sourceArrayEquivalence,
  LedgerHeader,
} = conformanceLedgerSchemas;
const { readText, testEvidenceIssues } = conformanceLedgerEvidence;

const issueUnless = (condition: boolean, message: string): ReadonlyArray<string> =>
  condition ? A.empty<string>() : [message];

const duplicateStrings = (values: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    values,
    A.dedupe,
    A.filter((value) =>
      Num.isGreaterThan(A.length(A.filter(values, (candidate) => Str.Equivalence(candidate, value))), 1)
    )
  );

const sameStringSet = (left: ReadonlyArray<string>, right: ReadonlyArray<string>): boolean => {
  const uniqueLeft = A.dedupe(left);
  const uniqueRight = A.dedupe(right);

  return (
    Num.Equivalence(A.length(uniqueLeft), A.length(uniqueRight)) &&
    A.every(uniqueLeft, (value) => A.contains(uniqueRight, value))
  );
};

const unresolvedStrings = (references: ReadonlyArray<string>, registry: ReadonlyArray<string>): ReadonlyArray<string> =>
  pipe(
    references,
    A.dedupe,
    A.filter((reference) => !A.contains(registry, reference))
  );

const describeValues = A.join(", ");

const describeStringSet = (values: ReadonlyArray<string>): string => `[${describeValues(values)}]`;

const duplicateIssues = (label: string, values: ReadonlyArray<string>): ReadonlyArray<string> =>
  A.map(duplicateStrings(values), (value) => `${label} contains duplicate id ${value}`);

const unresolvedIssues = (
  label: string,
  references: ReadonlyArray<string>,
  registry: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.map(unresolvedStrings(references, registry), (reference) => `${label} references unknown id ${reference}`);

const headerIssues = (
  label: string,
  header: typeof LedgerHeader.Type,
  expectedPackageName: string,
  expectedProfileIds: ReadonlyArray<string>
): ReadonlyArray<string> =>
  A.flatten([
    issueUnless(
      Str.Equivalence(header.packageName, expectedPackageName),
      `${label} packageName is ${header.packageName}; expected ${expectedPackageName}`
    ),
    issueUnless(
      sameStringSet(header.profileIds, expectedProfileIds),
      `${label} profileIds differ from sources.json profiles: ${describeValues(header.profileIds)}`
    ),
    duplicateIssues(`${label} profileIds`, header.profileIds),
  ]);

/**
 * Compares a published conformance annotation with the exact profile-selected records in its package ledger.
 *
 * **Details**
 *
 * Profile identifiers select canonical ledger profiles, which in turn select canonical sources and invariants. Full
 * schema-derived equivalence is used for all three registries, so invariant enforcement evidence cannot drift while
 * identifiers remain unchanged.
 *
 * **Example** (Prepare an annotation parity check)
 *
 * ```ts
 * import * as Conformance from "@beep/schema/Conformance"
 * import { validateConformanceAnnotationAgainstLedgerArtifacts } from "@beep/test-utils/ConformanceLedger"
 *
 * const annotation = Conformance.makeAnnotation({
 *   sources: [{
 *     id: "example-spec",
 *     title: "Example Specification",
 *     role: "primarySpecification",
 *     canonicalUrl: "https://example.com/spec",
 *     revision: { kind: "release", version: "1.0" },
 *     contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
 *   }],
 *   profiles: [{
 *     id: "example",
 *     title: "Example",
 *     version: "1.0",
 *     description: "Example conformance profile.",
 *     sourceIds: ["example-spec"],
 *     invariantIds: ["example.rule"]
 *   }],
 *   invariants: [{
 *     id: "example.rule",
 *     title: "Example rule",
 *     statement: "The value satisfies the example rule.",
 *     strength: "must",
 *     scope: "value",
 *     decidability: "localRuntime",
 *     enforcement: [{ kind: "runtime", validator: "Example.validate" }],
 *     references: [{ sourceId: "example-spec" }]
 *   }]
 * })
 *
 * const validation = validateConformanceAnnotationAgainstLedgerArtifacts(
 *   new URL("file:///workspace/package/"),
 *   "@beep/example",
 *   annotation
 * )
 *
 * console.log(validation)
 * ```
 *
 * @param packageRoot - Package-root file URL containing the canonical `data/conformance` registry.
 * @param expectedPackageName - Exact workspace package name expected in the source and invariant ledgers.
 * @param annotation - Published schema annotation to compare with its canonical profile-selected ledger records.
 * @returns An Effect that fails for unreadable or schema-invalid artifacts and otherwise returns all parity diagnostics.
 * @invariant An empty result proves exact source, profile, invariant, and enforcement parity with the selected ledger profiles.
 * @category testing
 * @since 0.0.0
 */
export const validateConformanceAnnotationAgainstLedgerArtifacts = Effect.fn(
  "ConformanceLedger.validateAnnotationAgainstArtifacts"
)(function* (packageRoot: URL, expectedPackageName: string, annotation: Conformance.Annotation) {
  const conformanceRoot = new URL("data/conformance/", packageRoot);
  const [sources, invariants] = yield* Effect.all(
    [
      readText(new URL("sources.json", conformanceRoot)).pipe(Effect.flatMap(decodeSourcesLedger)),
      readText(new URL("invariants.json", conformanceRoot)).pipe(Effect.flatMap(decodeInvariantsLedger)),
    ],
    { concurrency: "unbounded" }
  );

  yield* decodeAnnotationType(annotation);

  const ledgerProfileIds = A.map(sources.profiles, ({ id }) => id);
  const annotationProfileIds = A.map(annotation.profiles, ({ id }) => id);
  const expectedProfiles = A.filter(sources.profiles, ({ id }) => A.contains(annotationProfileIds, id));
  const expectedInvariantIds = pipe(
    expectedProfiles,
    A.flatMap(({ invariantIds }) => invariantIds),
    A.dedupe
  );
  const expectedInvariants = A.filter(invariants.invariants, ({ id }) => A.contains(expectedInvariantIds, id));
  const expectedSourceIds = pipe(
    [
      A.flatMap(expectedProfiles, ({ sourceIds }) => sourceIds),
      A.flatMap(expectedInvariants, ({ references }) => A.map(references, ({ sourceId }) => sourceId)),
    ],
    A.flatten,
    A.dedupe
  );
  const expectedSources = A.filter(sources.sources, ({ id }) => A.contains(expectedSourceIds, id));

  return A.flatten([
    headerIssues("sources.json", sources, expectedPackageName, ledgerProfileIds),
    headerIssues("invariants.json", invariants, expectedPackageName, ledgerProfileIds),
    issueUnless(
      profileArrayEquivalence(annotation.profiles, expectedProfiles),
      `published annotation profiles differ from ledger profiles: ${describeValues(annotationProfileIds)}`
    ),
    issueUnless(
      sourceArrayEquivalence(annotation.sources, expectedSources),
      `published annotation sources differ from the selected ledger sources: ${describeValues(expectedSourceIds)}`
    ),
    issueUnless(
      invariantArrayEquivalence(annotation.invariants, expectedInvariants),
      `published annotation invariants or enforcement records differ from the selected ledger invariants: ${describeValues(
        expectedInvariantIds
      )}`
    ),
  ]);
});

/**
 * Validates a package's five conformance-ledger artifacts against their shared registries and executable test evidence.
 *
 * **Details**
 *
 * JSON decoding uses the shared `@beep/schema/Conformance` source, profile, invariant, and enforcement schemas. The
 * returned diagnostics cover package/profile coherence, exact bidirectional profile-invariant selection, reference
 * integrity, coverage bijection, evidence mirroring, duplicate inventory identities, and referenced test-title
 * existence.
 *
 * **Example** (Prepare a package ledger validation)
 *
 * ```ts
 * import { validateConformanceLedgerArtifacts } from "@beep/test-utils/ConformanceLedger"
 *
 * const validation = validateConformanceLedgerArtifacts(
 *   new URL("file:///workspace/package/"),
 *   "@beep/example"
 * )
 *
 * console.log(validation)
 * ```
 *
 * @param packageRoot - Package-root file URL containing `data/conformance` and `test` directories.
 * @param expectedPackageName - Exact workspace package name expected in all four JSON ledgers.
 * @returns An Effect that fails for unreadable or schema-invalid artifacts and otherwise returns all integrity diagnostics.
 * @invariant An empty result proves profile invariant selections are exact, every invariant has one aligned coverage entry, and every test ID names a declared test.
 * @category testing
 * @since 0.0.0
 */
export const validateConformanceLedgerArtifacts = Effect.fn("ConformanceLedger.validateArtifacts")(function* (
  packageRoot: URL,
  expectedPackageName: string
) {
  const conformanceRoot = new URL("data/conformance/", packageRoot);
  const [sources, inventory, invariants, coverage, sourcesMarkdown] = yield* Effect.all(
    [
      readText(new URL("sources.json", conformanceRoot)).pipe(Effect.flatMap(decodeSourcesLedger)),
      readText(new URL("inventory.json", conformanceRoot)).pipe(Effect.flatMap(decodeInventoryLedger)),
      readText(new URL("invariants.json", conformanceRoot)).pipe(Effect.flatMap(decodeInvariantsLedger)),
      readText(new URL("coverage.json", conformanceRoot)).pipe(Effect.flatMap(decodeCoverageLedger)),
      readText(new URL("SOURCES.md", conformanceRoot)),
    ],
    { concurrency: "unbounded" }
  );

  yield* decodeAnnotationType({
    sources: sources.sources,
    profiles: sources.profiles,
    invariants: invariants.invariants,
  });

  const sourceIds = A.map(sources.sources, ({ id }) => id);
  const profileIds = A.map(sources.profiles, ({ id }) => id);
  const invariantIds = A.map(invariants.invariants, ({ id }) => id);
  const inventoryIds = A.map(inventory.items, ({ id }) => id);
  const coverageInvariantIds = A.map(coverage.coverage, ({ invariantId }) => invariantId);
  const inventorySourceIds = A.flatMap(inventory.items, ({ sources: itemSources }) => itemSources);
  const coverageProfileIds = A.flatMap(coverage.coverage, ({ profileIds: entryProfileIds }) => entryProfileIds);

  const coverageAlignmentIssues = A.flatMap(coverage.coverage, (entry) =>
    pipe(
      A.findFirst(invariants.invariants, ({ id }) => Str.Equivalence(id, entry.invariantId)),
      O.match({
        onNone: A.empty<string>,
        onSome: (invariant) => {
          const coverageTestIds = pipe(A.appendAll(entry.positiveTestIds, entry.negativeTestIds), A.dedupe);

          return A.flatten([
            duplicateIssues(`coverage.json invariant ${entry.invariantId} profileIds`, entry.profileIds),
            issueUnless(
              enforcementArrayEquivalence(entry.currentEnforcement, invariant.enforcement),
              `coverage currentEnforcement differs from invariant ${entry.invariantId}`
            ),
            issueUnless(
              sameStringSet(coverageTestIds, invariant.testIds),
              `coverage test IDs differ from invariant ${entry.invariantId}`
            ),
          ]);
        },
      })
    )
  );
  const profileInvariantAlignmentIssues = A.flatMap(sources.profiles, (profile) => {
    const coverageInvariantIdsForProfile = pipe(
      coverage.coverage,
      A.filter(({ profileIds: entryProfileIds }) => A.contains(entryProfileIds, profile.id)),
      A.map(({ invariantId }) => invariantId)
    );

    return issueUnless(
      sameStringSet(coverageInvariantIdsForProfile, profile.invariantIds),
      `coverage.json profile ${profile.id} invariantIds differ from sources.json; coverage=${describeStringSet(
        coverageInvariantIdsForProfile
      )}; profile=${describeStringSet(profile.invariantIds)}`
    );
  });
  const evidenceIssues = yield* testEvidenceIssues(packageRoot, invariants.invariants);

  return A.flatten([
    headerIssues("sources.json", sources, expectedPackageName, profileIds),
    headerIssues("inventory.json", inventory, expectedPackageName, profileIds),
    headerIssues("invariants.json", invariants, expectedPackageName, profileIds),
    headerIssues("coverage.json", coverage, expectedPackageName, profileIds),
    duplicateIssues("sources.json profile registry", profileIds),
    duplicateIssues("inventory.json item registry", inventoryIds),
    duplicateIssues("coverage.json invariant registry", coverageInvariantIds),
    unresolvedIssues("inventory.json items", inventorySourceIds, sourceIds),
    unresolvedIssues("coverage.json entries", coverageProfileIds, profileIds),
    issueUnless(
      sameStringSet(coverageInvariantIds, invariantIds),
      `coverage.json must contain exactly one entry for each invariant; coverage=${describeValues(
        coverageInvariantIds
      )}; invariants=${describeValues(invariantIds)}`
    ),
    issueUnless(Str.isNonEmpty(Str.trim(sourcesMarkdown)), "SOURCES.md must contain a readable source explanation"),
    profileInvariantAlignmentIssues,
    coverageAlignmentIssues,
    evidenceIssues,
  ]);
});
