import { pathToFileURL } from "node:url";
import * as Conformance from "@beep/schema/Conformance";
import { provideScopedLayer } from "@beep/test-utils";
import {
  validateConformanceAnnotationAgainstLedgerArtifacts,
  validateConformanceLedgerArtifacts,
} from "@beep/test-utils/ConformanceLedger";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));
const packageName = "@beep/example";
const profileId = "example-profile";
const secondaryProfileId = "example-secondary-profile";
const sourceId = "example-source";
const secondarySourceId = "example-secondary-source";
const invariantId = "example.invariant";
const secondaryInvariantId = "example.secondary-invariant";
const evidenceFile = "test/ConformanceEvidence.test.ts";
const negativeEvidenceTestId = `${evidenceFile}#rejects-an-invalid-example`;
const evidenceTestSource = `
  import { Example } from "@beep/example"

  void Example.validate
  it("recognizes a double-quoted title", () => undefined)
  test.effect('recognizes a single-quoted title', () => undefined)
  it.scoped(\`recognizes a backtick-quoted title\`, () => undefined)
  it("rejects an invalid example", () => undefined)
`;

const source = {
  id: sourceId,
  title: "Example Specification",
  role: "primarySpecification",
  canonicalUrl: "https://example.com/spec",
  revision: { kind: "release", version: "1.0" },
  contentSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
} satisfies typeof Conformance.Source.Encoded;

const secondarySource = {
  ...source,
  id: secondarySourceId,
  title: "Example Secondary Specification",
  canonicalUrl: "https://example.com/secondary-spec",
} satisfies typeof Conformance.Source.Encoded;

const profile = {
  id: profileId,
  title: "Example Profile",
  version: "1.0",
  description: "Minimal conformance-ledger test profile.",
  sourceIds: [sourceId],
  invariantIds: [invariantId],
} satisfies typeof Conformance.Profile.Encoded;

const secondaryProfile = {
  id: secondaryProfileId,
  title: "Example Secondary Profile",
  version: "1.0",
  description: "Second conformance-ledger test profile.",
  sourceIds: [sourceId],
  invariantIds: [secondaryInvariantId],
} satisfies typeof Conformance.Profile.Encoded;

const invariant = {
  id: invariantId,
  title: "Example invariant",
  statement: "The example value satisfies its local runtime rule.",
  strength: "must",
  scope: "value",
  decidability: "localRuntime",
  enforcement: [{ kind: "runtime", validator: "Example.validate" }],
  references: [{ sourceId }],
  testIds: [],
} satisfies typeof Conformance.Invariant.Encoded;

const enforcement = invariant.enforcement;
const secondaryEnforcement = [
  {
    kind: "documented",
    rationale: "The secondary example is advisory documentation rather than a runtime claim.",
  },
] satisfies (typeof Conformance.Invariant.Encoded)["enforcement"];

const secondaryInvariant = {
  ...invariant,
  id: secondaryInvariantId,
  title: "Secondary example invariant",
  statement: "The example value satisfies the second profile's local runtime rule.",
  strength: "should",
  decidability: "undecidable",
  enforcement: secondaryEnforcement,
  testIds: [],
} satisfies typeof Conformance.Invariant.Encoded;

type FixtureOptions = {
  readonly coverageStatus: string;
  readonly inventorySourceId: string;
  readonly primaryProfileInvariantIds?: ReadonlyArray<string>;
  readonly primaryProfileSourceIds?: ReadonlyArray<string>;
  readonly primaryCoverageProfileIds?: ReadonlyArray<string>;
  readonly secondaryCoverageProfileIds?: ReadonlyArray<string>;
  readonly primaryTestIds?: ReadonlyArray<string>;
  readonly primaryNegativeTestIds?: ReadonlyArray<string>;
  readonly primaryStrength?: Conformance.RequirementStrength;
  readonly primaryDecidability?: Conformance.InvariantDecidability;
  readonly primaryEnforcement?: (typeof Conformance.Invariant.Encoded)["enforcement"];
  readonly evidenceSource?: string;
  readonly annotation?: Conformance.Annotation;
};

const primaryEvidenceFrom = (options: FixtureOptions) => ({
  positiveTestIds: options.primaryTestIds ?? [],
  negativeTestIds: options.primaryNegativeTestIds ?? [negativeEvidenceTestId],
  enforcement: options.primaryEnforcement ?? enforcement,
});

const encodeSourcesArtifact = (options: FixtureOptions) =>
  encodeJson({
    schemaVersion: 1,
    packageName,
    profileIds: [profileId, secondaryProfileId],
    sources: [source, secondarySource],
    profiles: [
      {
        ...profile,
        sourceIds: options.primaryProfileSourceIds ?? profile.sourceIds,
        invariantIds: options.primaryProfileInvariantIds ?? profile.invariantIds,
      },
      secondaryProfile,
    ],
  });

const encodeInventoryArtifact = (options: FixtureOptions) =>
  encodeJson({
    schemaVersion: 1,
    packageName,
    profileIds: [profileId, secondaryProfileId],
    items: [
      {
        id: "example.member",
        symbol: "Example",
        tag: "example",
        kind: "ast-member",
        existingDiscriminator: "_tag",
        currentEnforcementLayers: ["type", "decode"],
        sources: [options.inventorySourceId],
        candidateDisposition: "retain-existing-tagged-member",
        candidateReason: "The example member already has a stable literal discriminator.",
      },
    ],
  });

const encodeInvariantsArtifact = (options: FixtureOptions, primaryEvidence: ReturnType<typeof primaryEvidenceFrom>) =>
  encodeJson({
    schemaVersion: 1,
    packageName,
    profileIds: [profileId, secondaryProfileId],
    invariants: [
      {
        ...invariant,
        strength: options.primaryStrength ?? invariant.strength,
        decidability: options.primaryDecidability ?? invariant.decidability,
        enforcement: primaryEvidence.enforcement,
        testIds: [...primaryEvidence.positiveTestIds, ...primaryEvidence.negativeTestIds],
      },
      secondaryInvariant,
    ],
  });

const encodeCoverageArtifact = (options: FixtureOptions, primaryEvidence: ReturnType<typeof primaryEvidenceFrom>) =>
  encodeJson({
    schemaVersion: 1,
    packageName,
    profileIds: [profileId, secondaryProfileId],
    coverage: [
      {
        invariantId,
        profileIds: options.primaryCoverageProfileIds ?? [profileId],
        currentEnforcement: primaryEvidence.enforcement,
        targetEnforcement: primaryEvidence.enforcement,
        positiveTestIds: primaryEvidence.positiveTestIds,
        negativeTestIds: primaryEvidence.negativeTestIds,
        status: options.coverageStatus,
      },
      {
        invariantId: secondaryInvariantId,
        profileIds: options.secondaryCoverageProfileIds ?? [secondaryProfileId],
        currentEnforcement: secondaryEnforcement,
        targetEnforcement: secondaryEnforcement,
        positiveTestIds: [],
        negativeTestIds: [],
        status: "covered",
      },
    ],
  });

const fixtureFiles = (options: FixtureOptions) => {
  const primaryEvidence = primaryEvidenceFrom(options);

  return [
    ["data/conformance/sources.json", encodeSourcesArtifact(options)],
    ["data/conformance/inventory.json", encodeInventoryArtifact(options)],
    ["data/conformance/invariants.json", encodeInvariantsArtifact(options, primaryEvidence)],
    ["data/conformance/coverage.json", encodeCoverageArtifact(options, primaryEvidence)],
    ["data/conformance/SOURCES.md", "# Example conformance sources\n"],
    ["test/ConformanceEvidence.test.ts", options.evidenceSource ?? evidenceTestSource],
  ] as const;
};

const validateFixtureArtifacts = (root: string, options: FixtureOptions) => {
  const packageRoot = pathToFileURL(`${root}/`);

  return options.annotation === undefined
    ? validateConformanceLedgerArtifacts(packageRoot, packageName)
    : validateConformanceAnnotationAgainstLedgerArtifacts(packageRoot, packageName, options.annotation);
};

const validateFixture = Effect.fn("ConformanceLedgerTest.validateFixture")(function* (options: FixtureOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const root = yield* fileSystem.makeTempDirectoryScoped({ prefix: "beep-conformance-ledger-" });
  yield* Effect.all([
    fileSystem.makeDirectory(`${root}/data/conformance`, { recursive: true }),
    fileSystem.makeDirectory(`${root}/test`, { recursive: true }),
  ]);
  yield* Effect.forEach(
    fixtureFiles(options),
    ([relativePath, contents]) => fileSystem.writeFileString(`${root}/${relativePath}`, contents),
    { concurrency: "unbounded" }
  );

  return yield* validateFixtureArtifacts(root, options);
});

const runFixture = (options: FixtureOptions) => validateFixture(options).pipe(provideScopedLayer(BunFileSystem.layer));

describe("conformance-ledger validation", () => {
  it.effect("matches a published annotation against its profile-selected ledger records", () =>
    Effect.gen(function* () {
      const annotation = Conformance.makeAnnotation({
        sources: [source],
        profiles: [profile],
        invariants: [{ ...invariant, testIds: [negativeEvidenceTestId] }],
      });
      const issues = yield* runFixture({
        annotation,
        coverageStatus: "covered",
        inventorySourceId: sourceId,
      });

      expect(issues).toEqual([]);
    })
  );

  it.effect("preserves profile-selected source and invariant order independently of registry order", () =>
    Effect.gen(function* () {
      const orderedProfile = {
        ...profile,
        sourceIds: [secondarySourceId, sourceId],
        invariantIds: [secondaryInvariantId, invariantId],
      } satisfies typeof Conformance.Profile.Encoded;
      const annotation = Conformance.makeAnnotation({
        sources: [secondarySource, source],
        profiles: [orderedProfile],
        invariants: [secondaryInvariant, { ...invariant, testIds: [negativeEvidenceTestId] }],
      });
      const issues = yield* runFixture({
        annotation,
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryProfileSourceIds: orderedProfile.sourceIds,
        primaryProfileInvariantIds: orderedProfile.invariantIds,
      });

      expect(issues).toEqual([]);
    })
  );

  it.effect("reports exact published-annotation drift from selected ledger records", () =>
    Effect.gen(function* () {
      const annotation = Conformance.makeAnnotation({
        sources: [{ ...source, title: "Published Specification" }],
        profiles: [{ ...profile, title: "Published Profile" }],
        invariants: [{ ...invariant, statement: "The published statement drifted." }],
      });
      const issues = yield* runFixture({
        annotation,
        coverageStatus: "covered",
        inventorySourceId: sourceId,
      });

      expect(issues).toEqual([
        "published annotation profiles differ from ledger profiles: example-profile",
        "published annotation sources differ from the selected ledger sources: example-source",
        "published annotation invariants or enforcement records differ from the selected ledger invariants: example.invariant",
      ]);
    })
  );

  it.effect("rejects coverage statuses outside the closed artifact domain", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(runFixture({ coverageStatus: "invented-status", inventorySourceId: sourceId }));

      expect(S.isSchemaError(error)).toBe(true);
      if (S.isSchemaError(error)) {
        expect(error._tag).toBe("SchemaError");
        expect(error.issue).toMatchObject({
          _tag: "Composite",
          issues: [
            {
              _tag: "Pointer",
              path: ["coverage"],
              issue: {
                _tag: "Composite",
                issues: [
                  {
                    _tag: "Pointer",
                    path: [0],
                    issue: {
                      _tag: "Composite",
                      issues: [{ _tag: "Pointer", path: ["status"] }],
                    },
                  },
                ],
              },
            },
          ],
        });
        expect(error.message).toBe(
          'Expected @beep/test-utils/ConformanceLedger/CoverageStatus\n  at ["coverage"][0]["status"]'
        );
      }
    })
  );

  it.effect("reports malformed test IDs and empty file or slug segments", () =>
    Effect.gen(function* () {
      const malformedTestIds = [evidenceFile, "#missing-file-segment", `${evidenceFile}#`];
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryTestIds: malformedTestIds,
      });

      expect(issues).toEqual([
        `invariant test id is not a test-relative path and title slug: ${evidenceFile}`,
        "invariant test id is not a test-relative path and title slug: #missing-file-segment",
        `invariant test id is not a test-relative path and title slug: ${evidenceFile}#`,
        `invariant test id does not match a declared test title: ${evidenceFile}`,
        "invariant test id does not match a declared test title: #missing-file-segment",
        `invariant test id does not match a declared test title: ${evidenceFile}#`,
      ]);
    })
  );

  it.effect("reports a valid test ID whose title is not declared", () =>
    Effect.gen(function* () {
      const missingTestId = `${evidenceFile}#title-that-is-not-declared`;
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryTestIds: [missingTestId],
      });

      expect(issues).toEqual([`invariant test id does not match a declared test title: ${missingTestId}`]);
    })
  );

  it.effect("recognizes double, single, and backtick quoted test titles", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryTestIds: [
          `${evidenceFile}#recognizes-a-double-quoted-title`,
          `${evidenceFile}#recognizes-a-single-quoted-title`,
          `${evidenceFile}#recognizes-a-backtick-quoted-title`,
        ],
      });

      expect(issues).toEqual([]);
    })
  );

  it.effect("rejects a matching test title whose source never references the runtime validator", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryTestIds: [`${evidenceFile}#recognizes-a-double-quoted-title`],
        evidenceSource: `
          it("recognizes a double-quoted title", () => undefined)
          it("rejects an invalid example", () => undefined)
        `,
      });

      expect(issues).toEqual([
        `cited tests do not reference runtime validator Example.validate for invariant ${invariantId}; files=${evidenceFile}`,
      ]);
    })
  );

  it.effect("requires negative evidence before a hard runtime invariant can be covered", () =>
    Effect.gen(function* () {
      const mustIssues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryTestIds: [`${evidenceFile}#recognizes-a-double-quoted-title`],
        primaryNegativeTestIds: [],
      });
      const mustNotIssues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryStrength: "mustNot",
        primaryTestIds: [`${evidenceFile}#recognizes-a-double-quoted-title`],
        primaryNegativeTestIds: [],
      });

      expect(mustIssues).toEqual([
        `covered runtime must invariant ${invariantId} must cite at least one negative test`,
      ]);
      expect(mustNotIssues).toEqual([
        `covered runtime mustNot invariant ${invariantId} must cite at least one negative test`,
      ]);
    })
  );

  it.effect("does not require negative runtime evidence for advisory or documentation-only invariants", () =>
    Effect.gen(function* () {
      const advisoryIssues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryStrength: "should",
        primaryTestIds: [`${evidenceFile}#recognizes-a-double-quoted-title`],
        primaryNegativeTestIds: [],
      });
      const documentedIssues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryDecidability: "undecidable",
        primaryEnforcement: [
          {
            kind: "documented",
            rationale: "The external semantic judgment is recorded for callers.",
          },
        ],
        primaryNegativeTestIds: [],
      });

      expect(advisoryIssues).toEqual([]);
      expect(documentedIssues).toEqual([]);
    })
  );

  it.effect("reports inventory source-reference drift", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({ coverageStatus: "covered", inventorySourceId: "missing-source" });

      expect(issues).toEqual(["inventory.json items references unknown id missing-source"]);
    })
  );

  it.effect("reports profile invariants missing from coverage selection", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryProfileInvariantIds: [invariantId, secondaryInvariantId],
      });

      expect(issues).toEqual([
        "coverage.json profile example-profile invariantIds differ from sources.json; coverage=[example.invariant]; profile=[example.invariant, example.secondary-invariant]",
      ]);
    })
  );

  it.effect("reports coverage selections missing from the profile", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        secondaryCoverageProfileIds: [secondaryProfileId, profileId],
      });

      expect(issues).toEqual([
        "coverage.json profile example-profile invariantIds differ from sources.json; coverage=[example.invariant, example.secondary-invariant]; profile=[example.invariant]",
      ]);
    })
  );

  it.effect("reports duplicate profile selections within one coverage entry", () =>
    Effect.gen(function* () {
      const issues = yield* runFixture({
        coverageStatus: "covered",
        inventorySourceId: sourceId,
        primaryCoverageProfileIds: [profileId, profileId],
      });

      expect(issues).toEqual([
        "coverage.json invariant example.invariant profileIds contains duplicate id example-profile",
      ]);
    })
  );
});
