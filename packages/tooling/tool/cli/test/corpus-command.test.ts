import {
  ArchiveLedgerRecord,
  archiveMoveCorpus,
  CollectorManifestRecord,
  CorpusArchiveMoveManifestRecord,
  CorpusArchiveMoveOptions,
  CorpusCatalogOptions,
  CorpusCommandServiceLive,
  CorpusExtractOptions,
  CorpusProvenanceRecord,
  CorpusSalvageOptions,
  CorpusSalvageSourceSpec,
  catalogCorpus,
  classifyRecycleBinName,
  decodeArchiveLedgerRecordJson,
  decodeCorpusProvenanceRecordJson,
  decodeTransformationLedgerRecordJson,
  encodeArchiveLedgerRecordJson,
  encodeCorpusProvenanceRecordJson,
  encodeTransformationLedgerRecordJson,
  extractCorpus,
  pairRecycleBinEntries,
  parseRecycleBinMetadata,
  preserveRestorationArchive,
  RecycleBinScanEntry,
  RestorationLegacyWordOptions,
  RestorationMailOptions,
  RestorationPreserveOptions,
  RestorationRecycleOptions,
  RestorationVerifyOptions,
  reconcileRestorationAcceptance,
  restoreLegacyWord,
  restoreMail,
  restoreRecycle,
  salvageCorpus,
  TransformationLedgerRecord,
  verifyRestorationArchive,
  verifySalvage,
} from "@beep/repo-cli/commands/Corpus";
import {
  restorationArchiveTesting as RA,
  restorationTransformationTesting as RT,
  withRestorationWriterClaim,
} from "@beep/repo-cli/test/Corpus";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { assertDefined, assertNone, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { Context, Effect, FileSystem, Layer, Match, Order, Path, pipe, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import { ChildProcess } from "effect/process";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";
import { expect } from "vitest";
import type { PlatformError } from "effect";

const PosInt = S.Int.check(S.isGreaterThan(0, { message: "Expected a positive integer" }));

const decodeRestorationVerifyOptions = S.decodeEffect(RestorationVerifyOptions);
const decodeUnknownCollectorManifestRecordResult = S.decodeUnknownResult(CollectorManifestRecord);
const isTransformationLedgerRecordCasesAttachmentTypeRepair = S.is(
  TransformationLedgerRecord.cases["attachment-type-repair"]
);
const isTransformationLedgerRecordCasesFamilyAttemptInterrupted = S.is(
  TransformationLedgerRecord.cases["family-attempt-interrupted"]
);
const isTransformationLedgerRecordCasesFamilyAttemptStart = S.is(
  TransformationLedgerRecord.cases["family-attempt-start"]
);
const isTransformationLedgerRecordCasesFamilyRunSummary = S.is(TransformationLedgerRecord.cases["family-run-summary"]);
const isTransformationLedgerRecordCasesMailChildPass = S.is(TransformationLedgerRecord.cases["mail-child-pass"]);
const isTransformationLedgerRecordCasesMailStoreException = S.is(
  TransformationLedgerRecord.cases["mail-store-exception"]
);
const isTransformationLedgerRecordCasesMailStorePass = S.is(TransformationLedgerRecord.cases["mail-store-pass"]);
const isTransformationLedgerRecordCasesMailWarning = S.is(TransformationLedgerRecord.cases["mail-warning"]);

const testLayer = Layer.mergeAll(
  CorpusCommandServiceLive.pipe(Layer.provideMerge(NodeServices.layer)),
  NodeServices.layer
);

const schemaRoundTripLaw = <Schema extends S.Codec<unknown>>(schema: Schema) => {
  const encode = S.encodeResult(schema);
  const decode = S.decodeUnknownResult(schema);
  const equivalent = S.toEquivalence(schema);
  return ([value]: readonly [Schema["Type"]], ctx: import("vitest").TestContext) =>
    Effect.sync(() => {
      ctx.expect.assertions(fcRuns(10).runs);
      const encoded = Result.getOrThrow(encode(value));
      const decoded = Result.getOrThrow(decode(encoded));
      ctx.expect(equivalent(decoded, value)).toBe(true);
    });
};
const collectorRoundTrip = schemaRoundTripLaw(CollectorManifestRecord);
const archiveMoveRoundTrip = schemaRoundTripLaw(CorpusArchiveMoveManifestRecord);
const provenanceRoundTrip = schemaRoundTripLaw(CorpusProvenanceRecord);
const archivePreflightRoundTrip = schemaRoundTripLaw(ArchiveLedgerRecord.cases["archive-preflight"]);
const familySummaryRoundTrip = schemaRoundTripLaw(TransformationLedgerRecord.cases["family-run-summary"]);
const verifyOptionsRoundTrip = schemaRoundTripLaw(RestorationVerifyOptions);

it.layer(testLayer, { timeout: "30 seconds" })("corpus evidence schemas", (it) => {
  it.effect.prop("round-trips schema-derived collector manifest", [CollectorManifestRecord], collectorRoundTrip, {
    arbitrary: fcRuns(10),
  });
  it.effect.prop(
    "round-trips schema-derived archive move manifest",
    [CorpusArchiveMoveManifestRecord],
    archiveMoveRoundTrip,
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop("round-trips schema-derived provenance", [CorpusProvenanceRecord], provenanceRoundTrip, {
    arbitrary: fcRuns(10),
  });
  it.effect.prop(
    "round-trips schema-derived archive preflight",
    [ArchiveLedgerRecord.cases["archive-preflight"]],
    archivePreflightRoundTrip,
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop(
    "round-trips schema-derived family summary",
    [TransformationLedgerRecord.cases["family-run-summary"]],
    familySummaryRoundTrip,
    { arbitrary: fcRuns(10) }
  );
  it.effect.prop("round-trips schema-derived verify options", [RestorationVerifyOptions], verifyOptionsRoundTrip, {
    arbitrary: fcRuns(10),
  });

  it("decodes inherited collector failures and secret exclusions without destination fields", () => {
    assertTrue(
      Result.isSuccess(
        decodeUnknownCollectorManifestRecordResult({
          reason: "source unreadable",
          src: "C:\\source\\unreadable.bin",
          status: "error",
        })
      )
    );
    assertTrue(
      Result.isSuccess(
        decodeUnknownCollectorManifestRecordResult({
          src: "C:\\source\\excluded.bin",
          status: "excluded-secret",
        })
      )
    );
  });
});

// Qualification applies only to the existing completed real fixtures.
// Before adoption, assert the fixture role inventory (five engine children, one PDF
// derivative, one Tika derivative; no interruption/warning/mail-exception rows).
// Any new fixture role requires an explicit semantic oracle extension.
// Paste after the existing hoisted schema guards. Add LiteralKit to @beep/schema imports.
// This oracle describes structural reconciliation of the unchanged original summary.
// It deliberately does not claim schema validity or sealed-ledger acceptance.
const rejectsRunStartField = S.is(
  LiteralKit(["expectedCount", "maxTotalElapsedMillis", "maxTotalOutputBytes", "recordType"])
);
const rejectsAttemptStartField = S.is(LiteralKit(["attemptId", "family", "recordType", "retryOrdinal", "sourceId"]));
const rejectsRepairField = S.is(
  LiteralKit([
    "attemptId",
    "derivedSha256",
    "derivedRelativePath",
    "derivedSizeBytes",
    "repairStatus",
    "sourceObjectId",
  ])
);
const rejectsChildField = S.is(LiteralKit(["attemptId", "engineReported", "recordType"]));
const rejectsMailPassField = S.is(
  LiteralKit(["accountedChildCount", "attemptId", "childCount", "objectId", "recordType", "warningCount"])
);
const rejectsMappingField = S.is(LiteralKit(["attemptId", "contentObjectId", "metadataObjectId", "recordType"]));
const rejectsJoinField = S.is(LiteralKit(["count", "sourceObjectIds"]));
const rejectsLegacyExceptionField = S.is(LiteralKit(["approved", "attemptId", "originalSha256", "recordType"]));
const rejectsLegacyPassField = S.is(LiteralKit(["attemptId", "originalSha256", "recordType"]));
const copiedDerivativeField = S.is(LiteralKit(["childRelativePath", "sha256", "sizeBytes", "sourceObjectId"]));
const tikaDerivativeField = S.is(LiteralKit(["childRelativePath", "sourceObjectId"]));

const expectedStructuralMutation = (record: TransformationLedgerRecord, field: string): boolean =>
  Match.value(record).pipe(
    Match.when({ recordType: "family-run-start" }, () => !rejectsRunStartField(field)),
    Match.when({ recordType: "family-attempt-start" }, () => !rejectsAttemptStartField(field)),
    Match.when({ recordType: "attachment-type-repair" }, () => !rejectsRepairField(field)),
    Match.when({ recordType: "mail-store-pass" }, () => !rejectsMailPassField(field)),
    Match.when({ recordType: "recycle-mapping" }, () => !rejectsMappingField(field)),
    Match.when({ recordType: "legacy-word-exception" }, () => !rejectsLegacyExceptionField(field)),
    Match.when({ recordType: "legacy-word-pass" }, () => !rejectsLegacyPassField(field)),
    Match.when({ recordType: "recycle-join" }, (join) => {
      if (rejectsJoinField(field)) return false;
      if (field === "recordType") return join.count === 0;
      if (field === "joinClass") return join.joinClass !== "valid-pair" || join.count === 0;
      return true;
    }),
    Match.when({ recordType: "mail-child-pass" }, (child) => {
      if (rejectsChildField(field)) return false;
      // The real fixture's controlled converter emits five engine rows, one PDF copy,
      // and one Tika text derivative. Classify fixture roles by promised output shape,
      // rather than reimplementing production repair-to-child matching conditions.
      const copied =
        !child.engineReported &&
        Str.startsWith("derived/attachment-repairs/")(child.childRelativePath) &&
        Str.endsWith(".pdf")(child.childRelativePath);
      const tika =
        !child.engineReported &&
        Str.startsWith("derived/attachment-repairs/")(child.childRelativePath) &&
        Str.endsWith(".tika.txt")(child.childRelativePath);
      return !(copied && copiedDerivativeField(field)) && !(tika && tikaDerivativeField(field));
    }),
    // These completed fixtures contain no interruption, mail-warning or mail-exception rows.
    // Summary/acceptance rows are outside the segment predicate's inputs: summary is captured separately.
    Match.orElse(() => true)
  );

const expectedSystematicStructuralVerdicts = (records: ReadonlyArray<TransformationLedgerRecord>) =>
  A.flatMap(records, (record) =>
    A.flatMap(Object.entries(record), ([field, value]) =>
      O.match(mutatedEvidenceValue(value), {
        onNone: A.empty,
        onSome: () => [expectedStructuralMutation(record, field)],
      })
    )
  );

// Independent fixture-event matrix: change the expected claims associated with a
// field role, never run a production reconciliation predicate to obtain expectations.
const isLedgerRecord = S.is(TransformationLedgerRecord);
const decodeUnknownLedgerRecordResult = S.decodeUnknownResult(TransformationLedgerRecord);
const rejectsSchemaStringMutation = S.is(
  LiteralKit([
    "schemaVersion",
    "runLabel",
    "preservationSealSha256",
    "recordType",
    "family",
    "attemptId",
    "mailScope",
    "policySha256",
    "sourceSha256",
    "sha256",
    "postProcessSha256",
    "derivedSha256",
    "digest",
    "originalSha256",
    "convertedSha256",
    "normalizedTextSha256",
    "postProcessOriginalSha256",
    "outputTreeSha256",
    "evidenceSha256",
    "retainedOutputSha256",
    "repairStatus",
    "joinClass",
    "exceptionKind",
    "sourceFamily",
    "disposition",
  ])
);

const isTerminalFixtureRecord = S.is(
  LiteralKit(["mail-store-pass", "recycle-mapping", "legacy-word-pass", "legacy-word-exception"])
);
const isBindingClaim = S.is(LiteralKit(["attemptId", "family", "recordType", "retryOrdinal", "sourceId"]));
const isPassCountClaim = S.is(LiteralKit(["accountedChildCount", "childCount", "warningCount"]));
const isRepairOutputClaim = S.is(LiteralKit(["derivedRelativePath", "derivedSizeBytes", "sourceObjectId"]));
const isValidFixtureRecordType = S.is(
  LiteralKit([
    "family-run-start",
    "family-attempt-start",
    "attachment-type-repair",
    "mail-child-pass",
    "mail-store-pass",
    "recycle-mapping",
    "recycle-join",
    "legacy-word-exception",
    "legacy-word-pass",
    "family-run-summary",
    "family-acceptance-pass",
  ])
);

const EvidenceVerdicts = S.Struct({
  passVerdicts: S.Array(S.Boolean),
  exceptionVerdicts: S.Array(S.Boolean),
  attachmentRepairsReconcile: S.Boolean,
  mailTerminalIdentitiesReconcile: S.Boolean,
  mailOwnedEvidenceReconciles: S.Boolean,
  mailTerminalCountsReconcile: S.Boolean,
  mailSegmentReconciles: S.Boolean,
  recycleSegmentReconciles: S.Boolean,
  legacySegmentReconciles: S.Boolean,
  familyRunStartReconciles: S.Boolean,
  attemptSettlementsReconcile: S.Boolean,
  attemptBindingsReconcile: S.Boolean,
  attemptRetryOrdinalsReconcile: S.Boolean,
  latestAttemptsAreTerminal: S.Boolean,
  resumableAttemptLifecycleReconciles: S.Boolean,
  transformationAttemptLifecycleReconciles: S.Boolean,
  transformationSegmentReconciles: S.Boolean,
});
const MailApprovalControl = S.Struct({
  record: TransformationLedgerRecord.cases["mail-store-exception"],
  expected: S.Boolean,
});
const FixtureMutation = S.Struct({
  original: TransformationLedgerRecord,
  field: S.NonEmptyString,
});
const isDisplacedStartVariant = S.is(LiteralKit(["reverse", "drop-first"]));
const FixtureInputKind = LiteralKit(["class", "clone"]);
type FixtureInputKind = typeof FixtureInputKind.Type;
const FixtureVariantKind = LiteralKit([
  "original",
  "reverse",
  "drop-first",
  "drop-last",
  "duplicate",
  "empty",
  "inner-reverse",
  "unsettled",
  "field",
]);

type EvidenceVerdicts = typeof EvidenceVerdicts.Type;
type FixtureMutation = typeof FixtureMutation.Type;
type FixtureVariantKind = typeof FixtureVariantKind.Type;

const fixtureVerdictBaseline = (family: TransformationLedgerRecord["family"]): EvidenceVerdicts =>
  EvidenceVerdicts.make({
    passVerdicts: family === "mail" ? [true] : [],
    exceptionVerdicts: [],
    attachmentRepairsReconcile: true,
    mailTerminalIdentitiesReconcile: true,
    mailOwnedEvidenceReconciles: true,
    mailTerminalCountsReconcile: family === "mail",
    mailSegmentReconciles: family === "mail",
    recycleSegmentReconciles: family === "recycle",
    legacySegmentReconciles: family === "legacy-word",
    familyRunStartReconciles: true,
    attemptSettlementsReconcile: true,
    attemptBindingsReconcile: true,
    attemptRetryOrdinalsReconcile: true,
    latestAttemptsAreTerminal: true,
    resumableAttemptLifecycleReconciles: true,
    transformationAttemptLifecycleReconciles: true,
    transformationSegmentReconciles: true,
  });

// Partial verdict patches are test oracle composition, not unvalidated domain inputs.
type EvidenceVerdictPatch = Partial<EvidenceVerdicts>;

const fixtureSourceClaimChanged = ({ original: record, field }: FixtureMutation): boolean =>
  Match.value(record).pipe(
    Match.when({ recordType: "mail-store-pass" }, () => field === "objectId"),
    Match.when({ recordType: "recycle-mapping" }, () => field === "contentObjectId"),
    Match.when({ recordType: "legacy-word-pass" }, () => field === "originalSha256"),
    Match.when({ recordType: "legacy-word-exception" }, () => field === "originalSha256"),
    Match.orElse(() => false)
  );

const terminalMutationVerdicts = (mutation: FixtureMutation): EvidenceVerdictPatch => {
  const changedAttempt = mutation.field === "attemptId";
  const removedTerminal = mutation.field === "recordType";
  return {
    attemptSettlementsReconcile: !changedAttempt && !removedTerminal,
    attemptBindingsReconcile: !changedAttempt && !fixtureSourceClaimChanged(mutation),
    latestAttemptsAreTerminal: !changedAttempt && !removedTerminal,
  };
};

const typedMutationVerdicts = (mutation: FixtureMutation): EvidenceVerdictPatch =>
  Match.value(mutation.original).pipe(
    Match.when({ recordType: "family-attempt-start" }, () => ({
      attemptBindingsReconcile: mutation.field !== "retryOrdinal" && mutation.field !== "sourceId",
      attemptRetryOrdinalsReconcile: mutation.field !== "retryOrdinal",
    })),
    Match.when(
      (record) => isTerminalFixtureRecord(record.recordType),
      () => terminalMutationVerdicts(mutation)
    ),
    Match.orElse(() => ({}))
  );

const cloneMutationVerdicts = (
  family: TransformationLedgerRecord["family"],
  mutation: FixtureMutation
): EvidenceVerdictPatch => {
  const noTerminal =
    family === "mail" && mutation.original.recordType === "mail-store-pass" && mutation.field === "recordType";
  return {
    passVerdicts: [],
    exceptionVerdicts: [],
    attachmentRepairsReconcile: true,
    mailTerminalIdentitiesReconcile: true,
    mailOwnedEvidenceReconciles: true,
    mailTerminalCountsReconcile: false,
    attemptSettlementsReconcile: noTerminal,
    attemptBindingsReconcile: noTerminal,
    attemptRetryOrdinalsReconcile: true,
    latestAttemptsAreTerminal: true,
  };
};

const rawHistorySurvivesMutation = (mutation: FixtureMutation): boolean =>
  Match.value(mutation.original).pipe(
    Match.when({ recordType: "family-attempt-start" }, () => !isBindingClaim(mutation.field)),
    Match.when(
      (record) => isTerminalFixtureRecord(record.recordType),
      () => mutation.field !== "attemptId" && mutation.field !== "recordType" && !fixtureSourceClaimChanged(mutation)
    ),
    Match.orElse(() => true)
  );

const mailChildMutationVerdicts = (mutation: FixtureMutation): EvidenceVerdictPatch => {
  if (!isTransformationLedgerRecordCasesMailChildPass(mutation.original)) return {};
  const child = mutation.original;
  const pdf = !child.engineReported && Str.endsWith(".pdf")(child.childRelativePath);
  const tika = !child.engineReported && Str.endsWith(".tika.txt")(child.childRelativePath);
  const roleChange = mutation.field === "engineReported";
  return {
    passVerdicts: [!roleChange],
    attachmentRepairsReconcile:
      !(pdf && (roleChange || copiedDerivativeField(mutation.field))) &&
      !(tika && (roleChange || tikaDerivativeField(mutation.field))),
  };
};

const mailTypedOutputVerdicts = (mutation: FixtureMutation): EvidenceVerdictPatch =>
  Match.value(mutation.original).pipe(
    Match.when({ recordType: "mail-store-pass" }, () => ({
      passVerdicts: [!isPassCountClaim(mutation.field)],
      attachmentRepairsReconcile:
        mutation.field !== "attemptId" && mutation.field !== "objectId" && mutation.field !== "recordType",
    })),
    Match.when({ recordType: "mail-child-pass" }, () => mailChildMutationVerdicts(mutation)),
    Match.when({ recordType: "attachment-type-repair" }, () => ({
      attachmentRepairsReconcile: !isRepairOutputClaim(mutation.field),
    })),
    Match.orElse(() => ({}))
  );

const familyOutputVerdicts = (
  family: TransformationLedgerRecord["family"],
  mutation: FixtureMutation
): EvidenceVerdictPatch =>
  Match.value(family).pipe(
    Match.when("mail", () => ({
      mailSegmentReconciles:
        mutation.original.recordType === "family-run-start" || mutation.original.recordType === "family-attempt-start"
          ? true
          : expectedStructuralMutation(mutation.original, mutation.field),
    })),
    Match.when("recycle", () => ({
      recycleSegmentReconciles:
        mutation.original.recordType === "recycle-mapping"
          ? mutation.field !== "contentObjectId" &&
            mutation.field !== "metadataObjectId" &&
            mutation.field !== "recordType"
          : expectedStructuralMutation(mutation.original, mutation.field) ||
            mutation.original.recordType === "family-run-start" ||
            mutation.original.recordType === "family-attempt-start",
    })),
    Match.when("legacy-word", () => ({
      legacySegmentReconciles:
        mutation.original.recordType === "legacy-word-exception"
          ? mutation.field !== "recordType" && mutation.field !== "approved"
          : mutation.original.recordType !== "legacy-word-pass" || mutation.field !== "recordType",
    })),
    Match.exhaustive
  );

const baseVariantVerdicts = (
  family: TransformationLedgerRecord["family"],
  kind: FixtureVariantKind
): EvidenceVerdicts => {
  const baseline = fixtureVerdictBaseline(family);
  return Match.value(kind).pipe(
    Match.when(isDisplacedStartVariant, () => ({
      ...baseline,
      familyRunStartReconciles: false,
      transformationAttemptLifecycleReconciles: false,
      transformationSegmentReconciles: false,
    })),
    Match.when("duplicate", () => ({
      ...baseline,
      passVerdicts: family === "mail" ? [false, false] : [],
      attachmentRepairsReconcile: family !== "mail",
      mailTerminalIdentitiesReconcile: family !== "mail",
      mailTerminalCountsReconcile: false,
      mailSegmentReconciles: false,
      recycleSegmentReconciles: false,
      legacySegmentReconciles: false,
      familyRunStartReconciles: false,
      attemptSettlementsReconcile: false,
      attemptRetryOrdinalsReconcile: false,
      resumableAttemptLifecycleReconciles: false,
      transformationAttemptLifecycleReconciles: false,
      transformationSegmentReconciles: false,
    })),
    Match.when("unsettled", () => ({
      ...baseline,
      passVerdicts: [],
      attachmentRepairsReconcile: family !== "mail",
      mailOwnedEvidenceReconciles: family !== "mail",
      mailTerminalCountsReconcile: false,
      mailSegmentReconciles: false,
      recycleSegmentReconciles: false,
      legacySegmentReconciles: false,
      attemptSettlementsReconcile: false,
      latestAttemptsAreTerminal: false,
      resumableAttemptLifecycleReconciles: false,
      transformationAttemptLifecycleReconciles: false,
      transformationSegmentReconciles: false,
    })),
    Match.when("empty", () => ({
      ...baseline,
      passVerdicts: [],
      mailTerminalCountsReconcile: false,
      mailSegmentReconciles: false,
      recycleSegmentReconciles: false,
      legacySegmentReconciles: false,
      familyRunStartReconciles: false,
      transformationAttemptLifecycleReconciles: false,
      transformationSegmentReconciles: false,
    })),
    Match.orElse(() => baseline)
  );
};

const expectedEvidenceVerdicts = (
  family: TransformationLedgerRecord["family"],
  kind: FixtureVariantKind,
  mutation: O.Option<FixtureMutation>,
  inputKind: FixtureInputKind = "class"
): EvidenceVerdicts =>
  O.match(mutation, {
    onNone: () => baseVariantVerdicts(family, kind),
    onSome: (event) => {
      const runStartSurvives = event.original.recordType !== "family-run-start" || !rejectsRunStartField(event.field);
      const historySurvives = rawHistorySurvivesMutation(event);
      return EvidenceVerdicts.make({
        ...fixtureVerdictBaseline(family),
        ...typedMutationVerdicts(event),
        ...mailTypedOutputVerdicts(event),
        ...familyOutputVerdicts(family, event),
        ...(inputKind === "clone" ? cloneMutationVerdicts(family, event) : {}),
        familyRunStartReconciles: runStartSurvives,
        resumableAttemptLifecycleReconciles: historySurvives,
        transformationAttemptLifecycleReconciles: runStartSurvives && historySurvives,
        transformationSegmentReconciles: expectedStructuralMutation(event.original, event.field),
      });
    },
  });

const mutatedEvidenceValue = (value: unknown): O.Option<unknown> => {
  if (typeof value === "string") return O.some(`${value}/mutated`);
  if (typeof value === "number") return O.some(value + 1);
  if (typeof value === "boolean") return O.some(!value);
  if (Array.isArray(value)) return O.some(A.append(value, value[0] ?? "mutated"));
  if (value === undefined) return O.some("mutated");
  return O.none();
};

const systematicEvidenceMutations = (
  records: ReadonlyArray<TransformationLedgerRecord>
): ReadonlyArray<ReadonlyArray<TransformationLedgerRecord>> =>
  A.flatMap(records, (record, recordIndex) =>
    A.flatMap(Object.entries(record), ([field, value]) =>
      O.match(mutatedEvidenceValue(value), {
        onNone: A.empty,
        onSome: (mutatedValue) => {
          const mutated = structuredClone(records) as unknown as Array<Record<string, unknown>>;
          const target = mutated[recordIndex];
          if (target !== undefined) target[field] = mutatedValue;
          return [mutated as unknown as ReadonlyArray<TransformationLedgerRecord>];
        },
      })
    )
  );

const exerciseEvidenceVariant = (
  summary: TransformationLedgerRecord,
  variant: ReadonlyArray<TransformationLedgerRecord>,
  expected: EvidenceVerdicts,
  label = "order-preserving"
): void => {
  if (!isTransformationLedgerRecordCasesFamilyRunSummary(summary)) return;
  const starts = A.filter(variant, isTransformationLedgerRecordCasesFamilyAttemptStart);
  const interruptions = A.filter(variant, isTransformationLedgerRecordCasesFamilyAttemptInterrupted);
  const passes = A.filter(variant, isTransformationLedgerRecordCasesMailStorePass);
  const exceptions = A.filter(variant, isTransformationLedgerRecordCasesMailStoreException);
  const warnings = A.filter(variant, isTransformationLedgerRecordCasesMailWarning);
  const children = A.filter(variant, isTransformationLedgerRecordCasesMailChildPass);
  const repairs = A.filter(variant, isTransformationLedgerRecordCasesAttachmentTypeRepair);
  const terminals = RT.attemptTerminalBindings(variant);

  const safeIds = [".", "..", "safe-attempt", "unsafe/attempt", "unsafe\\attempt"];
  const safeVerdicts = [false, false, true, false, false];
  A.forEach(safeIds, (id, index) => expect(RT.safeAttemptId(id)).toBe(safeVerdicts[index]));
  expect(passes.length, `${summary.family}:${label}:pass-invocations`).toBe(expected.passVerdicts.length);
  expect(exceptions.length).toBe(expected.exceptionVerdicts.length);
  A.forEach(passes, (pass, index) =>
    expect(RT.mailPassReconciles(pass, children, warnings), `${summary.family}:${label}:mailPassReconciles`).toBe(
      expected.passVerdicts[index]
    )
  );
  A.forEach(exceptions, (exception, index) =>
    expect(RT.mailExceptionIsApproved(exception), `${summary.family}:${label}:mailExceptionIsApproved`).toBe(
      expected.exceptionVerdicts[index]
    )
  );
  expect(
    RT.attachmentRepairsReconcile(repairs, children, terminals),
    `${summary.family}:${label}:attachmentRepairsReconcile`
  ).toBe(expected.attachmentRepairsReconcile);
  expect(
    RT.mailTerminalIdentitiesReconcile(A.appendAll(passes, exceptions)),
    `${summary.family}:${label}:mailTerminalIdentitiesReconcile`
  ).toBe(expected.mailTerminalIdentitiesReconcile);
  expect(
    RT.mailOwnedEvidenceReconciles(passes, exceptions, interruptions, children, warnings),
    `${summary.family}:${label}:mailOwnedEvidenceReconciles`
  ).toBe(expected.mailOwnedEvidenceReconciles);
  expect(
    RT.mailTerminalCountsReconcile(summary, passes, exceptions),
    `${summary.family}:${label}:mailTerminalCountsReconcile`
  ).toBe(expected.mailTerminalCountsReconcile);
  expect(RT.mailSegmentReconciles(summary, variant), `${summary.family}:${label}:mailSegmentReconciles`).toBe(
    expected.mailSegmentReconciles
  );
  expect(RT.recycleSegmentReconciles(summary, variant), `${summary.family}:${label}:recycleSegmentReconciles`).toBe(
    expected.recycleSegmentReconciles
  );
  expect(RT.legacySegmentReconciles(summary, variant), `${summary.family}:${label}:legacySegmentReconciles`).toBe(
    expected.legacySegmentReconciles
  );
  expect(RT.familyRunStartReconciles(summary, variant), `${summary.family}:${label}:familyRunStartReconciles`).toBe(
    expected.familyRunStartReconciles
  );
  expect(
    RT.attemptSettlementsReconcile(starts, interruptions, terminals),
    `${summary.family}:${label}:attemptSettlementsReconcile`
  ).toBe(expected.attemptSettlementsReconcile);
  expect(
    RT.attemptBindingsReconcile(starts, interruptions, terminals),
    `${summary.family}:${label}:attemptBindingsReconcile`
  ).toBe(expected.attemptBindingsReconcile);
  expect(RT.attemptRetryOrdinalsReconcile(starts), `${summary.family}:${label}:attemptRetryOrdinalsReconcile`).toBe(
    expected.attemptRetryOrdinalsReconcile
  );
  expect(RT.latestAttemptsAreTerminal(starts, terminals), `${summary.family}:${label}:latestAttemptsAreTerminal`).toBe(
    expected.latestAttemptsAreTerminal
  );
  expect(
    RT.resumableAttemptLifecycleReconciles(variant),
    `${summary.family}:${label}:resumableAttemptLifecycleReconciles`
  ).toBe(expected.resumableAttemptLifecycleReconciles);
  expect(
    RT.transformationAttemptLifecycleReconciles(summary, variant),
    `${summary.family}:${label}:transformationAttemptLifecycleReconciles`
  ).toBe(expected.transformationAttemptLifecycleReconciles);
  expect(
    RT.transformationSegmentReconciles(summary.family, summary, variant),
    `${summary.family}:${label}:transformationSegmentReconciles`
  ).toBe(expected.transformationSegmentReconciles);
  const lines = A.map(variant, (record) => JSON.stringify(record));
  const segmentText = A.join(A.dropRight(lines, 2), "\n");
  const referenceHash = bytesToHex(sha256(utf8ToBytes(Str.isEmpty(segmentText) ? "" : `${segmentText}\n`)));
  expect(RT.strictEvidenceSha256(lines)).toBe(referenceHash);
};

type FamilySummary = Extract<TransformationLedgerRecord, { readonly recordType: "family-run-summary" }>;

const assertMailFixtureContracts = (
  records: ReadonlyArray<TransformationLedgerRecord>,
  summary: FamilySummary
): void => {
  if (summary.family !== "mail") return;
  const pass = O.getOrThrow(A.findFirst(records, isTransformationLedgerRecordCasesMailStorePass));
  const approved = TransformationLedgerRecord.cases["mail-store-exception"].make({
    preservationRunId: pass.preservationRunId,
    preservationSealSha256: pass.preservationSealSha256,
    recordedAt: pass.recordedAt,
    runLabel: pass.runLabel,
    schemaVersion: pass.schemaVersion,
    transformationRunId: pass.transformationRunId,
    attemptId: pass.attemptId,
    family: "mail",
    mailScope: pass.mailScope,
    objectId: pass.objectId,
    approved: true,
    disposition: "process",
    exceptionKind: "unsupported-family",
    message: "independent approval contract fixture",
    recordType: "mail-store-exception",
    retainedOutputBytes: S.Natural.make(0),
    retainedOutputSha256: pass.sha256,
    sourceFamily: "pst",
  });
  const disapproved = TransformationLedgerRecord.cases["mail-store-exception"].make({ ...approved, approved: false });
  const absentDisposition = TransformationLedgerRecord.cases["mail-store-exception"].make(
    Struct.omit(approved, ["disposition"])
  );
  const approvalControls = [
    MailApprovalControl.make({ record: approved, expected: true }),
    MailApprovalControl.make({ record: disapproved, expected: false }),
    MailApprovalControl.make({ record: absentDisposition, expected: false }),
  ];
  A.forEach(approvalControls, (control) => expect(RT.mailExceptionIsApproved(control.record)).toBe(control.expected));
  const children = A.filter(records, isTransformationLedgerRecordCasesMailChildPass);
  expect(A.filter(children, (child) => child.engineReported).length).toBe(5);
  expect(
    A.filter(children, (child) => !child.engineReported && Str.endsWith(".pdf")(child.childRelativePath)).length
  ).toBe(1);
  expect(
    A.filter(children, (child) => !child.engineReported && Str.endsWith(".tika.txt")(child.childRelativePath)).length
  ).toBe(1);
};

const helperVariantVerdicts = (
  records: ReadonlyArray<TransformationLedgerRecord>,
  summary: FamilySummary
): ReadonlyArray<EvidenceVerdicts> => {
  const fieldExpected = A.flatMap(records, (record) =>
    A.flatMap(Object.entries(record), ([field, value]) =>
      O.match(mutatedEvidenceValue(value), {
        onNone: A.empty,
        onSome: () => [
          expectedEvidenceVerdicts(
            summary.family,
            "field",
            O.some(FixtureMutation.make({ original: record, field })),
            "clone"
          ),
        ],
      })
    )
  );
  const helperExpected = [
    expectedEvidenceVerdicts(summary.family, "original", O.none()),
    expectedEvidenceVerdicts(summary.family, "reverse", O.none()),
    expectedEvidenceVerdicts(summary.family, "drop-first", O.none()),
    expectedEvidenceVerdicts(summary.family, "drop-last", O.none()),
    expectedEvidenceVerdicts(summary.family, "duplicate", O.none()),
    expectedEvidenceVerdicts(summary.family, "empty", O.none()),
    ...fieldExpected,
  ];
  return helperExpected;
};

const assertDecodedMutations = (
  records: ReadonlyArray<TransformationLedgerRecord>,
  summary: FamilySummary,
  variants: ReadonlyArray<ReadonlyArray<TransformationLedgerRecord>>
): void => {
  // Restore classes through the unchanged production decoder, adding meaningful
  // typed mutations beside the original whole-ledger-clone exercise.
  let typedIndex = 6;
  A.forEach(records, (record) =>
    A.forEach(Object.entries(record), ([field, value]) =>
      O.match(mutatedEvidenceValue(value), {
        onNone: () => {},
        onSome: () => {
          const index = typedIndex;
          typedIndex += 1;
          const variant = variants[index]!;
          const decoded = A.map(variant, (row) => decodeUnknownLedgerRecordResult(row));
          const expectedDecode =
            !rejectsSchemaStringMutation(field) &&
            !(record.recordType === "family-acceptance-pass" && field === "unapprovedCount");
          expect(A.every(decoded, Result.isSuccess), `${summary.family}:${index}:${field}:decode`).toBe(expectedDecode);
          // Assert the original clone boundary, including the untouched rows.
          expect(A.every(variant, (row) => !isLedgerRecord(row))).toBe(true);
          if (expectedDecode) {
            const typed = A.map(decoded, Result.getOrThrow);
            expect(A.every(typed, isLedgerRecord)).toBe(true);
            const mutation = FixtureMutation.make({ original: record, field });
            exerciseEvidenceVariant(
              summary,
              typed,
              expectedEvidenceVerdicts(summary.family, "field", O.some(mutation)),
              `${index}:typed:${field}`
            );
          }
        },
      })
    )
  );
  expect(typedIndex).toBe(variants.length);
};

const exerciseEvidenceMutations = (records: ReadonlyArray<TransformationLedgerRecord>): void =>
  O.match(A.findFirst(records, isTransformationLedgerRecordCasesFamilyRunSummary), {
    onNone: () => assertTrue(false),
    onSome: (summary) => {
      // A completed family's declared evidence must reconcile. Missing/duplicated
      // run starts and nonzero unapproved evidence cannot certify completion.
      expect(RT.transformationSegmentReconciles(summary.family, summary, records)).toBe(true);
      expect(
        RT.transformationSegmentReconciles(
          summary.family,
          summary,
          A.map(records, (record) => structuredClone(record))
        )
      ).toBe(true);
      expect(RT.transformationSegmentReconciles(summary.family, summary, [])).toBe(false);
      expect(RT.transformationSegmentReconciles(summary.family, summary, A.drop(records, 1))).toBe(false);
      expect(RT.transformationSegmentReconciles(summary.family, summary, A.reverse(records))).toBe(false);
      expect(RT.transformationSegmentReconciles(summary.family, summary, A.appendAll(records, records))).toBe(false);
      expect(
        RT.transformationSegmentReconciles(summary.family, { ...summary, unapprovedCount: S.Natural.make(1) }, records)
      ).toBe(false);
      const variants: ReadonlyArray<ReadonlyArray<TransformationLedgerRecord>> = [
        records,
        A.reverse(records),
        A.drop(records, 1),
        A.dropRight(records, 1),
        A.appendAll(records, records),
        [],
        ...systematicEvidenceMutations(records),
      ];
      assertMailFixtureContracts(records, summary);
      const orderedVariant = [
        records[0]!,
        ...A.reverse(A.dropRight(A.drop(records, 1), 2)),
        ...A.takeRight(records, 2),
      ];
      expect(RT.transformationSegmentReconciles(summary.family, summary, orderedVariant)).toBe(true);
      const expectedVerdicts = [
        true,
        false,
        false,
        true,
        false,
        false,
        ...expectedSystematicStructuralVerdicts(records),
      ];
      expect(variants.length).toBe(expectedVerdicts.length);
      A.forEach(variants, (variant, index) =>
        expect(RT.transformationSegmentReconciles(summary.family, summary, variant)).toBe(expectedVerdicts[index])
      );
      A.forEach(records, (record) => expect(isValidFixtureRecordType(record.recordType)).toBe(true));
      const helperExpected = helperVariantVerdicts(records, summary);
      expect(helperExpected.length).toBe(variants.length);
      A.forEach(variants, (variant, index) =>
        exerciseEvidenceVariant(summary, variant, helperExpected[index]!, `${index}`)
      );
      exerciseEvidenceVariant(
        summary,
        orderedVariant,
        expectedEvidenceVerdicts(summary.family, "inner-reverse", O.none())
      );
      const unsettled = A.filter(records, (row) => !isTerminalFixtureRecord(row.recordType));
      exerciseEvidenceVariant(
        summary,
        unsettled,
        expectedEvidenceVerdicts(summary.family, "unsettled", O.none()),
        "unsettled-valid-classes"
      );
      assertDecodedMutations(records, summary, variants);
    },
  });

it.layer(testLayer, { timeout: "30 seconds" })("corpus restoration evidence invariants", (it) => {
  it.effect(
    "exercises preservation identity, path, and resumable-state boundaries",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-restoration-invariant-test-" });
      const filePath = path.join(root, "source.bin");
      yield* fs.writeFileString(filePath, "fixture");
      const info = yield* fs.stat(filePath);
      const identity = RA.sourceIdentity(info);
      const noMtimeIdentity = RA.sourceIdentity({ ...info, mtime: O.none() });

      expect(RA.nonNegative(-1)).toBe(0);
      expect(RA.nonNegative(1.9)).toBe(1);
      expect(RA.sourceStat({ ...info, mtime: O.none() }).mtimeMillis).toBe(0);
      expect(RA.sameSourceIdentity(identity, identity)).toBe(true);
      expect(RA.sameSourceIdentity(identity, noMtimeIdentity)).toBe(false);
      expect(RA.sameSourceIdentityExceptMtime(identity, noMtimeIdentity)).toBe(true);
      strictEqual(RA.sameDeviceAndInode(identity, identity), O.isSome(identity.inode));
      expect(RA.sameDeviceAndInode({ ...identity, inode: O.none() }, identity)).toBe(false);
      expect(RA.sourceIdentityToken(identity)).toContain("\u0000");
      expect(RA.objectIdFor("source", "relative/path")).toHaveLength(64);

      expect(RA.isContainedPath(path, root, root)).toBe(true);
      expect(RA.isContainedPath(path, root, filePath)).toBe(true);
      expect(RA.isContainedPath(path, root, path.dirname(root))).toBe(false);
      expect(RA.pathsOverlap(path, root, filePath)).toBe(true);
      expect(RA.pathsOverlap(path, filePath, path.join(path.dirname(root), "other"))).toBe(false);
      expect(RA.filesystemRootFor(path, filePath)).toBe(path.parse(filePath).root);
      RA.parseProcStatStartTime("malformed").pipe(assertNone);
      expect(
        RA.parseProcStatStartTime(`1 (fixture) S ${A.join(A.map(A.range(0, 19), String), " ")}`).pipe(
          O.getOrElse(() => "")
        )
      ).toBe("18");
      assertSome(RA.collectorRelativePath("C:\\root\\nested\\file.bin", 2), "nested/file.bin");
      assertNone(RA.collectorRelativePath("C:\\root\\..\\file.bin", 2));
      assertNone(RA.collectorRelativePath("C:\\root", 2));
      expect(RA.partialArchiveOpenFlag({ expectedInfo: O.none(), resumeBytes: 0 })).toBe("wx+");
      expect(RA.partialArchiveOpenFlag({ expectedInfo: O.some(identity), resumeBytes: 0 })).toBe("r+");
      expect(RA.partialArchiveOpenFlag({ expectedInfo: O.some(identity), resumeBytes: 1 })).toBe("a");
    })
  );

  it.effect(
    "fails closed across systematic mutations of real family evidence",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      yield* restoreMail(mailRestorationOptions(fixture, "full"));
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "full.jsonl"
      );
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const mailRecords = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
      const recycleFixture = yield* makeRecycleRestorationFixture();
      yield* restoreRecycle(
        RestorationRecycleOptions.make({
          corpusRoot: recycleFixture.corpusRoot,
          expectedMissingContentCount: S.Natural.make(1),
          expectedSurfaceCount: S.Natural.make(3),
          maxTotalElapsedMillis: PosInt.make(30_000),
          maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
          runLabel: "synthetic-recycle-restoration",
        })
      );
      const recycleLines = A.filter(
        Str.split(/\r?\n/u)(
          yield* fs.readFileString(
            path.join(
              recycleFixture.corpusRoot,
              "staging/restoration/runs/synthetic-recycle-restoration/ledgers/recycle/full.jsonl"
            )
          )
        ),
        Str.isNonEmpty
      );
      const recycleRecords = yield* Effect.forEach(recycleLines, decodeTransformationLedgerRecordJson);
      const legacyFixture = yield* makeLegacyWordRestorationFixture();
      yield* restoreLegacyWord(legacyWordRestorationOptions(legacyFixture));
      const legacyLines = A.filter(
        Str.split(/\r?\n/u)(
          yield* fs.readFileString(
            path.join(
              legacyFixture.corpusRoot,
              "staging/restoration/runs/synthetic-legacy-word-restoration/ledgers/legacy-word/full.jsonl"
            )
          )
        ),
        Str.isNonEmpty
      );
      const legacyRecords = yield* Effect.forEach(legacyLines, decodeTransformationLedgerRecordJson);

      A.forEach([mailRecords, recycleRecords, legacyRecords], exerciseEvidenceMutations);
    }),
    { concurrent: false }
  );
});

const filetime2020 = 132_223_104_000_000_000n;

const setUint64 = (view: DataView, offset: number, value: bigint): void => {
  view.setBigUint64(offset, value, true);
};

const writeUtf16 = (view: DataView, offset: number, text: string): void => {
  Array.from(text).forEach((char, index) => {
    view.setUint16(offset + index * 2, char.charCodeAt(0), true);
  });
};

const makeMetadataV2 = (originalPath: string, sizeBytes: bigint, filetime: bigint): Uint8Array => {
  const bytes = new Uint8Array(28 + (originalPath.length + 1) * 2);
  const view = new DataView(bytes.buffer);
  setUint64(view, 0, 2n);
  setUint64(view, 8, sizeBytes);
  setUint64(view, 16, filetime);
  view.setUint32(24, originalPath.length + 1, true);
  writeUtf16(view, 28, originalPath);
  return bytes;
};

const makeMetadataV1 = (originalPath: string, sizeBytes: bigint, filetime: bigint): Uint8Array => {
  const bytes = new Uint8Array(24 + 520);
  const view = new DataView(bytes.buffer);
  setUint64(view, 0, 1n);
  setUint64(view, 8, sizeBytes);
  setUint64(view, 16, filetime);
  writeUtf16(view, 24, originalPath);
  return bytes;
};

it.layer(testLayer, { timeout: "30 seconds" })("Corpus recycle-bin parsing", (it) => {
  it.effect(
    "parses a v2 $I metadata record",
    Effect.fnUntraced(function* () {
      const original = yield* parseRecycleBinMetadata(
        makeMetadataV2("H:\\Clients\\Acme\\Spec (final).docx", 54_805n, filetime2020)
      );

      expect(original.version).toBe("v2");
      expect(original.originalPath).toBe("H:\\Clients\\Acme\\Spec (final).docx");
      expect(original.originalName).toBe("Spec (final).docx");
      expect(original.originalSizeBytes).toBe(54_805);
      expect(original.deletedAtIso).toBe("2020-01-01T00:00:00.000Z");
      expect(original.deletedAtFiletime).toBe(filetime2020.toString());
    })
  );

  it.effect(
    "parses a v1 $I metadata record with a fixed-width path",
    Effect.fnUntraced(function* () {
      const original = yield* parseRecycleBinMetadata(makeMetadataV1("C:\\old\\draft.doc", 11n, filetime2020));

      expect(original.version).toBe("v1");
      expect(original.originalPath).toBe("C:\\old\\draft.doc");
      expect(original.originalName).toBe("draft.doc");
    })
  );

  it.effect(
    "rejects records that are too short or have unknown versions",
    Effect.fnUntraced(function* () {
      const shortResult = yield* parseRecycleBinMetadata(new Uint8Array(8)).pipe(Effect.flip);
      expect(shortResult.message).toContain("header bytes");

      const badVersion = makeMetadataV2("C:\\x.txt", 1n, filetime2020);
      new DataView(badVersion.buffer).setBigUint64(0, 9n, true);
      const versionResult = yield* parseRecycleBinMetadata(badVersion).pipe(Effect.flip);
      expect(versionResult.message).toContain("unsupported format version");
    })
  );

  it("classifies $I and $R names and ignores everything else", () => {
    assertSome(
      O.map(classifyRecycleBinName("$I0CB4M9.docx"), (entry) => `${entry.kind}:${entry.pairKey}`),
      "metadata:0CB4M9.docx"
    );
    assertSome(
      O.map(classifyRecycleBinName("$R0CB4M9.docx"), (entry) => `${entry.kind}:${entry.pairKey}`),
      "content:0CB4M9.docx"
    );
    classifyRecycleBinName("README.md").pipe(assertNone);
    classifyRecycleBinName("$Xnope.txt").pipe(assertNone);
    classifyRecycleBinName("$Recycle.Bin").pipe(assertNone);
  });

  it("pairs metadata with content and reports leftovers", () => {
    const pairing = pairRecycleBinEntries([
      RecycleBinScanEntry.make({ kind: "metadata", pairKey: "A1.docx", relativePath: "$IA1.docx" }),
      RecycleBinScanEntry.make({ kind: "content", pairKey: "A1.docx", relativePath: "$RA1.docx" }),
      RecycleBinScanEntry.make({ kind: "metadata", pairKey: "B2.pdf", relativePath: "$IB2.pdf" }),
      RecycleBinScanEntry.make({ kind: "content", pairKey: "C3.txt", relativePath: "$RC3.txt" }),
    ]);

    expect(pairing.matched.map((pair) => pair.pairKey)).toStrictEqual(["A1.docx"]);
    expect(pairing.unmatchedMetadata.map((entry) => entry.relativePath)).toStrictEqual(["$IB2.pdf"]);
    expect(pairing.unmatchedContent.map((entry) => entry.relativePath)).toStrictEqual(["$RC3.txt"]);
  });
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus catalog", (it) => {
  it.effect(
    "builds the catalog, duplicate report, and restoration manifest from a synthetic corpus",
    Effect.fnUntraced(function* () {
      const digestA = "a".repeat(64);
      const digestB = "b".repeat(64);
      const digestMeta = "c".repeat(64);
      const digestContent = "d".repeat(64);
      const digestLoose = "e".repeat(64);

      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-test-" });
      const rawDir = path.join(corpusRoot, "raw");
      const sourceADir = path.join(rawDir, "source-a");
      yield* fs.makeDirectory(sourceADir, { recursive: true });

      const metadataDest = path.join(sourceADir, "$IAB12CD.docx");
      yield* fs.writeFile(metadataDest, makeMetadataV2("H:\\Clients\\Acme\\Spec v3.docx", 1_024n, filetime2020));

      const record = (
        sourceLabel: string,
        relativePath: string,
        sha256: string,
        sizeBytes: number,
        destPath: string
      ): string =>
        JSON.stringify({
          destPath,
          mtimeEpoch: 1_700_000_000,
          mtimeIso: "2023-11-14T22:13:20Z",
          originPath: `/origin/${sourceLabel}/${relativePath}`,
          relativePath,
          salvagedAt: "2026-06-11T15:00:00Z",
          sha256,
          sizeBytes,
          sourceLabel,
        });

      const manifestLines = [
        record("source-a", "docs/a.txt", digestA, 100, path.join(sourceADir, "docs/a.txt")),
        record("source-a", "docs/b.txt", digestB, 200, path.join(sourceADir, "docs/b.txt")),
        record("source-b", "copy/a.txt", digestA, 100, path.join(rawDir, "source-b/copy/a.txt")),
        record("source-a", "$IAB12CD.docx", digestMeta, 146, metadataDest),
        record("source-a", "$RAB12CD.docx", digestContent, 1_024, path.join(sourceADir, "$RAB12CD.docx")),
        record("source-a", "$RZZ99XX.pdf", digestLoose, 5_000, path.join(sourceADir, "$RZZ99XX.pdf")),
      ];
      yield* fs.writeFileString(path.join(rawDir, "provenance.jsonl"), `${manifestLines.join("\n")}\n`);

      const summary = yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));

      const restorationText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "restoration-manifest.jsonl"));
      const duplicateText = yield* fs.readFileString(
        path.join(corpusRoot, "catalog", "reports", "duplicate-sets.json")
      );
      const summaryText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "reports", "catalog-summary.json"));
      const databaseExists = yield* fs.exists(path.join(corpusRoot, "catalog", "corpus.duckdb"));

      expect(summary.sourceFiles).toBe(6);
      expect(summary.totalBytes).toBe(100 + 200 + 100 + 146 + 1_024 + 5_000);
      expect(summary.distinctDigests).toBe(5);
      expect(summary.duplicateSets).toBe(1);
      expect(summary.duplicateFiles).toBe(1);
      expect(summary.redundantBytes).toBe(100);
      expect(summary.matchedRestorations).toBe(1);
      expect(summary.unmatchedMetadataFiles).toBe(0);
      expect(summary.unmatchedContentFiles).toBe(1);

      expect(databaseExists).toBe(true);
      expect(duplicateText).toContain(`sha256:${digestA}`);
      expect(duplicateText).toContain("source-a/docs/a.txt | source-b/copy/a.txt");
      expect(summaryText).toContain('"sourceFiles":6');

      const restorationLines = restorationText.trim().split("\n");
      expect(restorationLines).toHaveLength(2);
      expect(restorationText).toContain("Spec v3.docx");
      expect(restorationText).toContain("unmatched-content");
    })
  );
});

const stubPffexport = `#!/usr/bin/env bash
target=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "-t" ]; then target="$arg"; fi
  prev="$arg"
done
source="\${@: -1}"
[ -f "$source" ] || exit 2
mkdir -p "$target.export/Top of Personal Folders/Inbox/Message00001/Attachments"
printf 'hello body' > "$target.export/Top of Personal Folders/Inbox/Message00001/Message.txt"
printf 'pdfbytes' > "$target.export/Top of Personal Folders/Inbox/Message00001/Attachments/report.pdf"
exit 0
`;

const stubJava = `#!/usr/bin/env bash
printf '%s' '[{"Content-Type":"text/plain","X-TIKA:content":"\\n  stub text body\\n"}]'
exit 0
`;

// Engine stubs for the resume tests: each invocation appends one line to a call
// log, so a test can prove which sources a run actually sent to an engine. The
// java stub fails any source whose bytes carry the `extract-must-fail` marker.
const countingPffexportStub = (callLog: string): string =>
  Str.replace("#!/usr/bin/env bash\n", `#!/usr/bin/env bash\nprintf 'pffexport\\n' >> "${callLog}"\n`)(stubPffexport);

const countingJavaStub = (callLog: string): string => `#!/usr/bin/env bash
printf 'java\\n' >> "${callLog}"
for arg in "$@"; do
  if [ -f "$arg" ] && grep -q "extract-must-fail" "$arg"; then exit 3; fi
done
printf '%s' '[{"Content-Type":"text/plain","X-TIKA:content":"\\n  stub text body\\n"}]'
exit 0
`;

const writeStub = Effect.fn("CorpusTest.writeStub")(function* (script: string, stubPath: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(stubPath, script);
  yield* fs.chmod(stubPath, 0o755);
});

const alphaDigest = "8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8";

const sourceSpec = (sourceLabel: string, sourcePath: string): CorpusSalvageSourceSpec =>
  CorpusSalvageSourceSpec.make({ sourceLabel, sourcePath });

const provenanceRecord = (input: {
  readonly copyMode?: "copied" | "provenance-only";
  readonly dedupeOfPath?: string;
  readonly destPath: string;
  readonly originPath: string;
  readonly relativePath: string;
  readonly sha256: string;
  readonly sizeBytes: number;
  readonly sourceLabel: string;
}): CorpusProvenanceRecord =>
  CorpusProvenanceRecord.make({
    destPath: input.destPath,
    mtimeEpoch: 1_700_000_000,
    mtimeIso: "2023-11-14T22:13:20Z",
    originPath: input.originPath,
    relativePath: input.relativePath,
    salvagedAt: "2026-06-11T15:00:00Z",
    sha256: Sha256Hex.make(input.sha256),
    sizeBytes: S.Natural.make(input.sizeBytes),
    sourceLabel: input.sourceLabel,
    ...(input.copyMode === undefined ? {} : { copyMode: input.copyMode }),
    ...(input.dedupeOfPath === undefined ? {} : { dedupeOfPath: input.dedupeOfPath }),
  });

const encodeProvenanceLine = Effect.fn("CorpusTest.encodeProvenanceLine")(function* (record: CorpusProvenanceRecord) {
  return yield* encodeCorpusProvenanceRecordJson(record);
});

const readProvenanceLines = Effect.fn("CorpusTest.readProvenanceLines")(function* (manifestPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(manifestPath);
  return A.filter(Str.split(text, "\n"), Str.isNonEmpty);
});

const contentDigest = (content: string): string => bytesToHex(sha256(utf8ToBytes(content)));

const summaryCountKeys = [
  "alreadyCompleteCount",
  "extractedCount",
  "failedCount",
  "skippedCount",
  "sourceCount",
  "succeededCount",
] as const;

// Synthetic corpus for the extract resume tests: every source is a small file
// under raw/source-a whose manifest digest is the real digest of its content.
// A source with `present: false` is listed in the manifest but missing on
// disk, which aborts a run at that source the way a killed process would.
const makeExtractResumeFixture = Effect.fn("CorpusTest.makeExtractResumeFixture")(function* (
  sources: ReadonlyArray<{ readonly content: string; readonly name: string; readonly present?: boolean }>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-extract-resume-test-" });
  const rawDir = path.join(corpusRoot, "raw", "source-a");
  const outDir = path.join(corpusRoot, "staging", "extract");
  const callLog = path.join(corpusRoot, "engine-calls.log");
  const pffexportPath = path.join(corpusRoot, "pffexport-stub");
  const javaPath = path.join(corpusRoot, "java-stub");
  const manifestPath = path.join(corpusRoot, "raw", "provenance.jsonl");
  yield* fs.makeDirectory(rawDir, { recursive: true });
  yield* writeStub(countingPffexportStub(callLog), pffexportPath);
  yield* writeStub(countingJavaStub(callLog), javaPath);

  yield* Effect.forEach(
    A.filter(sources, (source) => source.present !== false),
    (source) => fs.writeFileString(path.join(rawDir, source.name), source.content),
    { discard: true }
  );
  const manifestLines = yield* Effect.forEach(sources, (source) =>
    encodeProvenanceLine(
      provenanceRecord({
        destPath: path.join(rawDir, source.name),
        originPath: `/origin/source-a/${source.name}`,
        relativePath: source.name,
        sha256: contentDigest(source.content),
        sizeBytes: utf8ToBytes(source.content).byteLength,
        sourceLabel: "source-a",
      })
    )
  );
  yield* fs.writeFileString(manifestPath, `${A.join(manifestLines, "\n")}\n`);

  const engineCalls = Effect.fn("CorpusTest.engineCalls")(function* (engine: "java" | "pffexport") {
    const text = yield* fs.readFileString(callLog).pipe(Effect.orElseSucceed(() => ""));
    return A.length(A.filter(Str.split(text, "\n"), (line) => line === engine));
  });

  return {
    engineCalls,
    markerPath: (content: string) => path.join(outDir, "outcomes", `${contentDigest(content)}.json`),
    outDir,
    rawDir,
    run: (overrides: { readonly exportChildren?: boolean; readonly overwrite?: boolean } = {}) =>
      extractCorpus(
        CorpusExtractOptions.make({
          concurrency: 1,
          corpusRoot,
          exportChildren: overrides.exportChildren ?? true,
          includeDuplicates: false,
          javaPath,
          overwrite: overrides.overwrite ?? false,
          pffexportPath,
          tikaJarPath: manifestPath,
        })
      ),
  };
});

const readProvenanceRecords = Effect.fn("CorpusTest.readProvenanceRecords")(function* (manifestPath: string) {
  const lines = yield* readProvenanceLines(manifestPath);
  return yield* Effect.forEach(lines, (line) => decodeCorpusProvenanceRecordJson(line));
});

const decodeArchiveMoveManifestRecordJson = S.decodeUnknownEffect(S.fromJsonString(CorpusArchiveMoveManifestRecord));

const readArchiveMoveManifestRecords = Effect.fn("CorpusTest.readArchiveMoveManifestRecords")(function* (
  manifestPath: string
) {
  const lines = yield* readProvenanceLines(manifestPath);
  return yield* Effect.forEach(lines, (line) => decodeArchiveMoveManifestRecordJson(line));
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus catalog run manifests", (it) => {
  it.effect(
    "unions base and run-labeled manifests with provenance-only occurrences and per-run digest deltas",
    Effect.fnUntraced(function* () {
      const digestB = "b".repeat(64);
      const digestC = "c".repeat(64);
      const digestD = "d".repeat(64);
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-runs-test-" });
      const rawRoot = path.join(corpusRoot, "raw");
      const baseSourceDir = path.join(rawRoot, "source-a");
      const runLabel = "2026-07-refresh";
      const runSourceDir = path.join(rawRoot, runLabel, "source-c");
      yield* fs.makeDirectory(baseSourceDir, { recursive: true });
      yield* fs.makeDirectory(runSourceDir, { recursive: true });

      const baseAlphaPath = path.join(baseSourceDir, "alpha.txt");
      const baseBravoPath = path.join(baseSourceDir, "bravo.txt");
      const runCharliePath = path.join(runSourceDir, "charlie.txt");
      const runDeltaOnePath = path.join(runSourceDir, "delta-one.txt");
      const runDeltaTwoPath = path.join(runSourceDir, "delta-two.txt");
      yield* fs.writeFileString(baseAlphaPath, "alpha");
      yield* fs.writeFileString(baseBravoPath, "bravo");
      yield* fs.writeFileString(runCharliePath, "charlie");
      yield* fs.writeFileString(runDeltaOnePath, "delta");
      yield* fs.writeFileString(runDeltaTwoPath, "delta");

      const baseLines = yield* Effect.forEach(
        [
          provenanceRecord({
            copyMode: "copied",
            destPath: baseAlphaPath,
            originPath: path.join(corpusRoot, "origin", "base-alpha.txt"),
            relativePath: "alpha.txt",
            sha256: alphaDigest,
            sizeBytes: 5,
            sourceLabel: "source-a",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: baseBravoPath,
            originPath: path.join(corpusRoot, "origin", "base-bravo.txt"),
            relativePath: "bravo.txt",
            sha256: digestB,
            sizeBytes: 5,
            sourceLabel: "source-a",
          }),
        ],
        encodeProvenanceLine
      );
      const runLines = yield* Effect.forEach(
        [
          provenanceRecord({
            copyMode: "provenance-only",
            dedupeOfPath: baseAlphaPath,
            destPath: path.join(runSourceDir, "cross-run-alpha.txt"),
            originPath: path.join(corpusRoot, "origin", "refresh-alpha.txt"),
            relativePath: "cross-run-alpha.txt",
            sha256: alphaDigest,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runCharliePath,
            originPath: path.join(corpusRoot, "origin", "refresh-charlie.txt"),
            relativePath: "charlie.txt",
            sha256: digestC,
            sizeBytes: 7,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runDeltaOnePath,
            originPath: path.join(corpusRoot, "origin", "refresh-delta-one.txt"),
            relativePath: "delta-one.txt",
            sha256: digestD,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
          provenanceRecord({
            copyMode: "copied",
            destPath: runDeltaTwoPath,
            originPath: path.join(corpusRoot, "origin", "refresh-delta-two.txt"),
            relativePath: "delta-two.txt",
            sha256: digestD,
            sizeBytes: 5,
            sourceLabel: "source-c",
          }),
        ],
        encodeProvenanceLine
      );
      yield* fs.writeFileString(path.join(rawRoot, "provenance.jsonl"), `${A.join(baseLines, "\n")}\n`);
      yield* fs.writeFileString(path.join(rawRoot, runLabel, "provenance.jsonl"), `${A.join(runLines, "\n")}\n`);

      const summary = yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));
      const duplicateText = yield* fs.readFileString(
        path.join(corpusRoot, "catalog", "reports", "duplicate-sets.json")
      );
      const summaryText = yield* fs.readFileString(path.join(corpusRoot, "catalog", "reports", "catalog-summary.json"));
      const refreshRun = yield* Effect.fromOption(A.findFirst(summary.runs, (run) => run.runLabel === runLabel));

      expect(summary.sourceFiles).toBe(6);
      expect(summary.distinctDigests).toBe(4);
      expect(summary.duplicateSets).toBe(2);
      expect(refreshRun.recordCount).toBe(4);
      expect(refreshRun.distinctDigests).toBe(3);
      expect(refreshRun.newDistinctDigests).toBe(2);
      expect(duplicateText).toContain('"duplicateScope":"cross-run"');
      expect(duplicateText).toContain(`${runLabel}:source-c/cross-run-alpha.txt`);
      expect(duplicateText).toContain('"duplicateScope":"intra-run"');
      expect(summaryText).toContain(`"runLabel":"${runLabel}"`);
      expect(summaryText).toContain('"newDistinctDigests":2');
    })
  );
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus extract and salvage", (it) => {
  it.effect(
    "rejects traversal out labels before writing staging output",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-extract-label-test-" });

      const error = yield* extractCorpus(
        CorpusExtractOptions.make({
          concurrency: 1,
          corpusRoot,
          exportChildren: false,
          includeDuplicates: false,
          outLabel: "../outside",
          overwrite: false,
          tikaJarPath: path.join(corpusRoot, "missing-tika.jar"),
        })
      ).pipe(Effect.flip);
      const escapedExists = yield* fs.exists(path.join(corpusRoot, "outside"));

      expect(error.message).toContain("Invalid corpus extract out-label");
      expect(escapedExists).toBe(false);
    })
  );

  it.effect(
    "extracts a synthetic corpus through stub engines and verifies salvage",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const corpusRoot = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-extract-test-" });
      const rawDir = path.join(corpusRoot, "raw", "source-a");
      yield* fs.makeDirectory(rawDir, { recursive: true });

      const pffexportStubPath = path.join(corpusRoot, "pffexport-stub");
      const javaStubPath = path.join(corpusRoot, "java-stub");
      yield* writeStub(stubPffexport, pffexportStubPath);
      yield* writeStub(stubJava, javaStubPath);

      const pstPath = path.join(rawDir, "mailbox.pst");
      const txtPath = path.join(rawDir, "note.txt");
      yield* fs.writeFileString(pstPath, "not a real pst");
      yield* fs.writeFileString(txtPath, "stub text body");

      const record = (relativePath: string, hash: string, sizeBytes: number, destPath: string): string =>
        JSON.stringify({
          destPath,
          mtimeEpoch: 1_700_000_000,
          mtimeIso: "2023-11-14T22:13:20Z",
          originPath: `/origin/source-a/${relativePath}`,
          relativePath,
          salvagedAt: "2026-06-11T15:00:00Z",
          sha256: hash,
          sizeBytes,
          sourceLabel: "source-a",
        });

      // Real digests so salvage verification passes: sha256("not a real pst") / sha256("stub text body")
      const pstDigest = "166df44db090f14dbb3ec7730fc17e78c170477163a6c913e5485d075c4b92d0";
      const txtDigest = "ed17e4908506d9bfe380ef2aa2b226c484600dc77ada8ee21a6b3380242228c1";

      const manifestLines = [
        record("mailbox.pst", pstDigest, 14, pstPath),
        record("note.txt", txtDigest, 14, txtPath),
        record("copy/note-copy.txt", txtDigest, 14, txtPath),
      ];
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "provenance.jsonl"), `${manifestLines.join("\n")}\n`);

      const summary = yield* extractCorpus(
        CorpusExtractOptions.make({
          concurrency: 2,
          corpusRoot,
          exportChildren: true,
          includeDuplicates: false,
          javaPath: javaStubPath,
          overwrite: false,
          pffexportPath: pffexportStubPath,
          tikaJarPath: path.join(corpusRoot, "raw", "provenance.jsonl"),
        })
      );

      const outDir = path.join(corpusRoot, "staging", "extract");
      const sourcesText = yield* fs.readFileString(path.join(outDir, "sources.jsonl"));
      const runExists = yield* fs.exists(path.join(outDir, "run.json"));
      const pstArtifactId = `artifact:${pstDigest}`;
      const childrenText = yield* fs.readFileString(path.join(outDir, "children", pstArtifactId, "artifacts.jsonl"));

      const salvage = yield* verifySalvage(CorpusSalvageOptions.make({ corpusRoot }));

      expect(summary.sourceCount).toBe(2);
      expect(summary.duplicatesSkipped).toBe(1);
      expect(summary.succeededCount).toBe(2);
      expect(summary.failedCount).toBe(0);
      expect(summary.childArtifactCount).toBe(2);
      expect(summary.textArtifactCount).toBe(1);
      expect(runExists).toBe(true);
      expect(sourcesText).toContain('"status":"succeeded"');
      expect(childrenText).toContain("Attachments/report.pdf");
      expect(salvage.matched).toBe(3);
      expect(salvage.mismatched).toBe(0);
      expect(salvage.missing).toBe(0);
    })
  );

  it.effect(
    "resumes an interrupted run and extracts only the remaining sources",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeExtractResumeFixture([
        { content: "alpha body", name: "alpha.txt" },
        { content: "beta body", name: "beta.txt" },
        { content: "gamma body", name: "gamma.txt", present: false },
        { content: "delta body", name: "delta.txt" },
      ]);

      // The third source is unreadable, so the run dies after two sources.
      const interrupted = yield* fixture.run().pipe(Effect.flip);
      const callsAfterInterrupt = yield* fixture.engineCalls("java");
      const markersAfterInterrupt = yield* fs.readDirectory(path.join(fixture.outDir, "outcomes"));
      const summaryAfterInterrupt = yield* fs.exists(path.join(fixture.outDir, "extract-summary.json"));

      yield* fs.writeFileString(path.join(fixture.rawDir, "gamma.txt"), "gamma body");
      const resumed = yield* fixture.run();
      const callsAfterResume = yield* fixture.engineCalls("java");
      const sourceLines = yield* readProvenanceLines(path.join(fixture.outDir, "sources.jsonl"));
      const stagingEntries = yield* fs.readDirectory(path.join(fixture.outDir, ".staging"));

      const settled = yield* fixture.run();
      const callsAfterSettled = yield* fixture.engineCalls("java");

      expect(interrupted.message).toContain("gamma.txt");
      expect(callsAfterInterrupt).toBe(2);
      expect(A.sort(markersAfterInterrupt, Order.String)).toEqual(
        A.sort([`${contentDigest("alpha body")}.json`, `${contentDigest("beta body")}.json`], Order.String)
      );
      expect(summaryAfterInterrupt).toBe(false);

      expect(resumed.sourceCount).toBe(4);
      expect(resumed.alreadyCompleteCount).toBe(2);
      expect(resumed.extractedCount).toBe(2);
      expect(resumed.failedCount).toBe(0);
      expect(resumed.succeededCount).toBe(4);
      expect(resumed.textArtifactCount).toBe(4);
      expect(callsAfterResume).toBe(4);
      expect(A.length(sourceLines)).toBe(4);
      expect(stagingEntries).toEqual([]);

      expect(settled.alreadyCompleteCount).toBe(4);
      expect(settled.extractedCount).toBe(0);
      expect(settled.succeededCount).toBe(4);
      expect(callsAfterSettled).toBe(4);
    })
  );

  it.effect(
    "redoes sources whose marker or artifacts are partial and never trusts them",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeExtractResumeFixture([
        { content: "alpha body", name: "alpha.txt" },
        { content: "beta body", name: "beta.txt" },
        { content: "gamma body", name: "gamma.txt" },
        { content: "delta body", name: "delta.txt" },
        { content: "not a real pst", name: "mailbox.pst" },
      ]);
      const first = yield* fixture.run();
      // The driver may invoke the binary more than once per export, so the
      // redo is asserted as one more export's worth of calls.
      const pffexportCallsPerExport = yield* fixture.engineCalls("pffexport");
      const textDir = path.join(fixture.outDir, "text");
      const textFiles = yield* fs.readDirectory(textDir);
      const alphaMarker = yield* fs.readFileString(fixture.markerPath("alpha body"));
      const betaMarker = yield* fs.readFileString(fixture.markerPath("beta body"));
      const alphaTextName = yield* Effect.fromOption(
        A.findFirst(textFiles, (name) => pipe(alphaMarker, Str.includes(name)))
      );
      const pstArtifactId = `artifact:${contentDigest("not a real pst")}`;
      const claimPath = path.join(fixture.outDir, "children", `${pstArtifactId}.claim`);

      // alpha: marker intact, text artifact gone. beta: marker cut mid-record,
      // as a non-atomic write would leave it. gamma: text present, no marker.
      // mailbox: no marker, plus the export tree and claim of a killed export.
      yield* fs.remove(path.join(textDir, alphaTextName));
      yield* fs.writeFileString(fixture.markerPath("beta body"), Str.slice(0, 40)(betaMarker));
      yield* fs.remove(fixture.markerPath("gamma body"));
      yield* fs.remove(fixture.markerPath("not a real pst"));
      yield* fs.makeDirectory(claimPath);

      const resumed = yield* fixture.run();
      const alphaTextRestored = yield* fs.exists(path.join(textDir, alphaTextName));
      const betaMarkerAfter = yield* fs.readFileString(fixture.markerPath("beta body"));
      const claimLeft = yield* fs.exists(claimPath);
      const childrenText = yield* fs.readFileString(
        path.join(fixture.outDir, "children", pstArtifactId, "artifacts.jsonl")
      );
      const javaCalls = yield* fixture.engineCalls("java");
      const pffexportCalls = yield* fixture.engineCalls("pffexport");

      expect(first.alreadyCompleteCount).toBe(0);
      expect(first.extractedCount).toBe(5);
      expect(first.succeededCount).toBe(5);

      expect(resumed.sourceCount).toBe(5);
      expect(resumed.alreadyCompleteCount).toBe(1);
      expect(resumed.extractedCount).toBe(4);
      expect(resumed.failedCount).toBe(0);
      expect(resumed.succeededCount).toBe(5);
      expect(resumed.childArtifactCount).toBe(first.childArtifactCount);
      expect(javaCalls).toBe(7);
      expect(pffexportCallsPerExport).toBeGreaterThan(0);
      expect(pffexportCalls).toBe(2 * pffexportCallsPerExport);
      expect(alphaTextRestored).toBe(true);
      expect(betaMarkerAfter).toBe(betaMarker);
      expect(claimLeft).toBe(false);
      expect(childrenText).toContain("Attachments/report.pdf");
    })
  );

  it.effect(
    "redoes every source when overwrite is set or the export choice changes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeExtractResumeFixture([
        { content: "alpha body", name: "alpha.txt" },
        { content: "beta body", name: "beta.txt" },
        { content: "gamma body", name: "gamma.txt" },
      ]);
      yield* fixture.run();
      const leftover = path.join(fixture.outDir, "leftover.txt");
      yield* fs.writeFileString(leftover, "from the previous run");

      const forced = yield* fixture.run({ overwrite: true });
      const leftoverKept = yield* fs.exists(leftover);
      const callsAfterForce = yield* fixture.engineCalls("java");

      // Markers record the export choice they were produced under.
      const otherInputs = yield* fixture.run({ exportChildren: false });
      const callsAfterOtherInputs = yield* fixture.engineCalls("java");

      expect(forced.alreadyCompleteCount).toBe(0);
      expect(forced.extractedCount).toBe(3);
      expect(forced.succeededCount).toBe(3);
      expect(leftoverKept).toBe(false);
      expect(callsAfterForce).toBe(6);

      expect(otherInputs.alreadyCompleteCount).toBe(0);
      expect(otherInputs.extractedCount).toBe(3);
      expect(callsAfterOtherInputs).toBe(9);
    })
  );

  it.effect(
    "retries failed sources on resume and keeps the summary counts a partition",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const fixture = yield* makeExtractResumeFixture([
        { content: "alpha body", name: "alpha.txt" },
        { content: "extract-must-fail", name: "broken.txt" },
        { content: "gamma body", name: "gamma.txt" },
        { content: "opaque payload", name: "mystery.zzunknown" },
      ]);

      const first = yield* fixture.run();
      const brokenMarker = yield* fs.exists(fixture.markerPath("extract-must-fail"));
      const unsupportedMarker = yield* fs.exists(fixture.markerPath("opaque payload"));
      const resumed = yield* fixture.run();
      const javaCalls = yield* fixture.engineCalls("java");

      expect(Struct.pick(first, summaryCountKeys)).toEqual({
        alreadyCompleteCount: 0,
        extractedCount: 2,
        failedCount: 2,
        skippedCount: 0,
        sourceCount: 4,
        succeededCount: 2,
      });
      expect(brokenMarker).toBe(false);
      expect(unsupportedMarker).toBe(false);

      // Both failures (engine error and unsupported format) are retried; the
      // engine is only invoked again for the source it can attempt.
      expect(Struct.pick(resumed, summaryCountKeys)).toEqual({
        alreadyCompleteCount: 2,
        extractedCount: 0,
        failedCount: 2,
        skippedCount: 0,
        sourceCount: 4,
        succeededCount: 2,
      });
      expect(resumed.alreadyCompleteCount + resumed.extractedCount + resumed.failedCount).toBe(resumed.sourceCount);
      expect(javaCalls).toBe(4);
    })
  );
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus salvage run labels and dedupe", (it) => {
  it.effect(
    "writes copied files and provenance under the requested run label",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-run-label-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );

      const copiedExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "source-a", "a.txt"));
      const runManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "provenance.jsonl"));
      const rootManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "run-a", "provenance.jsonl"));

      expect(summary.recordsChecked).toBe(1);
      expect(copiedExists).toBe(true);
      expect(runManifestExists).toBe(true);
      expect(rootManifestExists).toBe(false);
      assertSome(A.head(records).pipe(O.map((record) => record.copyMode)), "copied");
    })
  );

  it.effect(
    "writes every multi-source salvage provenance line as parseable JSON",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-multi-source-manifest-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceADir = path.join(root, "source-a");
      const sourceBDir = path.join(root, "source-b");
      const sourceCDir = path.join(root, "source-c");
      const sourceDDir = path.join(root, "source-d");
      yield* Effect.forEach([sourceADir, sourceBDir, sourceCDir, sourceDDir], (sourceDir) =>
        fs.makeDirectory(sourceDir, { recursive: true })
      );

      const firstFileName = "~first-walked.pst.tmp";
      const firstFileBytes = new Uint8Array(131_072);
      firstFileBytes.fill(0x41);
      yield* fs.writeFile(path.join(sourceADir, firstFileName), firstFileBytes);

      const sharedFiles = [
        { body: "shared-zero", name: "shared-0.txt" },
        { body: "shared-one", name: "shared-1.txt" },
        { body: "shared-two", name: "shared-2.txt" },
        { body: "shared-three", name: "shared-3.txt" },
      ];
      yield* Effect.forEach(
        [sourceBDir, sourceCDir, sourceDDir],
        (sourceDir) =>
          Effect.forEach(sharedFiles, (file) => fs.writeFileString(path.join(sourceDir, file.name), file.body), {
            discard: true,
          }),
        { discard: true }
      );

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-multi-source",
          sources: [
            sourceSpec("source-a", sourceADir),
            sourceSpec("source-b", sourceBDir),
            sourceSpec("source-c", sourceCDir),
            sourceSpec("source-d", sourceDDir),
          ],
        })
      );

      const manifestPath = path.join(corpusRoot, "raw", "run-multi-source", "provenance.jsonl");
      const lines = yield* readProvenanceLines(manifestPath);
      const records = yield* Effect.forEach(lines, (line) => decodeCorpusProvenanceRecordJson(line));
      const firstLine = yield* Effect.fromOption(A.head(lines));
      const firstRecord = yield* Effect.fromOption(A.head(records));

      expect(A.length(lines)).toBe(summary.recordsChecked);
      expect(A.length(records)).toBe(summary.recordsChecked);
      expect(firstLine.startsWith("{")).toBe(true);
      expect(firstLine.includes("\u0000")).toBe(false);
      expect(firstRecord.relativePath).toBe(firstFileName);
      expect(firstRecord.sizeBytes).toBe(131_072);
      expect(firstRecord.copyMode).toBe("copied");
      expect(A.length(A.filter(records, (record) => record.copyMode === "provenance-only"))).toBe(8);
    })
  );

  it.effect(
    "preserves POSIX filenames with punctuation and literal backslashes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-weird-path-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-d");
      const nestedDirName = "nested files";
      const nestedDir = path.join(sourceDir, nestedDirName);
      const weirdName = "weird; (name) [x].docx";
      const backslashName = "back\\slash.txt";
      const weirdRelativePath = path.join(nestedDirName, weirdName);
      const backslashRelativePath = path.join(nestedDirName, backslashName);
      yield* fs.makeDirectory(nestedDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, weirdRelativePath), "punctuation");
      yield* fs.writeFileString(path.join(sourceDir, backslashRelativePath), "backslash");

      const summary = yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-weird",
          sources: [sourceSpec("source-d", sourceDir)],
        })
      );

      const weirdDest = path.join(corpusRoot, "raw", "run-weird", "source-d", weirdRelativePath);
      const backslashDest = path.join(corpusRoot, "raw", "run-weird", "source-d", backslashRelativePath);
      const weirdExists = yield* fs.exists(weirdDest);
      const backslashExists = yield* fs.exists(backslashDest);
      const provenancePath = path.join(corpusRoot, "raw", "run-weird", "provenance.jsonl");
      const records = yield* readProvenanceRecords(provenancePath);
      const weirdRecord = yield* Effect.fromOption(
        A.findFirst(records, (record) => record.relativePath === weirdRelativePath)
      );
      const backslashRecord = yield* Effect.fromOption(
        A.findFirst(records, (record) => record.relativePath === backslashRelativePath)
      );

      expect(summary.recordsChecked).toBe(2);
      expect(weirdExists).toBe(true);
      expect(backslashExists).toBe(true);
      expect(weirdRecord.copyMode).toBe("copied");
      expect(weirdRecord.destPath).toBe(weirdDest);
      expect(weirdRecord.originPath).toBe(path.join(sourceDir, weirdRelativePath));
      expect(weirdRecord.sourceLabel).toBe("source-d");
      expect(backslashRecord.copyMode).toBe("copied");
      expect(backslashRecord.destPath).toBe(backslashDest);
      expect(backslashRecord.originPath).toBe(path.join(sourceDir, backslashRelativePath));
      expect(backslashRecord.sourceLabel).toBe("source-d");

      const archiveRoot = path.join(root, "archive");
      const archiveSummary = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [provenancePath],
          sourcePaths: [sourceDir],
        })
      );

      const sourceStillExists = yield* fs.exists(sourceDir);
      const weirdArchiveExists = yield* fs.exists(path.join(archiveRoot, "source-d", weirdRelativePath));
      const backslashArchiveExists = yield* fs.exists(path.join(archiveRoot, "source-d", backslashRelativePath));
      const moveManifestPath = path.join(corpusRoot, "raw", "run-weird", "move-manifest.jsonl");
      const moveRecords = yield* readArchiveMoveManifestRecords(moveManifestPath);
      const moveRecord = yield* Effect.fromOption(A.head(moveRecords));

      expect(archiveSummary.sourcesMoved).toBe(1);
      expect(archiveSummary.filesCovered).toBe(2);
      expect(archiveSummary.copiedRecords).toBe(2);
      expect(archiveSummary.provenanceOnlyRecords).toBe(0);
      expect(sourceStillExists).toBe(false);
      expect(weirdArchiveExists).toBe(true);
      expect(backslashArchiveExists).toBe(true);
      expect(A.length(moveRecords)).toBe(1);
      expect(moveRecord.originPath).toBe(sourceDir);
      expect(moveRecord.archivePath).toBe(path.join(archiveRoot, "source-d"));
      expect(moveRecord.fileCount).toBe(2);
    })
  );

  it.effect(
    "uses the DuckDB catalog for dedupe-aware provenance-only salvage",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-catalog-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const rawSourceDir = path.join(corpusRoot, "raw", "source-a");
      yield* fs.makeDirectory(rawSourceDir, { recursive: true });
      const existingRawPath = path.join(rawSourceDir, "existing.txt");
      yield* fs.writeFileString(existingRawPath, "alpha");
      const existingLine = yield* encodeProvenanceLine(
        provenanceRecord({
          copyMode: "copied",
          destPath: existingRawPath,
          originPath: path.join(root, "origin-a", "existing.txt"),
          relativePath: "existing.txt",
          sha256: alphaDigest,
          sizeBytes: 5,
          sourceLabel: "source-a",
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "provenance.jsonl"), `${existingLine}\n`);
      yield* catalogCorpus(CorpusCatalogOptions.make({ corpusRoot }));

      const sourceDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "duplicate.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          sources: [sourceSpec("source-b", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const deduped = A.findFirst(records, (record) => record.sourceLabel === "source-b");
      const duplicateCopyExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-b", "duplicate.txt"));

      deduped.pipe(O.isSome, assertTrue);
      if (O.isSome(deduped)) {
        expect(deduped.value.copyMode).toBe("provenance-only");
        expect(deduped.value.destPath).toBe(existingRawPath);
        expect(deduped.value.dedupeOfPath).toBe(existingRawPath);
      }
      expect(duplicateCopyExists).toBe(false);
    })
  );

  it.effect(
    "falls back to scanning raw provenance manifests when the catalog is absent",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-manifest-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const priorRawDir = path.join(corpusRoot, "raw", "run-one", "source-a");
      yield* fs.makeDirectory(priorRawDir, { recursive: true });
      const existingRawPath = path.join(priorRawDir, "existing.txt");
      yield* fs.writeFileString(existingRawPath, "alpha");
      const existingLine = yield* encodeProvenanceLine(
        provenanceRecord({
          copyMode: "copied",
          destPath: existingRawPath,
          originPath: path.join(root, "origin-a", "existing.txt"),
          relativePath: "existing.txt",
          sha256: alphaDigest,
          sizeBytes: 5,
          sourceLabel: "source-a",
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "run-one", "provenance.jsonl"), `${existingLine}\n`);

      const sourceDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "duplicate.txt"), "alpha");
      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-two",
          sources: [sourceSpec("source-b", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "run-two", "provenance.jsonl"));
      const record = yield* Effect.fromOption(A.head(records));
      const duplicateCopyExists = yield* fs.exists(
        path.join(corpusRoot, "raw", "run-two", "source-b", "duplicate.txt")
      );

      expect(record.copyMode).toBe("provenance-only");
      expect(record.destPath).toBe(existingRawPath);
      expect(duplicateCopyExists).toBe(false);
    })
  );

  it.effect(
    "dedupes files already recorded earlier in the same salvage run",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-same-run-dedupe-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");
      yield* fs.writeFileString(path.join(sourceDir, "b.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );

      const records = yield* readProvenanceRecords(path.join(corpusRoot, "raw", "provenance.jsonl"));
      const copiedExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-a", "a.txt"));
      const duplicateCopyExists = yield* fs.exists(path.join(corpusRoot, "raw", "source-a", "b.txt"));

      expect(A.length(A.filter(records, (record) => record.copyMode === "copied"))).toBe(1);
      expect(A.length(A.filter(records, (record) => record.copyMode === "provenance-only"))).toBe(1);
      expect(copiedExists).toBe(true);
      expect(duplicateCopyExists).toBe(false);
    })
  );

  it.effect(
    "decodes old-shape provenance records without copyMode or dedupeOfPath",
    Effect.fnUntraced(function* () {
      const line =
        '{"destPath":"/tmp/corpus/raw/source-a/a.txt","mtimeEpoch":1700000000,"mtimeIso":"2023-11-14T22:13:20Z","originPath":"/tmp/source-a/a.txt","relativePath":"a.txt","salvagedAt":"2026-06-11T15:00:00Z","sha256":"8ed3f6ad685b959ead7022518e1af76cd816f8e8ec7ccdda1ed4018e8f2223f8","sizeBytes":5,"sourceLabel":"source-a"}';
      const record = yield* decodeCorpusProvenanceRecordJson(line);

      expect(record.sourceLabel).toBe("source-a");
      O.fromUndefinedOr(record.copyMode).pipe(assertNone);
      O.fromUndefinedOr(record.dedupeOfPath).pipe(assertNone);
    })
  );
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus archive-move", (it) => {
  it.effect(
    "moves provenance-covered sources and writes a move manifest",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-move-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceADir = path.join(root, "source-a");
      const sourceBDir = path.join(root, "source-b");
      yield* fs.makeDirectory(sourceADir, { recursive: true });
      yield* fs.makeDirectory(sourceBDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceADir, "a.txt"), "alpha");
      yield* fs.writeFileString(path.join(sourceBDir, "b.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          dedupe: true,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceADir), sourceSpec("source-b", sourceBDir)],
        })
      );

      const archiveRoot = path.join(root, "archive");
      const provenancePath = path.join(corpusRoot, "raw", "run-a", "provenance.jsonl");
      const summary = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [provenancePath],
          sourcePaths: [sourceADir, sourceBDir],
        })
      );

      const sourceAExists = yield* fs.exists(sourceADir);
      const sourceBExists = yield* fs.exists(sourceBDir);
      const archiveAExists = yield* fs.exists(path.join(archiveRoot, "source-a", "a.txt"));
      const archiveBExists = yield* fs.exists(path.join(archiveRoot, "source-b", "b.txt"));
      const moveManifestExists = yield* fs.exists(path.join(corpusRoot, "raw", "run-a", "move-manifest.jsonl"));

      expect(summary.sourcesMoved).toBe(2);
      expect(summary.filesCovered).toBe(2);
      expect(summary.copiedRecords).toBe(1);
      expect(summary.provenanceOnlyRecords).toBe(1);
      expect(sourceAExists).toBe(false);
      expect(sourceBExists).toBe(false);
      expect(archiveAExists).toBe(true);
      expect(archiveBExists).toBe(true);
      expect(moveManifestExists).toBe(true);
    })
  );

  it.effect(
    "fails archive-move without moving anything when a source file is uncovered",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-uncovered-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );
      yield* fs.writeFileString(path.join(sourceDir, "extra.txt"), "bravo");

      const archiveRoot = path.join(root, "archive");
      const error = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [path.join(corpusRoot, "raw", "run-a", "provenance.jsonl")],
          sourcePaths: [sourceDir],
        })
      ).pipe(Effect.flip);
      const sourceStillExists = yield* fs.exists(sourceDir);
      const archiveExists = yield* fs.exists(path.join(archiveRoot, "source-a"));

      expect(error._tag).toBe("CorpusArchiveMoveUncoveredFileError");
      expect(sourceStillExists).toBe(true);
      expect(archiveExists).toBe(false);
    })
  );

  it.effect(
    "fails archive-move without moving anything when a raw digest mismatches",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-archive-mismatch-test-" });
      const corpusRoot = path.join(root, "corpus");
      const sourceDir = path.join(root, "source-a");
      yield* fs.makeDirectory(sourceDir, { recursive: true });
      yield* fs.writeFileString(path.join(sourceDir, "a.txt"), "alpha");

      yield* salvageCorpus(
        CorpusSalvageOptions.make({
          corpusRoot,
          runLabel: "run-a",
          sources: [sourceSpec("source-a", sourceDir)],
        })
      );
      yield* fs.writeFileString(path.join(corpusRoot, "raw", "run-a", "source-a", "a.txt"), "changed");

      const archiveRoot = path.join(root, "archive");
      const error = yield* archiveMoveCorpus(
        CorpusArchiveMoveOptions.make({
          archiveRoot,
          provenancePaths: [path.join(corpusRoot, "raw", "run-a", "provenance.jsonl")],
          sourcePaths: [sourceDir],
        })
      ).pipe(Effect.flip);
      const sourceStillExists = yield* fs.exists(sourceDir);
      const archiveExists = yield* fs.exists(path.join(archiveRoot, "source-a"));

      expect(error._tag).toBe("CorpusArchiveMoveDigestMismatchError");
      expect(sourceStillExists).toBe(true);
      expect(archiveExists).toBe(false);
    })
  );
});

type PreservationDenominators = Pick<
  RestorationPreserveOptions,
  "expectedRootArchiveBytes" | "expectedSourceDirectoryCount" | "expectedSourceFileCount" | "expectedSourceTreeBytes"
>;

const measurePreservationDenominators = Effect.fn("CorpusTest.measurePreservationDenominators")(function* (
  sourceRoot: string,
  rootArchive: string
): Effect.fn.Return<PreservationDenominators, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  let directoryCount = 1;
  let fileCount = 0;
  let sourceTreeBytes = 0;
  const visit: (directory: string) => Effect.Effect<void> = Effect.fn(
    "CorpusTest.measurePreservationDenominators.visit"
  )(function* (directory: string) {
    for (const name of yield* fs.readDirectory(directory).pipe(Effect.orDie)) {
      const entry = path.join(directory, name);
      const info = yield* fs.stat(entry).pipe(Effect.orDie);
      if (info.type === "Directory") {
        directoryCount += 1;
        yield* visit(entry);
      } else if (info.type === "File") {
        fileCount += 1;
        sourceTreeBytes += Number(info.size);
      }
    }
  });
  yield* visit(sourceRoot);
  const rootArchiveInfo = yield* fs.stat(rootArchive).pipe(Effect.orDie);
  return {
    expectedRootArchiveBytes: S.Natural.make(Number(rootArchiveInfo.size)),
    expectedSourceDirectoryCount: S.Natural.make(directoryCount),
    expectedSourceFileCount: S.Natural.make(fileCount),
    expectedSourceTreeBytes: S.Natural.make(sourceTreeBytes),
  };
});

const collectorManifestJson = S.fromJsonString(CollectorManifestRecord);

class ArchiveCopyMutation extends Context.Service<
  ArchiveCopyMutation,
  {
    readonly target: Ref.Ref<O.Option<string>>;
    readonly mutation: Ref.Ref<O.Option<Effect.Effect<void, PlatformError.PlatformError>>>;
    readonly native: FileSystem.FileSystem;
  }
>()("@beep/repo-cli/test/corpus-command.test/ArchiveCopyMutation") {}

const archiveCopyMutationInputs = Layer.effect(
  ArchiveCopyMutation,
  Effect.gen(function* () {
    return {
      target: yield* Ref.make(O.none<string>()),
      mutation: yield* Ref.make(O.none<Effect.Effect<void, PlatformError.PlatformError>>()),
      native: yield* FileSystem.FileSystem,
    };
  })
);

const archiveCopyMutationFileSystem = Layer.effect(
  FileSystem.FileSystem,
  Effect.gen(function* () {
    const inputs = yield* ArchiveCopyMutation;
    const fs = inputs.native;
    return FileSystem.FileSystem.of({
      ...fs,
      open: Effect.fn("CorpusTest.mutateWhenArchiveCopyOpens")(function* (target, openOptions) {
        const file = yield* fs.open(target, openOptions);
        const expected = yield* Ref.get(inputs.target);
        if (O.contains(target)(expected)) {
          const mutation = yield* Ref.getAndSet(inputs.mutation, O.none());
          yield* O.getOrElse(mutation, () => Effect.void);
        }
        return file;
      }),
    });
  })
).pipe(Layer.provideMerge(archiveCopyMutationInputs));

const archiveCopyMutationLayer = Layer.fresh(CorpusCommandServiceLive).pipe(
  Layer.provideMerge(archiveCopyMutationFileSystem)
);

const preserveWithArchiveCopyMutation = Effect.fn("CorpusTest.preserveWithArchiveCopyMutation")(function* (
  options: RestorationPreserveOptions,
  partialPath: string,
  mutation: (fs: FileSystem.FileSystem) => Effect.Effect<void, PlatformError.PlatformError>
) {
  const inputs = yield* ArchiveCopyMutation;
  yield* Ref.set(inputs.target, O.some(partialPath));
  yield* Ref.set(inputs.mutation, O.some(mutation(inputs.native)));
  return yield* preserveRestorationArchive(options);
});

const writePresentCollectorManifest = Effect.fn("CorpusTest.writePresentCollectorManifest")(function* (
  sourceRoot: string,
  collectorManifest: string
): Effect.fn.Return<number, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const records: Array<CollectorManifestRecord> = [];
  const visit: (directory: string) => Effect.Effect<void> = Effect.fn("CorpusTest.writePresentCollectorManifest.visit")(
    function* (directory: string) {
      for (const name of yield* fs.readDirectory(directory).pipe(Effect.orDie)) {
        const entry = path.join(directory, name);
        const info = yield* fs.stat(entry).pipe(Effect.orDie);
        if (info.type === "Directory") {
          yield* visit(entry);
        } else if (info.type === "File") {
          const relativePath = path.relative(sourceRoot, entry);
          records.push(
            CollectorManifestRecord.cases.copied.make({
              dst: `F:/salvage/${relativePath}`,
              size: S.Natural.make(Number(info.size)),
              src: `C:/source/${relativePath}`,
              status: "copied",
            })
          );
        }
      }
    }
  );
  yield* visit(sourceRoot);
  const encoded = yield* Effect.forEach(records, (record) =>
    S.encodeEffect(collectorManifestJson)(record).pipe(Effect.orDie)
  );
  yield* fs.writeFileString(collectorManifest, `${A.join(encoded, "\n")}\n`).pipe(Effect.orDie);
  return records.length;
});

const restorationOptions = (
  input: PreservationDenominators & {
    readonly absentTree: string;
    readonly capacityCeilingBytes: number;
    readonly collectorManifest: string;
    readonly corpusRoot: string;
    readonly crashPoint?: "after-payload-sync" | "after-rename" | "before-pass" | "none";
    readonly rootArchive: string;
    readonly sourceRoot: string;
  }
): RestorationPreserveOptions =>
  RestorationPreserveOptions.make({
    absentRecycleTreePath: input.absentTree,
    capacityCeilingBytes: PosInt.make(input.capacityCeilingBytes),
    chunkSizeBytes: PosInt.make(1_024),
    collectorDestinationPrefixSegments: S.Natural.make(2),
    corpusRoot: input.corpusRoot,
    crashPoint: input.crashPoint ?? "none",
    expectedCollectorCopiedCount: S.Natural.make(1),
    expectedCollectorErrorCount: S.Natural.make(1),
    expectedCollectorExcludedSecretCount: S.Natural.make(0),
    expectedCollectorPresentSuccessfulRowCount: S.Natural.make(1),
    expectedCollectorResumedCount: S.Natural.make(1),
    expectedCollectorRowCount: S.Natural.make(3),
    expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(2),
    expectedMissingRecyclePayloadCount: S.Natural.make(1),
    expectedMutatedDestinationCount: S.Natural.make(1),
    expectedRootArchiveBytes: input.expectedRootArchiveBytes,
    expectedSourceDirectoryCount: input.expectedSourceDirectoryCount,
    expectedSourceFileCount: input.expectedSourceFileCount,
    expectedSourceTreeBytes: input.expectedSourceTreeBytes,
    minimumFreeAfterBytes: S.Natural.make(0),
    rootArchivePath: input.rootArchive,
    runLabel: "synthetic-restoration",
    sourceManifestPath: input.collectorManifest,
    sourceRoot: input.sourceRoot,
  });

const makeRestorationFixture = Effect.fn("CorpusTest.makeRestorationFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const nestedRoot = path.join(sourceRoot, "nested");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(nestedRoot, { recursive: true });
  const largeBytes = new Uint8Array(1024 * 1024 + 37);
  largeBytes.fill(0x5a);
  yield* fs.writeFile(path.join(nestedRoot, "large.bin"), largeBytes);
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  const collectorRows = [
    CollectorManifestRecord.cases.copied.make({
      dst: "F:\\salvage\\nested\\large.bin",
      size: S.Natural.make(largeBytes.length),
      src: "C:\\source\\large.bin",
      status: "copied",
    }),
    CollectorManifestRecord.cases.resumed.make({
      dst: "F:\\salvage\\missing.bin",
      size: S.Natural.make(1),
      src: "C:\\source\\missing.bin",
      status: "resumed",
    }),
    CollectorManifestRecord.cases.error.make({
      reason: "source unreadable",
      src: "C:\\source\\unreadable.bin",
      status: "error",
    }),
  ];
  const encodedCollectorRows = yield* Effect.forEach(collectorRows, (record) =>
    S.encodeEffect(collectorManifestJson)(record).pipe(Effect.orDie)
  );
  yield* fs.writeFileString(collectorManifest, `${A.join(encodedCollectorRows, "\n")}\n`);
  return {
    absentTree,
    collectorManifest,
    corpusRoot,
    ...(yield* measurePreservationDenominators(sourceRoot, rootArchive)),
    rootArchive,
    sourceRoot,
  };
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus restoration preservation", (it) => {
  it.effect(
    "rejects traversal-bearing run labels and archive-relative paths at decode boundaries",
    Effect.fnUntraced(function* () {
      const runLabelResult = yield* decodeRestorationVerifyOptions({
        corpusRoot: "/tmp/corpus",
        runLabel: "../escape",
      }).pipe(Effect.option);
      const archivePathResult = yield* decodeArchiveLedgerRecordJson(
        '{"destinationRelativePath":"../escape","objectId":"object-1","objectKind":"directory","recordedAt":"2026-08-27T00:00:00.000Z","recordType":"archive-directory-pass","runId":"preservation-1","schemaVersion":"oppold-corpus-restoration/v1","sourceLabel":"source-tree","sourceRelativePath":"safe"}'
      ).pipe(Effect.option);

      runLabelResult.pipe(assertNone);
      archivePathResult.pipe(assertNone);
    })
  );

  it.effect(
    "rejects a collector row whose recorded byte size differs from its canonical source file",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      const manifest = yield* fs.readFileString(fixture.collectorManifest);
      yield* fs.writeFileString(
        fixture.collectorManifest,
        Str.replace(`${1024 * 1024 + 37}`, `${1024 * 1024 + 38}`)(manifest)
      );
      const error = yield* preserveRestorationArchive(
        restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 })
      ).pipe(Effect.flip);
      const archiveRootExists = yield* fs.exists(path.join(fixture.corpusRoot, "raw", "synthetic-restoration"));

      expect(error.message).toContain("size contradicts");
      expect(archiveRootExists).toBe(false);
    })
  );

  it.layer(archiveCopyMutationLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "recopies a same-size source that stabilizes after changing in flight",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const sourcePath = path.join(fixture.sourceRoot, "nested", "large.bin");
        const partialPath = path.join(
          fixture.corpusRoot,
          "raw",
          "synthetic-restoration",
          "payload",
          "tree",
          "nested",
          "large.bin.partial"
        );
        const sourceBytes = new Uint8Array(2 * 1024 * 1024);
        sourceBytes.fill(0x31);
        const stableReplacement = new Uint8Array(sourceBytes.length);
        stableReplacement.fill(0x32);
        yield* fs.writeFile(sourcePath, sourceBytes);
        const replacementPath = path.join(path.dirname(fixture.sourceRoot), "stable-replacement.bin");
        yield* fs.writeFile(replacementPath, stableReplacement);
        const denominators = yield* measurePreservationDenominators(fixture.sourceRoot, fixture.rootArchive);
        const collectorRowCount = yield* writePresentCollectorManifest(fixture.sourceRoot, fixture.collectorManifest);
        const options = RestorationPreserveOptions.make({
          ...restorationOptions({
            ...fixture,
            ...denominators,
            capacityCeilingBytes: 64 * 1024 * 1024,
          }),
          chunkSizeBytes: PosInt.make(1024 * 1024),
          expectedCollectorCopiedCount: S.Natural.make(collectorRowCount),
          expectedCollectorErrorCount: S.Natural.make(0),
          expectedCollectorPresentSuccessfulRowCount: S.Natural.make(collectorRowCount),
          expectedCollectorResumedCount: S.Natural.make(0),
          expectedCollectorRowCount: S.Natural.make(collectorRowCount),
          expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(collectorRowCount),
          expectedMissingRecyclePayloadCount: S.Natural.make(0),
          expectedMutatedDestinationCount: S.Natural.make(0),
        });
        const summary = yield* preserveWithArchiveCopyMutation(options, partialPath, (racingFs) =>
          racingFs.rename(replacementPath, sourcePath)
        );
        const verified = yield* verifyRestorationArchive(
          RestorationVerifyOptions.make({
            corpusRoot: fixture.corpusRoot,
            runLabel: "synthetic-restoration",
          })
        );
        const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(manifestPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeArchiveLedgerRecordJson);
        const changedRows = A.filter(records, (record) => record.recordType === "archive-changed-during-copy");
        const stablePass = A.findFirst(
          records,
          (record) => record.recordType === "archive-file-pass" && record.sourceRelativePath === "nested/large.bin"
        );
        const destination = yield* fs.readFile(
          path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload", "tree", "nested", "large.bin")
        );

        expect(summary.unapprovedCount).toBe(0);
        expect(verified.unapprovedCount).toBe(0);
        expect(changedRows).toHaveLength(1);
        stablePass.pipe(O.isSome, assertTrue);
        expect(Uint8Array.from(destination)).toStrictEqual(stableReplacement);
      })
    );
  });

  it.layer(archiveCopyMutationLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "does not let a stable recopy mask unrelated source-tree drift",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeRestorationFixture();
        const sourcePath = path.join(fixture.sourceRoot, "nested", "large.bin");
        const partialPath = path.join(
          fixture.corpusRoot,
          "raw",
          "synthetic-restoration",
          "payload",
          "tree",
          "nested",
          "large.bin.partial"
        );
        const sourceBytes = new Uint8Array(2 * 1024 * 1024);
        sourceBytes.fill(0x41);
        const stableReplacement = new Uint8Array(sourceBytes.length);
        stableReplacement.fill(0x42);
        yield* fs.writeFile(sourcePath, sourceBytes);
        const replacementPath = path.join(path.dirname(fixture.sourceRoot), "stable-replacement.bin");
        yield* fs.writeFile(replacementPath, stableReplacement);
        const denominators = yield* measurePreservationDenominators(fixture.sourceRoot, fixture.rootArchive);
        const collectorRowCount = yield* writePresentCollectorManifest(fixture.sourceRoot, fixture.collectorManifest);
        const options = RestorationPreserveOptions.make({
          ...restorationOptions({
            ...fixture,
            ...denominators,
            capacityCeilingBytes: 64 * 1024 * 1024,
          }),
          chunkSizeBytes: PosInt.make(1024 * 1024),
          expectedCollectorCopiedCount: S.Natural.make(collectorRowCount),
          expectedCollectorErrorCount: S.Natural.make(0),
          expectedCollectorPresentSuccessfulRowCount: S.Natural.make(collectorRowCount),
          expectedCollectorResumedCount: S.Natural.make(0),
          expectedCollectorRowCount: S.Natural.make(collectorRowCount),
          expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(collectorRowCount),
          expectedMissingRecyclePayloadCount: S.Natural.make(0),
          expectedMutatedDestinationCount: S.Natural.make(0),
        });
        const error = yield* preserveWithArchiveCopyMutation(
          options,
          partialPath,
          Effect.fn("CorpusTest.mutateArchiveSourceAndAddDrift")(function* (racingFs) {
            yield* racingFs.rename(replacementPath, sourcePath);
            yield* racingFs.writeFileString(path.join(fixture.sourceRoot, "unrelated-added.bin"), "unexpected drift");
          })
        ).pipe(Effect.flip);
        const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(manifestPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeArchiveLedgerRecordJson);

        expect(error.message).toMatch(/source/iu);
        expect(A.some(records, (record) => record.recordType === "archive-changed-during-copy")).toBe(true);
        expect(A.some(records, (record) => record.recordType === "archive-manifest-seal")).toBe(false);
      })
    );
  });

  it.effect(
    "rejects symlinked partial and ledger destinations without touching their outside canaries",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const attack of ["partial", "ledger"] as const) {
        const fixture = yield* makeRestorationFixture();
        const archiveRoot = path.join(fixture.corpusRoot, "raw", "synthetic-restoration");
        const outsideCanary = path.join(path.dirname(fixture.corpusRoot), `${attack}-outside-canary.txt`);
        const attackedPath =
          attack === "ledger"
            ? path.join(archiveRoot, "archive-ledger.jsonl")
            : path.join(archiveRoot, "payload", "tree", "nested", "large.bin.partial");
        yield* fs.makeDirectory(path.dirname(attackedPath), { recursive: true });
        yield* fs.writeFileString(outsideCanary, `${attack} canary`);
        yield* fs.symlink(outsideCanary, attackedPath);

        const error = yield* preserveRestorationArchive(
          restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 })
        ).pipe(Effect.flip);

        expect(error.message).toContain(attack === "ledger" ? "restoration append destination" : "Partial archive");
        expect(yield* fs.readFileString(outsideCanary)).toBe(`${attack} canary`);
      }
    })
  );

  it.effect(
    "reclaims an exact writer claim left by a killed restoration writer process",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-writer-claim-test-" });
      const claimDirectory = path.join(root, "writer-claims");
      const claimName = ".preservation-writer.claim";
      const claimPath = path.join(claimDirectory, claimName);
      yield* fs.makeDirectory(claimDirectory, { recursive: true });
      const childProgram = `
          import { withRestorationWriterClaim } from "@beep/repo-cli/test/Corpus";
          import { NodeServices } from "@effect/platform-node";
          import { Console, Effect } from "effect";

          await Effect.runPromise(
            withRestorationWriterClaim(
              process.env.BEEP_RESTORATION_TEST_CLAIM_DIRECTORY,
              ".preservation-writer.claim",
              Console.log("CLAIMED").pipe(Effect.andThen(Effect.never))
            ).pipe(Effect.provide(NodeServices.layer))
          );
        `;
      const child = yield* ChildProcess.make("bun", ["--eval", childProgram], {
        cwd: process.cwd(),
        env: { BEEP_RESTORATION_TEST_CLAIM_DIRECTORY: claimDirectory },
        extendEnv: true,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
      });
      const claimedOutput = yield* child.stdout.pipe(Stream.decodeText(), Stream.runHead);
      yield* child.kill({ killSignal: "SIGKILL" });
      yield* child.exitCode.pipe(Effect.flip);
      const staleClaimExists = yield* fs.exists(claimPath);

      {
        const actualProjection = { claimedOutput, staleClaimExists };
        const expectedProjection = {
          claimedOutput: O.some("CLAIMED\n"),
          staleClaimExists: true,
        };
        assertDefined(actualProjection);
        deepStrictEqual<typeof expectedProjection>(
          Struct.pick(actualProjection, ["claimedOutput", "staleClaimExists"]),
          expectedProjection
        );
      }

      yield* withRestorationWriterClaim(claimDirectory, claimName, Effect.void);

      expect(yield* fs.exists(claimPath)).toBe(false);
    }),
    120_000
  );

  it.effect(
    "fails closed for live, malformed, oversized, symlinked, and unsafe writer claims",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-writer-claim-adversarial-test-" });
      const claimDirectory = path.join(root, "writer-claims");
      const claimName = ".preservation-writer.claim";
      const claimPath = path.join(claimDirectory, claimName);
      yield* fs.makeDirectory(claimDirectory, { recursive: true });

      const liveError = yield* withRestorationWriterClaim(
        claimDirectory,
        claimName,
        withRestorationWriterClaim(claimDirectory, claimName, Effect.void).pipe(Effect.flip)
      );
      expect(liveError.message).toContain("currently owns");

      yield* fs.writeFileString(claimPath, "not-json\n");
      const malformedError = yield* withRestorationWriterClaim(claimDirectory, claimName, Effect.void).pipe(
        Effect.flip
      );
      expect(malformedError.message).toContain("unreadable");
      yield* fs.remove(claimPath);

      yield* fs.writeFileString(claimPath, "x".repeat(16 * 1024 + 1));
      const oversizedError = yield* withRestorationWriterClaim(claimDirectory, claimName, Effect.void).pipe(
        Effect.flip
      );
      expect(oversizedError.message).toContain("bounded size");
      yield* fs.remove(claimPath);

      const outside = path.join(root, "outside-claim");
      yield* fs.writeFileString(outside, "not-json\n");
      yield* fs.symlink(outside, claimPath);
      const symlinkError = yield* withRestorationWriterClaim(claimDirectory, claimName, Effect.void).pipe(Effect.flip);
      expect(symlinkError.message).toContain("canonical");
      yield* fs.remove(claimPath);

      for (const unsafeName of ["", ".", "..", "nested/claim"]) {
        const unsafeError = yield* withRestorationWriterClaim(claimDirectory, unsafeName, Effect.void).pipe(
          Effect.flip
        );
        expect(unsafeError.message).toContain("safe filesystem basename");
      }
    })
  );

  it.effect(
    "streams, resumes, seals, extends provenance, and independently verifies synthetic archive objects",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      const partialPath = path.join(
        fixture.corpusRoot,
        "raw",
        "synthetic-restoration",
        "payload",
        "tree",
        "nested",
        "large.bin.partial"
      );
      yield* fs.makeDirectory(path.dirname(partialPath), { recursive: true });
      yield* fs.writeFileString(partialPath, "ZZ");

      const summary = yield* preserveRestorationArchive(
        restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 })
      );
      const verified = yield* verifyRestorationArchive(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-restoration",
        })
      );
      const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(manifestPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(lines, decodeArchiveLedgerRecordJson);
      const resumedPass = A.findFirst(
        records,
        (record) => record.recordType === "archive-file-pass" && record.sourceRelativePath === "nested/large.bin"
      );
      const provenance = yield* fs.readFileString(path.join(fixture.corpusRoot, "raw", "provenance.jsonl"));
      const reports = yield* fs.readDirectory(
        path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "verification")
      );
      const rootArchiveExists = yield* fs.exists(
        path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload", "root-archive.zip")
      );

      expect(summary.unapprovedCount).toBe(0);
      expect(summary.inputBytes).toBe(1024 * 1024 + 37 + "verbatim-root-archive".length);
      expect(verified.unapprovedCount).toBe(0);
      expect(verified.passCount).toBe(summary.passCount);
      assertSome(
        O.map(resumedPass, (record) => (record.recordType === "archive-file-pass" ? record.resumedBytes : 0)),
        S.Natural.make(2)
      );
      expect(provenance.trim().split("\n")).toHaveLength(2);
      expect(reports).toHaveLength(1);
      expect(rootArchiveExists).toBe(true);
    })
  );

  it.effect(
    "rejects physical payload entries that have no sealed terminal owner",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 }));
      const foreignDirectory = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload", "foreign");
      yield* fs.makeDirectory(foreignDirectory, { recursive: true });
      yield* fs.writeFileString(path.join(foreignDirectory, "untracked.bin"), "untracked");

      const error = yield* verifyRestorationArchive(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-restoration",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("physical preservation payload");
    })
  );

  it.effect(
    "rejects systematic seal and terminal-index corruption",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 }));
      const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
      const originalLines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(manifestPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(originalLines, decodeArchiveLedgerRecordJson);
      const seal = A.findFirst(records, (record) => record.recordType === "archive-manifest-seal");
      const terminal = A.findFirst(
        records,
        (record) => record.recordType === "archive-file-pass" || record.recordType === "archive-directory-pass"
      );
      const terminalRows = A.filter(
        records,
        (record) => record.recordType === "archive-file-pass" || record.recordType === "archive-directory-pass"
      );
      const fileTerminal = A.findFirst(records, (record) => record.recordType === "archive-file-pass");
      const directoryTerminal = A.findFirst(records, (record) => record.recordType === "archive-directory-pass");
      const preflight = A.findFirst(records, (record) => record.recordType === "archive-preflight");
      if (
        O.isNone(seal) ||
        O.isNone(terminal) ||
        O.isNone(fileTerminal) ||
        O.isNone(directoryTerminal) ||
        O.isNone(preflight)
      ) {
        return yield* Effect.die("Expected sealed preflight, file, and directory terminal fixture rows.");
      }
      const archiveRoot = path.join(fixture.corpusRoot, "raw", "synthetic-restoration");
      const emptySeal = ArchiveLedgerRecord.cases["archive-manifest-seal"].make({
        ...seal.value,
        manifestSha256: Sha256Hex.make(bytesToHex(sha256(new Uint8Array()))),
        recordCount: S.Natural.make(0),
      });
      const encodedEmptySeal = yield* encodeArchiveLedgerRecordJson(emptySeal);
      expect(yield* RA.validateArchiveManifestSeal(archiveRoot, [encodedEmptySeal], [emptySeal])).toEqual(emptySeal);
      const fileDestination = path.join(archiveRoot, fileTerminal.value.destinationRelativePath);
      const originalFileBytes = yield* fs.readFile(fileDestination);
      yield* fs.writeFileString(fileDestination, "corrupt-terminal-bytes");
      expect(
        (yield* RA.verifyArchiveFile(fileTerminal.value.objectId, fileTerminal.value, fileDestination)).record
      ).toMatchObject({ _tag: "Some", value: { failureKind: "digest-mismatch" } });
      yield* fs.writeFile(fileDestination, originalFileBytes);
      yield* fs.remove(fileDestination);
      expect(
        (yield* RA.verifyArchiveTerminal(archiveRoot, fileTerminal.value.objectId, fileTerminal.value)).record
      ).toMatchObject({ _tag: "Some", value: { failureKind: "missing-destination" } });
      yield* fs.writeFile(fileDestination, originalFileBytes);
      expect(
        (yield* RA.verifyArchiveDirectory(directoryTerminal.value.objectId, directoryTerminal.value, fileDestination))
          .record
      ).toMatchObject({ _tag: "Some", value: { failureKind: "missing-destination" } });
      const failureTerminal = ArchiveLedgerRecord.cases["archive-failure"].make({
        approved: false,
        failureKind: "unreadable",
        message: "synthetic terminal failure",
        objectId: fileTerminal.value.objectId,
        recordedAt: fileTerminal.value.recordedAt,
        recordType: "archive-failure",
        runId: fileTerminal.value.runId,
        schemaVersion: fileTerminal.value.schemaVersion,
        sourceLabel: fileTerminal.value.sourceLabel,
        sourceRelativePath: fileTerminal.value.sourceRelativePath,
      });
      const fileDestinationInfo = yield* fs.stat(fileDestination);
      const provenanceSource = {
        destinationRelativePath: fileTerminal.value.destinationRelativePath,
        expectedInfo: RA.sourceIdentity(fileDestinationInfo),
        expectedSizeBytes: fileTerminal.value.sizeBytes,
        objectId: fileTerminal.value.objectId,
        objectKind: "file" as const,
        sourceLabel: fileTerminal.value.sourceLabel,
        sourcePath: path.join(fixture.sourceRoot, fileTerminal.value.sourceRelativePath),
        sourceRelativePath: fileTerminal.value.sourceRelativePath,
      };
      yield* RA.appendProvenance(
        path.join(fixture.corpusRoot, "raw", "provenance.jsonl"),
        archiveRoot,
        provenanceSource,
        failureTerminal,
        failureTerminal.recordedAt
      );
      (yield* RA.appendProvenance(
        path.join(fixture.corpusRoot, "raw", "provenance.jsonl"),
        archiveRoot,
        { ...provenanceSource, sourcePath: `${provenanceSource.sourcePath}.contradictory` },
        fileTerminal.value,
        fileTerminal.value.recordedAt
      ).pipe(Effect.exit)).pipe(Exit.isFailure, assertTrue);
      expect(
        (yield* RA.verifyArchiveTerminal(archiveRoot, failureTerminal.objectId, failureTerminal)).record
      ).toMatchObject({ _tag: "Some", value: { failureKind: "unapproved-terminal" } });
      (yield* RA.requireArchivePayloadOwned(archiveRoot, RA.indexArchiveTerminals([failureTerminal]).terminals).pipe(
        Effect.exit
      )).pipe(Exit.isFailure, assertTrue);
      const withoutSeal = A.filter(records, (record) => record.recordType !== "archive-manifest-seal");
      const reseal = Effect.fn("CorpusTest.resealArchiveLedger")(function* (
        unsealed: ReadonlyArray<ArchiveLedgerRecord>
      ) {
        const encoded = yield* Effect.forEach(unsealed, encodeArchiveLedgerRecordJson);
        const manifestSha256 = Sha256Hex.make(bytesToHex(sha256(utf8ToBytes(`${A.join(encoded, "\n")}\n`))));
        return A.append(
          unsealed,
          ArchiveLedgerRecord.cases["archive-manifest-seal"].make({
            ...seal.value,
            manifestSha256,
            recordCount: S.Natural.make(unsealed.length),
          })
        );
      });
      const duplicateTerminal = yield* reseal(A.append(withoutSeal, terminal.value));
      const withoutTerminal = yield* reseal(A.filter(withoutSeal, (record) => record !== terminal.value));
      const withoutInheritedLoss = yield* reseal(
        A.filter(withoutSeal, (record) => record.recordType !== "inherited-loss")
      );
      const duplicatePreflight = yield* reseal(A.append(withoutSeal, preflight.value));
      const unapprovedPreflight = yield* reseal(
        A.map(withoutSeal, (record) =>
          record === preflight.value
            ? ArchiveLedgerRecord.cases["archive-preflight"].make({ ...preflight.value, approved: false })
            : record
        )
      );
      const withFailure = yield* reseal(
        A.append(
          withoutSeal,
          ArchiveLedgerRecord.cases["archive-failure"].make({
            approved: false,
            failureKind: "unreadable",
            message: "synthetic sealed failure",
            objectId: terminal.value.objectId,
            recordedAt: terminal.value.recordedAt,
            recordType: "archive-failure",
            runId: terminal.value.runId,
            schemaVersion: terminal.value.schemaVersion,
            sourceLabel: terminal.value.sourceLabel,
            sourceRelativePath: terminal.value.sourceRelativePath,
          })
        )
      );
      const firstTerminal = terminalRows[0];
      const secondTerminal = terminalRows[1];
      if (firstTerminal === undefined || secondTerminal === undefined) {
        return yield* Effect.die("Expected at least two archive terminal fixture rows.");
      }
      const duplicateDestinationTerminal =
        secondTerminal.recordType === "archive-file-pass"
          ? ArchiveLedgerRecord.cases["archive-file-pass"].make({
              ...secondTerminal,
              destinationRelativePath: firstTerminal.destinationRelativePath,
            })
          : ArchiveLedgerRecord.cases["archive-directory-pass"].make({
              ...secondTerminal,
              destinationRelativePath: firstTerminal.destinationRelativePath,
            });
      const duplicateDestination = yield* reseal(
        A.map(withoutSeal, (record) => (record === secondTerminal ? duplicateDestinationTerminal : record))
      );
      const variants: ReadonlyArray<ReadonlyArray<ArchiveLedgerRecord>> = [
        withoutSeal,
        A.append(records, seal.value),
        A.append(A.prepend(withoutSeal, seal.value), terminal.value),
        duplicateTerminal,
        withoutTerminal,
        withoutInheritedLoss,
        duplicatePreflight,
        unapprovedPreflight,
        withFailure,
        duplicateDestination,
      ];

      yield* Effect.forEach(
        variants,
        (variant) =>
          Effect.gen(function* () {
            const encoded = yield* Effect.forEach(variant, encodeArchiveLedgerRecordJson);
            yield* fs.writeFileString(manifestPath, `${A.join(encoded, "\n")}\n`);
            const exit = yield* verifyRestorationArchive(
              RestorationVerifyOptions.make({
                corpusRoot: fixture.corpusRoot,
                runLabel: "synthetic-restoration",
              })
            ).pipe(Effect.exit);
            expect(exit).toMatchObject({ _tag: "Failure" });
          }),
        { discard: true }
      );
    })
  );

  it.effect(
    "recovers across payload sync, atomic promotion, and pre-PASS interruptions without a false PASS",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const crashPoint of ["after-payload-sync", "after-rename", "before-pass"] as const) {
        const fixture = yield* makeRestorationFixture();
        const interrupted = yield* preserveRestorationArchive(
          restorationOptions({
            ...fixture,
            capacityCeilingBytes: 10 * 1024 * 1024,
            crashPoint,
          })
        ).pipe(Effect.flip);
        const manifestPath = path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "archive-ledger.jsonl");
        const interruptedText = yield* fs.readFileString(manifestPath);
        const provenancePath = path.join(fixture.corpusRoot, "raw", "provenance.jsonl");
        const interruptedProvenance = (yield* fs.exists(provenancePath))
          ? yield* fs.readFileString(provenancePath)
          : "";
        expect(interrupted.message).toContain(crashPoint);
        expect(interruptedText).not.toContain('"recordType":"archive-file-pass"');

        yield* fs.writeFileString(manifestPath, `${interruptedText}{"recordType":"interrupted-manifest`);
        yield* fs.writeFileString(provenancePath, `${interruptedProvenance}{"interrupted":"provenance`);

        yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 }));
        const verified = yield* verifyRestorationArchive(
          RestorationVerifyOptions.make({
            corpusRoot: fixture.corpusRoot,
            runLabel: "synthetic-restoration",
          })
        );
        expect(yield* fs.readFileString(manifestPath)).not.toContain("interrupted-manifest");
        expect(yield* fs.readFileString(provenancePath)).not.toContain('"interrupted":"provenance');
        expect(verified.unapprovedCount).toBe(0);
      }
    })
  );

  it.effect(
    "truncates and replaces a mismatched complete destination through the resumable path",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      const options = restorationOptions({ ...fixture, capacityCeilingBytes: 10 * 1024 * 1024 });
      yield* preserveRestorationArchive(options);
      const destinationPath = path.join(
        fixture.corpusRoot,
        "raw",
        "synthetic-restoration",
        "payload",
        "tree",
        "nested",
        "large.bin"
      );
      yield* fs.writeFileString(destinationPath, "mismatch");

      yield* preserveRestorationArchive(options);
      const verified = yield* verifyRestorationArchive(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-restoration",
        })
      );
      const restored = yield* fs.readFile(destinationPath);
      expect(verified.unapprovedCount).toBe(0);
      expect(restored.length).toBe(1024 * 1024 + 37);
      expect(restored[0]).toBe(0x5a);
    })
  );

  it.effect(
    "denies capacity before writing any payload bytes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      const error = yield* preserveRestorationArchive(restorationOptions({ ...fixture, capacityCeilingBytes: 1 })).pipe(
        Effect.flip
      );
      const payloadExists = yield* fs.exists(path.join(fixture.corpusRoot, "raw", "synthetic-restoration", "payload"));
      expect(error.message).toContain("capacity preflight denied");
      expect(payloadExists).toBe(false);
    })
  );

  it.effect(
    "rejects a contradictory frozen source denominator before creating the archive run root",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRestorationFixture();
      const error = yield* preserveRestorationArchive(
        restorationOptions({
          ...fixture,
          capacityCeilingBytes: 10 * 1024 * 1024,
          expectedSourceFileCount: S.Natural.make(fixture.expectedSourceFileCount + 1),
        })
      ).pipe(Effect.flip);
      const archiveRootExists = yield* fs.exists(path.join(fixture.corpusRoot, "raw", "synthetic-restoration"));

      expect(error.message).toContain("denominator");
      expect(archiveRootExists).toBe(false);
    })
  );
});

const restorationBwrapStub = `#!/usr/bin/env bash
set -eu
saw_unshare="0"
mount_hosts=()
mount_targets=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --unshare-all)
      saw_unshare="1"
      shift
      ;;
    --ro-bind|--bind)
      mount_hosts+=("$2")
      mount_targets+=("$3")
      shift 3
      ;;
    --)
      shift
      break
      ;;
    *)
      shift
      ;;
  esac
done
if [ "$saw_unshare" != "1" ] || [ "$#" -lt 1 ]; then
  exit 91
fi
command="$1"
shift
quota_root=""
if [ "$command" = "/bin/sh" ] && [ "\${1:-}" = "-c" ]; then
  shift 3
  command="$1"
  shift
  quota_root="$(mktemp -d -p "$(dirname "$0")" quota-output.XXXXXX)"
  trap 'rm -rf -- "$quota_root"' EXIT
fi
mapped_command="$command"
for index in "\${!mount_targets[@]}"; do
  target="\${mount_targets[$index]}"
  host="\${mount_hosts[$index]}"
  if [ "$command" = "$target" ]; then
    mapped_command="$host"
  elif [[ "$command" = "$target/"* ]]; then
    mapped_command="$host\${command#$target}"
  fi
done
mapped=()
for argument in "$@"; do
  mapped_argument="$argument"
  for index in "\${!mount_targets[@]}"; do
    target="\${mount_targets[$index]}"
    host="\${mount_hosts[$index]}"
    if [ "$argument" = "$target" ]; then
      mapped_argument="$host"
    elif [[ "$argument" = "$target/"* ]]; then
      mapped_argument="$host\${argument#$target}"
    fi
  done
  if [ -n "$quota_root" ]; then
    if [ "$argument" = "/output" ]; then
      mapped_argument="$quota_root"
    elif [[ "$argument" = "/output/"* ]]; then
      mapped_argument="$quota_root\${argument#/output}"
    fi
  fi
  mapped+=("$mapped_argument")
done
if [ -n "$quota_root" ]; then
  set +e
  "$mapped_command" "\${mapped[@]}" 1>&2
  status="$?"
  set -e
  if [ "$status" -ne 0 ]; then exit "$status"; fi
  exec /usr/bin/tar --format=posix --sort=name --numeric-owner --owner=0 --group=0 -C "$quota_root" -cf - .
fi
exec "$mapped_command" "\${mapped[@]}"
`;

const restorationSystemdRunStub = `#!/usr/bin/env bash
set -eu
while [ "$#" -gt 0 ]; do
  if [ "$1" = "--" ]; then shift; break; fi
  shift
done
exec "$@"
`;

const restorationPffexportStub = `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\n'
  exit 0
fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item/Attachment00001"
printf 'Subject:\\tSynthetic\\n' > "$item/OutlookHeaders.txt"
printf 'synthetic mail body' > "$item/Message.txt"
printf '%%PDF-1.4 synthetic attachment' > "$item/Attachment00001/report.bin"
exit 0
`;

const duplicateAttachmentPffexportStub = `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\n'
  exit 0
fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
item="$target.export/Top of Personal Folders/Inbox/Message00001"
mkdir -p "$item/Attachment00001" "$item/Attachment00002"
printf 'Subject:\tSynthetic\n' > "$item/OutlookHeaders.txt"
printf 'synthetic mail body' > "$item/Message.txt"
printf '%%PDF-1.4 duplicate attachment' > "$item/Attachment00001/report.bin"
printf '%%PDF-1.4 duplicate attachment' > "$item/Attachment00002/report.bin"
exit 0
`;

const restorationTikaStub = `#!/usr/bin/env bash
printf 'synthetic extracted attachment text\n'
`;

const emptyRestorationTikaStub = `#!/usr/bin/env bash
exit 0
`;

const failingRestorationPffexportStub = (message: string): string => `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\\n'
  exit 0
fi
printf '%s\\n' '${message}' >&2
exit 2
`;

const failingRestorationPffexportWithOutputStub = (message: string): string => `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\\n'
  exit 0
fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
mkdir -p "$target.export"
printf 'retained partial engine output' > "$target.export/partial-output.bin"
printf '%s\\n' '${message}' >&2
exit 2
`;

const emptyRestorationPffexportStub = `#!/usr/bin/env bash
if [ "$1" = "-V" ]; then
  printf 'pffexport 20260608\n'
  exit 0
fi
target=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "-t" ]; then target="$argument"; fi
  previous="$argument"
done
mkdir -p "$target.export"
exit 0
`;

const makeMailRestorationFixture = Effect.fn("CorpusTest.makeMailRestorationFixture")(function* (
  pffexportScript: string,
  tikaScript: string = restorationTikaStub
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-mail-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const mailRoot = path.join(sourceRoot, "$Recycle.Bin", "surface-a");
  const mailPath = path.join(mailRoot, "$Rstore.pst");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  const pffexportPath = path.join(root, "pffexport-stub");
  const tikaPath = path.join(root, "tika-stub");
  const bwrapPath = path.join(root, "bwrap-stub");
  const systemdRunPath = path.join(root, "systemd-run-stub");
  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(mailRoot, { recursive: true });
  const mailBytes = new Uint8Array(1024 * 1024 + 31);
  mailBytes.fill(0x42);
  yield* fs.writeFile(mailPath, mailBytes);
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  const collectorRow = yield* S.encodeEffect(collectorManifestJson)(
    CollectorManifestRecord.cases.copied.make({
      dst: "F:\\salvage\\$Recycle.Bin\\surface-a\\$Rstore.pst",
      size: S.Natural.make(mailBytes.length),
      src: "C:\\source\\mail-store.pst",
      status: "copied",
    })
  ).pipe(Effect.orDie);
  yield* fs.writeFileString(collectorManifest, `${collectorRow}\n`);
  yield* writeStub(pffexportScript, pffexportPath);
  yield* writeStub(tikaScript, tikaPath);
  yield* writeStub(restorationBwrapStub, bwrapPath);
  yield* writeStub(restorationSystemdRunStub, systemdRunPath);
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  const preservationOptions = RestorationPreserveOptions.make({
    absentRecycleTreePath: absentTree,
    capacityCeilingBytes: PosInt.make(10 * 1024 * 1024),
    chunkSizeBytes: PosInt.make(4_096),
    collectorDestinationPrefixSegments: S.Natural.make(2),
    corpusRoot,
    expectedCollectorCopiedCount: S.Natural.make(1),
    expectedCollectorErrorCount: S.Natural.make(0),
    expectedCollectorExcludedSecretCount: S.Natural.make(0),
    expectedCollectorPresentSuccessfulRowCount: S.Natural.make(1),
    expectedCollectorResumedCount: S.Natural.make(0),
    expectedCollectorRowCount: S.Natural.make(1),
    expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(1),
    expectedMissingRecyclePayloadCount: S.Natural.make(0),
    expectedMutatedDestinationCount: S.Natural.make(0),
    ...denominators,
    minimumFreeAfterBytes: S.Natural.make(0),
    rootArchivePath: rootArchive,
    runLabel: "synthetic-mail-restoration",
    sourceManifestPath: collectorManifest,
    sourceRoot,
  });
  yield* preserveRestorationArchive(preservationOptions);
  return { bwrapPath, corpusRoot, pffexportPath, preservationOptions, systemdRunPath, tikaPath };
});

const mailRestorationOptions = (
  fixture: {
    readonly bwrapPath: string;
    readonly corpusRoot: string;
    readonly pffexportPath: string;
    readonly systemdRunPath: string;
    readonly tikaPath: string;
  },
  scope: "full" | "slice" = "slice"
): RestorationMailOptions =>
  RestorationMailOptions.make({
    bwrapPath: fixture.bwrapPath,
    corpusRoot: fixture.corpusRoot,
    expectedStoreCount: S.Natural.make(1),
    javaPath: fixture.tikaPath,
    maxAmplificationRatio: 10,
    maxElapsedMillis: PosInt.make(30_000),
    maxTotalElapsedMillis: PosInt.make(30_000),
    maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
    pffexportPath: fixture.pffexportPath,
    runLabel: "synthetic-mail-restoration",
    scope,
    systemdRunPath: fixture.systemdRunPath,
    tikaJarPath: fixture.tikaPath,
  });

const readTransformationLedgerFixture = Effect.fnUntraced(function* (ledgerPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
  const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
  return { lines, records };
});

const truncateLedgerAtFirstAttemptStart = Effect.fnUntraced(function* (ledgerPath: string) {
  const fs = yield* FileSystem.FileSystem;
  const decoded = yield* readTransformationLedgerFixture(ledgerPath);
  const start = A.findFirst(decoded.records, (record) => record.recordType === "family-attempt-start");
  if (O.isNone(start)) return yield* Effect.die("Mail run did not publish its durable attempt start.");
  const index = A.findFirstIndex(decoded.records, (record) => record === start.value);
  if (O.isNone(index)) return yield* Effect.die("Mail attempt start was absent from its ledger.");
  yield* fs.writeFileString(ledgerPath, `${A.join(A.take(decoded.lines, index.value + 1), "\n")}\n`);
  return start.value;
});

type MailLedgerTamper = "repair-attempt" | "settlement-retry" | "settlement-source";

const replaceFirstTransformationRecord = <Selected extends TransformationLedgerRecord>(
  records: ReadonlyArray<TransformationLedgerRecord>,
  predicate: (record: TransformationLedgerRecord) => record is Selected,
  replace: (record: Selected) => TransformationLedgerRecord
): O.Option<ReadonlyArray<TransformationLedgerRecord>> =>
  O.flatMap(A.findFirstIndex(records, predicate), (index) =>
    O.flatMap(A.get(records, index), (record) =>
      predicate(record) ? A.replace(records, index, replace(record)) : O.none()
    )
  );

const tamperRestartedMailSegment = (
  records: ReadonlyArray<TransformationLedgerRecord>,
  interruptedAttemptId: string,
  tamper: MailLedgerTamper
): O.Option<ReadonlyArray<TransformationLedgerRecord>> =>
  Match.value(tamper).pipe(
    Match.when("settlement-source", () =>
      replaceFirstTransformationRecord(
        records,
        (
          record
        ): record is Extract<TransformationLedgerRecord, { readonly recordType: "family-attempt-interrupted" }> =>
          record.recordType === "family-attempt-interrupted",
        (record) =>
          TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
            ...record,
            sourceId: "tampered-source-object",
          })
      )
    ),
    Match.when("settlement-retry", () =>
      replaceFirstTransformationRecord(
        records,
        (
          record
        ): record is Extract<TransformationLedgerRecord, { readonly recordType: "family-attempt-interrupted" }> =>
          record.recordType === "family-attempt-interrupted",
        (record) =>
          TransformationLedgerRecord.cases["family-attempt-interrupted"].make({
            ...record,
            retryOrdinal: S.Natural.make(record.retryOrdinal + 1),
          })
      )
    ),
    Match.when("repair-attempt", () =>
      replaceFirstTransformationRecord(
        records,
        (record): record is Extract<TransformationLedgerRecord, { readonly recordType: "attachment-type-repair" }> =>
          record.recordType === "attachment-type-repair",
        (record) =>
          TransformationLedgerRecord.cases["attachment-type-repair"].make({
            ...record,
            attemptId: interruptedAttemptId,
          })
      )
    ),
    Match.exhaustive
  );

it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })("corpus restoration mail", (it) => {
  it.effect(
    "runs the public source-path engine with all-item mode and accounts every raw and repaired child",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      const summary = yield* restoreMail(mailRestorationOptions(fixture));
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "slice.jsonl"
      );
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
      const pass = A.findFirst(records, (record) => record.recordType === "mail-store-pass");
      const children = A.filter(records, (record) => record.recordType === "mail-child-pass");
      const repair = A.findFirst(
        records,
        (record) => record.recordType === "attachment-type-repair" && record.repairStatus === "repaired"
      );

      expect(summary.passCount).toBe(1);
      expect(summary.unapprovedCount).toBe(0);
      assertSome(
        O.map(pass, (record) =>
          record.recordType === "mail-store-pass" ? record.accountedChildCount > record.childCount : false
        ),
        true
      );
      expect(A.some(children, (record) => record.recordType === "mail-child-pass" && !record.engineReported)).toBe(
        true
      );
      repair.pipe(O.isSome, assertTrue);
    })
  );

  it.effect(
    "reuses identical content-addressed attachment derivatives",
    Effect.fnUntraced(function* () {
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(duplicateAttachmentPffexportStub);
      const summary = yield* restoreMail(mailRestorationOptions(fixture));
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "slice.jsonl"
      );
      const { records } = yield* readTransformationLedgerFixture(ledgerPath);
      const repairs = A.filter(
        records,
        (record): record is Extract<TransformationLedgerRecord, { readonly recordType: "attachment-type-repair" }> =>
          record.recordType === "attachment-type-repair" && record.repairStatus === "repaired"
      );
      const derivativePaths = A.map(repairs, (record) => record.derivedRelativePath);

      expect(summary.unapprovedCount).toBe(0);
      expect(repairs).toHaveLength(2);
      expect(new Set(derivativePaths).size).toBe(1);
    })
  );

  it.effect(
    "resumes one durably started mail attempt and a pending summary without resetting the family clock",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      const options = mailRestorationOptions(fixture);
      yield* restoreMail(options);
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "slice.jsonl"
      );
      yield* truncateLedgerAtFirstAttemptStart(ledgerPath);
      const interruptedLedger = yield* fs.readFileString(ledgerPath);
      yield* fs.writeFileString(ledgerPath, `${interruptedLedger}{"recordType":"interrupted-attempt`);

      const changedPolicy = yield* restoreMail(
        RestorationMailOptions.make({ ...options, maxAmplificationRatio: options.maxAmplificationRatio + 1 })
      ).pipe(Effect.flip);
      expect(changedPolicy.message).toContain("restart contract");

      yield* TestClock.adjust("2 seconds");
      const resumed = yield* restoreMail(options);
      const resumedLines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(resumedLines, decodeTransformationLedgerRecordJson);
      const familyStarts = A.filter(records, (record) => record.recordType === "family-run-start");
      const attemptStarts = A.filter(records, (record) => record.recordType === "family-attempt-start");
      const interrupted = A.filter(records, (record) => record.recordType === "family-attempt-interrupted");
      const terminals = A.filter(
        records,
        (record) => record.recordType === "mail-store-pass" || record.recordType === "mail-store-exception"
      );
      const summaries = A.filter(records, (record) => record.recordType === "family-run-summary");

      expect(resumed.passCount).toBe(1);
      expect(familyStarts).toHaveLength(1);
      expect(attemptStarts).toHaveLength(2);
      expect(interrupted).toHaveLength(1);
      expect(terminals).toHaveLength(1);
      expect(summaries).toHaveLength(1);
      expect(yield* fs.readFileString(ledgerPath)).not.toContain("interrupted-attempt");
      expect(A.map(attemptStarts, (record) => record.retryOrdinal)).toStrictEqual([0, 1]);
      expect(A.map(interrupted, (record) => record.attemptId)).toStrictEqual(
        A.take(
          A.map(attemptStarts, (record) => record.attemptId),
          1
        )
      );
      expect(A.map(terminals, (record) => record.attemptId)).toStrictEqual(
        A.drop(
          A.map(attemptStarts, (record) => record.attemptId),
          1
        )
      );
      expect(A.every(summaries, (record) => record.elapsedMillis >= 2_000)).toBe(true);

      yield* fs.writeFileString(ledgerPath, `${A.join(A.dropRight(resumedLines, 1), "\n")}\n`);
      const finalized = yield* restoreMail(options);
      const finalizedLedger = yield* readTransformationLedgerFixture(ledgerPath);
      expect(finalized.passCount).toBe(1);
      expect(A.filter(finalizedLedger.records, (record) => record.recordType === "family-attempt-start")).toHaveLength(
        2
      );
      expect(A.filter(finalizedLedger.records, (record) => record.recordType === "family-run-summary")).toHaveLength(1);
      expect(
        A.filter(finalizedLedger.records, (record) => record.recordType === "family-acceptance-pass")
      ).toHaveLength(1);
    }),
    { concurrent: false }
  );

  it.effect(
    "finishes interrupted-output retention when the candidate was already moved before its ownership row",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      const options = mailRestorationOptions(fixture);
      yield* restoreMail(options);
      const runRoot = path.join(fixture.corpusRoot, "staging", "restoration", "runs", "synthetic-mail-restoration");
      const ledgerPath = path.join(runRoot, "ledgers", "mail", "slice.jsonl");
      const firstStart = yield* truncateLedgerAtFirstAttemptStart(ledgerPath);

      const outputRoot = path.join(runRoot, "output", "mail", "slice");
      const retainedRoot = path.join(outputRoot, "interrupted", firstStart.attemptId);
      yield* fs.makeDirectory(retainedRoot, { recursive: true });
      yield* fs.rename(path.join(outputRoot, "attempts", firstStart.attemptId), path.join(retainedRoot, "final"));

      const resumed = yield* restoreMail(options);
      const resumedLines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(resumedLines, decodeTransformationLedgerRecordJson);
      const interruptions = A.filter(records, (record) => record.recordType === "family-attempt-interrupted");
      const starts = A.filter(records, (record) => record.recordType === "family-attempt-start");
      const terminals = A.filter(
        records,
        (record) => record.recordType === "mail-store-pass" || record.recordType === "mail-store-exception"
      );

      expect(resumed.passCount).toBe(1);
      expect(interruptions).toHaveLength(1);
      expect(starts).toHaveLength(2);
      expect(terminals).toHaveLength(1);
      expect(interruptions[0]?.attemptId).toBe(firstStart.attemptId);
      expect(interruptions[0]?.retainedOutputRelativePath).toBe(`interrupted/${firstStart.attemptId}`);
      expect(terminals[0]?.attemptId).toBe(starts[1]?.attemptId);
      expect(yield* fs.exists(path.join(retainedRoot, "final"))).toBe(true);
    }),
    { concurrent: false }
  );

  it.effect(
    "rejects tampered settlement ownership, retry ordinals, and cross-attempt attachment repairs",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const tamper of ["settlement-source", "settlement-retry", "repair-attempt"] as const) {
        const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
        const options = mailRestorationOptions(fixture, "full");
        yield* restoreMail(options);
        const ledgerPath = path.join(
          fixture.corpusRoot,
          "staging",
          "restoration",
          "runs",
          "synthetic-mail-restoration",
          "ledgers",
          "mail",
          "full.jsonl"
        );
        yield* truncateLedgerAtFirstAttemptStart(ledgerPath);
        yield* restoreMail(options);

        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
        const segment = A.dropRight(records, 2);
        const interrupted = A.findFirst(segment, (record) => record.recordType === "family-attempt-interrupted");
        const acceptance = records[records.length - 1];
        const summary = records[records.length - 2];
        if (O.isNone(interrupted) || acceptance?.recordType !== "family-acceptance-pass" || summary === undefined) {
          return yield* Effect.die("Expected complete restarted mail evidence for tampering.");
        }
        const tampered = tamperRestartedMailSegment(segment, interrupted.value.attemptId, tamper);
        if (O.isNone(tampered)) {
          return yield* Effect.die(`Mail ledger lacked the ${tamper} evidence selected for tampering.`);
        }
        const tamperedSegment = tampered.value;
        const encodedSegment = yield* Effect.forEach(tamperedSegment, encodeTransformationLedgerRecordJson);
        const evidenceSha256 = Sha256Hex.make(bytesToHex(sha256(utf8ToBytes(`${A.join(encodedSegment, "\n")}\n`))));
        const rewrittenAcceptance = TransformationLedgerRecord.cases["family-acceptance-pass"].make({
          ...acceptance,
          evidenceSha256,
        });
        const encodedTerminal = yield* Effect.forEach(
          [summary, rewrittenAcceptance] as const,
          encodeTransformationLedgerRecordJson
        );
        yield* fs.writeFileString(ledgerPath, `${A.join(A.appendAll(encodedSegment, encodedTerminal), "\n")}\n`);

        const error = yield* reconcileRestorationAcceptance(
          RestorationVerifyOptions.make({
            corpusRoot: fixture.corpusRoot,
            runLabel: "synthetic-mail-restoration",
          })
        ).pipe(Effect.flip);

        expect(error.message).toContain("Final mail acceptance evidence");
      }
    }),
    { concurrent: false }
  );

  it.effect(
    "rejects empty Tika extraction and a zero-child engine result instead of emitting a family PASS",
    Effect.fnUntraced(function* () {
      for (const [pffexportScript, tikaScript] of [
        [restorationPffexportStub, emptyRestorationTikaStub],
        [emptyRestorationPffexportStub, restorationTikaStub],
      ] as const) {
        const fixture = yield* makeMailRestorationFixture(pffexportScript, tikaScript);
        const error = yield* restoreMail(mailRestorationOptions(fixture)).pipe(Effect.flip);

        expect(error.message).toContain("zero-unapproved-terminal");
      }
    }),
    { concurrent: false }
  );

  it.effect(
    "classifies corrupt, password, and codepage engine failures as unapproved terminal exceptions",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      for (const [message, expected] of [
        ["corrupt store", "corrupt"],
        ["password required", "password"],
        ["unsupported codepage", "codepage"],
      ] as const) {
        const fixture = yield* makeMailRestorationFixture(failingRestorationPffexportStub(message));
        yield* restoreMail(mailRestorationOptions(fixture)).pipe(Effect.flip);
        const ledgerPath = path.join(
          fixture.corpusRoot,
          "staging",
          "restoration",
          "runs",
          "synthetic-mail-restoration",
          "ledgers",
          "mail",
          "slice.jsonl"
        );
        const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
        const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
        const terminal = A.findFirst(records, (record) => record.recordType === "mail-store-exception");
        assertSome(
          O.map(terminal, (record) =>
            record.recordType === "mail-store-exception" ? record.exceptionKind : "engine-failure"
          ),
          expected
        );
      }
    })
  );

  it.effect(
    "records approved corrupt stores without publishing failed sandbox output",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(failingRestorationPffexportWithOutputStub("corrupt store"));
      const summary = yield* restoreMail(mailRestorationOptions(fixture, "full"));
      const runRoot = path.join(fixture.corpusRoot, "staging", "restoration", "runs", "synthetic-mail-restoration");
      const ledgerPath = path.join(runRoot, "ledgers", "mail", "full.jsonl");
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
      const terminal = A.findFirst(records, (record) => record.recordType === "mail-store-exception");
      if (O.isNone(terminal) || terminal.value.recordType !== "mail-store-exception") {
        return yield* Effect.die("Expected an approved corrupt-store terminal.");
      }
      expect(terminal.value.approved).toBe(true);
      expect(terminal.value.retainedOutputBytes).toBe(0);
      expect(summary.outputBytes).toBe(0);

      const acceptanceError = yield* reconcileRestorationAcceptance(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-mail-restoration",
        })
      ).pipe(Effect.flip);
      expect(acceptanceError.message).not.toContain("Final mail acceptance evidence");

      const partialRoot = path.join(
        runRoot,
        "output",
        "mail",
        "full",
        "attempts",
        `${terminal.value.attemptId}.partial`
      );
      expect(yield* fs.readDirectory(partialRoot)).toStrictEqual([]);
    })
  );

  it.effect(
    "denies an unavailable cumulative output ceiling before creating mail attempt payloads",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      const error = yield* restoreMail(
        RestorationMailOptions.make({
          ...mailRestorationOptions(fixture),
          maxTotalOutputBytes: PosInt.make(Number.MAX_SAFE_INTEGER),
        })
      ).pipe(Effect.flip);
      const outputExists = yield* fs.exists(
        path.join(
          fixture.corpusRoot,
          "staging",
          "restoration",
          "runs",
          "synthetic-mail-restoration",
          "output",
          "mail",
          "slice"
        )
      );

      expect(error.message).toContain("capacity preflight denied");
      expect(outputExists).toBe(false);
    })
  );
});

const makeRecycleRestorationFixture = Effect.fn("CorpusTest.makeRecycleRestorationFixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-recycle-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const recycleRoot = path.join(sourceRoot, "$Recycle.Bin");
  const surfaceA = path.join(recycleRoot, "surface-a");
  const surfaceB = path.join(recycleRoot, "surface-b");
  const surfaceC = path.join(recycleRoot, "surface-c");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");

  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceA, "duplicate-a"), { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceA, "duplicate-b"), { recursive: true });
  yield* fs.makeDirectory(surfaceB, { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceC, "$Rdirectory"), { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceC, "$Rdirectory", "empty-nested"), { recursive: true });
  yield* fs.makeDirectory(path.join(surfaceC, "$Rdirectory-copy"), { recursive: true });
  yield* fs.writeFileString(path.join(surfaceA, "$Rcase-a.txt"), "first collision payload");
  yield* fs.writeFile(
    path.join(surfaceA, "$Icase-a.txt"),
    makeMetadataV2("C:\\Recovered\\Case.txt", 23n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceA, "$Rcase-b.txt"), "second collision payload");
  yield* fs.writeFile(
    path.join(surfaceA, "$Icase-b.txt"),
    makeMetadataV2("C:\\recovered\\case.txt", 24n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceA, "duplicate-a", "$Rduplicate.txt"), "duplicate payload");
  yield* fs.writeFile(
    path.join(surfaceA, "duplicate-a", "$Iduplicate.txt"),
    makeMetadataV2("C:\\Recovered\\Duplicate.txt", 17n, filetime2020)
  );
  yield* fs.writeFile(
    path.join(surfaceA, "duplicate-b", "$Iduplicate.txt"),
    makeMetadataV2("C:\\Recovered\\Duplicate.txt", 17n, filetime2020)
  );
  yield* fs.writeFile(
    path.join(surfaceB, "$Imissing.txt"),
    makeMetadataV2("D:\\Recovered\\Missing.txt", 99n, filetime2020)
  );
  yield* fs.writeFileString(path.join(surfaceC, "$Rorphan.txt"), "orphan payload");
  yield* fs.writeFileString(path.join(surfaceC, "$Rdirectory", "child.bin"), "directory payload");
  yield* fs.writeFileString(path.join(surfaceC, "$Rdirectory-copy", "child.bin"), "directory payload");
  yield* fs.writeFile(
    path.join(surfaceC, "$Idirectory"),
    makeMetadataV2("E:\\Recovered\\..\\Directory", 17n, filetime2020)
  );
  yield* fs.writeFile(
    path.join(surfaceC, "$Idirectory-copy"),
    makeMetadataV2("E:\\Recovered\\Directory Copy", 17n, filetime2020)
  );
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  const collectorRowCount = yield* writePresentCollectorManifest(sourceRoot, collectorManifest);
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  yield* preserveRestorationArchive(
    RestorationPreserveOptions.make({
      absentRecycleTreePath: absentTree,
      capacityCeilingBytes: PosInt.make(10 * 1024 * 1024),
      chunkSizeBytes: PosInt.make(4_096),
      collectorDestinationPrefixSegments: S.Natural.make(2),
      corpusRoot,
      expectedCollectorCopiedCount: S.Natural.make(collectorRowCount),
      expectedCollectorErrorCount: S.Natural.make(0),
      expectedCollectorExcludedSecretCount: S.Natural.make(0),
      expectedCollectorPresentSuccessfulRowCount: S.Natural.make(collectorRowCount),
      expectedCollectorResumedCount: S.Natural.make(0),
      expectedCollectorRowCount: S.Natural.make(collectorRowCount),
      expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(collectorRowCount),
      expectedMissingRecyclePayloadCount: S.Natural.make(0),
      expectedMutatedDestinationCount: S.Natural.make(0),
      ...denominators,
      minimumFreeAfterBytes: S.Natural.make(0),
      rootArchivePath: rootArchive,
      runLabel: "synthetic-recycle-restoration",
      sourceManifestPath: collectorManifest,
      sourceRoot,
    })
  );
  return { corpusRoot };
});

it.layer(testLayer, { timeout: "30 seconds" })("corpus restoration recycle", (it) => {
  it.effect(
    "joins three surfaces into all four classes and preserves file and directory occurrences",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRecycleRestorationFixture();
      const summary = yield* restoreRecycle(
        RestorationRecycleOptions.make({
          corpusRoot: fixture.corpusRoot,
          expectedMissingContentCount: S.Natural.make(1),
          expectedSurfaceCount: S.Natural.make(3),
          maxTotalElapsedMillis: PosInt.make(30_000),
          maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
          runLabel: "synthetic-recycle-restoration",
        })
      );
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-recycle-restoration",
        "ledgers",
        "recycle",
        "full.jsonl"
      );
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
      const joins = A.filter(records, (record) => record.recordType === "recycle-join");
      const mappings = A.filter(records, (record) => record.recordType === "recycle-mapping");
      const start = A.findFirst(records, (record) => record.recordType === "family-run-start");
      const familySummary = A.findFirst(records, (record) => record.recordType === "family-run-summary");
      const totals = new Map<string, number>();
      for (const join of joins) {
        if (join.recordType === "recycle-join") {
          totals.set(join.joinClass, (totals.get(join.joinClass) ?? 0) + join.count);
        }
      }
      const mappedPaths = A.getSomes(
        A.map(mappings, (record) =>
          record.recordType === "recycle-mapping" ? O.some(record.restoredRelativePath) : O.none<string>()
        )
      );
      const caseFolded = A.map(mappedPaths, Str.toLowerCase);

      expect(summary.passCount).toBe(5);
      expect(summary.exceptionCount).toBe(3);
      expect(summary.unapprovedCount).toBe(0);
      assertSome(
        O.zipWith(start, familySummary, (left, right) =>
          left.recordType === "family-run-start" && right.recordType === "family-run-summary"
            ? left.expectedCount === right.sourceCount
            : false
        ),
        true
      );
      expect(joins).toHaveLength(12);
      expect(totals).toEqual(
        new Map([
          ["duplicate", 1],
          ["missing-content", 1],
          ["orphan-content", 1],
          ["valid-pair", 5],
        ])
      );
      expect(new Set(caseFolded).size).toBe(mappedPaths.length);
      expect(A.some(mappedPaths, Str.includes("__"))).toBe(true);
      expect(
        A.every(
          mappings,
          (record) =>
            record.recordType === "recycle-mapping" &&
            Str.isNonEmpty(record.contentObjectId) &&
            Str.isNonEmpty(record.metadataObjectId)
        )
      ).toBe(true);
      const joinedObjectIds = A.flatMap(joins, (record) =>
        record.recordType === "recycle-join" ? record.sourceObjectIds : []
      );
      expect(joinedObjectIds).toHaveLength(13);
      expect(new Set(joinedObjectIds).size).toBe(joinedObjectIds.length);
      const directoryMapping = A.findFirst(
        mappings,
        (record) => record.recordType === "recycle-mapping" && record.originalPath === "E:\\Recovered\\..\\Directory"
      );
      const directoryCopyMapping = A.findFirst(
        mappings,
        (record) => record.recordType === "recycle-mapping" && record.originalPath === "E:\\Recovered\\Directory Copy"
      );
      assertSome(
        O.zipWith(directoryMapping, directoryCopyMapping, (left, right) =>
          left.recordType === "recycle-mapping" && right.recordType === "recycle-mapping"
            ? left.digest !== right.digest
            : false
        ),
        true
      );
      const emptyDirectoryExists = yield* O.match(directoryMapping, {
        onNone: () => Effect.succeed(false),
        onSome: (record) =>
          record.recordType === "recycle-mapping"
            ? fs.exists(
                path.join(
                  fixture.corpusRoot,
                  "staging",
                  "restoration",
                  "runs",
                  "synthetic-recycle-restoration",
                  "output",
                  "recycle",
                  "full",
                  "restored",
                  record.restoredRelativePath,
                  "empty-nested"
                )
              )
            : Effect.succeed(false),
      });
      expect(emptyDirectoryExists).toBe(true);
    })
  );

  it.effect(
    "rejects recycle output that is not owned by mapping or interruption evidence",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRecycleRestorationFixture();
      const unownedRoot = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-recycle-restoration",
        "output",
        "recycle",
        "full",
        "restored",
        "unowned"
      );
      yield* fs.makeDirectory(unownedRoot, { recursive: true });
      yield* fs.writeFileString(path.join(unownedRoot, "stale.bin"), "stale");

      const error = yield* restoreRecycle(
        RestorationRecycleOptions.make({
          corpusRoot: fixture.corpusRoot,
          expectedMissingContentCount: S.Natural.make(1),
          expectedSurfaceCount: S.Natural.make(3),
          maxTotalElapsedMillis: PosInt.make(30_000),
          maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
          runLabel: "synthetic-recycle-restoration",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("physical entry not owned");
    })
  );

  it.effect(
    "rejects preserved recycle content whose bytes no longer match its sealed object identity",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeRecycleRestorationFixture();
      yield* fs.writeFileString(
        path.join(
          fixture.corpusRoot,
          "raw",
          "synthetic-recycle-restoration",
          "payload",
          "tree",
          "$Recycle.Bin",
          "surface-a",
          "$Rcase-a.txt"
        ),
        "mutated collision bytes"
      );
      const error = yield* restoreRecycle(
        RestorationRecycleOptions.make({
          corpusRoot: fixture.corpusRoot,
          expectedMissingContentCount: S.Natural.make(1),
          expectedSurfaceCount: S.Natural.make(3),
          maxTotalElapsedMillis: PosInt.make(30_000),
          maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
          runLabel: "synthetic-recycle-restoration",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("verification");
    })
  );
});

const legacyWordBwrapStub = restorationBwrapStub;

const legacyWordConverterStub = `#!/usr/bin/env bash
set -eu
if [ "\${1:-}" = "--version" ]; then
  printf 'LibreOffice synthetic 1.0\\n'
  exit 0
fi
format=""
outdir=""
input=""
previous=""
for argument in "$@"; do
  if [ "$previous" = "--convert-to" ]; then format="$argument"; fi
  if [ "$previous" = "--outdir" ]; then outdir="$argument"; fi
  previous="$argument"
  input="$argument"
done
mkdir -p "$outdir"
if [ "$format" = "docx" ]; then
  cp "$input" "$outdir/source.docx"
elif [ "$format" = "pdf" ]; then
  printf '%%PDF-1.4 synthetic legacy word page\\n' > "$outdir/source.pdf"
else
  exit 92
fi
`;

const legacyWordTikaStub = `#!/usr/bin/env bash
printf 'same normalized text\\n'
`;

const legacyWordPdfinfoStub = `#!/usr/bin/env bash
printf 'Pages:          1\\n'
`;

const legacyWordPdftoppmStub = `#!/usr/bin/env bash
prefix="\${@: -1}"
printf 'synthetic rendered page\\n' > "$prefix-1.png"
`;

const legacyWordEmptyPdftoppmStub = `#!/usr/bin/env bash
exit 0
`;

const legacyWordCompareStub = `#!/usr/bin/env bash
printf '0 (0)\\n' >&2
exit 0
`;

const makeLegacyWordRestorationFixture = Effect.fn("CorpusTest.makeLegacyWordRestorationFixture")(function* (
  pdftoppmScript: string = legacyWordPdftoppmStub
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "corpus-legacy-word-restoration-test-" });
  const corpusRoot = path.join(root, "corpus");
  const sourceRoot = path.join(root, "source");
  const rootArchive = path.join(root, "root-archive.zip");
  const collectorManifest = path.join(root, "collector.jsonl");
  const absentTree = path.join(root, "recorded-absent");
  const bwrapPath = path.join(root, "bwrap-stub");
  const converterPath = path.join(root, "converter-stub");
  const tikaPath = path.join(root, "tika-stub");
  const pdfinfoPath = path.join(root, "pdfinfo-stub");
  const pdftoppmPath = path.join(root, "pdftoppm-stub");
  const comparePath = path.join(root, "compare-stub");
  const cfb = new Uint8Array(64);
  cfb.set([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  cfb.fill(0x42, 8);

  yield* fs.makeDirectory(corpusRoot, { recursive: true });
  yield* fs.makeDirectory(path.join(sourceRoot, "set-a"), { recursive: true });
  yield* fs.makeDirectory(path.join(sourceRoot, "set-b"), { recursive: true });
  yield* fs.writeFile(path.join(sourceRoot, "set-a", "binary.doc"), cfb);
  yield* fs.writeFile(path.join(sourceRoot, "set-b", "duplicate.doc"), cfb);
  yield* fs.writeFileString(path.join(sourceRoot, "not-binary.doc"), "plain text with a legacy extension");
  yield* fs.writeFileString(rootArchive, "verbatim-root-archive");
  const collectorRowCount = yield* writePresentCollectorManifest(sourceRoot, collectorManifest);
  yield* writeStub(legacyWordBwrapStub, bwrapPath);
  yield* writeStub(legacyWordConverterStub, converterPath);
  yield* writeStub(legacyWordTikaStub, tikaPath);
  yield* writeStub(legacyWordPdfinfoStub, pdfinfoPath);
  yield* writeStub(pdftoppmScript, pdftoppmPath);
  yield* writeStub(legacyWordCompareStub, comparePath);
  const denominators = yield* measurePreservationDenominators(sourceRoot, rootArchive);
  yield* preserveRestorationArchive(
    RestorationPreserveOptions.make({
      absentRecycleTreePath: absentTree,
      capacityCeilingBytes: PosInt.make(10 * 1024 * 1024),
      chunkSizeBytes: PosInt.make(4_096),
      collectorDestinationPrefixSegments: S.Natural.make(2),
      corpusRoot,
      expectedCollectorCopiedCount: S.Natural.make(collectorRowCount),
      expectedCollectorErrorCount: S.Natural.make(0),
      expectedCollectorExcludedSecretCount: S.Natural.make(0),
      expectedCollectorPresentSuccessfulRowCount: S.Natural.make(collectorRowCount),
      expectedCollectorResumedCount: S.Natural.make(0),
      expectedCollectorRowCount: S.Natural.make(collectorRowCount),
      expectedCollectorUniqueSuccessfulDestinationCount: S.Natural.make(collectorRowCount),
      expectedMissingRecyclePayloadCount: S.Natural.make(0),
      expectedMutatedDestinationCount: S.Natural.make(0),
      ...denominators,
      minimumFreeAfterBytes: S.Natural.make(0),
      rootArchivePath: rootArchive,
      runLabel: "synthetic-legacy-word-restoration",
      sourceManifestPath: collectorManifest,
      sourceRoot,
    })
  );
  return { bwrapPath, comparePath, converterPath, corpusRoot, pdfinfoPath, pdftoppmPath, tikaPath };
});

const legacyWordRestorationOptions = (fixture: {
  readonly bwrapPath: string;
  readonly comparePath: string;
  readonly converterPath: string;
  readonly corpusRoot: string;
  readonly pdfinfoPath: string;
  readonly pdftoppmPath: string;
  readonly tikaPath: string;
}): RestorationLegacyWordOptions =>
  RestorationLegacyWordOptions.make({
    bwrapPath: fixture.bwrapPath,
    comparePath: fixture.comparePath,
    converterPath: fixture.converterPath,
    corpusRoot: fixture.corpusRoot,
    expectedConverterVersion: "LibreOffice synthetic 1.0",
    expectedOccurrenceCount: S.Natural.make(3),
    javaPath: fixture.tikaPath,
    maxElapsedMillis: PosInt.make(30_000),
    maxTotalElapsedMillis: PosInt.make(30_000),
    maxTotalOutputBytes: PosInt.make(1024 * 1024 * 1024),
    maxVisualRmse: 0,
    pdfinfoPath: fixture.pdfinfoPath,
    pdftoppmPath: fixture.pdftoppmPath,
    runLabel: "synthetic-legacy-word-restoration",
    tikaJarPath: fixture.tikaPath,
  });

it.layer(testLayer, { timeout: "30 seconds" })("corpus restoration legacy Word", (it) => {
  it.effect(
    "converts distinct CFB digests in a sandbox and approves only the explicit non-binary exception",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeLegacyWordRestorationFixture();
      const summary = yield* restoreLegacyWord(legacyWordRestorationOptions(fixture));
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-legacy-word-restoration",
        "ledgers",
        "legacy-word",
        "full.jsonl"
      );
      const lines = A.filter(Str.split(/\r?\n/u)(yield* fs.readFileString(ledgerPath)), Str.isNonEmpty);
      const records = yield* Effect.forEach(lines, decodeTransformationLedgerRecordJson);
      const passes = A.filter(records, (record) => record.recordType === "legacy-word-pass");
      const exceptions = A.filter(records, (record) => record.recordType === "legacy-word-exception");
      const acceptance = A.findFirst(
        records,
        (record) => record.recordType === "family-acceptance-pass" && record.family === "legacy-word"
      );

      expect(summary.sourceCount).toBe(3);
      expect(summary.passCount).toBe(1);
      expect(summary.exceptionCount).toBe(1);
      expect(summary.unapprovedCount).toBe(0);
      expect(passes).toHaveLength(1);
      expect(exceptions).toHaveLength(1);
      assertSome(
        O.map(exceptions[0] === undefined ? O.none() : O.some(exceptions[0]), (record) =>
          record.recordType === "legacy-word-exception"
            ? record.approved && record.exceptionKind === "not-binary-word"
            : false
        ),
        true
      );
      acceptance.pipe(O.isSome, assertTrue);
    })
  );

  it.effect(
    "rejects a renderer that returns success without materializing the positive pdfinfo page denominator",
    Effect.fnUntraced(function* () {
      const fixture = yield* makeLegacyWordRestorationFixture(legacyWordEmptyPdftoppmStub);
      const error = yield* restoreLegacyWord(legacyWordRestorationOptions(fixture)).pipe(Effect.flip);

      expect(error.message).toContain("zero-unapproved-terminal");
    })
  );
});

it.layer(testLayer, { concurrent: false, timeout: "30 seconds" })("corpus restoration acceptance", (it) => {
  it.effect(
    "rejects slice-only mail evidence when final acceptance requires the full-estate ledger",
    Effect.fnUntraced(function* () {
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      yield* restoreMail(mailRestorationOptions(fixture));
      const error = yield* reconcileRestorationAcceptance(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-mail-restoration",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("mail transformation ledger");
    }),
    { concurrent: false }
  );

  it.effect(
    "rejects a current full-family ledger copied from a different preservation run",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      yield* restoreMail(mailRestorationOptions(fixture, "full"));
      yield* preserveRestorationArchive(
        RestorationPreserveOptions.make({
          ...fixture.preservationOptions,
          runLabel: "synthetic-mail-restoration-other",
        })
      );
      const sourceLedgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "full.jsonl"
      );
      const crossRunLedgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration-other",
        "ledgers",
        "mail",
        "full.jsonl"
      );
      yield* fs.makeDirectory(path.dirname(crossRunLedgerPath), { recursive: true });
      yield* fs.writeFileString(crossRunLedgerPath, yield* fs.readFileString(sourceLedgerPath));
      const error = yield* reconcileRestorationAcceptance(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-mail-restoration-other",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("identity or scope does not match");
    })
  );

  it.effect(
    "rejects a prior unapproved family run even when a later full-family run passes",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const fixture = yield* makeMailRestorationFixture(restorationPffexportStub);
      yield* restoreMail(mailRestorationOptions(fixture, "full"));
      const ledgerPath = path.join(
        fixture.corpusRoot,
        "staging",
        "restoration",
        "runs",
        "synthetic-mail-restoration",
        "ledgers",
        "mail",
        "full.jsonl"
      );
      const ledgerText = yield* fs.readFileString(ledgerPath);
      const lines = A.filter(Str.split(/\r?\n/u)(ledgerText), Str.isNonEmpty);
      const acceptance = yield* decodeTransformationLedgerRecordJson(O.getOrElse(A.last(lines), () => ""));
      if (acceptance.recordType !== "family-acceptance-pass") {
        return yield* Effect.die("Expected a real full-mail acceptance row.");
      }
      const priorFailure = TransformationLedgerRecord.cases["family-acceptance-failure"].make({
        ...acceptance,
        message: "Synthetic prior run remained unapproved.",
        recordType: "family-acceptance-failure",
        unapprovedCount: S.Natural.make(1),
      });
      const encodedFailure = yield* encodeTransformationLedgerRecordJson(priorFailure);
      const priorRun = A.append(A.dropRight(lines, 1), encodedFailure);
      yield* fs.writeFileString(ledgerPath, `${A.join(priorRun, "\n")}\n${ledgerText}`);
      const error = yield* reconcileRestorationAcceptance(
        RestorationVerifyOptions.make({
          corpusRoot: fixture.corpusRoot,
          runLabel: "synthetic-mail-restoration",
        })
      ).pipe(Effect.flip);

      expect(error.message).toContain("unapproved prior run");
    })
  );
});
