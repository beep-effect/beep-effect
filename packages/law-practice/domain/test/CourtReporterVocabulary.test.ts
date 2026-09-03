import {
  ArtifactDriftChangeKind,
  ContextualAlias,
  CourtId,
  CourtReporterArtifact,
  CourtReporterArtifactComparison,
  CourtReporterArtifactContract,
  CourtReporterArtifactVersion,
  CourtReporterCompatibilityPolicy,
  CourtSystem,
  CourtType,
  CourtVocabulary,
  CourtVocabularyArtifact,
  CourtVocabularyRecord,
  classifyCourtReporterArtifactCompatibility,
  EffectiveRange,
  findCourtById,
  findCourtsByAlias,
  findReporterById,
  findReportersByAlias,
  isCurrentCourtReporterArtifactVersion,
  ReporterCiteType,
  ReporterEdition,
  ReporterId,
  ReporterVocabulary,
  ReporterVocabularyArtifact,
  ReporterVocabularyRecord,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { NonNegativeInt } from "@beep/schema";
import { A, O, Str } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { pipe } from "effect";
import * as Order from "effect/Order";
import * as S from "effect/Schema";

const currentCourt = CourtVocabulary.records[0]!;
const secondCourt = CourtVocabulary.records[1]!;
const thirdCourt = CourtVocabulary.records[2]!;
const currentReporter = ReporterVocabulary.records[0]!;
const secondReporter = ReporterVocabulary.records[1]!;

const courtsArtifact = (records: ReadonlyArray<CourtVocabularyRecord>) =>
  CourtVocabularyArtifact.make({
    ...CourtVocabulary,
    stableIdCount: NonNegativeInt.make(A.length(records)),
    records,
  });

const reportersArtifact = (records: ReadonlyArray<ReporterVocabularyRecord>) =>
  ReporterVocabularyArtifact.make({
    ...ReporterVocabulary,
    stableIdCount: NonNegativeInt.make(A.length(records)),
    records,
  });

const comparisonArtifact = ({
  courts = A.empty<CourtVocabularyRecord>(),
  reporters = A.empty<ReporterVocabularyRecord>(),
  schemaVersion = CourtReporterArtifact.schemaVersion,
  projectionVersion = CourtReporterArtifact.projectionVersion,
  version = CourtReporterArtifact.artifactVersion,
}: {
  readonly courts?: ReadonlyArray<CourtVocabularyRecord>;
  readonly reporters?: ReadonlyArray<ReporterVocabularyRecord>;
  readonly schemaVersion?: string;
  readonly projectionVersion?: number;
  readonly version?: CourtReporterArtifactVersion;
}) =>
  CourtReporterArtifactComparison.make({
    schemaVersion,
    projectionVersion,
    artifactVersion: version,
    policy: CourtReporterCompatibilityPolicy,
    courts: courtsArtifact(courts),
    reporters: reportersArtifact(reporters),
  });

const court = (
  base: CourtVocabularyRecord,
  fields: Partial<{
    readonly effectiveRanges: CourtVocabularyRecord["effectiveRanges"];
    readonly hierarchyLevel: CourtVocabularyRecord["hierarchyLevel"];
    readonly id: CourtId;
    readonly semanticKey: string;
    readonly lineageKey: string;
    readonly aliases: ReadonlyArray<string>;
    readonly contextualAliases: ReadonlyArray<ContextualAlias>;
    readonly parentId: CourtVocabularyRecord["parentId"];
    readonly sourceJurisdiction: CourtVocabularyRecord["sourceJurisdiction"];
    readonly status: "active" | "tombstone";
    readonly successorId: O.Option<CourtId>;
  }>
) => CourtVocabularyRecord.make({ ...base, ...fields });

const reporter = (
  base: ReporterVocabularyRecord,
  fields: Partial<{
    readonly editions: ReporterVocabularyRecord["editions"];
    readonly id: ReporterId;
    readonly semanticKey: string;
    readonly lineageKey: string;
    readonly aliases: ReadonlyArray<string>;
    readonly contextualAliases: ReadonlyArray<ContextualAlias>;
    readonly jurisdictions: ReporterVocabularyRecord["jurisdictions"];
    readonly status: "active" | "tombstone";
    readonly successorId: O.Option<ReporterId>;
  }>
) => ReporterVocabularyRecord.make({ ...base, ...fields });

const classify = (previous: Parameters<typeof comparisonArtifact>[0], next: Parameters<typeof comparisonArtifact>[0]) =>
  classifyCourtReporterArtifactCompatibility(comparisonArtifact(previous), comparisonArtifact(next));

describe("CourtReporterVocabulary", () => {
  it("publishes schema-decoded pinned artifacts with unique stable identities", () => {
    expect(S.is(CourtVocabularyArtifact)(CourtVocabulary)).toBe(true);
    expect(S.is(ReporterVocabularyArtifact)(ReporterVocabulary)).toBe(true);
    expect(CourtVocabulary.stableIdCount).toBe(2_809);
    expect(ReporterVocabulary.stableIdCount).toBe(1_262);
    expect(A.length(A.dedupe(A.map(CourtVocabulary.records, ({ id }) => id)))).toBe(2_809);
    expect(A.length(A.dedupe(A.map(ReporterVocabulary.records, ({ id }) => id)))).toBe(1_262);
    expect(CourtVocabulary.artifactVersion).toBe(ReporterVocabulary.artifactVersion);
    expect(CourtVocabulary.source.commit).toBe("f353e51400a55cc8942b230b3e12540ad364fd23");
    expect(ReporterVocabulary.source.commit).toBe("fad63b383b92f9446c223ddc12bf0b6fd1a6b44c");
  });

  it("preserves the pinned source literal domains without lossy remapping", () => {
    const systems = A.sort(A.dedupe(A.map(CourtVocabulary.records, ({ system }) => system)), Order.String);
    const types = A.sort(A.dedupe(A.getSomes(A.map(CourtVocabulary.records, ({ type }) => type))), Order.String);
    const citeTypes = A.sort(A.dedupe(A.map(ReporterVocabulary.records, ({ citeType }) => citeType)), Order.String);

    expect(systems).toStrictEqual(CourtSystem.Options);
    expect(types).toStrictEqual(CourtType.Options);
    expect(citeTypes).toStrictEqual(ReporterCiteType.Options);
  });

  it("resolves stable identities and preserves ambiguous aliases", () => {
    expect(O.getOrThrow(findCourtById(currentCourt.id)).semanticKey).toBe(currentCourt.semanticKey);
    expect(O.getOrThrow(findReporterById(currentReporter.id)).semanticKey).toBe(currentReporter.semanticKey);
    expect(findCourtsByAlias("Ala.").length).toBeGreaterThan(0);
    expect(findReportersByAlias("Woolw.")).toHaveLength(2);
    expect(findReportersByAlias("Woolw.").map(({ id }) => id)).not.toStrictEqual([
      findReportersByAlias("Woolw.")[0]?.id,
    ]);
  });

  it("exposes vocabulary-only projections and an exact-version parser gate", () => {
    expect("regexes" in ReporterVocabulary).toBe(false);
    expect("variations" in currentReporter).toBe(false);
    expect("sub_names" in currentCourt).toBe(false);
    expect(isCurrentCourtReporterArtifactVersion(CourtReporterArtifact.artifactVersion)).toBe(true);
    expect(isCurrentCourtReporterArtifactVersion("crv1:stale-parser-build")).toBe(false);
  });

  it("rejects a combined contract whose independently generated artifact versions differ", () => {
    const mismatchedReporters = ReporterVocabularyArtifact.make({
      ...ReporterVocabulary,
      artifactVersion: CourtReporterArtifactVersion.make("crv1:fixture-mismatched-reporters"),
    });

    expect(() =>
      CourtReporterArtifactContract.make({
        ...CourtReporterArtifact,
        reporters: mismatchedReporters,
      })
    ).toThrow();
  });

  it("accepts future nested artifact headers before classifying contract drift", () => {
    const future = CourtReporterArtifactComparison.make({
      ...CourtReporterArtifact,
      schemaVersion: "court-reporter-vocabulary/v2",
      projectionVersion: 2,
      courts: {
        ...CourtVocabulary,
        schemaVersion: "court-reporter-vocabulary/v2",
        projectionVersion: 2,
      },
      reporters: {
        ...ReporterVocabulary,
        schemaVersion: "court-reporter-vocabulary/v2",
        projectionVersion: 2,
      },
    });
    const report = classifyCourtReporterArtifactCompatibility(
      CourtReporterArtifactComparison.make(CourtReporterArtifact),
      future
    );

    expect(report.compatibility).toBe("incompatible");
    expect(A.map(report.changes, ({ kind }) => kind)).toEqual(
      expect.arrayContaining(["schemaChange", "projectionChange"])
    );
  });

  it("classifies nested header drift and rejects incoherent nested artifact identities", () => {
    const current = CourtReporterArtifactComparison.make(CourtReporterArtifact);
    const nestedDrift = CourtReporterArtifactComparison.make({
      ...CourtReporterArtifact,
      courts: {
        ...CourtVocabulary,
        schemaVersion: "court-reporter-vocabulary/v2",
        projectionVersion: 2,
      },
    });
    const report = classifyCourtReporterArtifactCompatibility(current, nestedDrift);

    expect(report.compatibility).toBe("incompatible");
    expect(A.map(report.changes, ({ kind }) => kind)).toEqual(
      expect.arrayContaining(["schemaChange", "projectionChange"])
    );
    expect(() =>
      CourtReporterArtifactComparison.make({
        ...CourtReporterArtifact,
        courts: {
          ...CourtVocabulary,
          artifactVersion: CourtReporterArtifactVersion.make("crv1:fixture-mismatched-courts"),
        },
      })
    ).toThrow();
  });

  it("classifies every ratified lifecycle and incompatibility change", () => {
    const addedCourt = court(currentCourt, {
      id: CourtId.make("fixture-added-court"),
      semanticKey: "fixture-added-court",
      lineageKey: "fixture-added-court",
      aliases: ["Fixture Added Court"],
    });
    const aliasedCourt = court(currentCourt, { aliases: [...currentCourt.aliases, "Fixture Alias"] });
    const tombstonedCourt = court(currentCourt, {
      status: "tombstone",
      successorId: O.some(secondCourt.id),
    });
    const secondTombstone = court(secondCourt, {
      status: "tombstone",
      successorId: O.some(thirdCourt.id),
    });
    const firstTombstone = court(currentCourt, {
      status: "tombstone",
      successorId: O.some(thirdCourt.id),
    });
    const previousReporter = reporter(currentReporter, { aliases: ["Fixture Rep."] });
    const unrelatedReporter = reporter(secondReporter, { aliases: ["Other Rep."] });
    const reusedReporter = reporter(secondReporter, { aliases: ["Other Rep.", "Fixture Rep."] });
    const splitReporter = reporter(currentReporter, {
      id: ReporterId.make("reporter:fixture-date-split"),
      semanticKey: `${currentReporter.semanticKey}:date-split`,
      lineageKey: currentReporter.lineageKey,
      aliases: ["Fixture Split Rep."],
    });
    const reassignedCourt = court(currentCourt, { id: CourtId.make("fixture-reassigned-court") });
    const reusedCourt = court(currentCourt, { semanticKey: "fixture-semantic-reuse" });
    const removedSuccessorCourt = court(tombstonedCourt, { successorId: O.none() });

    const reports = [
      classify({ courts: [currentCourt] }, { courts: [currentCourt, addedCourt] }),
      classify({ courts: [currentCourt] }, { courts: [aliasedCourt] }),
      classify({ courts: [aliasedCourt] }, { courts: [currentCourt] }),
      classify({ courts: [currentCourt, secondCourt] }, { courts: [tombstonedCourt, secondCourt] }),
      classify(
        { courts: [currentCourt, secondCourt, thirdCourt] },
        { courts: [firstTombstone, secondTombstone, thirdCourt] }
      ),
      classify({ reporters: [previousReporter, unrelatedReporter] }, { reporters: [previousReporter, reusedReporter] }),
      classify({ reporters: [previousReporter] }, { reporters: [previousReporter, splitReporter] }),
      classify({ courts: [currentCourt] }, { courts: [reassignedCourt] }),
      classify({ courts: [currentCourt] }, { courts: [reusedCourt] }),
      classify({ courts: [currentCourt] }, { courts: [] }),
      classify({ schemaVersion: "court-reporter-vocabulary/v0" }, { schemaVersion: "court-reporter-vocabulary/v1" }),
      classify({ projectionVersion: NonNegativeInt.make(0) }, { projectionVersion: NonNegativeInt.make(1) }),
      classify({ courts: [tombstonedCourt, secondCourt] }, { courts: [removedSuccessorCourt, secondCourt] }),
    ];
    const kinds = A.sort(
      A.dedupe(A.flatMap(reports, ({ changes }) => A.map(changes, ({ kind }) => kind))),
      Order.String
    );

    expect(kinds).toStrictEqual(A.sort([...ArtifactDriftChangeKind.Options], Order.String));
    expect(
      A.every([reports[0], reports[1], ...reports.slice(3, 7)], ({ compatibility }) => compatibility === "compatible")
    ).toBe(true);
    expect(A.every([reports[2], ...reports.slice(7)], ({ compatibility }) => compatibility === "incompatible")).toBe(
      true
    );
  });

  it("reports an unchanged artifact as compatible with no drift", () => {
    const current = CourtReporterArtifactComparison.make(CourtReporterArtifact);
    const report = classifyCourtReporterArtifactCompatibility(current, current);

    expect(report.compatibility).toBe("compatible");
    expect(report.changes).toStrictEqual([]);
  });

  it("rejects retained identities whose semantic fields or range boundaries drift", () => {
    const courtWithHierarchy = O.getOrThrow(
      A.findFirst(CourtVocabulary.records, ({ hierarchyLevel }) => O.isSome(hierarchyLevel))
    );
    const courtWithJurisdiction = O.getOrThrow(
      A.findFirst(CourtVocabulary.records, ({ sourceJurisdiction }) => O.isSome(sourceJurisdiction))
    );
    const courtWithRange = O.getOrThrow(
      A.findFirst(CourtVocabulary.records, ({ effectiveRanges }) => A.isReadonlyArrayNonEmpty(effectiveRanges))
    );
    const reporterWithEdition = O.getOrThrow(
      A.findFirst(ReporterVocabulary.records, ({ editions }) => A.isReadonlyArrayNonEmpty(editions))
    );
    const courtRange = courtWithRange.effectiveRanges[0]!;
    const reporterEdition = reporterWithEdition.editions[0]!;
    const semanticDriftReports = [
      classify({ courts: [courtWithHierarchy] }, { courts: [court(courtWithHierarchy, { hierarchyLevel: O.none() })] }),
      classify(
        { courts: [courtWithJurisdiction] },
        { courts: [court(courtWithJurisdiction, { sourceJurisdiction: O.none() })] }
      ),
      classify(
        { courts: [currentCourt] },
        {
          courts: [
            court(currentCourt, {
              parentId: O.isSome(currentCourt.parentId) ? O.none() : O.some(secondCourt.id),
            }),
          ],
        }
      ),
      classify(
        { courts: [courtWithRange] },
        {
          courts: [
            court(courtWithRange, {
              effectiveRanges: [
                EffectiveRange.make({
                  ...courtRange,
                  start: O.isSome(courtRange.start) ? O.none() : O.some("fixture-start"),
                }),
                ...A.drop(courtWithRange.effectiveRanges, 1),
              ],
            }),
          ],
        }
      ),
      classify(
        { reporters: [currentReporter] },
        {
          reporters: [
            reporter(currentReporter, {
              jurisdictions: [...currentReporter.jurisdictions, "fixture-jurisdiction"],
            }),
          ],
        }
      ),
      classify(
        { reporters: [reporterWithEdition] },
        {
          reporters: [
            reporter(reporterWithEdition, {
              editions: [
                ReporterEdition.make({
                  ...reporterEdition,
                  end: O.isSome(reporterEdition.end) ? O.none() : O.some("fixture-end"),
                }),
                ...A.drop(reporterWithEdition.editions, 1),
              ],
            }),
          ],
        }
      ),
    ];

    expect(
      A.every(
        semanticDriftReports,
        ({ compatibility, changes }) =>
          compatibility === "incompatible" && A.some(changes, ({ kind }) => kind === "semanticReuse")
      )
    ).toBe(true);
  });

  it("does not replay an unchanged historical successor transition", () => {
    const tombstonedCourt = court(currentCourt, {
      status: "tombstone",
      successorId: O.some(secondCourt.id),
    });
    const historical = comparisonArtifact({ courts: [tombstonedCourt, secondCourt] });
    const report = classifyCourtReporterArtifactCompatibility(historical, historical);

    expect(report.compatibility).toBe("compatible");
    expect(report.changes).toStrictEqual([]);
  });

  it("recognizes retained range splits and newly published successor transitions", () => {
    const addedRange = EffectiveRange.make({ start: O.some("2026-01-01"), end: O.none() });
    const splitCourt = court(currentCourt, {
      effectiveRanges: [...currentCourt.effectiveRanges, addedRange],
    });
    const newTombstone = court(currentCourt, {
      id: CourtId.make("fixture-new-tombstone"),
      semanticKey: "fixture-new-tombstone",
      lineageKey: "fixture-new-tombstone",
      status: "tombstone",
      successorId: O.some(secondCourt.id),
    });
    const report = classify(
      { courts: [currentCourt, secondCourt] },
      { courts: [splitCourt, secondCourt, newTombstone] }
    );

    expect(A.map(report.changes, ({ kind }) => kind)).toEqual(expect.arrayContaining(["dateSplit", "successor"]));
    expect(report.compatibility).toBe("compatible");
  });

  it("classifies plain-alias changes even when the same text remains contextual", () => {
    const contextualAlias = ContextualAlias.make({ alias: "Fixture Rep.", context: "Fixture context" });
    const contextualOnly = reporter(currentReporter, {
      aliases: [],
      contextualAliases: [contextualAlias],
    });
    const contextualAndPlain = reporter(currentReporter, {
      aliases: [contextualAlias.alias],
      contextualAliases: [contextualAlias],
    });
    const addition = classify({ reporters: [contextualOnly] }, { reporters: [contextualAndPlain] });
    const removal = classify({ reporters: [contextualAndPlain] }, { reporters: [contextualOnly] });

    expect(A.map(addition.changes, ({ kind }) => kind)).toContain("aliasAddition");
    expect(A.map(removal.changes, ({ kind }) => kind)).toContain("aliasRemoval");
    expect(addition.compatibility).toBe("compatible");
    expect(removal.compatibility).toBe("incompatible");
  });

  it("rejects direct transitions between plain-only and contextual-only aliases", () => {
    const contextualAlias = ContextualAlias.make({ alias: "Fixture Rep.", context: "Fixture context" });
    const plainOnly = reporter(currentReporter, {
      aliases: [contextualAlias.alias],
      contextualAliases: [],
    });
    const contextualOnly = reporter(currentReporter, {
      aliases: [],
      contextualAliases: [contextualAlias],
    });
    const toContextual = classify({ reporters: [plainOnly] }, { reporters: [contextualOnly] });
    const toPlain = classify({ reporters: [contextualOnly] }, { reporters: [plainOnly] });

    expect(A.map(toContextual.changes, ({ kind }) => kind)).toEqual(
      expect.arrayContaining(["aliasAddition", "aliasRemoval"])
    );
    expect(A.map(toPlain.changes, ({ kind }) => kind)).toEqual(
      expect.arrayContaining(["aliasAddition", "aliasRemoval"])
    );
    expect(toContextual.compatibility).toBe("incompatible");
    expect(toPlain.compatibility).toBe("incompatible");
  });

  it("publishes distinct reporter context for reused aliases with matching names", () => {
    const arkansasReporters = A.filter(findReportersByAlias("Ark."), ({ name }) => name === "Arkansas Reports");
    const contexts = pipe(
      arkansasReporters,
      A.flatMap(({ contextualAliases }) =>
        pipe(
          contextualAliases,
          A.filter(({ alias }) => alias === "Ark."),
          A.map(({ context }) => context)
        )
      )
    );

    expect(arkansasReporters.length).toBeGreaterThan(1);
    expect(A.length(A.dedupe(contexts))).toBe(arkansasReporters.length);
    expect(
      A.every(contexts, (context) => Str.includes("cite-type=")(context) && Str.includes("editions=")(context))
    ).toBe(true);
  });
});
